// engines/rhythm_engine.js
// 真实 3 轨音游节拍引擎（用于：波尔多可露丽节拍刷蜂蜡 / 蒙布朗螺旋节拍裱花）

import { evaluateByRatio } from './rank_evaluator.js';

const RHYTHM_CONFIGS = {
  rhythm_bake: {
    title: '节拍刷蜂蜡 · 波尔多铜模',
    laneLabels: ['左铜模', '中铜模', '右铜模'],
    bgImg: 'assets/images/minigames/bg_rhythm_wax.svg',
    targetImg: 'assets/images/minigames/target_copper_mold.svg',
    noteImg: 'assets/images/minigames/note_wax.svg',
    totalNotes: 9,
    speed: 3.2,
    spawnInterval: 27
  },
  spiral_draw: {
    title: '节拍螺旋裱花 · 蒙布朗',
    laneLabels: ['外圈丝带', '中圈山脊', '雪顶收尾'],
    bgImg: 'assets/images/minigames/bg_rhythm_montblanc.svg',
    targetImg: 'assets/images/minigames/target_porcelain_ring.svg',
    noteImg: 'assets/images/minigames/note_chestnut.svg',
    totalNotes: 10,
    speed: 3.4,
    spawnInterval: 25
  }
};

function createRhythmEngine(page, type, onComplete, onFail) {
  const cfg = RHYTHM_CONFIGS[type] || RHYTHM_CONFIGS.rhythm_bake;
  let timer = null;
  let tick = 0;
  let paused = false;
  let nextNoteId = 1;
  let spawned = 0;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    tick = 0;
    nextNoteId = 1;
    spawned = 0;

    page.setData({
      rhythmConfig: cfg,
      rhythmNotes: [],
      rhythmScore: 0,
      rhythmCombo: 0,
      rhythmHits: 0,
      rhythmMisses: 0,
      rhythmDone: 0,
      rhythmTotal: cfg.totalNotes,
      rhythmJudge: '节拍落进底部器皿中心时，精准点击对应轨道！',
      rhythmJudgeKind: '',
      gameFailed: false
    }, () => {
      startLoop();
    });
  }

  function settle() {
    stop();
    const { rhythmScore, rhythmHits, rhythmMisses } = page.data;
    const minHits = Math.ceil(cfg.totalNotes * 0.5);
    const res = evaluateByRatio({
      score: rhythmScore,
      maxScore: cfg.totalNotes * 100,
      perfectLives: rhythmMisses === 0,
      goodLives: rhythmMisses <= 2,
      passed: rhythmHits >= minHits,
      minPassRatio: 0.42
    });

    if (!res.passed) {
      if (onFail) {
        onFail({
          title: '🎵 节拍失误太多啦！',
          reason: `仅踩准 ${rhythmHits} / ${cfg.totalNotes} 拍（得分 ${res.score}），盯紧底部器皿中心再来一次！`,
          score: res.score
        });
      }
    } else {
      onComplete(res.rank, res.score);
    }
  }

  function startLoop() {
    stop();
    timer = setInterval(() => {
      if (paused) return;
      tick += 1;
      let notes = (page.data.rhythmNotes || []).map(n => Object.assign({}, n, { y: n.y + cfg.speed }));
      let { rhythmDone, rhythmMisses, rhythmCombo, rhythmJudge, rhythmJudgeKind } = page.data;

      if (spawned < cfg.totalNotes && tick % cfg.spawnInterval === 1) {
        const lane = (spawned * 2 + Math.floor(Math.random() * 3)) % 3;
        notes.push({ id: nextNoteId++, lane, y: 0 });
        spawned += 1;
      }

      const activeNotes = [];
      let missed = false;
      for (const n of notes) {
        if (n.y > 95) {
          rhythmDone += 1;
          rhythmMisses += 1;
          rhythmCombo = 0;
          missed = true;
        } else {
          activeNotes.push(n);
        }
      }
      if (missed) {
        rhythmJudge = '💥 漏掉一拍！专注底部器皿判定圈';
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

      if (rhythmDone >= cfg.totalNotes && activeNotes.length === 0) {
        settle();
      }
    }, 36);
  }

  function hitLane(lane) {
    if (page.data.gameFailed) return;
    const notes = page.data.rhythmNotes || [];
    // 找到该轨道中最接近判定线（y = 76，与底部器皿中心精准对齐）的音符
    let bestIdx = -1;
    let bestDist = 999;
    notes.forEach((n, idx) => {
      if (n.lane === lane) {
        const d = Math.abs(n.y - 76);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      }
    });

    if (bestIdx === -1 || bestDist > 15) {
      page.setData({
        rhythmScore: Math.max(0, page.data.rhythmScore - 15),
        rhythmCombo: 0,
        rhythmJudge: '空拍扣分 -15！等音符落进器皿再点',
        rhythmJudgeKind: 'miss'
      });
      return;
    }

    const nextNotes = notes.slice();
    nextNotes.splice(bestIdx, 1);

    let add = 65;
    let judgeKind = 'great';
    const nextCombo = page.data.rhythmCombo + 1;
    let judgeText = `👍 GOOD +${add}`;

    if (bestDist <= 7) {
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

    if (nextDone >= cfg.totalNotes && nextNotes.length === 0) {
      settle();
    }
  }

  return { start, stop, hitLane, setPaused(v) { paused = !!v; } };
}

export {
  RHYTHM_CONFIGS,
  createRhythmEngine
};
