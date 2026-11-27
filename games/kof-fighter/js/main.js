(function () {
  window.KOF = window.KOF || {};

  // Keyboard state map
  const keys = new Set();

  window.addEventListener('keydown', (e) => {
    const code = e.code;
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Space',
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD'
      ].includes(code)
    ) {
      e.preventDefault();
    }
    keys.add(code);

    if (code === 'Escape') {
      togglePauseIfInGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  // Virtual touch input state (for Mobile Joystick & Touch Pad -> controls 1P)
  const touchInput = {
    left: false,
    right: false,
    up: false,
    down: false,
    lp: false,
    lk: false,
    hp: false,
    hk: false,
    roll: false,
    super: false
  };

  function clearTouchInput() {
    Object.keys(touchInput).forEach((k) => {
      touchInput[k] = false;
    });
  }

  window.addEventListener('blur', () => {
    keys.clear();
    clearTouchInput();
  });

  function readPlayerInput(playerIndex) {
    if (playerIndex === 0) {
      return {
        left: keys.has('KeyA') || touchInput.left,
        right: keys.has('KeyD') || touchInput.right,
        up: keys.has('KeyW') || touchInput.up,
        down: keys.has('KeyS') || touchInput.down,
        lp: keys.has('KeyJ') || touchInput.lp,
        lk: keys.has('KeyK') || touchInput.lk,
        hp: keys.has('KeyU') || touchInput.hp,
        hk: keys.has('KeyI') || touchInput.hk,
        roll: keys.has('KeyL') || touchInput.roll,
        super: keys.has('KeyO') || touchInput.super
      };
    }
    // P2 supports both Numpad (1-6) and Laptop keys (N, M, Comma, Period, Slash, Semicolon)
    return {
      left: keys.has('ArrowLeft'),
      right: keys.has('ArrowRight'),
      up: keys.has('ArrowUp'),
      down: keys.has('ArrowDown'),
      lp: keys.has('Numpad1') || keys.has('KeyN'),
      lk: keys.has('Numpad2') || keys.has('KeyM'),
      hp: keys.has('Numpad4') || keys.has('Comma'),
      hk: keys.has('Numpad5') || keys.has('Period'),
      roll: keys.has('Numpad3') || keys.has('Slash'),
      super: keys.has('Numpad6') || keys.has('Semicolon')
    };
  }

  // UI state
  const state = {
    screen: 'title', // title, select, battle
    mode: 'pve', // pve, pvp
    difficulty: 'normal',
    p1CharId: 'kyo',
    p2CharId: 'iori',
    stageId: 'osaka',
    pickingSlot: 0 // 0 = P1, 1 = P2
  };

  // DOM References
  const $ = (id) => document.getElementById(id);
  const canvas = $('game-canvas');
  const screenTitle = $('screen-title');
  const screenSelect = $('screen-select');
  const screenPause = $('screen-pause');
  const screenResult = $('screen-result');
  const screenControls = $('screen-controls');
  const battleHud = $('battle-hud');

  const btnTouchToggle = $('btn-touch-toggle');
  const btnSound = $('btn-sound');
  const btnBgm = $('btn-bgm');
  const btnControls = $('btn-controls');
  const btnCloseControls = $('btn-close-controls');
  const btnPause = $('btn-pause');

  const touchControlsEl = $('touch-controls');
  const joystickZone = $('joystick-zone');
  const joystickBase = $('joystick-base');
  const joystickKnob = $('joystick-knob');
  const touchBtnSuper = $('touch-btn-super');
  const joyDirEls = {
    up: joystickBase.querySelector('.joy-dir.up'),
    down: joystickBase.querySelector('.joy-dir.down'),
    left: joystickBase.querySelector('.joy-dir.left'),
    right: joystickBase.querySelector('.joy-dir.right')
  };

  // Touch mode: 'auto' | 'on' | 'off'
  let touchMode = 'auto';

  function isTouchEnvironment() {
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth <= 900
    );
  }

  function updateTouchControlsVisibility() {
    const shouldShow =
      state.screen === 'battle' &&
      (touchMode === 'on' || (touchMode === 'auto' && isTouchEnvironment()));
    touchControlsEl.classList.toggle('hidden', !shouldShow);
    battleHud.classList.toggle('touch-active', shouldShow);
    if (!shouldShow) clearTouchInput();
  }

  // Multi-touch Virtual Joystick (8-way with deadzone & bulletproof iOS release guards)
  let joyPointerId = null;

  function resetJoystick() {
    joyPointerId = null;
    touchInput.left = false;
    touchInput.right = false;
    touchInput.up = false;
    touchInput.down = false;
    joystickKnob.classList.remove('dragging');
    joystickKnob.style.transform = 'translate(0px, 0px)';
    Object.values(joyDirEls).forEach((el) => el.classList.remove('active'));
  }

  function releaseAllTouchControls() {
    resetJoystick();
    clearTouchInput();
    document.querySelectorAll('.touch-btn.pressed').forEach((b) => b.classList.remove('pressed'));
  }

  function updateJoystickFromPoint(clientX, clientY) {
    const rect = joystickBase.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.36;
    const deadzone = rect.width * 0.13;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    joystickKnob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;

    // 8-way direction detection (allows diagonal crouch-block & QCF motions!)
    touchInput.left = dx < -deadzone;
    touchInput.right = dx > deadzone;
    touchInput.up = dy < -deadzone * 1.15;
    touchInput.down = dy > deadzone;

    joyDirEls.left.classList.toggle('active', touchInput.left);
    joyDirEls.right.classList.toggle('active', touchInput.right);
    joyDirEls.up.classList.toggle('active', touchInput.up);
    joyDirEls.down.classList.toggle('active', touchInput.down);
  }

  joystickZone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyPointerId = e.pointerId;
    try {
      joystickZone.setPointerCapture(e.pointerId);
    } catch (_) {}
    joystickKnob.classList.add('dragging');
    updateJoystickFromPoint(e.clientX, e.clientY);
  });

  window.addEventListener('pointermove', (e) => {
    if (joyPointerId === null || e.pointerId !== joyPointerId) return;
    updateJoystickFromPoint(e.clientX, e.clientY);
  });

  const handleJoyRelease = (e) => {
    if (joyPointerId === null || e.pointerId !== joyPointerId) return;
    resetJoystick();
  };

  window.addEventListener('pointerup', handleJoyRelease);
  window.addEventListener('pointercancel', handleJoyRelease);
  joystickZone.addEventListener('lostpointercapture', handleJoyRelease);

  // Failsafe for iOS Safari / WeChat multi-touch: when zero fingers remain on screen, force reset!
  window.addEventListener(
    'touchend',
    (e) => {
      if (e.touches.length === 0) {
        releaseAllTouchControls();
      }
    },
    { passive: true }
  );
  window.addEventListener('touchcancel', releaseAllTouchControls, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllTouchControls();
  });

  // Multi-touch Action Buttons
  document.querySelectorAll('.touch-btn').forEach((btn) => {
    const action = btn.dataset.action;
    const activePointers = new Set();

    const release = (pid) => {
      if (pid !== undefined) activePointers.delete(pid);
      else activePointers.clear();
      if (activePointers.size === 0) {
        touchInput[action] = false;
        btn.classList.remove('pressed');
      }
    };

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      activePointers.add(e.pointerId);
      try {
        btn.setPointerCapture(e.pointerId);
      } catch (_) {}
      touchInput[action] = true;
      btn.classList.add('pressed');
    });

    window.addEventListener('pointerup', (e) => {
      if (activePointers.has(e.pointerId)) release(e.pointerId);
    });
    window.addEventListener('pointercancel', (e) => {
      if (activePointers.has(e.pointerId)) release(e.pointerId);
    });
    btn.addEventListener('lostpointercapture', (e) => release(e.pointerId));
  });

  // Prevent scroll bounce only on touchmove (never block touchstart so Pointer Events fire cleanly on iOS!)
  touchControlsEl.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  btnTouchToggle.addEventListener('click', () => {
    const order = ['auto', 'on', 'off'];
    touchMode = order[(order.indexOf(touchMode) + 1) % order.length];
    const labels = { auto: '摇杆: 自动', on: '摇杆: 开', off: '摇杆: 关' };
    const lbl = btnTouchToggle.querySelector('.btn-label');
    if (lbl) lbl.textContent = labels[touchMode];
    updateTouchControlsVisibility();
  });

  window.addEventListener('resize', updateTouchControlsVisibility);

  const hudP1Hp = $('p1-hp');
  const hudP1HpDmg = $('p1-hp-dmg');
  const hudP2Hp = $('p2-hp');
  const hudP2HpDmg = $('p2-hp-dmg');
  const hudP1Guard = $('p1-guard');
  const hudP2Guard = $('p2-guard');
  const hudP1Power = $('p1-power-fill');
  const hudP2Power = $('p2-power-fill');
  const hudP1Stocks = $('p1-stocks');
  const hudP2Stocks = $('p2-stocks');
  const hudP1Combo = $('p1-combo');
  const hudP2Combo = $('p2-combo');
  const hudRound = $('hud-round');
  const hudTimer = $('hud-timer');
  const announceBanner = $('announce-banner');
  const announceMain = $('announce-main');
  const announceSub = $('announce-sub');

  // Render an idle animated preview on title background
  let bgPreviewRaf = null;
  let bgTime = 0;
  function startTitleBackground() {
    if (bgPreviewRaf) cancelAnimationFrame(bgPreviewRaf);
    const ctx = canvas.getContext('2d');
    const drawBg = () => {
      if (state.screen === 'battle') return;
      bgTime++;
      const stage = window.KOF.getStageById(state.stageId);
      stage.draw(ctx, canvas.width, canvas.height, 505, bgTime, 160 + Math.sin(bgTime * 0.008) * 90);
      bgPreviewRaf = requestAnimationFrame(drawBg);
    };
    drawBg();
  }

  function showScreen(name) {
    state.screen = name;
    screenTitle.classList.toggle('hidden', name !== 'title');
    screenSelect.classList.toggle('hidden', name !== 'select');
    battleHud.classList.toggle('hidden', name !== 'battle');
    btnPause.classList.toggle('hidden', name !== 'battle');
    screenPause.classList.add('hidden');
    screenResult.classList.add('hidden');
    document.body.classList.toggle('in-battle', name === 'battle');
    updateTouchControlsVisibility();

    if (name !== 'battle') {
      engine.stop();
      startTitleBackground();
    }
  }

  function togglePauseIfInGame() {
    if (state.screen !== 'battle' || !screenResult.classList.contains('hidden')) return;
    const isPaused = !screenPause.classList.contains('hidden');
    if (isPaused) {
      screenPause.classList.add('hidden');
      engine.setPaused(false);
    } else {
      screenPause.classList.remove('hidden');
      engine.setPaused(true);
    }
  }

  // Character Select UI rendering
  function renderSelectScreen() {
    $('select-heading').textContent = state.mode === 'pve' ? '选择格斗家 — PVE 单人模式' : '选择格斗家 — PVP 双人对决';
    $('difficulty-picker').classList.toggle('hidden', state.mode !== 'pve');
    $('sel-p2-badge').textContent = state.mode === 'pve' ? 'CPU 对手' : '2P 选手';
    $('pick-prompt').textContent =
      state.pickingSlot === 0
        ? '当前选择：1P 角色（点击卡片切换，再点一次切到对手）'
        : `当前选择：${state.mode === 'pve' ? 'CPU 对手' : '2P 角色'}（点击卡片切换）`;

    // Roster Grid
    const grid = $('roster-grid');
    grid.innerHTML = '';
    window.KOF.CHARACTERS.forEach((ch) => {
      const isP1 = state.p1CharId === ch.id;
      const isP2 = state.p2CharId === ch.id;
      const card = document.createElement('button');
      card.className = 'roster-card';
      if (isP1 && isP2) card.classList.add('sel-both');
      else if (isP1) card.classList.add('sel-p1');
      else if (isP2) card.classList.add('sel-p2');

      card.innerHTML = `
        <div class="roster-icon" style="background: linear-gradient(135deg, ${ch.colors.primary}, ${ch.colors.secondary});">
          <img class="portrait-img" src="${ch.portrait}" alt="${ch.name}" loading="eager" decoding="sync" onerror="this.style.display='none'" />
          <span class="portrait-fallback">${ch.badge}</span>
        </div>
        <div class="roster-info">
          <b>${ch.name}</b>
          <span>${ch.style}</span>
        </div>
        <div class="roster-tags">
          ${isP1 ? '<span class="player-tag p1-tag">1P</span>' : ''}
          ${isP2 ? `<span class="player-tag p2-tag">${state.mode === 'pve' ? 'CPU' : '2P'}</span>` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        window.KOF.audio.uiSelect();
        if (state.pickingSlot === 0) {
          state.p1CharId = ch.id;
          state.pickingSlot = 1;
        } else {
          state.p2CharId = ch.id;
          state.pickingSlot = 0;
        }
        renderSelectScreen();
      });
      grid.appendChild(card);
    });

    // Stage Pills with AI Stage Thumbnail Previews
    const pills = $('stage-pills');
    pills.innerHTML = '';
    window.KOF.STAGES.forEach((st) => {
      const btn = document.createElement('button');
      btn.className = 'stage-pill' + (state.stageId === st.id ? ' active' : '');
      btn.innerHTML = `
        <img class="stage-thumb" src="${st.thumb}" alt="${st.name}" onerror="this.style.display='none'" />
        <span class="stage-pill-name">${st.name}</span>
      `;
      btn.addEventListener('click', () => {
        window.KOF.audio.uiSelect();
        state.stageId = st.id;
        renderSelectScreen();
      });
      pills.appendChild(btn);
    });

    // Update Previews
    updatePreviewPanel('p1', window.KOF.getCharacterById(state.p1CharId));
    updatePreviewPanel('p2', window.KOF.getCharacterById(state.p2CharId));
  }

  function updatePreviewPanel(slot, ch) {
    const avatar = $(`sel-${slot}-avatar`);
    avatar.style.background = `linear-gradient(135deg, ${ch.colors.primary}cc, ${ch.colors.secondary}cc)`;
    avatar.innerHTML = `
      <img class="preview-portrait-img" src="${ch.portrait}" alt="${ch.name}" loading="eager" decoding="sync" onerror="this.style.display='none'" />
      <span class="preview-portrait-label">${ch.enName}</span>
    `;
    $(`sel-${slot}-name`).textContent = ch.name;
    $(`sel-${slot}-style`).textContent = ch.style;

    $(`sel-${slot}-stats`).innerHTML = `
      <div class="stat-row"><span>攻击</span><div class="stat-track"><div class="stat-fill" style="width:${ch.stats.power}%"></div></div></div>
      <div class="stat-row"><span>速度</span><div class="stat-track"><div class="stat-fill" style="width:${ch.stats.speed}%"></div></div></div>
      <div class="stat-row"><span>防御</span><div class="stat-track"><div class="stat-fill" style="width:${ch.stats.defense}%"></div></div></div>
    `;

    $(`sel-${slot}-moves`).innerHTML = `
      <div><b>波动:</b> ${ch.specialNames.projectile}</div>
      <div><b>对空:</b> ${ch.specialNames.antiAir}</div>
      <div><b>突进:</b> ${ch.specialNames.rush}</div>
      <div style="color:#fde047;"><b>超杀:</b> ${ch.specialNames.super}</div>
    `;
  }

  function updateWinOrbs(containerId, wins) {
    const orbs = $(containerId).querySelectorAll('.orb');
    orbs.forEach((orb, idx) => {
      orb.classList.toggle('won', idx < wins);
    });
  }

  // Instantiate Engine
  const engine = new window.KOF.GameEngine(canvas, {
    getPlayerInput: readPlayerInput,

    onMatchInit(p1, p2, mode) {
      $('p1-name').textContent = p1.config.name;
      $('p2-name').textContent = p2.config.name;
      $('p2-tag').textContent = mode === 'pve' ? 'CPU' : '2P';
      $('p2-power-hint').textContent = mode === 'pve' ? 'AI 能量槽' : 'Num6 / ;: 超必杀';

      const p1Port = $('p1-portrait');
      p1Port.style.background = `linear-gradient(135deg, ${p1.config.colors.primary}, ${p1.config.colors.secondary})`;
      p1Port.innerHTML = `<img class="portrait-img" src="${p1.config.portrait}" alt="${p1.config.name}" loading="eager" decoding="sync" onerror="this.style.display='none'" /><span class="portrait-fallback">${p1.config.badge}</span>`;

      const p2Port = $('p2-portrait');
      p2Port.style.background = `linear-gradient(135deg, ${p2.config.colors.primary}, ${p2.config.colors.secondary})`;
      p2Port.innerHTML = `<img class="portrait-img" src="${p2.config.portrait}" alt="${p2.config.name}" loading="eager" decoding="sync" onerror="this.style.display='none'" /><span class="portrait-fallback">${p2.config.badge}</span>`;
    },

    onTick(p1, p2, roundNumber, timer) {
      hudRound.textContent = `ROUND ${roundNumber}`;
      hudTimer.textContent = String(timer).padStart(2, '0');

      const p1Pct = Math.max(0, (p1.hp / p1.maxHp) * 100);
      const p2Pct = Math.max(0, (p2.hp / p2.maxHp) * 100);
      hudP1Hp.style.width = `${p1Pct}%`;
      hudP1HpDmg.style.width = `${p1Pct}%`;
      hudP1Hp.classList.toggle('low', p1Pct < 28);

      hudP2Hp.style.width = `${p2Pct}%`;
      hudP2HpDmg.style.width = `${p2Pct}%`;
      hudP2Hp.classList.toggle('low', p2Pct < 28);

      hudP1Guard.style.width = `${Math.max(0, p1.guard)}%`;
      hudP2Guard.style.width = `${Math.max(0, p2.guard)}%`;

      hudP1Power.style.width = `${p1.stocks >= 3 ? 100 : p1.power}%`;
      hudP1Power.classList.toggle('ready', p1.stocks >= 1);
      hudP1Stocks.textContent = `MAX ${p1.stocks}`;
      if (touchBtnSuper) touchBtnSuper.classList.toggle('ready', p1.stocks >= 1);

      hudP2Power.style.width = `${p2.stocks >= 3 ? 100 : p2.power}%`;
      hudP2Power.classList.toggle('ready', p2.stocks >= 1);
      hudP2Stocks.textContent = `MAX ${p2.stocks}`;

      updateWinOrbs('p1-wins', p1.wins);
      updateWinOrbs('p2-wins', p2.wins);

      // Combo counters
      if (p1.comboCount >= 2) {
        hudP1Combo.classList.remove('hidden');
        hudP1Combo.querySelector('.combo-count').textContent = p1.comboCount;
      } else {
        hudP1Combo.classList.add('hidden');
      }

      if (p2.comboCount >= 2) {
        hudP2Combo.classList.remove('hidden');
        hudP2Combo.querySelector('.combo-count').textContent = p2.comboCount;
      } else {
        hudP2Combo.classList.add('hidden');
      }
    },

    showAnnouncement(main, sub) {
      announceMain.textContent = main;
      announceSub.textContent = sub || '';
      announceBanner.classList.remove('hidden');
    },

    hideAnnouncement() {
      announceBanner.classList.add('hidden');
    },

    onMatchEnd(winner, p1, p2) {
      const winnerLabel = winner === p1 ? '1P' : state.mode === 'pve' ? 'CPU' : '2P';
      $('result-kicker').textContent = winner === p1 ? 'CHAMPION VICTORY' : state.mode === 'pve' ? 'DEFEAT' : '2P VICTORY';
      $('result-winner').textContent = `${winnerLabel} ${winner.config.name} 获胜!`;
      $('result-quote').textContent = winner.config.quote;
      $('result-stats').innerHTML = `
        <div><b>1P ${p1.config.name}</b><br/>胜局: ${p1.wins} · 最高连击: ${p1.maxComboReached} Hits<br/>总伤害: ${p1.totalDamageDealt} · 超杀: ${p1.supersUsed} 次</div>
        <div><b>${state.mode === 'pve' ? 'CPU' : '2P'} ${p2.config.name}</b><br/>胜局: ${p2.wins} · 最高连击: ${p2.maxComboReached} Hits<br/>总伤害: ${p2.totalDamageDealt} · 超杀: ${p2.supersUsed} 次</div>
      `;
      screenResult.classList.remove('hidden');
    }
  });

  function launchCurrentMatch() {
    window.KOF.audio.uiConfirm();
    showScreen('battle');
    engine.startMatch({
      mode: state.mode,
      p1CharId: state.p1CharId,
      p2CharId: state.p2CharId,
      stageId: state.stageId,
      difficulty: state.difficulty
    });
  }

  // Button Wiring
  $('btn-mode-pve').addEventListener('click', () => {
    window.KOF.audio.uiConfirm();
    state.mode = 'pve';
    state.pickingSlot = 0;
    renderSelectScreen();
    showScreen('select');
  });

  $('btn-mode-pvp').addEventListener('click', () => {
    window.KOF.audio.uiConfirm();
    state.mode = 'pvp';
    state.pickingSlot = 0;
    renderSelectScreen();
    showScreen('select');
  });

  $('btn-back-title').addEventListener('click', () => {
    window.KOF.audio.uiSelect();
    showScreen('title');
  });

  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.KOF.audio.uiSelect();
      state.difficulty = btn.dataset.diff;
      document.querySelectorAll('.diff-btn').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  $('btn-start-match').addEventListener('click', launchCurrentMatch);

  // Header controls
  btnSound.addEventListener('click', () => {
    window.KOF.audio.sfxEnabled = !window.KOF.audio.sfxEnabled;
    const lbl = btnSound.querySelector('.btn-label');
    if (lbl) lbl.textContent = window.KOF.audio.sfxEnabled ? '音效: 开' : '音效: 关';
    btnSound.classList.toggle('is-muted', !window.KOF.audio.sfxEnabled);
  });

  btnBgm.addEventListener('click', () => {
    window.KOF.audio.bgmEnabled = !window.KOF.audio.bgmEnabled;
    const lbl = btnBgm.querySelector('.btn-label');
    if (lbl) lbl.textContent = window.KOF.audio.bgmEnabled ? 'BGM: 开' : 'BGM: 关';
    btnBgm.classList.toggle('is-muted', !window.KOF.audio.bgmEnabled);
    if (window.KOF.audio.bgmEnabled && state.screen === 'battle') {
      window.KOF.audio.startBgm();
    } else {
      window.KOF.audio.stopBgm();
    }
  });

  btnControls.addEventListener('click', () => {
    window.KOF.audio.uiSelect();
    screenControls.classList.remove('hidden');
    if (state.screen === 'battle') engine.setPaused(true);
  });

  btnCloseControls.addEventListener('click', () => {
    screenControls.classList.add('hidden');
    if (state.screen === 'battle' && screenPause.classList.contains('hidden')) {
      engine.setPaused(false);
    }
  });

  btnPause.addEventListener('click', togglePauseIfInGame);

  // Pause menu buttons
  $('btn-resume').addEventListener('click', togglePauseIfInGame);
  $('btn-restart-round').addEventListener('click', launchCurrentMatch);
  $('btn-pause-select').addEventListener('click', () => {
    renderSelectScreen();
    showScreen('select');
  });
  $('btn-pause-title').addEventListener('click', () => showScreen('title'));

  // Result buttons
  $('btn-rematch').addEventListener('click', launchCurrentMatch);
  $('btn-result-select').addEventListener('click', () => {
    renderSelectScreen();
    showScreen('select');
  });
  $('btn-result-title').addEventListener('click', () => showScreen('title'));

  // Asset Preloader (ensures all portraits, 4-pose sprites, stages & title art are loaded before play!)
  function preloadImage(src, existingImg) {
    return new Promise((resolve) => {
      const img = existingImg || new Image();
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve(img);
      };
      const timer = setTimeout(done, 12000);
      const finish = () => {
        clearTimeout(timer);
        if (img.decode) {
          img.decode().catch(() => {}).finally(done);
        } else {
          done();
        }
      };

      if (img.complete && img.naturalWidth > 0) {
        finish();
        return;
      }
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', () => {
        clearTimeout(timer);
        done();
      }, { once: true });
      if (!img.src) img.src = src;
    });
  }

  async function preloadAllAssets() {
    const loaderScreen = $('screen-loader');
    const loaderFill = $('loader-fill');
    const loaderCount = $('loader-count');
    const loaderPct = $('loader-pct');
    const loaderStatus = $('loader-status');

    // Retain all preloaded Image instances in memory so mobile browsers never evict decoded portraits/stages
    window.KOF.PORTRAITS = window.KOF.PORTRAITS || {};
    window.KOF.UI_IMAGES = window.KOF.UI_IMAGES || {};
    const titleImg = new Image();
    window.KOF.UI_IMAGES.titleBg = titleImg;

    const queue = [{ src: 'assets/ui/title-bg.jpg', img: titleImg }];
    window.KOF.STAGES.forEach((st) => {
      queue.push({ src: st.thumb, img: window.KOF.STAGE_IMAGES && window.KOF.STAGE_IMAGES[st.id] });
    });
    window.KOF.CHARACTERS.forEach((ch) => {
      const pImg = new Image();
      window.KOF.PORTRAITS[ch.id] = pImg;
      queue.push({ src: ch.portrait, img: pImg });
      queue.push({ src: ch.sprite, img: window.KOF.SPRITES && window.KOF.SPRITES[ch.id] });
      queue.push({ src: ch.walkSprite, img: window.KOF.WALK_SPRITES && window.KOF.WALK_SPRITES[ch.id] });
    });

    const total = queue.length;
    let loaded = 0;

    const updateProgress = () => {
      const pct = Math.round((loaded / total) * 100);
      if (loaderFill) loaderFill.style.width = `${pct}%`;
      if (loaderCount) loaderCount.textContent = `${loaded} / ${total}`;
      if (loaderPct) loaderPct.textContent = `${pct}%`;
    };
    updateProgress();

    await Promise.all(
      queue.map((item) =>
        preloadImage(item.src, item.img).then(() => {
          loaded++;
          updateProgress();
        })
      )
    );

    if (loaderStatus) loaderStatus.textContent = '加载完成 · READY TO FIGHT!';
    setTimeout(() => {
      if (loaderScreen) loaderScreen.classList.add('hidden');
      renderSelectScreen();
      showScreen('title');
    }, 180);
  }

  // Boot with Asset Preloader
  preloadAllAssets();
})();
