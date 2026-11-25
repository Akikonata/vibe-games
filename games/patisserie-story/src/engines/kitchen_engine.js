// engines/kitchen_engine.js
// 2.5D 甜点屋全流程经营引擎：
// 餐区 5 态（空桌 -> Q版入座点单/婉拒 -> 享用动画 -> 结账收小费 -> 残渣餐盘清台）
// + 中腰玻璃展示柜预置库存 + 后厨大理石台双烤炉批量补烤

import { CHARACTERS } from '../data/characters.js';
import { getKitchenFlow } from '../data/kitchen_recipes.js';

const CUSTOMER_POOL = [
  { npcId: 'lillian', chibiKey: 'lillian' },
  { npcId: 'theo',    chibiKey: 'theo' },
  { npcId: 'bart',    chibiKey: 'bart' },
  { npcId: 'emily',   chibiKey: 'emily' }
];
const SHIFT_SECONDS = 55;
const EAT_DURATION_TICKS = 26; // 2.6s 享用甜点动画时长
const DECLINE_REP_PENALTY = 5;
const MAX_STOCK_PER_RECIPE = 5;
const LOW_STOCK_THRESHOLD = 1;
const OVEN_BURN_TICKS = 95; // 9.5s 烤好宽容期，55% 预警

function getBatchProfile(recipeId) {
  const flow = getKitchenFlow(recipeId);
  const stepCount = (flow && flow.steps ? flow.steps.length : 1);
  if (stepCount >= 3) return { batchSize: 2, duration: 52, tierLabel: '三阶精工' };
  if (stepCount === 2) return { batchSize: 3, duration: 44, tierLabel: '双阶手作' };
  return { batchSize: 3, duration: 36, tierLabel: '招牌快烤' };
}

