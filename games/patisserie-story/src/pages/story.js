// src/pages/story.js
// RPG 视觉小说舞台（双人半身立绘 + S/A/B 支线剧情 + 食谱解锁奖励卡 + 自动衔接主线尾声漫画）

import { resolveStoryContext, resolveDialogueFrame } from '../utils/story_engine.js?v=20261126z12';
import { setStoryFlag, hasStoryFlag } from '../utils/store.js';
import { CUTSCENES } from '../data/cutscenes.js';
import { attachLive2DController, getEmotionMeta, buildEmotionFxHtml } from '../utils/live2d_portrait.js?v=20261126z12';

export function mountStoryPage(root, params, { navigate, setPageTitle }) {
  const ctx = resolveStoryContext({
    levelId: params.levelId || 'main_1',
    phase: params.phase || 'intro',
    rank: params.rank || 'A',
    score: params.score || 0
  });

  if (ctx.branchFlag) {
    setStoryFlag(ctx.branchFlag, true);
  }

  setPageTitle(ctx.level.title || '甜点屋物语');

  const state = {
    level: ctx.level,
    recipe: ctx.recipe,
    phase: ctx.phase,
    rank: ctx.rank,
    rankMeta: ctx.rankMeta,
    score: ctx.score,
    dialogueList: ctx.dialogueList,
    currentIndex: 0,
    leftPortrait: ctx.initialLeftPortrait,
    rightPortrait: ctx.initialRightPortrait,
    leftEmotion: 'normal',
    rightEmotion: 'normal'
  };

  let stopLive2D = null;

  function advancePhase() {
    if (state.phase === 'intro') {
      navigate('minigame', { levelId: state.level.id }, { replace: true });
    } else if (state.phase === 'outro') {
      state.phase = 'reward';
      render();
    }
  }

  function render() {
    const bg = state.level.bgImage || 'assets/images/shop_facade.jpg';

    let bodyHtml = '';
    if (state.phase !== 'reward') {
      const frame = resolveDialogueFrame(state.dialogueList[state.currentIndex]);
      if (frame) {
        const curEmo = frame.emotion || 'normal';
        if (frame.isCoco) {
          state.leftPortrait = frame.portraitUrl;
          state.leftEmotion = curEmo;
        } else {
          state.rightPortrait = frame.portraitUrl;
          state.rightEmotion = curEmo;
        }
        const emoMeta = getEmotionMeta(curEmo);

        const nextCue = state.currentIndex + 1 < state.dialogueList.length
          ? '<span class="next-cue">点击继续 ▼</span>'
          : (state.phase === 'intro'
            ? `<span class="next-cue highlight">✨ 开始制作：${state.level.minigameTitle} ▶</span>`
            : '<span class="next-cue highlight">📕 翻开解锁食谱 ▶</span>');

        bodyHtml = `
          <div class="vn-theatre" data-action="nextLine">
            <div class="portraits-layer">
              <div class="portrait-slot slot-left ${frame.activeSide === 'left' ? 'is-speaking' : 'is-listening'} l2d-react-${frame.activeSide === 'left' ? state.leftEmotion : 'idle'}">
                <div class="l2d-rig" data-speaking="${frame.activeSide === 'left' ? '1' : '0'}" data-emotion="${state.leftEmotion}">
                  ${buildEmotionFxHtml(state.leftEmotion, frame.activeSide === 'left')}
                  <img class="character-bust mode-widthfix" src="${state.leftPortrait}" alt="可可" />
                </div>
              </div>
              <div class="portrait-slot slot-right ${frame.activeSide === 'right' ? 'is-speaking' : 'is-listening'} l2d-react-${frame.activeSide === 'right' ? state.rightEmotion : 'idle'}">
                <div class="l2d-rig" data-speaking="${frame.activeSide === 'right' ? '1' : '0'}" data-emotion="${state.rightEmotion}">
                  ${buildEmotionFxHtml(state.rightEmotion, frame.activeSide === 'right')}
                  <img class="character-bust mode-widthfix" src="${state.rightPortrait}" alt="" />
                </div>
              </div>
            </div>

            <div class="rpg-dialog-wrap">
              <div class="nameplate-row ${frame.activeSide === 'right' ? 'align-right' : ''}">
                <div class="nameplate" style="border-color: ${frame.speaker.themeColor};">
                  <span class="speaker-name">${frame.speaker.name}</span>
                  <span class="speaker-emo">${emoMeta.badge}</span>
                </div>
                <span class="speaker-role">${frame.speaker.title}</span>
              </div>
              <div class="rpg-dialog-box">
                <span class="rpg-dialog-text">${frame.line.text}</span>
                <div class="rpg-dialog-footer">
                  <span class="step-counter">${state.currentIndex + 1} / ${state.dialogueList.length}</span>
                  ${nextCue}
                </div>
              </div>
            </div>
          </div>
        `;
      }
    } else if (state.recipe) {
      const r = state.recipe;
      bodyHtml = `
        <div class="reward-overlay">
          <div class="card reward-card">
            <div class="rank-banner ${state.rankMeta.badgeClass}">
              <span class="rank-banner-text">${state.rankMeta.label}</span>
              ${state.score > 0 ? `<span class="rank-score"> · ${state.score} 分</span>` : ''}
            </div>

            <div class="reward-body-scroll scrollarea">
              <div class="reward-hero">
                <div class="reward-medallion">
                  <img class="reward-svg-icon mode-fit" src="${r.iconImg}" alt="${r.name}" />
                </div>
                <span class="reward-name">${r.name}</span>
                <span class="reward-en">${r.englishName} · ${r.origin}</span>
                <div class="reward-facility">🏠 糖屋升级：${r.shopReward}</div>
              </div>
              <div class="culture-block">
                <span class="culture-label">📜 甜点发展史</span>
                <span class="culture-body">${r.history}</span>
              </div>
              <div class="culture-block">
                <span class="culture-label">🌍 文化背景</span>
                <span class="culture-body">${r.culture}</span>
              </div>
            </div>

            <div class="reward-actions">
              <div class="btn-primary reward-btn" data-action="goHome">${state.level.chapterType === 'main' && CUTSCENES[`${state.level.id}_end`] && !hasStoryFlag(`cutscene_${state.level.id}_end`) ? '📖 继续章节尾声' : '🏠 返回星月糖屋'}</div>
              ${state.rank !== 'S'
                ? '<div class="btn-secondary reward-btn" data-action="retryForS">↻ 再挑战冲 S 级（解锁传奇剧情）</div>'
                : '<div class="btn-secondary reward-btn" data-action="goRecipes">📕 翻阅复古食谱手账</div>'}
            </div>
          </div>
        </div>
      `;
    }

    root.innerHTML = `
      <div class="rpg-stage">
        <img class="rpg-bg-img mode-fill" src="${bg}" alt="" />
        <div class="rpg-bg-overlay"></div>

        <div class="rpg-topbar">
          <div class="loc-plaque">
            <span class="loc-title">${state.level.title}</span>
            <span class="loc-sub">📍 ${state.level.location}</span>
          </div>
          ${state.phase !== 'reward' ? '<div class="skip-btn" data-action="skip">跳过 ⏭</div>' : ''}
        </div>

        ${bodyHtml}
      </div>
    `;
  }

  const onClick = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'skip') {
      advancePhase();
    } else if (action === 'nextLine') {
      if (state.currentIndex + 1 < state.dialogueList.length) {
        state.currentIndex += 1;
        render();
      } else {
        advancePhase();
      }
    } else if (action === 'retryForS') {
      navigate('minigame', { levelId: state.level.id }, { replace: true });
    } else if (action === 'goRecipes') {
      navigate('recipes', {}, { replace: true });
    } else if (action === 'goHome') {
      if (state.phase === 'reward' && state.level.chapterType === 'main') {
        const endComicId = `${state.level.id}_end`;
        if (CUTSCENES[endComicId] && !hasStoryFlag(`cutscene_${endComicId}`)) {
          navigate('intro', { comicId: endComicId }, { replace: true });
          return;
        }
      }
      navigate('home', {}, { replace: true });
    }
  };

  root.addEventListener('click', onClick);
  render();
  stopLive2D = attachLive2DController(root);
  return () => {
    if (stopLive2D) stopLive2D();
    root.removeEventListener('click', onClick);
  };
}
