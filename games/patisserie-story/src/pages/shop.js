// src/pages/shop.js
// 星月糖屋轻度胡闹厨房（Overcooked-Lite）营业系统 + 装潢设备升级
// 营业中采用持久 DOM 增量补丁更新，全交互语义化 button，支持暂停/切屏自动暂停/练习引导/详细结算诊断

import { RECIPES } from '../data/recipes.js';
import { SHOP_UPGRADES, computeShopBonuses } from '../data/shop_upgrades.js';
import { getKitchenFlow } from '../data/kitchen_recipes.js';
import { createKitchenEngine } from '../engines/kitchen_engine.js';
import {
  loadProgress,
  getShopTierTitle,
  recordBusinessDay,
  buyShopUpgrade,
  saveMenuRecipeIds,
  hasSeenTutorial,
  markTutorialSeen
} from '../utils/store.js';
import { createTutorialCardHtml, spawnFloatText } from '../utils/tutorial.js';
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

const SHORT_RECIPE_NAMES = {
  madeleine: '玛德琳',
  tarte_tatin: '苹果塔',
  mille_feuille: '千层酥',
  macaron: '马卡龙',
  canele: '可露丽',
  tiramisu: '提拉米苏',
  mont_blanc: '蒙布朗',
  basque_cheesecake: '巴斯克',
  sachertorte: '萨赫',
  opera: '歌剧院',
  saint_honore: '圣多诺黑'
};

function getShortRecipeName(recipe) {
  if (!recipe) return '';
  return SHORT_RECIPE_NAMES[recipe.id] || (recipe.name || '').slice(0, 4);
}

function getDishStage(item) {
  if (!item) return 'empty';
  if (item.isBurnt) return 'burnt';
  if (item.isFinished) return 'ready';
  return item.stepIndex > 0 ? 'semi' : 'raw';
}

function renderDishVisualHtml(item, sizeClass = 'sz-station', extraImgClass = '') {
  if (!item) return '';
  const stage = getDishStage(item);
  if (stage === 'raw') {
    return `<div class="dish-vis is-raw ${sizeClass}">
      <img class="dish-main-img ${extraImgClass} mode-fit" src="assets/images/kitchen/prop_raw_bowl.png" alt="" />
      <img class="dish-sub-badge mode-fit" src="${item.recipeIcon}" alt="" />
    </div>`;
  }
  if (stage === 'semi') {
    const nextType = item.steps && item.steps[item.stepIndex];
    const stageIcon = nextType === 'cream' ? '🧁' : (nextType === 'decor' ? '✨' : '🔥');
    return `<div class="dish-vis is-semi ${sizeClass}">
      <img class="dish-main-img semi-tint ${extraImgClass} mode-fit" src="${item.recipeIcon}" alt="" />
      <span class="dish-stage-chip">${stageIcon}</span>
    </div>`;
  }
  if (stage === 'burnt') {
    return `<div class="dish-vis is-burnt ${sizeClass}">
      <img class="dish-main-img burnt-tint ${extraImgClass} mode-fit" src="${item.recipeIcon}" alt="" />
    </div>`;
  }
  return `<div class="dish-vis is-ready ${sizeClass}">
    <img class="dish-main-img ${extraImgClass} mode-fit" src="${item.recipeIcon}" alt="" />
  </div>`;
}

function buildSummaryAdvice({ served, lost, burnt, undelivered, isPractice }) {
  if (isPractice) {
    if (served > 0) return '已经跑通出餐动线啦！现在可以点「挂出营业牌」正式开张赚金币。';
    return '练习模式随时可重玩，建议先试做一份玛德琳（烤炉→顾客）和一份千层酥（烤炉→裱花→顾客）。';
  }
  if (served === 0) {
    if (burnt > 0) {
      return '本轮有甜点在烤炉放太久烤糊了：看到「✨ 可取餐」或「🔥 快烤糊」提示时立即点击烤炉取出即可。';
    }
    if (undelivered > 0) {
      return '甜点已开始制作但未完成交付：留意底部托盘的「下一步」提示（千层酥烤完还要点左下【裱花台】），变成品后再点对应顾客上菜。';
    }
    if (lost > 0) {
      return '顾客等太久离座了：开局直接点中央【大竹篮】可智能拿首位顾客要的面糊，优先出第一单能稳住节奏。';
    }
    return '先点「练习引导（不消耗天数）」熟悉取料→烘烤→裱花→上菜，再正式开张会更顺手！';
  }
  if (burnt > 0) {
    return '已经成功出餐啦！烤好后及时取出（满手也可直接点熟炉顺手换锅），减少烤糊能让单日营收更高。';
  }
  if (lost > 0) {
    return '出餐很稳！可以同时用两座烤炉并行烘烤，减少顾客等待流失、拿到更高连击小费。';
  }
  return '零失误流畅出餐！保持这个节奏，很快就能攒够金币升级糖屋装潢啦！';
}

