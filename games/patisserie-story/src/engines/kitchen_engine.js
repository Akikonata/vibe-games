// engines/kitchen_engine.js
// 轻度胡闹厨房（Overcooked-Lite）甜点屋营业模拟引擎
// 支持：3 座位同步来客、双烤炉/裱花台/装饰台/暂存台/回收桶、智能高亮下一步引导

import { CHARACTERS } from '../data/characters.js';
import { getKitchenFlow, STATION_META } from '../data/kitchen_recipes.js';

const CUSTOMER_POOL = ['lillian', 'theo', 'bart', 'emily', 'casper', 'madeleine'];
const SHIFT_SECONDS = 45;

function createKitchenEngine(page, { menuRecipes, bonuses, onShiftEnd }) {
  let timer = null;
  let tick = 0;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function makeEmptyStation(id, type, name) {
    return {
      id,
      type,
      name,
      item: null,
      progress: 0,
      overcook: 0,
      state: 'idle' // 'idle' | 'working' | 'ready' | 'burnt'
    };
  }

  function computeHintAndHighlight(heldItem, stations, seats) {
    if (!heldItem) {
      // 优先提示去取已经做好的炉子/台子
      const readySt = stations.find(s => s.state === 'ready');
      if (readySt) {
        return { highlight: readySt.id, hint: `✨ 【${readySt.name}】已完成！点击取出端盘` };
      }
      return { highlight: 'pantry', hint: '点击下方【原料篮】拿起客人想点的甜点面糊！' };
    }
    if (heldItem.isBurnt) {
      return { highlight: 'trash', hint: '💥 烤糊了！点击右下角【回收铜桶】丢弃重做' };
    }
    if (heldItem.isFinished) {
      const matchingSeat = seats.find(s => s.occupied && s.wantedId === heldItem.recipeId);
      if (matchingSeat) {
        return { highlight: `seat_${matchingSeat.id}`, hint: `🍰 做好啦！点击【${matchingSeat.name}】立即上菜！` };
      }
      return { highlight: 'hold', hint: '目前没人点这道甜点，可先放【暂存台】备用！' };
    }
    const nextStationType = heldItem.steps[heldItem.stepIndex];
    const targetSt = stations.find(s => s.type === nextStationType && s.state === 'idle');
    const stName = (STATION_META[nextStationType] && STATION_META[nextStationType].name) || '操作台';
    return {
      highlight: targetSt ? targetSt.id : nextStationType,
      hint: `👉 点击【${stName}】进行下一步加工！`
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
      portrait: `assets/images/portraits/${npcId}_normal.svg`,
      wantedId: wanted.id,
      wantedName: wanted.name,
      wantedIcon: wanted.iconImg,
      price: wanted.price,
      patience: 100
    };
    return nextSeats;
  }

  function start() {
    stop();
    tick = 0;

    const stations = [
      makeEmptyStation('oven_1', 'oven', '红砖烤炉 1'),
      makeEmptyStation('oven_2', 'oven', '红砖烤炉 2'),
      makeEmptyStation('cream_1', 'cream', '奶油裱花台'),
      makeEmptyStation('decor_1', 'decor', '糖粉装饰台')
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
      shiftTimeLeft: SHIFT_SECONDS,
      shiftCoins: 0,
      shiftRep: 0,
      shiftServed: 0,
      shiftCombo: 0,
      seats,
      stations,
      heldItem: null,
      holdItem: null,
      highlightTarget: guide.highlight,
      serviceMsg: guide.hint,
      daySummary: null
    }, () => {
      startLoop();
    });
  }

  function syncGuide(heldItem, stations, seats, customMsg) {
    const guide = computeHintAndHighlight(heldItem, stations, seats);
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
    const patienceDrain = 0.72 / (bonuses ? bonuses.patienceMult : 1);

    timer = setInterval(() => {
      tick += 1;
      const timeLeft = Math.max(0, SHIFT_SECONDS - Math.floor(tick / 10));
      let customMsg = '';

      // 1. 推进所有厨房工位进度
      const stations = page.data.stations.map(st => {
        if (!st.item) return st;
        const meta = STATION_META[st.type];
        if (st.state === 'working') {
          const nextProg = Math.min(100, st.progress + (100 / meta.duration));
          if (nextProg >= 100) {
            const doneItem = Object.assign({}, st.item, {
              stepIndex: st.item.stepIndex + 1
            });
            doneItem.isFinished = doneItem.stepIndex >= doneItem.steps.length;
            doneItem.displayImg = doneItem.isFinished ? doneItem.recipeIcon : 'assets/images/kitchen/raw_bowl.svg';
            doneItem.statusLabel = doneItem.isFinished ? '成品可上菜' : '半成品';
            return Object.assign({}, st, {
              item: doneItem,
              progress: 100,
              state: 'ready',
              overcook: 0
            });
          }
          return Object.assign({}, st, { progress: Math.round(nextProg) });
        }

        // 烤炉温和防焦机制（留足约 9 秒宽容时间，不劝退但有胡闹厨房紧张感）
        if (st.state === 'ready' && st.type === 'oven') {
          const nextOver = st.overcook + 1;
          if (nextOver >= meta.burnTicks) {
            const burntItem = Object.assign({}, st.item, {
              isBurnt: true,
              isFinished: false,
              statusLabel: '烤糊了!'
            });
            customMsg = `💨 【${st.name}】烤糊冒烟啦！取出丢进回收桶吧`;
            return Object.assign({}, st, {
              item: burntItem,
              overcook: nextOver,
              state: 'burnt'
            });
          }
          return Object.assign({}, st, { overcook: nextOver });
        }
        return st;
      });

      // 2. 更新前厅 3 座位顾客耐心与新客到店
      let seats = page.data.seats.map(s => {
        if (!s.occupied) return s;
        const nextP = s.patience - patienceDrain;
        if (nextP <= 0) {
          customMsg = `😅 ${s.name} 等太久离开座位了`;
          page.setData({ shiftCombo: 0 });
          return { id: s.id, occupied: false };
        }
        return Object.assign({}, s, { patience: Math.round(nextP) });
      });

      // 每 3.5 秒补位一位新顾客（保持前厅热闹）
      if (tick % 35 === 0) {
        seats = spawnCustomerInto(seats);
      }

      const guide = computeHintAndHighlight(page.data.heldItem, stations, seats);
      page.setData({
        shiftTimeLeft: timeLeft,
        stations,
        seats,
        highlightTarget: guide.highlight,
        serviceMsg: customMsg || guide.hint
      });

      if (timeLeft <= 0) {
        stop();
        onShiftEnd({
          earnedCoins: page.data.shiftCoins,
          earnedRep: page.data.shiftRep,
          servedCount: page.data.shiftServed
        });
      }
    }, 100);
  }

  // 点击原料篮：拿取对应甜点的生面糊
  function pickRaw(recipeId) {
    if (page.data.heldItem) {
      page.setData({ serviceMsg: '双手正端着东西呢！先放进工位、暂存台或上菜吧' });
      return;
    }
    const recipe = menuRecipes.find(r => r.id === recipeId);
    if (!recipe) return;
    const flow = getKitchenFlow(recipe.id);
    const rawItem = {
      recipeId: recipe.id,
      recipeName: recipe.name,
      recipeIcon: recipe.iconImg,
      displayImg: 'assets/images/kitchen/raw_bowl.svg',
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
    const stations = page.data.stations.slice();
    const idx = stations.findIndex(s => s.id === stationId);
    if (idx === -1) return;
    const st = stations[idx];
    const held = page.data.heldItem;

    // 情况 1：空手点击已完成或烤糊的工位 -> 取出物品
    if (!held && (st.state === 'ready' || st.state === 'burnt')) {
      const taken = st.item;
      stations[idx] = makeEmptyStation(st.id, st.type, st.name);
      syncGuide(taken, stations, page.data.seats);
      return;
    }

    // 情况 2：手里拿着物品点击空闲工位 -> 放入加工
    if (held && st.state === 'idle') {
      if (held.isBurnt) {
        page.setData({ serviceMsg: '烤糊的甜点不能再加工啦，丢进回收铜桶吧！' });
        return;
      }
      if (held.isFinished) {
        page.setData({ serviceMsg: '这已经是成品啦！直接点击对应的顾客上菜吧！' });
        return;
      }
      const neededType = held.steps[held.stepIndex];
      if (neededType !== st.type) {
        const rightName = (STATION_META[neededType] && STATION_META[neededType].name) || '正确工位';
        page.setData({ serviceMsg: `这道工序需要先去【${rightName}】哦！` });
        return;
      }
      stations[idx] = Object.assign({}, st, {
        item: held,
        progress: 6,
        overcook: 0,
        state: 'working'
      });
      syncGuide(null, stations, page.data.seats, `🔥 正在【${st.name}】中加工 ${held.recipeName}…`);
      return;
    }

    if (st.state === 'working') {
      page.setData({ serviceMsg: `⏳ 【${st.name}】正在制作中，稍等马上就好！` });
    }
  }

  // 点击大理石暂存台：放下或取回
  function tapHold() {
    const { heldItem, holdItem } = page.data;
    if (heldItem && !holdItem) {
      page.setData({ holdItem: heldItem });
      syncGuide(null, page.data.stations, page.data.seats, `已暂存【${heldItem.recipeName}】，空出双手继续忙！`);
    } else if (!heldItem && holdItem) {
      page.setData({ holdItem: null });
      syncGuide(holdItem, page.data.stations, page.data.seats);
    } else if (heldItem && holdItem) {
      // 交换手里的和暂存台上的
      page.setData({ holdItem: heldItem });
      syncGuide(holdItem, page.data.stations, page.data.seats, '已与暂存台交换甜点！');
    }
  }

  // 点击回收铜桶：丢弃手中物品
  function tapTrash() {
    if (!page.data.heldItem) return;
    syncGuide(null, page.data.stations, page.data.seats, '🗑️ 已清理手中物品，重新开始制作！');
  }

  // 点击前厅顾客座位：上菜结账！
  function tapSeat(seatId) {
    const seats = page.data.seats.slice();
    const seat = seats[seatId];
    const held = page.data.heldItem;

    if (!seat || !seat.occupied) return;
    if (!held) {
      page.setData({ serviceMsg: `${seat.name} 正在等【${seat.wantedName}】，快去厨房做吧！` });
      return;
    }
    if (!held.isFinished) {
      page.setData({ serviceMsg: '还没制作完成呢！请按亮灯提示完成最后一道工序！' });
      return;
    }
    if (held.recipeId !== seat.wantedId) {
      page.setData({ serviceMsg: `送错啦！${seat.name} 点的是【${seat.wantedName}】哦！` });
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
    // 马上安排下一位客人进店保持节奏
    const refreshedSeats = spawnCustomerInto(seats);

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
      `✨ ${seat.name} 超满意【${seat.wantedName}】！+${earned} 金币`
    );
  }

  return {
    start,
    stop,
    pickRaw,
    tapStation,
    tapHold,
    tapTrash,
    tapSeat
  };
}

export {
  createKitchenEngine
};
