// engines/multi_pan_engine.js
// 真实 3 锅/3 烤位同时时间管理厨房引擎（用于：main_2 翻转苹果塔 / main_4 巴斯克高温出炉）
// 参数按关卡独立配置；支持无惩罚两路教学练习 -> 显式重置后进入三路正式挑战

import { evaluateByRatio } from './rank_evaluator.js';

const MULTI_PAN_CONFIGS = {
  pan_flip: {
    title: '三口铜锅 · 焦糖苹果时间管理',
    unitName: '铜锅',
    actionVerb: '出锅',
    cookingLabel: '焦糖熬煮中',
    soonLabel: '🔥 即将出锅',
    readyLabel: '✨ 点我出锅!',
    perfectLabel: '🌟 琥珀焦糖!',
    warningLabel: '🛟 快糊了·抢救',
    cooldownLabel: '❄️ 清理冷却',
    bgImg: 'assets/images/minigames/bg_stovetop.svg',
    spritePrefix: 'pan_tatin',
    targetServings: 6,
    maxBurnt: 4,
    timeLimit: 34,
    tickMs: 85,
    heatRates: [1.26, 1.44, 1.62],
    randomSpread: 0.20,
    exactFloatHeat: true,
    startOffsets: [14, 34, 0],
    readyMin: 56,
    readyMax: 88,
    perfectRadius: 4.5,
    soonLead: 12,
    rescueScore: 35,
    rescueBurnsLife: false,
    burnPenaltyScore: 25,
    burnCooldownTicks: 22,
    tutorialTwoLanes: true
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

function getMultiPanRuleText(cfg) {
  const target = cfg.targetServings || 6;
  const maxScore = target * 100;
  const minNeed = Math.ceil(target * 0.5);
  const bMinScore = Math.ceil(maxScore * 0.40);
  const aMinScore = Math.ceil(maxScore * 0.72);
  const sMinScore = Math.ceil(maxScore * 0.90);
  const maxBurnt = cfg.maxBurnt || 4;
  return `规则：B级过关(≥${minNeed}份、≥${bMinScore}分且烧焦<${maxBurnt}) · A级(满${target}份、≥${aMinScore}分且烧焦≤1) · S级(满${target}份、≥${sMinScore}分且0烧焦)`;
}

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
  const bMinScore = Math.ceil(maxScore * 0.40);
  const aMinScore = Math.ceil(maxScore * 0.72);
  const sMinScore = Math.ceil(maxScore * 0.90);
  const downgradeReasons = [];

  if (res.passed && res.rank === 'B') {
    if (res.score < aMinScore) downgradeReasons.push(`得分 ${res.score}/${maxScore}（${ratioPct}%），未达 A 级 72%（${aMinScore} 分）`);
    if (served < target) downgradeReasons.push(`${cfg.actionVerb} ${served}/${target} 份，未满 A 级要求的 ${target} 份`);
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
    bMinScore,
    aMinScore,
    sMinScore,
    served,
    burnt,
    downgradeReasons,
    ruleText: getMultiPanRuleText(cfg)
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
  let practiceMode = false;
  let practiceServed = 0;
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
        label: '🔒 练习待解锁'
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
      state: 'cooking',
      spriteImg: `assets/images/minigames/${cfg.spritePrefix}_cooking.svg`,
      label: cfg.cookingLabel
    };
  }

  function start({ twoLaneTutorial = false } = {}) {
    stop();
    ticks = 0;
    ended = false;
    paused = false;
    practiceMode = !!(twoLaneTutorial && cfg.tutorialTwoLanes);
    practiceServed = 0;
    activeLaneCount = practiceMode ? 2 : 3;
    const offsets = cfg.startOffsets || [14, 34, 0];
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
      panPractice: practiceMode,
      panPracticeServed: 0,
      panTimeLeft: cfg.timeLimit,
      panTip: practiceMode
        ? `🎓 两${cfg.unitName}无惩罚练习（完成 2 份后重置计时正式开局！）`
        : `盯紧 3 个${cfg.unitName}！金区点击或按 1/2/3 ${cfg.actionVerb}，剩余容错 ${maxBurnt}/${maxBurnt}`,
      gameFailed: false
    }, () => {
      startLoop();
    });
  }

  function startFormalFromPractice() {
    start({ twoLaneTutorial: false });
  }

  function unlockThirdLane() {
    startFormalFromPractice();
  }

  function stepTick() {
    if (paused || ended) return;
    if (!practiceMode) ticks += 1;
    const timeLeft = practiceMode
      ? cfg.timeLimit
      : Math.max(0, cfg.timeLimit - Math.floor((ticks * tickMs) / 1000));
    let { panScore, panBurnt, panTip } = page.data;

    const pans = page.data.pans.map((p, idx) => {
      if (p.locked) return p;
      if (p.state === 'cooldown') {
        const nextCd = (p.cooldown || 1) - 1;
        if (nextCd <= 0) return makePan(p.id, 0);
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
        if (practiceMode) {
          panTip = `🎓 练习中不扣容错！${p.name}已重新升温，进入金区点它试试`;
          return makePan(p.id, 12);
        }
        panBurnt += 1;
        panScore = Math.max(0, panScore - (cfg.burnPenaltyScore || 25));
        const remain = Math.max(0, maxBurnt - panBurnt);
        panTip = `💥 ${p.name} 烧焦冒烟啦！-${cfg.burnPenaltyScore || 25} 分（剩余容错 ${remain}/${maxBurnt}）`;
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

    if (!practiceMode && panBurnt >= maxBurnt) {
      triggerFail({
        title: `💨 ${cfg.unitName}烧焦次数用尽！`,
        reason: `真正烧焦达到 ${maxBurnt} 次，容错已耗尽！「快糊了」时抢救不扣容错，进入金区按 1/2/3 即可${cfg.actionVerb}。`,
        score: panScore,
        ruleText: getMultiPanRuleText(cfg)
      });
      return;
    }

    if (!practiceMode && timeLeft <= 0) {
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

    if (practiceMode) {
      if (p.state === 'ready' || p.state === 'burnt') {
        practiceServed += 1;
        pans[idx] = makePan(p.id, 10);
        page.setData({
          pans,
          panPracticeServed: practiceServed,
          panTip: `🎓 练习完成 ${practiceServed}/2 份！${practiceServed >= 2 ? '即将重置计时进入三路正式挑战！' : '再出一份就正式开局！'}`
        });
        if (practiceServed >= 2) {
          startFormalFromPractice();
        }
      } else {
        page.setData({ panTip: `🎓 练习中：等 ${p.name} 进入金色区再点（不扣分）` });
      }
      return;
    }

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
      const add = cfg.rescueScore || 35;
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
        title: '💨 烧焦次数达到上限！',
        reason: `真正烧焦已达 ${maxBurnt} 次，等进入金色火候区再点${cfg.actionVerb}吧！`,
        score: panScore,
        ruleText: getMultiPanRuleText(cfg)
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
          title: `⏱ 时间到，${cfg.actionVerb}数量或得分不足！`,
          reason: `本轮${cfg.actionVerb} ${panServed}/${cfg.targetServings} 份（得分 ${summary.score}/${summary.maxScore}，过关需 ≥${summary.minNeed} 份且 ≥${summary.bMinScore} 分）。`,
          score: summary.score,
          ruleText: summary.ruleText,
          summary
        });
      }
    } else {
      onComplete(summary.rank, summary.score, {
        ...summary,
        rescued: panRescued,
        mode: 'multi_pan'
      });
    }
  }

  return {
    start,
    stop,
    tapPan,
    stepTick,
    unlockThirdLane,
    startFormalFromPractice,
    setPaused(v) { paused = !!v; },
    isPaused() { return paused; },
    isPractice() { return practiceMode; }
  };
}

export {
  MULTI_PAN_CONFIGS,
  getMultiPanRuleText,
  evaluateMultiPanRank,
  createMultiPanEngine
};
