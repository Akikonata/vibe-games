// src/pages/start.js
// 游戏标题首页（焦糖欧风门面 + 缓慢推镜 + 可可迎宾立绘 + 返回大厅入口）

import { loadProgress } from '../utils/store.js';
import { attachLive2DController, buildEmotionFxHtml } from '../utils/live2d_portrait.js?v=20261126z15';

const POKE_LINES = [
  { emo: 'happy',     img: 'assets/images/portraits/coco_happy.png',     text: '✨ 欢迎来到星月糖屋！今天也要烤出最香的玛德琳～' },
  { emo: 'surprised', img: 'assets/images/portraits/coco_surprised.png', text: '😮 呀！被你点到贝雷帽啦，里面的贝壳胸针会发光哦～' },
  { emo: 'serious',   img: 'assets/images/portraits/coco_serious.png',   text: '🔥 风铃湾的招牌手工甜点屋，绝对不会输给流水线！' },
  { emo: 'normal',    img: 'assets/images/portraits/coco.png',           text: '🥐 轻触下方按钮，和我一起推开糖屋木门吧～' }
];

export function mountStartPage(root, _params, { navigate }) {
  const progress = loadProgress();
  const hasSeenIntro = !!progress.hasSeenIntro;
  const completedCount = (progress.completedLevelIds || []).length;
  let pokeIdx = -1;
  let resetTimer = null;

  root.innerHTML = `
    <div class="start-shell">
      <a class="portal-corner-pill" href="../../">← Vibe Games</a>
      <img class="start-bg-img mode-fill" src="assets/images/shop_facade.jpg" alt="" />
      <div class="start-vignette"></div>

      <div class="start-coco-wrap" data-action="pokeCoco" title="点一点可可互动～">
        <div id="start-poke-bubble" class="start-poke-bubble" style="display:none;"></div>
        <div id="start-l2d-rig" class="l2d-rig" data-speaking="0" data-emotion="normal">
          <div id="start-l2d-fx"></div>
          <img id="start-coco-img" class="start-coco-img mode-widthfix" src="assets/images/portraits/coco.png" alt="可可" />
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
            ${completedCount > 0 ? `当前已解锁 ${completedCount} / 11 道经典甜点食谱` : '轻触开启风铃湾第一卷筹备物语'}
          </span>
        </div>
      </div>
    </div>
  `;

  const stopLive2D = attachLive2DController(root);

  const onClick = (e) => {
    const poke = e.target.closest('[data-action="pokeCoco"]');
    if (poke) {
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
        if (img) img.src = 'assets/images/portraits/coco.png';
        if (fx) fx.innerHTML = '';
        if (bubble) bubble.style.display = 'none';
      }, 2600);
      return;
    }
    const btn = e.target.closest('[data-action="start"]');
    if (!btn) return;
    if (hasSeenIntro) {
      navigate('home');
    } else {
      navigate('intro', { comicId: 'opening' });
    }
  };
  root.addEventListener('click', onClick);
  return () => {
    clearTimeout(resetTimer);
    stopLive2D();
    root.removeEventListener('click', onClick);
  };
}
