// engines/kitchen_engine.js
// 2.5D 甜点屋分区经营引擎：餐区入座招待 + 玻璃展示柜预置库存 + 后厨双烤炉批量补烤 + 婉拒空位（扣口碑）
// 数值经 game-balance-design 推导：预置 2~3 份起售，低库存(<=1)预警，按甜点复杂度 3.6s~5.2s 批量烤 2~3 份直接入柜

import { CHARACTERS } from '../data/characters.js';
import { getKitchenFlow } from '../data/kitchen_recipes.js';

const CUSTOMER_POOL = ['lillian', 'theo', 'bart', 'emily', 'casper', 'madeleine'];
const SHIFT_SECONDS = 45;
const DECLINE_REP_PENALTY = 5;
const MAX_STOCK_PER_RECIPE = 5;
const LOW_STOCK_THRESHOLD = 1;
const OVEN_BURN_TICKS = 95; // 9.5s 烤好后宽容期，55%(5.2s) 触发快烤糊预警

function getBatchProfile(recipeId) {
  const flow = getKitchenFlow(recipeId);
  const stepCount = (flow && flow.steps ? flow.steps.length : 1);
  if (stepCount >= 3) {
    return { batchSize: 2, duration: 52, tierLabel: '三阶精工' }; // 5.2s -> +2份
  }
  if (stepCount === 2) {
    return { batchSize: 3, duration: 44, tierLabel: '双阶手作' }; // 4.4s -> +3份
  }
  return { batchSize: 3, duration: 36, tierLabel: '招牌快烤' };   // 3.6s -> +3份
}

