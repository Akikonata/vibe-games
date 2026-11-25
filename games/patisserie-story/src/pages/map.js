// src/pages/map.js
// 风铃湾交互式手绘场景地图（7 大建筑节点 + 迷雾解锁 + 底部场景详情抽屉）

import { getDashboardState } from '../utils/store.js';
import { CHARACTERS } from '../data/characters.js';
import { showToast } from '../../../../shared/web-ui.js';

const SCENE_DEFS = [
  { id: 'shop', name: '星月糖屋', subtitle: '主线筹备核心', icon: '🏠', npcId: 'madeleine', x: 48, y: 67, levelIds: ['main_1', 'main_2', 'main_3', 'main_4', 'main_5', 'main_6'], unlockHint: '初始已开启', desc: '风铃湾的老字号甜点屋，在这里推进主线筹备、迎战试营业与美食节大典。' },
  { id: 'orchard', name: '阳光果园', subtitle: '水果与坚果', icon: '🍓', npcId: 'lillian', x: 20, y: 25, levelIds: ['side_1'], unlockHint: '完成序章【重启星月糖屋】后解锁', desc: '梯田山坡上的阳光果园，莉莉安在这里种植新鲜树莓、柠檬与开心果。' },
  { id: 'forge', name: '红砖铁匠铺', subtitle: '模具与铜器', icon: '🔨', npcId: 'gregory', x: 19, y: 57, levelIds: ['side_2'], unlockHint: '完成序章【重启星月糖屋】后解锁', desc: '弥漫着炭火与蜂蜡香气的老工坊，格雷戈里师傅手工锻造波尔多铜模。' },
  { id: 'ranch', name: '晨露牧场', subtitle: '鲜奶与芝士', icon: '🧀', npcId: 'bart', x: 56, y: 23, levelIds: ['side_3'], unlockHint: '完成主线 2【街坊开放日】后解锁', desc: '绿草如茵的海滨牧场，巴特大叔每天清晨供应最新鲜的鲜奶油与马斯卡彭。' },
  { id: 'porcelain', name: '月光瓷艺坊', subtitle: '骨瓷与礼盒', icon: '🎀', npcId: 'emily', x: 80, y: 47, levelIds: ['side_4'], unlockHint: '完成主线 3【试营业危机】后解锁', desc: '优雅安静的商业街瓷艺坊，艾米莉为每道甜点定制手绘骨瓷盘与丝带礼盒。' },
  { id: 'harbor', name: '旧港货栈', subtitle: '远洋可可香料', icon: '⛵', npcId: 'casper', x: 78, y: 77, levelIds: ['side_5'], unlockHint: '完成主线 4【暴雨断供危机】后解锁', desc: '帆船停泊的复古港湾，卡斯帕的货栈堆满了来自世界各地的可可豆与香草荚。' },
  { id: 'station', name: '跨海火车站', subtitle: '第二卷新航线', icon: '🚂', npcId: 'theo', x: 84, y: 18, levelIds: [], isTeaser: true, unlockHint: '完成第一卷终章【百年风铃美食节】后开启', desc: '通往【白鹭港】与【王都甜点博览会】的跨海蒸汽列车站台，第二卷故事即将启程！' }
];

