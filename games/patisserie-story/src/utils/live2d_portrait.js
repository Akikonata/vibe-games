// src/utils/live2d_portrait.js
// 轻量级纯 HTML5 Live2D 风格动态立绘驱动引擎：
// 支持 60fps 呼吸律动、鼠标视线 3D 视差微跟随、说话节奏口型/点头律动、4 态情绪动作与表情特效

const EMO_META = {
  normal:    { badge: '🌿 微笑', fx: [] },
  happy:     { badge: '✨ 开心', fx: ['✨', '♪', '💗'] },
  surprised: { badge: '❗ 惊讶', fx: ['❗', '💦'] },
  serious:   { badge: '🔥 认真', fx: ['✦', '🔥'] }
};

export function getEmotionMeta(emotion) {
  return EMO_META[emotion] || EMO_META.normal;
}

/**
 * 为页面内所有 `.l2d-rig` 容器绑定 60fps 呼吸 + 鼠标 3D 视线跟随动画
 * 返回 cleanup 函数，在页面 unmount 时调用
 */
export function attachLive2DController(root) {
  let rafId = null;
  let pointerX = 0; // -1 .. 1
  let pointerY = 0; // -1 .. 1
  let smoothX = 0;
  let smoothY = 0;
  const startTs = performance.now();

  const onPointerMove = (e) => {
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    pointerX = Math.max(-1, Math.min(1, nx));
    pointerY = Math.max(-1, Math.min(1, ny));
  };

  const onPointerLeave = () => {
    pointerX = 0;
    pointerY = 0;
  };

  root.addEventListener('pointermove', onPointerMove, { passive: true });
  root.addEventListener('pointerleave', onPointerLeave, { passive: true });

  const tick = (now) => {
    const t = (now - startTs) / 1000;
    smoothX += (pointerX - smoothX) * 0.08;
    smoothY += (pointerY - smoothY) * 0.08;

    const rigs = root.querySelectorAll('.l2d-rig');
    rigs.forEach((rig, idx) => {
      const phase = idx * 1.4;
      const isSpeaking = rig.dataset.speaking === '1';
      const emo = rig.dataset.emotion || 'normal';

      // 基础呼吸（胸腔起伏 + 柔和左右微摆）
      const breathFreq = isSpeaking ? 2.6 : 1.75;
      const breath = Math.sin(t * breathFreq + phase);
      const sway = Math.sin(t * 0.95 + phase * 0.7);

      // 说话时加入细腻的点头/语调节奏
      const talkBob = isSpeaking ? Math.abs(Math.sin(t * 9.5 + phase)) * -2.2 : 0;

      // 不同情绪的姿态微调
      let emoTilt = 0;
      let emoScale = 1;
      if (emo === 'happy') {
        emoTilt = Math.sin(t * 3.2 + phase) * 1.5;
        emoScale = 1.015;
      } else if (emo === 'surprised') {
        emoTilt = -1.2;
        emoScale = 1.02;
      } else if (emo === 'serious') {
        emoTilt = 0.6;
        emoScale = 1.01;
      }

      // 鼠标视线 3D 视差微跟随（Live2D 招牌立体感）
      const rotY = (smoothX * 5.2).toFixed(2);
      const rotX = (-smoothY * 3.2).toFixed(2);
      const shiftX = (smoothX * 3.5 + sway * 1.6).toFixed(2);
      const shiftY = (breath * -2.8 + talkBob).toFixed(2);
      const scaleY = (emoScale + breath * 0.014).toFixed(4);
      const scaleX = (emoScale - breath * 0.006).toFixed(4);
      const rotZ = (sway * 0.9 + emoTilt).toFixed(2);

      rig.style.transform = `perspective(760px) translate3d(${shiftX}px, ${shiftY}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg) scale(${scaleX}, ${scaleY})`;
    });

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerleave', onPointerLeave);
  };
}

/**
 * 触发一次情绪反应粒子（如开心星星、惊讶感叹号、认真光晕）
 */
export function buildEmotionFxHtml(emotion, isSpeaking) {
  if (!isSpeaking || !emotion || emotion === 'normal') return '';
  const meta = getEmotionMeta(emotion);
  if (!meta.fx || meta.fx.length === 0) return '';
  return `<div class="l2d-emo-fx is-emo-${emotion}" aria-hidden="true">${meta.fx.map(s => `<span>${s}</span>`).join('')}</div>`;
}
