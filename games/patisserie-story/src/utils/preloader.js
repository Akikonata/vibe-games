// src/utils/preloader.js
// 《甜点屋物语》两级并发图片预加载器（首屏核心素材带实时进度条 + 其余场景/NPC素材后台静默预热）

const CRITICAL_ASSETS = [
  // 标题与主角核心立绘 + 表情/眨眼帧
  'assets/images/shop_facade.jpg',
  'assets/images/coco_avatar.png',
  'assets/images/portraits/coco.png',
  'assets/images/portraits/coco_blink.png',
  'assets/images/portraits/coco_blink_half.png',
  'assets/images/portraits/coco_happy.png',
  'assets/images/portraits/coco_surprised.png',
  'assets/images/portraits/coco_serious.png',

  // 2.5D 糖屋营业场景与分层素材
  'assets/images/kitchen/patisserie_25d_zones.jpg?v=6',
  'assets/images/kitchen/prop_display_counter_fg.png?v=5',
  'assets/images/kitchen/prop_counter_glass_front.png?v=2',
  'assets/images/kitchen/coco_walk_sheet.png',
  'assets/images/kitchen/prop_cafe_table.png',
  'assets/images/kitchen/prop_cafe_chair.png',
  'assets/images/kitchen/prop_clean_plate.png',
  'assets/images/kitchen/prop_dirty_plate.png',
  'assets/images/kitchen/prop_oven.png',
  'assets/images/kitchen/guest_lillian.png?v=2',
  'assets/images/kitchen/guest_theo.png?v=2',
  'assets/images/kitchen/guest_bart.png?v=2',
  'assets/images/kitchen/guest_emily.png?v=2',

  // 4 款招牌饮品
  'assets/images/drinks/drink_sea_latte.png',
  'assets/images/drinks/drink_matcha_au_lait.png',
  'assets/images/drinks/drink_rose_berry_fizz.png',
  'assets/images/drinks/drink_velvet_cocoa.png',

  // 11 道经典手绘甜点
  'assets/images/desserts/madeleine.png',
  'assets/images/desserts/macaron.png',
  'assets/images/desserts/canele.png',
  'assets/images/desserts/tarte_tatin.png',
  'assets/images/desserts/tiramisu.png',
  'assets/images/desserts/mille_feuille.png',
  'assets/images/desserts/mont_blanc.png',
  'assets/images/desserts/basque_cheesecake.png',
  'assets/images/desserts/sachertorte.png',
  'assets/images/desserts/opera.png',
  'assets/images/desserts/saint_honore.png'
];

const BACKGROUND_ASSETS = [
  // 其余 8 位 NPC 立绘
  'assets/images/portraits/madeleine.png',
  'assets/images/portraits/theo.png',
  'assets/images/portraits/lillian.png',
  'assets/images/portraits/gregory.png',
  'assets/images/portraits/bart.png',
  'assets/images/portraits/casper.png',
  'assets/images/portraits/emily.png',
  'assets/images/portraits/silver_spoon.png',

  // 4 件装潢实景道具
  'assets/images/upgrades/prop_upg_chandelier.png',
  'assets/images/upgrades/prop_upg_espresso.png',
  'assets/images/upgrades/prop_upg_herb_box.png',
  'assets/images/upgrades/prop_upg_giftbox.png',

  // 3 处风铃湾打工场景背景
  'assets/images/jobs/job_florist_bg.jpg',
  'assets/images/jobs/job_cafe_bg.jpg',
  'assets/images/jobs/job_harbor_bg.jpg',

  // 城镇地图
  'assets/images/town_map_bg.jpg'
];

const loadedCache = new Map();

function loadSingleImage(url) {
  if (loadedCache.has(url)) return loadedCache.get(url);
  const p = new Promise(resolve => {
    const img = new Image();
    img.decoding = 'async';
    const done = () => resolve(url);
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {}).finally(done);
      } else {
        done();
      }
    };
    img.onerror = done;
    img.src = url;
  });
  loadedCache.set(url, p);
  return p;
}

function runPool(urls, concurrency, onStep) {
  const unique = Array.from(new Set(urls));
  const total = unique.length;
  if (total === 0) {
    if (onStep) onStep(1, 1);
    return Promise.resolve();
  }
  let idx = 0;
  let completed = 0;

  return new Promise(resolve => {
    function next() {
      if (completed >= total) {
        resolve();
        return;
      }
      while (idx < total && (idx - completed) < concurrency) {
        const url = unique[idx++];
        loadSingleImage(url).finally(() => {
          completed += 1;
          if (onStep) onStep(completed, total);
          if (completed >= total) resolve();
          else next();
        });
      }
    }
    next();
  });
}

/**
 * 首屏核心素材预加载（附带最大 6 秒安全兜底，弱网绝不卡死）
 */
export function preloadCriticalAssets(onProgress, { timeoutMs = 6000 } = {}) {
  const total = CRITICAL_ASSETS.length;
  if (onProgress) onProgress({ loaded: 0, total, pct: 0 });

  const work = runPool(CRITICAL_ASSETS, 6, (loaded, tot) => {
    const pct = Math.min(100, Math.round((loaded / tot) * 100));
    if (onProgress) onProgress({ loaded, total: tot, pct });
  });

  const guard = new Promise(resolve => setTimeout(resolve, timeoutMs));
  return Promise.race([work, guard]).then(() => {
    if (onProgress) onProgress({ loaded: total, total, pct: 100 });
  });
}

/**
 * 进游戏后利用空闲时间静默预热其余立绘、装潢与打工背景
 */
export function preloadBackgroundAssets() {
  const kick = () => runPool(BACKGROUND_ASSETS, 3);
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => kick(), { timeout: 2500 });
  } else {
    setTimeout(kick, 1200);
  }
}
