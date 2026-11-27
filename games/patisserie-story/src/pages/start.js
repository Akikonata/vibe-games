// src/pages/start.js
// 游戏标题首页（焦糖欧风门面 + 缓慢推镜 + 可可眨眼互动立绘 + 右上角游戏设置与清空存档弹窗）

import {
  loadProgress,
  loadGameSettings,
  updateGameSettings,
  resetProgress,
  resetAllTutorials
} from '../utils/store.js?v=20261127b';
import { attachLive2DController, buildEmotionFxHtml } from '../utils/live2d_portrait.js?v=20261127b';
import { showToast, showConfirmDialog } from '../../../../shared/web-ui.js';

const POKE_LINES = [
  { emo: 'happy',     img: 'assets/images/portraits/coco_happy.png?v=20261127a',     text: '✨ 欢迎来到星月糖屋！今天也要烤出最香的玛德琳～' },
  { emo: 'surprised', img: 'assets/images/portraits/coco_surprised.png?v=20261127a', text: '😮 呀！被你点到贝雷帽啦，里面的贝壳胸针会发光哦～' },
  { emo: 'serious',   img: 'assets/images/portraits/coco_serious.png?v=20261127a',   text: '🔥 风铃湾的招牌手工甜点屋，绝对不会输给流水线！' },
  { emo: 'normal',    img: 'assets/images/portraits/coco.png?v=20261127a',           text: '🥐 轻触下方按钮，和我一起推开糖屋木门吧～' }
];

