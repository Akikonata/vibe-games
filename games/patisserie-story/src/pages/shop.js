// src/pages/shop.js
// 星月糖屋 2.5D 三分区经营系统：餐区入座招待 + 玻璃展示柜预置库存 + 后厨大理石台双烤炉批量补烤 + 婉拒空位（扣口碑）

import { RECIPES } from '../data/recipes.js';
import { SHOP_UPGRADES, computeShopBonuses } from '../data/shop_upgrades.js';
import { getKitchenFlow, getUnitCost } from '../data/kitchen_recipes.js?v=20261126p';
import { createKitchenEngine } from '../engines/kitchen_engine.js?v=20261126p';
import {
  loadProgress,
  getShopTierTitle,
  recordBusinessDay,
  buyShopUpgrade,
  saveMenuRecipeIds,
  hasSeenTutorial,
  markTutorialSeen
} from '../utils/store.js?v=20261126p';
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

function buildSummaryAdvice({ served, lost, declined, burnt, burntCost = 0, netCoins = 0, batchesBaked, isPractice }) {
  if (isPractice) {
    if (served > 0) return '已经掌握「展示柜取餐上桌 + 结账清台 + 控制成本批量补烤」节奏啦！可以正式挂牌开张赚净利。';
    return '练习模式随时可重玩：开店备货和每次补烤都会计入原料成本，记得按需补烤、避免烤糊浪费！';
  }
  if (served === 0) {
    if (burnt > 0) return `本轮烤糊浪费了 ${burntCost} 金币原料！看到「✨ 收获入柜」或「🔥 快烤糊」时记得及时收获。`;
    if (lost > 0) return '开店自带预置库存！直接点中间展示柜取餐送去餐桌，卖完再按需补烤就能快速回本赚净利。';
    return '先点「练习引导（不消耗天数）」熟悉取餐、结账清台与按需批量补烤，避免白花原料成本！';
  }
  if (netCoins < 0) {
    return `本轮原料投入高于营业收入（净利 ${netCoins} 🪙）：打烊前 5 秒尽量不要新开烤炉，减少剩余库存与烤糊损耗。`;
  }
  if (burnt > 0) {
    return `已实现盈利！不过烤糊浪费了 ${burntCost} 金币原料，及时收获能把净利率再拉高一截。`;
  }
  if (declined >= 2) {
    return '本轮婉拒次数较多扣了一些口碑：在库存剩 1 份（告急）时提前补烤，既不断货也不浪费原料。';
  }
  return '成本控制与翻台节奏都很稳健！升级展示柜提高售价后，单份毛利还会进一步扩大！';
}

