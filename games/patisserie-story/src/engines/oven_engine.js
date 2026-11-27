// engines/oven_engine.js
// 欧式红砖烤炉唤醒与温控小游戏引擎（逐阶加速 + 中心精准计分 + 炉温限时 + 完整评级诊断）

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

const OVEN_TIME_LIMIT = 35;
const STAGE_SPEEDS = [2.2, 2.7, 3.2];
const MAX_MISTAKES = 6;
const OVEN_RULE_TEXT = '小贴士：越靠近 180°C 中心得分越高，零失误高分可获 S 级！';

function createOvenEngine(page, onComplete, onFail) {
  let timer = null;
  let ticks = 0;
  let paused = false;
  let ended = false;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    ticks = 0;
    paused = false;
    ended = false;
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
      if (paused || ended) return;
      ticks += 1;
      const timeLeft = Math.max(0, OVEN_TIME_LIMIT - Math.floor((ticks * 45) / 1000));
      let { pointerPos, pointerDir, hits, ovenScore } = page.data;
      const speed = STAGE_SPEEDS[Math.min(hits, 2)] || 3.2;

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
        ended = true;
        stop();
        if (onFail) {
          onFail({
            title: '❄️ 炉膛彻底凉透啦！',
            reason: '未能在限时内完成 3 次控温，趁余温还在重新点火吧！',
            score: ovenScore,
            ruleText: OVEN_RULE_TEXT
          });
        }
      }
    }, 45);
  }

  function onTap() {
    if (page.data.gameFailed || paused || ended) return;
    const { pointerPos, hits, targetHits, mistakes, ovenScore } = page.data;
    if (hits >= targetHits) return;

    if (pointerPos >= 34 && pointerPos <= 66) {
      const nextHits = hits + 1;
      const stageIdx = Math.min(nextHits, 3);
      const isCenter = pointerPos >= 43 && pointerPos <= 57;
      const add = isCenter ? 100 : 80;
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
        ended = true;
        stop();
        const result = evaluatePrecisionResult({
          mistakes,
          score: nextScore,
          maxScore: 300,
          passed: true
        });
        const ratioPct = Math.round(result.ratio * 100);
        const downgradeReasons = [];
        if (result.rank === 'B') {
          if (result.score < 216) downgradeReasons.push('多瞄准 180°C 正中心拿高分即可升到 A 级');
          if (mistakes > 1) downgradeReasons.push(`本轮失误 ${mistakes} 次，减少失误可获更高评级`);
        } else if (result.rank === 'A') {
          if (result.score < 270) downgradeReasons.push('多命中几次正中心完美温控就能达成 S 级');
          if (mistakes > 0) downgradeReasons.push('零失误通关即可解锁 S 级评价');
        }
        onComplete(result.rank, result.score, {
          ...result,
          maxScore: 300,
          ratioPct,
          target: targetHits,
          served: nextHits,
          mistakes,
          downgradeReasons,
          ruleText: OVEN_RULE_TEXT,
          mode: 'oven'
        });
      }
    } else {
      const nextMistakes = mistakes + 1;
      const nextScore = Math.max(0, ovenScore - 15);
      if (nextMistakes >= MAX_MISTAKES) {
        ended = true;
        stop();
        page.setData({ mistakes: nextMistakes, ovenScore: nextScore });
        if (onFail) {
          onFail({
            title: '💨 炉火失控烤焦啦！',
            reason: `温控失误已达 ${MAX_MISTAKES} 次，等指针稳稳落进黄金区再出手吧！`,
            score: nextScore,
            ruleText: OVEN_RULE_TEXT
          });
        }
        return;
      }

      const tip = pointerPos < 34
        ? `炉温偏低（失误 ${nextMistakes}/${MAX_MISTAKES}，-15 分），等指针滑进黄金区再点！`
        : `火候过旺（失误 ${nextMistakes}/${MAX_MISTAKES}，-15 分），等指针回到黄金区再点！`;
      page.setData({ feedback: tip, mistakes: nextMistakes, ovenScore: nextScore });
    }
  }

  return {
    start,
    stop,
    onTap,
    setPaused(v) { paused = !!v; },
    isPaused() { return paused; }
  };
}

export {
  OVEN_RULE_TEXT,
  createOvenEngine
};