export function mountStartPage(root, _params, { navigate }) {
  let pokeIdx = -1;
  let resetTimer = null;
  let settingsOpen = false;
  let stopLive2D = null;

  function render() {
    if (stopLive2D) {
      stopLive2D();
      stopLive2D = null;
    }
    const progress = loadProgress();
    const settings = loadGameSettings();
    const hasSeenIntro = !!progress.hasSeenIntro;
    const completedCount = (progress.completedLevelIds || []).length;
    const unlockedDrinkCount = (progress.unlockedDrinkIds || ['sea_latte']).length;

    const settingsModalHtml = settingsOpen
      ? `<div class="start-settings-mask" data-action="closeSettings" role="dialog" aria-modal="true" aria-label="游戏设置">
          <div class="card start-settings-card" data-stop="true">
            <div class="settings-head">
              <span class="ribbon-title">⚙️ 游戏设置</span>
              <button type="button" class="settings-close-btn" data-action="closeSettings" aria-label="关闭设置">✕</button>
            </div>

            <div class="settings-list">
              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-name">👁️ 立绘眨眼与表情特效</span>
                  <span class="setting-desc">开启自然三段式眨眼与剧情情绪小特效</span>
                </div>
                <button type="button" class="setting-toggle ${settings.portraitEffects ? 'is-on' : ''}" data-action="toggleSetting" data-key="portraitEffects">
                  ${settings.portraitEffects ? '已开启' : '已关闭'}
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-name">⏱️ 单局营业时长</span>
                  <span class="setting-desc">调整糖屋挂牌开张的每班倒计时</span>
                </div>
                <div class="setting-seg">
                  ${[60, 90, 120].map(sec => `
                    <button type="button" class="seg-btn ${settings.shiftDuration === sec ? 'is-active' : ''}" data-action="setDuration" data-val="${sec}">${sec}s</button>
                  `).join('')}
                </div>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-name">📳 触觉反馈</span>
                  <span class="setting-desc">移动端操作时的轻震动提示</span>
                </div>
                <button type="button" class="setting-toggle ${settings.haptics ? 'is-on' : ''}" data-action="toggleSetting" data-key="haptics">
                  ${settings.haptics ? '已开启' : '已关闭'}
                </button>
              </div>

              <div class="setting-row">
                <div class="setting-info">
                  <span class="setting-name">🎓 新手教学引导</span>
                  <span class="setting-desc">重置后下次进入关卡/糖屋将重新显示教学</span>
                </div>
                <button type="button" class="setting-mini-btn" data-action="resetTutorials">↻ 重置引导</button>
              </div>
            </div>

            <div class="settings-save-box">
              <div class="save-box-title">📦 当前本地存档</div>
              <div class="save-box-stats">
                <span>📅 第 ${progress.day} 天</span>
                <span>🪙 ${progress.coins}</span>
                <span>⭐ ${progress.reputation}</span>
                <span>🍰 食谱 ${completedCount}/11</span>
                <span>☕ 饮品 ${unlockedDrinkCount}/4</span>
              </div>
              <button type="button" class="settings-danger-btn" data-action="clearSave">🗑️ 清空全部存档（重新开始）</button>
            </div>
          </div>
        </div>`
      : '';

    root.innerHTML = `
      <div class="start-shell">
        <a class="portal-corner-pill" href="../../">← Vibe Games</a>
        <button type="button" class="start-settings-pill" data-action="openSettings" aria-label="游戏设置">⚙️ 设置</button>
        <img class="start-bg-img mode-fill" src="assets/images/shop_facade.jpg" alt="" />
        <div class="start-vignette"></div>

        <div class="start-coco-wrap" data-action="pokeCoco" title="点一点可可互动～">
          <div id="start-poke-bubble" class="start-poke-bubble" style="display:none;"></div>
          <div id="start-l2d-rig" class="l2d-rig" data-speaking="0" data-emotion="normal">
            <div id="start-l2d-fx"></div>
            <img id="start-coco-img" class="start-coco-img mode-widthfix" src="assets/images/portraits/coco.png?v=20261127a" alt="可可" />
          </div>
        </div>

        <div class="caramel-canopy start-canopy">
          <div class="awning-bar"></div>
          <div class="caramel-drip-edge"></div>
          <div class="canopy-vine-left">
            <div class="leaf-pill"></div>
            <div class="leaf-pill alt"></div>
          </div>
          <div class="canopy-vine-right">
            <div class="leaf-pill"></div>
            <div class="leaf-pill alt"></div>
          </div>
        </div>

        <div class="start-content">
          <div class="title-crest">
            <div class="crest-top">
              <span class="crest-leaf">🌿</span>
              <div class="crest-shell">🐚</div>
              <span class="crest-leaf flip">🌿</span>
            </div>
            <div class="crest-plaque">
              <span class="crest-en">MAISON ÉTOILE · 1898</span>
              <span class="crest-zh">甜点屋物语</span>
              <div class="crest-divider">
                <div class="crest-line"></div>
                <span class="crest-star">✦</span>
                <div class="crest-line"></div>
              </div>
              <span class="crest-sub">风铃湾的焦糖、手艺与百年食谱</span>
            </div>
          </div>

          <div class="start-actions">
            <div class="btn-primary start-cta" data-action="start">
              ${hasSeenIntro ? '✨ 继续经营星月糖屋' : '✨ 开启甜蜜物语'}
            </div>
            <span class="save-hint">
              ${completedCount > 0 ? `当前已解锁 ${completedCount} / 11 道经典甜点食谱 · ${unlockedDrinkCount} / 4 款饮品` : '轻触开启风铃湾第一卷筹备物语'}
            </span>
          </div>
        </div>

        ${settingsModalHtml}
      </div>
    `;

    stopLive2D = attachLive2DController(root);
  }

  const onClick = async (e) => {
    const target = e.target.closest('[data-action], [data-stop]');
    if (!target || !target.dataset.action) return;
    const action = target.dataset.action;

    if (action === 'openSettings') {
      settingsOpen = true;
      render();
      return;
    }
    if (action === 'closeSettings') {
      settingsOpen = false;
      render();
      return;
    }
    if (action === 'toggleSetting') {
      const key = target.dataset.key;
      const cur = loadGameSettings();
      updateGameSettings({ [key]: !cur[key] });
      render();
      showToast(key === 'portraitEffects'
        ? (!cur[key] ? '已开启立绘眨眼与表情特效' : '已关闭立绘眨眼与表情特效')
        : (!cur[key] ? '已开启触觉反馈' : '已关闭触觉反馈'));
      return;
    }
    if (action === 'setDuration') {
      const sec = Number(target.dataset.val) || 90;
      updateGameSettings({ shiftDuration: sec });
      render();
      showToast(`已将每局营业时长设为 ${sec} 秒`);
      return;
    }
    if (action === 'resetTutorials') {
      resetAllTutorials();
      showToast('✨ 已重置全部新手教学提示');
      return;
    }
    if (action === 'clearSave') {
      const ok = await showConfirmDialog({
        title: '清空全部存档',
        content: '确定要清空所有关卡、食谱、饮品、金币、装潢与剧情进度并重新开始吗？此操作无法撤销。',
        confirmText: '确认清空',
        confirmColor: '#b83224'
      });
      if (ok) {
        resetProgress();
        settingsOpen = false;
        render();
        showToast('✨ 存档已清空，随时重新开启甜蜜物语！');
      }
      return;
    }
    if (action === 'pokeCoco') {
      pokeIdx = (pokeIdx + 1) % POKE_LINES.length;
      const item = POKE_LINES[pokeIdx];
      const rig = root.querySelector('#start-l2d-rig');
      const img = root.querySelector('#start-coco-img');
      const fx = root.querySelector('#start-l2d-fx');
      const bubble = root.querySelector('#start-poke-bubble');
      if (rig) {
        rig.dataset.emotion = item.emo;
        rig.dataset.speaking = '1';
      }
      if (img) img.src = item.img;
      if (fx) fx.innerHTML = buildEmotionFxHtml(item.emo, true);
      if (bubble) {
        bubble.textContent = item.text;
        bubble.style.display = 'block';
      }
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        if (rig) {
          rig.dataset.emotion = 'normal';
          rig.dataset.speaking = '0';
        }
        if (img) img.src = 'assets/images/portraits/coco.png?v=20261127a';
        if (fx) fx.innerHTML = '';
        if (bubble) bubble.style.display = 'none';
      }, 2600);
      return;
    }
    if (action === 'start') {
      const progress = loadProgress();
      if (progress.hasSeenIntro) {
        navigate('home');
      } else {
        navigate('intro', { comicId: 'opening' });
      }
    }
  };

  root.addEventListener('click', onClick);
  render();
  return () => {
    clearTimeout(resetTimer);
    if (stopLive2D) stopLive2D();
    root.removeEventListener('click', onClick);
  };
}