export function createKitchenEngine(page, {
  menuRecipes,
  bonuses,
  tutorialMode = false,
  practiceMode = false,
  onTutorialDone,
  onServeEffect,
  onDeclineEffect,
  onHarvestEffect,
  onShiftEnd
}) {
  let timer = null;
  let tick = 0;
  let ended = false;
  let inTutorial = !!(tutorialMode || practiceMode);
  const pauseReasons = new Set();
  let msgHoldTicks = 0;

  let lostCustomers = 0;
  let declinedCustomers = 0;
  let burntCount = 0;
  let batchesBaked = 0;
  let refillTimers = [0, 0, 0];

  function isPaused() {
    return pauseReasons.size > 0;
  }

  function syncPauseState() {
    page.setData({
      isPaused: pauseReasons.size > 0,
      pauseManual: pauseReasons.has('manual') || pauseReasons.has('hidden'),
      pauseHidden: pauseReasons.has('hidden')
    });
  }

  function flashMsg(msg, ticks = 20) {
    msgHoldTicks = ticks;
    page.setData({ serviceMsg: msg });
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function makeEmptyOven(id, name, shortName) {
    return {
      id,
      type: 'oven',
      name,
      shortName,
      recipeId: null,
      recipeName: '',
      recipeIcon: '',
      batchSize: 0,
      duration: 36,
      progress: 0,
      overcook: 0,
      nearBurn: false,
      state: 'idle' // 'idle' | 'working' | 'ready' | 'burnt'
    };
  }

  function buildInitialDisplayStock() {
    const initQty = menuRecipes.length === 1 ? 3 : 2;
    return menuRecipes.map(r => {
      const bp = getBatchProfile(r.id);
      return {
        recipeId: r.id,
        name: r.name,
        iconImg: r.iconImg,
        price: r.price,
        stock: initQty,
        maxStock: MAX_STOCK_PER_RECIPE,
        batchSize: bp.batchSize,
        batchDuration: bp.duration,
        tierLabel: bp.tierLabel
      };
    });
  }

  function pickMostNeededRecipeId(displayStock, seats, ovens) {
    // 1. 优先：有在座顾客正在等且库存=0、且烤炉里尚未在烤的甜点
    const bakingIds = new Set(ovens.filter(o => o.state === 'working' || o.state === 'ready').map(o => o.recipeId));
    const urgentSeat = seats.find(s => {
      if (!s.occupied) return false;
      const slot = displayStock.find(d => d.recipeId === s.wantedId);
      return slot && slot.stock <= 0 && !bakingIds.has(s.wantedId);
    });
    if (urgentSeat) return urgentSeat.wantedId;

    // 2. 其次：库存=0 或 <=1 且没在烤的甜点
    const lowSlot = displayStock
      .slice()
      .sort((a, b) => a.stock - b.stock)
      .find(d => d.stock <= LOW_STOCK_THRESHOLD && !bakingIds.has(d.recipeId));
    if (lowSlot) return lowSlot.recipeId;

    // 3. 兜底：库存最少且未满的甜点
    const minSlot = displayStock.slice().sort((a, b) => a.stock - b.stock)[0];
    return minSlot ? minSlot.recipeId : (menuRecipes[0] && menuRecipes[0].id);
  }

  function computeHintAndHighlight(heldItem, displayStock, ovens, seats) {
    // 优先 1：烤炉快烤糊或已烤好可收获入柜
    const warnOven = ovens.find(o => o.state === 'ready' && o.nearBurn);
    if (warnOven) {
      return { highlight: warnOven.id, hint: `🔥 【${warnOven.shortName}】快烤糊啦！快点击收获 +${warnOven.batchSize} 份入柜！` };
    }
    const readyOven = ovens.find(o => o.state === 'ready');
    if (readyOven && !heldItem) {
      return { highlight: readyOven.id, hint: `✨ 【${readyOven.shortName}】整盘烤好！点击收获 +${readyOven.batchSize} 份入展示柜` };
    }

    // 优先 2：手里正端着成品甜点 -> 送去对应餐桌
    if (heldItem) {
      const matchingSeat = seats.find(s => s.occupied && s.wantedId === heldItem.recipeId);
      if (matchingSeat) {
        return { highlight: `seat_${matchingSeat.id}`, hint: `🍰 端着【${heldItem.recipeName}】！点击【${matchingSeat.name}】的餐桌上菜！` };
      }
      return { highlight: `disp_${heldItem.recipeId}`, hint: `目前餐区没人点【${heldItem.recipeName}】，点展示柜放回库存即可！` };
    }

    // 优先 3：有顾客点的甜点有库存 -> 高亮展示柜取餐
    const servableSeat = seats.find(s => {
      if (!s.occupied) return false;
      const slot = displayStock.find(d => d.recipeId === s.wantedId);
      return slot && slot.stock > 0;
    });
    if (servableSeat) {
      const slot = displayStock.find(d => d.recipeId === servableSeat.wantedId);
      return {
        highlight: `disp_${slot.recipeId}`,
        hint: `🧁 点击展示柜取【${slot.name}】（余 ${slot.stock}），送去【${servableSeat.name}】餐桌！`
      };
    }

    // 优先 4：在座顾客点的全售罄 -> 高亮空闲烤炉提示批量补烤
    const soldOutSeat = seats.find(s => {
      if (!s.occupied) return false;
      const slot = displayStock.find(d => d.recipeId === s.wantedId);
      return slot && slot.stock <= 0;
    });
    if (soldOutSeat) {
      const idleOven = ovens.find(o => o.state === 'idle');
      if (idleOven) {
        return {
          highlight: idleOven.id,
          hint: `🔥 【${soldOutSeat.wantedName}】库存不足！点下方【${idleOven.shortName}】或菜品钮批量烤制补货！`
        };
      }
      const workingOven = ovens.find(o => o.state === 'working');
      if (workingOven) {
        return {
          highlight: workingOven.id,
          hint: `⏳ 【${workingOven.recipeName}】正在批量烤制中（可等出炉或婉拒空出餐桌）`
        };
      }
    }

    const burntOven = ovens.find(o => o.state === 'burnt');
    if (burntOven) {
      return { highlight: burntOven.id, hint: `💨 【${burntOven.shortName}】烤糊了！点击直接清理残渣` };
    }

    return { highlight: 'oven_1', hint: '点展示柜取餐招待，库存告急时点下方烤炉批量烤制补货！' };
  }

  function spawnCustomerInto(seats) {
    const emptyIdx = seats.findIndex(s => !s.occupied);
    if (emptyIdx === -1 || menuRecipes.length === 0) return seats;

    const wanted = menuRecipes[Math.floor(Math.random() * menuRecipes.length)];
    const busyIds = seats.filter(s => s.occupied).map(s => s.npcId);
    const candidates = CUSTOMER_POOL.filter(c => !busyIds.includes(c));
    const npcId = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : CUSTOMER_POOL[Math.floor(Math.random() * CUSTOMER_POOL.length)];
    const npc = CHARACTERS[npcId] || CHARACTERS.lillian;

    const nextSeats = seats.slice();
    nextSeats[emptyIdx] = {
      id: emptyIdx,
      occupied: true,
      npcId,
      name: npc.name,
      portrait: `assets/images/portraits/${npcId}.png`,
      wantedId: wanted.id,
      wantedName: wanted.name,
      wantedIcon: wanted.iconImg,
      price: wanted.price,
      patience: 100
    };
    return nextSeats;
  }

  function finalizeShift() {
    if (ended) return;
    ended = true;
    stop();
    const undeliveredCount = (page.data.ovens || []).filter(o => o.state === 'working' || o.state === 'ready').length
      + (page.data.heldItem ? 1 : 0);
    if (typeof onShiftEnd === 'function') {
      onShiftEnd({
        earnedCoins: page.data.shiftCoins,
        earnedRep: page.data.shiftRep,
        servedCount: page.data.shiftServed,
        lostCustomers,
        declinedCustomers,
        burntCount,
        batchesBaked,
        undeliveredCount,
        isPractice: practiceMode
      });
    }
  }

  function start() {
    stop();
    tick = 0;
    ended = false;
    lostCustomers = 0;
    declinedCustomers = 0;
    burntCount = 0;
    batchesBaked = 0;
    refillTimers = [0, 0, 0];
    pauseReasons.clear();
    msgHoldTicks = 0;

    const displayStock = buildInitialDisplayStock();
    const ovens = [
      makeEmptyOven('oven_1', '红砖批量烤炉 1', '烤炉 1'),
      makeEmptyOven('oven_2', '红砖批量烤炉 2', '烤炉 2')
    ];

    let seats = [
      { id: 0, occupied: false },
      { id: 1, occupied: false },
      { id: 2, occupied: false }
    ];
    seats = spawnCustomerInto(seats);
    seats = spawnCustomerInto(seats);

    const guide = computeHintAndHighlight(null, displayStock, ovens, seats);

    page.setData({
      isOpen: true,
      isPractice: practiceMode,
      isPaused: false,
      pauseManual: false,
      pauseHidden: false,
      shiftTimeLeft: SHIFT_SECONDS,
      shiftCoins: 0,
      shiftRep: 0,
      shiftServed: 0,
      shiftCombo: 0,
      seats,
      displayStock,
      ovens,
      heldItem: null,
      inTutorial,
      highlightTarget: guide.highlight,
      serviceMsg: guide.hint,
      daySummary: null
    }, () => {
      startLoop();
    });
  }

  function pause(reason = 'manual') {
    pauseReasons.add(reason);
    syncPauseState();
  }

  function resume(reason = 'manual') {
    pauseReasons.delete(reason);
    syncPauseState();
  }

  function resumeAll() {
    pauseReasons.clear();
    syncPauseState();
  }

  function skipTutorial() {
    if (practiceMode || !inTutorial) return;
    inTutorial = false;
    page.setData({ inTutorial: false });
    if (typeof onTutorialDone === 'function') onTutorialDone();
  }

  function syncGuide(heldItem, displayStock, ovens, seats, customMsg) {
    const guide = computeHintAndHighlight(heldItem, displayStock, ovens, seats);
    if (customMsg) msgHoldTicks = 18;
    page.setData({
      heldItem,
      displayStock,
      ovens,
      seats,
      highlightTarget: guide.highlight,
      serviceMsg: customMsg || guide.hint
    });
  }

  function stepTick() {
    if (ended || isPaused()) return;
    const frozenClock = inTutorial || practiceMode;
    if (!frozenClock) tick += 1;
    const timeLeft = Math.max(0, SHIFT_SECONDS - Math.floor(tick / 10));
    let customMsg = '';
    const speedMult = frozenClock ? 1.6 : 1;

    // 1. 推进后厨双烤炉批量烘烤进度
    const ovens = (page.data.ovens || []).map(o => {
      if (o.state === 'working') {
        const nextProg = Math.min(100, o.progress + (100 / o.duration) * speedMult);
        if (nextProg >= 100) {
          customMsg = `✨ 【${o.shortName}】${o.recipeName} ×${o.batchSize} 烤好啦！点击入柜补货`;
          return Object.assign({}, o, { progress: 100, state: 'ready', overcook: 0, nearBurn: false });
        }
        return Object.assign({}, o, { progress: Math.round(nextProg) });
      }
      if (o.state === 'ready' && !frozenClock) {
        const nextOver = o.overcook + 1;
        const warnTick = Math.floor(OVEN_BURN_TICKS * 0.55);
        if (nextOver >= OVEN_BURN_TICKS) {
          burntCount += 1;
          customMsg = `💨 【${o.shortName}】整盘烤糊了！点击烤炉一键清渣`;
          return Object.assign({}, o, { state: 'burnt', nearBurn: false, overcook: nextOver });
        }
        const isNearBurn = nextOver >= warnTick;
        if (isNearBurn && !o.nearBurn) {
          customMsg = `🔥 【${o.shortName}】快烤糊啦！快点击收获入柜！`;
        }
        return Object.assign({}, o, { overcook: nextOver, nearBurn: isNearBurn });
      }
      return o;
    });

    // 2. 更新餐区 3 桌顾客耐心
    const patienceDrain = 0.36 / (bonuses ? bonuses.patienceMult : 1);
    let seats = (page.data.seats || []).map(s => {
      if (!s.occupied || frozenClock) return s;
      const nextP = s.patience - patienceDrain;
      if (nextP <= 0) {
        lostCustomers += 1;
        customMsg = `😅 ${s.name} 等太久离开餐桌了`;
        page.setData({ shiftCombo: 0 });
        return { id: s.id, occupied: false };
      }
      return Object.assign({}, s, { patience: nextP });
    });

    for (let i = 0; i < 3; i++) {
      if (refillTimers[i] > 0) {
        refillTimers[i] -= 1;
        if (refillTimers[i] === 0 && !seats[i].occupied) {
          seats = spawnCustomerInto(seats);
        }
      }
    }

    if (!frozenClock && seats.every(s => !s.occupied) && refillTimers.every(t => t <= 0)) {
      seats = spawnCustomerInto(seats);
    } else if (!frozenClock && tick > 0 && tick % 32 === 0) {
      seats = spawnCustomerInto(seats);
    }

    const guide = computeHintAndHighlight(page.data.heldItem, page.data.displayStock, ovens, seats);
    if (customMsg) {
      msgHoldTicks = 18;
    } else if (msgHoldTicks > 0) {
      msgHoldTicks -= 1;
    }
    const nextMsg = customMsg || (msgHoldTicks > 0 ? page.data.serviceMsg : guide.hint);
    page.setData({
      shiftTimeLeft: timeLeft,
      ovens,
      seats,
      highlightTarget: guide.highlight,
      serviceMsg: nextMsg
    });

    if (!frozenClock && timeLeft <= 0) {
      finalizeShift();
    }
  }

  function startLoop() {
    stop();
    timer = setInterval(stepTick, 100);
  }

  // 点击中腰玻璃展示柜：有库存取 1 份端在手里；手里正端着同款则放回展示柜；库存=0 提示烤制！
  function tapDisplay(recipeId) {
    if (ended || isPaused()) return;
    const stockList = page.data.displayStock.map(d => Object.assign({}, d));
    const idx = stockList.findIndex(d => d.recipeId === recipeId);
    if (idx === -1) return;
    const slot = stockList[idx];
    const held = page.data.heldItem;

    // 情况 1：手里正端着同款甜点 -> 放回展示柜库存
    if (held && held.recipeId === recipeId) {
      if (slot.stock < slot.maxStock) {
        slot.stock += 1;
        syncGuide(null, stockList, page.data.ovens, page.data.seats, `已将【${slot.name}】放回展示柜（余 ${slot.stock}）`);
      } else {
        flashMsg(`展示柜【${slot.name}】已满，直接端去招待客人吧！`);
      }
      return;
    }

    // 情况 2：手里正端着别的甜点 -> 放回原位并换成这一款（若有库存）
    if (held && held.recipeId !== recipeId) {
      if (slot.stock <= 0) {
        flashMsg(`🔥 【${slot.name}】库存不足！请点下方烤炉批量烤制 +${slot.batchSize} 份！`);
        return;
      }
      const prevIdx = stockList.findIndex(d => d.recipeId === held.recipeId);
      if (prevIdx !== -1 && stockList[prevIdx].stock < stockList[prevIdx].maxStock) {
        stockList[prevIdx].stock += 1;
      }
      slot.stock -= 1;
      const picked = { recipeId: slot.recipeId, recipeName: slot.name, recipeIcon: slot.iconImg };
      syncGuide(picked, stockList, page.data.ovens, page.data.seats, `换取了【${slot.name}】（柜内余 ${slot.stock}）`);
      return;
    }

    // 情况 3：空手取餐
    if (slot.stock <= 0) {
      flashMsg(`🔥 【${slot.name}】库存不足（已售罄）！请点击下方烤炉或补烤按钮批量烤制 +${slot.batchSize} 份！`);
      return;
    }

    slot.stock -= 1;
    const picked = { recipeId: slot.recipeId, recipeName: slot.name, recipeIcon: slot.iconImg };
    const lowWarn = slot.stock === 0
      ? `⚠️ 【${slot.name}】已拿光售罄！送完这单记得点下方烤炉批量补烤！`
      : (slot.stock <= LOW_STOCK_THRESHOLD ? `⚠️ 【${slot.name}】库存告急（仅剩 ${slot.stock} 份），建议趁空批量补烤！` : '');
    syncGuide(picked, stockList, page.data.ovens, page.data.seats, lowWarn || `🧁 已从展示柜取出【${slot.name}】，快去对应餐桌上菜！`);
  }

  // 启动一盘批量烤制（指定甜点或智能挑最缺库存甜点）
  function startBatchBake(recipeId, preferredOvenId = null) {
    if (ended || isPaused()) return { ok: false, reason: 'paused' };
    const ovens = page.data.ovens.map(o => Object.assign({}, o));
    const displayStock = page.data.displayStock;

    let ovenIdx = preferredOvenId ? ovens.findIndex(o => o.id === preferredOvenId && o.state === 'idle') : -1;
    if (ovenIdx === -1) ovenIdx = ovens.findIndex(o => o.state === 'idle');
    if (ovenIdx === -1) {
      flashMsg('⏳ 两座烤炉都在忙呢！等其中一炉烤好收获后再放入新的一盘吧');
      return { ok: false, reason: 'busy' };
    }

    const targetRecipeId = recipeId || pickMostNeededRecipeId(displayStock, page.data.seats, ovens);
    const slot = displayStock.find(d => d.recipeId === targetRecipeId);
    if (!slot) return { ok: false, reason: 'invalid' };

    if (slot.stock >= slot.maxStock) {
      flashMsg(`【${slot.name}】展示柜库存已满（${slot.stock}/${slot.maxStock}），先招呼客人吧！`);
      return { ok: false, reason: 'full' };
    }

    const o = ovens[ovenIdx];
    ovens[ovenIdx] = Object.assign({}, o, {
      recipeId: slot.recipeId,
      recipeName: slot.name,
      recipeIcon: slot.iconImg,
      batchSize: slot.batchSize,
      duration: slot.batchDuration,
      progress: 6,
      overcook: 0,
      nearBurn: false,
      state: 'working'
    });

    syncGuide(
      page.data.heldItem,
      displayStock,
      ovens,
      page.data.seats,
      `🔥 【${o.shortName}】开始批量烤制 ${slot.name} ×${slot.batchSize}（约 ${(slot.batchDuration / 10).toFixed(1)}s）！`
    );
    return { ok: true, ovenId: o.id, recipeId: slot.recipeId };
  }

  // 点击后厨批量烤炉：烤好 -> 整盘收获入柜；烤糊 -> 一键清渣；空闲 -> 智能批量补烤最缺甜点
  function tapOven(ovenId) {
    if (ended || isPaused()) return;
    const ovens = page.data.ovens.map(o => Object.assign({}, o));
    const idx = ovens.findIndex(o => o.id === ovenId);
    if (idx === -1) return;
    const o = ovens[idx];

    if (o.state === 'ready') {
      const stockList = page.data.displayStock.map(d => Object.assign({}, d));
      const dIdx = stockList.findIndex(d => d.recipeId === o.recipeId);
      let added = o.batchSize;
      if (dIdx !== -1) {
        const before = stockList[dIdx].stock;
        stockList[dIdx].stock = Math.min(stockList[dIdx].maxStock, before + o.batchSize);
        added = stockList[dIdx].stock - before;
      }
      batchesBaked += 1;
      ovens[idx] = makeEmptyOven(o.id, o.name, o.shortName);
      if (typeof onHarvestEffect === 'function') {
        onHarvestEffect({ ovenId: o.id, recipeName: o.recipeName, added: added || o.batchSize });
      }
      syncGuide(
        page.data.heldItem,
        stockList,
        ovens,
        page.data.seats,
        `✨ 【${o.recipeName}】整盘出炉，展示柜库存 +${added || o.batchSize}！`
      );
      return;
    }

    if (o.state === 'burnt') {
      ovens[idx] = makeEmptyOven(o.id, o.name, o.shortName);
      syncGuide(page.data.heldItem, page.data.displayStock, ovens, page.data.seats, `🗑️ 已清理【${o.shortName}】烤糊残渣，炉位已空出！`);
      return;
    }

    if (o.state === 'working') {
      flashMsg(`⏳ 【${o.shortName}】正在批量烤制 ${o.recipeName} ×${o.batchSize}（${o.progress}%）`);
      return;
    }

    // 空闲烤炉 -> 智能挑选最缺库存的甜点开烤
    startBatchBake(null, ovenId);
  }

  // 点击餐区餐桌：端上成品招待顾客！
  function tapSeat(seatId) {
    if (ended || isPaused()) return;
    const seats = page.data.seats.slice();
    const seat = seats[seatId];
    const held = page.data.heldItem;

    if (!seat || !seat.occupied) return;

    if (!held) {
      const slot = page.data.displayStock.find(d => d.recipeId === seat.wantedId);
      if (slot && slot.stock > 0) {
        flashMsg(`🧁 ${seat.name} 点了【${seat.wantedName}】，请先点击中间展示柜取餐（余 ${slot.stock} 份）！`);
      } else {
        flashMsg(`🔥 【${seat.wantedName}】库存不足！请点击下方烤炉批量烤制补货，或点「婉拒」空出餐桌！`);
      }
      return;
    }

    if (held.recipeId !== seat.wantedId) {
      flashMsg(`送错桌啦！${seat.name} 点的是【${seat.wantedName}】，可点展示柜放回换餐！`);
      return;
    }

    // 上菜大成功！连击小费封顶 +18，配合 2.2s 自然翻台节奏防止单日经济通胀
    const nextCombo = page.data.shiftCombo + 1;
    const speedTip = seat.patience >= 70 ? 8 : 0;
    const comboTip = nextCombo >= 2 ? Math.min(18, nextCombo * 3) : 0;
    const upgradeTip = bonuses ? bonuses.tipBonus : 0;
    const earned = seat.price + speedTip + comboTip + upgradeTip;
    const rep = Math.round(10 * (bonuses ? bonuses.repMult : 1));

    seats[seatId] = { id: seatId, occupied: false };
    refillTimers[seatId] = 22; // 2.2s 后迎来下一位新客人入座

    if (typeof onServeEffect === 'function') {
      onServeEffect({ seatId, earned, customerName: seat.name, recipeIcon: held.recipeIcon });
    }

    if (inTutorial && !practiceMode) {
      inTutorial = false;
      page.setData({ inTutorial: false });
      if (typeof onTutorialDone === 'function') onTutorialDone();
    }

    page.setData({
      shiftCoins: page.data.shiftCoins + earned,
      shiftRep: page.data.shiftRep + rep,
      shiftServed: page.data.shiftServed + 1,
      shiftCombo: nextCombo
    });
    syncGuide(
      null,
      page.data.displayStock,
      page.data.ovens,
      seats,
      practiceMode
        ? `🎓 练习上菜成功！【${seat.wantedName}】已端上 ${seat.name} 的餐桌！`
        : `✨ ${seat.name} 享用【${seat.wantedName}】超满意！+${earned} 金币`
    );
  }

  // 婉拒顾客：主动空出餐桌，扣除口碑并重置连击
  function declineSeat(seatId) {
    if (ended || isPaused()) return;
    const seats = page.data.seats.slice();
    const seat = seats[seatId];
    if (!seat || !seat.occupied) return;

    declinedCustomers += 1;
    seats[seatId] = { id: seatId, occupied: false };
    refillTimers[seatId] = 15;

    const nextRep = practiceMode ? page.data.shiftRep : (page.data.shiftRep - DECLINE_REP_PENALTY);
    page.setData({
      shiftRep: nextRep,
      shiftCombo: 0
    });

    if (typeof onDeclineEffect === 'function') {
      onDeclineEffect({
        seatId,
        customerName: seat.name,
        repPenalty: practiceMode ? 0 : DECLINE_REP_PENALTY
      });
    }

    syncGuide(
      page.data.heldItem,
      page.data.displayStock,
      page.data.ovens,
      seats,
      practiceMode
        ? `🚪 已婉拒 ${seat.name} 空出餐桌（练习不扣真实口碑，稍后补位）`
        : `🚪 已婉拒 ${seat.name} 空出餐桌，口碑 -${DECLINE_REP_PENALTY}、连击清零`
    );
  }

  return {
    start,
    stop,
    stepTick,
    pause,
    resume,
    resumeAll,
    isPaused,
    finishShift: finalizeShift,
    skipTutorial,
    tapDisplay,
    tapOven,
    startBatchBake,
    tapSeat,
    declineSeat
  };
}
