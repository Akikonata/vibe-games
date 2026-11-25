// src/pages/minigame.js
// 全 11 关 5 大独立实景小游戏引擎调度层（oven | stacker | rhythm | multi_pan | catch）
// 背景图层持久挂载，按帧轻量局部更新，并支持手机触控与桌面键盘快捷键

import { LEVELS } from '../data/levels.js';
import { RECIPES } from '../data/recipes.js';
import { STACKER_RECIPES } from '../data/minigame_scenes.js';
import { RANK_META } from '../data/story_branches.js';
import { completeLevel } from '../utils/store.js';
import { createOvenEngine } from '../engines/oven_engine.js';
import { createStackerEngine } from '../engines/stacker_engine.js';
import { RHYTHM_CONFIGS, createRhythmEngine } from '../engines/rhythm_engine.js';
import { MULTI_PAN_CONFIGS, createMultiPanEngine } from '../engines/multi_pan_engine.js';
import { CATCH_CONFIGS, createCatchEngine } from '../engines/catch_engine.js';
import { showToast } from '../../../../shared/web-ui.js';

export function mountMinigamePage(root, params, { navigate, setPageTitle }) {
  const levelId = params.levelId || 'main_1';
  const level = LEVELS.find(l => l.id === levelId) || LEVELS[0];
  const recipe = RECIPES.find(r => r.id === level.recipeId) || RECIPES[0];
  const type = level.minigameType;

  setPageTitle(level.minigameTitle || '甜点制作挑战');

  let engineMode = 'catch';
  if (type === 'oven_warmup') engineMode = 'oven';
  else if (STACKER_RECIPES[type]) engineMode = 'stacker';
  else if (RHYTHM_CONFIGS[type]) engineMode = 'rhythm';
  else if (MULTI_PAN_CONFIGS[type]) engineMode = 'multi_pan';

  let engine = null;
  let finishTimer = null;
  let destroyed = false;

  const pageProxy = {
    data: {
      level,
      recipe,
      engineMode,
      hitFlash: false,
      gameFailed: false,
      failTitle: '',
      failReason: '',
      failScore: 0,
      // 1. Oven
      pointerPos: 12, pointerDir: 1, currentTemp: 134, hits: 0, targetHits: 3, mistakes: 0,
      ovenScore: 0, ovenTimeLeft: 24, ovenSceneImg: 'assets/images/scenes/oven_stage_0.svg', actionLabel: '', feedback: '',
      // 2. Stacker
      stackConfig: null, stackLayers: [], stackLayerHeight: 42, activeLayerIndex: 0, activeLayer: null,
      activePhase: 'swing', swingX: 20, swingDir: 1, dropY: 42, dropVy: 0, score: 0, combo: 0, lives: 3,
      judgeText: '', judgeKind: '', stackFailed: false,
      // 3. Rhythm
      rhythmConfig: null, rhythmNotes: [], rhythmScore: 0, rhythmCombo: 0, rhythmHits: 0, rhythmMisses: 0,
      rhythmDone: 0, rhythmTotal: 9, rhythmJudge: '', rhythmJudgeKind: '',
      // 4. Multi-Pan
      panConfig: null, pans: [], panScore: 0, panServed: 0, panBurnt: 0, panTimeLeft: 30, panTip: '',
      // 5. Catch
      catchConfig: null, catchBasketX: 50, catchItems: [], catchScore: 0, catchCollected: 0,
      catchMissed: 0, catchTarget: 8, catchLives: 3, catchTimeLeft: 26, catchTip: ''
    },
    setData(patch, cb) {
      if (destroyed) return;
      Object.assign(this.data, patch);
      updateView();
      if (typeof cb === 'function') cb();
    }
  };

  function onComplete(rank = 'B', score = 0) {
    const meta = RANK_META[rank] || RANK_META.B;
    completeLevel(level.id, rank, score);
    showToast(meta.toast, 1100);
    finishTimer = setTimeout(() => {
      if (!destroyed) {
        navigate('story', { levelId: level.id, phase: 'outro', rank, score }, { replace: true });
      }
    }, 1050);
  }

  function onFail(info = {}) {
    pageProxy.setData({
      gameFailed: true,
      failTitle: info.title || '💥 制作失败啦！',
      failReason: info.reason || '差一点就成功了，调整节奏再来一轮吧！',
      failScore: info.score || 0
    });
  }

  // 一次性挂载静态舞台壳与背景图，避免高频刷新导致图片闪烁或吞点击
  let stageMarkup = '';
  if (engineMode === 'oven') {
    stageMarkup = `
      <div class="card oven-card">
        <div id="mg-hud" class="oven-status-bar"></div>
        <div id="mg-oven-vp" class="oven-viewport">
          <img id="mg-oven-img" class="oven-scene-img mode-widthfix" src="assets/images/scenes/oven_stage_0.svg" alt="烤炉" />
        </div>
        <div class="thermometer-box">
          <div class="scale-labels">
            <span>120°C 偏冷</span>
            <span class="gold-label">180°C 黄金烘焙区</span>
            <span>240°C 过热</span>
          </div>
          <div class="meter-track">
            <div class="golden-zone"></div>
            <div id="mg-pointer" class="meter-pointer" style="left:12%;"></div>
          </div>
        </div>
        <span id="mg-feedback" class="feedback-text"></span>
        <div id="mg-action-btn" class="btn-primary tap-btn" data-action="ovenTap">点燃柴火 · 唤醒老烤炉</div>
      </div>
    `;
  } else if (engineMode === 'stacker') {
    stageMarkup = `
      <div class="card oven-card">
        <div id="mg-hud" class="oven-status-bar stack-hud"></div>
        <div class="stack-arena" data-action="stackDrop">
          <img class="arena-bg-img mode-fill" src="assets/images/minigames/bg_stacker.svg" alt="" />
          <div class="crane-rail"></div>
          <div id="mg-cord" class="crane-cord"></div>
          <div class="center-guide"></div>
          <div id="mg-active-layer" class="pastry-block is-active"></div>
          <div id="mg-landed-layers"></div>
          <div class="serving-plate"></div>
          <div class="plate-shadow"></div>
        </div>
        <div id="mg-judge" class="judge-bar"></div>
        <div id="mg-stack-btn" class="btn-primary tap-btn" data-action="stackDrop">点击或按空格放下食材</div>
      </div>
    `;
  } else if (engineMode === 'rhythm') {
    const cfg = RHYTHM_CONFIGS[type] || RHYTHM_CONFIGS.rhythm_bake;
    stageMarkup = `
      <div class="card oven-card">
        <div id="mg-hud" class="oven-status-bar stack-hud"></div>
        <div class="rhythm-stage">
          <img class="arena-bg-img mode-fill" src="${cfg.bgImg}" alt="" />
          ${[0, 1, 2].map(lane => `
            <div class="rhythm-lane" data-action="rhythmHit" data-lane="${lane}">
              <div class="lane-guide-line"></div>
              <div class="hit-ring"><img class="target-vessel-img mode-fit" src="${cfg.targetImg}" alt="" /></div>
              <span class="lane-name">${cfg.laneLabels[lane]}</span>
            </div>
          `).join('')}
          <div id="mg-rhythm-notes"></div>
        </div>
        <div id="mg-judge" class="judge-bar"></div>
        <div class="rhythm-keys">
          ${cfg.laneLabels.map((lbl, idx) => `
            <div class="rhythm-key-btn" data-action="rhythmHit" data-lane="${idx}">
              <img class="key-mini-img mode-fit" src="${cfg.noteImg}" alt="" />
              <span>${lbl}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (engineMode === 'multi_pan') {
    const cfg = MULTI_PAN_CONFIGS[type] || MULTI_PAN_CONFIGS.pan_flip;
    stageMarkup = `
      <div class="card oven-card">
        <div id="mg-hud" class="oven-status-bar stack-hud"></div>
        <div class="stovetop-arena">
          <img class="arena-bg-img mode-fill" src="${cfg.bgImg}" alt="" />
          <div class="burners-row">
            ${[0, 1, 2].map(id => `
              <div id="mg-pan-${id}" class="burner-slot state-cooking" data-action="tapPan" data-id="${id}">
                <div id="mg-pan-badge-${id}" class="burner-badge">升温中</div>
                <img id="mg-pan-img-${id}" class="cookware-sprite mode-fit" src="assets/images/minigames/${cfg.spritePrefix}_cooking.svg" alt="" />
                <div class="burner-heat-track">
                  <div class="pan-ready-band"></div>
                  <div id="mg-pan-fill-${id}" class="pan-heat-fill" style="width:10%;"></div>
                </div>
                <span class="burner-name">${cfg.unitName} #${id + 1}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <span id="mg-feedback" class="feedback-text"></span>
      </div>
    `;
  } else {
    const cfg = CATCH_CONFIGS[type] || CATCH_CONFIGS.orbit_match;
    stageMarkup = `
      <div class="card oven-card">
        <div id="mg-hud" class="oven-status-bar stack-hud"></div>
        <div id="mg-catch-arena" class="catch-arena" data-action="catchArena">
          <img class="arena-bg-img mode-fill" src="${cfg.bgImg}" alt="" />
          <div id="mg-catch-items"></div>
          <div id="mg-catch-vessel" class="catch-vessel" style="left:50%;">
            <img class="vessel-sprite mode-fit" src="${cfg.catcherImg}" alt="" />
          </div>
        </div>
        <span id="mg-feedback" class="feedback-text"></span>
        <div class="catch-controls">
          <div class="btn-secondary move-btn" data-action="moveLeft">◀ 向左移动</div>
          <div class="btn-secondary move-btn" data-action="moveRight">向右移动 ▶</div>
        </div>
      </div>
    `;
  }

  root.innerHTML = `
    <div class="minigame-shell">
      <div class="caramel-canopy">
        <div class="awning-bar"></div>
        <div class="caramel-drip-edge"></div>
        <div class="canopy-vine-left"><div class="leaf-pill"></div><div class="leaf-pill alt"></div></div>
        <div class="canopy-vine-right"><div class="leaf-pill"></div><div class="leaf-pill alt"></div></div>
      </div>
      <div class="page-wrap game-wrap">
        <div class="card header-card">
          <div class="header-row">
            <span class="game-title">${level.minigameTitle}</span>
            <div class="recipe-pill">
              <img class="pill-icon mode-fit" src="${recipe.iconImg}" alt="" />
              <span>${recipe.name}</span>
            </div>
          </div>
          <span class="game-desc">${level.targetDesc}</span>
        </div>
        ${stageMarkup}
      </div>
      <div id="mg-fail-slot"></div>
    </div>
  `;

  let lastOvenSrc = '';
  let lastLandedCount = -1;
  const lastPanSrc = ['', '', ''];
  let lastFailState = false;

  function updateView() {
    const d = pageProxy.data;
    const hud = root.querySelector('#mg-hud');

    if (engineMode === 'oven') {
      hud.innerHTML = `
        <span class="hud-score">⏱ ${d.ovenTimeLeft}s</span>
        <div class="stage-dots">
          <div class="s-dot ${d.hits >= 1 ? 'lit' : ''}"></div>
          <div class="s-dot ${d.hits >= 2 ? 'lit' : ''}"></div>
          <div class="s-dot ${d.hits >= 3 ? 'lit' : ''}"></div>
        </div>
        <span class="temp-readout ${d.pointerPos >= 34 && d.pointerPos <= 66 ? 'in-zone' : ''}">${d.currentTemp}°C</span>
      `;
      const vp = root.querySelector('#mg-oven-vp');
      vp.classList.toggle('flash', !!d.hitFlash);
      if (d.ovenSceneImg !== lastOvenSrc) {
        lastOvenSrc = d.ovenSceneImg;
        root.querySelector('#mg-oven-img').src = d.ovenSceneImg;
      }
      root.querySelector('#mg-pointer').style.left = `${d.pointerPos}%`;
      root.querySelector('#mg-feedback').textContent = d.feedback;
      root.querySelector('#mg-action-btn').textContent = d.actionLabel;
    } else if (engineMode === 'stacker') {
      const total = d.stackConfig ? d.stackConfig.layers.length : 5;
      hud.innerHTML = `
        <span class="hud-score">得分 ${d.score}</span>
        <span class="hud-layers">${d.stackLayers.length} / ${total} 层</span>
        <div class="hud-lives">
          <span class="heart ${d.lives >= 1 ? 'on' : ''}">♥</span>
          <span class="heart ${d.lives >= 2 ? 'on' : ''}">♥</span>
          <span class="heart ${d.lives >= 3 ? 'on' : ''}">♥</span>
        </div>
      `;
      const cord = root.querySelector('#mg-cord');
      if (d.activeLayer && d.activePhase === 'swing') {
        cord.style.display = 'block';
        cord.style.left = `${d.swingX}%`;
      } else {
        cord.style.display = 'none';
      }
      const activeEl = root.querySelector('#mg-active-layer');
      if (d.activeLayer) {
        activeEl.style.display = 'flex';
        activeEl.className = `pastry-block layer-${d.activeLayer.style} is-active`;
        activeEl.style.left = `${d.swingX}%`;
        activeEl.style.top = `${d.dropY / 2}px`;
        activeEl.style.width = `${d.activeLayer.width}%`;
        activeEl.style.height = `${d.stackLayerHeight / 2}px`;
        activeEl.innerHTML = d.activePhase === 'swing' ? `<span class="block-tag">${d.activeLayer.name}</span>` : '';
      } else {
        activeEl.style.display = 'none';
      }
      if (d.stackLayers.length !== lastLandedCount) {
        lastLandedCount = d.stackLayers.length;
        root.querySelector('#mg-landed-layers').innerHTML = d.stackLayers.map((item, idx) => `
          <div class="pastry-block layer-${item.style} is-landed"
               style="left:${item.x}%;bottom:${(44 + idx * d.stackLayerHeight) / 2}px;width:${item.width}%;height:${d.stackLayerHeight / 2}px;"></div>
        `).join('');
      }
      const judgeEl = root.querySelector('#mg-judge');
      judgeEl.className = `judge-bar judge-${d.judgeKind}`;
      judgeEl.textContent = d.judgeText;
      const btn = root.querySelector('#mg-stack-btn');
      btn.style.display = !d.gameFailed && d.activePhase !== 'done' ? 'block' : 'none';
      btn.textContent = d.activeLayer ? `松手放下：${d.activeLayer.name}` : '堆叠完成！';
    } else if (engineMode === 'rhythm') {
      hud.innerHTML = `
        <span class="hud-score">得分 ${d.rhythmScore}</span>
        <span class="hud-layers">节拍 ${d.rhythmDone} / ${d.rhythmTotal}</span>
        <span class="hud-score">连击 x${d.rhythmCombo}</span>
      `;
      const noteImg = d.rhythmConfig ? d.rhythmConfig.noteImg : '';
      root.querySelector('#mg-rhythm-notes').innerHTML = (d.rhythmNotes || []).map(n => `
        <div class="rhythm-note" style="left:${n.lane * 33.33 + 16.66}%;top:${n.y}%;">
          <img class="note-sprite mode-fit" src="${noteImg}" alt="" />
        </div>
      `).join('');
      const judgeEl = root.querySelector('#mg-judge');
      judgeEl.className = `judge-bar judge-${d.rhythmJudgeKind}`;
      judgeEl.textContent = d.rhythmJudge;
    } else if (engineMode === 'multi_pan') {
      const target = d.panConfig ? d.panConfig.targetServings : 6;
      hud.innerHTML = `
        <span class="hud-score">得分 ${d.panScore}</span>
        <span class="hud-layers">出锅 ${d.panServed} / ${target}</span>
        <span class="hud-score">⏱ ${d.panTimeLeft}s</span>
      `;
      (d.pans || []).forEach(p => {
        const slot = root.querySelector(`#mg-pan-${p.id}`);
        if (!slot) return;
        slot.className = `burner-slot state-${p.state}`;
        root.querySelector(`#mg-pan-badge-${p.id}`).textContent = p.label;
        root.querySelector(`#mg-pan-fill-${p.id}`).style.width = `${p.heat}%`;
        if (lastPanSrc[p.id] !== p.spriteImg) {
          lastPanSrc[p.id] = p.spriteImg;
          root.querySelector(`#mg-pan-img-${p.id}`).src = p.spriteImg;
        }
      });
      root.querySelector('#mg-feedback').textContent = d.panTip;
    } else {
      hud.innerHTML = `
        <span class="hud-score">得分 ${d.catchScore}</span>
        <span class="hud-layers">${d.catchCollected}/${d.catchTarget} · ⏱${d.catchTimeLeft}s</span>
        <div class="hud-lives">
          <span class="heart ${d.catchLives >= 1 ? 'on' : ''}">♥</span>
          <span class="heart ${d.catchLives >= 2 ? 'on' : ''}">♥</span>
          <span class="heart ${d.catchLives >= 3 ? 'on' : ''}">♥</span>
        </div>
      `;
      root.querySelector('#mg-catch-vessel').style.left = `${d.catchBasketX}%`;
      root.querySelector('#mg-catch-items').innerHTML = (d.catchItems || []).map(it => `
        <div class="falling-sprite-wrap" style="left:${it.x}%;top:${it.y}%;">
          <img class="falling-sprite mode-fit" src="${it.img}" alt="" />
        </div>
      `).join('');
      root.querySelector('#mg-feedback').textContent = d.catchTip;
    }

    if (d.gameFailed !== lastFailState) {
      lastFailState = d.gameFailed;
      root.querySelector('#mg-fail-slot').innerHTML = d.gameFailed
        ? `<div class="fail-modal-mask">
            <div class="card fail-modal-card">
              <span class="fail-modal-title">${d.failTitle}</span>
              <span class="fail-modal-reason">${d.failReason}</span>
              <div class="fail-modal-hint">达成基础目标获 B 级即可过关！72% 获 A 级，90% 且零失误解锁 S 级传奇剧情！</div>
              <div class="btn-primary fail-retry-btn" data-action="retry">↻ 立即重新挑战</div>
            </div>
          </div>`
        : '';
    }
  }

  // 启动对应引擎
  if (engineMode === 'oven') engine = createOvenEngine(pageProxy, onComplete, onFail);
  else if (engineMode === 'stacker') engine = createStackerEngine(pageProxy, STACKER_RECIPES[type], onComplete, onFail);
  else if (engineMode === 'rhythm') engine = createRhythmEngine(pageProxy, type, onComplete, onFail);
  else if (engineMode === 'multi_pan') engine = createMultiPanEngine(pageProxy, type, onComplete, onFail);
  else engine = createCatchEngine(pageProxy, CATCH_CONFIGS[type] ? type : 'orbit_match', onComplete, onFail);

  engine.start();

  const onClick = (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'retry') {
      lastLandedCount = -1;
      pageProxy.setData({ gameFailed: false });
      engine.start();
    } else if (action === 'ovenTap') {
      engine.onTap?.();
    } else if (action === 'stackDrop') {
      engine.drop?.();
    } else if (action === 'rhythmHit') {
      engine.hitLane?.(Number(target.dataset.lane));
    } else if (action === 'tapPan') {
      engine.tapPan?.(Number(target.dataset.id));
    } else if (action === 'moveLeft') {
      engine.moveBasket?.(-16);
    } else if (action === 'moveRight') {
      engine.moveBasket?.(16);
    } else if (action === 'catchArena') {
      const arena = root.querySelector('#mg-catch-arena');
      if (arena && engine.setBasketX) {
        const rect = arena.getBoundingClientRect();
        const pct = Math.round(((e.clientX - rect.left) / Math.max(1, rect.width)) * 100);
        engine.setBasketX(pct);
      }
    }
  };

  // 桌面键盘快捷操控
  const onKeyDown = (e) => {
    if (pageProxy.data.gameFailed) return;
    const k = e.key.toLowerCase();
    if (engineMode === 'oven' && (e.code === 'Space' || e.key === 'Enter')) {
      e.preventDefault(); engine.onTap?.();
    } else if (engineMode === 'stacker' && (e.code === 'Space' || e.key === 'Enter')) {
      e.preventDefault(); engine.drop?.();
    } else if (engineMode === 'rhythm') {
      if (k === '1' || k === 'a' || e.key === 'ArrowLeft') engine.hitLane?.(0);
      else if (k === '2' || k === 's' || e.key === 'ArrowDown') engine.hitLane?.(1);
      else if (k === '3' || k === 'd' || e.key === 'ArrowRight') engine.hitLane?.(2);
    } else if (engineMode === 'multi_pan') {
      if (k === '1' || k === 'a') engine.tapPan?.(0);
      else if (k === '2' || k === 's') engine.tapPan?.(1);
      else if (k === '3' || k === 'd') engine.tapPan?.(2);
    } else if (engineMode === 'catch') {
      if (e.key === 'ArrowLeft' || k === 'a') { e.preventDefault(); engine.moveBasket?.(-16); }
      else if (e.key === 'ArrowRight' || k === 'd') { e.preventDefault(); engine.moveBasket?.(16); }
    }
  };

  root.addEventListener('click', onClick);
  window.addEventListener('keydown', onKeyDown);

  return () => {
    destroyed = true;
    clearTimeout(finishTimer);
    engine?.stop?.();
    root.removeEventListener('click', onClick);
    window.removeEventListener('keydown', onKeyDown);
  };
}