export function mountMapPage(root, _params, { navigate }) {
  let selectedId = null;

  function buildScenes() {
    const state = getDashboardState();
    const levelMap = {};
    state.levels.forEach(l => { levelMap[l.id] = l; });

    return SCENE_DEFS.map(def => {
      const npc = CHARACTERS[def.npcId] || CHARACTERS.coco;
      if (def.isTeaser) {
        return { ...def, npcName: npc.name, npcPortrait: npc.avatarImg, unlocked: state.season1Finished, allDone: false, hasPending: state.season1Finished, sceneLevels: [] };
      }
      const sceneLevels = def.levelIds.map(id => levelMap[id]).filter(Boolean);
      const unlocked = sceneLevels.some(l => l.unlocked);
      const allDone = sceneLevels.length > 0 && sceneLevels.every(l => l.completed);
      const hasPending = sceneLevels.some(l => l.unlocked && !l.completed);
      return { ...def, npcName: npc.name, npcPortrait: npc.avatarImg, unlocked, allDone, hasPending, sceneLevels };
    });
  }

  function render() {
    const scenes = buildScenes();
    const unlockedCount = scenes.filter(s => s.unlocked).length;
    const selectedScene = selectedId ? scenes.find(s => s.id === selectedId) || null : null;

    const pinsHtml = scenes.map(s => `
      <div class="building-pin ${s.unlocked ? 'is-open' : 'is-fog'} ${s.allDone ? 'is-clear' : ''} ${selectedScene && selectedScene.id === s.id ? 'is-selected' : ''}"
           style="left:${s.x}%;top:${s.y}%;" data-action="tapBuilding" data-id="${s.id}">
        ${!s.unlocked ? '<div class="fog-cloud">☁️ 🔒</div>' : ''}
        ${s.hasPending ? '<div class="pin-alert">!</div>' : ''}
        <div class="pin-roof"></div>
        <div class="pin-house"><span class="pin-icon">${s.unlocked ? s.icon : '🌫️'}</span></div>
        <div class="pin-plate"><span class="pin-name">${s.name}</span></div>
      </div>
    `).join('');

    let sheetBody = '';
    if (selectedScene) {
      if (!selectedScene.unlocked) {
        sheetBody = `<div class="locked-box"><span class="locked-icon">☁️🔒</span><span class="locked-text">该场景目前被海雾笼罩</span><span class="locked-req">解锁条件：${selectedScene.unlockHint}</span></div>`;
      } else if (selectedScene.isTeaser) {
        sheetBody = `<div class="teaser-box"><span class="teaser-title">✨ 第二卷站台已亮灯！</span><span class="teaser-text">凭神秘旅人留下的《皇家甜点手账·残页》，【白鹭港与王都甜点博览会】新篇章敬请期待！</span></div>`;
      } else {
        sheetBody = `<div class="sheet-levels scrollarea">${selectedScene.sceneLevels.map(lvl => `
          <div class="scene-level-row ${lvl.completed ? 'done' : ''} ${!lvl.unlocked ? 'locked' : ''}" data-action="enterLevel" data-id="${lvl.id}" data-unlocked="${lvl.unlocked ? '1' : '0'}">
            <div class="lvl-info">
              <span class="lvl-title">${lvl.title}</span>
              <span class="lvl-meta">🎮 ${lvl.minigameTitle} · ${lvl.recipeEmoji} ${lvl.recipeName}</span>
            </div>
            <div class="lvl-biscuit-go">${lvl.completed ? '重温' : (lvl.unlocked ? '进入 ▶' : '🔒')}</div>
          </div>`).join('')}</div>`;
      }
    }

    const sheetHtml = selectedScene
      ? `<div class="sheet-mask" data-action="closeSheet">
          <div class="sheet-panel card" data-stop="true">
            <div class="sheet-header">
              <div class="sheet-title-wrap">
                <div class="sheet-arch-icon"><img class="sheet-npc-img mode-fill" src="${selectedScene.npcPortrait}" alt="" /></div>
                <div class="sheet-titles">
                  <span class="sheet-name">${selectedScene.name}</span>
                  <span class="sheet-sub">📍 ${selectedScene.subtitle} · ${selectedScene.npcName}</span>
                </div>
              </div>
              <span class="sheet-close" data-action="closeSheet">✕</span>
            </div>
            <span class="sheet-desc">${selectedScene.desc}</span>
            ${sheetBody}
          </div>
        </div>`
      : '';

    root.innerHTML = `
      <div class="map-shell">
        <div class="caramel-canopy">
          <div class="awning-bar"></div>
          <div class="caramel-drip-edge"></div>
          <div class="canopy-vine-left"><div class="leaf-pill"></div><div class="leaf-pill alt"></div></div>
          <div class="canopy-vine-right"><div class="leaf-pill"></div><div class="leaf-pill alt"></div></div>
        </div>

        <div class="page-wrap map-wrap">
          <div class="map-topbar">
            <div class="ribbon-title">🧭 风铃湾手绘场景地图</div>
            <div class="explore-pill">🌿 已探索 ${unlockedCount} / ${scenes.length}</div>
          </div>

          <div class="map-board">
            <div class="map-canvas">
              <img class="map-bg-img mode-fill" src="assets/images/town_map_bg.jpg" alt="风铃湾地图" />
              <div class="map-warm-tint"></div>
              <div class="compass-badge">✦ N ✦</div>
              ${pinsHtml}
            </div>
            <div class="map-legend">
              <span class="legend-item">🏠 点击建筑探索场景</span>
              <span class="legend-item">☁️ 迷雾区随主线解锁</span>
            </div>
          </div>

          ${!selectedScene
            ? `<div class="card hint-card"><span class="hint-title">🌿 探索指南</span><span class="hint-desc">点击地图上的【星月糖屋】可推进主线剧情；随着主线解锁，周围迷雾会逐渐散开，露出阳光果园、红砖铁匠铺、晨露牧场等上下游供应商场景！</span></div>`
            : ''}
        </div>
        ${sheetHtml}
      </div>
    `;
  }

  const onClick = (e) => {
    const target = e.target.closest('[data-action], [data-stop]');
    if (!target || !target.dataset.action) return;
    const action = target.dataset.action;
    if (action === 'tapBuilding') {
      selectedId = target.dataset.id;
      render();
    } else if (action === 'closeSheet') {
      selectedId = null;
      render();
    } else if (action === 'enterLevel') {
      if (target.dataset.unlocked !== '1') {
        showToast('请先完成前置章节解锁');
        return;
      }
      navigate('story', { levelId: target.dataset.id });
    }
  };

  root.addEventListener('click', onClick);
  render();
  return () => root.removeEventListener('click', onClick);
}
