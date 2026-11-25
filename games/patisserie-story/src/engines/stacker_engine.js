// engines/stacker_engine.js
// 物理下落与精准对齐堆叠小游戏引擎（支持千层酥 / 提拉米苏 / 歌剧院 / 圣奥诺雷等）

import { evaluateStackerResult } from './rank_evaluator.js';

const ARENA_PLATE_TOP = 456;

function createStackerEngine(page, stackConfig, onComplete, onFail) {
  let timer = null;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    const layerHeight = stackConfig.layers.length >= 6 ? 36 : 42;
    page.setData({
      stackConfig,
      stackLayerHeight: layerHeight,
      stackLayers: [],
      activeLayerIndex: 0,
      activeLayer: stackConfig.layers[0],
      activePhase: 'swing',
      swingX: 20,
      swingDir: 1,
      dropY: 42,
      dropVy: 0,
      score: 0,
      combo: 0,
      lives: 3,
      judgeText: '看准正上方中心虚线，点击屏幕精准放下食材！',
      judgeKind: '',
      stackFailed: false,
      gameFailed: false
    }, () => {
      startLoop();
    });
  }

  function startLoop() {
    stop();
    timer = setInterval(() => {
      const {
        activePhase,
        activeLayerIndex,
        stackLayers,
        stackLayerHeight
      } = page.data;

      if (activePhase === 'swing') {
        const speed = stackConfig.baseSpeed + activeLayerIndex * stackConfig.speedStep;
        let { swingX, swingDir } = page.data;
        swingX += swingDir * speed;
        if (swingX >= 82) {
          swingX = 82;
          swingDir = -1;
        } else if (swingX <= 18) {
          swingX = 18;
          swingDir = 1;
        }
        page.setData({ swingX, swingDir });
      } else if (activePhase === 'drop') {
        let { dropY, dropVy } = page.data;
        dropVy += 7.5;
        dropY += dropVy;
        const targetLandingY = ARENA_PLATE_TOP - (stackLayers.length + 1) * stackLayerHeight;

        if (dropY >= targetLandingY) {
          dropY = targetLandingY;
          page.setData({ dropY });
          resolveLanding();
        } else {
          page.setData({ dropY, dropVy });
        }
      }
    }, 33);
  }

  function drop() {
    if (page.data.gameFailed || page.data.activePhase !== 'swing') return;
    page.setData({ activePhase: 'drop', dropVy: 6 });
  }

  function resolveLanding() {
    const {
      swingX,
      stackLayers,
      activeLayer,
      activeLayerIndex,
      score,
      combo,
      lives
    } = page.data;

    const targetX = stackLayers.length === 0 ? 50 : stackLayers[stackLayers.length - 1].x;
    const dx = Math.abs(swingX - targetX);

    if (dx > 20) {
      const nextLives = lives - 1;
      if (nextLives <= 0) {
        stop();
        page.setData({
          lives: 0,
          combo: 0,
          activePhase: 'fail',
          stackFailed: true,
          judgeText: '哎呀！甜点塔歪掉倒塌啦，稳住重心再来一次！',
          judgeKind: 'miss'
        });
        if (onFail) {
          onFail({
            title: '💥 甜点塔歪倒啦！',
            reason: `当前得分 ${score} 分，对准中心线稳稳放下再来一次吧！`,
            score
          });
        }
      } else {
        page.setData({
          lives: nextLives,
          combo: 0,
          activePhase: 'swing',
          dropY: 42,
          dropVy: 0,
          judgeText: `💥 偏得太远滑落了！剩余机会 ${nextLives} 次`,
          judgeKind: 'miss'
        });
      }
      return;
    }

    let addScore = 42;
    let nextCombo = 0;
    let judgeKind = 'good';
    let judgeText = '👌 GOOD +42（略偏）';
    let landedX = swingX;

    if (dx <= 4.5) {
      nextCombo = combo + 1;
      addScore = 100;
      judgeKind = 'perfect';
      judgeText = nextCombo > 1 ? `✨ PERFECT! 连击x${nextCombo} +100` : '✨ PERFECT! +100';
      landedX = targetX;
    } else if (dx <= 11) {
      nextCombo = combo + 1;
      addScore = 72;
      judgeKind = 'great';
      judgeText = '👍 GREAT! +72';
    }

    const newStack = stackLayers.concat([Object.assign({}, activeLayer, { x: landedX })]);
    const nextScore = score + addScore;
    const nextIndex = activeLayerIndex + 1;

    if (nextIndex >= stackConfig.layers.length) {
      stop();
      const result = evaluateStackerResult({
        score: nextScore,
        totalLayers: stackConfig.layers.length,
        lives
      });
      page.setData({
        stackLayers: newStack,
        score: nextScore,
        combo: nextCombo,
        activePhase: 'done',
        activeLayer: null,
        judgeText: `${result.meta.label} · 总得分 ${nextScore} 分`,
        judgeKind: result.rank === 'S' ? 'perfect' : (result.rank === 'A' ? 'great' : 'good')
      });
      onComplete(result.rank, nextScore);
    } else {
      page.setData({
        stackLayers: newStack,
        score: nextScore,
        combo: nextCombo,
        activeLayerIndex: nextIndex,
        activeLayer: stackConfig.layers[nextIndex],
        activePhase: 'swing',
        swingX: nextIndex % 2 === 0 ? 20 : 80,
        swingDir: nextIndex % 2 === 0 ? 1 : -1,
        dropY: 42,
        dropVy: 0,
        judgeText,
        judgeKind
      });
    }
  }

  return { start, stop, drop, resolveLanding };
}

export {
  createStackerEngine
};
