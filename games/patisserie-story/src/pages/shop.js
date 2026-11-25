// src/pages/shop.js
// 星月糖屋轻度胡闹厨房（Overcooked-Lite）营业系统 + 装潢设备升级

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

  function render() {
    const d = pageProxy.data;
    const prevScroll = root.querySelector('.scrollarea')?.scrollTop || 0;

    const statsCardHtml = !d.isOpen
      ? `<div class="card stats-card">
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
        </div>`
      : '';

    let mainSectionHtml = '';
    if (d.isOpen) {
      const seatsHtml = d.seats.map(s => `
        <div class="seat-slot ${s.occupied ? 'is-occupied' : ''} ${d.highlightTarget === 'seat_' + s.id ? 'is-glow' : ''}" data-action="tapSeat" data-id="${s.id}">
          ${s.occupied
            ? `<div class="seat-order-bubble">
                <img class="seat-order-img mode-fit" src="${s.wantedIcon}" alt="" />
                <div class="seat-patience-track"><div class="seat-patience-fill ${s.patience < 35 ? 'low' : ''}" style="width:${s.patience}%;"></div></div>
               </div>
               <img class="seat-npc-img mode-widthfix" src="${s.portrait}" alt="${s.name}" />
               <span class="seat-name">${s.name}</span>`
            : `<img class="seat-chair-img mode-fit" src="assets/images/kitchen/empty_chair.svg" alt="" />
               <span class="seat-empty-text">空位</span>`}
        </div>
      `).join('');

      const handsHtml = d.heldItem
        ? `<img class="hands-item-img mode-fit" src="${d.heldItem.displayImg}" alt="" />
           <div class="hands-item-meta">
             <span class="hands-item-name">${d.heldItem.recipeName}</span>
             <span class="hands-item-tag ${d.heldItem.isFinished ? 'ready' : ''} ${d.heldItem.isBurnt ? 'burnt' : ''}">${d.heldItem.statusLabel}</span>
           </div>`
        : '<span class="hands-empty">👐 空手 · 准备拿原料或取餐</span>';

      const stationsHtml = d.stations.map(st => `
        <div class="station-cell state-${st.state} ${d.highlightTarget === st.id ? 'is-glow' : ''}" data-action="tapStation" data-id="${st.id}">
          <img class="station-art mode-fit" src="assets/images/kitchen/station_${st.type}.svg" alt="" />
          ${st.item
            ? `<div class="station-overlay">
                <img class="station-food mode-fit" src="${st.item.displayImg}" alt="" />
                ${st.state === 'working'
                  ? `<div class="station-prog-track"><div class="station-prog-fill" style="width:${st.progress}%;"></div></div>`
                  : (st.state === 'ready'
                    ? '<span class="station-badge ready">✨ 取餐</span>'
                    : (st.state === 'burnt' ? '<span class="station-badge burnt">💨 糊了</span>' : ''))}
               </div>`
            : ''}
          <span class="station-label">${st.name}</span>
        </div>
      `).join('');

      const pantryHtml = d.menuRecipes.map(m => `
        <div class="pantry-btn ${d.highlightTarget === 'pantry' ? 'is-glow' : ''}" data-action="pickRaw" data-id="${m.id}">
          <img class="pantry-icon mode-fit" src="${m.iconImg}" alt="" />
          <span class="pantry-name">${m.name}</span>
          <span class="pantry-flow">${m.flowText}</span>
        </div>
      `).join('');

      mainSectionHtml = `
        <div class="kitchen-hud">
          <span class="hud-time">⏱ ${d.shiftTimeLeft}s</span>
          <span class="hud-coins">🪙 +${d.shiftCoins}</span>
          <span class="hud-served">出餐 ${d.shiftServed} · 连击x${d.shiftCombo}</span>
        </div>
        <div class="cafe-dining">${seatsHtml}</div>
        <div class="coco-hands-bar">
          <img class="hands-coco mode-fill" src="assets/images/coco_avatar.svg" alt="可可" />
          <div class="hands-slot">${handsHtml}</div>
        </div>
        <div class="kitchen-tip-bar">${d.serviceMsg}</div>
        <div class="kitchen-floor card">
          <div class="stations-grid">${stationsHtml}</div>
          <div class="pantry-section">
            <span class="pantry-title">🧺 点击原料篮拿生面糊</span>
            <div class="pantry-row">${pantryHtml}</div>
            <div class="utility-row">
              <div class="util-station ${d.highlightTarget === 'hold' ? 'is-glow' : ''}" data-action="tapHold">
                <img class="util-art mode-fit" src="assets/images/kitchen/station_hold.svg" alt="" />
                ${d.holdItem ? `<img class="util-hold-item mode-fit" src="${d.holdItem.displayImg}" alt="" />` : ''}
                <span class="util-label">${d.holdItem ? '暂存：' + d.holdItem.recipeName : '大理石暂存台'}</span>
              </div>
              <div class="util-station ${d.highlightTarget === 'trash' ? 'is-glow' : ''}" data-action="tapTrash">
                <img class="util-art mode-fit" src="assets/images/kitchen/station_trash.svg" alt="" />
                <span class="util-label">回收铜桶（丢弃）</span>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (d.activeTab === 'counter') {
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
