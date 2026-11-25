// src/app.js
// 《糖心蛇蛇》纯 HTML5 主控制器（零小程序 API，使用标准 Canvas 2D、rAF、localStorage 与原生 Audio）

import { createGame, GRID_COLS, GRID_ROWS } from './engine.js';
import { LEVELS, getLevel } from './levels.js';
import { ITEMS, getItem } from './items.js';
import { SNAKES, getSnake } from './snakes.js';
import { createGarden } from './garden.js';
import { createAudio } from './audio.js';
import { createStorage, showToast, showConfirmDialog, vibrateLight } from '../../../shared/web-ui.js';

const storage = createStorage('sweet_snake_html5');
const BEST_KEY = 'level_best_v1';
const PROGRESS_KEY = 'level_progress_v1';
const COLLECTION_KEY = 'collection_v1';
const SETTINGS_KEY = 'settings_v1';
const GUIDE_KEY = 'guide_done_v1';
const SHOP_GUIDE_KEY = 'shop_guide_done_v1';

const DEFAULT_SETTINGS = { bgm: true, sound: true, vibration: true };
const STARTER_INVENTORY = { slow: 1, magnet: 1, time: 1, doubleCoin: 1, revive: 1 };
const MAX_ITEM_STOCK = 99;
const SHOP_UNLOCK_LEVEL = 5;
const CONTINUE_REVIVE_COST = getItem('revive').price;
const CONTINUE_TIME_COST = getItem('time').price;
const LEVELS_PER_PAGE = 10;
const MAP_CHAPTER_NAMES = ['草莓甜心草甸', '蜜桃樱花果林', '奶油糖果小径', '果香秘境', '星光云端'];
const MAP_ANCHORS = [
  [112, 1320], [306, 1232], [118, 1105], [302, 974], [155, 838],
  [312, 704], [118, 580], [308, 456], [128, 342], [215, 246]
];

const COIN_DROPS = [
  { id: 1, left: 8, delay: 0, dur: 1.05, size: 26, tier: 1 },
  { id: 2, left: 22, delay: 0.16, dur: 0.98, size: 23, tier: 1 },
  { id: 3, left: 44, delay: 0.08, dur: 1.06, size: 28, tier: 1 },
  { id: 4, left: 64, delay: 0.22, dur: 0.96, size: 25, tier: 1 },
  { id: 5, left: 82, delay: 0.12, dur: 1.04, size: 24, tier: 1 },
  { id: 6, left: 34, delay: 0.36, dur: 1.0, size: 26, tier: 1 },
  { id: 7, left: 14, delay: 0.28, dur: 0.95, size: 24, tier: 2 },
  { id: 8, left: 52, delay: 0.32, dur: 1.08, size: 29, tier: 2 },
  { id: 9, left: 72, delay: 0.05, dur: 1.12, size: 27, tier: 2 },
  { id: 10, left: 90, delay: 0.24, dur: 0.94, size: 22, tier: 2 },
  { id: 11, left: 28, delay: 0.46, dur: 0.96, size: 28, tier: 3 },
  { id: 12, left: 58, delay: 0.42, dur: 0.92, size: 26, tier: 3 },
  { id: 13, left: 76, delay: 0.48, dur: 1.04, size: 30, tier: 3 },
  { id: 14, left: 40, delay: 0.52, dur: 0.98, size: 25, tier: 3 }
];

const CONFETTI_DROPS = [
  { id: 1, left: 12, delay: 0.05, dur: 1.35, w: 9, h: 15, color: '#ff7eb3', ribbon: true, tier: 1 },
  { id: 2, left: 30, delay: 0.22, dur: 1.25, w: 8, h: 8, color: '#ffe066', ribbon: false, tier: 1 },
  { id: 3, left: 55, delay: 0.12, dur: 1.4, w: 9, h: 16, color: '#7fe0a5', ribbon: true, tier: 1 },
  { id: 4, left: 78, delay: 0.28, dur: 1.3, w: 8, h: 8, color: '#86ccf9', ribbon: false, tier: 1 },
  { id: 5, left: 20, delay: 0.34, dur: 1.28, w: 10, h: 18, color: '#c59cff', ribbon: true, tier: 2 },
  { id: 6, left: 42, delay: 0.18, dur: 1.38, w: 9, h: 9, color: '#ff9ec8', ribbon: false, tier: 2 },
  { id: 7, left: 66, delay: 0.08, dur: 1.22, w: 10, h: 17, color: '#ffd447', ribbon: true, tier: 2 },
  { id: 8, left: 86, delay: 0.38, dur: 1.32, w: 8, h: 15, color: '#ff7eb3', ribbon: true, tier: 2 },
  { id: 9, left: 6, delay: 0.42, dur: 1.26, w: 9, h: 9, color: '#7fe0a5', ribbon: false, tier: 2 },
  { id: 10, left: 48, delay: 0.46, dur: 1.3, w: 10, h: 18, color: '#86ccf9', ribbon: true, tier: 2 },
  { id: 11, left: 16, delay: 0.15, dur: 1.18, w: 11, h: 19, color: '#ffe066', ribbon: true, tier: 3 },
  { id: 12, left: 36, delay: 0.5, dur: 1.24, w: 10, h: 10, color: '#ff6ca4', ribbon: false, tier: 3 },
  { id: 13, left: 60, delay: 0.26, dur: 1.16, w: 11, h: 20, color: '#c59cff', ribbon: true, tier: 3 },
  { id: 14, left: 74, delay: 0.44, dur: 1.22, w: 9, h: 16, color: '#7fe0a5', ribbon: true, tier: 3 },
  { id: 15, left: 92, delay: 0.1, dur: 1.28, w: 9, h: 9, color: '#ff9ec8', ribbon: false, tier: 3 },
  { id: 16, left: 26, delay: 0.56, dur: 1.2, w: 10, h: 18, color: '#86ccf9', ribbon: true, tier: 3 }
];

