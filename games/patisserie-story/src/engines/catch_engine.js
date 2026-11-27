// engines/catch_engine.js
// 左右移动接取优质食材 + 躲避瑕疵坏料的收集引擎
// 温和主线/支线平衡：取消静止定向追击与好料刻意避开，降低早期下落速度，限制连续坏料与不可规避重叠，明确最低过关份数与满额规则

import { evaluateByRatio } from './rank_evaluator.js';

const CATCH_CONFIGS = {
  orbit_match: {
    title: '果园马卡龙 · 鲜果接盘收集',
    bgImg: 'assets/images/minigames/bg_catch_macaron.svg',
    catcherImg: 'assets/images/minigames/catcher_macaron_box.svg',
    goodItems: [
      { img: 'assets/images/minigames/sprite_mac_pink.svg', label: '树莓马卡龙', pts: 100 },
      { img: 'assets/images/minigames/sprite_mac_green.svg', label: '开心果马卡龙', pts: 100 },
      { img: 'assets/images/minigames/sprite_mac_lemon.svg', label: '柠檬马卡龙', pts: 100 }
    ],
    badItem: { img: 'assets/images/minigames/sprite_mac_burnt.svg', label: '烤裂壳', pts: -40 },
    targetGood: 8,
    minPassGood: 4,
    timeLimit: 28,
    tickMs: 45,
    spawnInterval: 20, // ~0.90s
    baseVy: 2.1,       // 46.7..62.2 u/s (~1.25~1.65s fall to catch zone)
    vySpread: 0.7,
    badChance: 0.25,
    maxConsecBad: 1,
    catchRadius: 12
  },
  balance_scale: {
    title: '萨赫蛋糕 · 黑巧杏子严选收集',
    bgImg: 'assets/images/minigames/bg_catch_sacher.svg',
    catcherImg: 'assets/images/minigames/catcher_sacher_stand.svg',
    goodItems: [
      { img: 'assets/images/minigames/sprite_sacher_choco.svg', label: '黑可可块', pts: 100 },
      { img: 'assets/images/minigames/sprite_sacher_apricot.svg', label: '新鲜杏子', pts: 100 }
    ],
    badItem: { img: 'assets/images/minigames/sprite_sacher_salt.svg', label: '粗盐块', pts: -40 },
    targetGood: 8,
    minPassGood: 4,
    timeLimit: 28,
    tickMs: 45,
    spawnInterval: 19, // ~0.85s
    baseVy: 2.25,      // 50.0..65.6 u/s (~1.18~1.54s fall)
    vySpread: 0.7,
    badChance: 0.27,
    maxConsecBad: 1,
    catchRadius: 12
  }
};

function getCatchRuleText() {
  return '小贴士：多多接住优质食材、避开瑕疵坏料，满额无伤可获 S 级！';
}

function evaluateCatchRank({ score, collected, lives, missed, cfg }) {
  const target = cfg.targetGood;
  const minNeed = cfg.minPassGood || Math.ceil(target * 0.5);
  const maxScore = target * 100;
  const res = evaluateByRatio({
    score,
    maxScore,
    perfectLives: lives === 3 && collected >= target,
    goodLives: lives >= 2 && collected >= target,
    passed: collected >= minNeed && lives > 0,
    minPassRatio: 0.40
  });
  const ratioPct = Math.round(res.ratio * 100);
  const bMinScore = Math.ceil(maxScore * 0.40);
  const aMinScore = Math.ceil(maxScore * 0.72);
  const sMinScore = Math.ceil(maxScore * 0.90);
  const downgradeReasons = [];
  if (res.passed && res.rank === 'B') {
    if (res.score < aMinScore) downgradeReasons.push('再多拿一点分数就能升到 A 级');
    if (collected < target) downgradeReasons.push(`收满 ${target} 份优质食材就能冲击 A 级`);
    if (lives < 2) downgradeReasons.push('注意避开坏料，保留更多红心可获更高评级');
  } else if (res.passed && res.rank === 'A') {
    if (res.score < sMinScore) downgradeReasons.push('得分再高一点就能达成 S 级');
    if (lives < 3) downgradeReasons.push('无伤满心通关即可解锁 S 级评价');
  }
  return {
    ...res,
    maxScore,
    ratioPct,
    target,
    minNeed,
    collected,
    lives,
    missed,
    bMinScore,
    aMinScore,
    sMinScore,
    downgradeReasons,
    ruleText: getCatchRuleText(cfg)
  };
}

