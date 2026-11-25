// src/pages/recipes.js
// 复古食谱文化手账（主线/支线筛选 + 11 道经典欧洲甜点发展史与文化背景弹窗）

import { RECIPES } from '../data/recipes.js';
import { loadProgress } from '../utils/store.js';
import { showToast } from '../../../../shared/web-ui.js';

export function mountRecipesPage(root) {
  let activeTab = 'all';
  let selectedId = null;

  function render() {
    const progress = loadProgress();
    const unlockedIds = progress.unlockedRecipeIds || [];
    const allList = RECIPES.map(r => ({ ...r, unlocked: unlockedIds.includes(r.id) }));
    const filtered = activeTab === 'all'
      ? allList
      : allList.filter(r => r.chapterType === activeTab);
    const selected = selectedId ? allList.find(r => r.id === selectedId) || null : null;

    const gridHtml = filtered.map(item => `
      <div class="card recipe-item ${item.unlocked ? '' : 'locked'}" data-action="select" data-id="${item.id}">
        <div class="recipe-arch">
          ${item.unlocked
            ? `<img class="recipe-svg-icon mode-fit" src="${item.iconImg}" alt="${item.name}" />`
            : '<span>🔒</span>'}
        </div>
        <span class="recipe-name">${item.unlocked ? item.name : '未解锁食谱'}</span>
        <span class="recipe-origin">${item.unlocked ? item.origin : '完成对应关卡解锁'}</span>
        <span class="tag ${item.chapterType === 'main' ? 'tag-main' : 'tag-side'}">${item.chapterType === 'main' ? '主线' : '支线'}</span>
      </div>
    `).join('');

    const modalHtml = selected
      ? `<div class="modal-mask" data-action="closeModal">
          <div class="modal-panel card" data-stop="true">
            <div class="modal-top">
              <div class="modal-medallion"><img class="recipe-svg-icon mode-fit" src="${selected.iconImg}" alt="${selected.name}" /></div>
              <div class="modal-titles">
                <span class="modal-name">${selected.name}</span>
                <span class="modal-en">${selected.englishName} · ${selected.origin}</span>
              </div>
              <span class="modal-close" data-action="closeModal">✕</span>
            </div>
            <div class="modal-tagline">“${selected.tagline}”</div>
            <div class="modal-meta">
              <span>🎮 解锁玩法：${selected.minigameLabel}</span>
              <span>🏠 糖屋升级：${selected.shopReward}</span>
            </div>
            <div class="modal-scroll scrollarea">
              <div class="culture-section">
                <span class="culture-title">📜 甜点发展史</span>
                <span class="culture-text">${selected.history}</span>
              </div>
              <div class="culture-section">
                <span class="culture-title">🌍 文化背景</span>
                <span class="culture-text">${selected.culture}</span>
              </div>
            </div>
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

        <div class="page-wrap">
          <div class="card header-card">
            <div class="header-top">
              <div class="ribbon-title">📕 复古食谱手账</div>
              <span class="book-count">已收集 ${unlockedIds.length} / ${RECIPES.length}</span>
            </div>
            <span class="book-sub">翻开泛黄的羊皮纸，品读每一道甜点跨越时代的欧洲风土与历史故事</span>
            <div class="tab-bar">
              <div class="tab-btn ${activeTab === 'all' ? 'active' : ''}" data-action="tab" data-tab="all">全部</div>
              <div class="tab-btn ${activeTab === 'main' ? 'active' : ''}" data-action="tab" data-tab="main">主线招牌</div>
              <div class="tab-btn ${activeTab === 'side' ? 'active' : ''}" data-action="tab" data-tab="side">供应链限定</div>
            </div>
          </div>
          <div class="recipe-grid">${gridHtml}</div>
        </div>
      </div>
      ${modalHtml}
    `;
  }

  const onClick = (e) => {
    const target = e.target.closest('[data-action], [data-stop]');
    if (!target || !target.dataset.action) return;
    const action = target.dataset.action;
    if (action === 'tab') {
      activeTab = target.dataset.tab;
      render();
    } else if (action === 'select') {
      const progress = loadProgress();
      if (!(progress.unlockedRecipeIds || []).includes(target.dataset.id)) {
        showToast('尚未解锁，请先通过对应剧情关卡');
        return;
      }
      selectedId = target.dataset.id;
      render();
    } else if (action === 'closeModal') {
      selectedId = null;
      render();
    }
  };

  root.addEventListener('click', onClick);
  render();
  return () => root.removeEventListener('click', onClick);
}
