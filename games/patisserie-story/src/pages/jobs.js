// src/pages/jobs.js
// 风铃湾打工中心：3 个独立交互打工场景（微风花坊 / 海风咖啡馆 / 钟楼码头杂货铺），零成本赚取还债与开店本金

import { PART_TIME_JOBS } from '../data/part_time_jobs.js';
import { RECIPES } from '../data/recipes.js';
import { computeShopBonuses } from '../data/shop_upgrades.js';
import { getUnitCost } from '../data/kitchen_recipes.js';
import { loadProgress, recordPartTimeJob } from '../utils/store.js';
import { spawnFloatText } from '../utils/tutorial.js';
import { showToast } from '../../../../shared/web-ui.js';

const RANK_PRICE_MULT = { S: 1.35, A: 1.15, B: 1.0 };
const RECIPE_TO_LEVEL = {
  madeleine: 'main_1',
  macaron: 'side_1',
  canele: 'side_2',
  tarte_tatin: 'main_2',
  tiramisu: 'side_3',
  mille_feuille: 'main_3',
  mont_blanc: 'side_4',
  basque_cheesecake: 'main_4',
  sachertorte: 'side_5',
  opera: 'main_5',
  saint_honore: 'main_6'
};

const FLOWERS = [
  { id: 'rose', emoji: '🌹', name: '红玫瑰' },
  { id: 'sun',  emoji: '🌻', name: '向日葵' },
  { id: 'tulip', emoji: '🌷', name: '郁金香' },
  { id: 'lav',  emoji: '💐', name: '薰衣草' }
];

const CAFE_DRINKS = [
  { name: '海盐焦糖拿铁', emoji: '☕' },
  { name: '蜂蜜燕麦卡布', emoji: '🍯' },
  { name: '风铃湾抹茶拿铁', emoji: '🍵' },
  { name: '复古榛果摩卡', emoji: '🍫' }
];

const HARBOR_ITEMS = [
  { emoji: '🌾', name: '法国 T55 面粉', bin: 'dry' },
  { emoji: '🧈', name: '发酵黄油块', bin: 'dry' },
  { emoji: '🥜', name: '焦糖杏仁碎', bin: 'dry' },
  { emoji: '🍓', name: '晨摘红草莓', bin: 'fresh' },
  { emoji: '🍋', name: '阳光黄柠檬', bin: 'fresh' },
  { emoji: '🥛', name: '牧场鲜牛奶', bin: 'fresh' },
  { emoji: '🍄', name: '受潮发霉面团', bin: 'bad' },
  { emoji: '🪱', name: '虫蛀坏苹果', bin: 'bad' },
  { emoji: '🧪', name: '过期变质奶油', bin: 'bad' }
];