function createCatchEngine(page, type, onComplete, onFail, opts = {}) {
  const cfg = CATCH_CONFIGS[type] || CATCH_CONFIGS.orbit_match;
  const randomFn = typeof opts.randomFn === 'function' ? opts.randomFn : Math.random;
  const tickMs = cfg.tickMs || 45;

  let timer = null;
  let tick = 0;
  let paused = false;
  let ended = false;
  let nextId = 1;
  let consecBad = 0;
  let lastSpawnX = 50;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    tick = 0;
    ended = false;
    paused = false;
    nextId = 1;
    consecBad = 0;
    lastSpawnX = 50;

    page.setData({
      catchConfig: cfg,
      catchBasketX: 50,
      catchItems: [],
      catchScore: 0,
      catchCollected: 0,
      catchMissed: 0,
      catchTarget: cfg.targetGood,
      catchMinPass: cfg.minPassGood || 4,
      catchLives: 3,
      catchTimeLeft: cfg.timeLimit,
      catchTip: `拖动或按 ←/→ 接住优质食材，躲开【${cfg.badItem.label}】！`,
      gameFailed: false
    }, () => {
      startLoop();
    });
  }

  function pickFairSpawnX(isBad, activeItems) {
    // 温和公平落点：不追击静止玩家，避免与顶部刚刷出的食材重叠成不可规避陷阱
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = Math.round(16 + randomFn() * 68);
      const tooCloseToTop = activeItems.some(it => it.y < 36 && Math.abs(it.x - candidate) < (isBad !== it.isBad ? 24 : 16));
      const tooCloseToLast = Math.abs(candidate - lastSpawnX) < 12;
      if (!tooCloseToTop && !tooCloseToLast) {
        lastSpawnX = candidate;
        return candidate;
      }
    }
    const fallback = lastSpawnX >= 50 ? 24 : 76;
    lastSpawnX = fallback;
    return fallback;
  }

  function triggerFail(info) {
    if (ended) return;
    ended = true;
    stop();
    if (onFail) onFail(info);
  }

  function settle() {
    if (ended) return;
    ended = true;
    stop();
    const { catchScore, catchCollected, catchLives, catchMissed } = page.data;
    const summary = evaluateCatchRank({
      score: catchScore,
      collected: catchCollected,
      lives: catchLives,
      missed: catchMissed,
      cfg
    });
    if (!summary.passed) {
      if (onFail) {
        onFail({
          title: '⏱ 时间到，优质食材未达过关线！',
          reason: `本轮收集了 ${catchCollected}/${cfg.targetGood} 份食材，再接多一点就能过关啦！`,
          score: summary.score,
          ruleText: summary.ruleText,
          summary
        });
      }
    } else {
      onComplete(summary.rank, summary.score, {
        ...summary,
        mode: 'catch'
      });
    }
  }

  function stepTick() {
    if (paused || ended) return;
    tick += 1;
    const timeLeft = Math.max(0, cfg.timeLimit - Math.floor((tick * tickMs) / 1000));
    let items = (page.data.catchItems || []).map(it => Object.assign({}, it, { y: it.y + it.vy }));
    let { catchScore, catchCollected, catchMissed, catchLives, catchTip, catchBasketX } = page.data;

    if (tick % cfg.spawnInterval === 1) {
      // 前 2 个必为好料让玩家建立节奏，且限制连续坏料不超过 maxConsecBad
      const allowBad = tick > cfg.spawnInterval * 2 && consecBad < cfg.maxConsecBad;
      const isBad = allowBad && randomFn() < cfg.badChance;
      consecBad = isBad ? consecBad + 1 : 0;

      const tpl = isBad
        ? cfg.badItem
        : cfg.goodItems[Math.floor(randomFn() * cfg.goodItems.length)];
      const spawnX = pickFairSpawnX(isBad, items);

      items.push({
        id: nextId++,
        x: spawnX,
        y: 0,
        vy: cfg.baseVy + randomFn() * cfg.vySpread,
        img: tpl.img,
        label: tpl.label,
        pts: tpl.pts,
        isBad
      });
    }

    const remaining = [];
    for (const it of items) {
      if (it.y >= 76 && it.y <= 92 && Math.abs(it.x - catchBasketX) <= cfg.catchRadius) {
        if (it.isBad) {
          catchLives = Math.max(0, catchLives - 1);
          catchScore = Math.max(0, catchScore + it.pts);
          catchTip = `💥 接到【${it.label}】！剩余生命 ${catchLives}/3 心`;
        } else {
          catchScore += it.pts;
          catchCollected += 1;
          catchTip = `✨ 接住【${it.label}】 +${it.pts}（${catchCollected}/${cfg.targetGood}）`;
        }
      } else if (it.y >= 96) {
        if (!it.isBad) {
          catchMissed += 1;
          catchScore = Math.max(0, catchScore - 15);
          catchTip = `💨 漏掉了一个【${it.label}】！-15 分`;
        }
      } else {
        remaining.push(it);
      }
    }

    page.setData({
      catchItems: remaining,
      catchScore,
      catchCollected,
      catchMissed,
      catchLives,
      catchTimeLeft: timeLeft,
      catchTip
    });

    if (catchLives <= 0) {
      triggerFail({
        title: '💥 混入 3 次瑕疵坏料啦！',
        reason: `接到了 3 次【${cfg.badItem.label}】，注意左右避开坏料再来一轮吧！`,
        score: catchScore,
        ruleText: getCatchRuleText(cfg)
      });
      return;
    }

    if (catchCollected >= cfg.targetGood || timeLeft <= 0) {
      settle();
    }
  }

  function startLoop() {
    stop();
    timer = setInterval(stepTick, tickMs);
  }

  function moveBasket(delta) {
    if (paused || ended) return;
    const nextX = Math.max(14, Math.min(86, page.data.catchBasketX + delta));
    page.setData({ catchBasketX: nextX });
  }

  function setBasketX(pct) {
    if (paused || ended) return;
    const nextX = Math.max(14, Math.min(86, pct));
    page.setData({ catchBasketX: nextX });
  }

  return {
    start,
    stop,
    stepTick,
    moveBasket,
    setBasketX,
    setPaused(v) { paused = !!v; },
    isPaused() { return paused; }
  };
}

export {
  CATCH_CONFIGS,
  getCatchRuleText,
  evaluateCatchRank,
  createCatchEngine
};
