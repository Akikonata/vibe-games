// src/pages/recipes.js
// 复古食谱文化手账（主线/支线筛选 + 未解锁显示地点与可达入口 + 已解锁显示最佳评级/分数与重玩入口）

import { RECIPES } from '../data/recipes.js';
import { LEVELS } from '../data/levels.js';
import { loadProgress, isLevelUnlocked } from '../utils/store.js';
import { showToast } from '../../../../shared/web-ui.js';

export function mountRecipesPage(root, _params, { navigate }) {
  let activeTab = 'all';
  let selectedId = null;

  function render() {
    const progress = loadProgress();
    const unlockedIds = progress.unlockedRecipeIds || [];
    const completedIds = progress.completedLevelIds || [];

    const allList = RECIPES.map(r => {
      const lvl = LEVELS.find(l => l.recipeId === r.id) || null;
      const unlocked = unlockedIds.includes(r.id);
      const canPlayLevel = lvl ? isLevelUnlocked(lvl, completedIds) : false;
      const bestRank = lvl && progress.levelRanks ? progress.levelRanks[lvl.id] : null;
      const bestScore = lvl && progress.levelScores ? progress.levelScores[lvl.id] : null;
      return {
        ...r,
        unlocked,
        levelId: lvl ? lvl.id : null,
        levelLocation: lvl ? lvl.location : '星月糖屋',
        levelTitle: lvl ? lvl.title : '',
        canPlayLevel,
        bestRank,
        bestScore
      };
    });

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
        <span class="recipe-origin">${item.unlocked
          ? `${item.bestRank ? `最佳 ${item.bestRank}级` : item.origin}${item.bestScore ? ` · ${item.bestScore}分` : ''}`
          : `📍 ${item.levelLocation}${item.canPlayLevel ? ' · 可挑战' : ''}`}</span>
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
              <span>🎮 对应玩法：${selected.minigameLabel}</span>
              <span>🏆 最佳战绩：${selected.bestRank ? `${selected.bestRank} 级` : '已通关'}${selected.bestScore ? ` · ${selected.bestScore} 分` : ''}</span>
              <span>🏠 糖屋解锁：${selected.shopReward}</span>
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
            ${selected.levelId ? `<button type="button" class="btn-primary" style="width:100%;margin-top:10px;" data-action="replayLevel" data-level="${selected.levelId}">↻ 重玩本关 · 刷新更高评级</button>` : ''}
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
            <span class="book-sub">翻开泛黄的羊皮纸，品读经典甜点风土史，也可随时重玩关卡刷新最佳评级</span>
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
      const id = target.dataset.id;
      if (!(progress.unlockedRecipeIds || []).includes(id)) {
        const lvl = LEVELS.find(l => l.recipeId === id);
        if (lvl && isLevelUnlocked(lvl, progress.completedLevelIds || [])) {
          showToast(`前往【${lvl.location}】挑战解锁！`, 1200);
          navigate('story', { levelId: lvl.id });
        } else if (lvl) {
          showToast(`需先推进前置主线后在【${lvl.location}】解锁`);
        } else {
          showToast('尚未解锁，请先通过对应剧情关卡');
        }
        return;
      }
      selectedId = id;
      render();
    } else if (action === 'replayLevel') {
      const lvlId = target.dataset.level;
      if (lvlId) navigate('minigame', { levelId: lvlId });
    } else if (action === 'closeModal') {
      selectedId = null;
      render();
    }
  };

  root.addEventListener('click', onClick);
  render();
  return () => root.removeEventListener('click', onClick);
}
