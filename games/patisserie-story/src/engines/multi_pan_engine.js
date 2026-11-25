// engines/multi_pan_engine.js
// 真实 3 锅/3 烤位同时时间管理厨房引擎（用于：main_2 翻转苹果塔 / main_4 巴斯克高温出炉）
// 参数按关卡配置完全隔离：pan_flip 保持既有节奏，whisk_dash 使用独立调优参数与抢救/冷却/两烤位教学机制

import { evaluateByRatio } from './rank_evaluator.js';

const MULTI_PAN_CONFIGS = {
  pan_flip: {
    title: '三口铜锅 · 焦糖苹果时间管理',
    unitName: '铜锅',
    actionVerb: '出锅',
    cookingLabel: '熬煮升温中',
    soonLabel: '🔥 即将出锅',
    readyLabel: '✨ 点我出锅!',
    perfectLabel: '✨ 点我出锅!',
    warningLabel: '⚠️ 快糊了!',
    cooldownLabel: '清理中',
    bgImg: 'assets/images/minigames/bg_stovetop.svg',
    spritePrefix: 'pan_tatin',
    targetServings: 6,
    maxBurnt: 4,
    timeLimit: 32,
    tickMs: 85,
    heatRates: [2.2, 2.7, 3.1],
    randomSpread: 0.6,
    exactFloatHeat: false,
    startOffsets: [8, 34, 18],
    readyMin: 62,
    readyMax: 86,
    perfectRadius: 6,
    soonLead: 0,
    rescueScore: 25,
    rescueBurnsLife: true,
    burnPenaltyScore: 30,
    burnCooldownTicks: 0,
    tutorialTwoLanes: false
  },
  whisk_dash: {
    title: '230°C 三烤位 · 巴斯克高温出炉',
    unitName: '烤位',
    actionVerb: '出炉',
    cookingLabel: '高温烘烤中',
    soonLabel: '🔥 即将出炉',
    readyLabel: '✨ 点击出炉!',
    perfectLabel: '🌟 完美流心!',
    warningLabel: '🛟 快糊了·抢救',
    cooldownLabel: '❄️ 冷却清理',
    bgImg: 'assets/images/minigames/bg_basque_oven.svg',
    spritePrefix: 'pan_basque',
    targetServings: 6,
    maxBurnt: 4,
    timeLimit: 34,
    tickMs: 85,
    heatRates: [1.30, 1.48, 1.66],
    randomSpread: 0.20,
    exactFloatHeat: true,
    startOffsets: [16, 36, 0],
    readyMin: 56,
    readyMax: 88,
    perfectRadius: 4.5,
    soonLead: 12,
    rescueScore: 35,
    rescueBurnsLife: false,
    burnPenaltyScore: 25,
    burnCooldownTicks: 22,
    tutorialTwoLanes: true
  }
};

function evaluateMultiPanRank({ score, served, burnt, cfg }) {
  const target = cfg.targetServings;
  const maxScore = target * 100;
  const maxBurnt = cfg.maxBurnt || 4;
  const minNeed = Math.ceil(target * 0.5);
  const res = evaluateByRatio({
    score,
    maxScore,
    perfectLives: burnt === 0 && served >= target,
    goodLives: burnt <= 1 && served >= target,
    passed: served >= minNeed && burnt < maxBurnt,
    minPassRatio: 0.40
  });

  const ratioPct = Math.round(res.ratio * 100);
  const aMinScore = Math.ceil(maxScore * 0.72);
  const sMinScore = Math.ceil(maxScore * 0.90);
  const downgradeReasons = [];

  if (res.passed && res.rank === 'B') {
    if (res.score < aMinScore) downgradeReasons.push(`得分 ${res.score}/${maxScore}（${ratioPct}%），未达 A 级 72%（${aMinScore} 分）`);
    if (served < target) downgradeReasons.push(`出炉 ${served}/${target} 份，未满 A 级要求的 ${target} 份`);
    if (burnt > 1) downgradeReasons.push(`烧焦 ${burnt} 次，超过 A 级允许的 ≤ 1 次`);
  } else if (res.passed && res.rank === 'A') {
    if (res.score < sMinScore) downgradeReasons.push(`得分 ${res.score}/${maxScore}（${ratioPct}%），距 S 级 90%（${sMinScore} 分）差 ${sMinScore - res.score} 分`);
    if (burnt > 0) downgradeReasons.push(`烧焦 ${burnt} 次，S 级要求 0 次烧焦`);
  }

  return {
    ...res,
    maxScore,
    ratioPct,
    target,
    minNeed,
    maxBurnt,
    aMinScore,
    sMinScore,
    served,
    burnt,
    downgradeReasons
  };
}

