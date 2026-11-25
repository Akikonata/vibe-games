// src/pages/start.js
// 游戏标题首页（焦糖欧风门面 + 缓慢推镜 + 可可迎宾立绘 + 返回大厅入口）

import { loadProgress } from '../utils/store.js';

export function mountStartPage(root, _params, { navigate }) {
  const progress = loadProgress();
  const hasSeenIntro = !!progress.hasSeenIntro;
  const completedCount = (progress.completedLevelIds || []).length;

  root.innerHTML = `
    <div class="start-shell">
      <a class="portal-corner-pill" href="../../">← Vibe Games</a>
      <img class="start-bg-img mode-fill" src="assets/images/shop_facade.jpg" alt="" />
      <div class="start-vignette"></div>

      <div class="start-coco-wrap">
        <img class="start-coco-img mode-widthfix" src="assets/images/portraits/coco_happy.svg" alt="可可" />
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
            ${completedCount > 0 ? `当前已解锁 ${completedCount} / 11 道经典甜点食谱` : '轻触开启风铃湾第一卷筹备物语'}
          </span>
        </div>
      </div>
    </div>
  `;

  const onClick = (e) => {
    const btn = e.target.closest('[data-action="start"]');
    if (!btn) return;
    if (hasSeenIntro) {
      navigate('home');
    } else {
      navigate('intro', { comicId: 'opening' });
    }
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
