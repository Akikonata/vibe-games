// src/utils/live2d_portrait.js
// 真实面部表情与丝滑三段式眨眼立绘驱动（open -> half -> closed -> half -> open，叠层透明度过渡，零闪烁不突兀）

const EMO_META = {
  normal:    { badge: '🌿 微笑', fx: [] },
  happy:     { badge: '✨ 开心', fx: ['✨', '♪'] },
  surprised: { badge: '❗ 惊讶', fx: ['❗'] },
  serious:   { badge: '🔥 认真', fx: [] }
};

// 像素级对齐的三段式眨眼帧（半闭眼 + 全闭眼）
const BLINK_FRAMES = {
  'assets/images/portraits/coco.png': {
    half:   'assets/images/portraits/coco_blink_half.png?v=20261127a',
    closed: 'assets/images/portraits/coco_blink.png?v=20261127a'
  }
};

// 预加载全部眨眼帧与表情差分
[
  'assets/images/portraits/coco_blink_half.png?v=20261127a',
  'assets/images/portraits/coco_blink.png?v=20261127a',
  'assets/images/portraits/coco_happy.png?v=20261127a',
  'assets/images/portraits/coco_surprised.png?v=20261127a',
  'assets/images/portraits/coco_serious.png?v=20261127a'
].forEach(src => {
  const img = new Image();
  img.src = src;
});

export function getEmotionMeta(emotion) {
  return EMO_META[emotion] || EMO_META.normal;
}

/**
 * 为页面内 `.l2d-rig` 立绘绑定丝滑三段式眨眼（使用预解码叠层 opacity 淡入淡出，彻底告别生硬跳帧！）
 */
export function attachLive2DController(root) {
  let stopped = false;
  let nextTimer = null;
  let stepTimers = [];

  function trackTimer(fn, ms) {
    const id = setTimeout(() => {
      if (!stopped) fn();
    }, ms);
    stepTimers.push(id);
    return id;
  }

  function ensureOverlays(rig, frames) {
    let halfEl = rig.querySelector('.l2d-blink-half');
    let closedEl = rig.querySelector('.l2d-blink-closed');
    if (!halfEl) {
      halfEl = document.createElement('img');
      halfEl.className = 'l2d-blink-overlay l2d-blink-half';
      halfEl.alt = '';
      halfEl.setAttribute('aria-hidden', 'true');
      rig.appendChild(halfEl);
    }
    if (!closedEl) {
      closedEl = document.createElement('img');
      closedEl.className = 'l2d-blink-overlay l2d-blink-closed';
      closedEl.alt = '';
      closedEl.setAttribute('aria-hidden', 'true');
      rig.appendChild(closedEl);
    }
    if (halfEl.getAttribute('src') !== frames.half) halfEl.setAttribute('src', frames.half);
    if (closedEl.getAttribute('src') !== frames.closed) closedEl.setAttribute('src', frames.closed);
    return { halfEl, closedEl };
  }

  function playSmoothBlink(rig) {
    const baseImg = rig.querySelector('img:not(.l2d-blink-overlay)');
    if (!baseImg) return;
    const baseSrc = (baseImg.getAttribute('src') || '').split('?')[0];
    const frames = BLINK_FRAMES[baseSrc];
    if (!frames) return;

    const { halfEl, closedEl } = ensureOverlays(rig, frames);

    // 丝滑 4 拍眨眼曲线：0ms 半闭 -> 50ms 全闭 -> 125ms 半闭 -> 175ms 睁开
    halfEl.style.opacity = '1';
    closedEl.style.opacity = '0';

    trackTimer(() => {
      closedEl.style.opacity = '1';
    }, 50);

    trackTimer(() => {
      closedEl.style.opacity = '0';
      halfEl.style.opacity = '1';
    }, 125);

    trackTimer(() => {
      halfEl.style.opacity = '0';
    }, 175);
  }

  function scheduleBlink() {
    if (stopped) return;
    const delay = 3000 + Math.floor(Math.random() * 2600);
    nextTimer = setTimeout(() => {
      if (stopped) return;
      root.querySelectorAll('.l2d-rig').forEach(rig => playSmoothBlink(rig));

      // 20% 概率自然双连眨眼
      if (Math.random() < 0.2) {
        trackTimer(() => {
          root.querySelectorAll('.l2d-rig').forEach(rig => playSmoothBlink(rig));
        }, 310);
      }
      scheduleBlink();
    }, delay);
  }

  scheduleBlink();

  return () => {
    stopped = true;
    clearTimeout(nextTimer);
    stepTimers.forEach(id => clearTimeout(id));
    stepTimers = [];
  };
}

/**
 * 轻量表情气泡特效（仅在开心/惊讶时点缀，人物本体稳重不乱晃）
 */
export function buildEmotionFxHtml(emotion, isSpeaking) {
  if (!isSpeaking || !emotion || emotion === 'normal') return '';
  const meta = getEmotionMeta(emotion);
  if (!meta.fx || meta.fx.length === 0) return '';
  return `<div class="l2d-emo-fx is-emo-${emotion}" aria-hidden="true">${meta.fx.map(s => `<span>${s}</span>`).join('')}</div>`;
}
