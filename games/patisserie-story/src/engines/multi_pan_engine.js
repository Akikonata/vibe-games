// engines/multi_pan_engine.js
// 真实 3 锅/3 烤位同时时间管理厨房引擎（用于：翻转苹果塔多锅焦糖 / 巴斯克高温焦烤）

import { evaluateByRatio } from './rank_evaluator.js';

const MULTI_PAN_CONFIGS = {
  pan_flip: {
    title: '三口铜锅 · 焦糖苹果时间管理',
    unitName: '铜锅',
    bgImg: 'assets/images/minigames/bg_stovetop.svg',
    spritePrefix: 'pan_tatin',
    targetServings: 6,
    timeLimit: 32,
    heatRates: [2.2, 2.7, 3.1],
    readyMin: 62,
    readyMax: 86
  },
  whisk_dash: {
    title: '230°C 三烤位 · 巴斯克流心抓拍',
    unitName: '烤位',
    bgImg: 'assets/images/minigames/bg_basque_oven.svg',
    spritePrefix: 'pan_basque',
    targetServings: 6,
    timeLimit: 30,
    heatRates: [2.5, 3.0, 3.4],
    readyMin: 62,
    readyMax: 86
  }
};

function createMultiPanEngine(page, type, onComplete, onFail) {
  const cfg = MULTI_PAN_CONFIGS[type] || MULTI_PAN_CONFIGS.pan_flip;
  let timer = null;
  let ticks = 0;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function makePan(id, offset) {
    return {
      id,
      name: `${cfg.unitName} #${id + 1}`,
      heat: offset,
      state: 'cooking', // 'cooking' | 'ready' | 'burnt'
      spriteImg: `assets/images/minigames/${cfg.spritePrefix}_cooking.svg`,
      label: '升温中'
    };
  }

  function start() {
    stop();
    ticks = 0;
    const pans = [makePan(0, 8), makePan(1, 34), makePan(2, 18)];
    page.setData({
      panConfig: cfg,
      pans,
      panScore: 0,
      panServed: 0,
      panBurnt: 0,
      panTimeLeft: cfg.timeLimit,
      panTip: '盯紧 3 口锅！进入金色火候区立刻点击翻面，烤糊 4 次会失败哦！',
      gameFailed: false
    }, () => {
      startLoop();
    });
  }

  function startLoop() {
    stop();
    timer = setInterval(() => {
      ticks += 1;
      const timeLeft = Math.max(0, cfg.timeLimit - Math.floor((ticks * 85) / 1000));
      let { panScore, panBurnt, panTip } = page.data;

      const pans = page.data.pans.map((p, idx) => {
        const rate = cfg.heatRates[idx] + (Math.random() * 0.6);
        let nextHeat = p.heat + rate;
        let state = 'cooking';
        let label = '熬煮升温中';

        if (nextHeat >= 100) {
          panBurnt += 1;
          panScore = Math.max(0, panScore - 30);
          panTip = `💥 ${p.name} 烤糊冒烟啦！-30 分（已糊 ${panBurnt}/4）`;
          return makePan(p.id, 6);
        } else if (nextHeat >= cfg.readyMin && nextHeat <= cfg.readyMax) {
          state = 'ready';
          label = '✨ 点我出锅!';
        } else if (nextHeat > cfg.readyMax) {
          state = 'burnt';
          label = '⚠️ 快糊了!';
        }
        return Object.assign({}, p, {
          heat: Math.round(nextHeat),
          state,
          spriteImg: `assets/images/minigames/${cfg.spritePrefix}_${state}.svg`,
          label
        });
      });

      page.setData({ pans, panScore, panBurnt, panTimeLeft: timeLeft, panTip });

      if (panBurnt >= 4) {
        stop();
        if (onFail) {
          onFail({
            title: '💨 厨房浓烟滚滚！',
            reason: '烤糊次数达到 4 次，甜点没法端上桌啦！盯紧火候再来一炉吧！',
            score: panScore
          });
        }
        return;
      }

      if (timeLeft <= 0) {
        finish();
      }
    }, 85);
  }

  function tapPan(panId) {
    if (page.data.gameFailed) return;
    const pans = page.data.pans.slice();
    const idx = pans.findIndex(p => p.id === panId);
    if (idx === -1) return;
    const p = pans[idx];

    let { panScore, panServed, panBurnt, panTip } = page.data;

    if (p.state === 'ready') {
      const centerDist = Math.abs(p.heat - (cfg.readyMin + cfg.readyMax) / 2);
      const add = centerDist <= 6 ? 100 : 75;
      panScore += add;
      panServed += 1;
      panTip = add === 100 ? `✨ ${p.name} 完美翻面出锅！+${add}` : `👍 ${p.name} 顺利出锅 +${add}`;
      pans[idx] = makePan(p.id, 4);
    } else if (p.state === 'burnt') {
      panScore += 25;
      panServed += 1;
      panBurnt += 1;
      panTip = `😅 ${p.name} 烤过头焦了点，勉强救回 +25（焦糊 ${panBurnt}/4）`;
      pans[idx] = makePan(p.id, 4);
    } else {
      panScore = Math.max(0, panScore - 10);
      panTip = `⏳ ${p.name} 还没熟透呢，别急着乱点（-10 分）`;
    }

    page.setData({ pans, panScore, panServed, panBurnt, panTip });

    if (panBurnt >= 4) {
      stop();
      if (onFail) {
        onFail({
          title: '💨 烤糊太多锅啦！',
          reason: '有 4 份都烤焦了，等进入金色火候区再点出锅吧！',
          score: panScore
        });
      }
      return;
    }

    if (panServed >= cfg.targetServings) {
      finish();
    }
  }

  function finish() {
    stop();
    const { panScore, panServed, panBurnt } = page.data;
    const minNeed = Math.ceil(cfg.targetServings * 0.5);
    const res = evaluateByRatio({
      score: panScore,
      maxScore: cfg.targetServings * 100,
      perfectLives: panBurnt === 0 && panServed >= cfg.targetServings,
      goodLives: panBurnt <= 1 && panServed >= cfg.targetServings,
      passed: panServed >= minNeed && panBurnt < 4,
      minPassRatio: 0.40
    });

    if (!res.passed) {
      if (onFail) {
        onFail({
          title: '⏱ 时间到，出锅数量不足！',
          reason: `本轮只出锅 ${panServed} / ${cfg.targetServings} 份（得分 ${res.score}），看准金色火候再来一次！`,
          score: res.score
        });
      }
    } else {
      onComplete(res.rank, res.score);
    }
  }

  return { start, stop, tapPan };
}

export {
  MULTI_PAN_CONFIGS,
  createMultiPanEngine
};
