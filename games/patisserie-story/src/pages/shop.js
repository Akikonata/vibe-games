// src/pages/shop.js
// 星月糖屋轻度胡闹厨房（Overcooked-Lite）营业系统 + 装潢设备升级
// 营业中采用持久 DOM 增量补丁更新，杜绝高频计时刷新吞掉点击事件

import { RECIPES } from '../data/recipes.js';
import { SHOP_UPGRADES, computeShopBonuses } from '../data/shop_upgrades.js';
import { getKitchenFlow } from '../data/kitchen_recipes.js';
import { createKitchenEngine } from '../engines/kitchen_engine.js';
import {
  loadProgress,
  getShopTierTitle,
  recordBusinessDay,
  buyShopUpgrade,
  saveMenuRecipeIds
} from '../utils/store.js';
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

export function mountShopPage(root) {
  let kitchen = null;
  let bonuses = null;
  let destroyed = false;
  let kitchenMounted = false;

  // 营业中局部缓存，避免无变化节点重复重写
  let seatSigs = ['', '', ''];
  let handsSig = '';
  let stationSigs = {};
  let holdSig = '';

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
      shiftTimeLeft: 45,
      shiftCoins: 0,
      shiftRep: 0,
      shiftServed: 0,
      shiftCombo: 0,
      seats: [],
      stations: [],
      heldItem: null,
      holdItem: null,
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

    // 如果今日上架 1 道甜点，直接点大竹篮就能拿；2~3 道则在竹篮口挂上圆润甜点吊牌任选
    const singleMenu = d.menuRecipes.length === 1 ? d.menuRecipes[0] : null;
    const pantryMarkup = singleMenu
      ? `<div class="scene-prop pos-pantry is-pantry-item" data-action="pickRaw" data-id="${singleMenu.id}">
           <img class="prop-sprite sprite-pantry mode-fit" src="assets/images/kitchen/prop_pantry_basket.png" alt="原料篮" />
           <div class="pantry-badge-pill">
             <img class="pantry-mini-dessert mode-fit" src="${singleMenu.iconImg}" alt="" />
             <span>原料篮</span>
           </div>
         </div>`
      : `<div class="scene-prop pos-pantry is-pantry-multi">
           <img class="prop-sprite sprite-pantry mode-fit" src="assets/images/kitchen/prop_pantry_basket.png" alt="原料篮" />
           <div class="pantry-picks">
             ${d.menuRecipes.map(m => `
               <div class="pantry-pick-orb is-pantry-item" data-action="pickRaw" data-id="${m.id}" title="${m.name}">
                 <img class="pantry-orb-img mode-fit" src="${m.iconImg}" alt="${m.name}" />
               </div>
             `).join('')}
           </div>
         </div>`;

    const stationsMarkup = d.stations.map(st => `
      <div id="k-st-${st.id}" class="scene-prop ${STATION_POS[st.id] || ''} state-idle" data-action="tapStation" data-id="${st.id}">
        <img class="prop-sprite sprite-${st.type} mode-fit" src="${PROP_IMG[st.type]}" alt="${st.name}" />
        <div id="k-st-ov-${st.id}" class="prop-overlay"></div>
      </div>
    `).join('');

    root.innerHTML = `
      <div class="kitchen-scene">
        <img class="kitchen-scene-bg mode-fill" src="assets/images/kitchen/kitchen_scene_bg.jpg" alt="星月糖屋后厨" />

        <!-- 顶部悬浮半透明营收 HUD -->
        <div class="scene-hud">
          <span id="k-time" class="hud-time">⏱ ${d.shiftTimeLeft}s</span>
          <span id="k-coins" class="hud-coins">🪙 +${d.shiftCoins}</span>
          <span id="k-served" class="hud-served">出餐 ${d.shiftServed} · x${d.shiftCombo}</span>
        </div>

        <!-- 吧台后方：3 位二次元立绘顾客直接站立点单 -->
        <div class="scene-customers">
          ${[0, 1, 2].map(id => `<div id="k-seat-${id}" class="scene-customer" data-action="tapSeat" data-id="${id}"></div>`).join('')}
        </div>

        <!-- 吧台沿上的轻盈单行提示条 -->
        <div id="k-tip" class="scene-tip-pill">${d.serviceMsg}</div>

        <!-- 大理石与橡木实景工作台：全部纯图片化道具，零按钮框 -->
        <div class="scene-workbench">
          ${stationsMarkup}
          ${pantryMarkup}

          <!-- 底部左：大理石暂存碟 -->
          <div id="k-hold" class="scene-prop pos-hold" data-action="tapHold" title="暂存台">
            <div class="hold-saucer">
              <img id="k-hold-img" class="hold-food-img mode-fit" style="display:none;" alt="" />
              <span id="k-hold-lbl" class="hold-mini-tag">暂存</span>
            </div>
          </div>

          <!-- 底部中：可可手中托盘实景状态 -->
          <div class="scene-coco-tray">
            <img class="tray-coco-avatar mode-fill" src="assets/images/coco_avatar.png" alt="可可" />
            <div id="k-hands" class="tray-held-slot"></div>
          </div>

          <!-- 底部右：复古回收铜桶 -->
          <div id="k-trash" class="scene-prop pos-trash" data-action="tapTrash" title="丢弃">
            <img class="prop-sprite sprite-trash mode-fit" src="assets/images/kitchen/prop_copper_bin.png" alt="回收铜桶" />
          </div>
        </div>
      </div>
    `;
    kitchenMounted = true;
  }

  function patchKitchenDom(d) {
    const timeEl = root.querySelector('#k-time');
    if (timeEl) timeEl.textContent = `⏱ ${d.shiftTimeLeft}s`;
    const coinsEl = root.querySelector('#k-coins');
    if (coinsEl) coinsEl.textContent = `🪙 +${d.shiftCoins}`;
    const servedEl = root.querySelector('#k-served');
    if (servedEl) servedEl.textContent = `出餐 ${d.shiftServed} · x${d.shiftCombo}`;
    const tipEl = root.querySelector('#k-tip');
    if (tipEl && tipEl.textContent !== d.serviceMsg) tipEl.textContent = d.serviceMsg;

    // 1. 增量更新前厅 3 位立绘顾客
    (d.seats || []).forEach((s, idx) => {
      const slot = root.querySelector(`#k-seat-${s.id}`);
      if (!slot) return;
      slot.className = `scene-customer ${s.occupied ? 'is-occupied' : 'is-empty'} ${d.highlightTarget === 'seat_' + s.id ? 'is-scene-glow' : ''}`;
      const sig = s.occupied ? `1:${s.npcId}:${s.wantedId}` : '0';
      if (seatSigs[idx] !== sig) {
        seatSigs[idx] = sig;
        slot.innerHTML = s.occupied
          ? `<div class="cust-bubble">
               <img class="cust-want-img mode-fit" src="${s.wantedIcon}" alt="" />
               <div class="cust-patience"><div class="cust-patience-fill" style="width:${s.patience}%;"></div></div>
             </div>
             <img class="cust-portrait mode-widthfix" src="${s.portrait}" alt="${s.name}" />`
          : '';
      } else if (s.occupied) {
        const fill = slot.querySelector('.cust-patience-fill');
        if (fill) {
          fill.style.width = `${s.patience}%`;
          fill.classList.toggle('low', s.patience < 35);
        }
      }
    });

    // 2. 增量更新可可手中物品
    const h = d.heldItem;
    const nextHandsSig = h ? `${h.recipeId}:${h.displayImg}:${h.statusLabel}:${h.isFinished}:${h.isBurnt}` : 'empty';
    if (handsSig !== nextHandsSig) {
      handsSig = nextHandsSig;
      const handsEl = root.querySelector('#k-hands');
      if (handsEl) {
        handsEl.innerHTML = h
          ? `<img class="tray-food-img mode-fit" src="${h.displayImg}" alt="" />
             <span class="tray-status-dot ${h.isFinished ? 'ready' : ''} ${h.isBurnt ? 'burnt' : ''}">${h.isFinished ? '✨成品' : (h.isBurnt ? '💨糊了' : '加工中')}</span>`
          : '<span class="tray-empty-txt">空手</span>';
      }
    }

    // 3. 增量更新 4 个实景工位道具
    const STATION_POS = { oven_1: 'pos-oven-1', oven_2: 'pos-oven-2', cream_1: 'pos-cream', decor_1: 'pos-decor' };
    (d.stations || []).forEach(st => {
      const cell = root.querySelector(`#k-st-${st.id}`);
      const ov = root.querySelector(`#k-st-ov-${st.id}`);
      if (!cell || !ov) return;
      cell.className = `scene-prop ${STATION_POS[st.id] || ''} state-${st.state} ${d.highlightTarget === st.id ? 'is-scene-glow' : ''}`;
      const sig = st.item ? `${st.state}:${st.item.recipeId}:${st.item.displayImg}` : 'idle';
      if (stationSigs[st.id] !== sig) {
        stationSigs[st.id] = sig;
        if (!st.item) {
          ov.innerHTML = '';
        } else if (st.state === 'working') {
          ov.innerHTML = `
            <img class="prop-dish-img mode-fit" src="${st.item.displayImg}" alt="" />
            <div class="prop-prog-track"><div class="prop-prog-fill" style="width:${st.progress}%;"></div></div>
          `;
        } else if (st.state === 'ready') {
          ov.innerHTML = `
            <img class="prop-dish-img ready-pop mode-fit" src="${st.item.displayImg}" alt="" />
            <span class="prop-pill ready">✨ 取餐</span>
          `;
        } else {
          ov.innerHTML = `
            <img class="prop-dish-img burnt-tint mode-fit" src="${st.item.displayImg}" alt="" />
            <span class="prop-pill burnt">💨 糊了</span>
          `;
        }
      } else if (st.state === 'working') {
        const fill = ov.querySelector('.prop-prog-fill');
        if (fill) fill.style.width = `${st.progress}%`;
      }
    });

    // 4. 更新原料篮、暂存碟、铜桶发光提示
    const pantryGlow = d.highlightTarget === 'pantry';
    root.querySelectorAll('.is-pantry-item').forEach(el => {
      el.classList.toggle('is-scene-glow', pantryGlow);
    });

    const holdEl = root.querySelector('#k-hold');
    if (holdEl) {
      holdEl.classList.toggle('is-scene-glow', d.highlightTarget === 'hold');
      const nextHoldSig = d.holdItem ? `${d.holdItem.recipeId}:${d.holdItem.displayImg}` : 'empty';
      if (holdSig !== nextHoldSig) {
        holdSig = nextHoldSig;
        const img = root.querySelector('#k-hold-img');
        const lbl = root.querySelector('#k-hold-lbl');
        if (d.holdItem) {
          img.src = d.holdItem.displayImg;
          img.style.display = 'block';
          lbl.style.display = 'none';
        } else {
          img.style.display = 'none';
          lbl.style.display = 'block';
        }
      }
    }

    const trashEl = root.querySelector('#k-trash');
    if (trashEl) trashEl.classList.toggle('is-scene-glow', d.highlightTarget === 'trash');
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
        <div class="tab-bar">
          <div class="tab-btn ${d.activeTab === 'counter' ? 'active' : ''}" data-action="tab" data-tab="counter">☕ 厨房营业</div>
          <div class="tab-btn ${d.activeTab === 'upgrades' ? 'active' : ''}" data-action="tab" data-tab="upgrades">🪵 装潢升级</div>
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
                <div class="menu-item ${r.selected ? 'is-picked' : ''}" data-action="toggleMenu" data-id="${r.id}">
                  <img class="menu-icon mode-fit" src="${r.iconImg}" alt="" />
                  <span class="menu-name">${r.name}</span>
                  <span class="menu-flow">${r.flowText}</span>
                  <span class="menu-price">🪙 ${r.price}</span>
                </div>`).join('')}</div>`
            : '<div class="empty-tip">柜台还没有可售卖的甜点哦！快去完成序章解锁第一道玛德琳吧～</div>'}
          <div class="btn-primary open-btn" data-action="startBusiness">🔔 挂出营业牌 · 进入厨房迎客</div>
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
                ? '<div class="upg-btn owned">已安装</div>'
                : `<div class="upg-btn ${u.canAfford ? '' : 'disabled'}" data-action="buyUpgrade" data-id="${u.id}">🪙 ${u.cost}</div>`}
            </div>`).join('')}
        </div>
      `;
    }

    const summaryHtml = d.daySummary
      ? `<div class="summary-mask" data-action="closeSummary">
          <div class="card summary-card" data-stop="true">
            <div class="ribbon-title">🌙 第 ${d.daySummary.day} 天 · 打烊结算</div>
            <div class="summary-rows">
              <div class="sum-row"><span>今日成功出餐</span><span class="sum-val">${d.daySummary.served} 份</span></div>
              <div class="sum-row"><span>营业焦糖金币</span><span class="sum-val">+${d.daySummary.coins} 🪙</span></div>
              <div class="sum-row"><span>新增店铺口碑</span><span class="sum-val">+${d.daySummary.rep} ⭐</span></div>
            </div>
            <div class="btn-primary" data-action="closeSummary">收下营收 · 迎接明天</div>
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

  const onClick = (e) => {
    const target = e.target.closest('[data-action], [data-stop]');
    if (!target || !target.dataset.action) return;
    const action = target.dataset.action;

    if (action === 'tab') {
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
      if (kitchen) kitchen.stop();
      kitchenMounted = false;
      const currentDay = pageProxy.data.day;
      kitchen = createKitchenEngine(pageProxy, {
        menuRecipes: pageProxy.data.menuRecipes,
        bonuses,
        onShiftEnd: ({ earnedCoins, earnedRep, servedCount }) => {
          recordBusinessDay({ earnedCoins, earnedRep });
          pageProxy.setData({
            isOpen: false,
            daySummary: { day: currentDay, served: servedCount, coins: earnedCoins, rep: earnedRep }
          }, () => refreshShop());
        }
      });
      kitchen.start();
    } else if (action === 'pickRaw') kitchen?.pickRaw(target.dataset.id);
    else if (action === 'tapStation') kitchen?.tapStation(target.dataset.id);
    else if (action === 'tapHold') kitchen?.tapHold();
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
  refreshShop();
  return () => {
    destroyed = true;
    kitchen?.stop?.();
    root.removeEventListener('click', onClick);
  };
}