export function createKitchenEngine(page, {
  menuRecipes,
  bonuses,
  tutorialMode = false,
  practiceMode = false,
  onTutorialDone,
  onServeEffect,
  onCheckoutEffect,
  onCleanEffect,
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
  let tablesCleaned = 0;
  let totalTips = 0;
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

  function makeEmptySeat(id) {
    return {
      id,
      status: 'empty', // 'empty' | 'ordering' | 'eating' | 'bill' | 'dirty'
      occupied: false
    };
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
      state: 'idle'
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
    const bakingIds = new Set(ovens.filter(o => o.state === 'working' || o.state === 'ready').map(o => o.recipeId));
    const urgentSeat = seats.find(s => {
      if (s.status !== 'ordering') return false;
      const slot = displayStock.find(d => d.recipeId === s.wantedId);
      return slot && slot.stock <= 0 && !bakingIds.has(s.wantedId);
    });
    if (urgentSeat) return urgentSeat.wantedId;

    const lowSlot = displayStock
      .slice()
      .sort((a, b) => a.stock - b.stock)
      .find(d => d.stock <= LOW_STOCK_THRESHOLD && !bakingIds.has(d.recipeId));
    if (lowSlot) return lowSlot.recipeId;

    const minSlot = displayStock.slice().sort((a, b) => a.stock - b.stock)[0];
    return minSlot ? minSlot.recipeId : (menuRecipes[0] && menuRecipes[0].id);
  }

  function computeHintAndHighlight(heldItem, displayStock, ovens, seats) {
    const warnOven = ovens.find(o => o.state === 'ready' && o.nearBurn);
    if (warnOven) {
      return { highlight: warnOven.id, hint: `🔥 【${warnOven.shortName}】快烤糊啦！快点击收获 +${warnOven.batchSize} 入柜！` };
    }

    const billSeat = seats.find(s => s.status === 'bill');
    if (billSeat) {
      return { highlight: `seat_${billSeat.id}`, hint: `🪙 【${billSeat.name}】用完餐举手结账啦！点击餐桌收款 + 小费！` };
    }

    const dirtySeat = seats.find(s => s.status === 'dirty');
    if (dirtySeat && !heldItem) {
      return { highlight: `seat_${dirtySeat.id}`, hint: `🧹 餐桌 ${dirtySeat.id + 1} 有残渣餐盘！点击清台迎接下一位客人！` };
    }

    if (heldItem) {
      const matchingSeat = seats.find(s => s.status === 'ordering' && s.wantedId === heldItem.recipeId);
      if (matchingSeat) {
        return { highlight: `seat_${matchingSeat.id}`, hint: `🍰 端着【${heldItem.recipeName}】！点击【${matchingSeat.name}】的餐桌上菜！` };
      }
      return { highlight: `disp_${heldItem.recipeId}`, hint: `目前没人点【${heldItem.recipeName}】，点展示柜放回库存即可！` };
    }

    const readyOven = ovens.find(o => o.state === 'ready');
    if (readyOven) {
      return { highlight: readyOven.id, hint: `✨ 【${readyOven.shortName}】整盘烤好！点击收获 +${readyOven.batchSize} 入展示柜` };
    }

    const servableSeat = seats.find(s => {
      if (s.status !== 'ordering') return false;
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

    const soldOutSeat = seats.find(s => {
      if (s.status !== 'ordering') return false;
      const slot = displayStock.find(d => d.recipeId === s.wantedId);
      return slot && slot.stock <= 0;
    });
    if (soldOutSeat) {
      const idleOven = ovens.find(o => o.state === 'idle');
      if (idleOven) {
        return {
          highlight: idleOven.id,
          hint: `🔥 【${soldOutSeat.wantedName}】库存不足！点下方【${idleOven.shortName}】批量烤制补货！`
        };
      }
    }

    const eatingSeat = seats.find(s => s.status === 'eating');
    if (eatingSeat) {
      return { highlight: '', hint: `😋 ${eatingSeat.name} 正在开心享用【${eatingSeat.wantedName}】，马上就结账啦！` };
    }

    return { highlight: 'oven_1', hint: '点展示柜取餐招待，用完餐点餐桌结账收小费并清台！' };
  }

  function spawnCustomerInto(seats) {
    const emptyIdx = seats.findIndex(s => s.status === 'empty');
    if (emptyIdx === -1 || menuRecipes.length === 0) return seats;

    const wanted = menuRecipes[Math.floor(Math.random() * menuRecipes.length)];
    const busyIds = seats.filter(s => s.npcId).map(s => s.npcId);
    const candidates = CUSTOMER_POOL.filter(c => !busyIds.includes(c.npcId));
    const pick = candidates.length > 0
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : CUSTOMER_POOL[Math.floor(Math.random() * CUSTOMER_POOL.length)];
    const npc = CHARACTERS[pick.npcId] || CHARACTERS.lillian;

    const nextSeats = seats.slice();
    nextSeats[emptyIdx] = {
      id: emptyIdx,
      status: 'ordering',
      occupied: true,
      npcId: pick.npcId,
      name: npc.name,
      chibiImg: `assets/images/kitchen/guest_${pick.chibiKey}.png`,
      wantedId: wanted.id,
      wantedName: wanted.name,
      wantedIcon: wanted.iconImg,
      price: wanted.price,
      patience: 100,
      eatProgress: 0,
      servePatience: 100,
      billWaitTicks: 0
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
        totalTips,
        tablesCleaned,
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
    tablesCleaned = 0;
    totalTips = 0;
    refillTimers = [0, 0, 0];
    pauseReasons.clear();
    msgHoldTicks = 0;

    const displayStock = buildInitialDisplayStock();
    const ovens = [
      makeEmptyOven('oven_1', '红砖批量烤炉 1', '烤炉 1'),
      makeEmptyOven('oven_2', '红砖批量烤炉 2', '烤炉 2')
    ];

    let seats = [makeEmptySeat(0), makeEmptySeat(1), makeEmptySeat(2)];
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
      shiftTips: 0,
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
    const speedMult = frozenClock ? 1.5 : 1;

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

    // 2. 更新餐区 3 桌状态（点单耐心 / 用餐吃东西进度 / 结账等待）
    const patienceDrain = 0.34 / (bonuses ? bonuses.patienceMult : 1);
    let seats = (page.data.seats || []).map(s => {
      if (s.status === 'ordering') {
        if (frozenClock) return s;
        const nextP = s.patience - patienceDrain;
        if (nextP <= 0) {
          lostCustomers += 1;
          customMsg = `😅 ${s.name} 等太久离开餐桌了`;
          page.setData({ shiftCombo: 0 });
          refillTimers[s.id] = 16;
          return makeEmptySeat(s.id);
        }
        return Object.assign({}, s, { patience: nextP });
      }
      if (s.status === 'eating') {
        const nextEat = Math.min(100, (s.eatProgress || 0) + (100 / EAT_DURATION_TICKS) * speedMult);
        if (nextEat >= 100) {
          customMsg = `🪙 ${s.name} 吃完【${s.wantedName}】啦！点餐桌结账收小费！`;
          return Object.assign({}, s, { status: 'bill', eatProgress: 100, billWaitTicks: 0 });
        }
        return Object.assign({}, s, { eatProgress: Math.round(nextEat) });
      }
      if (s.status === 'bill' && !frozenClock) {
        return Object.assign({}, s, { billWaitTicks: (s.billWaitTicks || 0) + 1 });
      }
      return s;
    });

    for (let i = 0; i < 3; i++) {
      if (refillTimers[i] > 0) {
        refillTimers[i] -= 1;
        if (refillTimers[i] === 0 && seats[i].status === 'empty') {
          seats = spawnCustomerInto(seats);
        }
      }
    }

    if (!frozenClock && seats.every(s => s.status === 'empty') && refillTimers.every(t => t <= 0)) {
      seats = spawnCustomerInto(seats);
    } else if (!frozenClock && tick > 0 && tick % 36 === 0) {
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

  function tapDisplay(recipeId) {
    if (ended || isPaused()) return;
    const stockList = page.data.displayStock.map(d => Object.assign({}, d));
    const idx = stockList.findIndex(d => d.recipeId === recipeId);
    if (idx === -1) return;
    const slot = stockList[idx];
    const held = page.data.heldItem;

    if (held && held.recipeId === recipeId) {
      if (slot.stock < slot.maxStock) {
        slot.stock += 1;
        syncGuide(null, stockList, page.data.ovens, page.data.seats, `已将【${slot.name}】放回展示柜（余 ${slot.stock}）`);
      } else {
        flashMsg(`展示柜【${slot.name}】已满，直接端去招待客人吧！`);
      }
      return;
    }

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

    startBatchBake(null, ovenId);
  }

  // 点击餐桌：按餐桌当前状态执行【上菜进入吃东西 / 结账收小费 / 清理残渣餐盘】
  function tapSeat(seatId) {
    if (ended || isPaused()) return;
    const seats = page.data.seats.slice();
    const seat = seats[seatId];
    const held = page.data.heldItem;
    if (!seat || seat.status === 'empty') return;

    // 1. 结账状态 -> 收取餐费 + 小费，客人满意离座，桌上留下残渣餐盘待清台！
    if (seat.status === 'bill') {
      const nextCombo = page.data.shiftCombo + 1;
      const serveTip = seat.servePatience >= 65 ? 10 : (seat.servePatience >= 40 ? 5 : 0);
      const quickBillTip = (seat.billWaitTicks || 0) <= 35 ? 6 : 0;
      const comboTip = nextCombo >= 2 ? Math.min(15, nextCombo * 3) : 0;
      const upgradeTip = bonuses ? bonuses.tipBonus : 0;
      const tip = serveTip + quickBillTip + comboTip + upgradeTip;
      const earned = seat.price + tip;
      const rep = Math.round(10 * (bonuses ? bonuses.repMult : 1));

      totalTips += tip;
      seats[seatId] = {
        id: seatId,
        status: 'dirty',
        occupied: false
      };

      if (typeof onCheckoutEffect === 'function') {
        onCheckoutEffect({ seatId, basePrice: seat.price, tip, earned, customerName: seat.name });
      }

      page.setData({
        shiftCoins: page.data.shiftCoins + earned,
        shiftTips: page.data.shiftTips + tip,
        shiftRep: page.data.shiftRep + rep,
        shiftServed: page.data.shiftServed + 1,
        shiftCombo: nextCombo
      });
      syncGuide(
        held,
        page.data.displayStock,
        page.data.ovens,
        seats,
        `🪙 结账成功！餐费 +${seat.price} + 小费 +${tip}（点餐桌清理残渣餐盘）`
      );
      return;
    }

    // 2. 残渣餐盘状态 -> 一键清台！空出餐桌，1 秒后迎来新客
    if (seat.status === 'dirty') {
      tablesCleaned += 1;
      seats[seatId] = makeEmptySeat(seatId);
      refillTimers[seatId] = 10;

      if (typeof onCleanEffect === 'function') {
        onCleanEffect({ seatId });
      }

      if (inTutorial && !practiceMode) {
        inTutorial = false;
        page.setData({ inTutorial: false });
        if (typeof onTutorialDone === 'function') onTutorialDone();
      }

      syncGuide(
        held,
        page.data.displayStock,
        page.data.ovens,
        seats,
        `✨ 餐桌 ${seatId + 1} 已擦拭干净！马上迎来下一位客人～`
      );
      return;
    }

    // 3. 正在享用甜点中
    if (seat.status === 'eating') {
      flashMsg(`😋 ${seat.name} 正在品尝【${seat.wantedName}】（${seat.eatProgress}%），吃完马上结账！`);
      return;
    }

    // 4. 点单等待中 -> 上菜开始享用动画！
    if (!held) {
      const slot = page.data.displayStock.find(d => d.recipeId === seat.wantedId);
      if (slot && slot.stock > 0) {
        flashMsg(`🧁 ${seat.name} 点了【${seat.wantedName}】，请先点中间展示柜取餐（余 ${slot.stock} 份）！`);
      } else {
        flashMsg(`🔥 【${seat.wantedName}】库存不足！请点下方烤炉批量烤制补货，或点「婉拒」空桌！`);
      }
      return;
    }

    if (held.recipeId !== seat.wantedId) {
      flashMsg(`送错桌啦！${seat.name} 点的是【${seat.wantedName}】，点展示柜可放回换餐！`);
      return;
    }

    seats[seatId] = Object.assign({}, seat, {
      status: 'eating',
      eatProgress: 8,
      servePatience: seat.patience
    });

    if (typeof onServeEffect === 'function') {
      onServeEffect({ seatId, customerName: seat.name, recipeIcon: held.recipeIcon });
    }

    syncGuide(
      null,
      page.data.displayStock,
      page.data.ovens,
      seats,
      `😋 【${seat.wantedName}】已端上桌，${seat.name} 正在开心品尝！`
    );
  }

  function declineSeat(seatId) {
    if (ended || isPaused()) return;
    const seats = page.data.seats.slice();
    const seat = seats[seatId];
    if (!seat || seat.status !== 'ordering') return;

    declinedCustomers += 1;
    seats[seatId] = makeEmptySeat(seatId);
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
