// engines/oven_engine.js
// 欧式红砖烤炉唤醒与温控小游戏引擎（逐阶加速 + 中心精准计分 + 炉温限时防挂机）

import { evaluatePrecisionResult } from './rank_evaluator.js';

const ACTION_LABELS = [
  '点燃柴火 · 唤醒老烤炉',
  '稳住 180°C · 黄金烘焙',
  '精准控温 · 金黄出炉'
];

const STAGE_TIPS = [
  '指针滑入 180°C 黄金区中央时点击点火！',
  '炉火点亮、指针变快啦！瞄准 180°C 黄金区中心！',
  '玛德琳鼓起小肚子了！最后一次精准控温即可出炉！',
  '焦化黄油与柠檬香气四溢，完美出炉！'
];

const OVEN_TIME_LIMIT = 24;
const STAGE_SPEEDS = [3.6, 4.5, 5.4];

function createOvenEngine(page, onComplete, onFail) {
  let timer = null;
  let ticks = 0;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    ticks = 0;
    page.setData({
      pointerPos: 12,
      pointerDir: 1,
      currentTemp: 134,
      hits: 0,
      targetHits: 3,
      mistakes: 0,
      ovenScore: 0,
      ovenTimeLeft: OVEN_TIME_LIMIT,
      ovenSceneImg: 'assets/images/scenes/oven_stage_0.svg',
      actionLabel: ACTION_LABELS[0],
      feedback: STAGE_TIPS[0],
      hitFlash: false,
      gameFailed: false
    });

    timer = setInterval(() => {
      ticks += 1;
      const timeLeft = Math.max(0, OVEN_TIME_LIMIT - Math.floor((ticks * 45) / 1000));
      let { pointerPos, pointerDir, hits, ovenScore } = page.data;
      const speed = STAGE_SPEEDS[Math.min(hits, 2)] || 3.6;

      pointerPos += pointerDir * speed;
      if (pointerPos >= 96) {
        pointerPos = 96;
        pointerDir = -1;
      } else if (pointerPos <= 4) {
        pointerPos = 4;
        pointerDir = 1;
      }
      const currentTemp = Math.round(120 + (pointerPos / 100) * 120);
      page.setData({ pointerPos, pointerDir, currentTemp, ovenTimeLeft: timeLeft });

      if (timeLeft <= 0) {
        stop();
        if (onFail) {
          onFail({
            title: '❄️ 炉膛彻底凉透啦！',
            reason: '未能在限时内完成 3 次控温，趁余温还在重新点火吧！',
            score: ovenScore
          });
        }
      }
    }, 45);
  }

  function onTap() {
    if (page.data.gameFailed) return;
    const { pointerPos, hits, targetHits, mistakes, ovenScore } = page.data;
    if (hits >= targetHits) return;

    if (pointerPos >= 38 && pointerPos <= 62) {
      const nextHits = hits + 1;
      const stageIdx = Math.min(nextHits, 3);
      const isCenter = pointerPos >= 45 && pointerPos <= 55;
      const add = isCenter ? 100 : 75;
      const nextScore = ovenScore + add;
      const hitTag = isCenter ? `✨ 180°C 正中心 PERFECT +${add}！` : `👍 黄金区命中 +${add}！`;

      page.setData({
        hits: nextHits,
        ovenScore: nextScore,
        ovenSceneImg: `assets/images/scenes/oven_stage_${stageIdx}.svg`,
        actionLabel: ACTION_LABELS[Math.min(nextHits, 2)],
        feedback: nextHits < targetHits ? `${hitTag} ${STAGE_TIPS[stageIdx]}` : STAGE_TIPS[3],
        hitFlash: true
      });
      setTimeout(() => page.setData({ hitFlash: false }), 320);

      if (nextHits >= targetHits) {
        stop();
        const result = evaluatePrecisionResult({
          mistakes,
          score: nextScore,
          maxScore: 300,
          passed: true
        });
        onComplete(result.rank, result.score);
      }
    } else {
      const nextMistakes = mistakes + 1;
      const nextScore = Math.max(0, ovenScore - 25);
      if (nextMistakes >= 4) {
        stop();
        page.setData({ mistakes: nextMistakes, ovenScore: nextScore });
        if (onFail) {
          onFail({
            title: '💨 炉火失控烤焦啦！',
            reason: '温控失误已达 4 次，等指针稳稳落进黄金区中央再出手吧！',
            score: nextScore
          });
        }
        return;
      }

      const tip = pointerPos < 38
        ? `炉温偏低（失误 ${nextMistakes}/4，-25 分），等指针滑进黄金区再点！`
        : `火候过旺（失误 ${nextMistakes}/4，-25 分），等指针回到黄金区再点！`;
      page.setData({ feedback: tip, mistakes: nextMistakes, ovenScore: nextScore });
    }
  }

  return { start, stop, onTap };
}

export {
  createOvenEngine
};
