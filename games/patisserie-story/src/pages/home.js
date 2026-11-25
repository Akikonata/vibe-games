// src/pages/home.js
// 星月糖屋主界面（焦糖古典欧式柱廊门面 + 右侧可收起小饼干工具条 + 主线/回放/橱窗弹窗）

import { CHARACTERS } from '../data/characters.js';
import { CUTSCENES } from '../data/cutscenes.js';
import { getDashboardState, resetProgress } from '../utils/store.js';
import { showToast, showConfirmDialog } from '../../../../shared/web-ui.js';

export function mountHomePage(root, _params, { navigate }) {
  const ui = {
    toolbarOpen: true,
    showMainModal: false,
    showShowcaseModal: false,
    showReplayModal: false
  };

  function getViewData() {
    const state = getDashboardState();
    const completedLevels = state.levels.filter(l => l.completed);
    const unlockedCutscenes = [CUTSCENES.opening];
    state.levels
      .filter(l => l.chapterType === 'main' && l.completed)
      .forEach(l => {
        const c = CUTSCENES[`${l.id}_end`];
        if (c) unlockedCutscenes.push(c);
      });
    return { ...state, coco: CHARACTERS.coco, completedLevels, unlockedCutscenes };
  }

  function render() {
    const d = getViewData();

    const mainModalHtml = ui.showMainModal
      ? `<div class="modal-mask" data-action="closeMain">
          <div class="modal-card card" data-stop="true">
            <div class="modal-head">
              <div class="ribbon-title">🥐 今日主线筹备</div>
              <span class="modal-close" data-action="closeMain">✕</span>
            </div>
            ${d.nextMainLevel
              ? `<div class="chapter-title">${d.nextMainLevel.title}</div>
                 <div class="chapter-meta">
                   <span class="meta-pill">📍 ${d.nextMainLevel.location}</span>
                   <span class="meta-pill">🎮 ${d.nextMainLevel.minigameTitle}</span>
                 </div>
                 <div class="gold-divider"><div class="gold-line"></div><span>🌿 ✦ 🌿</span><div class="gold-line"></div></div>
                 <div class="chapter-reward">
                   <span class="reward-label">通关解锁食谱：</span>
                   <span class="reward-val">${d.nextMainLevel.recipeEmoji} ${d.nextMainLevel.recipeName}</span>
                 </div>
                 <div class="btn-primary start-btn" data-action="goMainStory">
                   ${d.nextMainLevel.unlocked ? '✨ 推开雕花木门 · 进入剧情' : '🔒 待解锁前置章节'}
                 </div>`
              : `<div class="chapter-title">🎉 第一卷主线已圆满收官！</div>
                 <span class="chapter-done-tip">快去风铃湾地图探索剩余支线场景，并查看已亮灯的【跨海蒸汽火车站】吧！</span>`}
          </div>
        </div>`
      : '';

    const showcaseModalHtml = ui.showShowcaseModal
      ? `<div class="modal-mask" data-action="closeShowcase">
          <div class="modal-card card" data-stop="true">
            <div class="modal-head">
              <div class="ribbon-title">🏛️ 糖屋拱廊橱窗</div>
              <span class="modal-close" data-action="closeShowcase">✕</span>
            </div>
            <div class="showcase-scroll scrollarea">
              ${d.unlockedFacilities.length > 0
                ? `<div class="window-grid">${d.unlockedFacilities.map(f => `
                    <div class="window-pane">
                      <img class="pane-img mode-fit" src="${f.iconImg}" alt="" />
                      <span class="pane-name">${f.name}</span>
                    </div>`).join('')}</div>`
                : `<div class="empty-window"><span class="empty-icon">🪴 🕯️ 🪴</span><span class="empty-text">拱形木橱窗还空着呢，点击【主线】烤出第一盘焦香玛德琳吧～</span></div>`}
            </div>
            <div class="reset-row">
              <span class="reset-link" data-action="resetProgress">↻ 重置糖屋筹备进度</span>
            </div>
          </div>
        </div>`
      : '';

    const replayModalHtml = ui.showReplayModal
      ? `<div class="modal-mask" data-action="closeReplay">
          <div class="modal-card card" data-stop="true">
            <div class="modal-head">
              <div class="ribbon-title">🎞️ 剧情回放</div>
              <span class="modal-close" data-action="closeReplay">✕</span>
            </div>
            <div class="replay-scroll scrollarea">
              ${d.unlockedCutscenes.map(c => `
                <div class="replay-row is-comic" data-action="replayCutscene" data-id="${c.id}">
                  <div class="replay-info">
                    <span class="replay-name">🎞️ ${c.title}</span>
                    <span class="replay-meta">镜头移动过场漫画 · 点击重温</span>
                  </div>
                  <div class="replay-go">观看 ▶</div>
                </div>`).join('')}
              ${d.completedLevels.map(l => `
                <div class="replay-row" data-action="replayStory" data-id="${l.id}">
                  <div class="replay-info">
                    <span class="replay-name">${l.recipeEmoji} ${l.title}</span>
                    <span class="replay-meta">📍 ${l.location} · ${l.npcName}</span>
                  </div>
                  <div class="replay-go">回放 ▶</div>
                </div>`).join('')}
              ${d.completedLevels.length === 0
                ? '<div class="replay-empty">通关更多主线与支线章节后，对应剧情也会收录在这里哦～</div>'
                : ''}
              <div class="reset-row">
                <span class="reset-link" data-action="resetProgress">↻ 重置糖屋筹备进度</span>
              </div>
            </div>
          </div>
        </div>`
      : '';

    root.innerHTML = `
      <div class="home-shell">
        <div class="caramel-canopy">
          <div class="awning-bar"></div>
          <div class="caramel-drip-edge"></div>
          <div class="canopy-vine-left"><div class="leaf-pill"></div><div class="leaf-pill alt"></div><div class="leaf-pill"></div></div>
          <div class="canopy-vine-right"><div class="leaf-pill"></div><div class="leaf-pill alt"></div><div class="leaf-pill"></div></div>
        </div>

        <div class="page-wrap home-main">
          <div class="pediment-wrap">
            <div class="pediment-crown">
              <span class="crown-leaf">🌿</span>
              <div class="madeleine-medallion">🐚</div>
              <span class="crown-leaf flip">🌿</span>
            </div>
            <div class="signboard">
              <span class="sign-main">星月糖屋 · Maison Étoile</span>
              <span class="sign-sub">✦ 风铃湾百年欧风手工甜点屋 ✦</span>
            </div>
            <div class="sign-ledge"></div>
          </div>

          <div class="colonnade-card">
            <div class="cornice-top"><div class="cornice-icing"></div></div>
            <div class="colonnade-body">
              <div class="wafer-column"><div class="col-capital"></div><div class="col-shaft"></div><div class="col-base"></div></div>
              <div class="arch-window-wrap">
                <div class="arch-vine-top"><span class="vine-sprout">🌿</span><span class="vine-sprout">🍃</span><span class="vine-sprout">🌿</span></div>
                <div class="arch-window-frame">
                  <img class="facade-img mode-fill" src="assets/images/shop_facade.jpg" alt="星月糖屋" />
                  <div class="facade-pill">✦ 第一卷 · 风铃湾篇</div>
                </div>
                <div class="windowsill">
                  <span class="sill-plant">🪴</span>
                  <div class="sill-plaque">MAISON ÉTOILE · 1898</div>
                  <span class="sill-plant">🪴</span>
                </div>
              </div>
              <div class="wafer-column"><div class="col-capital"></div><div class="col-shaft"></div><div class="col-base"></div></div>
            </div>

            <div class="colonnade-pedestal">
              <div class="coco-row">
                <div class="coco-avatar-frame">
                  <img class="coco-avatar-img mode-fill" src="assets/images/coco_avatar.png" alt="可可" />
                </div>
                <div class="coco-bubble">
                  <div class="coco-name-row">
                    <span class="coco-name">店长 ${d.coco.name}</span>
                    <span class="coco-badge">🌿 贝雷帽学徒</span>
                  </div>
                  <span class="coco-quote">
                    ${d.season1Finished
                      ? '“收到神秘旅人的《皇家甜点手账》啦！快点右侧工具条去地图看看蒸汽火车站吧！”'
                      : '“点右侧的小饼干工具条，就能开店营业、推进主线、逛风铃湾地图和翻食谱手账哦～”'}
                  </span>
                </div>
              </div>

              <div class="progress-panel" data-action="openShowcase">
                <div class="progress-head">
                  <span class="progress-label">🪙 ${d.coins} · ⭐ ${d.reputation} · 第${d.day}天</span>
                  <span class="progress-val">筹备 ${d.completedCount}/${d.totalCount}</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width: ${d.percent}%;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="side-hud ${ui.toolbarOpen ? 'is-open' : 'is-collapsed'}">
          <div class="hud-toggle-btn" data-action="toggleToolbar">
            ${!ui.toolbarOpen && d.nextMainLevel && d.nextMainLevel.unlocked ? '<div class="toggle-dot"></div>' : ''}
            <span class="toggle-icon">🍪</span>
            <span class="toggle-arrow">${ui.toolbarOpen ? '收起' : '展开'}</span>
          </div>

          ${ui.toolbarOpen
            ? `<div class="side-biscuit-list">
                <div class="biscuit-btn biscuit-honey" data-action="goShop"><div class="biscuit-inner"><span class="biscuit-icon">☕</span><span class="biscuit-name">营业</span></div></div>
                <div class="biscuit-btn biscuit-butter" data-action="openMain">
                  ${d.nextMainLevel && d.nextMainLevel.unlocked ? '<div class="biscuit-dot"></div>' : ''}
                  <div class="biscuit-inner"><span class="biscuit-icon">🥐</span><span class="biscuit-name">主线</span></div>
                </div>
                <div class="biscuit-btn biscuit-matcha" data-action="goMap"><div class="biscuit-inner"><span class="biscuit-icon">🗺️</span><span class="biscuit-name">地图</span></div></div>
                <div class="biscuit-btn biscuit-cocoa" data-action="goRecipes"><div class="biscuit-inner"><span class="biscuit-icon">📕</span><span class="biscuit-name">图鉴</span></div></div>
                <div class="biscuit-btn biscuit-honey" data-action="openReplay"><div class="biscuit-inner"><span class="biscuit-icon">🎞️</span><span class="biscuit-name">回放</span></div></div>
              </div>`
            : ''}
        </div>

        ${mainModalHtml}
        ${showcaseModalHtml}
        ${replayModalHtml}
      </div>
    `;
  }

  const onClick = async (e) => {
    const target = e.target.closest('[data-action], [data-stop]');
    if (!target || !target.dataset.action) return;
    const action = target.dataset.action;

    if (action === 'toggleToolbar') { ui.toolbarOpen = !ui.toolbarOpen; render(); }
    else if (action === 'openMain') { ui.showMainModal = true; render(); }
    else if (action === 'closeMain') { ui.showMainModal = false; render(); }
    else if (action === 'openShowcase') { ui.showShowcaseModal = true; render(); }
    else if (action === 'closeShowcase') { ui.showShowcaseModal = false; render(); }
    else if (action === 'openReplay') { ui.showReplayModal = true; render(); }
    else if (action === 'closeReplay') { ui.showReplayModal = false; render(); }
    else if (action === 'goShop') navigate('shop');
    else if (action === 'goMap') navigate('map');
    else if (action === 'goRecipes') navigate('recipes');
    else if (action === 'replayCutscene') {
      ui.showReplayModal = false;
      navigate('intro', { comicId: target.dataset.id || 'opening', replay: '1' });
    } else if (action === 'replayStory') {
      ui.showReplayModal = false;
      navigate('story', { levelId: target.dataset.id });
    } else if (action === 'goMainStory') {
      const next = getDashboardState().nextMainLevel;
      if (!next) { showToast('第一卷主线已全部通关！'); return; }
      if (!next.unlocked) { showToast('请先完成前置章节'); return; }
      ui.showMainModal = false;
      navigate('story', { levelId: next.id });
    } else if (action === 'resetProgress') {
      const ok = await showConfirmDialog({
        title: '重置筹备进度',
        content: '确定要清空当前所有已解锁食谱和关卡进度，重新开始筹备星月糖屋吗？',
        confirmText: '确认重置',
        confirmColor: '#a8541c'
      });
      if (ok) {
        resetProgress();
        ui.showShowcaseModal = false;
        ui.showReplayModal = false;
        render();
        showToast('已重置为初始状态');
      }
    }
  };

  root.addEventListener('click', onClick);
  render();
  return () => root.removeEventListener('click', onClick);
}
