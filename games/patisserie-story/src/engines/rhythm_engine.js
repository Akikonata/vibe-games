// engines/rhythm_engine.js
// 真实 3 轨音游节拍引擎（用于：side_2 波尔多可露丽节拍刷蜡 / side_4 蒙布朗三轨节拍裱花）
// 支持：3-2-1 准备倒数、490~520ms 友好普通判定 + 严完美子区、早/晚反馈、慢速动态练习与完整评级诊断

import { evaluateByRatio } from './rank_evaluator.js';

const RHYTHM_CONFIGS = {
  rhythm_bake: {
    title: '节拍刷蜂蜡 · 波尔多铜模',
    laneLabels: ['左铜模', '中铜模', '右铜模'],
    bgImg: 'assets/images/minigames/bg_rhythm_wax.svg',
    targetImg: 'assets/images/minigames/target_copper_mold.svg',
    noteImg: 'assets/images/minigames/note_wax.svg',
    totalNotes: 9,
    tickMs: 36,
    speed: 2.35,         // 65.3 u/s -> normal ±17 = 521ms, perfect ±6.5 = 199ms
    practiceSpeed: 1.65, // 45.8 u/s slow dynamic practice
    spawnInterval: 34,   // ~1.22s spacing
    targetY: 76,
    normalRadius: 17,
    perfectRadius: 6.5,
    emptyTapPenalty: 10
  },
  spiral_draw: {
    title: '三轨节拍裱花 · 蒙布朗',
    laneLabels: ['外圈丝带', '中圈山脊', '雪顶收尾'],
    bgImg: 'assets/images/minigames/bg_rhythm_montblanc.svg',
    targetImg: 'assets/images/minigames/target_porcelain_ring.svg',
    noteImg: 'assets/images/minigames/note_chestnut.svg',
    totalNotes: 10,
    tickMs: 36,
    speed: 2.50,         // 69.4 u/s -> normal ±17 = 490ms, perfect ±6.5 = 187ms
    practiceSpeed: 1.75,
    spawnInterval: 32,   // ~1.15s spacing
    targetY: 76,
    normalRadius: 17,
    perfectRadius: 6.5,
    emptyTapPenalty: 10
  }
};

function getRhythmRuleText() {
  return '小贴士：踩准底部圆圈节拍，高连击、少漏拍即可冲刺 A / S 级！';
}

function evaluateRhythmRank({ score, hits, misses, cfg }) {
  const total = cfg.totalNotes;
  const maxScore = total * 100;
  const minHits = Math.ceil(total * 0.5);
  const res = evaluateByRatio({
    score,
    maxScore,
    perfectLives: misses === 0,
    goodLives: misses <= 2,
    passed: hits >= minHits,
    minPassRatio: 0.42
  });
  const ratioPct = Math.round(res.ratio * 100);
  const bMinScore = Math.ceil(maxScore * 0.42);
  const aMinScore = Math.ceil(maxScore * 0.72);
  const sMinScore = Math.ceil(maxScore * 0.90);
  const downgradeReasons = [];
  if (res.passed && res.rank === 'B') {
    if (res.score < aMinScore) downgradeReasons.push('精准命中更多节拍即可升到 A 级');
    if (misses > 2) downgradeReasons.push(`漏拍 ${misses} 次，减少漏拍可获更高评级`);
  } else if (res.passed && res.rank === 'A') {
    if (res.score < sMinScore) downgradeReasons.push('节拍精准度再高一点就能达成 S 级');
    if (misses > 0) downgradeReasons.push('零漏拍通关即可解锁 S 级评价');
  }
  return {
    ...res,
    maxScore,
    ratioPct,
    target: total,
    minHits,
    hits,
    misses,
    bMinScore,
    aMinScore,
    sMinScore,
    downgradeReasons,
    ruleText: getRhythmRuleText(cfg)
  };
}

