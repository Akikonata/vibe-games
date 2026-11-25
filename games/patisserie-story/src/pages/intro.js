// src/pages/intro.js
// 通用镜头移动式过场漫画播放器（支持开场序幕 + 主线 1~6 尾声过场漫画）

import { getCutscene } from '../data/cutscenes.js';
import { markIntroSeen, setStoryFlag } from '../utils/store.js';

export function mountIntroPage(root, params, { navigate, setPageTitle }) {
  const comicId = params.comicId || 'opening';
  const isReplay = params.replay === '1';
  const cutscene = getCutscene(comicId);
  setPageTitle(cutscene.title || '风铃湾过场漫画');

  let currentIndex = 0;

  function finishComic() {
    if (cutscene.id === 'opening') {
      markIntroSeen();
    } else {
      setStoryFlag(`cutscene_${cutscene.id}`, true);
    }
    navigate('home', {}, { replace: !isReplay });
  }

  function render() {
    const panel = cutscene.panels[currentIndex];
    const dotsHtml = cutscene.panels.map((p, idx) =>
      `<div class="dot ${idx === currentIndex ? 'active' : ''} ${idx < currentIndex ? 'done' : ''}"></div>`
    ).join('');

    const portraitHtml = panel.portrait
      ? `<div class="comic-portrait-wrap"><img class="comic-portrait mode-widthfix" src="${panel.portrait}" alt="" /></div>`
      : '';

    const castHtml = (panel.castRow && panel.castRow.length > 0)
      ? `<div class="comic-cast-row">${panel.castRow.map(src => `<img class="cast-bust mode-widthfix" src="${src}" alt="" />`).join('')}</div>`
      : '';

    root.innerHTML = `
      <div class="comic-shell" data-action="next">
        <div class="comic-topbar">
          <div class="comic-dots">${dotsHtml}</div>
          <div class="skip-pill" data-action="skip">跳过 ⏭</div>
        </div>

        <div class="comic-frame-outer">
          <div class="comic-tag">${panel.tag}</div>

          <div class="comic-viewport ${panel.sepia ? 'is-sepia' : ''}">
            <img class="comic-bg ${panel.camClass} mode-fill" src="${panel.bg}" alt="" />
            <div class="comic-shade"></div>
            ${portraitHtml}
            ${castHtml}
          </div>

          <div class="comic-caption-box">
            <span class="comic-caption-text">${panel.caption}</span>
            <div class="comic-footer">
              <span class="comic-page-num">${currentIndex + 1} / ${cutscene.panels.length}</span>
              ${currentIndex + 1 < cutscene.panels.length
                ? '<span class="comic-next-arrow">▶</span>'
                : '<span class="comic-next-tip finish">推开星月糖屋大门 ▶</span>'}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const onClick = (e) => {
    if (e.target.closest('[data-action="skip"]')) {
      e.stopPropagation();
      finishComic();
      return;
    }
    if (currentIndex + 1 < cutscene.panels.length) {
      currentIndex += 1;
      render();
    } else {
      finishComic();
    }
  };

  root.addEventListener('click', onClick);
  render();
  return () => root.removeEventListener('click', onClick);
}
