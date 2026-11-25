// engines/kitchen_engine.js
// 轻度胡闹厨房（Overcooked-Lite）甜点屋营业模拟引擎
// 支持：3 座位同步来客、双烤炉/裱花台/装饰台/暂存台/回收桶、智能高亮下一步引导、多原因统一暂停、练习模式与完整结算统计

import { CHARACTERS } from '../data/characters.js';
import { getKitchenFlow, STATION_META } from '../data/kitchen_recipes.js';

const CUSTOMER_POOL = ['lillian', 'theo', 'bart', 'emily', 'casper', 'madeleine'];
const SHIFT_SECONDS = 45;

export function createKitchenEngine(page, {
  menuRecipes,
  bonuses,
  tutorialMode = false,
  practiceMode = false,
  onTutorialDone,
  onServeEffect,
  onShiftEnd
}) {
  let timer = null;
  let tick = 0;
  let ended = false;
  let inTutorial = !!(tutorialMode || practiceMode);
  const pauseReasons = new Set();
  let msgHoldTicks = 0;

  let lostCustomers = 0;
  let burntCount = 0;
  let discardedCount = 0;

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

  function flashMsg(msg, ticks = 18) {
    msgHoldTicks = ticks;
    page.setData({ serviceMsg: msg });
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function makeEmptyStation(id, type, name, shortName) {
    return {
      id,
      type,
      name,
      shortName,
      item: null,
      progress: 0,
      overcook: 0,
      nearBurn: false,
      state: 'idle' // 'idle' | 'working' | 'ready' | 'burnt'
    };
  }

  function computeHintAndHighlight(heldItem, stations, seats) {
    if (!heldItem) {
      const warnSt = stations.find(s => s.state === 'ready' && s.nearBurn);
      if (warnSt) {
        return { highlight: warnSt.id, hint: `🔥 【${warnSt.shortName}】快烤糊啦！快点击取出！` };
      }
      const readySt = stations.find(s => s.state === 'ready');
      if (readySt) {
        return { highlight: readySt.id, hint: `✨ 【${readySt.shortName}】可取餐！点击取出` };
      }
      const burntSt = stations.find(s => s.state === 'burnt');
      if (burntSt) {
        return { highlight: burntSt.id, hint: `💨 【${burntSt.shortName}】烤糊了！点击取出清理` };
      }
      return { highlight: 'pantry', hint: '点【大竹篮】智能取料，或点篮下甜点按钮指定取料！' };
    }
    if (heldItem.isBurnt) {
      return { highlight: 'trash', hint: '💥 烤糊了！点击右下角【回收铜桶】丢弃重做' };
    }
    if (heldItem.isFinished) {
      const matchingSeat = seats.find(s => s.occupied && s.wantedId === heldItem.recipeId);
      if (matchingSeat) {
        return { highlight: `seat_${matchingSeat.id}`, hint: `🍰 【${heldItem.recipeName}】成品！点击【${matchingSeat.name}】上菜！` };
      }
      return { highlight: 'hold', hint: `目前没人点【${heldItem.recipeName}】，先放左下【暂存台】备用！` };
    }
    const nextStationType = heldItem.steps[heldItem.stepIndex];
    const targetSt = stations.find(s => s.type === nextStationType && s.state === 'idle');
    const stName = (STATION_META[nextStationType] && STATION_META[nextStationType].name) || '操作台';
    const verb = (STATION_META[nextStationType] && STATION_META[nextStationType].verb) || '加工';
    const isSemi = heldItem.stepIndex > 0;
    return {
      highlight: targetSt ? targetSt.id : nextStationType,
      hint: isSemi
        ? `👉 【${heldItem.recipeName}】半成品 · 下一步：去【${stName}】${verb}！`
        : `👉 下一步：点击【${stName}】放入 ${heldItem.recipeName}！`
    };
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

  function countUndelivered(stations, heldItem, holdItem) {
    let n = 0;
    (stations || []).forEach(st => {
      if (st.item && !st.item.isBurnt) n += 1;
    });
    if (heldItem && !heldItem.isBurnt) n += 1;
    if (holdItem && !holdItem.isBurnt) n += 1;
    return n;
  }

  function finalizeShift() {
    if (ended) return;
    ended = true;
    stop();
    const undeliveredCount = countUndelivered(
      page.data.stations,
      page.data.heldItem,
      page.data.holdItem
    );
    if (typeof onShiftEnd === 'function') {
      onShiftEnd({
        earnedCoins: page.data.shiftCoins,
        earnedRep: page.data.shiftRep,
        servedCount: page.data.shiftServed,
        lostCustomers,
        burntCount,
        undeliveredCount,
        discardedCount,
        isPractice: practiceMode
      });
    }
  }

  function start() {
    stop();
    tick = 0;
    ended = false;
    lostCustomers = 0;
    burntCount = 0;
    discardedCount = 0;
    pauseReasons.clear();
    msgHoldTicks = 0;

    const stations = [
      makeEmptyStation('oven_1', 'oven', '红砖烤炉 1', '烤炉 1'),
      makeEmptyStation('oven_2', 'oven', '红砖烤炉 2', '烤炉 2'),
      makeEmptyStation('cream_1', 'cream', '奶油裱花台', '裱花台'),
      makeEmptyStation('decor_1', 'decor', '糖粉装饰台', '装饰台')
    ];

    let seats = [
      { id: 0, occupied: false },
      { id: 1, occupied: false },
      { id: 2, occupied: false }
    ];
    seats = spawnCustomerInto(seats);
    seats = spawnCustomerInto(seats);

    const guide = computeHintAndHighlight(null, stations, seats);

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
      stations,
      heldItem: null,
      holdItem: null,
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
    if (practiceMode) return;
    if (!inTutorial) return;
    inTutorial = false;
    page.setData({ inTutorial: false });
    if (typeof onTutorialDone === 'function') onTutorialDone();
  }

  function syncGuide(heldItem, stations, seats, customMsg) {
    const guide = computeHintAndHighlight(heldItem, stations, seats);
    if (customMsg) msgHoldTicks = 16;
    page.setData({
      heldItem,
      stations,
      seats,
      highlightTarget: guide.highlight,
      serviceMsg: customMsg || guide.hint
    });
  }

  function startLoop() {
    stop();
    const patienceDrain = 0.36 / (bonuses ? bonuses.patienceMult : 1);

    timer = setInterval(() => {
      if (ended || isPaused()) return;
      const frozenClock = inTutorial || practiceMode;
      if (!frozenClock) tick += 1;
      const timeLeft = Math.max(0, SHIFT_SECONDS - Math.floor(tick / 10));
      let customMsg = '';

      // 1. 推进所有厨房工位进度（教学/练习模式略微加速，零等待感）
      const speedMult = frozenClock ? 1.8 : 1;
      const stations = page.data.stations.map(st => {
        if (!st.item) return st;
        const meta = STATION_META[st.type];
        if (st.state === 'working') {
          const nextProg = Math.min(100, st.progress + (100 / meta.duration) * speedMult);
          if (nextProg >= 100) {
            const doneItem = Object.assign({}, st.item, {
              stepIndex: st.item.stepIndex + 1
            });
            doneItem.isFinished = doneItem.stepIndex >= doneItem.steps.length;
            doneItem.displayImg = doneItem.recipeIcon;
            doneItem.statusLabel = doneItem.isFinished ? '成品可上菜' : '半成品';
            return Object.assign({}, st, {
              item: doneItem,
              progress: 100,
              state: 'ready',
              overcook: 0,
              nearBurn: false
            });
          }
          return Object.assign({}, st, { progress: Math.round(nextProg) });
        }

        // 烤炉温和防焦机制（教学/练习期间绝不烤糊）
        if (st.state === 'ready' && st.type === 'oven' && !frozenClock) {
          const nextOver = st.overcook + 1;
          const warnTick = Math.floor(meta.burnTicks * 0.55);
          if (nextOver >= meta.burnTicks) {
            burntCount += 1;
            const burntItem = Object.assign({}, st.item, {
              isBurnt: true,
              isFinished: false,
              statusLabel: '烤糊了!'
            });
            customMsg = `💨 【${st.shortName}】烤糊冒烟啦！点击烤炉清理残渣`;
            return Object.assign({}, st, {
              item: burntItem,
              overcook: nextOver,
              nearBurn: false,
              state: 'burnt'
            });
          }
          const isNearBurn = nextOver >= warnTick;
          if (isNearBurn && !st.nearBurn) {
            customMsg = `🔥 【${st.shortName}】快烤糊啦！请立即点击取餐！`;
          }
          return Object.assign({}, st, { overcook: nextOver, nearBurn: isNearBurn });
        }
        return st;
      });

      // 2. 更新前厅 3 座位顾客耐心与新客到店（教学/练习期间耐心完全冻结）
      let seats = page.data.seats.map(s => {
        if (!s.occupied || frozenClock) return s;
        const nextP = s.patience - patienceDrain;
        if (nextP <= 0) {
          lostCustomers += 1;
          customMsg = `😅 ${s.name} 等太久离开座位了`;
          page.setData({ shiftCombo: 0 });
          return { id: s.id, occupied: false };
        }
        return Object.assign({}, s, { patience: nextP });
      });

      if (!frozenClock && seats.every(s => !s.occupied)) {
        seats = spawnCustomerInto(seats);
      } else if (!frozenClock && tick > 0 && tick % 35 === 0) {
        seats = spawnCustomerInto(seats);
      }

      const guide = computeHintAndHighlight(page.data.heldItem, stations, seats);
      if (customMsg) {
        msgHoldTicks = 16;
      } else if (msgHoldTicks > 0) {
        msgHoldTicks -= 1;
      }
      const nextMsg = customMsg || (msgHoldTicks > 0 ? page.data.serviceMsg : guide.hint);
      page.setData({
        shiftTimeLeft: timeLeft,
        stations,
        seats,
        highlightTarget: guide.highlight,
        serviceMsg: nextMsg
      });

      if (!frozenClock && timeLeft <= 0) {
        finalizeShift();
      }
    }, 100);
  }

  // 点击原料篮：拿取对应甜点的生面糊
  function pickRaw(recipeId) {
    if (ended || isPaused()) return;
    if (page.data.heldItem) {
      flashMsg('双手正端着东西呢！先放进工位、暂存台或上菜吧');
      return;
    }
    const recipe = menuRecipes.find(r => r.id === recipeId);
    if (!recipe) return;
    const flow = getKitchenFlow(recipe.id);
    const rawItem = {
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeIcon: recipe.iconImg,
      displayImg: 'assets/images/kitchen/prop_raw_bowl.png',
      steps: flow.steps,
      stepIndex: 0,
      isFinished: false,
      isBurnt: false,
      statusLabel: '生面糊'
    };
    syncGuide(rawItem, page.data.stations, page.data.seats);
  }

  // 点击厨房工位（烤炉 / 裱花台 / 装饰台）
  function tapStation(stationId) {
    if (ended || isPaused()) return;
    const stations = page.data.stations.slice();
    const idx = stations.findIndex(s => s.id === stationId);
    if (idx === -1) return;
    const st = stations[idx];
    const held = page.data.heldItem;

    // 情况 1：空手点击已完成或烤糊的工位 -> 取出物品
    if (!held && (st.state === 'ready' || st.state === 'burnt')) {
      const taken = st.item;
      stations[idx] = makeEmptyStation(st.id, st.type, st.name, st.shortName);
      syncGuide(taken, stations, page.data.seats);
      return;
    }

    // 情况 1.5：手里正拿着东西时点击【已完成】或【烤糊】的工位 -> 智能顺手换锅 / 自动暂存 / 清理残渣
    if (held && st.state === 'ready') {
      const taken = st.item;
      if (!held.isBurnt && !held.isFinished && held.steps[held.stepIndex] === st.type) {
        stations[idx] = Object.assign({}, st, {
          item: held,
          progress: 6,
          overcook: 0,
          nearBurn: false,
          state: 'working'
        });
        syncGuide(taken, stations, page.data.seats, `✨ 取出【${taken.recipeName}】，顺手放入【${held.recipeName}】加工！`);
        return;
      }
      if (!page.data.holdItem) {
        stations[idx] = makeEmptyStation(st.id, st.type, st.name, st.shortName);
        page.setData({ holdItem: held });
        syncGuide(taken, stations, page.data.seats, `✨ 已将【${held.recipeName}】暂放托盘，取出【${taken.recipeName}】！`);
        return;
      }
      flashMsg('双手和暂存台都满啦！先上菜或放进空闲工位再取餐哦！');
      return;
    }

    if (held && st.state === 'burnt') {
      stations[idx] = makeEmptyStation(st.id, st.type, st.name, st.shortName);
      syncGuide(held, stations, page.data.seats, `🗑️ 已清理【${st.shortName}】烤糊的残渣，空出工位啦！`);
      return;
    }

    // 情况 2：手里拿着物品点击空闲工位 -> 放入加工
    if (held && st.state === 'idle') {
      if (held.isBurnt) {
        flashMsg('烤糊的甜点不能再加工啦，丢进回收铜桶吧！');
        return;
      }
      if (held.isFinished) {
        flashMsg('这已经是成品啦！直接点击对应的顾客上菜吧！');
        return;
      }
      const neededType = held.steps[held.stepIndex];
      if (neededType !== st.type) {
        const rightName = (STATION_META[neededType] && STATION_META[neededType].name) || '正确工位';
        flashMsg(`这道工序需要先去【${rightName}】哦！`);
        return;
      }
      stations[idx] = Object.assign({}, st, {
        item: held,
        progress: 6,
        overcook: 0,
        nearBurn: false,
        state: 'working'
      });
      syncGuide(null, stations, page.data.seats, `🔥 正在【${st.shortName}】中加工 ${held.recipeName}…`);
      return;
    }

    if (st.state === 'working') {
      flashMsg(`⏳ 【${st.shortName}】正在制作中，稍等马上就好！`);
      return;
    }

    if (!held && st.state === 'idle') {
      flashMsg('双手空空！先点中间【大竹篮】或下方甜点按钮拿生面糊吧～');
    }
  }

  // 点击大理石暂存台：放下或取回/交换
  function tapHold() {
    if (ended || isPaused()) return;
    const { heldItem, holdItem } = page.data;
    if (heldItem && !holdItem) {
      page.setData({ holdItem: heldItem });
      syncGuide(null, page.data.stations, page.data.seats, `已暂存【${heldItem.recipeName}】，空出双手继续忙！`);
    } else if (!heldItem && holdItem) {
      page.setData({ holdItem: null });
      syncGuide(holdItem, page.data.stations, page.data.seats);
    } else if (heldItem && holdItem) {
      page.setData({ holdItem: heldItem });
      syncGuide(holdItem, page.data.stations, page.data.seats, '已与暂存台交换甜点！');
    } else {
      flashMsg('暂存台空着呢，手里端东西时点它可以临时腾出双手！');
    }
  }

  // 点击回收铜桶：丢弃手中物品
  function tapTrash() {
    if (ended || isPaused()) return;
    if (!page.data.heldItem) {
      flashMsg('手里空空，无需丢弃哦！');
      return;
    }
    discardedCount += 1;
    syncGuide(null, page.data.stations, page.data.seats, '🗑️ 已清理手中物品，重新开始制作！');
  }

  // 点击前厅顾客座位：上菜结账！
  function tapSeat(seatId) {
    if (ended || isPaused()) return;
    const seats = page.data.seats.slice();
    const seat = seats[seatId];
    const held = page.data.heldItem;

    if (!seat || !seat.occupied) return;
    if (!held) {
      flashMsg(`${seat.name} 正在等【${seat.wantedName}】，快去厨房做吧！`);
      return;
    }
    if (held.isBurnt) {
      flashMsg('烤糊的甜点不能端给客人哦！请丢进右下角回收铜桶！');
      return;
    }
    if (!held.isFinished) {
      const nextType = held.steps[held.stepIndex];
      const rightName = (STATION_META[nextType] && STATION_META[nextType].name) || '下一工位';
      flashMsg(`还没做完呢！下一步请先去【${rightName}】！`);
      return;
    }
    if (held.recipeId !== seat.wantedId) {
      flashMsg(`送错啦！${seat.name} 点的是【${seat.wantedName}】哦！`);
      return;
    }

    // 上菜大成功！
    const nextCombo = page.data.shiftCombo + 1;
    const speedTip = seat.patience >= 65 ? 12 : 0;
    const comboTip = nextCombo >= 2 ? nextCombo * 6 : 0;
    const upgradeTip = bonuses ? bonuses.tipBonus : 0;
    const earned = seat.price + speedTip + comboTip + upgradeTip;
    const rep = Math.round(10 * (bonuses ? bonuses.repMult : 1));

    seats[seatId] = { id: seatId, occupied: false };
    const refreshedSeats = spawnCustomerInto(seats);

    if (typeof onServeEffect === 'function') {
      onServeEffect({ seatId, earned, customerName: seat.name });
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
      page.data.stations,
      refreshedSeats,
      practiceMode
        ? `🎓 练习上菜成功！【${seat.wantedName}】交付给 ${seat.name}（可继续练或结束练习）`
        : `✨ ${seat.name} 超满意【${seat.wantedName}】！+${earned} 金币`
    );
  }

  return {
    start,
    stop,
    pause,
    resume,
    resumeAll,
    isPaused,
    finishShift: finalizeShift,
    skipTutorial,
    pickRaw,
    tapStation,
    tapHold,
    tapTrash,
    tapSeat
  };
}