export function mountShopPage(root, _params, { navigate } = {}) {
  let kitchen = null;
  let bonuses = null;
  let destroyed = false;
  let kitchenMounted = false;
  let helpModalOpen = false;

  let seatSigs = ['', '', ''];
  let displaySigs = {};
  let ovenSigs = {};
  let handsSig = '';
  let pauseSig = '';

  // 2.5D 可可多段寻路走位状态（跨区必须经由右侧柜台小门进出，绝不穿墙/穿玻璃柜！）
  let cocoPos = { x: 50, y: 69, facing: 1 };
  let cocoWalkTimer = null;
  let cocoPathRunId = 0;

  const GATE_SOUTH = { x: 87.5, y: 64 };
  const GATE_NORTH = { x: 87.5, y: 40 };

  const COCO_WAYPOINTS = {
    seat_0: { x: 24, y: 38 },
    seat_1: { x: 50, y: 38 },
    seat_2: { x: 74, y: 38 },
    disp_0: { x: 21, y: 63 },
    disp_1: { x: 44, y: 63 },
    disp_2: { x: 67, y: 63 },
    oven_1: { x: 24, y: 74 },
    oven_2: { x: 76, y: 74 },
    batch:  { x: 50, y: 74 }
  };

  function spawnStepBurst(container, xPct, yPct, emoji, kind = 'spark') {
    if (!container) return;
    const el = document.createElement('div');
    el.className = `k25d-fx fx-${kind}`;
    el.style.left = `${xPct}%`;
    el.style.top = `${yPct}%`;
    el.textContent = emoji;
    container.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  function moveCocoTo(targetKey, burstEmoji = '') {
    const wp = COCO_WAYPOINTS[targetKey];
    const actor = root.querySelector('#k-coco-actor');
    const scene = root.querySelector('.kitchen-scene');
    if (!wp || !actor) return;

    // 取消上一段未走完的路径，从当前视觉坐标无缝起新路径
    cocoPathRunId += 1;
    const runId = cocoPathRunId;
    clearTimeout(cocoWalkTimer);

    const currDining = cocoPos.y < 52;
    const destDining = wp.y < 52;
    const queue = [];

    if (!currDining && destDining) {
      // 后厨 -> 餐区：先走到右侧门南口 -> 穿过右侧柜台门 -> 走到目标餐桌
      queue.push(GATE_SOUTH, GATE_NORTH, wp);
    } else if (currDining && !destDining) {
      // 餐区 -> 后厨：先走到右侧门北口 -> 穿回右侧柜台门 -> 走到展示柜或烤炉
      queue.push(GATE_NORTH, GATE_SOUTH, wp);
    } else {
      queue.push(wp);
    }

    function stepNext(idx) {
      if (runId !== cocoPathRunId || destroyed) return;
      if (idx >= queue.length) {
        actor.classList.remove('is-walking');
        if (burstEmoji && scene) {
          spawnStepBurst(scene, cocoPos.x, cocoPos.y - 5, burstEmoji, 'spark');
        }
        return;
      }

      const next = queue[idx];
      const dx = next.x - cocoPos.x;
      const dy = next.y - cocoPos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        stepNext(idx + 1);
        return;
      }

      if (Math.abs(dx) > 1.2) cocoPos.facing = dx < 0 ? -1 : 1;
      const prevX = cocoPos.x;
      const prevY = cocoPos.y;
      cocoPos.x = next.x;
      cocoPos.y = next.y;

      const segMs = Math.max(260, Math.min(780, Math.round(dist * 14)));
      // 真实 2.5D Y轴深度排序：在餐区(y<52)时走在展示柜(z:14)后面，回到后厨(y>=52)时走在展示柜前面！
      actor.style.zIndex = next.y < 52 ? '11' : '18';
      actor.style.transitionDuration = `${segMs}ms`;
      actor.style.left = `${next.x}%`;
      actor.style.top = `${next.y}%`;
      actor.classList.toggle('face-left', cocoPos.facing < 0);
      actor.classList.add('is-walking');
      if (idx === 0) spawnStepBurst(scene, prevX, prevY + 3, '💨', 'dust');

      cocoWalkTimer = setTimeout(() => stepNext(idx + 1), segMs);
    }

    stepNext(0);
  }

  function pulseProp(selector) {
    const el = root.querySelector(selector);
    if (!el) return;
    el.classList.remove('anim-bump');
    void el.offsetWidth;
    el.classList.add('anim-bump');
    setTimeout(() => el.classList.remove('anim-bump'), 320);
  }

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
      displayStock: [],
      ovens: [],
      heldItem: null,
      inTutorial: false,
      highlightTarget: '',
      serviceMsg: '挑选 1~3 道招牌甜点，挂牌开门进入糖屋营业！',
      daySummary: null,
      upgrades: [],
      purchasedUpgradeIds: []
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
        const rankMult = RANK_PRICE_MULT[rank] || 1;
        const price = Math.round(flow.basePrice * rankMult * bonuses.priceMult);
        const unitCost = getUnitCost(r.id);
        const unitProfit = price - unitCost;
        const stepCount = flow.steps.length;
        const batchInfo = stepCount >= 3 ? `补烤5.2s/+2 · 料${unitCost * 2}` : (stepCount === 2 ? `补烤4.4s/+3 · 料${unitCost * 3}` : `补烤3.6s/+3 · 料${unitCost * 3}`);
        const priceBreakdown = `成本${unitCost} · 净利+${unitProfit}`;
        return { ...r, price, unitCost, unitProfit, basePrice: flow.basePrice, batchInfo, priceBreakdown, flowText: flow.flowText, selected: progress.menuRecipeIds.includes(r.id) };
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
      upgrades,
      purchasedUpgradeIds: progress.purchasedUpgradeIds || []
    });
  }

  function mountKitchenShell(d) {
    seatSigs = ['', '', ''];
    displaySigs = {};
    ovenSigs = {};
    handsSig = '';
    pauseSig = '';

    const displayMarkup = (d.displayStock || []).map((slot, idx) => `
      <button type="button" id="k-disp-${slot.recipeId}" class="display-bay-btn" data-action="tapDisplay" data-id="${slot.recipeId}" data-idx="${idx}" aria-label="${slot.name}，当前库存 ${slot.stock} 份">
        <div class="display-cake-stand">
          <img class="display-cake-img mode-fit" src="${slot.iconImg}" alt="" />
        </div>
        <span class="display-bay-name">${getShortRecipeName({ id: slot.recipeId, name: slot.name })}</span>
        <span id="k-disp-qty-${slot.recipeId}" class="display-qty-pill">×${slot.stock}</span>
      </button>
    `).join('');

    const batchBtnsMarkup = (d.displayStock || []).map(slot => `
      <button type="button" id="k-batch-${slot.recipeId}" class="batch-bake-btn" data-action="startBatch" data-id="${slot.recipeId}" aria-label="批量烤制${slot.name} +${slot.batchSize}份，原料成本 ${slot.batchCost} 金币">
        <img class="batch-btn-img mode-fit" src="${slot.iconImg}" alt="" />
        <span class="batch-btn-txt">${getShortRecipeName({ id: slot.recipeId, name: slot.name })} <b>+${slot.batchSize}</b> <small style="color:#8C5830;">-${slot.batchCost}🪙</small></span>
      </button>
    `).join('');

    const ovensMarkup = (d.ovens || []).map((o, idx) => `
      <button type="button" id="k-oven-${o.id}" class="bench-oven-btn ${idx === 0 ? 'pos-bench-left' : 'pos-bench-right'} state-idle" data-action="tapOven" data-id="${o.id}" aria-label="${o.shortName} · 空闲">
        <img class="prop-sprite sprite-bench-oven mode-fit" src="assets/images/kitchen/prop_oven.png" alt="" />
        <div id="k-oven-ov-${o.id}" class="prop-overlay"></div>
        <span class="prop-name-tag">${o.shortName}</span>
      </button>
    `).join('');

    const ownedUpgs = d.purchasedUpgradeIds || [];
    const hasUpg = (id) => ownedUpgs.includes(id);
    const upgClasses = ownedUpgs.map(id => `has-upg-${id}`).join(' ');

    const sceneUpgradesMarkup = `
      ${hasUpg('crystal_lamp') ? `
        <div class="scene-upg-chandelier" aria-hidden="true">
          <div class="chandelier-warm-wash"></div>
          <img class="scene-upg-img mode-fit" src="assets/images/upgrades/prop_upg_chandelier.png" alt="" />
        </div>
      ` : ''}
      ${hasUpg('herb_boxes') ? `
        <img class="scene-upg-herb left mode-fit" src="assets/images/upgrades/prop_upg_herb_box.png" alt="" aria-hidden="true" />
        <img class="scene-upg-herb right mode-fit" src="assets/images/upgrades/prop_upg_herb_box.png" alt="" aria-hidden="true" />
      ` : ''}
      ${hasUpg('porcelain_gift') ? `
        <img class="scene-upg-gift mode-fit" src="assets/images/upgrades/prop_upg_giftbox.png" alt="" aria-hidden="true" />
      ` : ''}
      ${hasUpg('oak_counter') ? `
        <div class="scene-upg-oak-plaque" aria-hidden="true">✦ 法式橡木御制展示柜 ✦</div>
      ` : ''}
      ${hasUpg('brass_espresso') ? `
        <div class="scene-upg-espresso" aria-hidden="true">
          <span class="espresso-steam">☕</span>
          <img class="scene-upg-img mode-fit" src="assets/images/upgrades/prop_upg_espresso.png" alt="" />
        </div>
      ` : ''}
    `;

    root.innerHTML = `
      <div class="kitchen-scene is-zoned-25d ${upgClasses}">
        <img class="kitchen-scene-bg mode-fill" src="assets/images/kitchen/patisserie_25d_zones.jpg?v=3" alt="" />
        ${sceneUpgradesMarkup}

        <!-- 顶部悬浮半透明营收 HUD -->
        <div class="scene-hud">
          <span id="k-time" class="hud-time">${d.isPractice ? '🎓 练习' : `⏱ ${d.shiftTimeLeft}s`}</span>
          <span id="k-coins" class="hud-coins">🪙 +${d.shiftCoins}</span>
          <span id="k-served" class="hud-served">出餐 ${d.shiftServed} · x${d.shiftCombo}</span>
          <div class="hud-actions">
            <button type="button" id="k-pause-btn" class="hud-icon-btn" data-action="togglePause" aria-label="暂停营业" title="暂停 / 继续">⏸</button>
            <button type="button" class="hud-icon-btn" data-action="openHelp" aria-label="玩法说明" title="玩法说明">?</button>
          </div>
        </div>

        <div id="k-tut-coach"></div>

        <!-- 区域 1：上部阳光餐区（每桌单椅宽间距，彻底告别相邻椅子重叠） -->
        <div class="zone-dining" aria-label="餐区">
          ${[0, 1, 2].map(id => `
            <div id="k-seat-wrap-${id}" class="dining-table-slot">
              <img class="furn-chair-left mode-fit" src="assets/images/kitchen/prop_cafe_chair.png" alt="" aria-hidden="true" />
              <img class="furn-table-center mode-fit" src="assets/images/kitchen/prop_cafe_table.png" alt="" aria-hidden="true" />
              <button type="button" id="k-seat-${id}" class="dining-seat-btn is-empty" data-action="tapSeat" data-id="${id}" aria-label="空餐桌" disabled></button>
              <button type="button" id="k-decline-${id}" class="cust-decline-btn" data-action="declineSeat" data-id="${id}" aria-label="婉拒顾客空出餐桌" title="不接待（空出餐桌，口碑-5）" style="display:none;">✕ 婉拒</button>
            </div>
          `).join('')}
        </div>

        <!-- 独立拆分的前景柜台层（z:14，与背景同尺寸 mode-fill 严丝合缝），实现可可跨区真实前后遮挡！ -->
        <img class="counter-25d-fg mode-fill" src="assets/images/kitchen/prop_display_counter_fg.png?v=2" alt="" aria-hidden="true" />

        <!-- 区域 2：中腰玻璃甜点展示柜（预置库存 + 告急/售罄预警，直接摆在玻璃柜内） -->
        <div class="zone-display-case" role="group" aria-label="玻璃甜点展示柜库存">
          ${displayMarkup}
        </div>

        <!-- 吧台木板沿上的单行实时提示 -->
        <div id="k-tip" class="zoned-tip-pill" role="status" aria-live="polite">${d.serviceMsg}</div>

        <!-- 2.5D Q版可可主厨（直挂场景根层，按 Y 坐标动态切换 z-index：餐区 z:11 在柜台后，后厨 z:18 在柜台前） -->
        <div id="k-coco-actor" class="coco-25d-actor" style="left:50%;top:69%;z-index:18;" aria-hidden="true">
          <div class="coco-25d-shadow"></div>
          <div class="coco-25d-sprite-sheet"></div>
          <div id="k-coco-carry" class="coco-25d-carry"></div>
        </div>

        <!-- 区域 3：后厨大理石烘焙台面 + 最底部手持条 -->
        <div class="zone-kitchen-floor">
          <!-- 底部大理石操作台面上的双批量烤炉 + 指定补烤选单 -->
          <div class="zone-marble-bench" aria-label="后厨烘焙大理石台">
            ${ovensMarkup}
            <div class="bench-batch-center" role="group" aria-label="后厨批量补烤甜点">
              <span class="bench-batch-title">🔥 批量补烤</span>
              <div class="bench-batch-list">${batchBtnsMarkup}</div>
            </div>
          </div>

          <!-- 最底部可可手持状态条 -->
          <div class="zoned-coco-bar" aria-live="polite">
            <img class="tray-coco-avatar mode-fill" src="assets/images/coco_avatar.png" alt="可可" />
            <div id="k-hands" class="tray-held-slot"></div>
          </div>
        </div>

        <div id="k-pause-mask"></div>
      </div>
    `;
    cocoPos = { x: 50, y: 69, facing: 1 };
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
    if (coinsEl) {
      coinsEl.textContent = `净利 ${d.shiftCoins >= 0 ? '+' : ''}${d.shiftCoins}`;
      coinsEl.style.color = d.shiftCoins < 0 ? '#FFB4A2' : '#FFD966';
    }
    const servedEl = root.querySelector('#k-served');
    if (servedEl) servedEl.textContent = `出餐 ${d.shiftServed} · x${d.shiftCombo}`;
    const tipEl = root.querySelector('#k-tip');
    if (tipEl && tipEl.textContent !== d.serviceMsg) tipEl.textContent = d.serviceMsg;

    const pauseBtn = root.querySelector('#k-pause-btn');
    if (pauseBtn) {
      pauseBtn.textContent = d.isPaused ? '▶' : '⏸';
      pauseBtn.setAttribute('aria-label', d.isPaused ? '继续营业' : '暂停营业');
    }

    // 1. 增量更新餐区 3 张圆桌（5 态：空桌 / Q版入座点单 / 桌旁吃东西动画 / 举手结账收小费 / 残渣餐盘清台）
    (d.seats || []).forEach((s, idx) => {
      const slot = root.querySelector(`#k-seat-${s.id}`);
      const decBtn = root.querySelector(`#k-decline-${s.id}`);
      if (!slot) return;
      const st = s.status || 'empty';
      const isGlow = d.highlightTarget === 'seat_' + s.id;
      const stockEntry = st === 'ordering' ? (d.displayStock || []).find(x => x.recipeId === s.wantedId) : null;
      const isOutOfStock = !!(stockEntry && stockEntry.stock <= 0);

      slot.className = `dining-seat-btn st-${st} ${isGlow ? 'is-scene-glow' : ''}`;
      slot.disabled = st === 'empty';

      const ariaDesc = st === 'ordering'
        ? `餐桌${s.id + 1} ${s.name}：想要${s.wantedName}${isOutOfStock ? '（库存不足）' : ''}${isGlow ? '，点击上菜' : ''}`
        : (st === 'eating'
          ? `餐桌${s.id + 1} ${s.name}正在享用${s.wantedName}`
          : (st === 'bill'
            ? `餐桌${s.id + 1} ${s.name}用完餐待结账，点击收款与小费`
            : (st === 'dirty'
              ? `餐桌${s.id + 1} 有残渣餐盘，点击清台`
              : `空餐桌${s.id + 1}`)));
      slot.setAttribute('aria-label', ariaDesc);

      if (decBtn) {
        decBtn.style.display = st === 'ordering' ? 'inline-flex' : 'none';
        decBtn.setAttribute('aria-label', st === 'ordering' ? `不接待${s.name}（空出餐桌，口碑-5）` : '空餐桌');
      }

      const sig = `${st}:${s.npcId || ''}:${s.wantedId || ''}:${isGlow ? 1 : 0}:${isOutOfStock ? 1 : 0}`;
      if (seatSigs[idx] !== sig) {
        seatSigs[idx] = sig;
        if (st === 'empty') {
          slot.innerHTML = '';
        } else if (st === 'ordering') {
          slot.innerHTML = `
            <div class="dining-order-bubble ${isOutOfStock ? 'is-soldout' : ''}">
              <img class="cust-want-img mode-fit" src="${s.wantedIcon}" alt="" />
              <div class="cust-patience"><div class="cust-patience-fill ${s.patience < 35 ? 'low' : ''}" style="width:${Math.max(0, Math.round(s.patience))}%;"></div></div>
              ${isOutOfStock ? '<span class="order-oos-tag">缺货</span>' : ''}
            </div>
            ${isGlow ? '<span class="cust-serve-tag">🍰 端上桌</span>' : ''}
            <img class="dining-chibi-guest mode-fit" src="${s.chibiImg}?v=2" alt="${s.name}" />
          `;
        } else if (st === 'eating') {
          slot.innerHTML = `
            <div class="eating-fx-float"><span>😋</span><span>💗</span></div>
            <div class="eating-prog-pill"><div class="eating-prog-fill" style="width:${s.eatProgress || 10}%;"></div></div>
            <img class="dining-chibi-guest is-eating mode-fit" src="${s.chibiImg}?v=2" alt="${s.name}" />
            <img class="table-served-dish mode-fit" src="${s.wantedIcon}" alt="" />
          `;
        } else if (st === 'bill') {
          slot.innerHTML = `
            <span class="bill-ready-pill">🪙 结账 +小费</span>
            <img class="dining-chibi-guest mode-fit" src="${s.chibiImg}?v=2" alt="${s.name}" />
            <img class="table-dirty-plate mode-fit" src="assets/images/kitchen/prop_dirty_plate.png" alt="餐盘" />
          `;
        } else if (st === 'dirty') {
          slot.innerHTML = `
            <span class="clean-table-pill">🧹 点此清台</span>
            <img class="table-dirty-plate is-dirty-wait mode-fit" src="assets/images/kitchen/prop_dirty_plate.png" alt="残渣餐盘" />
          `;
        }
      } else if (st === 'ordering') {
        const fill = slot.querySelector('.cust-patience-fill');
        if (fill) {
          fill.style.width = `${Math.max(0, Math.round(s.patience))}%`;
          fill.classList.toggle('low', s.patience < 35);
        }
      } else if (st === 'eating') {
        const eFill = slot.querySelector('.eating-prog-fill');
        if (eFill) eFill.style.width = `${s.eatProgress || 10}%`;
      }
    });

    // 2. 增量更新中腰玻璃展示柜库存（充足 / 告急 <=1 / 售罄 0）+ 下方批量补烤按钮紧急高亮
    (d.displayStock || []).forEach(slot => {
      const btn = root.querySelector(`#k-disp-${slot.recipeId}`);
      const qtyEl = root.querySelector(`#k-disp-qty-${slot.recipeId}`);
      const batchBtn = root.querySelector(`#k-batch-${slot.recipeId}`);
      if (!btn || !qtyEl) return;

      const isGlow = d.highlightTarget === `disp_${slot.recipeId}`;
      const isSelected = !!(d.heldItem && d.heldItem.recipeId === slot.recipeId);
      const stockClass = slot.stock <= 0 ? 'stock-empty' : (slot.stock <= 1 ? 'stock-low' : 'stock-ok');

      btn.className = `display-bay-btn ${stockClass} ${isGlow ? 'is-scene-glow' : ''} ${isSelected ? 'is-selected' : ''}`;
      btn.setAttribute('aria-label', `${slot.name}，展示柜库存 ${slot.stock}/${slot.maxStock}${slot.stock <= 0 ? '，售罄请去烤炉批量烤制' : ''}`);

      const nextSig = `${slot.stock}:${stockClass}`;
      if (displaySigs[slot.recipeId] !== nextSig) {
        displaySigs[slot.recipeId] = nextSig;
        qtyEl.textContent = slot.stock <= 0 ? '🔥 售罄' : (slot.stock === 1 ? '⚠️ 余1' : `×${slot.stock}`);
        qtyEl.className = `display-qty-pill ${stockClass}`;
      }

      if (batchBtn) {
        batchBtn.classList.toggle('is-urgent', slot.stock <= 1);
      }
    });

    // 3. 增量更新后厨大理石台上的双批量烤炉（空闲 / 批量制作中 / 整盘可收获 / 快烤糊 / 已烤糊）
    (d.ovens || []).forEach((o, idx) => {
      const cell = root.querySelector(`#k-oven-${o.id}`);
      const ov = root.querySelector(`#k-oven-ov-${o.id}`);
      if (!cell || !ov) return;
      const isGlow = d.highlightTarget === o.id;
      const stateClass = o.nearBurn ? 'state-near-burn' : `state-${o.state}`;
      cell.className = `bench-oven-btn ${idx === 0 ? 'pos-bench-left' : 'pos-bench-right'} ${stateClass} ${isGlow ? 'is-scene-glow' : ''}`;

      const stateLabel = o.state === 'idle'
        ? '空闲，点击智能批量补烤'
        : (o.state === 'working'
          ? `批量烤制${o.recipeName}×${o.batchSize}，${o.progress}%`
          : (o.nearBurn ? `快烤糊，点击收获+${o.batchSize}` : (o.state === 'ready' ? `烤好，点击收获+${o.batchSize}入柜` : '已烤糊，点击清渣')));
      cell.setAttribute('aria-label', `${o.shortName} · ${stateLabel}`);

      const sig = `${o.state}:${o.nearBurn ? 1 : 0}:${o.recipeId || ''}:${isGlow ? 1 : 0}`;
      if (ovenSigs[o.id] !== sig) {
        ovenSigs[o.id] = sig;
        if (o.state === 'idle') {
          ov.innerHTML = isGlow
            ? '<span class="prop-pill guide-next">🔥 点此补烤</span>'
            : '<span class="prop-state-tag idle">空闲·可补烤</span>';
        } else if (o.state === 'working') {
          ov.innerHTML = `
            <div class="st-anim-steam"><span>♨️</span><span>✨</span></div>
            <img class="oven-batch-img mode-fit" src="${o.recipeIcon}" alt="" />
            <div class="prop-prog-track"><div class="prop-prog-fill" style="width:${o.progress}%;"></div></div>
            <span class="prop-state-tag working">×${o.batchSize} <b class="prog-num">${o.progress}%</b></span>
          `;
        } else if (o.state === 'ready' && o.nearBurn) {
          ov.innerHTML = `
            <div class="st-anim-smoke warn"><span>💨</span><span>🔥</span></div>
            <img class="oven-batch-img ready-pop mode-fit" src="${o.recipeIcon}" alt="" />
            <span class="prop-pill near-burn">🔥 快糊·收+${o.batchSize}</span>
          `;
        } else if (o.state === 'ready') {
          ov.innerHTML = `
            <img class="oven-batch-img ready-pop mode-fit" src="${o.recipeIcon}" alt="" />
            <span class="prop-pill ready">✨ 收获 +${o.batchSize}</span>
          `;
        } else {
          ov.innerHTML = `
            <div class="st-anim-smoke burnt"><span>💨</span><span>💨</span></div>
            <img class="oven-batch-img burnt-tint mode-fit" src="${o.recipeIcon}" alt="" />
            <span class="prop-pill burnt">💨 糊了·点清</span>
          `;
        }
      } else if (o.state === 'working') {
        const fill = ov.querySelector('.prop-prog-fill');
        if (fill) fill.style.width = `${o.progress}%`;
        const num = ov.querySelector('.prog-num');
        if (num) num.textContent = `${o.progress}%`;
      }
    });

    // 4. 更新可可手中成品状态 + 2.5D 可可端盘视觉
    const h = d.heldItem;
    const nextHandsSig = h ? `${h.recipeId}:${h.recipeIcon}` : 'empty';
    if (handsSig !== nextHandsSig) {
      handsSig = nextHandsSig;
      const handsEl = root.querySelector('#k-hands');
      const carryEl = root.querySelector('#k-coco-carry');
      if (handsEl) {
        handsEl.innerHTML = h
          ? `<img class="tray-food-img mode-fit" src="${h.recipeIcon}" alt="" />
             <div class="tray-text-col">
               <span class="tray-recipe-name">${getShortRecipeName({ id: h.recipeId, name: h.recipeName })}</span>
               <span class="tray-status-dot ready">✨ 点对应餐桌上菜</span>
             </div>`
          : '<span class="tray-empty-txt">空手 · 点玻璃展示柜取餐</span>';
      }
      if (carryEl) {
        carryEl.innerHTML = h
          ? `<div class="dish-vis is-ready sz-carry"><img class="dish-main-img mode-fit" src="${h.recipeIcon}" alt="" /></div>`
          : '';
      }
    }

    // 5. 练习模式 / 教学顶部横幅
    const coachEl = root.querySelector('#k-tut-coach');
    if (coachEl) {
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
      } else if (d.inTutorial) {
        const tutMsg = d.heldItem
          ? '② 点上方餐桌旁的发光顾客，端上甜点收金币！'
          : '① 展示柜已预置库存！点中间玻璃展示柜取一份甜点！';
        coachEl.innerHTML = `
          <div class="tut-coach-banner practice-banner">
            <span class="tut-coach-text">🎓 ${tutMsg}</span>
            <button type="button" class="tut-coach-skip" data-action="skipKitchenTut">跳过</button>
          </div>
        `;
      } else {
        coachEl.innerHTML = '';
      }
    }

    // 6. 暂停蒙层
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

    const openingPrepCost = d.menuRecipes.reduce(
      (sum, r) => sum + (d.menuRecipes.length === 1 ? 3 : 2) * (r.unitCost || 0),
      0
    );
    const isInDebt = d.coins < 0;
    const isShortOnPrep = d.menuRecipes.length > 0 && d.coins < openingPrepCost;
    const blockedFromOpening = isInDebt || isShortOnPrep;
    const deficitNeeded = Math.max(0, openingPrepCost - d.coins);

    const statsCardHtml = `
      <div class="card stats-card">
        <div class="stats-top">
          <span class="tier-title">${d.shopTierTitle}</span>
          <span class="day-pill">第 ${d.day} 天</span>
        </div>
        <div class="stats-row">
          <div class="stat-chip"><span class="stat-label">🪙 焦糖金币</span><span class="stat-val" style="${isInDebt ? 'color:#C43424;' : ''}">${d.coins}${isInDebt ? '（赤字）' : ''}</span></div>
          <div class="stat-chip"><span class="stat-label">⭐ 糖屋口碑</span><span class="stat-val">${d.reputation}</span></div>
        </div>
        <div class="tab-bar" role="tablist">
          <button type="button" role="tab" aria-selected="${d.activeTab === 'counter'}" class="tab-btn ${d.activeTab === 'counter' ? 'active' : ''}" data-action="tab" data-tab="counter">☕ 糖屋营业</button>
          <button type="button" role="tab" aria-selected="${d.activeTab === 'upgrades'}" class="tab-btn ${d.activeTab === 'upgrades' ? 'active' : ''}" data-action="tab" data-tab="upgrades">🪵 装潢升级</button>
        </div>
      </div>
    `;

    let mainSectionHtml = '';
    if (d.activeTab === 'counter') {
      mainSectionHtml = `
        <div class="card prep-card">
          <div class="prep-head">
            <span class="prep-title">🥐 今日展示柜上架（选 1~3 道，开店自带预置库存）</span>
            <span class="prep-count">已选 ${d.menuRecipes.length} / 3</span>
          </div>
          ${d.unlockedRecipes.length > 0
            ? `<div class="menu-grid">${d.unlockedRecipes.map(r => `
                <button type="button" class="menu-item ${r.selected ? 'is-picked' : ''}" data-action="toggleMenu" data-id="${r.id}" aria-pressed="${r.selected}">
                  <img class="menu-icon mode-fit" src="${r.iconImg}" alt="" />
                  <span class="menu-name">${r.name}</span>
                  <span class="menu-flow">${r.batchInfo}</span>
                  <span class="menu-price">🪙 ${r.price}</span>
                  <span style="font-size:9px;color:#8D6242;">${r.priceBreakdown || ''}</span>
                </button>`).join('')}</div>`
            : '<div class="empty-tip">柜台还没有可售卖的甜点哦！快去完成序章解锁第一道玛德琳吧～</div>'}
          ${d.menuRecipes.length > 0
            ? `<div style="margin-top:8px;padding:6px 10px;border-radius:10px;background:#FFF7E8;border:1px solid #E5C89E;font-size:11.5px;color:#6B3B18;text-align:center;">
                 📦 开店预置备货：${d.menuRecipes.length === 1 ? '3' : '每款 2'} 份 · 初始原料成本 <b>🪙 ${openingPrepCost}</b>（卖完按需补烤）
               </div>`
            : ''}
          ${blockedFromOpening
            ? `<div style="margin-top:8px;padding:9px 11px;border-radius:10px;background:${isInDebt ? '#FCE6E1' : '#FFF3D6'};border:1.5px solid ${isInDebt ? '#D94E3B' : '#E29B2B'};font-size:12px;line-height:1.5;color:${isInDebt ? '#9C2415' : '#824A08'};font-weight:700;">
                 ${isInDebt
                   ? `🚨 账面余额为负（欠款 ${Math.abs(d.coins)} 🪙），原料商已暂停赊账！必须先去风铃湾镇上打工还清欠款并凑足 ${openingPrepCost} 🪙 备货本金（还差 ${deficitNeeded} 🪙），才能重新开店！`
                   : `⚠️ 当前现金（${d.coins} 🪙）不足支付今日开店备货成本（${openingPrepCost} 🪙，还差 ${deficitNeeded} 🪙），请先去镇上打工赚点启动资金，或减少上架菜品。`}
               </div>`
            : ''}
          <div class="prep-cta-group">
            ${blockedFromOpening
              ? `<button type="button" class="btn-primary open-btn" data-action="goJobs">💼 去风铃湾打工赚钱（零成本凑本金）</button>
                 <button type="button" class="btn-secondary practice-btn" data-action="startPractice">🎓 练习引导（免费不扣钱）</button>`
              : `<button type="button" class="btn-primary open-btn" data-action="startBusiness">🔔 挂出营业牌 · 进入糖屋迎客</button>
                 <button type="button" class="btn-secondary practice-btn" data-action="startPractice">🎓 练习引导（不消耗天数）</button>
                 <button type="button" class="btn-secondary practice-btn" data-action="goJobs">💼 去风铃湾兼职打工（零成本外快）</button>`}
          </div>
        </div>
      `;
    } else {
      const ownedIds = d.purchasedUpgradeIds || [];
      const hasOwned = (id) => ownedIds.includes(id);
      mainSectionHtml = `
        <div class="card upg-preview-card">
          <div class="upg-preview-head">
            <span>🏛️ 店面装潢实景预览（已安装 ${ownedIds.length} / ${d.upgrades.length} 件）</span>
            <span class="upg-preview-sub">购入后立即呈现在门面与营业内景</span>
          </div>
          <div class="upg-preview-stage ${ownedIds.map(id => `has-upg-${id}`).join(' ')}">
            <img class="upg-preview-bg mode-fill" src="assets/images/kitchen/patisserie_25d_zones.jpg?v=3" alt="糖屋装潢预览" />
            ${hasOwned('crystal_lamp') ? `
              <div class="scene-upg-chandelier is-mini"><div class="chandelier-warm-wash"></div><img class="scene-upg-img mode-fit" src="assets/images/upgrades/prop_upg_chandelier.png" alt="" /></div>
            ` : ''}
            ${hasOwned('herb_boxes') ? `
              <img class="scene-upg-herb left is-mini mode-fit" src="assets/images/upgrades/prop_upg_herb_box.png" alt="" />
              <img class="scene-upg-herb right is-mini mode-fit" src="assets/images/upgrades/prop_upg_herb_box.png" alt="" />
            ` : ''}
            ${hasOwned('porcelain_gift') ? `
              <img class="scene-upg-gift is-mini mode-fit" src="assets/images/upgrades/prop_upg_giftbox.png" alt="" />
            ` : ''}
            ${hasOwned('oak_counter') ? `
              <div class="scene-upg-oak-plaque is-mini">✦ 法式橡木御制展示柜 ✦</div>
            ` : ''}
            ${hasOwned('brass_espresso') ? `
              <div class="scene-upg-espresso is-mini"><span class="espresso-steam">☕</span><img class="scene-upg-img mode-fit" src="assets/images/upgrades/prop_upg_espresso.png" alt="" /></div>
            ` : ''}
            ${ownedIds.length === 0 ? '<div class="upg-preview-empty-tag">尚未安装装潢 · 购入下方装饰即可改造店面</div>' : ''}
          </div>
        </div>
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
              <div class="sum-row sub"><span>营业毛收入（含小费 +${s.totalTips || 0}）</span><span class="sum-val">+${s.grossCoins || 0} 🪙</span></div>
              <div class="sum-row sub"><span>原料总成本（备货 ${s.prepCost || 0} + 补烤 ${s.bakeCost || 0}）</span><span class="sum-val warn">-${s.totalCost || 0} 🪙</span></div>
              <div class="sum-row"><span>${s.isPractice ? '练习模拟净利' : '本轮营业净利'}</span><span class="sum-val ${(!s.isPractice && s.coins < 0) ? 'warn' : ''}">${s.isPractice ? `模拟 ${(s.simNet || 0) >= 0 ? '+' : ''}${s.simNet || 0} / 实际入账 0` : `${s.coins >= 0 ? '+' : ''}${s.coins}`} 🪙</span></div>
              <div class="sum-row"><span>${s.isPractice ? '练习模拟口碑' : '新增店铺口碑'}</span><span class="sum-val ${!s.isPractice && s.rep < 0 ? 'warn' : ''}">${s.isPractice ? `模拟 ${s.simRep >= 0 ? '+' : ''}${s.simRep || 0} / 实际入账 0` : `${s.rep >= 0 ? '+' : ''}${s.rep}`} ⭐</span></div>
              <div class="sum-divider"></div>
              <div class="sum-row sub"><span>餐桌擦拭清台</span><span class="sum-val">${s.tablesCleaned || 0} 次</span></div>
              <div class="sum-row sub"><span>后厨批量补烤</span><span class="sum-val">${s.batchesBaked || 0} 炉</span></div>
              <div class="sum-row sub"><span>流失顾客</span><span class="sum-val ${s.lost > 0 ? 'warn' : ''}">${s.lost} 位</span></div>
              <div class="sum-row sub"><span>婉拒顾客（每次 -5 口碑）</span><span class="sum-val ${(s.declined || 0) > 0 ? 'warn' : ''}">${s.declined || 0} 位</span></div>
              <div class="sum-row sub"><span>烤糊炉次${(s.burntCost || 0) > 0 ? `（浪费 ${s.burntCost} 🪙）` : ''}</span><span class="sum-val ${s.burnt > 0 ? 'warn' : ''}">${s.burnt} 次</span></div>
            </div>
            <div class="summary-advice">💡 ${s.advice}</div>
            ${!s.isPractice && blockedFromOpening
              ? `<button type="button" class="btn-primary summary-close-btn" data-action="goJobs">💼 资金${isInDebt ? '赤字' : '见底'} · 立即去镇上打工赚本金</button>`
              : ''}
            <button type="button" class="${!s.isPractice && blockedFromOpening ? 'btn-secondary' : 'btn-primary'} summary-close-btn" data-action="closeSummary">${s.isPractice ? '返回营业准备' : '收下营收 · 迎接明天'}</button>
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
        showToast('🎉 上手啦！正式营业 45 秒开始！', 1600);
      },
      onServeEffect: ({ seatId }) => {
        const scene = root.querySelector('.kitchen-scene');
        const xMap = [22, 50, 78];
        spawnFloatText(scene, {
          xPct: xMap[seatId] || 50,
          yPct: 24,
          text: '🍰 享用中 😋',
          kind: 'cream'
        });
      },
      onCheckoutEffect: ({ seatId, basePrice, tip }) => {
        const scene = root.querySelector('.kitchen-scene');
        const xMap = [22, 50, 78];
        spawnFloatText(scene, {
          xPct: xMap[seatId] || 50,
          yPct: 22,
          text: practiceMode ? `🎓 +${basePrice}(小费+${tip})` : `+${basePrice} 🪙 小费+${tip}!`,
          kind: 'gold'
        });
      },
      onCleanEffect: ({ seatId }) => {
        const scene = root.querySelector('.kitchen-scene');
        const xMap = [22, 50, 78];
        spawnFloatText(scene, {
          xPct: xMap[seatId] || 50,
          yPct: 26,
          text: '✨ 清台完成!',
          kind: 'green'
        });
      },
      onHarvestEffect: ({ ovenId, added }) => {
        const scene = root.querySelector('.kitchen-scene');
        spawnFloatText(scene, {
          xPct: ovenId === 'oven_1' ? 24 : 76,
          yPct: 76,
          text: `✨ 入柜 +${added} 份!`,
          kind: 'gold'
        });
      },
      onDeclineEffect: ({ seatId, repPenalty }) => {
        const scene = root.querySelector('.kitchen-scene');
        const xMap = [22, 50, 78];
        moveCocoTo(`seat_${seatId}`, '🚪');
        spawnFloatText(scene, {
          xPct: xMap[seatId] || 50,
          yPct: 22,
          text: repPenalty > 0 ? `婉拒 · 口碑 -${repPenalty} ⭐` : '已婉拒（练习）',
          kind: 'red'
        });
      },
      onBakeStartEffect: ({ ovenId, cost }) => {
        const scene = root.querySelector('.kitchen-scene');
        spawnFloatText(scene, {
          xPct: ovenId === 'oven_1' ? 18 : 82,
          yPct: 78,
          text: `-${cost} 🪙 原料`,
          kind: 'red'
        });
      },
      onShiftEnd: ({ earnedCoins, grossCoins = 0, prepCost = 0, bakeCost = 0, totalCost = 0, burntCost = 0, earnedRep, servedCount, totalTips = 0, tablesCleaned = 0, lostCustomers, declinedCustomers = 0, burntCount, batchesBaked = 0, undeliveredCount, isPractice }) => {
        if (!isPractice) {
          recordBusinessDay({ earnedCoins, earnedRep });
        }
        const advice = buildSummaryAdvice({
          served: servedCount,
          lost: lostCustomers,
          declined: declinedCustomers,
          burnt: burntCount,
          burntCost,
          netCoins: earnedCoins,
          batchesBaked,
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
            grossCoins,
            prepCost,
            bakeCost,
            totalCost,
            burntCost,
            simNet: earnedCoins,
            rep: isPractice ? 0 : earnedRep,
            simRep: earnedRep,
            totalTips,
            tablesCleaned,
            batchesBaked,
            lost: lostCustomers,
            declined: declinedCustomers,
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
    } else if (action === 'endShiftEarly' || action === 'exitPractice') {
      kitchen?.finishShift();
    } else if (action === 'startRealFromPractice') {
      launchKitchenShift({ tutorialMode: false, practiceMode: false });
    } else if (action === 'skipKitchenTut') {
      kitchen?.skipTutorial();
    } else if (action === 'tab') {
      if (pageProxy.data.isOpen) { showToast('糖屋正在营业中，打烊后再看装潢哦！'); return; }
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
    } else if (action === 'goJobs') {
      if (typeof navigate === 'function') navigate('jobs');
      else window.location.hash = '#/jobs';
    } else if (action === 'startBusiness') {
      if (pageProxy.data.menuRecipes.length === 0) {
        showToast('请先通过序章解锁玛德琳再开门营业！');
        return;
      }
      const needPrep = pageProxy.data.menuRecipes.reduce(
        (sum, r) => sum + (pageProxy.data.menuRecipes.length === 1 ? 3 : 2) * (r.unitCost || 0),
        0
      );
      if (pageProxy.data.coins < 0 || pageProxy.data.coins < needPrep) {
        showToast('资金不足支付备货成本，先去风铃湾打工赚钱吧！');
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
    } else if (action === 'tapDisplay') {
      const idx = Number(target.dataset.idx) || 0;
      moveCocoTo(`disp_${Math.min(2, idx)}`, '🧁');
      pulseProp(`#k-disp-${target.dataset.id}`);
      kitchen?.tapDisplay(target.dataset.id);
    } else if (action === 'tapOven') {
      const oId = target.dataset.id;
      moveCocoTo(oId, '🔥');
      pulseProp(`#k-oven-${oId}`);
      kitchen?.tapOven(oId);
    } else if (action === 'startBatch') {
      const res = kitchen?.startBatchBake(target.dataset.id);
      if (res && res.ok) {
        moveCocoTo(res.ovenId, '🔥');
        pulseProp(`#k-oven-${res.ovenId}`);
      } else {
        moveCocoTo('batch');
      }
    } else if (action === 'tapSeat') {
      const seatId = Number(target.dataset.id);
      moveCocoTo(`seat_${seatId}`, '🍰');
      kitchen?.tapSeat(seatId);
    } else if (action === 'declineSeat') {
      kitchen?.declineSeat(Number(target.dataset.id));
    } else if (action === 'closeSummary') {
      pageProxy.setData({ daySummary: null });
    } else if (action === 'buyUpgrade') {
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
