// engines/catch_engine.js
// 左右移动接取食材 + 躲避烤焦杂质的街机收集引擎（防挂机动态落点 + 限时 + 漏接扣分）

import { evaluateByRatio } from './rank_evaluator.js';

const CATCH_CONFIGS = {
  orbit_match: {
    title: '果园马卡龙 · 接住鲜果蛋白壳',
    bgImg: 'assets/images/minigames/bg_catch_macaron.svg',
    catcherImg: 'assets/images/minigames/catcher_macaron_box.svg',
    goodItems: [
      { img: 'assets/images/minigames/sprite_mac_pink.svg', label: '树莓马卡龙', pts: 100 },
      { img: 'assets/images/minigames/sprite_mac_green.svg', label: '开心果马卡龙', pts: 100 },
      { img: 'assets/images/minigames/sprite_mac_lemon.svg', label: '柠檬马卡龙', pts: 100 }
    ],
    badItem: { img: 'assets/images/minigames/sprite_mac_burnt.svg', label: '烤裂壳', pts: -50 },
    targetGood: 8,
    timeLimit: 26
  },
  balance_scale: {
    title: '萨赫蛋糕 · 接住黑巧与杏子酱',
    bgImg: 'assets/images/minigames/bg_catch_sacher.svg',
    catcherImg: 'assets/images/minigames/catcher_sacher_stand.svg',
    goodItems: [
      { img: 'assets/images/minigames/sprite_sacher_choco.svg', label: '黑可可块', pts: 100 },
      { img: 'assets/images/minigames/sprite_sacher_apricot.svg', label: '新鲜杏子', pts: 100 }
    ],
    badItem: { img: 'assets/images/minigames/sprite_sacher_salt.svg', label: '粗盐块', pts: -50 },
    targetGood: 8,
    timeLimit: 26
  }
};

function pickAwayFrom(centerX, minGap) {
  const ranges = [];
  if (centerX - minGap >= 14) {
    ranges.push([14, centerX - minGap]);
  }
  if (centerX + minGap <= 86) {
    ranges.push([centerX + minGap, 86]);
  }
  if (ranges.length === 0) return centerX >= 50 ? 16 : 84;
  const chosen = ranges[Math.floor(Math.random() * ranges.length)];
  return Math.round(chosen[0] + Math.random() * (chosen[1] - chosen[0]));
}