function sizeHiDpiCanvas(canvas, cssWidth, cssHeight) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = Math.max(1, Math.round(cssWidth * dpr));
  const h = Math.max(1, Math.round(cssHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, dpr };
}

export function createSweetSnakeApp(view) {
  const app = {
    data: {
      ready: false, error: '', mode: 'start', modal: 'home',
      shopTab: 'items', shopUnlocked: false, shopGuideStep: 0, shopGuideDone: false, shopJustUnlocked: false,
      guideStep: 0, guideDone: false, isTutorial: false, tutorialStep: 0, tutorialSwiped: false, itemOnBoard: false,
      score: 0, best: 0, newRecord: false, settings: { ...DEFAULT_SETTINGS },
      level: 1, levelName: LEVELS[0].name, themeHint: LEVELS[0].themeHint, target: LEVELS[0].target, progress: 0,
      unlocked: 1, completed: false, failureReason: '', levelChoices: [], levelPage: 1, levelPageCount: 1,
      collected: 0, remaining: 60, stars: 0, targetType: 'strawberry', targetName: '草莓', targetIcon: '🍓',
      missions: LEVELS[0].missions.map(m => ({ ...m, collected: 0, done: false })),
      bestStars: {}, inventory: {}, warehouseItems: [], ownedItems: [], rewardName: '',
      selectedItem: '', selectedItemInfo: null, selectedCount: 0,
      items: ITEMS, equippedItem: 'slow', equipped: ITEMS[0], activeItem: '', itemReady: true, itemSeconds: 0,
      coins: 0, levelCoins: 0, doubleCoinActive: false, reviveArmed: false, reviveUsed: false, shieldSeconds: 0,
      continueReviveCost: CONTINUE_REVIVE_COST, continueTimeCost: CONTINUE_TIME_COST,
      useDoubleCoin: false, useRevive: false, lastChosenHint: '',
      unlockedSnakes: ['strawberry'], activeSkin: 'strawberry', activeSnakeInfo: SNAKES[0], snakeCards: [],
      gardenWidth: 340, gardenHeight: 460,
      settleAnimating: false, settleRaining: false, settleTier: 1, settleStars: 0,
      settleTimeLeft: 0, settlePickedCoins: 0, settleTimeCoins: 0, settleTotalCoins: 0, settleMultiplier: 1,
      recordBrokeNow: false,
      coinDrops: COIN_DROPS,
      confettiDrops: CONFETTI_DROPS,
      mapMirrored: false, mapTransition: '', chapterName: MAP_CHAPTER_NAMES[0],
      mapWidth: 375, mapHeight: 1273, mapViewportHeight: 603, mapScrollTop: 0, mapDetail: null,
      totalStars: 0, maxStars: 150, chapterStars: 0, chapterMaxStars: 30, chapterProgress: 0,
      chapterStart: 1, chapterEnd: 10, trailCount: 1,
      boardWidth: 288, boardHeight: 336, compact: false, safeBottom: 12
    },

    _visible: true,
    _destroyed: false,
    _game: null,
    _garden: null,
    _rafId: null,
    _gardenRafId: null,
    _lastTime: 0,
    _gardenLast: 0,
    _touch: null,

    setData(patch, cb) {
      Object.assign(this.data, patch);
      view.render(this.data);
      if (typeof cb === 'function') cb();
    },

    init() {
      let settings = { ...DEFAULT_SETTINGS };
      let best = 0;
      let unlocked = 1;
      let completed = false;

      const savedSettings = storage.get(SETTINGS_KEY);
      if (savedSettings && typeof savedSettings === 'object') {
        settings.bgm = savedSettings.bgm !== false;
        settings.sound = savedSettings.sound !== false;
        settings.vibration = savedSettings.vibration !== false;
      }
      storage.set(SETTINGS_KEY, settings);

      const progress = storage.get(PROGRESS_KEY);
      if (progress && typeof progress === 'object') {
        unlocked = getLevel(progress.completed === true && Number(progress.unlocked) === 10 ? 11 : progress.unlocked).number;
        completed = progress.completed === true && unlocked === LEVELS.length;
      }

      const storedBest = Number(storage.get(BEST_KEY));
      if (Number.isFinite(storedBest) && storedBest > 0) best = storedBest;

      let collection = {
        stars: {},
        inventory: { ...STARTER_INVENTORY },
        coins: 0,
        unlockedSnakes: ['strawberry'],
        activeSkin: 'strawberry'
      };
      const savedCol = storage.get(COLLECTION_KEY);
      if (savedCol && typeof savedCol === 'object') {
        const inv = { ...savedCol.inventory };
        if (inv.doubleCoin === undefined) inv.doubleCoin = 1;
        if (inv.revive === undefined) inv.revive = 1;
        collection = {
          stars: savedCol.stars || {},
          inventory: inv,
          coins: Math.max(0, Number(savedCol.coins) || 0),
          unlockedSnakes: Array.isArray(savedCol.unlockedSnakes) && savedCol.unlockedSnakes.length
            ? savedCol.unlockedSnakes : ['strawberry'],
          activeSkin: getSnake(savedCol.activeSkin).id
        };
      } else {
        storage.set(COLLECTION_KEY, collection);
      }

      const guideDone = storage.get(GUIDE_KEY) === true;
      const shopGuideDone = storage.get(SHOP_GUIDE_KEY) === true;
      const shopUnlocked = unlocked >= SHOP_UNLOCK_LEVEL || (Number(collection.stars[SHOP_UNLOCK_LEVEL - 1]) || 0) >= 1;
      const level = getLevel(unlocked);

      this.setData({
        settings, best, unlocked, completed, guideDone, shopUnlocked, shopGuideDone,
        coins: collection.coins, unlockedSnakes: collection.unlockedSnakes, activeSkin: collection.activeSkin,
        level: level.number, levelName: level.name, themeHint: level.themeHint,
        target: level.target, targetType: level.targetType, targetName: level.targetName, targetIcon: level.targetIcon,
        missions: level.missions.map(m => ({ ...m, collected: 0, done: false })),
        remaining: level.timeLimit, bestStars: collection.stars, inventory: collection.inventory
      });

      this.refreshWarehouse();
      this.refreshSnakeCards();
      this.refreshLevelChoices();
      this._audio = createAudio(() => this.data.settings.sound, () => this.data.settings.bgm);
      this.layout();
      this.initCanvas();
    },

    layout() {
      const container = document.getElementById('app');
      const w = container ? container.clientWidth : window.innerWidth;
      const h = container ? container.clientHeight : window.innerHeight;
      const compact = h < 690;
      const reserve = compact ? 96 : 106;
      const padBottom = 8;
      const tile = Math.max(12, Math.floor(Math.min((w - 16) / GRID_COLS, (h - reserve - padBottom) / GRID_ROWS, 56)));
      this._tile = tile;
      const gardenWidth = Math.max(260, Math.min(430, w - 20));
      const gardenHeight = Math.max(340, Math.min(640, h - 118 - padBottom));
      this.setData({
        boardWidth: tile * GRID_COLS,
        boardHeight: tile * GRID_ROWS,
        gardenWidth,
        gardenHeight,
        compact,
        safeBottom: padBottom,
        mapWidth: w,
        mapHeight: Math.round(w * 1460 / 430),
        mapViewportHeight: h
      });
    },

    initCanvas() {
      if (this._destroyed || this._game) return;
      try {
        const { ctx } = sizeHiDpiCanvas(view.els.gameCanvas, this.data.boardWidth, this.data.boardHeight);
        this._game = createGame(ctx, {
          level: this.data.level,
          best: this.data.best,
          skinId: this.data.activeSkin,
          audio: this._audio,
          onLevelClear: (lvl, stars, summary) => this.saveProgress(lvl, stars, summary),
          onRevive: reason => showToast(reason === 'timeout' ? '💖 复活卡生效！续命 +20 秒' : '💖 复活卡生效！获得 3 秒护盾'),
          consumeItem: id => this.consumeItem(id),
          getItemCount: id => Number(this.data.inventory[id]) || 0,
          saveBest: value => storage.set(BEST_KEY, value),
          onChange: state => this.syncState(state)
        });
        this.sizeCanvas();
        this.setData({ ready: true, error: '' });
        this.runLoop();
      } catch (err) {
        this._game = null;
        console.error('Canvas initialization failed', err);
        this.setData({ error: '画布未能加载，请重试', ready: false });
      }
    },

    sizeCanvas() {
      if (!this._game) return;
      sizeHiDpiCanvas(view.els.gameCanvas, this.data.boardWidth, this.data.boardHeight);
      this._game.resize(this._tile, 1);
    },

    syncState(state) {
      if (this._destroyed) return;
      if (state.mode && state.mode !== 'playing') this._touch = null;
      const patch = {};
      Object.keys(state).forEach(k => {
        if (k === 'missions') {
          const sig = Array.isArray(state.missions) ? state.missions.map(m => `${m.type}:${m.collected}/${m.target}`).join(',') : '';
          if (sig !== this._missionsSig) {
            this._missionsSig = sig;
            patch.missions = state.missions;
          }
        } else if (this.data[k] !== state[k]) {
          patch[k] = state[k];
        }
      });
      if (state.equippedItem && this.data.equipped.id !== state.equippedItem) {
        patch.equipped = getItem(state.equippedItem);
      }
      let enteringClear = false;
      if (state.mode === 'playing' && state.best > this.data.best && state.score > 0) {
        patch.recordBrokeNow = true;
        clearTimeout(this._recordAnimTimer);
        this._recordAnimTimer = setTimeout(() => {
          if (!this._destroyed) this.setData({ recordBrokeNow: false });
        }, 1600);
      }
      if (['gameover', 'cleared', 'completed', 'tutorial_done'].includes(state.mode) && this.data.mode !== state.mode) {
        if (this.data.modal !== state.mode) patch.modal = state.mode;
        if (state.mode === 'cleared' || state.mode === 'completed') enteringClear = true;
        if (this.data.mode === 'playing' && state.mode === 'gameover') this.vibrate();
      }
      if (Object.keys(patch).length) {
        this.setData(patch, () => {
          if (enteringClear) this.startSettleAnimation();
        });
      }
    },

    runLoop() {
      if (!this._game || !this._visible || this._rafId != null) return;
      this._lastTime = 0;
      const step = (now) => {
        this._rafId = null;
        if (!this._visible || this._destroyed || !this._game) return;
        const dt = this._lastTime ? Math.min(0.08, (now - this._lastTime) / 1000) : 0;
        this._lastTime = now;
        try {
          this._game.tick(dt);
        } catch (err) {
          console.error('Game loop error', err);
        }
        this._rafId = requestAnimationFrame(step);
      };
      this._rafId = requestAnimationFrame(step);
    },

    stopLoop() {
      if (this._rafId != null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      this._lastTime = 0;
    },

    onVisibilityChange(visible) {
      this._visible = visible;
      if (!visible) {
        this.resetControls();
        if (this._game && this.data.mode === 'playing') {
          this._game.pause();
          this.setData({ modal: 'paused' });
        }
        this.stopLoop();
        this.stopGardenLoop();
        this.stopSettleTimer();
        if (this._audio) this._audio.stop();
      } else {
        this.runLoop();
        if (this.data.modal === 'garden') this.startGardenLoop();
        if (this._audio) this._audio.syncBgm();
      }
    },

    onResize() {
      if (this._game && this.data.mode === 'playing') this.pause();
      this.resetControls();
      this.layout();
      this.sizeCanvas();
      if (this.data.modal === 'garden' && this._garden) {
        sizeHiDpiCanvas(view.els.gardenCanvas, this.data.gardenWidth, this.data.gardenHeight);
        this._garden.resize(this.data.gardenWidth, this.data.gardenHeight);
      }
    },

    enterGame() {
      if (this._audio) { this._audio.startBgm(); this._audio.playClick(); }
      if (!this.data.guideDone && this.data.unlocked === 1 && this._game && this.data.ready) {
        this.startTutorial();
        return;
      }
      if (this._game) this._game.prepare(this.data.level);
      this.setData({ modal: 'start' });
    },

    goHome() {
      this.stopSettleTimer();
      this.stopGardenLoop();
      if (this._audio) { this._audio.startBgm(); this._audio.playClick(); }
      this.resetControls();
      const homeLevel = this.data.modal === 'cleared' ? Math.min(LEVELS.length, this.data.unlocked) : this.data.level;
      if (this._game) this._game.prepare(homeLevel);
      this.refreshSnakeCards();
      this.refreshWarehouse();
      this.setData({ modal: 'home' });
    },

    openShop(dataset = {}) {
      if (['clear_pause', 'celebrating'].includes(this.data.mode)) return;
      if (!this.data.shopUnlocked) {
        if (this._audio) this._audio.playClick();
        showToast('到达第 5 关就解锁糖果小屋啦～');
        return;
      }
      this.stopSettleTimer();
      this.stopGardenLoop();
      if (this._audio) { this._audio.startBgm(); this._audio.playClick(); }
      this._previousShopModal = this.data.mode === 'playing' ? 'paused' : this.data.modal;
      this.resetControls();
      if (this._game) this._game.pause();
      const tab = dataset.tab || 'items';
      this.refreshWarehouse();
      this.refreshSnakeCards();
      const startGuide = !this.data.shopGuideDone;
      this.setData({ modal: 'shop', shopTab: startGuide ? 'items' : tab, shopGuideStep: startGuide ? 1 : 0, shopJustUnlocked: false });
    },

    nextShopGuide() {
      if (this._audio) this._audio.playClick();
      if (this.data.shopGuideStep >= 2) { this.finishShopGuide(); return; }
      this.setData({ shopGuideStep: 2, shopTab: 'snakes' });
    },

    finishShopGuide() {
      if (this._audio) this._audio.playClick();
      storage.set(SHOP_GUIDE_KEY, true);
      this.setData({ shopGuideStep: 0, shopGuideDone: true });
    },

    closeShop() {
      if (this._audio) this._audio.playClick();
      const prev = this._previousShopModal || 'home';
      this.setData({ modal: prev, shopGuideStep: 0 }, () => {
        if (prev === 'garden') this.initGardenCanvas();
      });
    },

    switchShopTab(dataset = {}) {
      const tab = dataset.tab;
      if (tab !== 'items' && tab !== 'snakes') return;
      if (this._audio) this._audio.playClick();
      this.setData({ shopTab: tab });
    },

    buyItem(dataset = {}) {
      const id = dataset.item;
      const item = getItem(id);
      if (!item) return;
      const current = Number(this.data.inventory[id]) || 0;
      if (current >= MAX_ITEM_STOCK) { showToast(`${item.name}最多带 ${MAX_ITEM_STOCK} 个哦`); return; }
      const price = Number(item.price) || 90;
      if (this.data.coins < price) { showToast(`还差 ${price - this.data.coins} 金币哦`); return; }
      const coins = this.data.coins - price;
      const inventory = { ...this.data.inventory, [id]: current + 1 };
      this.setData({ coins, inventory });
      this.persistCollection({ coins, inventory });
      this.refreshWarehouse();
      this.refreshSnakeCards();
      if (this._audio) this._audio.playBonus();
      showToast(`购买成功！${item.name} +1`, 1200);
    },

    start() {
      if (!this._game || !this.data.ready) return;
      if (this._audio) { this._audio.startBgm(); this._audio.playClick(); }
      this.resetControls();
      this._game.start(this.data.level, this.data.selectedItem, {
        doubleCoin: this.data.useDoubleCoin,
        revive: this.data.useRevive
      });
      this._lastTime = 0;
      this.setData({ modal: '', guideStep: 0 });
    },

    startTutorial() {
      if (!this._game || !this.data.ready) return;
      if (this._audio) { this._audio.startBgm(); this._audio.playClick(); }
      this.stopSettleTimer();
      this.resetControls();
      this._game.startTutorial();
      this._lastTime = 0;
      this.setData({ modal: '', guideStep: 0 });
    },

    completeTutorial() {
      if (this._audio) this._audio.playClick();
      storage.set(GUIDE_KEY, true);
      const targetLevel = this.data.unlocked || 1;
      this.resetControls();
      if (this._game) this._game.prepare(targetLevel);
      this._lastTime = 0;
      this.setData({
        guideDone: true, guideStep: 0, modal: 'start',
        selectedItem: '', selectedItemInfo: null, selectedCount: 0,
        useDoubleCoin: false, useRevive: false, lastChosenHint: ''
      });
    },

    skipTutorial() { this.completeTutorial(); },
    replayGuide() { this.startTutorial(); },

    prepareRetry() {
      if (!this._game) return;
      this.stopSettleTimer();
      this._game.prepare(this.data.level);
      this.resetControls();
      this._lastTime = 0;
      this.setData({
        modal: 'start', selectedItem: '', selectedItemInfo: null, selectedCount: 0,
        useDoubleCoin: false, useRevive: false, lastChosenHint: ''
      });
    },

    buyContinue(dataset = {}) {
      if (!this._game || this.data.mode !== 'gameover' || this.data.reviveUsed) return;
      const type = dataset.type === 'time' ? 'time' : 'revive';
      const cost = type === 'time' ? CONTINUE_TIME_COST : CONTINUE_REVIVE_COST;
      if (this.data.coins < cost) { showToast(`还差 ${cost - this.data.coins} 金币，先重试攒攒吧～`); return; }
      const coins = this.data.coins - cost;
      if (this._game.coinContinue(type)) {
        this.setData({ coins, modal: '' });
        this.persistCollection({ coins });
        this.refreshSnakeCards();
        this._lastTime = 0;
        showToast(type === 'time' ? '⏱ 已加时 +25 秒，继续冲！' : '💖 已复活并获 3 秒护盾！', 1500);
      }
    },

    persistCollection(extra = {}) {
      return storage.set(COLLECTION_KEY, {
        stars: extra.bestStars || this.data.bestStars,
        inventory: extra.inventory || this.data.inventory,
        coins: extra.coins !== undefined ? extra.coins : this.data.coins,
        unlockedSnakes: extra.unlockedSnakes || this.data.unlockedSnakes,
        activeSkin: extra.activeSkin || this.data.activeSkin
      });
    },

    saveProgress(level, stars = 0, summary = null) {
      const unlocked = Math.max(this.data.unlocked, Math.min(LEVELS.length, level + 1));
      const completed = this.data.completed || level === LEVELS.length;
      const old = Number(this.data.bestStars[level]) || 0;
      const bestStars = { ...this.data.bestStars, [level]: Math.max(old, stars) };
      const inventory = { ...this.data.inventory };
      const firstClear = old === 0 && stars >= 1;
      const firstThree = stars === 3 && old < 3;
      const gained = (firstClear ? 1 : 0) + (firstThree ? 1 : 0);
      let rewardName = '';
      let overflowCoins = 0;
      if (gained > 0) {
        const item = ITEMS[(level - 1) % ITEMS.length];
        const cur = Number(inventory[item.id]) || 0;
        const added = Math.min(gained, Math.max(0, MAX_ITEM_STOCK - cur));
        const overflow = gained - added;
        inventory[item.id] = cur + added;
        if (overflow > 0) overflowCoins = overflow * Math.round((Number(item.price) || 450) * 0.5);
        const prefix = firstClear && firstThree ? '首通+三星！' : firstThree ? '首次三星！' : '首次通关！';
        if (added > 0 && overflowCoins > 0) rewardName = `${prefix}${item.name} ×${added}，溢出转为 +${overflowCoins} 金币`;
        else if (overflowCoins > 0) rewardName = `${prefix}${item.name}已满，自动转为 +${overflowCoins} 金币`;
        else rewardName = `${prefix}获得 ${item.name} ×${added}`;
      }
      const earnedCoins = (summary ? Number(summary.totalEarnedCoins) || 0 : 0) + overflowCoins;
      const coins = this.data.coins + earnedCoins;
      const wasShopUnlocked = this.data.shopUnlocked;
      const shopUnlocked = wasShopUnlocked || unlocked >= SHOP_UNLOCK_LEVEL || level >= SHOP_UNLOCK_LEVEL - 1;
      const shopJustUnlocked = !wasShopUnlocked && shopUnlocked;
      this._pendingSummary = summary || { pickedCoins: 0, timeSec: this.data.remaining, timeBonusCoins: 0, coinMultiplier: 1, totalEarnedCoins: 0 };
      this._pendingStars = stars;
      this.setData({ unlocked, completed, bestStars, inventory, coins, rewardName, shopUnlocked, shopJustUnlocked });
      this.refreshLevelChoices();
      this.refreshWarehouse();
      this.refreshSnakeCards();
      storage.set(PROGRESS_KEY, { unlocked, completed });
      this.persistCollection({ bestStars, inventory, coins });
    },

    stopSettleTimer() {
      if (this._settleTimer) {
        clearInterval(this._settleTimer);
        this._settleTimer = null;
      }
    },

    startSettleAnimation() {
      this.stopSettleTimer();
      const s = this._pendingSummary || { pickedCoins: 0, timeSec: 0, timeBonusCoins: 0, coinMultiplier: 1, totalEarnedCoins: 0 };
      const targetStars = this._pendingStars || this.data.stars || 1;
      const total = s.totalEarnedCoins || 0;
      const settleTier = total >= 110 ? 3 : (total >= 65 ? 2 : 1);
      const rainDuration = settleTier === 3 ? 1500 : (settleTier === 2 ? 1280 : 1050);
      this.setData({
        settleAnimating: true, settleRaining: false, settleTier, settleStars: 0,
        settleTimeLeft: s.timeSec, settlePickedCoins: s.pickedCoins,
        settleTimeCoins: 0, settleTotalCoins: s.pickedCoins, settleMultiplier: s.coinMultiplier || 1
      });
      const startAt = Date.now();
      let shownStars = 0;
      let rainStarted = false;
      let lastTickSound = 0;
      this._settleTimer = setInterval(() => {
        const el = Date.now() - startAt;
        const nextStars = Math.min(targetStars, Math.floor(el / 160) + 1);
        if (nextStars > shownStars) {
          shownStars = nextStars;
          if (this._audio) this._audio.playClick();
        }
        const p = Math.max(0, Math.min(1, (el - 360) / rainDuration));
        if (p > 0 && !rainStarted && total > 0) {
          rainStarted = true;
          if (this._audio) this._audio.playBonus();
        }
        if (rainStarted && p < 0.95 && el - lastTickSound > (settleTier === 3 ? 180 : 250)) {
          lastTickSound = el;
          if (this._audio) this._audio.playClick();
        }
        const ease = 1 - Math.pow(1 - p, 2);
        const timeLeft = Math.max(0, Math.round(s.timeSec * (1 - ease)));
        const timeCoins = Math.round(s.timeBonusCoins * ease);
        const totalCoins = s.pickedCoins + timeCoins;
        if (el >= 380 + rainDuration + 80) {
          this.skipSettleAnimation();
          return;
        }
        this.setData({ settleStars: nextStars, settleRaining: rainStarted, settleTimeLeft: timeLeft, settleTimeCoins: timeCoins, settleTotalCoins: totalCoins });
      }, 40);
    },

    skipSettleAnimation() {
      this.stopSettleTimer();
      const s = this._pendingSummary || { pickedCoins: 0, timeSec: 0, timeBonusCoins: 0, coinMultiplier: 1, totalEarnedCoins: 0 };
      const targetStars = this._pendingStars || this.data.stars || 1;
      this.setData({
        settleAnimating: false, settleRaining: false, settleStars: targetStars,
        settleTimeLeft: 0, settlePickedCoins: s.pickedCoins, settleTimeCoins: s.timeBonusCoins,
        settleTotalCoins: s.totalEarnedCoins, settleMultiplier: s.coinMultiplier || 1
      });
    },

    refreshLevelChoices() {
      const levelPageCount = Math.max(1, Math.ceil(LEVELS.length / LEVELS_PER_PAGE));
      const levelPage = Math.max(1, Math.min(this.data.levelPage, levelPageCount));
      const slice = LEVELS.slice((levelPage - 1) * LEVELS_PER_PAGE, levelPage * LEVELS_PER_PAGE);
      const starCount = n => Math.max(0, Math.min(3, Number(this.data.bestStars[n]) || 0));
      const totalStars = LEVELS.reduce((sum, l) => sum + starCount(l.number), 0);
      const chapterStars = slice.reduce((sum, l) => sum + starCount(l.number), 0);
      this.setData({
        mapMirrored: levelPage % 2 === 0,
        chapterName: MAP_CHAPTER_NAMES[(levelPage - 1) % MAP_CHAPTER_NAMES.length],
        levelPage, levelPageCount, totalStars, maxStars: LEVELS.length * 3,
        chapterStars, chapterMaxStars: slice.length * 3,
        chapterProgress: Math.round(chapterStars / (slice.length * 3) * 100),
        chapterStart: slice[0].number, chapterEnd: slice[slice.length - 1].number,
        trailCount: Math.max(0, Math.min(slice.length, this.data.unlocked - (levelPage - 1) * LEVELS_PER_PAGE)),
        levelChoices: slice.map((l, index) => ({
          number: l.number,
          name: l.name,
          locked: l.number > this.data.unlocked,
          current: l.number === this.data.unlocked,
          stars: starCount(l.number),
          starIcons: [1, 2, 3].map(n => ({ slot: n, filled: starCount(l.number) >= n })),
          x: (levelPage % 2 === 0 ? 430 - MAP_ANCHORS[index][0] : MAP_ANCHORS[index][0]) / 430 * 100,
          y: MAP_ANCHORS[index][1] / 1460 * 100
        }))
      });
    },

    changeLevelPage(dataset = {}) {
      const delta = Number(dataset.delta);
      const page = this.data.levelPage + delta;
      if (page < 1 || page > this.data.levelPageCount) return;
      this.setData({ levelPage: page, mapDetail: null, mapTransition: delta > 0 ? 'forward' : 'back', mapScrollTop: 1 });
      this.refreshLevelChoices();
      this.setData({ mapScrollTop: 0 });
    },

    scrollMapTo(number) {
      const index = Math.max(0, Math.min(9, (number - 1) % LEVELS_PER_PAGE));
      const top = Math.max(0, Math.min(
        this.data.mapHeight - this.data.mapViewportHeight + 160,
        MAP_ANCHORS[index][1] / 1460 * this.data.mapHeight - this.data.mapViewportHeight * 0.5
      ));
      this.setData({ mapScrollTop: top + 0.1 }, () => this.setData({ mapScrollTop: top }));
    },

    locateLevel() {
      this.setData({ levelPage: Math.ceil(this.data.unlocked / LEVELS_PER_PAGE), mapDetail: null, mapTransition: '' });
      this.refreshLevelChoices();
      this.scrollMapTo(this.data.unlocked);
    },

    inspectLevel(dataset = {}) {
      const number = Number(dataset.level);
      if (!Number.isInteger(number) || number < 1 || number > LEVELS.length) return;
      if (number > this.data.unlocked) { showToast(`先通过第 ${number - 1} 关即可解锁`); return; }
      const l = getLevel(number);
      const stars = Number(this.data.bestStars[number]) || 0;
      this.setData({
        mapDetail: {
          ...l,
          stars,
          starIcons: [1, 2, 3].map(n => ({ slot: n, filled: stars >= n })),
          threeStarTime: Math.ceil(l.timeLimit * 0.5),
          reward: ITEMS[(number - 1) % ITEMS.length]
        }
      });
    },

    closeMapDetail() { this.setData({ mapDetail: null }); },

    refreshWarehouse() {
      const inv = this.data.inventory;
      const useDoubleCoin = this.data.useDoubleCoin && Number(inv.doubleCoin) > 0;
      const useRevive = this.data.useRevive && Number(inv.revive) > 0;
      const warehouseItems = ITEMS.map(item => ({ ...item, count: Number(inv[item.id]) || 0 }));
      const ownedItems = warehouseItems.filter(item => item.count > 0);
      this.setData({
        warehouseItems, ownedItems,
        selectedCount: Number(inv[this.data.selectedItem]) || 0,
        useDoubleCoin, useRevive
      });
    },

    refreshSnakeCards() {
      const owned = new Set(this.data.unlockedSnakes || ['strawberry']);
      this.setData({
        activeSnakeInfo: getSnake(this.data.activeSkin),
        snakeCards: SNAKES.map(s => ({
          ...s,
          owned: owned.has(s.id),
          equipped: this.data.activeSkin === s.id,
          canAfford: this.data.coins >= s.price
        }))
      });
    },

    chooseRole(dataset = {}) {
      if (this._audio) this._audio.startBgm();
      const skin = getSnake(dataset.id);
      if (!skin) return;
      const owned = new Set(this.data.unlockedSnakes || ['strawberry']);
      if (!owned.has(skin.id)) {
        showToast(`${skin.name}需 ${skin.price} 金币，去糖果小屋解锁吧`);
        this.openShop({ tab: 'snakes' });
        return;
      }
      this.setData({ activeSkin: skin.id, activeSnakeInfo: skin });
      this.persistCollection({ activeSkin: skin.id });
      this.refreshSnakeCards();
      if (this._game) this._game.setSkin(skin.id);
      if (this._audio) this._audio.playClick();
    },

    chooseItem(dataset = {}) {
      if (this._audio) this._audio.startBgm();
      const id = dataset.item;
      const item = getItem(id);
      if (!item || !(Number(this.data.inventory[id]) > 0)) {
        if (item) showToast(`${item.name}库存不足，通关或三星可获得`);
        return;
      }
      if (this._audio) this._audio.playClick();
      if (id === 'doubleCoin') {
        const next = !this.data.useDoubleCoin;
        this.setData({ useDoubleCoin: next, useRevive: next ? false : this.data.useRevive, lastChosenHint: next ? item.hint : '' });
        return;
      }
      if (id === 'revive') {
        const next = !this.data.useRevive;
        this.setData({ useRevive: next, useDoubleCoin: next ? false : this.data.useDoubleCoin, lastChosenHint: next ? item.hint : '' });
        return;
      }
      const selectedItem = this.data.selectedItem === id ? '' : id;
      const info = getItem(selectedItem) || null;
      this.setData({
        selectedItem,
        selectedItemInfo: info,
        selectedCount: Number(this.data.inventory[selectedItem]) || 0,
        lastChosenHint: info ? info.hint : ''
      });
    },

    consumeItem(id) {
      if (!getItem(id) || !(Number(this.data.inventory[id]) > 0)) return false;
      const inventory = { ...this.data.inventory, [id]: Number(this.data.inventory[id]) - 1 };
      if (!this.persistCollection({ inventory })) return false;
      this.setData({ inventory });
      this.refreshWarehouse();
      return true;
    },

    nextLevel() {
      this.stopSettleTimer();
      if (this._game && this._game.nextLevel()) {
        this.resetControls();
        this._lastTime = 0;
        this.setData({
          modal: 'start', rewardName: '', selectedItem: '', selectedItemInfo: null, selectedCount: 0,
          useDoubleCoin: false, useRevive: false, lastChosenHint: ''
        });
      }
    },

    openGarden() {
      if (['clear_pause', 'celebrating'].includes(this.data.mode)) return;
      this.stopSettleTimer();
      if (this._audio) { this._audio.startBgm(); this._audio.playClick(); }
      this._previousGardenModal = this.data.mode === 'playing' ? 'paused' : this.data.modal;
      this.resetControls();
      if (this._game) this._game.pause();
      this.refreshSnakeCards();
      this.setData({ modal: 'garden' }, () => this.initGardenCanvas());
    },

    closeGarden() {
      if (this._audio) this._audio.playClick();
      this.stopGardenLoop();
      this.setData({ modal: this._previousGardenModal || 'start' });
    },

    initGardenCanvas() {
      this.stopGardenLoop();
      try {
        const { ctx } = sizeHiDpiCanvas(view.els.gardenCanvas, this.data.gardenWidth, this.data.gardenHeight);
        this._garden = createGarden(ctx, {
          width: this.data.gardenWidth,
          height: this.data.gardenHeight,
          unlockedIds: this.data.unlockedSnakes
        });
        this.startGardenLoop();
      } catch (err) {
        console.error('Garden canvas failed', err);
      }
    },

    startGardenLoop() {
      if (!this._garden || !this._visible || this._gardenRafId != null) return;
      this._gardenLast = 0;
      const step = (now) => {
        this._gardenRafId = null;
        if (!this._visible || this._destroyed || this.data.modal !== 'garden' || !this._garden) return;
        const dt = this._gardenLast ? Math.min(0.08, (now - this._gardenLast) / 1000) : 0.016;
        this._gardenLast = now;
        try { this._garden.tick(dt); } catch (_) {}
        this._gardenRafId = requestAnimationFrame(step);
      };
      this._gardenRafId = requestAnimationFrame(step);
    },

    stopGardenLoop() {
      if (this._gardenRafId != null) {
        cancelAnimationFrame(this._gardenRafId);
        this._gardenRafId = null;
      }
      this._gardenLast = 0;
    },

    tapGarden(clientX, clientY) {
      if (!this._garden) return;
      const rect = view.els.gardenCanvas.getBoundingClientRect();
      const hit = this._garden.tap(clientX - rect.left, clientY - rect.top);
      if (hit && this._audio) this._audio.playBonus();
    },

    unlockSnakeOnly(dataset = {}) {
      const skin = getSnake(dataset.id);
      if (!skin) return;
      const owned = new Set(this.data.unlockedSnakes || ['strawberry']);
      if (owned.has(skin.id)) return;
      if (this.data.coins < skin.price) {
        showToast(`还差 ${skin.price - this.data.coins} 金币，继续闯关攒攒吧`);
        return;
      }
      const coins = this.data.coins - skin.price;
      const unlockedSnakes = [...this.data.unlockedSnakes, skin.id];
      this.setData({ coins, unlockedSnakes });
      this.persistCollection({ coins, unlockedSnakes });
      this.refreshSnakeCards();
      if (this._garden) this._garden.setSnakes(unlockedSnakes);
      if (this._audio) this._audio.playNewRecord();
      showToast(`🎉 已解锁 ${skin.name}！去蛇蛇花园看看吧`);
    },

    openLevels() {
      if (['clear_pause', 'celebrating'].includes(this.data.mode)) return;
      if (this._audio) this._audio.startBgm();
      this._previousLevelsModal = this.data.mode === 'playing' ? 'paused' : this.data.modal;
      this.resetControls();
      if (this._game) this._game.pause();
      this.setData({ modal: 'levels', mapDetail: null, mapTransition: '', levelPage: Math.ceil(this.data.unlocked / LEVELS_PER_PAGE) });
      this.refreshLevelChoices();
      this.scrollMapTo(this.data.unlocked);
    },

    closeLevels() { this.setData({ modal: this._previousLevelsModal || 'start', mapDetail: null }); },

    selectLevel(dataset = {}) {
      const number = Number(dataset.level);
      if (!Number.isInteger(number) || number < 1 || number > this.data.unlocked || number > LEVELS.length || !this._game || !this.data.ready) return;
      this._game.prepare(number);
      this.resetControls();
      this._lastTime = 0;
      this.setData({ modal: 'start', mapDetail: null, selectedItem: '', selectedItemInfo: null, selectedCount: 0 });
    },

    pause() {
      if (!this._game || this.data.mode !== 'playing') return;
      this._game.pause();
      this.resetControls();
      this.setData({ modal: 'paused' });
    },

    resume() {
      if (!this._game) return;
      if (this._audio) this._audio.startBgm();
      this._game.resume();
      this._lastTime = 0;
      this.setData({ modal: '' });
    },

    openSettings() {
      if (['clear_pause', 'celebrating'].includes(this.data.mode)) return;
      if (this._audio) this._audio.startBgm();
      this._previousModal = this.data.mode === 'playing' ? 'paused' : this.data.modal;
      this.resetControls();
      if (this._game) this._game.pause();
      this.setData({ modal: 'settings' });
    },

    closeSettings() { this.setData({ modal: this._previousModal || 'start' }); },

    openRules() {
      if (this._audio) this._audio.startBgm();
      this._previousRulesModal = this.data.modal;
      this.setData({ modal: 'rules' });
    },

    closeRules() { this.setData({ modal: this._previousRulesModal || 'start' }); },

    async confirmClearRecords() {
      const confirmed = await showConfirmDialog({
        title: '清除游玩记录？',
        content: '会清空关卡、星级、金币、蛇蛇和道具，声音设置会保留，确认清除吗？',
        confirmText: '确认清除',
        confirmColor: '#c93e6e'
      });
      if (!confirmed) return;
      storage.set(PROGRESS_KEY, { unlocked: 1, completed: false });
      storage.set(COLLECTION_KEY, {
        stars: {},
        inventory: { ...STARTER_INVENTORY },
        coins: 0,
        unlockedSnakes: ['strawberry'],
        activeSkin: 'strawberry'
      });
      storage.set(BEST_KEY, 0);
      storage.set(GUIDE_KEY, false);
      storage.set(SHOP_GUIDE_KEY, false);
      this.setData({
        unlocked: 1, completed: false, best: 0, bestStars: {},
        inventory: { ...STARTER_INVENTORY }, coins: 0,
        unlockedSnakes: ['strawberry'], activeSkin: 'strawberry',
        rewardName: '', guideDone: false, guideStep: 0,
        shopUnlocked: false, shopGuideDone: false, shopGuideStep: 0, shopJustUnlocked: false,
        useDoubleCoin: false, useRevive: false, lastChosenHint: ''
      });
      this.refreshLevelChoices();
      this.refreshWarehouse();
      this.refreshSnakeCards();
      if (this._game) {
        this._game.clearBest();
        this._game.setSkin('strawberry');
        this._game.prepare(1);
      }
      this.setData({ modal: 'start', selectedItem: '', selectedItemInfo: null, selectedCount: 0 });
      showToast('游玩记录已清除');
    },

    changeSetting(dataset = {}) {
      const { key, value } = dataset;
      const allowed = { bgm: ['on', 'off'], sound: ['on', 'off'], vibration: ['on', 'off'] };
      if (!allowed[key] || !allowed[key].includes(value)) return;
      const settings = { ...this.data.settings, [key]: value === 'on' };
      this.setData({ settings });
      storage.set(SETTINGS_KEY, settings);
      if (key === 'bgm') this._audio.syncBgm();
      else if (key === 'sound') {
        if (!settings.sound) this._audio.stopSfx();
        else this._audio.playClick();
      } else if (settings.sound) {
        this._audio.playClick();
      }
    },

    resetControls() { this._touch = null; },

    handleSwipeStart(id, x, y) {
      if (this.data.mode !== 'playing' || this.data.modal || this.data.guideStep > 0) return;
      this._touch = { id, x, y };
    },

    handleSwipeMove(id, x, y) {
      if (!this._touch || !this._game || this.data.modal || this.data.guideStep > 0) return;
      if (this._touch.id !== id) return;
      const dx = x - this._touch.x;
      const dy = y - this._touch.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
      this._game.turn(Math.abs(dx) > Math.abs(dy) ? Math.sign(dx) : 0, Math.abs(dx) > Math.abs(dy) ? 0 : Math.sign(dy));
      this._touch.x = x;
      this._touch.y = y;
    },

    handleSwipeEnd() { this._touch = null; },

    turn(dx, dy) {
      if (!this._game || this.data.mode !== 'playing' || this.data.modal || this.data.guideStep > 0) return;
      this._game.turn(dx, dy);
    },

    vibrate() {
      if (this.data.settings.vibration) vibrateLight();
    }
  };

  return app;
}
