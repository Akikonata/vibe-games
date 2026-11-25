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

    const pantryHtml = d.menuRecipes.map(m => `
      <div class="pantry-btn" data-action="pickRaw" data-id="${m.id}">
        <div class="pantry-visual">
          <img class="pantry-basket-art mode-fit" src="assets/images/kitchen/station_pantry.svg" alt="原料篮" />
          <img class="pantry-icon mode-fit" src="${m.iconImg}" alt="${m.name}" />
        </div>
        <span class="pantry-name">${m.name}</span>
        <span class="pantry-flow">${m.flowText}</span>
      </div>
    `).join('');

    const stationsHtml = d.stations.map(st => `
      <div id="k-st-${st.id}" class="station-cell state-idle" data-action="tapStation" data-id="${st.id}">
        <img class="station-art mode-fit" src="assets/images/kitchen/station_${st.type}.svg" alt="${st.name}" />
        <div id="k-st-ov-${st.id}" class="station-overlay"></div>
        <span class="station-label">${st.name}</span>
      </div>
    `).join('');

    root.innerHTML = `
      <div class="scrollarea">
        <div class="caramel-canopy">
          <div class="awning-bar"></div>
          <div class="caramel-drip-edge"></div>
          <div class="canopy-vine-left"><div class="leaf-pill"></div><div class="leaf-pill alt"></div></div>
          <div class="canopy-vine-right"><div class="leaf-pill"></div><div class="leaf-pill alt"></div></div>
        </div>
        <div class="page-wrap shop-wrap">
          <div class="kitchen-hud">
            <span id="k-time" class="hud-time">⏱ ${d.shiftTimeLeft}s</span>
            <span id="k-coins" class="hud-coins">🪙 +${d.shiftCoins}</span>
            <span id="k-served" class="hud-served">出餐 ${d.shiftServed} · 连击x${d.shiftCombo}</span>
          </div>

          <div class="cafe-dining">
            ${[0, 1, 2].map(id => `<div id="k-seat-${id}" class="seat-slot" data-action="tapSeat" data-id="${id}"></div>`).join('')}
          </div>

          <div class="coco-hands-bar">
            <img class="hands-coco mode-fill" src="assets/images/coco_avatar.png" alt="可可" />
            <div id="k-hands" class="hands-slot"></div>
          </div>

          <div id="k-tip" class="kitchen-tip-bar">${d.serviceMsg}</div>

          <div class="kitchen-floor card">
            <!-- 原料篮置顶于操作区，配手绘竹篮图，一眼可见且永不吞点击 -->
            <div class="pantry-section">
              <span class="pantry-title">🧺 原料篮（点击拿取生面糊）</span>
              <div class="pantry-row">${pantryHtml}</div>
            </div>

            <div class="stations-grid">${stationsHtml}</div>

            <div class="utility-row">
              <div id="k-hold" class="util-station" data-action="tapHold">
                <img class="util-art mode-fit" src="assets/images/kitchen/station_hold.svg" alt="" />
                <img id="k-hold-img" class="util-hold-item mode-fit" style="display:none;" alt="" />
                <span id="k-hold-lbl" class="util-label">大理石暂存台</span>
              </div>
              <div id="k-trash" class="util-station" data-action="tapTrash">
                <img class="util-art mode-fit" src="assets/images/kitchen/station_trash.svg" alt="" />
                <span class="util-label">回收铜桶（丢弃）</span>
              </div>
            </div>
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
    if (servedEl) servedEl.textContent = `出餐 ${d.shiftServed} · 连击x${d.shiftCombo}`;
    const tipEl = root.querySelector('#k-tip');
    if (tipEl && tipEl.textContent !== d.serviceMsg) tipEl.textContent = d.serviceMsg;

    // 1. 增量更新前厅 3 座位
    (d.seats || []).forEach((s, idx) => {
      const slot = root.querySelector(`#k-seat-${s.id}`);
      if (!slot) return;
      slot.className = `seat-slot ${s.occupied ? 'is-occupied' : ''} ${d.highlightTarget === 'seat_' + s.id ? 'is-glow' : ''}`;
      const sig = s.occupied ? `1:${s.npcId}:${s.wantedId}` : '0';
      if (seatSigs[idx] !== sig) {
        seatSigs[idx] = sig;
        slot.innerHTML = s.occupied
          ? `<div class="seat-order-bubble">
               <img class="seat-order-img mode-fit" src="${s.wantedIcon}" alt="" />
               <div class="seat-patience-track"><div class="seat-patience-fill" style="width:${s.patience}%;"></div></div>
             </div>
             <img class="seat-npc-img mode-widthfix" src="${s.portrait}" alt="${s.name}" />
             <span class="seat-name">${s.name}</span>`
          : `<img class="seat-chair-img mode-fit" src="assets/images/kitchen/empty_chair.svg" alt="" />
             <span class="seat-empty-text">空位</span>`;
      } else if (s.occupied) {
        const fill = slot.querySelector('.seat-patience-fill');
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
          ? `<img class="hands-item-img mode-fit" src="${h.displayImg}" alt="" />
             <div class="hands-item-meta">
               <span class="hands-item-name">${h.recipeName}</span>
               <span class="hands-item-tag ${h.isFinished ? 'ready' : ''} ${h.isBurnt ? 'burnt' : ''}">${h.statusLabel}</span>
             </div>`
          : '<span class="hands-empty">👐 空手 · 点击原料篮拿生面糊或点击成品取餐</span>';
      }
    }

    // 3. 增量更新 4 个厨房工位（绝不重建按钮本身）
    (d.stations || []).forEach(st => {
      const cell = root.querySelector(`#k-st-${st.id}`);
      const ov = root.querySelector(`#k-st-ov-${st.id}`);
      if (!cell || !ov) return;
      cell.className = `station-cell state-${st.state} ${d.highlightTarget === st.id ? 'is-glow' : ''}`;
      const sig = st.item ? `${st.state}:${st.item.recipeId}:${st.item.displayImg}` : 'idle';
      if (stationSigs[st.id] !== sig) {
        stationSigs[st.id] = sig;
        if (!st.item) {
          ov.innerHTML = '';
        } else if (st.state === 'working') {
          ov.innerHTML = `
            <img class="station-food mode-fit" src="${st.item.displayImg}" alt="" />
            <div class="station-prog-track"><div class="station-prog-fill" style="width:${st.progress}%;"></div></div>
          `;
        } else if (st.state === 'ready') {
          ov.innerHTML = `
            <img class="station-food mode-fit" src="${st.item.displayImg}" alt="" />
            <span class="station-badge ready">✨ 点我取餐</span>
          `;
        } else {
          ov.innerHTML = `
            <img class="station-food mode-fit" src="${st.item.displayImg}" alt="" />
            <span class="station-badge burnt">💨 糊了</span>
          `;
        }
      } else if (st.state === 'working') {
        const fill = ov.querySelector('.station-prog-fill');
        if (fill) fill.style.width = `${st.progress}%`;
      }
    });

    // 4. 更新原料篮、暂存台、回收桶高亮
    const pantryGlow = d.highlightTarget === 'pantry';
    root.querySelectorAll('.pantry-btn').forEach(btn => {
      btn.classList.toggle('is-glow', pantryGlow);
    });

    const holdEl = root.querySelector('#k-hold');
    if (holdEl) {
      holdEl.classList.toggle('is-glow', d.highlightTarget === 'hold');
      const nextHoldSig = d.holdItem ? `${d.holdItem.recipeId}:${d.holdItem.displayImg}` : 'empty';
      if (holdSig !== nextHoldSig) {
        holdSig = nextHoldSig;
        const img = root.querySelector('#k-hold-img');
        const lbl = root.querySelector('#k-hold-lbl');
        if (d.holdItem) {
          img.src = d.holdItem.displayImg;
          img.style.display = 'block';
          lbl.textContent = `暂存：${d.holdItem.recipeName}`;
        } else {
          img.style.display = 'none';
          lbl.textContent = '大理石暂存台';
        }
      }
    }

    const trashEl = root.querySelector('#k-trash');
    if (trashEl) trashEl.classList.toggle('is-glow', d.highlightTarget === 'trash');
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