function createCatchEngine(page, type, onComplete, onFail) {
  const cfg = CATCH_CONFIGS[type] || CATCH_CONFIGS.orbit_match;
  let timer = null;
  let tick = 0;
  let paused = false;
  let nextId = 1;
  let lastSpawnBasketX = 50;
  let idleSpawns = 0;
  let lastGoodX = 50;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    tick = 0;
    nextId = 1;
    lastSpawnBasketX = 50;
    idleSpawns = 0;
    lastGoodX = 50;

    page.setData({
      catchConfig: cfg,
      catchBasketX: 50,
      catchItems: [],
      catchScore: 0,
      catchCollected: 0,
      catchMissed: 0,
      catchTarget: cfg.targetGood,
      catchLives: 3,
      catchTimeLeft: cfg.timeLimit,
      catchTip: '主动左右移动接住优质食材，躲开坏料、尽量别漏接！',
      gameFailed: false
    }, () => {
      startLoop();
    });
  }

  function startLoop() {
    stop();
    timer = setInterval(() => {
      if (paused) return;
      tick += 1;
      const timeLeft = Math.max(0, cfg.timeLimit - Math.floor((tick * 45) / 1000));
      let items = (page.data.catchItems || []).map(it => Object.assign({}, it, { y: it.y + it.vy }));
      let { catchScore, catchCollected, catchMissed, catchLives, catchTip, catchBasketX } = page.data;

      // 每 16 帧（约 0.72 秒）生成一个下落食材
      if (tick % 16 === 1) {
        if (Math.abs(catchBasketX - lastSpawnBasketX) < 3) {
          idleSpawns += 1;
        } else {
          idleSpawns = 0;
          lastSpawnBasketX = catchBasketX;
        }

        // 挂机防白嫖：站着不动时，坏料概率上升且好料主动避开静止接盘
        const badChance = idleSpawns >= 2 ? 0.55 : 0.30;
        const isBad = Math.random() < badChance;
        const tpl = isBad
          ? cfg.badItem
          : cfg.goodItems[Math.floor(Math.random() * cfg.goodItems.length)];

        let spawnX;
        if (isBad) {
          if (idleSpawns >= 2) {
            spawnX = Math.max(14, Math.min(86, Math.round(catchBasketX + (Math.random() * 10 - 5))));
          } else {
            spawnX = 14 + Math.floor(Math.random() * 72);
          }
        } else {
          if (idleSpawns >= 1) {
            spawnX = pickAwayFrom(catchBasketX, 22);
          } else {
            spawnX = pickAwayFrom(lastGoodX, 16);
          }
          lastGoodX = spawnX;
        }

        items.push({
          id: nextId++,
          x: spawnX,
          y: 0,
          vy: 3.6 + Math.random() * 1.4,
          img: tpl.img,
          label: tpl.label,
          pts: tpl.pts,
          isBad
        });
      }

      const remaining = [];
      for (const it of items) {
        // 精准贴合视觉接盘宽度的判定区（半径 11%）
        if (it.y >= 77 && it.y <= 91 && Math.abs(it.x - catchBasketX) <= 11) {
          if (it.isBad) {
            catchLives = Math.max(0, catchLives - 1);
            catchScore = Math.max(0, catchScore + it.pts);
            catchTip = `💥 接到【${it.label}】！生命 -1`;
          } else {
            catchScore += it.pts;
            catchCollected += 1;
            catchTip = `✨ 接住【${it.label}】 +${it.pts}`;
          }
        } else if (it.y >= 96) {
          if (!it.isBad) {
            catchMissed += 1;
            catchScore = Math.max(0, catchScore - 20);
            catchTip = `💨 漏掉了一个【${it.label}】！-20 分`;
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
        stop();
        if (onFail) {
          onFail({
            title: '💥 混入太多瑕疵原料啦！',
            reason: '不小心接到了 3 次坏料，主动移动礼盒躲开它们再来一次吧！',
            score: catchScore
          });
        }
        return;
      }

      if (catchCollected >= cfg.targetGood || timeLeft <= 0) {
        stop();
        const minNeed = Math.ceil(cfg.targetGood * 0.5);
        const res = evaluateByRatio({
          score: catchScore,
          maxScore: cfg.targetGood * 100,
          perfectLives: catchLives === 3 && catchCollected >= cfg.targetGood,
          goodLives: catchLives >= 2 && catchCollected >= cfg.targetGood,
          passed: catchCollected >= minNeed,
          minPassRatio: 0.40
        });

        if (!res.passed) {
          if (onFail) {
            onFail({
              title: '⏱ 时间到，优质食材没集齐！',
              reason: `本轮只接住 ${catchCollected} / ${cfg.targetGood} 份优质食材（得分 ${res.score}），左右移动接盘再试一次吧！`,
              score: res.score
            });
          }
        } else {
          onComplete(res.rank, res.score);
        }
      }
    }, 45);
  }

  function moveBasket(delta) {
    idleSpawns = 0;
    const nextX = Math.max(14, Math.min(86, page.data.catchBasketX + delta));
    lastSpawnBasketX = nextX;
    page.setData({ catchBasketX: nextX });
  }

  function setBasketX(pct) {
    idleSpawns = 0;
    const nextX = Math.max(14, Math.min(86, pct));
    lastSpawnBasketX = nextX;
    page.setData({ catchBasketX: nextX });
  }

  return { start, stop, moveBasket, setBasketX, setPaused(v) { paused = !!v; } };
}

export {
  CATCH_CONFIGS,
  createCatchEngine
};
