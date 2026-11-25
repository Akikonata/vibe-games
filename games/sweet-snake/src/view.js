// src/view.js
// 纯 HTML5 响应式 UI 渲染层（通过签名比对实现按需增量渲染，保持双 Canvas 持久挂载不闪烁）

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHeader(d) {
  const pausedDisabled = d.mode !== 'playing';
  return `
    <button type="button" class="small-button pause-btn ${pausedDisabled ? 'is-disabled' : ''}" data-action="pause" ${pausedDisabled ? 'disabled' : ''} aria-label="暂停游戏">Ⅱ</button>
    <img class="logo" src="assets/logo.png" alt="糖心蛇蛇" />
    <div class="hud">
      <div class="score-pill hud-score-card">
        <div class="hud-badge hud-badge-score"><img src="assets/food-strawberry.png" alt="" /></div>
        <div class="hud-meta">
          <span class="label">本关得分</span>
          <span class="number">${d.score}</span>
        </div>
      </div>
      <div class="score-pill best-pill hud-best-card ${d.recordBrokeNow ? 'hud-record-burst' : ''}">
        <div class="hud-badge hud-badge-best"><img src="assets/map/star-full.png" alt="" /></div>
        <div class="hud-meta">
          <span class="label">单关纪录</span>
          <span class="number ${d.recordBrokeNow ? 'record-num-pop' : ''}">${d.best}</span>
        </div>
        ${d.recordBrokeNow || d.newRecord ? '<span class="hud-new-tag">NEW</span>' : ''}
      </div>
    </div>
  `;
}

function renderLevelStrip(d) {
  const missionsHtml = (d.missions || []).map(m => `
    <div class="hud-mission-item ${m.done ? 'hud-mission-done' : ''}">
      <img class="target-food" src="assets/food-${esc(m.type)}.png" alt="" />
      <span>${m.collected}/${m.target}</span>
    </div>
  `).join('');

  const coinChip = (d.levelCoins > 0 || d.doubleCoinActive || d.reviveArmed)
    ? `<span class="hud-coin-chip">💰${d.levelCoins}${d.doubleCoinActive ? '×2' : ''}${d.reviveArmed ? '💖' : ''}</span>`
    : '';

  const rightHtml = d.isTutorial
    ? '<button type="button" class="tutorial-skip-chip" data-action="skipTutorial">跳过教学 ›</button>'
    : `<div class="level-right-meta">
        ${d.itemSeconds > 0 ? `<span class="hud-active-item-chip">✨${d.itemSeconds}s</span>` : ''}
        <span class="level-target ${d.activeItem === 'slow' ? 'level-target-frozen' : ''}">${d.activeItem === 'slow' ? '❄ ' : '⏱ '}${d.remaining} 秒</span>
      </div>`;

  return `
    <div class="level-number">
      <span class="level-tag">${d.isTutorial ? '教学关' : '第' + d.level + '关'}</span>
      ${missionsHtml}
      ${coinChip}
    </div>
    ${rightHtml}
  `;
}

function renderTutorialOverlay(d) {
  if (!d.isTutorial || d.mode !== 'playing') return '';
  let bannerText = '🍓 第 3/3 步：自由划动或按方向键，吃掉最后 1 颗草莓就毕业啦！';
  if (d.tutorialStep === 1) bannerText = '👆 第 1/3 步：向上滑动或按【↑ / W】，拐弯吃掉草莓！';
  else if (d.tutorialStep === 2) bannerText = '👉 第 2/3 步：向右滑动或按【→ / D】，顺路吃金币和第 2 颗草莓！';

  const handHtml = (d.tutorialStep <= 2 && !d.tutorialSwiped)
    ? `<div class="tutorial-hand-hint tutorial-hand-${d.tutorialStep === 1 ? 'up' : 'right'}">
        <span class="tutorial-hand-arrow">${d.tutorialStep === 1 ? '↑' : '→'}</span>
        <span class="tutorial-hand-icon">👆</span>
      </div>`
    : '';

  return `
    <div class="tutorial-banner"><span class="tutorial-banner-text">${bannerText}</span></div>
    ${handHtml}
  `;
}

