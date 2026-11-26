// src/utils/live2d_portrait.js
// 真实面部表情与自然眨眼立绘驱动（拒绝纸片乱飘！人物稳稳站立，专注眨眼、微笑、惊讶、认真等面部差分）

const EMO_META = {
  normal:    { badge: '🌿 微笑', fx: [] },
  happy:     { badge: '✨ 开心', fx: ['✨', '♪'] },
  surprised: { badge: '❗ 惊讶', fx: ['❗'] },
  serious:   { badge: '🔥 认真', fx: [] }
};

// 拥有像素级对齐闭眼眨眼帧的立绘映射
const BLINK_MAP = {
  'assets/images/portraits/coco.png': 'assets/images/portraits/coco_blink.png'
};

// 预加载眨眼帧与表情差分，保证切换 0 闪烁
Object.values(BLINK_MAP).concat([
  'assets/images/portraits/coco_happy.png',
  'assets/images/portraits/coco_surprised.png',
  'assets/images/portraits/coco_serious.png'
]).forEach(src => {
  const img = new Image();
  img.src = src;
});

export function getEmotionMeta(emotion) {
  return EMO_META[emotion] || EMO_META.normal;
}

/**
 * 为页面内 `.l2d-rig` 立绘绑定真实自然眨眼定时器（人物本体静止稳重，不晃动、不倾斜）
 */
export function attachLive2DController(root) {
  let stopped = false;
  let nextTimer = null;
  let restoreTimers = [];

  function clearRestoreTimers() {
    restoreTimers.forEach(id => clearTimeout(id));
    restoreTimers = [];
  }

  function triggerBlinkOnImg(img) {
    if (!img) return;
    const rawSrc = img.getAttribute('src') || '';
    const baseSrc = rawSrc.split('?')[0];
    const blinkSrc = BLINK_MAP[baseSrc];
    if (!blinkSrc) return;

    img.dataset.openSrc = rawSrc;
    img.setAttribute('src', blinkSrc);
    const t1 = setTimeout(() => {
      if (stopped) return;
      if ((img.getAttribute('src') || '').startsWith(blinkSrc)) {
        img.setAttribute('src', img.dataset.openSrc || baseSrc);
      }
    }, 135);
    restoreTimers.push(t1);
  }

  function scheduleBlink() {
    if (stopped) return;
    const delay = 2600 + Math.floor(Math.random() * 2400);
    nextTimer = setTimeout(() => {
      if (stopped) return;
      const imgs = root.querySelectorAll('.l2d-rig img');
      imgs.forEach(img => triggerBlinkOnImg(img));

      // 25% 概率触发自然的双连眨眼
      if (Math.random() < 0.25) {
        const t2 = setTimeout(() => {
          if (stopped) return;
          root.querySelectorAll('.l2d-rig img').forEach(img => triggerBlinkOnImg(img));
        }, 260);
        restoreTimers.push(t2);
      }
      scheduleBlink();
    }, delay);
  }

  scheduleBlink();

  return () => {
    stopped = true;
    clearTimeout(nextTimer);
    clearRestoreTimers();
  };
}

/**
 * 轻量表情气泡特效（仅在开心/惊讶时点缀，绝不带动人物乱晃）
 */
export function buildEmotionFxHtml(emotion, isSpeaking) {
  if (!isSpeaking || !emotion || emotion === 'normal') return '';
  const meta = getEmotionMeta(emotion);
  if (!meta.fx || meta.fx.length === 0) return '';
  return `<div class="l2d-emo-fx is-emo-${emotion}" aria-hidden="true">${meta.fx.map(s => `<span>${s}</span>`).join('')}</div>`;
}