function createRhythmEngine(page, type, onComplete, onFail, opts = {}) {
  const cfg = RHYTHM_CONFIGS[type] || RHYTHM_CONFIGS.rhythm_bake;
  const randomFn = typeof opts.randomFn === 'function' ? opts.randomFn : Math.random;
  const tickMs = cfg.tickMs || 36;
  const totalNotes = opts.totalNotesOverride || cfg.totalNotes;
  const effectiveCfg = { ...cfg, totalNotes };

  let timer = null;
  let tick = 0;
  let paused = false;
  let ended = false;
  let practiceMode = false;
  let practiceHits = 0;
  let countdownTicks = 0;
  let nextNoteId = 1;
  let spawned = 0;
  let lastLane = -1;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start({ practice = false, skipCountdown = false } = {}) {
    stop();
    tick = 0;
    ended = false;
    paused = false;
    practiceMode = !!practice;
    practiceHits = 0;
    countdownTicks = skipCountdown ? 0 : (practiceMode ? 18 : 36); // ~1.3s 3-2-1 prep
    nextNoteId = 1;
    spawned = 0;
    lastLane = -1;

    page.setData({
      rhythmConfig: effectiveCfg,
      rhythmNotes: [],
      rhythmScore: 0,
      rhythmCombo: 0,
      rhythmHits: 0,
      rhythmMisses: 0,
      rhythmDone: 0,
      rhythmTotal: totalNotes,
      rhythmPractice: practiceMode,
      rhythmCountdown: countdownTicks > 0 ? Math.ceil(countdownTicks / 12) : 0,
      rhythmJudge: practiceMode
        ? '🎓 慢速动态练习：音符落入底部发光圈时按 1/2/3 或点击轨道（命中 2 拍即正式开始）'
        : '准备！3-2-1 后开始发拍，音符落入底部圆圈时点击或按 1 / 2 / 3',
      rhythmJudgeKind: '',
      gameFailed: false
    }, () => {
      startLoop();
    });
  }

  function settle() {
    if (ended) return;
    ended = true;
    stop();
    const { rhythmScore, rhythmHits, rhythmMisses } = page.data;
    const summary = evaluateRhythmRank({
      score: rhythmScore,
      hits: rhythmHits,
      misses: rhythmMisses,
      cfg: effectiveCfg
    });

    if (!summary.passed) {
      if (onFail) {
        onFail({
          title: '🎵 节拍命中不足！',
          reason: `本轮命中 ${rhythmHits}/${totalNotes} 拍，跟着节拍再来一轮吧！`,
          score: summary.score,
          ruleText: summary.ruleText,
          summary
        });
      }
    } else {
      onComplete(summary.rank, summary.score, {
        ...summary,
        mode: 'rhythm'
      });
    }
  }

  function pickNextLane() {
    if (practiceMode) return practiceHits % 2 === 0 ? 1 : 0;
    // 避免同一轨道连续刷 3 次，同时保持可读性
    let lane = Math.floor(randomFn() * 3);
    if (lane === lastLane && randomFn() < 0.7) {
      lane = (lane + 1 + Math.floor(randomFn() * 2)) % 3;
    }
    lastLane = lane;
    return lane;
  }

  function stepTick() {
    if (paused || ended) return;

    if (countdownTicks > 0) {
      countdownTicks -= 1;
      const cdNum = countdownTicks > 0 ? Math.ceil(countdownTicks / 12) : 0;
      if (cdNum !== page.data.rhythmCountdown) {
        page.setData({
          rhythmCountdown: cdNum,
          rhythmJudge: cdNum > 0 ? `⏳ 准备发拍… ${cdNum}` : '🎵 开始！音符落进底部圆圈时点击或按 1/2/3！'
        });
      }
      return;
    }

    tick += 1;
    const stepSpeed = practiceMode ? effectiveCfg.practiceSpeed : effectiveCfg.speed;
    let notes = (page.data.rhythmNotes || []).map(n => Object.assign({}, n, { y: n.y + stepSpeed }));
    let { rhythmDone, rhythmMisses, rhythmCombo, rhythmJudge, rhythmJudgeKind } = page.data;

    if (practiceMode) {
      if (notes.length === 0 && tick % 20 === 1) {
        notes.push({ id: nextNoteId++, lane: pickNextLane(), y: 0 });
      }
    } else if (spawned < totalNotes && tick % effectiveCfg.spawnInterval === 1) {
      notes.push({ id: nextNoteId++, lane: pickNextLane(), y: 0 });
      spawned += 1;
    }

    const activeNotes = [];
    let missed = false;
    for (const n of notes) {
      if (n.y > 96) {
        if (!practiceMode) {
          rhythmDone += 1;
          rhythmMisses += 1;
          rhythmCombo = 0;
        }
        missed = true;
      } else {
        activeNotes.push(n);
      }
    }
    if (missed) {
      rhythmJudge = practiceMode
        ? '🎓 练习漏拍不扣分！音符落到圆圈中心再点哦'
        : '💥 偏晚漏拍！盯紧底部圆圈中心提前准备';
      rhythmJudgeKind = 'miss';
    }

    page.setData({
      rhythmNotes: activeNotes,
      rhythmDone,
      rhythmMisses,
      rhythmCombo,
      rhythmJudge,
      rhythmJudgeKind
    });

    if (!practiceMode && rhythmDone >= totalNotes && activeNotes.length === 0) {
      settle();
    }
  }

  function startLoop() {
    stop();
    timer = setInterval(stepTick, tickMs);
  }

  function hitLane(lane) {
    if (page.data.gameFailed || paused || ended || countdownTicks > 0) return;
    const notes = page.data.rhythmNotes || [];
    const targetY = effectiveCfg.targetY || 76;
    let bestIdx = -1;
    let bestDist = 999;
    notes.forEach((n, idx) => {
      if (n.lane === lane) {
        const d = Math.abs(n.y - targetY);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      }
    });

    if (bestIdx === -1 || bestDist > effectiveCfg.normalRadius) {
      const earlyHint = bestIdx !== -1 && notes[bestIdx].y < targetY
        ? '偏早了一点！等音符再落进圆圈中心'
        : '空拍啦！等音符落进底部圆圈再点';
      if (practiceMode) {
        page.setData({ rhythmJudge: `🎓 练习不扣分：${earlyHint}`, rhythmJudgeKind: 'miss' });
        return;
      }
      page.setData({
        rhythmScore: Math.max(0, page.data.rhythmScore - effectiveCfg.emptyTapPenalty),
        rhythmCombo: 0,
        rhythmJudge: `${earlyHint}（-${effectiveCfg.emptyTapPenalty}）`,
        rhythmJudgeKind: 'miss'
      });
      return;
    }

    const hitNote = notes[bestIdx];
    const nextNotes = notes.slice();
    nextNotes.splice(bestIdx, 1);

    if (practiceMode) {
      practiceHits += 1;
      page.setData({
        rhythmNotes: nextNotes,
        rhythmJudge: `🎓 练习命中 ${practiceHits}/2！${practiceHits >= 2 ? '手感掌握，马上进入正式发拍！' : '再来一拍！'}`,
        rhythmJudgeKind: 'perfect'
      });
      if (practiceHits >= 2) {
        start({ practice: false, skipCountdown: false });
      }
      return;
    }

    let add = 70;
    let judgeKind = 'great';
    const nextCombo = page.data.rhythmCombo + 1;
    const timingTag = hitNote.y < targetY - effectiveCfg.perfectRadius
      ? '略早'
      : (hitNote.y > targetY + effectiveCfg.perfectRadius ? '略晚' : '');
    let judgeText = timingTag ? `👍 GOOD（${timingTag}） +${add}` : `👍 GOOD +${add}`;

    if (bestDist <= effectiveCfg.perfectRadius) {
      add = 100;
      judgeKind = 'perfect';
      judgeText = nextCombo > 1 ? `✨ PERFECT! 连击x${nextCombo} +${add}` : `✨ PERFECT! +${add}`;
    }

    const nextScore = page.data.rhythmScore + add;
    const nextHits = page.data.rhythmHits + 1;
    const nextDone = page.data.rhythmDone + 1;

    page.setData({
      rhythmNotes: nextNotes,
      rhythmScore: nextScore,
      rhythmCombo: nextCombo,
      rhythmHits: nextHits,
      rhythmDone: nextDone,
      rhythmJudge: judgeText,
      rhythmJudgeKind: judgeKind
    });

    if (nextDone >= totalNotes && nextNotes.length === 0) {
      settle();
    }
  }

  return {
    start,
    stop,
    hitLane,
    stepTick,
    setPaused(v) { paused = !!v; },
    isPaused() { return paused; },
    isPractice() { return practiceMode; }
  };
}

export {
  RHYTHM_CONFIGS,
  getRhythmRuleText,
  evaluateRhythmRank,
  createRhythmEngine
};
