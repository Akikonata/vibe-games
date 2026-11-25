// engines/rank_evaluator.js
// 统一的 S / A / B 评级与失败判定中心（支持全部 5 大独立小游戏引擎）
// 核心防挂机与梯度原则：
// - 必须达成最低通关门槛（passed && ratio >= minPassRatio），否则判定制作失败需重新挑战
// - S 级（传奇）：得分率 >= 90% 且零失误（perfectLives）
// - A 级（美味）：得分率 >= 72% 且失误可控（goodLives）
// - B 级（险胜微瑕）：满足过关条件但未达 A 级标准，进入 B 级趣味支线剧情

import { RANK_META } from '../data/story_branches.js';

function evaluateByRatio({
  score,
  maxScore,
  perfectLives = true,
  goodLives = true,
  passed = true,
  minPassRatio = 0.4
}) {
  const safeScore = Math.max(0, Math.round(score || 0));
  const ratio = maxScore > 0 ? safeScore / maxScore : 0;

  if (!passed || ratio < minPassRatio) {
    return {
      passed: false,
      rank: 'F',
      score: safeScore,
      ratio,
      meta: null
    };
  }

  let rank = 'B';
  if (ratio >= 0.90 && perfectLives) {
    rank = 'S';
  } else if (ratio >= 0.72 && goodLives) {
    rank = 'A';
  }

  return {
    passed: true,
    rank,
    score: safeScore,
    ratio,
    meta: RANK_META[rank]
  };
}

function evaluateStackerResult({ score, totalLayers, lives }) {
  return evaluateByRatio({
    score,
    maxScore: totalLayers * 100,
    perfectLives: lives === 3,
    goodLives: lives >= 2,
    passed: lives > 0,
    minPassRatio: 0.35
  });
}

function evaluatePrecisionResult({ mistakes = 0, score, maxScore = 300, passed = true }) {
  const m = mistakes || 0;
  const computedScore = typeof score === 'number'
    ? score
    : Math.max(0, 300 - m * 45);
  return evaluateByRatio({
    score: computedScore,
    maxScore,
    perfectLives: m === 0,
    goodLives: m <= 1,
    passed: passed && m < 6,
    minPassRatio: 0.35
  });
}

export {
  evaluateByRatio,
  evaluateStackerResult,
  evaluatePrecisionResult
};
