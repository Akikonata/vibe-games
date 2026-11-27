// engines/stacker_engine.js
// 物理下落与精准对齐堆叠小游戏引擎（支持千层酥 / 提拉米苏 / 歌剧院 / 圣奥诺雷等）
// 修复：动态 targetX 辅助线始终跟踪真实有效落点 + 滑落后短暂恢复缓冲 + 完整评级降级说明

import { evaluateStackerResult } from './rank_evaluator.js';

const ARENA_PLATE_TOP = 456;

function getStackerRuleText(totalLayers) {
  return `小贴士：尽量对准虚线中心稳稳叠完 ${totalLayers} 层，满心高分可获 S 级！`;
}

function createStackerEngine(page, stackConfig, onComplete, onFail) {
  let timer = null;
  let paused = false;
  let ended = false;
  let recoveryTicks = 0;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    stop();
    paused = false;
    ended = false;
    recoveryTicks = 0;
    const layerHeight = stackConfig.layers.length >= 6 ? 36 : 42;
    page.setData({
      stackConfig,
      stackLayerHeight: layerHeight,
      stackLayers: [],
      activeLayerIndex: 0,
      activeLayer: stackConfig.layers[0],
      activePhase: 'swing',
      targetX: 50,
      swingX: 20,
      swingDir: 1,
      dropY: 42,
      dropVy: 0,
      score: 0,
      combo: 0,
      lives: 3,
      judgeText: '对准虚线有效落点，点击或按空格稳稳放下！',
      judgeKind: '',
      stackFailed: false,
      gameFailed: false
    }, () => {
      startLoop();
    });
  }

  function stepTick() {
    if (paused || ended) return;
    if (recoveryTicks > 0) {
      recoveryTicks -= 1;
      return;
    }
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
  }

  function startLoop() {
    stop();
    timer = setInterval(stepTick, 33);
  }

  function drop() {
    if (page.data.gameFailed || paused || ended || recoveryTicks > 0 || page.data.activePhase !== 'swing') return;
    page.setData({ activePhase: 'drop', dropVy: 6 });
  }

  function resolveLanding() {
    if (ended) return;
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
        ended = true;
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
            reason: `当前得分 ${score} 分，3 次机会已用完。虚线会实时标出上一层有效落点，对准虚线再松手！`,
            score,
            ruleText: getStackerRuleText(stackConfig.layers.length)
          });
        }
      } else {
        // 滑落后短暂缓冲 0.53s 并复位摆动起点，避免惊慌连扣生命
        recoveryTicks = 16;
        page.setData({
          lives: nextLives,
          combo: 0,
          activePhase: 'swing',
          targetX,
          swingX: targetX >= 50 ? 22 : 78,
          swingDir: targetX >= 50 ? 1 : -1,
          dropY: 42,
          dropVy: 0,
          judgeText: `💥 偏出落点滑落了！稍作缓冲（剩余 ${nextLives}/3 心），对准虚线再放`,
          judgeKind: 'miss'
        });
      }
      return;
    }

    let addScore = 42;
    let nextCombo = 0;
    let judgeKind = 'good';
    let judgeText = '👌 GOOD +42（略偏，虚线已随落点更新）';
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
      ended = true;
      stop();
      const totalLayers = stackConfig.layers.length;
      const maxScore = totalLayers * 100;
      const result = evaluateStackerResult({
        score: nextScore,
        totalLayers,
        lives
      });
      const ratioPct = Math.round(result.ratio * 100);
      const aMinScore = Math.ceil(maxScore * 0.72);
      const sMinScore = Math.ceil(maxScore * 0.90);
      const downgradeReasons = [];
      if (result.passed && result.rank === 'B') {
        if (result.score < aMinScore) downgradeReasons.push('落点再对准中心一些就能升到 A 级');
        if (lives < 2) downgradeReasons.push('减少滑落、保留更多红心可获更高评级');
      } else if (result.passed && result.rank === 'A') {
        if (result.score < sMinScore) downgradeReasons.push('落点再精准一点就能达成 S 级');
        if (lives < 3) downgradeReasons.push('零滑落满心通关即可解锁 S 级评价');
      }

      page.setData({
        stackLayers: newStack,
        score: nextScore,
        combo: nextCombo,
        targetX: landedX,
        activePhase: 'done',
        activeLayer: null,
        judgeText: `${result.meta ? result.meta.label : '完成'} · 总得分 ${nextScore} 分`,
        judgeKind: result.rank === 'S' ? 'perfect' : (result.rank === 'A' ? 'great' : 'good')
      });

      if (!result.passed) {
        if (onFail) {
          onFail({
            title: '💥 堆叠偏移过大，得分不足！',
            reason: '整体偏移稍大，对准虚线中心再稳稳叠一次吧！',
            score: result.score,
            ruleText: getStackerRuleText(totalLayers)
          });
        }
      } else {
        onComplete(result.rank, result.score, {
          ...result,
          maxScore,
          ratioPct,
          target: totalLayers,
          served: totalLayers,
          lives,
          downgradeReasons,
          ruleText: getStackerRuleText(totalLayers),
          mode: 'stacker'
        });
      }
    } else {
      page.setData({
        stackLayers: newStack,
        score: nextScore,
        combo: nextCombo,
        targetX: landedX,
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

  return {
    start,
    stop,
    drop,
    stepTick,
    resolveLanding,
    setPaused(v) { paused = !!v; },
    isPaused() { return paused; }
  };
}

export {
  getStackerRuleText,
  createStackerEngine
};
