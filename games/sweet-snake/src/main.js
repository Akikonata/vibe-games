// src/main.js
// 《糖心蛇蛇》纯 HTML5 入口：事件委托、触控/鼠标手势、键盘方向键与生命周期绑定

import { createSweetSnakeView } from './view.js';
import { createSweetSnakeApp } from './app.js';

const view = createSweetSnakeView();
const app = createSweetSnakeApp(view);
const root = document.getElementById('app');

// 统一事件委托（无需内联 onclick）
root.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action], [data-stop]');
  if (!target) return;
  const action = target.dataset.action;
  if (!action) return;
  if (target.disabled) return;
  const fn = app[action];
  if (typeof fn === 'function') {
    fn.call(app, { ...target.dataset });
  }
});

// 棋盘触控滑动 + 鼠标拖动转向
const boardArea = document.getElementById('board-area');
boardArea.addEventListener('pointerdown', (e) => {
  app.handleSwipeStart(e.pointerId, e.clientX, e.clientY);
  try { boardArea.setPointerCapture(e.pointerId); } catch (_) {}
});
boardArea.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse' && e.buttons !== 1) return;
  app.handleSwipeMove(e.pointerId, e.clientX, e.clientY);
});
boardArea.addEventListener('pointerup', () => app.handleSwipeEnd());
boardArea.addEventListener('pointercancel', () => app.handleSwipeEnd());

// 蛇蛇花园点击互动
view.els.gardenCanvas.addEventListener('click', (e) => {
  app.tapGarden(e.clientX, e.clientY);
});

// 桌面键盘支持（方向键 / WASD 转向，Escape 暂停/继续）
window.addEventListener('keydown', (e) => {
  if (document.querySelector('.vg-dialog-backdrop')) return;
  if (e.key === 'Escape') {
    if (app.data.mode === 'playing' && !app.data.modal) app.pause();
    else if (app.data.modal === 'paused') app.resume();
    return;
  }
  const map = {
    ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
    w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0]
  };
  const dir = map[e.key] || map[e.key.toLowerCase()];
  if (!dir) return;
  if (app.data.mode === 'playing' && !app.data.modal) {
    e.preventDefault();
    if (!e.repeat) app.turn(dir[0], dir[1]);
  }
});

document.addEventListener('visibilitychange', () => {
  app.onVisibilityChange(!document.hidden);
});

window.addEventListener('resize', () => {
  app.onResize();
});

app.init();