export function computeRequiredOpeningPrepCost(progress) {
  const bonuses = computeShopBonuses(progress.purchasedUpgradeIds || []);
  const unlockedIds = progress.unlockedRecipeIds || [];
  let menuIds = (progress.menuRecipeIds || []).filter(id => unlockedIds.includes(id));
  if (menuIds.length === 0 && unlockedIds.length > 0) menuIds = unlockedIds.slice(0, 3);
  if (menuIds.length === 0) return 0;

  const initStock = menuIds.length === 1 ? 3 : 2;
  let total = 0;
  menuIds.forEach(id => {
    const r = RECIPES.find(x => x.id === id);
    if (!r) return;
    const rank = (progress.levelRanks || {})[RECIPE_TO_LEVEL[id]] || 'B';
    const price = Math.round(r.basePrice * (RANK_PRICE_MULT[rank] || 1) * bonuses.priceMult);
    total += getUnitCost(id, price) * initStock;
  });
  return total;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function mountJobsPage(root, _params, { navigate }) {
  let destroyed = false;
  let activeJob = null;
  let jobSummary = null;

  // 当前打工局内状态
  let timeLeft = 0;
  let bonusEarned = 0;
  let completedCount = 0;
  let combo = 0;
  let maxCombo = 0;
  let timerId = null;
  let rafId = null;
  let lastFrameTs = 0;

  // 花店局内状态
  let floristOrder = [];
  let floristStep = 0;

  // 咖啡馆局内状态
  let cafeDrink = CAFE_DRINKS[0];
  let cafeNeedle = 12; // 0..100
  let cafeDir = 1;
  let cafeSpeed = 76;  // % per sec
  let cafeZoneStart = 38;
  let cafeZoneWidth = 24;
  let cafePerfectStart = 46;
  let cafePerfectWidth = 8;
  let cafeFeedback = '看准金色温区，点击「精准出杯」！';

  // 码头杂货铺局内状态
  let harborItem = HARBOR_ITEMS[0];
  let harborFeedback = '把木桌上的货物分拣到对应货篮！';

  function stopLoops() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function nextFloristOrder() {
    const len = completedCount >= 3 ? 3 : 2;
    floristOrder = Array.from({ length: len }, () => pickRandom(FLOWERS));
    floristStep = 0;
  }

  function nextCafeDrink() {
    cafeDrink = pickRandom(CAFE_DRINKS);
    cafeSpeed = Math.min(118, 74 + completedCount * 6);
    cafeZoneStart = 28 + Math.floor(Math.random() * 24);
    cafeZoneWidth = Math.max(18, 26 - Math.floor(completedCount / 2) * 2);
    cafePerfectWidth = 8;
    cafePerfectStart = cafeZoneStart + Math.floor((cafeZoneWidth - cafePerfectWidth) / 2);
  }

  function nextHarborItem() {
    let pick = pickRandom(HARBOR_ITEMS);
    if (pick.name === harborItem.name) pick = pickRandom(HARBOR_ITEMS);
    harborItem = pick;
  }

  function triggerStageFloat(text, kind = 'gold') {
    const stage = root.querySelector('.job-stage');
    if (!stage) return;
    spawnFloatText(stage, { xPct: 50, yPct: 42, text, kind });
  }

  function startJob(jobId) {
    const job = PART_TIME_JOBS.find(j => j.id === jobId);
    if (!job) return;
    stopLoops();
    activeJob = job;
    jobSummary = null;
    timeLeft = job.durationSec;
    bonusEarned = 0;
    completedCount = 0;
    combo = 0;
    maxCombo = 0;

    if (job.id === 'florist') {
      nextFloristOrder();
    } else if (job.id === 'cafe') {
      cafeNeedle = 12;
      cafeDir = 1;
      cafeFeedback = '蒸汽指针落入金色区时果断出杯！';
      nextCafeDrink();
    } else if (job.id === 'harbor') {
      harborFeedback = '快速把当前货物送入对应分类篮！';
      nextHarborItem();
    }

    render();

    timerId = setInterval(() => {
      if (destroyed || !activeJob) return;
      timeLeft -= 1;
      const tEl = root.querySelector('#job-time');
      if (tEl) tEl.textContent = `⏱ ${Math.max(0, timeLeft)}s`;
      if (timeLeft <= 0) {
        finishJob();
      }
    }, 1000);

    if (job.id === 'cafe') {
      lastFrameTs = performance.now();
      const tickCafe = (ts) => {
        if (destroyed || !activeJob || activeJob.id !== 'cafe') return;
        const dt = Math.min(0.05, (ts - lastFrameTs) / 1000);
        lastFrameTs = ts;
        cafeNeedle += cafeDir * cafeSpeed * dt;
        if (cafeNeedle >= 96) { cafeNeedle = 96; cafeDir = -1; }
        if (cafeNeedle <= 4)  { cafeNeedle = 4;  cafeDir = 1; }
        const needleEl = root.querySelector('#cafe-needle');
        if (needleEl) needleEl.style.left = `${cafeNeedle.toFixed(1)}%`;
        rafId = requestAnimationFrame(tickCafe);
      };
      rafId = requestAnimationFrame(tickCafe);
    }
  }

  function finishJob() {
    if (!activeJob) return;
    const job = activeJob;
    stopLoops();

    const beforeProgress = loadProgress();
    const beforeCoins = beforeProgress.coins;
    const basePay = job.basePay;
    const totalEarned = basePay + bonusEarned;
    const earnedRep = completedCount >= 3 ? 5 : 2;
    const afterProgress = recordPartTimeJob({ earnedCoins: totalEarned, earnedRep });
    const reqPrep = computeRequiredOpeningPrepCost(afterProgress);

    activeJob = null;
    jobSummary = {
      job,
      basePay,
      bonusEarned,
      totalEarned,
      earnedRep,
      completedCount,
      maxCombo,
      beforeCoins,
      afterCoins: afterProgress.coins,
      reqPrep,
      canReopenNow: afterProgress.coins >= 0 && afterProgress.coins >= reqPrep
    };
    render();
  }

  function updateShiftHud() {
    if (!activeJob) return;
    const earnEl = root.querySelector('#job-earn');
    const comboEl = root.querySelector('#job-combo');
    if (earnEl) earnEl.textContent = `🪙 +${activeJob.basePay + bonusEarned}`;
    if (comboEl) comboEl.textContent = `完成 ${completedCount} · 连击 x${combo}`;
  }

  function handleFloristPick(flowerId) {
    if (!activeJob || activeJob.id !== 'florist') return;
    const expected = floristOrder[floristStep];
    if (!expected) return;

    if (flowerId === expected.id) {
      floristStep += 1;
      if (floristStep >= floristOrder.length) {
        completedCount += 1;
        combo += 1;
        if (combo > maxCombo) maxCombo = combo;
        const pay = (floristOrder.length === 3 ? 18 : 13) + Math.min(8, combo * 2);
        bonusEarned += pay;
        triggerStageFloat(`💐 包装完成 +${pay} 🪙`, 'gold');
        nextFloristOrder();
      } else {
        triggerStageFloat(`${expected.emoji} 选对啦！`, 'green');
      }
    } else {
      combo = 0;
      floristStep = 0;
      triggerStageFloat('哎呀拿错花了，重扎这束～', 'red');
    }
    renderShiftWorkArea();
    updateShiftHud();
  }

  function handleCafePour() {
    if (!activeJob || activeJob.id !== 'cafe') return;
    const inPerfect = cafeNeedle >= cafePerfectStart && cafeNeedle <= (cafePerfectStart + cafePerfectWidth);
    const inGood = cafeNeedle >= cafeZoneStart && cafeNeedle <= (cafeZoneStart + cafeZoneWidth);

    if (inPerfect) {
      completedCount += 1;
      combo += 1;
      if (combo > maxCombo) maxCombo = combo;
      const pay = 22 + Math.min(10, combo * 2);
      bonusEarned += pay;
      cafeFeedback = `✨ 丝绒拉花完美出杯！+${pay} 🪙`;
      triggerStageFloat(`✨ 完美拉花 +${pay} 🪙`, 'gold');
      nextCafeDrink();
    } else if (inGood) {
      completedCount += 1;
      combo += 1;
      if (combo > maxCombo) maxCombo = combo;
      const pay = 14 + Math.min(6, combo);
      bonusEarned += pay;
      cafeFeedback = `👍 口感醇厚，顺利出杯！+${pay} 🪙`;
      triggerStageFloat(`☕ 顺利出杯 +${pay} 🪙`, 'green');
      nextCafeDrink();
    } else {
      combo = 0;
      const pay = 5;
      bonusEarned += pay;
      cafeFeedback = '😅 奶泡稍偏淡，席奥帮忙补救了（鼓励费 +5 🪙）';
      triggerStageFloat('😅 稍偏温 +5 🪙', 'cream');
      nextCafeDrink();
    }
    renderShiftWorkArea();
    updateShiftHud();
  }

  function handleHarborSort(binId) {
    if (!activeJob || activeJob.id !== 'harbor') return;
    if (harborItem.bin === binId) {
      completedCount += 1;
      combo += 1;
      if (combo > maxCombo) maxCombo = combo;
      const pay = 10 + Math.min(8, combo * 2);
      bonusEarned += pay;
      harborFeedback = `✅ 分拣准确！连击 x${combo}（+${pay} 🪙）`;
      triggerStageFloat(`✅ +${pay} 🪙`, 'gold');
    } else {
      combo = 0;
      harborFeedback = `😅 【${harborItem.name}】放错货篮了（不扣工资，继续加油！）`;
      triggerStageFloat('放错篮啦，连击重置', 'red');
    }
    nextHarborItem();
    renderShiftWorkArea();
    updateShiftHud();
  }

  function buildWorkAreaHtml() {
    if (!activeJob) return '';

    if (activeJob.id === 'florist') {
      return `
        <div class="job-work-card">
          <div class="work-order-bar">
            <span class="work-order-label">🌸 当前花束配方（按顺序点击）：</span>
            <div class="florist-seq">
              ${floristOrder.map((f, idx) => `
                <span class="florist-chip ${idx < floristStep ? 'is-done' : (idx === floristStep ? 'is-next' : '')}">
                  ${f.emoji} ${f.name}${idx < floristStep ? ' ✓' : ''}
                </span>
              `).join('<span class="florist-arrow">→</span>')}
            </div>
          </div>
          <div class="florist-buckets">
            ${FLOWERS.map(f => `
              <button type="button" class="job-action-btn florist-btn" data-action="floristPick" data-id="${f.id}">
                <span class="job-act-emoji">${f.emoji}</span>
                <span class="job-act-name">${f.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (activeJob.id === 'cafe') {
      return `
        <div class="job-work-card">
          <div class="work-order-bar">
            <span class="work-order-label">当前点单：<b>${cafeDrink.emoji} ${cafeDrink.name}</b></span>
            <span class="work-sub-tip">${cafeFeedback}</span>
          </div>
          <div class="cafe-gauge-wrap">
            <div class="cafe-gauge-track">
              <div class="cafe-zone-good" style="left:${cafeZoneStart}%;width:${cafeZoneWidth}%;"></div>
              <div class="cafe-zone-perfect" style="left:${cafePerfectStart}%;width:${cafePerfectWidth}%;"></div>
              <div id="cafe-needle" class="cafe-needle" style="left:${cafeNeedle.toFixed(1)}%;"></div>
            </div>
            <div class="cafe-gauge-labels">
              <span>偏凉</span><span>✨ 金色完美拉花区</span><span>过烫</span>
            </div>
          </div>
          <button type="button" class="btn-primary cafe-pour-btn" data-action="cafePour">☕ 精准出杯！（空格也可触发）</button>
        </div>
      `;
    }

    // harbor
    return `
      <div class="job-work-card">
        <div class="work-order-bar">
          <span class="work-sub-tip">${harborFeedback}</span>
        </div>
        <div class="harbor-crate-box">
          <span class="harbor-crate-emoji">${harborItem.emoji}</span>
          <span class="harbor-crate-name">${harborItem.name}</span>
        </div>
        <div class="harbor-bins">
          <button type="button" class="job-action-btn bin-dry" data-action="harborSort" data-id="dry">
            <span class="job-act-emoji">🌾</span>
            <span class="job-act-name">烘焙干货</span>
          </button>
          <button type="button" class="job-action-btn bin-fresh" data-action="harborSort" data-id="fresh">
            <span class="job-act-emoji">🍓</span>
            <span class="job-act-name">新鲜果乳</span>
          </button>
          <button type="button" class="job-action-btn bin-bad" data-action="harborSort" data-id="bad">
            <span class="job-act-emoji">🗑️</span>
            <span class="job-act-name">剔除次品</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderShiftWorkArea() {
    const slot = root.querySelector('#job-work-slot');
    if (slot) slot.innerHTML = buildWorkAreaHtml();
  }

  function render() {
    const progress = loadProgress();
    const coins = progress.coins;
    const reqPrep = computeRequiredOpeningPrepCost(progress);
    const isInDebt = coins < 0;
    const isShort = coins < reqPrep;
    const deficit = Math.max(0, reqPrep - coins);

    if (activeJob) {
      root.innerHTML = `
        <div class="scrollarea jobs-scroll">
          <div class="page-wrap jobs-wrap">
            <div class="card job-stage-card">
              <div class="job-stage">
                <img class="job-stage-bg mode-fill" src="${activeJob.bgImg}" alt="${activeJob.title}" />
                <div class="job-stage-hud">
                  <span id="job-time" class="job-hud-pill">⏱ ${timeLeft}s</span>
                  <span id="job-earn" class="job-hud-pill is-gold">🪙 +${activeJob.basePay + bonusEarned}</span>
                  <span id="job-combo" class="job-hud-pill">完成 ${completedCount} · 连击 x${combo}</span>
                </div>
                <div class="job-coco-badge">
                  <img class="job-coco-img mode-fill" src="assets/images/coco_avatar.png" alt="可可" />
                  <span>可可打工中 · ${activeJob.title.split('·')[0].trim()}</span>
                </div>
                <button type="button" class="job-quit-btn" data-action="endJobEarly">提前结算</button>
              </div>
              <div id="job-work-slot">${buildWorkAreaHtml()}</div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const statusBannerClass = isInDebt ? 'is-debt' : (isShort ? 'is-short' : 'is-ready');
    const statusText = isInDebt
      ? `🚨 糖屋账面赤字（欠款 ${Math.abs(coins)} 🪙）！原料商已暂停赊账，请先打工还清欠款并凑足 ${reqPrep} 🪙 备货本金（共需 ${deficit} 🪙）。`
      : (isShort
          ? `⚠️ 开店备货本金不足：当前现金 ${coins} 🪙，还差 ${deficit} 🪙 即可达到今日菜单初始备货成本（${reqPrep} 🪙）。`
          : `✅ 资金充足！当前现金 ${coins} 🪙（今日备货需 ${reqPrep} 🪙），随时可以回星月糖屋挂牌开张，也可以顺手兼职赚点零花钱～`);

    const summaryModalHtml = jobSummary
      ? `<div class="summary-mask" data-action="closeJobSummary" role="dialog" aria-modal="true" aria-label="兼职工资条">
          <div class="card summary-card job-summary-card" data-stop="true">
            <div class="ribbon-title">💼 ${jobSummary.job.title.split('·')[0].trim()} · 工资条</div>
            <div class="summary-rows">
              <div class="sum-row"><span>完成单量 / 最高连击</span><span class="sum-val">${jobSummary.completedCount} 单 · x${jobSummary.maxCombo}</span></div>
              <div class="sum-row sub"><span>保底班次日薪（零成本）</span><span class="sum-val">+${jobSummary.basePay} 🪙</span></div>
              <div class="sum-row sub"><span>计件绩效与连击小费</span><span class="sum-val">+${jobSummary.bonusEarned} 🪙</span></div>
              <div class="sum-row"><span>本班实发工资</span><span class="sum-val is-gold">+${jobSummary.totalEarned} 🪙</span></div>
              <div class="sum-row sub"><span>风铃湾邻里好评</span><span class="sum-val">+${jobSummary.earnedRep} ⭐</span></div>
              <div class="sum-divider"></div>
              <div class="sum-row"><span>账面资金变动</span><span class="sum-val ${jobSummary.afterCoins < 0 ? 'warn' : ''}">${jobSummary.beforeCoins} → ${jobSummary.afterCoins} 🪙</span></div>
            </div>
            <div class="summary-advice">
              ${jobSummary.canReopenNow
                ? '🎉 太棒啦！已经还清赤字并凑足开店备货本金，快回星月糖屋重新挂牌迎客吧！'
                : `💪 还差 ${Math.max(0, jobSummary.reqPrep - jobSummary.afterCoins)} 🪙 就能凑足开店本金，再打一份轻松兼职就能重新开张！`}
            </div>
            <div class="job-summary-actions">
              ${jobSummary.canReopenNow
                ? `<button type="button" class="btn-primary" data-action="goShop">🥐 资金到位 · 回糖屋开张</button>
                   <button type="button" class="btn-secondary" data-action="closeJobSummary">再逛逛打工中心</button>`
                : `<button type="button" class="btn-primary" data-action="replayJob" data-id="${jobSummary.job.id}">💼 再干一班（${jobSummary.job.title.split('·')[0].trim()}）</button>
                   <button type="button" class="btn-secondary" data-action="closeJobSummary">换个兼职场景</button>`}
            </div>
          </div>
        </div>`
      : '';

    root.innerHTML = `
      <div class="scrollarea jobs-scroll">
        <div class="caramel-canopy">
          <div class="awning-bar"></div>
          <div class="caramel-drip-edge"></div>
        </div>
        <div class="page-wrap jobs-wrap">
          <div class="card jobs-status-card">
            <div class="jobs-status-head">
              <div class="jobs-title-group">
                <span class="jobs-main-title">💼 风铃湾兼职打工中心</span>
                <span class="jobs-sub-title">零成本 · 保底日薪 + 绩效提成 · 已累计打工 ${progress.partTimeCount || 0} 次</span>
              </div>
              <div class="jobs-balance-pill ${isInDebt ? 'is-debt' : ''}">
                <span>🪙</span>
                <b>${coins}</b>
              </div>
            </div>
            <div class="jobs-alert-banner ${statusBannerClass}">${statusText}</div>
            <div class="jobs-nav-row">
              <button type="button" class="${(!isInDebt && !isShort) ? 'btn-primary' : 'btn-secondary'} jobs-back-shop-btn" data-action="goShop">
                ${(!isInDebt && !isShort) ? '🥐 本金充足 · 返回星月糖屋开张' : '🏠 查看糖屋账本'}
              </button>
            </div>
          </div>

          <div class="jobs-list">
            ${PART_TIME_JOBS.map(job => `
              <div class="card job-card">
                <div class="job-card-cover">
                  <img class="job-card-img mode-fill" src="${job.bgImg}" alt="${job.title}" />
                  <span class="job-diff-tag">${job.difficulty}</span>
                  <span class="job-pay-tag">${job.payRangeText}</span>
                </div>
                <div class="job-card-body">
                  <div class="job-card-title">${job.icon} ${job.title}</div>
                  <div class="job-card-meta">📍 ${job.place} · 雇主：${job.boss} · ⏱ ${job.durationSec}秒/班</div>
                  <p class="job-card-desc">${job.desc}</p>
                  <button type="button" class="btn-primary job-start-btn" data-action="startJob" data-id="${job.id}">💼 换上围裙 · 立即上岗</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        ${summaryModalHtml}
      </div>
    `;
  }

  const onClick = (e) => {
    const target = e.target.closest('[data-action], [data-stop]');
    if (!target || !target.dataset.action) return;
    const action = target.dataset.action;

    if (action === 'goShop') {
      stopLoops();
      navigate('shop');
    } else if (action === 'startJob' || action === 'replayJob') {
      startJob(target.dataset.id);
    } else if (action === 'endJobEarly') {
      finishJob();
    } else if (action === 'closeJobSummary') {
      jobSummary = null;
      render();
    } else if (action === 'floristPick') {
      handleFloristPick(target.dataset.id);
    } else if (action === 'cafePour') {
      handleCafePour();
    } else if (action === 'harborSort') {
      handleHarborSort(target.dataset.id);
    }
  };

  const onKeyDown = (e) => {
    if (e.code === 'Space' && activeJob && activeJob.id === 'cafe') {
      e.preventDefault();
      handleCafePour();
    }
  };

  root.addEventListener('click', onClick);
  window.addEventListener('keydown', onKeyDown);
  render();

  return () => {
    destroyed = true;
    stopLoops();
    root.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKeyDown);
  };
}