function renderOverlay(d) {
  const modal = d.modal;
  if (!modal || ['levels', 'garden', 'home', 'shop'].includes(modal)) return '';

  let rainHtml = '';
  if ((modal === 'cleared' || modal === 'completed') && d.settleRaining) {
    const coins = d.coinDrops.filter(c => c.tier <= d.settleTier).map(c =>
      `<div class="rain-coin" style="left:${c.left}%;width:${c.size}px;height:${c.size}px;animation-delay:${c.delay}s;animation-duration:${c.dur}s"><span class="rain-coin-star">★</span></div>`
    ).join('');
    const confetti = d.confettiDrops.filter(c => c.tier <= d.settleTier).map(c =>
      `<div class="rain-confetti ${c.ribbon ? 'rain-ribbon' : ''}" style="left:${c.left}%;width:${c.w}px;height:${c.h}px;background:${c.color};animation-delay:${c.delay}s;animation-duration:${c.dur}s"></div>`
    ).join('');
    rainHtml = `<div class="coin-rain-layer">${coins}${confetti}</div>`;
  }

  let bodyHtml = '';
  if (modal === 'start') {
    const missionsHtml = (d.missions || []).map(m => `
      <div class="start-mission-item">
        <img class="start-mission-icon" src="assets/food-${esc(m.type)}.png" alt="" />
        <span>×${m.target}</span>
      </div>
    `).join('');

    const roleSection = (d.shopUnlocked || d.unlockedSnakes.length > 1)
      ? `<div class="role-section">
          <div class="prepare-header">
            <span class="prepare-label">出战角色</span>
            <span class="prepare-tip prepare-tip-active">${esc(d.activeSnakeInfo.skillName)} · ${esc(d.activeSnakeInfo.skillDesc)}</span>
          </div>
          <div class="role-scroll scroll-x">
            ${d.snakeCards.map(s => `
              <button type="button" class="role-pill ${s.equipped ? 'role-pill-active' : ''} ${!s.owned ? 'role-pill-locked' : ''}" data-action="chooseRole" data-id="${esc(s.id)}">
                <div class="role-pill-inner">
                  <div class="role-dot" style="background:${esc(s.swatch)}"></div>
                  <span class="role-name">${s.owned ? esc(s.name) : '🔒 ' + esc(s.name)}</span>
                </div>
              </button>
            `).join('')}
          </div>
        </div>`
      : '';

    const itemSection = d.ownedItems.length > 0
      ? `<div class="prepare-section">
          <div class="prepare-header">
            <span class="prepare-label">携带道具</span>
            <span class="prepare-tip ${d.lastChosenHint || d.selectedItemInfo ? 'prepare-tip-active' : ''}">${esc(d.lastChosenHint ? d.lastChosenHint : (d.selectedItemInfo ? d.selectedItemInfo.hint + ' · 开局投在嘴边' : '开局投在嘴边，未吃自动返还'))}</span>
          </div>
          <div class="prepare-items prepare-items-grid">
            ${d.ownedItems.map(item => {
              const selected = d.selectedItem === item.id || (item.id === 'doubleCoin' && d.useDoubleCoin) || (item.id === 'revive' && d.useRevive);
              return `
                <button type="button" class="prepare-item candy-cloud-item ${selected ? 'selected-item' : ''}" data-action="chooseItem" data-item="${esc(item.id)}">
                  ${item.kind === 'passive' ? '<span class="item-kind-tag">增益</span>' : ''}
                  <div class="candy-icon-puff"><img src="${esc(item.icon)}" alt="" /></div>
                  <span class="prepare-item-name">${esc(item.name)}</span>
                  <span class="prepare-item-count">×${item.count}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>`
      : '';

    const ctaHtml = d.error
      ? `<span class="error">${esc(d.error)}</span><button type="button" class="primary start-cta" data-action="initCanvas">重新加载</button>`
      : `<button type="button" class="primary start-cta ${!d.ready ? 'is-disabled' : ''}" data-action="start" ${!d.ready ? 'disabled' : ''}>${d.ready ? '挑战第 ' + d.level + ' 关' : '甜蜜加载中…'}</button>`;

    bodyHtml = `
      <img class="hero-snake start-hero" src="assets/snake-${esc(d.activeSkin)}.png" alt="" />
      <div class="start-heading">
        <span class="start-level-badge">第 ${d.level} 关</span>
        <span class="modal-title start-title">${esc(d.levelName)}</span>
      </div>
      <div class="start-mission">
        <div class="start-mission-foods">${missionsHtml}</div>
        <div class="start-mission-divider"></div>
        <span class="start-mission-time">⏱ ${d.remaining} 秒</span>
      </div>
      <span class="start-theme-hint">${esc(d.themeHint)}</span>
      ${roleSection}
      ${itemSection}
      ${ctaHtml}
      <div class="modal-links start-links">
        <button type="button" class="text-button" data-action="goHome">主页</button>
        <span class="link-dot">·</span>
        <button type="button" class="text-button" data-action="openLevels">选关</button>
        <span class="link-dot">·</span>
        <button type="button" class="text-button" data-action="openGarden">花园</button>
        <span class="link-dot">·</span>
        <button type="button" class="text-button" data-action="openShop">${d.shopUnlocked ? '糖果屋' : '🔒糖果屋'}</button>
      </div>
    `;
  } else if (modal === 'paused') {
    bodyHtml = `
      <img class="hero-snake small-hero" src="assets/snake-${esc(d.activeSkin)}.png" alt="" />
      <span class="modal-title">歇一会儿</span>
      <span class="modal-copy">${d.isTutorial ? `新手教学关 · 已收集 ${d.collected}/${d.target}` : `第 ${d.level} 关 · 已收集 ${d.collected}/${d.target} · 剩 ${d.remaining} 秒`}</span>
      ${!d.isTutorial ? `<span class="result-score">${d.score}<span class="score-unit"> 分</span></span>` : ''}
      <button type="button" class="primary" data-action="resume">${d.isTutorial ? '继续教学' : '继续游戏'}</button>
      ${d.isTutorial
        ? '<button type="button" class="secondary" data-action="skipTutorial">跳过教学，去第 1 关</button>'
        : '<button type="button" class="secondary" data-action="prepareRetry">重试本关</button>'}
      <div class="modal-links">
        <button type="button" class="text-button" data-action="goHome">返回主页</button>
        ${!d.isTutorial ? '<button type="button" class="text-button" data-action="openLevels">选关</button>' : ''}
        <button type="button" class="text-button" data-action="openSettings">设置</button>
      </div>
    `;
  } else if (modal === 'tutorial_done') {
    bodyHtml = `
      <img class="hero-snake small-hero" src="assets/snake-${esc(d.activeSkin)}.png" alt="" />
      <span class="modal-title">🎉 教学完成啦！</span>
      <span class="modal-copy">你已经掌握滑动 / 方向键转向啦～<br/>正式关卡中避开边界与路障，限时集齐目标食物就能过关！</span>
      <button type="button" class="primary" data-action="completeTutorial">开始第 1 关</button>
      <button type="button" class="text-button" data-action="replayGuide">再练一次教学关</button>
    `;
  } else if (modal === 'gameover') {
    const continueBox = !d.reviveUsed
      ? `<div class="continue-box">
          ${d.failureReason === '时间到啦'
            ? `<button type="button" class="continue-btn ${d.coins >= d.continueTimeCost ? '' : 'continue-btn-poor'}" data-action="buyContinue" data-type="time">
                <span class="continue-main">⏱ 花 ${d.continueTimeCost} 金币买加时卡（+25秒继续）</span>
                <span class="continue-sub">当前金币：💰 ${d.coins}</span>
              </button>`
            : `<button type="button" class="continue-btn ${d.coins >= d.continueReviveCost ? '' : 'continue-btn-poor'}" data-action="buyContinue" data-type="revive">
                <span class="continue-main">💖 花 ${d.continueReviveCost} 金币买复活卡（护盾复活继续）</span>
                <span class="continue-sub">当前金币：💰 ${d.coins}</span>
              </button>`}
        </div>`
      : '<span class="modal-copy">进度已保留，再来一局吧～</span>';

    bodyHtml = `
      <img class="hero-snake small-hero" src="assets/snake-${esc(d.activeSkin)}.png" alt="" />
      <span class="modal-title">差一点点！</span>
      <span class="record-label">第 ${d.level} 关 · ${esc(d.failureReason)}</span>
      <span class="result-score">${d.collected}<span class="score-unit"> / ${d.target}</span></span>
      ${d.levelCoins > 0 ? `<span class="modal-copy">本局拾取的 💰 ${d.levelCoins} 金币需通关才可带走</span>` : ''}
      ${continueBox}
      <button type="button" class="${!d.reviveUsed ? 'secondary' : 'primary'}" data-action="prepareRetry">重试第 ${d.level} 关</button>
      <div class="modal-links start-links">
        <button type="button" class="text-button" data-action="goHome">返回主页</button>
        <span class="link-dot">·</span>
        <button type="button" class="text-button" data-action="openLevels">选择关卡</button>
      </div>
    `;
  } else if (modal === 'cleared' || modal === 'completed') {
    bodyHtml = `
      ${d.settleAnimating ? '<button type="button" class="settle-skip" data-action="skipSettleAnimation">跳过 ⏭</button>' : ''}
      <div class="settle-burst">
        <div class="settle-sunburst ${d.settleTier === 3 ? 'sunburst-mega' : ''}"></div>
        <span class="settle-spark s-a">✦</span><span class="settle-spark s-b">★</span><span class="settle-spark s-c">✦</span>
        <img class="hero-snake small-hero settle-hero" src="assets/snake-${esc(d.activeSkin)}.png" alt="" />
      </div>
      <span class="modal-title settle-title">${modal === 'completed' ? '全部通关啦！' : `第 ${d.level} 关过关啦！`}</span>
      <div class="settle-stars">
        <span class="settle-star ${d.settleStars >= 1 ? 'star-lit' : ''}">★</span>
        <span class="settle-star star-mid ${d.settleStars >= 2 ? 'star-lit' : ''}">★</span>
        <span class="settle-star ${d.settleStars >= 3 ? 'star-lit' : ''}">★</span>
      </div>
      <div class="settle-panel" data-action="skipSettleAnimation">
        <div class="settle-convert-row">
          <div class="settle-chip ${d.settleRaining ? 'chip-draining' : ''}">
            <span class="settle-chip-label">剩余时间</span>
            <span class="settle-chip-val">⏱ ${d.settleTimeLeft}s</span>
          </div>
          <span class="settle-arrow ${d.settleRaining ? 'arrow-flow' : ''}">✨➜💰</span>
          <div class="settle-chip settle-chip-gold ${d.settleRaining ? 'chip-filling' : ''}">
            <span class="settle-chip-label">化成金币</span>
            <span class="settle-chip-val">+${d.settleTimeCoins}</span>
          </div>
        </div>
        <div class="settle-sub-row">
          <span>局内拾取 +${d.settlePickedCoins} 💰</span>
          ${d.settleMultiplier === 2 ? '<span class="settle-double-tag">双倍金币 ×2</span>' : ''}
        </div>
        <div class="settle-total-bar ${d.settleRaining ? 'total-bar-glow' : ''}">
          <span class="settle-total-label">本关共获</span>
          <span class="settle-total-val">+${d.settleTotalCoins} 💰</span>
          <span class="settle-wallet">总计 ${d.coins}</span>
        </div>
      </div>
      <span class="reward-message">${esc(d.rewardName ? d.rewardName : (d.stars === 3 ? '三星达成，本关奖励已领完' : '剩 50% / 25% 时间获三星 / 二星'))}</span>
      ${d.shopJustUnlocked ? '<button type="button" class="shop-unlock-banner" data-action="openShop">🎉 糖果小屋开张啦，去逛逛 ›</button>' : ''}
      ${modal === 'completed'
        ? '<span class="coming-soon">敬请期待</span><button type="button" class="primary" data-action="openLevels">回顾已通关关卡</button>'
        : `<button type="button" class="primary" data-action="nextLevel">挑战第 ${d.level + 1} 关</button>`}
      <div class="modal-links start-links">
        <button type="button" class="text-button" data-action="goHome">返回主页</button>
        <span class="link-dot">·</span>
        <button type="button" class="text-button" data-action="openGarden">🌿 蛇蛇花园</button>
        <span class="link-dot">·</span>
        <button type="button" class="text-button" data-action="prepareRetry">再玩本关</button>
      </div>
    `;
  } else if (modal === 'settings') {
    bodyHtml = `
      <span class="modal-title settings-title">游戏设置</span>
      <span class="setting-label">背景音乐</span>
      <div class="segments">
        <button type="button" class="segment ${d.settings.bgm ? 'selected' : ''}" data-action="changeSetting" data-key="bgm" data-value="on">开启</button>
        <button type="button" class="segment ${!d.settings.bgm ? 'selected' : ''}" data-action="changeSetting" data-key="bgm" data-value="off">关闭</button>
      </div>
      <span class="setting-label">游戏音效</span>
      <div class="segments">
        <button type="button" class="segment ${d.settings.sound ? 'selected' : ''}" data-action="changeSetting" data-key="sound" data-value="on">开启</button>
        <button type="button" class="segment ${!d.settings.sound ? 'selected' : ''}" data-action="changeSetting" data-key="sound" data-value="off">关闭</button>
      </div>
      <span class="setting-label">碰撞振动</span>
      <div class="segments">
        <button type="button" class="segment ${d.settings.vibration ? 'selected' : ''}" data-action="changeSetting" data-key="vibration" data-value="on">开启</button>
        <button type="button" class="segment ${!d.settings.vibration ? 'selected' : ''}" data-action="changeSetting" data-key="vibration" data-value="off">关闭</button>
      </div>
      <span class="modal-copy">进度保存在当前浏览器本地</span>
      <button type="button" class="clear-records" data-action="confirmClearRecords">清除游玩记录</button>
      <button type="button" class="primary settings-done" data-action="closeSettings">完成</button>
    `;
  } else if (modal === 'rules') {
    bodyHtml = `
      <span class="modal-title rules-title">玩法说明</span>
      <div class="rules-list">
        <div class="rule-row"><span class="rule-icon">👆</span><div class="rule-body"><span class="rule-heading">滑动或按键转向</span><span class="rule-desc">手机上下左右滑动，电脑可用方向键 / WASD 或鼠标拖动</span></div></div>
        <div class="rule-row"><span class="rule-icon">🍓</span><div class="rule-body"><span class="rule-heading">限时集齐目标食物</span><span class="rule-desc">倒计时结束前吃够目标就能过关，避开边界、路障和自己</span></div></div>
        <div class="rule-row"><span class="rule-icon">⭐</span><div class="rule-body"><span class="rule-heading">星级与道具</span><span class="rule-desc">开局选带的道具会投在蛇嘴边，吃掉生效、未吃自动返还</span></div></div>
      </div>
      <button type="button" class="primary rules-done" data-action="closeRules">我知道了</button>
      <button type="button" class="text-button" data-action="replayGuide">🎓 体验新手教学关</button>
    `;
  }

  return `
    <div class="overlay">
      ${rainHtml}
      <div class="modal-card ${modal === 'cleared' || modal === 'completed' ? 'settle-card' : ''}">
        <span class="card-tag">糖心蛇蛇</span>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderLevels(d) {
  if (d.modal !== 'levels') return '';
  const nodesHtml = d.levelChoices.map(item => `
    <div class="map-node ${item.locked ? 'map-node-locked' : 'map-node-cleared'} ${item.current ? 'map-node-current' : ''}" style="left:${item.x}%;top:${item.y}%">
      <span class="map-level-name ${item.x > 50 ? 'map-name-left' : 'map-name-right'}">${esc(item.name)}</span>
      ${item.current ? '<div class="map-halo"></div><img class="map-mascot" src="assets/map/mascot.png" alt="" /><span class="map-current-tag">当前</span>' : ''}
      ${!item.locked ? `<div class="map-gift ${item.stars === 3 ? 'map-gift-claimed' : ''}">${item.stars === 3 ? '✓' : '🎁'}</div>` : ''}
      <button type="button" class="map-node-button" data-action="inspectLevel" data-level="${item.number}" aria-label="第 ${item.number} 关">
        ${item.locked
          ? `<div class="map-lock-inner"><img src="assets/map/lock.png" alt="" /><span>${item.number}</span></div>`
          : `<span class="map-node-number">${item.number}</span>`}
      </button>
      <div class="map-node-stars">
        ${item.starIcons.map(s => `<img src="assets/map/star-${s.filled ? 'full' : 'empty'}.png" alt="" />`).join('')}
      </div>
    </div>
  `).join('');

  const detailHtml = d.mapDetail
    ? `<div class="map-detail-backdrop" data-action="closeMapDetail">
        <div class="map-detail-sheet" data-stop="true">
          <span class="map-sheet-ribbon">第 ${d.mapDetail.number} 关</span>
          <button type="button" class="map-sheet-close" data-action="closeMapDetail" aria-label="关闭关卡详情">×</button>
          <span class="map-sheet-name">${esc(d.mapDetail.name)}</span>
          <div class="map-sheet-stars">
            ${d.mapDetail.starIcons.map(s => `<img src="assets/map/star-${s.filled ? 'full' : 'empty'}.png" alt="" />`).join('')}
          </div>
          <div class="map-mission">
            <img src="assets/food-${esc(d.mapDetail.targetType)}.png" alt="" />
            <div>
              <span>收集 ${d.mapDetail.target} 个${esc(d.mapDetail.targetName)}</span>
              <span class="map-mission-note">限时 ${d.mapDetail.timeLimit} 秒 · 碰壁即失败</span>
            </div>
          </div>
          <span class="map-theme-hint">${esc(d.mapDetail.themeHint)}</span>
          <span class="map-spawn-hint">食物常出没在${esc(d.mapDetail.spawnLabel)}</span>
          <div class="map-rule-row"><span>三星：剩 ${d.mapDetail.threeStarTime} 秒以上</span><span>最佳：${d.mapDetail.stars} 星</span></div>
          <div class="map-reward">
            <img src="${esc(d.mapDetail.reward.icon)}" alt="" />
            <div>
              <span>首次三星 · ${esc(d.mapDetail.reward.name)}</span>
              <span class="map-reward-description">${esc(d.mapDetail.reward.description)}</span>
            </div>
            <span class="map-reward-status">${d.mapDetail.stars === 3 ? '已领' : '待领'}</span>
          </div>
          <button type="button" class="map-sheet-play" data-action="selectLevel" data-level="${d.mapDetail.number}">去挑战</button>
          <span class="map-sheet-note">下一步可选本关道具</span>
        </div>
      </div>`
    : '';

  return `
    <div class="adventure-map">
      <div id="map-viewport" class="map-viewport scroll-y">
        <div class="map-world ${d.mapTransition ? 'map-enter-' + d.mapTransition : ''}" style="height:${d.mapHeight}px">
          <img class="map-background fit-fill ${d.mapMirrored ? 'map-art-mirrored' : ''}" src="assets/map/landscape.png" alt="" />
          ${d.trailCount > 0 ? `<img class="map-background map-trail fit-fill ${d.mapMirrored ? 'map-art-mirrored' : ''}" src="assets/map/trail-${d.trailCount}.png" alt="" />` : ''}
          <span class="map-cloud-label">${d.levelPage === d.levelPageCount ? '更多冒险 · 敬请期待' : '云端相约 · 下一段冒险'}</span>
          <span class="map-start-sign">第 ${d.levelPage} 章 · 甜蜜冒险</span>
          ${nodesHtml}
        </div>
        <div class="map-scroll-spacer"></div>
      </div>
      <div class="map-top-hud">
        <div class="map-hud-row">
          <button type="button" class="map-round-button" data-action="closeLevels" aria-label="返回游戏">‹</button>
          <div class="map-title-pill"><span>糖心蛇蛇</span><span class="map-subtitle">甜蜜冒险地图</span></div>
          <div class="map-total-stars"><img src="assets/map/star-full.png" alt="" /><span>${d.totalStars}/${d.maxStars}</span></div>
          <button type="button" class="map-round-button map-sound" data-action="changeSetting" data-key="sound" data-value="${d.settings.sound ? 'off' : 'on'}" aria-label="音效开关">${d.settings.sound ? '♫' : '♪'}</button>
        </div>
        <div class="map-hint">第 ${d.levelPage} 章 · ${esc(d.chapterName)}</div>
      </div>
      ${d.mapTransition ? `<div class="map-chapter-arrival"><span>第 ${d.levelPage} 章</span><span class="map-arrival-name">${esc(d.chapterName)}</span><span>${d.chapterStart}—${d.chapterEnd} 关 · 向下滑动探索</span></div>` : ''}
      <button type="button" class="map-locate" style="bottom:${d.safeBottom + 117}px" data-action="locateLevel">🐾 回到当前关</button>
      <div class="map-bottom-dock" style="bottom:${d.safeBottom}px">
        <div class="map-chapter-nav">
          <button type="button" class="map-chapter-button ${d.levelPage === 1 ? 'map-nav-disabled' : ''}" data-action="changeLevelPage" data-delta="-1" ${d.levelPage === 1 ? 'disabled' : ''}>‹ 上一章</button>
          <span>第 ${d.levelPage} / ${d.levelPageCount} 章 · ${d.chapterStart}—${d.chapterEnd} 关</span>
          <button type="button" class="map-chapter-button ${d.levelPage === d.levelPageCount ? 'map-nav-disabled' : ''}" data-action="changeLevelPage" data-delta="1" ${d.levelPage === d.levelPageCount ? 'disabled' : ''}>下一章 ›</button>
        </div>
        <div class="map-dock-row">
          <div class="map-milestone">
            <div class="map-milestone-label"><span>本章集星</span><span>${d.chapterStars} / ${d.chapterMaxStars} ★</span></div>
            <div class="map-progress-track"><div class="map-progress-fill" style="width:${d.chapterProgress}%"></div></div>
          </div>
          <button type="button" class="map-quick-play" data-action="inspectLevel" data-level="${d.unlocked}">▶ 第 ${d.unlocked} 关</button>
        </div>
      </div>
      ${detailHtml}
    </div>
  `;
}

function renderHome(d) {
  if (d.modal !== 'home') return '';
  return `
    <div class="home-view" style="padding-bottom:${d.safeBottom + 8}px">
      <div class="home-sunbeam"></div>
      <div class="home-meadow"></div>
      <img class="clouds home-clouds fit-fill" src="assets/clouds.png" alt="" />
      <div class="bubble bubble-one"></div>
      <div class="bubble bubble-two"></div>
      <div class="home-topbar">
        <div class="home-stats">
          <a class="portal-back-link" href="../../">← 大厅</a>
          <div class="home-stat-pill"><img class="home-stat-icon" src="assets/map/star-full.png" alt="" /><span>${d.totalStars}/${d.maxStars}</span></div>
          <div class="home-stat-pill home-coin-pill" data-action="openShop"><span>💰 ${d.coins}</span></div>
        </div>
        <div class="home-top-actions">
          <button type="button" class="map-round-button home-round-btn" data-action="changeSetting" data-key="bgm" data-value="${d.settings.bgm ? 'off' : 'on'}" aria-label="背景音乐">${d.settings.bgm ? '♫' : '♪'}</button>
          <button type="button" class="map-round-button home-round-btn" data-action="openSettings" aria-label="游戏设置">⚙</button>
        </div>
      </div>
      <div class="home-hero">
        <img class="home-logo" src="assets/logo.png" alt="糖心蛇蛇" />
        <div class="home-mascot-stage">
          <div class="home-halo"></div>
          <img class="home-float hf-1" src="assets/food-strawberry.png" alt="" />
          <img class="home-float hf-2" src="assets/food-star.png" alt="" />
          <img class="home-float hf-3" src="assets/food-heart.png" alt="" />
          <img class="home-float hf-4" src="assets/food-candy.png" alt="" />
          <div class="home-pedestal"></div>
          <img class="home-mascot" src="assets/snake-${esc(d.activeSkin)}.png" alt="" />
        </div>
        <button type="button" class="home-role-chip" data-action="openGarden">
          <div class="role-dot" style="background:${esc(d.activeSnakeInfo.swatch)}"></div>
          <span>${esc(d.activeSnakeInfo.name)} · ${esc(d.activeSnakeInfo.skillName)}</span>
          <span class="home-role-arrow">›</span>
        </button>
      </div>
      <div class="home-dock">
        <button type="button" class="home-play-btn" data-action="enterGame">
          <span class="home-play-main">▶ 开始冒险</span>
          <span class="home-play-sub">第 ${d.level} 关 · ${esc(d.levelName)}</span>
        </button>
        <div class="home-trio">
          <button type="button" class="home-tile home-tile-garden" data-action="openGarden">
            <img class="home-tile-art" src="assets/food-strawberry.png" alt="" />
            <span class="home-tile-title">蛇蛇花园</span>
            <span class="home-tile-sub">${d.unlockedSnakes.length}/${d.snakeCards.length} 伙伴</span>
          </button>
          <button type="button" class="home-tile home-tile-shop ${d.shopUnlocked ? '' : 'home-tile-locked'}" data-action="openShop">
            <img class="home-tile-art" src="${d.shopUnlocked ? 'assets/item-double.png' : 'assets/map/lock.png'}" alt="" />
            <span class="home-tile-title">糖果小屋</span>
            <span class="home-tile-sub">${d.shopUnlocked ? '蛇蛇·道具' : '第5关解锁'}</span>
          </button>
          <button type="button" class="home-tile home-tile-map" data-action="openLevels">
            <img class="home-tile-art" src="assets/star.png" alt="" />
            <span class="home-tile-title">冒险地图</span>
            <span class="home-tile-sub">50 关旅程</span>
          </button>
        </div>
        <button type="button" class="home-rules-link" data-action="openRules">✨ 玩法说明 · 教学关 ›</button>
      </div>
    </div>
  `;
}

function renderShop(d) {
  if (d.modal !== 'shop') return '';
  const bodyHtml = d.shopTab === 'items'
    ? `<div class="shop-list">
        ${d.warehouseItems.map(item => `
          <div class="shop-row">
            <img class="shop-item-icon" src="${esc(item.icon)}" alt="" />
            <div class="shop-row-info">
              <div class="shop-row-head"><span class="shop-row-name">${esc(item.name)}</span><span class="shop-stock">${item.count}/99</span></div>
              <span class="shop-row-desc">${esc(item.description)}</span>
            </div>
            <button type="button" class="shop-buy-btn ${item.count >= 99 || d.coins < item.price ? 'shop-buy-disabled' : ''}" data-action="buyItem" data-item="${esc(item.id)}">${item.count >= 99 ? '已满' : '💰 ' + item.price}</button>
          </div>
        `).join('')}
      </div>`
    : `<div class="shop-snake-grid">
        ${d.snakeCards.map(s => `
          <div class="shop-snake-card ${s.owned ? 'shop-snake-owned' : ''}">
            <div class="shop-snake-stage" style="background:${esc(s.swatch)}">
              <img class="shop-snake-img" src="assets/snake-${esc(s.id)}.png" alt="" />
            </div>
            <span class="shop-snake-name">${esc(s.name)}</span>
            <span class="shop-skill-pill">${esc(s.skillName)}</span>
            <span class="shop-snake-desc">${esc(s.skillDesc)}</span>
            ${s.owned
              ? '<div class="shop-owned-pill">✓ 已解锁</div>'
              : `<button type="button" class="shop-unlock-btn ${s.canAfford ? '' : 'shop-buy-disabled'}" data-action="unlockSnakeOnly" data-id="${esc(s.id)}">💰 ${s.price} 解锁</button>`}
          </div>
        `).join('')}
      </div>`;

  const guideHtml = d.shopGuideStep > 0
    ? `<div class="guide-backdrop">
        <div class="guide-card shop-guide-card">
          <div class="guide-top">
            <span class="guide-badge">小屋指引 ${d.shopGuideStep} / 2</span>
            <button type="button" class="guide-skip" data-action="finishShopGuide">跳过</button>
          </div>
          ${d.shopGuideStep === 1
            ? '<span class="guide-title">🍬 欢迎来到糖果小屋！</span><span class="guide-copy">在「购买道具」可用金币补充实用道具，轻松挑战后面的关卡～</span>'
            : '<span class="guide-title">🐍 领养新蛇蛇伙伴</span><span class="guide-copy">在「解锁蛇蛇」可领养不同技能的小蛇，领养后会住进蛇蛇花园并可直接出战！</span>'}
          <button type="button" class="primary guide-next" data-action="nextShopGuide">${d.shopGuideStep === 2 ? '逛逛去！' : '下一步'}</button>
        </div>
      </div>`
    : '';

  return `
    <div class="shop-view" style="padding-bottom:${d.safeBottom}px">
      <div class="garden-header">
        <button type="button" class="map-round-button" data-action="closeShop" aria-label="返回">‹</button>
        <div class="map-title-pill"><span>糖果小屋</span><span class="map-subtitle">蜜糖补给站</span></div>
        <div class="garden-coin-pill"><span>💰 ${d.coins}</span></div>
      </div>
      <div class="shop-tabs">
        <button type="button" class="shop-tab ${d.shopTab === 'snakes' ? 'shop-tab-active' : ''}" data-action="switchShopTab" data-tab="snakes">🐍 解锁蛇蛇</button>
        <button type="button" class="shop-tab ${d.shopTab === 'items' ? 'shop-tab-active' : ''}" data-action="switchShopTab" data-tab="items">🎁 购买道具</button>
      </div>
      <div class="shop-scroll scroll-y">${bodyHtml}</div>
      ${guideHtml}
    </div>
  `;
}

export function createSweetSnakeView() {
  const els = {
    screen: document.getElementById('screen'),
    header: document.getElementById('hud-header'),
    levelStrip: document.getElementById('level-strip'),
    boardFrame: document.getElementById('board-frame'),
    gameCanvas: document.getElementById('gameCanvas'),
    tutorial: document.getElementById('tutorial-layer'),
    overlay: document.getElementById('overlay-layer'),
    levels: document.getElementById('levels-layer'),
    home: document.getElementById('home-layer'),
    shop: document.getElementById('shop-layer'),
    garden: document.getElementById('garden-layer'),
    gardenHeader: document.getElementById('garden-header'),
    gardenCanvas: document.getElementById('gardenCanvas')
  };

  const cache = {};
  let lastMapScrollTop = -1;

  function patchHtml(key, el, html) {
    if (cache[key] === html) return false;
    cache[key] = html;
    el.innerHTML = html;
    return true;
  }

  function render(d) {
    els.screen.classList.toggle('compact', !!d.compact);
    els.screen.style.paddingBottom = `${d.safeBottom}px`;

    els.levelStrip.classList.toggle('level-strip-dense', (d.missions || []).length >= 3);

    els.boardFrame.style.width = `${d.boardWidth}px`;
    els.boardFrame.style.height = `${d.boardHeight}px`;
    els.gameCanvas.style.width = `${d.boardWidth}px`;
    els.gameCanvas.style.height = `${d.boardHeight}px`;

    patchHtml('header', els.header, renderHeader(d));
    patchHtml('levelStrip', els.levelStrip, renderLevelStrip(d));
    patchHtml('tutorial', els.tutorial, renderTutorialOverlay(d));
    patchHtml('overlay', els.overlay, renderOverlay(d));

    const prevMapScroll = document.getElementById('map-viewport')?.scrollTop || 0;
    const levelsUpdated = patchHtml('levels', els.levels, renderLevels(d));
    if (d.modal === 'levels') {
      const vp = document.getElementById('map-viewport');
      if (vp) {
        if (d.mapScrollTop !== lastMapScrollTop) {
          vp.scrollTop = d.mapScrollTop;
          lastMapScrollTop = d.mapScrollTop;
        } else if (levelsUpdated) {
          vp.scrollTop = prevMapScroll;
        }
      }
    } else {
      lastMapScrollTop = -1;
    }

    patchHtml('home', els.home, renderHome(d));
    patchHtml('shop', els.shop, renderShop(d));

    const showGarden = d.modal === 'garden';
    els.garden.classList.toggle('is-hidden', !showGarden);
    if (showGarden) {
      els.garden.style.paddingBottom = `${d.safeBottom}px`;
      els.gardenCanvas.style.width = `${d.gardenWidth}px`;
      els.gardenCanvas.style.height = `${d.gardenHeight}px`;
      patchHtml('gardenHeader', els.gardenHeader, `
        <button type="button" class="map-round-button" data-action="closeGarden" aria-label="返回">‹</button>
        <div class="map-title-pill"><span>蛇蛇花园</span><span class="map-subtitle">已收集 ${d.unlockedSnakes.length} / ${d.snakeCards.length} 条蛇蛇</span></div>
        <div class="garden-coin-pill" data-action="openShop" data-tab="snakes"><span>💰 ${d.coins} ›</span></div>
      `);
    }
  }

  return { els, render };
}