export function mountShopPage(root) {
  let kitchen = null;
  let bonuses = null;
  let destroyed = false;
  let kitchenMounted = false;
  let helpModalOpen = false;

  // 营业中局部缓存，避免无变化节点重复重写
  let seatSigs = ['', '', ''];
  let handsSig = '';
  let stationSigs = {};
  let holdSig = '';
  let pauseSig = '';

  const pageProxy = {
    data: {
      activeTab: 'counter',
      coins: 120,
      reputation: 0,
      day: 1,
      shopTierTitle: '🌱 筹备见习糖屋',
      unlockedRecipes: [],
      menuRecipes: [],
      isOpen: false,
      isPractice: false,
      isPaused: false,
      pauseManual: false,
      pauseHidden: false,
      shiftTimeLeft: 45,
      shiftCoins: 0,
      shiftRep: 0,
      shiftServed: 0,
      shiftCombo: 0,
      seats: [],
      stations: [],
      heldItem: null,
      holdItem: null,
      inTutorial: false,
      highlightTarget: '',
      serviceMsg: '挑选 1~3 道招牌甜点，挂牌开门进入厨房营业！',
      daySummary: null,
      upgrades: []
    },
    setData(patch, cb) {
      if (destroyed) return;
      Object.assign(this.data, patch);
      render();
      if (typeof cb === 'function') cb();
    }
  };

  function refreshShop() {
    const progress = loadProgress();
    bonuses = computeShopBonuses(progress.purchasedUpgradeIds);

    const unlockedRecipes = RECIPES
      .filter(r => progress.unlockedRecipeIds.includes(r.id))
      .map(r => {
        const flow = getKitchenFlow(r.id);
        const lvlId = RECIPE_TO_LEVEL[r.id];
        const rank = (progress.levelRanks && progress.levelRanks[lvlId]) || 'A';
        const price = Math.round(flow.basePrice * (RANK_PRICE_MULT[rank] || 1) * bonuses.priceMult);
        return { ...r, price, flowText: flow.flowText, selected: progress.menuRecipeIds.includes(r.id) };
      });

    let menuIds = progress.menuRecipeIds.filter(id => progress.unlockedRecipeIds.includes(id));
    if (menuIds.length === 0 && unlockedRecipes.length > 0) {
      menuIds = unlockedRecipes.slice(0, 3).map(r => r.id);
      saveMenuRecipeIds(menuIds);
      unlockedRecipes.forEach(r => { r.selected = menuIds.includes(r.id); });
    }
    const menuRecipes = unlockedRecipes.filter(r => menuIds.includes(r.id));

    const upgrades = SHOP_UPGRADES.map(u => ({
      ...u,
      owned: progress.purchasedUpgradeIds.includes(u.id),
      canAfford: progress.coins >= u.cost
    }));

    pageProxy.setData({
      coins: progress.coins,
      reputation: progress.reputation,
      day: progress.day,
      shopTierTitle: getShopTierTitle(progress.reputation),
      unlockedRecipes,
      menuRecipes,
      upgrades
    });
  }

  function mountKitchenShell(d) {
    seatSigs = ['', '', ''];
    handsSig = '';
    stationSigs = {};
    holdSig = '';
    pauseSig = '';

    const PROP_IMG = {
      oven: 'assets/images/kitchen/prop_oven.png',
      cream: 'assets/images/kitchen/prop_cream_station.png',
      decor: 'assets/images/kitchen/prop_decor_station.png'
    };

    const STATION_POS = {
      oven_1: 'pos-oven-1',
      oven_2: 'pos-oven-2',
      cream_1: 'pos-cream',
      decor_1: 'pos-decor'
    };

    const singleMenu = d.menuRecipes.length === 1 ? d.menuRecipes[0] : null;
    const pantryMarkup = singleMenu
      ? `<div class="scene-prop pos-pantry is-pantry-single">
           <button type="button" class="pantry-basket-btn is-pantry-item" data-action="pickRaw" data-id="${singleMenu.id}" aria-label="原料篮：拿取${singleMenu.name}">
             <img class="prop-sprite sprite-pantry mode-fit" src="assets/images/kitchen/prop_pantry_basket.png" alt="" />
             <span class="pantry-badge-pill">
               <img class="pantry-mini-dessert mode-fit" src="${singleMenu.iconImg}" alt="" />
               <span>${getShortRecipeName(singleMenu)}</span>
             </span>
           </button>
         </div>`
      : `<div class="scene-prop pos-pantry is-pantry-multi">
           <button type="button" class="pantry-basket-btn is-pantry-item" data-action="pickSmartRaw" aria-label="大竹篮智能取料：自动拿首位等待顾客点的甜点">
             <img class="prop-sprite sprite-pantry mode-fit" src="assets/images/kitchen/prop_pantry_basket.png" alt="" />
             <span class="pantry-smart-tag">🧺 智能取料</span>
           </button>
           <div class="pantry-picks" role="group" aria-label="指定甜点取料">
             ${d.menuRecipes.map(m => `
               <button type="button" class="pantry-pick-orb is-pantry-item" data-action="pickRaw" data-id="${m.id}" aria-label="指定取料：${m.name}" aria-pressed="false">
                 <img class="pantry-orb-img mode-fit" src="${m.iconImg}" alt="" />
                 <span class="pantry-orb-name">${getShortRecipeName(m)}</span>
               </button>
             `).join('')}
           </div>
         </div>`;

    const stationsMarkup = d.stations.map(st => `
      <button type="button" id="k-st-${st.id}" class="scene-prop ${STATION_POS[st.id] || ''} state-idle" data-action="tapStation" data-id="${st.id}" aria-label="${st.shortName} · 空闲">
        <img class="prop-sprite sprite-${st.type} mode-fit" src="${PROP_IMG[st.type]}" alt="" />
        <div id="k-st-ov-${st.id}" class="prop-overlay"></div>
        <span class="prop-name-tag">${st.shortName}</span>
      </button>
    `).join('');

    root.innerHTML = `
      <div class="kitchen-scene">
        <img class="kitchen-scene-bg mode-fill" src="assets/images/kitchen/kitchen_scene_bg.jpg" alt="" />

        <!-- 顶部悬浮半透明营收 HUD + 暂停/帮助语义按钮 -->
        <div class="scene-hud">
          <span id="k-time" class="hud-time">${d.isPractice ? '🎓 练习' : `⏱ ${d.shiftTimeLeft}s`}</span>
          <span id="k-coins" class="hud-coins">🪙 +${d.shiftCoins}</span>
          <span id="k-served" class="hud-served">出餐 ${d.shiftServed} · x${d.shiftCombo}</span>
          <div class="hud-actions">
            <button type="button" id="k-pause-btn" class="hud-icon-btn" data-action="togglePause" aria-label="暂停营业" title="暂停 / 继续">⏸</button>
            <button type="button" class="hud-icon-btn" data-action="openHelp" aria-label="玩法说明" title="玩法说明">?</button>
          </div>
        </div>

        <!-- 新手/练习顶部浮条与手指箭头 -->
        <div id="k-tut-coach"></div>
        <div id="k-tut-finger" class="tut-finger-pointer" aria-hidden="true" style="display:none;">👇</div>

        <!-- 吧台后方：3 位二次元立绘顾客直接站立点单 -->
        <div class="scene-customers">
          ${[0, 1, 2].map(id => `<button type="button" id="k-seat-${id}" class="scene-customer is-empty" data-action="tapSeat" data-id="${id}" aria-label="空座位" disabled></button>`).join('')}
        </div>

        <!-- 吧台沿上的轻盈提示条 -->
        <div id="k-tip" class="scene-tip-pill" role="status" aria-live="polite">${d.serviceMsg}</div>

        <!-- 大理石与橡木实景工作台 -->
        <div class="scene-workbench">
          ${stationsMarkup}
          ${pantryMarkup}

          <!-- 底部左：大理石暂存碟 -->
          <button type="button" id="k-hold" class="scene-prop pos-hold" data-action="tapHold" aria-label="大理石暂存台：空闲" title="暂存台">
            <div class="hold-saucer">
              <div id="k-hold-vis" class="hold-vis-wrap" style="display:none;"></div>
              <span id="k-hold-lbl" class="hold-mini-tag">暂存台</span>
            </div>
          </button>

          <!-- 底部中：可可手中托盘实景状态 -->
          <div class="scene-coco-tray" aria-live="polite">
            <img class="tray-coco-avatar mode-fill" src="assets/images/coco_avatar.png" alt="可可" />
            <div id="k-hands" class="tray-held-slot"></div>
          </div>

          <!-- 底部右：复古回收铜桶 -->
          <button type="button" id="k-trash" class="scene-prop pos-trash" data-action="tapTrash" aria-label="回收铜桶：丢弃手中物品" title="丢弃">
            <img class="prop-sprite sprite-trash mode-fit" src="assets/images/kitchen/prop_copper_bin.png" alt="" />
            <span class="prop-mini-label">回收桶</span>
          </button>
        </div>

        <!-- 暂停蒙层 -->
        <div id="k-pause-mask"></div>
      </div>
    `;
    kitchenMounted = true;
  }

  function patchKitchenDom(d) {
    const timeEl = root.querySelector('#k-time');
    if (timeEl) {
      timeEl.textContent = d.isPractice
        ? '🎓 练习'
        : (d.inTutorial ? `🎓 ${d.shiftTimeLeft}s` : `⏱ ${d.shiftTimeLeft}s`);
    }
    const coinsEl = root.querySelector('#k-coins');
    if (coinsEl) coinsEl.textContent = `🪙 +${d.shiftCoins}`;
    const servedEl = root.querySelector('#k-served');
    if (servedEl) servedEl.textContent = `出餐 ${d.shiftServed} · x${d.shiftCombo}`;
    const tipEl = root.querySelector('#k-tip');
    if (tipEl && tipEl.textContent !== d.serviceMsg) tipEl.textContent = d.serviceMsg;

    const pauseBtn = root.querySelector('#k-pause-btn');
    if (pauseBtn) {
      pauseBtn.textContent = d.isPaused ? '▶' : '⏸';
      pauseBtn.setAttribute('aria-label', d.isPaused ? '继续营业' : '暂停营业');
    }

    // 1. 增量更新前厅 3 位立绘顾客
    (d.seats || []).forEach((s, idx) => {
      const slot = root.querySelector(`#k-seat-${s.id}`);
      if (!slot) return;
      const isGlow = d.highlightTarget === 'seat_' + s.id;
      slot.className = `scene-customer ${s.occupied ? 'is-occupied' : 'is-empty'} ${isGlow ? 'is-scene-glow' : ''}`;
      slot.disabled = !s.occupied;
      slot.setAttribute('aria-label', s.occupied ? `顾客${s.name}：想要${s.wantedName}${isGlow ? '，点击上菜' : ''}` : '空座位');
      const sig = s.occupied ? `1:${s.npcId}:${s.wantedId}:${isGlow ? 1 : 0}` : '0';
      if (seatSigs[idx] !== sig) {
        seatSigs[idx] = sig;
        slot.innerHTML = s.occupied
          ? `<div class="cust-bubble">
               <img class="cust-want-img mode-fit" src="${s.wantedIcon}" alt="" />
               <div class="cust-patience"><div class="cust-patience-fill ${s.patience < 35 ? 'low' : ''}" style="width:${Math.max(0, Math.round(s.patience))}%;"></div></div>
             </div>
             ${isGlow ? '<span class="cust-serve-tag">🍰 点此上菜</span>' : ''}
             <img class="cust-portrait mode-widthfix" src="${s.portrait}" alt="${s.name}" />`
          : '';
      } else if (s.occupied) {
        const fill = slot.querySelector('.cust-patience-fill');
        if (fill) {
          fill.style.width = `${Math.max(0, Math.round(s.patience))}%`;
          fill.classList.toggle('low', s.patience < 35);
        }
      }
    });

    // 2. 增量更新可可手中托盘（明确显示菜名、半成品与“下一步：裱花/装饰/烤炉”）
    const h = d.heldItem;
    const STEP_NAMES = { oven: '下一步：烤炉', cream: '下一步：裱花', decor: '下一步：装饰' };
    const nextStepText = h
      ? (h.isBurnt
        ? '已烤糊 · 点回收桶'
        : (h.isFinished
          ? '成品 · 点顾客上菜'
          : (STEP_NAMES[h.steps[h.stepIndex]] || '加工中')))
      : '';
    const stageSuffix = h && !h.isFinished && !h.isBurnt && h.stepIndex > 0 ? ' (半成品)' : '';
    const nextHandsSig = h ? `${h.recipeId}:${getDishStage(h)}:${h.stepIndex}:${nextStepText}` : 'empty';
    if (handsSig !== nextHandsSig) {
      handsSig = nextHandsSig;
      const handsEl = root.querySelector('#k-hands');
      if (handsEl) {
        handsEl.innerHTML = h
          ? `${renderDishVisualHtml(h, 'sz-tray')}
             <div class="tray-text-col">
               <span class="tray-recipe-name">${getShortRecipeName({ id: h.recipeId, name: h.recipeName })}${stageSuffix}</span>
               <span class="tray-status-dot ${h.isFinished ? 'ready' : ''} ${h.isBurnt ? 'burnt' : ''} ${h.stepIndex > 0 && !h.isFinished && !h.isBurnt ? 'semi' : ''}">${nextStepText}</span>
             </div>`
          : '<span class="tray-empty-txt">空手 · 点原料篮取料</span>';
      }
    }

    // 3. 增量更新 4 个实景工位道具（空闲 / 制作中 / 可取餐 / 快烤糊 / 已烤糊 + 下一步高亮文字）
    const STATION_POS = { oven_1: 'pos-oven-1', oven_2: 'pos-oven-2', cream_1: 'pos-cream', decor_1: 'pos-decor' };
    const NEXT_STATION_HINT = { oven: '👉 下一步：烘烤', cream: '👉 下一步：裱花', decor: '👉 下一步：装饰' };
    (d.stations || []).forEach(st => {
      const cell = root.querySelector(`#k-st-${st.id}`);
      const ov = root.querySelector(`#k-st-ov-${st.id}`);
      if (!cell || !ov) return;
      const isGlow = d.highlightTarget === st.id || d.highlightTarget === st.type;
      const stateClass = st.nearBurn ? 'state-near-burn' : `state-${st.state}`;
      cell.className = `scene-prop ${STATION_POS[st.id] || ''} ${stateClass} ${isGlow ? 'is-scene-glow' : ''}`;

      const stateLabel = st.state === 'idle'
        ? '空闲'
        : (st.state === 'working'
          ? `制作中${st.progress}%`
          : (st.nearBurn ? '快烤糊，立即取餐' : (st.state === 'ready' ? '可取餐' : '已烤糊，点击清渣')));
      cell.setAttribute('aria-label', `${st.shortName} · ${stateLabel}`);

      const sig = st.item
        ? `${st.state}:${st.nearBurn ? 1 : 0}:${st.item.recipeId}:${getDishStage(st.item)}:${st.item.stepIndex}:${isGlow ? 1 : 0}`
        : `idle:${isGlow ? 1 : 0}`;
      if (stationSigs[st.id] !== sig) {
        stationSigs[st.id] = sig;
        if (!st.item) {
          ov.innerHTML = isGlow
            ? `<span class="prop-pill guide-next">${NEXT_STATION_HINT[st.type] || '👉 放这里'}</span>`
            : '<span class="prop-state-tag idle">空闲</span>';
        } else if (st.state === 'working') {
          ov.innerHTML = `
            ${renderDishVisualHtml(st.item, 'sz-station')}
            <div class="prop-prog-track"><div class="prop-prog-fill" style="width:${st.progress}%;"></div></div>
            <span class="prop-state-tag working">制作中 <b class="prog-num">${st.progress}%</b></span>
          `;
        } else if (st.state === 'ready' && st.nearBurn) {
          ov.innerHTML = `
            ${renderDishVisualHtml(st.item, 'sz-station', 'ready-pop')}
            <span class="prop-pill near-burn">🔥 快烤糊!</span>
          `;
        } else if (st.state === 'ready') {
          ov.innerHTML = `
            ${renderDishVisualHtml(st.item, 'sz-station', 'ready-pop')}
            <span class="prop-pill ready">✨ 可取餐</span>
          `;
        } else {
          ov.innerHTML = `
            ${renderDishVisualHtml(st.item, 'sz-station')}
            <span class="prop-pill burnt">💨 已烤糊</span>
          `;
        }
      } else if (st.state === 'working') {
        const fill = ov.querySelector('.prop-prog-fill');
        if (fill) fill.style.width = `${st.progress}%`;
        const num = ov.querySelector('.prog-num');
        if (num) num.textContent = `${st.progress}%`;
      }
    });

    // 4. 更新原料篮发光 + 三枚甜点按钮选中态（严禁位移或遮挡）
    const pantryGlow = d.highlightTarget === 'pantry';
    root.querySelectorAll('.is-pantry-item').forEach(el => {
      el.classList.toggle('is-scene-glow', pantryGlow);
    });
    root.querySelectorAll('.pantry-pick-orb').forEach(orb => {
      const selected = !!(d.heldItem && d.heldItem.recipeId === orb.dataset.id);
      orb.classList.toggle('is-selected', selected);
      orb.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    // 5. 更新暂存台与回收铜桶
    const holdEl = root.querySelector('#k-hold');
    if (holdEl) {
      holdEl.classList.toggle('is-scene-glow', d.highlightTarget === 'hold');
      holdEl.setAttribute('aria-label', d.holdItem ? `暂存台：放着${d.holdItem.recipeName}，点击取回或交换` : '大理石暂存台：空闲');
      const nextHoldSig = d.holdItem ? `${d.holdItem.recipeId}:${getDishStage(d.holdItem)}:${d.holdItem.stepIndex}` : 'empty';
      if (holdSig !== nextHoldSig) {
        holdSig = nextHoldSig;
        const vis = root.querySelector('#k-hold-vis');
        const lbl = root.querySelector('#k-hold-lbl');
        if (d.holdItem && vis) {
          vis.innerHTML = renderDishVisualHtml(d.holdItem, 'sz-hold');
          vis.style.display = 'flex';
          lbl.style.display = 'none';
        } else if (vis) {
          vis.innerHTML = '';
          vis.style.display = 'none';
          lbl.style.display = 'block';
        }
      }
    }

    const trashEl = root.querySelector('#k-trash');
    if (trashEl) trashEl.classList.toggle('is-scene-glow', d.highlightTarget === 'trash');

    // 6. 更新首单教学 / 练习模式顶部浮条与手指箭头
    const coachEl = root.querySelector('#k-tut-coach');
    const fingerEl = root.querySelector('#k-tut-finger');
    if (coachEl && fingerEl) {
      if (d.isPractice) {
        coachEl.innerHTML = `
          <div class="tut-coach-banner practice-banner">
            <span class="tut-coach-text">🎓 练习(不扣天数)</span>
            <div class="practice-banner-btns">
              <button type="button" class="tut-coach-skip" data-action="startRealFromPractice">正式营业</button>
              <button type="button" class="tut-coach-skip alt" data-action="exitPractice">结束</button>
            </div>
          </div>
        `;
        fingerEl.style.display = 'none';
      } else if (d.inTutorial) {
        const GUIDE_POS = {
          pantry:  { x: 50, y: 61, text: '① 点中央【大竹篮】或篮下甜点按钮拿生面糊！' },
          oven_1:  { x: 26, y: 43, text: '② 点发光的【烤炉 1】放入烘烤！' },
          oven_2:  { x: 74, y: 43, text: '② 点发光的【烤炉 2】放入烘烤！' },
          cream_1: { x: 18, y: 62, text: '③ 半成品请点左下【裱花台】继续裱花！' },
          decor_1: { x: 82, y: 62, text: '③ 半成品请点右下【装饰台】撒糖粉！' },
          seat_0:  { x: 18, y: 20, text: '④ 成品啦！点发光的【顾客】上菜收金币！' },
          seat_1:  { x: 50, y: 20, text: '④ 成品啦！点发光的【顾客】上菜收金币！' },
          seat_2:  { x: 82, y: 20, text: '④ 成品啦！点发光的【顾客】上菜收金币！' }
        };
        const working = (d.stations || []).find(s => s.state === 'working');
        const ready = (d.stations || []).find(s => s.state === 'ready');
        let g = GUIDE_POS[d.highlightTarget];
        if (!g && working) g = { x: 26, y: 43, text: '⏳ 正在自动制作中，马上就好！' };
        if (ready && !d.heldItem) {
          const p = GUIDE_POS[ready.id] || { x: 26, y: 43 };
          g = { x: p.x, y: p.y, text: `③ 【${ready.shortName}】可取餐！点击取出` };
        }
        if (g) {
          coachEl.innerHTML = `
            <div class="tut-coach-banner" style="top:52px;">
              <span class="tut-coach-text">🎓 ${g.text}</span>
              <button type="button" class="tut-coach-skip" data-action="skipKitchenTut">跳过</button>
            </div>
          `;
          fingerEl.style.display = working && !ready ? 'none' : 'block';
          fingerEl.style.left = `${g.x}%`;
          fingerEl.style.top = `${g.y}%`;
        }
      } else {
        coachEl.innerHTML = '';
        fingerEl.style.display = 'none';
      }
    }

    // 7. 暂停蒙层（切出页面或点击暂停时显示，打开帮助说明时不重复叠加）
    const nextPauseSig = d.pauseManual && !helpModalOpen ? `1:${d.pauseHidden ? 1 : 0}:${d.isPractice ? 1 : 0}` : '0';
    if (pauseSig !== nextPauseSig) {
      pauseSig = nextPauseSig;
      const maskEl = root.querySelector('#k-pause-mask');
      if (maskEl) {
        maskEl.innerHTML = d.pauseManual && !helpModalOpen
          ? `<div class="pause-mask" role="dialog" aria-modal="true" aria-label="营业已暂停">
               <div class="card pause-card">
                 <div class="pause-title">⏸ ${d.isPractice ? '练习已暂停' : '营业已暂停'}</div>
                 <p class="pause-desc">${d.pauseHidden ? '检测到页面切出，已自动冻结倒计时、顾客耐心与烤炉计时。' : '营业倒计时、顾客耐心与烤炉计时均已冻结，随时可继续。'}</p>
                 <div class="pause-actions">
                   <button type="button" class="btn-primary" data-action="resumeShift">▶ 继续${d.isPractice ? '练习' : '营业'}</button>
                   <button type="button" class="btn-secondary" data-action="openHelp">📖 查看玩法说明</button>
                   <button type="button" class="btn-ghost" data-action="${d.isPractice ? 'exitPractice' : 'endShiftEarly'}">${d.isPractice ? '退出练习（不扣天数）' : '提前打烊结算'}</button>
                 </div>
               </div>
             </div>`
          : '';
      }
    }
  }

  function render() {
    const d = pageProxy.data;

    if (d.isOpen) {
      if (!kitchenMounted) {
        mountKitchenShell(d);
      }
      patchKitchenDom(d);
      return;
    }

    kitchenMounted = false;
    const prevScroll = root.querySelector('.scrollarea')?.scrollTop || 0;

    const statsCardHtml = `
      <div class="card stats-card">
        <div class="stats-top">
          <span class="tier-title">${d.shopTierTitle}</span>
          <span class="day-pill">第 ${d.day} 天</span>
        </div>
        <div class="stats-row">
          <div class="stat-chip"><span class="stat-label">🪙 焦糖金币</span><span class="stat-val">${d.coins}</span></div>
          <div class="stat-chip"><span class="stat-label">⭐ 糖屋口碑</span><span class="stat-val">${d.reputation}</span></div>
        </div>
        <div class="tab-bar" role="tablist">
          <button type="button" role="tab" aria-selected="${d.activeTab === 'counter'}" class="tab-btn ${d.activeTab === 'counter' ? 'active' : ''}" data-action="tab" data-tab="counter">☕ 厨房营业</button>
          <button type="button" role="tab" aria-selected="${d.activeTab === 'upgrades'}" class="tab-btn ${d.activeTab === 'upgrades' ? 'active' : ''}" data-action="tab" data-tab="upgrades">🪵 装潢升级</button>
        </div>
      </div>
    `;

    let mainSectionHtml = '';
    if (d.activeTab === 'counter') {
      mainSectionHtml = `
        <div class="card prep-card">
          <div class="prep-head">
            <span class="prep-title">🥐 今日上架菜单（选 1~3 道）</span>
            <span class="prep-count">已选 ${d.menuRecipes.length} / 3</span>
          </div>
          ${d.unlockedRecipes.length > 0
            ? `<div class="menu-grid">${d.unlockedRecipes.map(r => `
                <button type="button" class="menu-item ${r.selected ? 'is-picked' : ''}" data-action="toggleMenu" data-id="${r.id}" aria-pressed="${r.selected}">
                  <img class="menu-icon mode-fit" src="${r.iconImg}" alt="" />
                  <span class="menu-name">${r.name}</span>
                  <span class="menu-flow">${r.flowText}</span>
                  <span class="menu-price">🪙 ${r.price}</span>
                </button>`).join('')}</div>`
            : '<div class="empty-tip">柜台还没有可售卖的甜点哦！快去完成序章解锁第一道玛德琳吧～</div>'}
          <div class="prep-cta-group">
            <button type="button" class="btn-primary open-btn" data-action="startBusiness">🔔 挂出营业牌 · 进入厨房迎客</button>
            <button type="button" class="btn-secondary practice-btn" data-action="startPractice">🎓 练习引导（不消耗天数）</button>
          </div>
        </div>
      `;
    } else {
      mainSectionHtml = `
        <div class="upgrade-list">
          ${d.upgrades.map(u => `
            <div class="card upgrade-card ${u.owned ? 'is-owned' : ''}">
              <div class="upg-left">
                <div class="upg-icon"><img class="upg-art mode-fit" src="${u.iconImg}" alt="${u.name}" /></div>
                <div class="upg-info">
                  <span class="upg-name">${u.name}</span>
                  <span class="upg-desc">${u.effectDesc}</span>
                </div>
              </div>
              ${u.owned
                ? '<span class="upg-btn owned">已安装</span>'
                : `<button type="button" class="upg-btn ${u.canAfford ? '' : 'disabled'}" data-action="buyUpgrade" data-id="${u.id}">🪙 ${u.cost}</button>`}
            </div>`).join('')}
        </div>
      `;
    }

    const s = d.daySummary;
    const summaryHtml = s
      ? `<div class="summary-mask" data-action="closeSummary" role="dialog" aria-modal="true" aria-label="营业结算">
          <div class="card summary-card" data-stop="true">
            <div class="ribbon-title">${s.isPractice ? '🎓 练习结束 · 不消耗天数' : `🌙 第 ${s.day} 天 · 打烊结算`}</div>
            <div class="summary-rows">
              <div class="sum-row"><span>今日成功出餐</span><span class="sum-val">${s.served} 份</span></div>
              <div class="sum-row"><span>${s.isPractice ? '练习金币（不入账）' : '营业焦糖金币'}</span><span class="sum-val">${s.isPractice ? '0' : `+${s.coins}`} 🪙</span></div>
              <div class="sum-row"><span>${s.isPractice ? '练习口碑（不入账）' : '新增店铺口碑'}</span><span class="sum-val">${s.isPractice ? '0' : `+${s.rep}`} ⭐</span></div>
              <div class="sum-divider"></div>
              <div class="sum-row sub"><span>流失顾客</span><span class="sum-val ${s.lost > 0 ? 'warn' : ''}">${s.lost} 位</span></div>
              <div class="sum-row sub"><span>烤糊次数</span><span class="sum-val ${s.burnt > 0 ? 'warn' : ''}">${s.burnt} 次</span></div>
              <div class="sum-row sub"><span>打烊未交付</span><span class="sum-val ${s.undelivered > 0 ? 'warn' : ''}">${s.undelivered} 份</span></div>
            </div>
            <div class="summary-advice">💡 ${s.advice}</div>
            <button type="button" class="btn-primary summary-close-btn" data-action="closeSummary">${s.isPractice ? '返回营业准备' : '收下营收 · 迎接明天'}</button>
          </div>
        </div>`
      : '';

    root.innerHTML = `
      <div class="scrollarea">
        <div class="caramel-canopy">
          <div class="awning-bar"></div>
          <div class="caramel-drip-edge"></div>
          <div class="canopy-vine-left"><div class="leaf-pill"></div><div class="leaf-pill alt"></div></div>
          <div class="canopy-vine-right"><div class="leaf-pill"></div><div class="leaf-pill alt"></div></div>
        </div>
        <div class="page-wrap shop-wrap">
          ${statsCardHtml}
          ${mainSectionHtml}
        </div>
        ${summaryHtml}
      </div>
    `;

    const sc = root.querySelector('.scrollarea');
    if (sc && prevScroll > 0) sc.scrollTop = prevScroll;
  }

  function launchKitchenShift({ tutorialMode = false, practiceMode = false } = {}) {
    if (kitchen) kitchen.stop();
    kitchenMounted = false;
    helpModalOpen = false;
    const currentDay = pageProxy.data.day;
    kitchen = createKitchenEngine(pageProxy, {
      menuRecipes: pageProxy.data.menuRecipes,
      bonuses,
      tutorialMode,
      practiceMode,
      onTutorialDone: () => {
        markTutorialSeen('kitchen');
        showToast('🎉 营业上手啦！正式开张 45 秒！', 1600);
      },
      onServeEffect: ({ seatId, earned }) => {
        const scene = root.querySelector('.kitchen-scene');
        const xMap = [18, 50, 82];
        spawnFloatText(scene, {
          xPct: xMap[seatId] || 50,
          yPct: 22,
          text: practiceMode ? '🎓 出餐成功!' : `+${earned} 🪙 💗`,
          kind: 'gold'
        });
      },
      onShiftEnd: ({ earnedCoins, earnedRep, servedCount, lostCustomers, burntCount, undeliveredCount, isPractice }) => {
        if (!isPractice) {
          recordBusinessDay({ earnedCoins, earnedRep });
        }
        const advice = buildSummaryAdvice({
          served: servedCount,
          lost: lostCustomers,
          burnt: burntCount,
          undelivered: undeliveredCount,
          isPractice
        });
        pageProxy.setData({
          isOpen: false,
          isPractice: false,
          isPaused: false,
          pauseManual: false,
          daySummary: {
            day: currentDay,
            served: servedCount,
            coins: isPractice ? 0 : earnedCoins,
            rep: isPractice ? 0 : earnedRep,
            lost: lostCustomers,
            burnt: burntCount,
            undelivered: undeliveredCount,
            isPractice,
            advice
          }
        }, () => refreshShop());
      }
    });
    kitchen.start();
  }

  function showHelpModal(isFirstTime) {
    let slot = root.querySelector('#k-help-modal');
    if (!slot) {
      slot = document.createElement('div');
      slot.id = 'k-help-modal';
      root.appendChild(slot);
    }
    helpModalOpen = true;
    if (!isFirstTime && kitchen) kitchen.pause('help');
    slot.innerHTML = createTutorialCardHtml('kitchen', { isFirstTime });
    if (pageProxy.data.isOpen) patchKitchenDom(pageProxy.data);
  }

  function closeHelpModal() {
    helpModalOpen = false;
    const slot = root.querySelector('#k-help-modal');
    if (slot) slot.innerHTML = '';
    if (pageProxy.data.isOpen && kitchen) {
      kitchen.resume('help');
      patchKitchenDom(pageProxy.data);
    }
  }

  const onVisibilityChange = () => {
    if (document.hidden && pageProxy.data.isOpen && kitchen && !pageProxy.data.isPaused) {
      kitchen.pause('hidden');
    }
  };

  const onClick = (e) => {
    const tutTarget = e.target.closest('[data-tut-action]');
    if (tutTarget) {
      const ta = tutTarget.dataset.tutAction;
      if (ta === 'start') {
        const wasOpen = pageProxy.data.isOpen;
        closeHelpModal();
        if (!wasOpen) launchKitchenShift({ tutorialMode: true, practiceMode: false });
      } else if (ta === 'skip') {
        markTutorialSeen('kitchen');
        closeHelpModal();
        launchKitchenShift({ tutorialMode: false, practiceMode: false });
      } else if (ta === 'backdrop' && pageProxy.data.isOpen) {
        closeHelpModal();
      }
      return;
    }

    const target = e.target.closest('[data-action], [data-stop]');
    if (!target || !target.dataset.action) return;
    const action = target.dataset.action;

    if (action === 'openHelp') {
      showHelpModal(false);
    } else if (action === 'togglePause') {
      if (!kitchen) return;
      if (pageProxy.data.pauseManual) kitchen.resumeAll();
      else kitchen.pause('manual');
    } else if (action === 'resumeShift') {
      kitchen?.resumeAll();
    } else if (action === 'endShiftEarly') {
      kitchen?.finishShift();
    } else if (action === 'exitPractice') {
      kitchen?.finishShift();
    } else if (action === 'startRealFromPractice') {
      launchKitchenShift({ tutorialMode: false, practiceMode: false });
    } else if (action === 'skipKitchenTut') {
      kitchen?.skipTutorial();
    } else if (action === 'tab') {
      if (pageProxy.data.isOpen) { showToast('厨房正在营业中，打烊后再看装潢哦！'); return; }
      pageProxy.setData({ activeTab: target.dataset.tab });
    } else if (action === 'toggleMenu') {
      if (pageProxy.data.isOpen) return;
      const id = target.dataset.id;
      let ids = pageProxy.data.menuRecipes.map(r => r.id);
      if (ids.includes(id)) {
        if (ids.length <= 1) { showToast('至少保留 1 道上架甜点哦'); return; }
        ids = ids.filter(x => x !== id);
      } else {
        if (ids.length >= 3) { showToast('今日菜单最多同时上架 3 道甜点'); return; }
        ids.push(id);
      }
      saveMenuRecipeIds(ids);
      refreshShop();
    } else if (action === 'startBusiness') {
      if (pageProxy.data.menuRecipes.length === 0) {
        showToast('请先通过序章解锁玛德琳再开门营业！');
        return;
      }
      if (!hasSeenTutorial('kitchen')) {
        showHelpModal(true);
      } else {
        launchKitchenShift({ tutorialMode: false, practiceMode: false });
      }
    } else if (action === 'startPractice') {
      if (pageProxy.data.menuRecipes.length === 0) {
        showToast('请先通过序章解锁玛德琳再进入练习！');
        return;
      }
      launchKitchenShift({ tutorialMode: false, practiceMode: true });
    } else if (action === 'pickSmartRaw') {
      const before = pageProxy.data.heldItem;
      const waitingSeat = (pageProxy.data.seats || []).find(s => s.occupied);
      const targetId = (waitingSeat && waitingSeat.wantedId) || (pageProxy.data.menuRecipes[0] && pageProxy.data.menuRecipes[0].id);
      if (targetId) kitchen?.pickRaw(targetId);
      if (!before && pageProxy.data.heldItem) {
        spawnFloatText(root.querySelector('.kitchen-scene'), { xPct: 50, yPct: 64, text: `🥣 ${getShortRecipeName({ id: pageProxy.data.heldItem.recipeId, name: pageProxy.data.heldItem.recipeName })}`, kind: 'cream' });
      }
    } else if (action === 'pickRaw') {
      const before = pageProxy.data.heldItem;
      kitchen?.pickRaw(target.dataset.id);
      if (!before && pageProxy.data.heldItem) {
        spawnFloatText(root.querySelector('.kitchen-scene'), { xPct: 50, yPct: 64, text: `🥣 ${getShortRecipeName({ id: pageProxy.data.heldItem.recipeId, name: pageProxy.data.heldItem.recipeName })}`, kind: 'cream' });
      }
    } else if (action === 'tapStation') {
      kitchen?.tapStation(target.dataset.id);
    } else if (action === 'tapHold') kitchen?.tapHold();
    else if (action === 'tapTrash') kitchen?.tapTrash();
    else if (action === 'tapSeat') kitchen?.tapSeat(Number(target.dataset.id));
    else if (action === 'closeSummary') pageProxy.setData({ daySummary: null });
    else if (action === 'buyUpgrade') {
      const upg = SHOP_UPGRADES.find(u => u.id === target.dataset.id);
      if (!upg) return;
      const res = buyShopUpgrade(upg.id, upg.cost);
      if (res.ok) {
        showToast(`购入【${upg.name}】！`);
        refreshShop();
      } else if (res.reason === 'insufficient_coins') {
        showToast('焦糖金币不足，多开店营业赚金币吧！');
      }
    }
  };

  root.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', onVisibilityChange);
  refreshShop();
  return () => {
    destroyed = true;
    kitchen?.stop?.();
    root.removeEventListener('click', onClick);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