function createMultiPanEngine(page, type, onComplete, onFail, opts = {}) {
  const cfg = MULTI_PAN_CONFIGS[type] || MULTI_PAN_CONFIGS.pan_flip;
  const randomFn = typeof opts.randomFn === 'function' ? opts.randomFn : Math.random;
  const tickMs = cfg.tickMs || 85;
  const maxBurnt = cfg.maxBurnt || 4;
  const readyCenter = (cfg.readyMin + cfg.readyMax) / 2;

  let timer = null;
  let ticks = 0;
  let paused = false;
  let ended = false;
  let activeLaneCount = 3;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function makePan(id, offset, { locked = false, cooldown = 0 } = {}) {
    if (locked) {
      return {
        id,
        name: `${cfg.unitName} #${id + 1}`,
        heat: 0,
        cooldown: 0,
        locked: true,
        isPerfect: false,
        state: 'locked',
        spriteImg: `assets/images/minigames/${cfg.spritePrefix}_cooking.svg`,
        label: '🔒 教学待解锁'
      };
    }
    if (cooldown > 0) {
      return {
        id,
        name: `${cfg.unitName} #${id + 1}`,
        heat: 0,
        cooldown,
        locked: false,
        isPerfect: false,
        state: 'cooldown',
        spriteImg: `assets/images/minigames/${cfg.spritePrefix}_burnt.svg`,
        label: cfg.cooldownLabel
      };
    }
    return {
      id,
      name: `${cfg.unitName} #${id + 1}`,
      heat: offset,
      cooldown: 0,
      locked: false,
      isPerfect: false,
      state: 'cooking', // 'cooking' | 'soon' | 'ready' | 'burnt' | 'cooldown' | 'locked'
      spriteImg: `assets/images/minigames/${cfg.spritePrefix}_cooking.svg`,
      label: cfg.cookingLabel
    };
  }

  function start({ twoLaneTutorial = false } = {}) {
    stop();
    ticks = 0;
    ended = false;
    activeLaneCount = twoLaneTutorial && cfg.tutorialTwoLanes ? 2 : 3;
    const offsets = cfg.startOffsets || [8, 34, 18];
    const pans = [
      makePan(0, offsets[0]),
      makePan(1, offsets[1]),
      makePan(2, offsets[2], { locked: activeLaneCount < 3 })
    ];
    page.setData({
      panConfig: cfg,
      pans,
      panScore: 0,
      panServed: 0,
      panBurnt: 0,
      panRescued: 0,
      panMaxBurnt: maxBurnt,
      panActiveLanes: activeLaneCount,
      panTimeLeft: cfg.timeLimit,
      panTip: type === 'whisk_dash'
        ? `盯紧烤位！金色区点击或按 1/2/3 出炉，中心流心 +100，剩余容错 ${maxBurnt}/${maxBurnt}`
        : `盯紧 3 口锅！进入金色火候区立刻点击翻面，烤糊 ${maxBurnt} 次会失败哦！`,
      gameFailed: false
    }, () => {
      startLoop();
    });
  }

  function unlockThirdLane() {
    if (activeLaneCount >= 3) return;
    activeLaneCount = 3;
    const pans = (page.data.pans || []).map(p => (p.id === 2 ? makePan(2, 6) : p));
    page.setData({
      pans,
      panActiveLanes: 3,
      panTip: `🔥 烤位 #3 已解锁！三烤位齐开，按 1 / 2 / 3 快速出炉！`
    });
  }

  function stepTick() {
    if (paused || ended) return;
    ticks += 1;
    const timeLeft = Math.max(0, cfg.timeLimit - Math.floor((ticks * tickMs) / 1000));
    let { panScore, panBurnt, panTip } = page.data;

    const pans = page.data.pans.map((p, idx) => {
      if (p.locked) return p;
      if (p.state === 'cooldown') {
        const nextCd = (p.cooldown || 1) - 1;
        if (nextCd <= 0) {
          return makePan(p.id, 0);
        }
        return Object.assign({}, p, { cooldown: nextCd });
      }

      const rate = cfg.heatRates[idx] + (randomFn() * cfg.randomSpread);
      const nextHeatRaw = p.heat + rate;
      const nextHeat = cfg.exactFloatHeat ? nextHeatRaw : Math.round(nextHeatRaw);
      let state = 'cooking';
      let label = cfg.cookingLabel;
      let isPerfect = false;
      let spriteState = 'cooking';

      if (nextHeatRaw >= 100) {
        panBurnt += 1;
        panScore = Math.max(0, panScore - (cfg.burnPenaltyScore || 30));
        const remain = Math.max(0, maxBurnt - panBurnt);
        panTip = `💥 ${p.name} 烧焦冒烟啦！-${cfg.burnPenaltyScore || 30} 分（剩余容错 ${remain}/${maxBurnt}）`;
        if (cfg.burnCooldownTicks > 0) {
          return makePan(p.id, 0, { cooldown: cfg.burnCooldownTicks });
        }
        return makePan(p.id, 6);
      } else if (nextHeatRaw >= cfg.readyMin && nextHeatRaw <= cfg.readyMax) {
        state = 'ready';
        spriteState = 'ready';
        isPerfect = Math.abs(nextHeatRaw - readyCenter) <= cfg.perfectRadius;
        label = isPerfect ? cfg.perfectLabel : cfg.readyLabel;
      } else if (nextHeatRaw > cfg.readyMax) {
        state = 'burnt';
        spriteState = 'burnt';
        label = cfg.warningLabel;
      } else if (cfg.soonLead > 0 && nextHeatRaw >= cfg.readyMin - cfg.soonLead) {
        state = 'soon';
        spriteState = 'cooking';
        label = cfg.soonLabel;
      }

      return Object.assign({}, p, {
        heat: nextHeat,
        state,
        isPerfect,
        spriteImg: `assets/images/minigames/${cfg.spritePrefix}_${spriteState}.svg`,
        label
      });
    });

    page.setData({ pans, panScore, panBurnt, panTimeLeft: timeLeft, panTip });

    if (panBurnt >= maxBurnt) {
      triggerFail({
        title: type === 'whisk_dash' ? '💨 巴斯克烤焦次数用尽！' : '💨 厨房浓烟滚滚！',
        reason: `真正烧焦达到 ${maxBurnt} 次，容错已耗尽！提示：「快糊了」时点出炉抢救不扣容错，进入金区按 1/2/3 即可出炉。`,
        score: panScore
      });
      return;
    }

    if (timeLeft <= 0) {
      finish();
    }
  }

  function startLoop() {
    stop();
    timer = setInterval(stepTick, tickMs);
  }

  function triggerFail(info) {
    if (ended) return;
    ended = true;
    stop();
    if (onFail) onFail(info);
  }

  function tapPan(panId) {
    if (page.data.gameFailed || paused || ended) return;
    const pans = page.data.pans.slice();
    const idx = pans.findIndex(p => p.id === panId);
    if (idx === -1) return;
    const p = pans[idx];

    if (p.locked || p.state === 'cooldown') return;

    let { panScore, panServed, panBurnt, panRescued = 0, panTip } = page.data;

    if (p.state === 'ready') {
      const centerDist = Math.abs(p.heat - readyCenter);
      const isPerfect = centerDist <= cfg.perfectRadius;
      const add = isPerfect ? 100 : 75;
      panScore += add;
      panServed += 1;
      panTip = isPerfect
        ? `🌟 ${p.name} 完美${cfg.actionVerb}！+${add}`
        : `👍 ${p.name} 顺利${cfg.actionVerb} +${add}`;
      pans[idx] = makePan(p.id, 4);
    } else if (p.state === 'burnt') {
      const add = cfg.rescueScore || 25;
      panScore += add;
      panServed += 1;
      panRescued += 1;
      if (cfg.rescueBurnsLife) {
        panBurnt += 1;
        panTip = `😅 ${p.name} 烤过头焦了点，勉强救回 +${add}（焦糊 ${panBurnt}/${maxBurnt}）`;
      } else {
        panTip = `🛟 ${p.name} 极限抢救${cfg.actionVerb} +${add}（仅降品质，未扣容错）`;
      }
      pans[idx] = makePan(p.id, 4);
    } else {
      panScore = Math.max(0, panScore - 10);
      panTip = `⏳ ${p.name} 火候还不够，等进入金色区再${cfg.actionVerb}（-10 分）`;
    }

    page.setData({ pans, panScore, panServed, panBurnt, panRescued, panTip });

    if (panBurnt >= maxBurnt) {
      triggerFail({
        title: '💨 烤糊次数达到上限！',
        reason: `有 ${maxBurnt} 份都烤焦了，等进入金色火候区再点${cfg.actionVerb}吧！`,
        score: panScore
      });
      return;
    }

    if (panServed >= cfg.targetServings) {
      finish();
    }
  }

  function finish() {
    if (ended) return;
    ended = true;
    stop();
    const { panScore, panServed, panBurnt, panRescued = 0 } = page.data;
    const summary = evaluateMultiPanRank({
      score: panScore,
      served: panServed,
      burnt: panBurnt,
      cfg
    });

    if (!summary.passed) {
      if (onFail) {
        onFail({
          title: `⏱ 时间到，${cfg.actionVerb}数量不足！`,
          reason: `本轮${cfg.actionVerb} ${panServed}/${cfg.targetServings} 份（得分 ${summary.score}/${summary.maxScore}，需 ≥${summary.minNeed} 份且 ≥240 分过关），看准金色区再来一次！`,
          score: summary.score,
          summary
        });
      }
    } else {
      onComplete(summary.rank, summary.score, { ...summary, rescued: panRescued });
    }
  }

  return {
    start,
    stop,
    tapPan,
    stepTick,
    unlockThirdLane,
    setPaused(v) { paused = !!v; },
    isPaused() { return paused; }
  };
}

export {
  MULTI_PAN_CONFIGS,
  evaluateMultiPanRank,
  createMultiPanEngine
};
