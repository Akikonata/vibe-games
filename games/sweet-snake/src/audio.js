// src/audio.js
// 纯 HTML5 Audio API 音效与背景音乐引擎（自动兼容移动端与桌面端首次手势解锁）

export function createAudio(enabled, bgmEnabled) {
  const isBgmEnabled = typeof bgmEnabled === 'function' ? bgmEnabled : enabled;
  const sfxCache = new Map();
  let bgm = null;
  let bgmPlaying = false;
  let whooshAt = 0;

  function play(name) {
    if (!enabled() || typeof Audio === 'undefined') return;
    try {
      let player = sfxCache.get(name);
      if (!player) {
        player = new Audio(`assets/${name}.wav`);
        player.volume = 0.65;
        player.preload = 'auto';
        sfxCache.set(name, player);
      }
      player.currentTime = 0;
      const promise = player.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {});
      }
    } catch (_) {}
  }

  function ensureBgm() {
    if (bgm || typeof Audio === 'undefined') return bgm;
    try {
      bgm = new Audio('assets/bgm.m4a');
      bgm.loop = true;
      bgm.volume = 0.32;
      bgm.preload = 'auto';
      bgm.addEventListener('play', () => { bgmPlaying = true; });
      bgm.addEventListener('pause', () => { bgmPlaying = false; });
      bgm.addEventListener('ended', () => { bgmPlaying = false; });
      bgm.addEventListener('error', () => { bgmPlaying = false; });
    } catch (_) {
      bgm = null;
    }
    return bgm;
  }

  function startBgm() {
    if (!isBgmEnabled()) return;
    const player = ensureBgm();
    if (!player || bgmPlaying) return;
    try {
      const promise = player.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => { bgmPlaying = false; });
      }
    } catch (_) {
      bgmPlaying = false;
    }
  }

  function pauseBgm() {
    if (!bgm) return;
    bgmPlaying = false;
    try {
      bgm.pause();
    } catch (_) {}
  }

  function syncBgm() {
    if (isBgmEnabled()) startBgm();
    else pauseBgm();
  }

  function stopSfx() {
    for (const player of sfxCache.values()) {
      try {
        player.pause();
        player.currentTime = 0;
      } catch (_) {}
    }
  }

  return {
    playClick: () => play('click'),
    playEat: () => play('eat'),
    playBonus: () => play('bonus'),
    playGameOver: () => play('gameover'),
    playNewRecord: () => play('record'),
    playBoostWhoosh() {
      const now = Date.now();
      if (now - whooshAt > 350) {
        whooshAt = now;
        play('boost');
      }
    },
    startBgm,
    pauseBgm,
    syncBgm,
    stopSfx,
    stop() {
      stopSfx();
      pauseBgm();
    },
    destroy() {
      stopSfx();
      pauseBgm();
      sfxCache.clear();
      bgm = null;
    }
  };
}
