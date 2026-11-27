// src/pages/story.js
// RPG 视觉小说舞台（双人半身立绘 + S/A/B 支线剧情 + 食谱解锁奖励卡 + 自动衔接主线尾声漫画）

import { resolveStoryContext, resolveDialogueFrame } from '../utils/story_engine.js?v=20261127a';
import { setStoryFlag, hasStoryFlag, unlockDrinkByStory } from '../utils/store.js?v=20261127b';
import { getDrinkById } from '../data/drinks.js?v=20261127b';
import { getPortraitPath } from '../data/characters.js?v=20261127a';
import { CUTSCENES } from '../data/cutscenes.js';
import { attachLive2DController, getEmotionMeta, buildEmotionFxHtml } from '../utils/live2d_portrait.js?v=20261127b';

export function mountStoryPage(root, params, { navigate, setPageTitle }) {
  const drinkObj = params.drinkId ? getDrinkById(params.drinkId) : null;
  const isDrinkMode = !!drinkObj;

  let state;
  if (isDrinkMode) {
    setPageTitle(drinkObj.storyTitle || '饮品物语');
    state = {
      isDrinkMode: true,
      drink: drinkObj,
      drinkUnlockResult: null,
      level: {
        id: `drink_${drinkObj.id}`,
        title: drinkObj.storyTitle,
        location: drinkObj.storyLocation,
        bgImage: drinkObj.storyBg,
        minigameTitle: ''
      },
      recipe: null,
      phase: 'outro',
      rank: 'S',
      rankMeta: { label: '☕ 饮品配方解锁', badgeClass: 'rank-s' },
      score: 0,
      dialogueList: drinkObj.storyDialogue || [],
      currentIndex: 0,
      leftPortrait: getPortraitPath('coco', 'normal'),
      rightPortrait: getPortraitPath(drinkObj.storyNpcId || 'theo', 'normal'),
      leftEmotion: 'normal',
      rightEmotion: 'normal'
    };
  } else {
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

    state = {
      isDrinkMode: false,
      drink: null,
      drinkUnlockResult: null,
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
  }

  let stopLive2D = null;

  function advancePhase() {
    if (state.isDrinkMode) {
      state.drinkUnlockResult = unlockDrinkByStory(state.drink.id);
      state.phase = 'reward';
      render();
      return;
    }
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
          : (state.isDrinkMode
            ? '<span class="next-cue highlight">☕ 收录新饮品配方 ▶</span>'
            : (state.phase === 'intro'
              ? `<span class="next-cue highlight">✨ 开始制作：${state.level.minigameTitle} ▶</span>`
              : '<span class="next-cue highlight">📕 翻开解锁食谱 ▶</span>'));

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
    } else if (state.isDrinkMode && state.drink) {
      const dr = state.drink;
      const isNew = !!(state.drinkUnlockResult && state.drinkUnlockResult.isNew);
      bodyHtml = `
        <div class="reward-overlay">
          <div class="card reward-card">
            <div class="rank-banner rank-s">
              <span class="rank-banner-text">${isNew ? '🎉 新饮品配方解锁！口碑 +15 ⭐' : '☕ 饮品配方重温完成'}</span>
            </div>

            <div class="reward-body-scroll scrollarea">
              <div class="reward-hero">
                <div class="reward-medallion">
                  <img class="reward-svg-icon mode-fit" src="${dr.iconImg}" alt="${dr.name}" />
                </div>
                <span class="reward-name">${dr.name}</span>
                <span class="reward-en">${dr.englishName} · 现萃 ${(dr.brewTicks / 10).toFixed(1)}s</span>
                <div class="reward-facility">🪙 基础售价 ${dr.basePrice} · 原料 ${dr.unitCost} · 套餐小费 +${dr.comboTipBonus}</div>
              </div>
              <div class="culture-block">
                <span class="culture-label">☕ 饮品手账</span>
                <span class="culture-body">${dr.storyDesc}</span>
              </div>
              <div class="culture-block">
                <span class="culture-label">💡 营业机制</span>
                <span class="culture-body">在星月糖屋营业准备页勾选「今日饮品单」即可上架；营业时于左侧饮品现萃吧台现点现萃，零备货积压风险，搭配任意甜点即可触发下午茶套餐额外小费！</span>
              </div>
            </div>

            <div class="reward-actions">
              <div class="btn-primary reward-btn" data-action="goShop">🥐 前往星月糖屋上架饮品</div>
              <div class="btn-secondary reward-btn" data-action="goHome">🏠 返回星月糖屋主页</div>
            </div>
          </div>
        </div>
      `;
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
    } else if (action === 'goShop') {
      navigate('shop', {}, { replace: true });
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
