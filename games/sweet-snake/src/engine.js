// Adapted from sweet_snake.html: original Canvas art, animation, scoring and effects.
const GRID_COLS = 12;
const GRID_ROWS = 18;
const ACTIVE_FOOD_COUNT = 3;
const OUTLINE_COLOR = '#6b2d47';

import { LEVELS, getLevel } from './levels.js';
import { getItem } from './items.js';
import { getSnake } from './snakes.js';

const FOOD_TYPES = [
  { type: 'strawberry', points: 10, energy: 14, weight: 36, bonus: false, glow: 'rgba(255, 95, 138, 0.45)' },
  { type: 'cherries',   points: 15, energy: 16, weight: 28, bonus: false, glow: 'rgba(255, 72, 118, 0.45)' },
  { type: 'heart',      points: 20, energy: 40, weight: 16, bonus: true,  glow: 'rgba(255, 105, 180, 0.55)' },
  { type: 'candy',      points: 25, energy: 22, weight: 12, bonus: true,  glow: 'rgba(196, 130, 255, 0.52)' },
  { type: 'star',       points: 30, energy: 28, weight: 8,  bonus: true,  glow: 'rgba(255, 212, 70, 0.62)' }
];
function createGame(ctx, hooks = {}) {
  let bestScore = Number(hooks.best) || 0;
  const silent = () => {};
  const audio = hooks.audio || { playEat:silent, playBonus:silent, playBoostWhoosh:silent, playGameOver:silent, playNewRecord:silent };
const state = {
  mode: 'start', // start | playing | paused | gameover | clear_pause | celebrating | reward | cleared | completed
  equippedItem: '',
  itemPickup: null,
  pickupDelay: 5,
  itemReady: true,
  collected:0, remaining:0, stars:0, targetType:'', targetName:'', targetIcon:'', missions:[],
  itemTimer: 0,
  activeItem: '',
  skinId: hooks.skinId || 'strawberry',
  coin: null,
  coinSpawnTimer: 3.0,
  levelCoins: 0,
  doubleCoinActive: false,
  reviveArmed: false,
  reviveUsed: false,
  shieldTimer: 0,
  obstacleShields: 0,
  clearSummary: null,
  isTutorial: false,
  tutorialStep: 0,
  tutorialSwiped: false,
  growthPending: 0,
  clearTimer: 0,
  level: getLevel(hooks.level).number,
  target: 60,
  levelName: '',
  obstacles: [],
  failureReason: '',
  score: 0,
  snake: [],         // Current grid positions [{x, y}]
  prevSnake: [],     // Previous grid positions for smooth interpolation
  dir: { x: -1, y: 0 },
  inputQueue: [],
  foods: [],
  // Target items are queued so the full mission quota appears progressively during play.
  missionQueue: [],
  missionElapsed: 0,
  particles: [],
  rings: [],
  popups: [],
  boostHeld: false,
  boostActive: false,
  energy: 100,       // 0 - 100
  stepAccumulator: 0,
  lastFrameTime: 0,
  elapsedTime: 0,
  happyTimer: 0,     // > 0 shows cute winking face right after eating
  blinkTimer: 2.5,   // Periodic idle blink timer
  blinkDuration: 0,
  trailTimer: 0,
  tileSize: 44,
  dpr: 1
};
function publish() {
  if (hooks.onChange) hooks.onChange({score:state.score, best:bestScore, energy:Math.round(state.energy), boosting:state.boostActive, mode:state.mode, newRecord:!!state.newRecord, level:state.level, target:state.target, levelName:state.levelName, themeHint:state.isTutorial?'全屏上下左右划动即可转向':getLevel(state.level).themeHint, progress:Math.min(100,Math.floor(state.collected/state.target*100)), collected:state.collected, remaining:Math.ceil(state.remaining), stars:state.stars, targetType:state.targetType, targetName:state.targetName, targetIcon:state.targetIcon, missions:state.missions.map(m=>({...m,done:m.collected>=m.target})), failureReason:state.failureReason, equippedItem:state.equippedItem,activeItem:state.activeItem,itemReady:state.itemReady,itemOnBoard:!!state.itemPickup,itemSeconds:Math.ceil(state.itemTimer),levelCoins:state.levelCoins,doubleCoinActive:state.doubleCoinActive,reviveArmed:state.reviveArmed,reviveUsed:state.reviveUsed,shieldSeconds:Math.ceil(state.shieldTimer),isTutorial:!!state.isTutorial,tutorialStep:state.tutorialStep||0,tutorialSwiped:!!state.tutorialSwiped});
}
function updateScoreUI() { publish(); }
function updateEnergyUI() { publish(); }
function getPerk() { return (getSnake(state.skinId).perk) || {}; }
function resetGame(number = state.level) {
  const level = getLevel(number);
  const perk = getPerk();
  state.isTutorial = false;
  state.tutorialStep = 0;
  state.tutorialSwiped = false;
  state.level=level.number; state.target=level.target; state.levelName=level.name;
  state.targetType=level.targetType;state.targetName=level.targetName;state.targetIcon=level.targetIcon;state.collected=0;state.remaining=level.timeLimit+(perk.extraTime||0);state.stars=0;
  state.missions=(level.missions||[{type:level.targetType,name:level.targetName,icon:level.targetIcon,target:level.target}]).map(m=>({...m,collected:0}));
  state.obstacles=level.obstacles.map(p=>({...p}));
  state.failureReason='';
  state.equippedItem='';state.itemPickup=null;state.pickupDelay=5;
  state.itemReady=true; state.itemTimer=0; state.activeItem=''; state.growthPending=0; state.clearTimer=0;
  state.coin=null; state.coinSpawnTimer=3.0; state.levelCoins=0;
  state.doubleCoinActive=false; state.reviveArmed=false; state.reviveUsed=false; state.shieldTimer=0; state.obstacleShields=perk.obstacleShield||0; state.clearSummary=null;
  state.score = 0;
  state.bestAtStart = bestScore;
  state.newRecord = false;
  state.boostHeld = false;
  state.boostLocked = false;
  // Start centered with a beginner-friendly 3-segment body, facing left.
  const startX = Math.floor(GRID_COLS / 2) - 1;
  const startY = Math.floor(GRID_ROWS / 2);
  state.snake = [
    { x: startX,     y: startY },
    { x: startX + 1, y: startY },
    { x: startX + 2, y: startY }
  ];
  state.prevSnake = state.snake.map(s => ({ ...s }));
  state.dir = { x: -1, y: 0 };
  state.inputQueue = [];
  state.foods = [];
  state.missionElapsed = 0;
  // Interleave all mission food types across the supply window so multi-type
  // levels feel varied and never starve a needed food type.
  const supplyWindow = level.timeLimit * .5;
  const missionTypes = [];
  const counts = state.missions.map(m => m.target);
  let left = counts.reduce((a, b) => a + b, 0);
  while (left > 0) {
    for (let k = 0; k < state.missions.length; k++) {
      if (counts[k] > 0) { missionTypes.push(state.missions[k].type); counts[k]--; left--; }
    }
  }
  state.missionQueue = missionTypes.map((type, i) => ({
    type,
    at: i === 0 ? 0 : (i - .5 + Math.random() * .5) * supplyWindow / Math.max(1, missionTypes.length - 1)
  }));
  state.particles = [];
  state.rings = [];
  state.popups = [];
  state.energy = 100;
  state.boostActive = false;
  state.stepAccumulator = 0;
  state.happyTimer = 0;

  // Keep the opening board readable: one target item is visible, while the
  // remaining target quota is released over time or earlier when collected.
  spawnFood('target');
  for (let i = 1; i < ACTIVE_FOOD_COUNT; i++) spawnFood('random');
  spawnCoin();


  updateScoreUI(false);
  updateEnergyUI();
}

function findTutorialCell(preferredList) {
  const occupied = new Set();
  state.snake.forEach(s => occupied.add(`${s.x},${s.y}`));
  state.foods.forEach(f => occupied.add(`${f.x},${f.y}`));
  if (state.coin) occupied.add(`${state.coin.x},${state.coin.y}`);
  for (const p of preferredList) {
    if (p.x >= 1 && p.x < GRID_COLS - 1 && p.y >= 1 && p.y < GRID_ROWS - 1 && !occupied.has(`${p.x},${p.y}`)) {
      return p;
    }
  }
  for (let y = 2; y < GRID_ROWS - 2; y++) {
    for (let x = 2; x < GRID_COLS - 2; x++) {
      if (!occupied.has(`${x},${y}`)) return { x, y };
    }
  }
  return { x: 5, y: 5 };
}

function placeTutorialTarget(step) {
  const spec = FOOD_TYPES[0]; // strawberry
  const head = state.snake[0] || { x: 6, y: 9 };
  if (step === 1) {
    const cell = findTutorialCell([{ x: 4, y: 6 }, { x: 5, y: 5 }, { x: 6, y: 6 }]);
    state.foods = [{ x: cell.x, y: cell.y, ...spec, phase: 0, spawnScale: 0.1 }];
    state.coin = null;
  } else if (step === 2) {
    const fCell = findTutorialCell([
      { x: Math.min(GRID_COLS - 2, Math.max(8, head.x + 4)), y: Math.max(3, Math.min(GRID_ROWS - 4, head.y)) },
      { x: 9, y: 6 }, { x: 9, y: 9 }, { x: 8, y: 5 }
    ]);
    state.foods = [{ x: fCell.x, y: fCell.y, ...spec, phase: 0.6, spawnScale: 0.1 }];
    const cCell = findTutorialCell([
      { x: Math.max(2, fCell.x - 2), y: fCell.y },
      { x: Math.max(2, fCell.x - 1), y: Math.min(GRID_ROWS - 2, fCell.y + 1) },
      { x: 7, y: 6 }
    ]);
    state.coin = { x: cCell.x, y: cCell.y, big: true, value: 20, spawnScale: 0.1, phase: 0 };
  } else {
    const fCell = findTutorialCell([
      { x: 5, y: 13 }, { x: 4, y: 13 }, { x: 7, y: 13 }, { x: 6, y: 4 }
    ]);
    state.foods = [{ x: fCell.x, y: fCell.y, ...spec, phase: 1.2, spawnScale: 0.1 }];
  }
}

function resetTutorialStage() {
  state.isTutorial = true;
  state.tutorialStep = 1;
  state.tutorialSwiped = false;
  state.level = 1;
  state.target = 3;
  state.levelName = '新手教学关';
  state.targetType = 'strawberry';
  state.targetName = '草莓';
  state.targetIcon = '🍓';
  state.collected = 0;
  state.remaining = 99;
  state.stars = 0;
  state.missions = [{ type: 'strawberry', name: '草莓', icon: '🍓', target: 3, collected: 0 }];
  state.obstacles = [];
  state.failureReason = '';
  state.equippedItem = '';
  state.itemPickup = null;
  state.pickupDelay = 99;
  state.itemReady = true;
  state.itemTimer = 0;
  state.activeItem = '';
  state.growthPending = 0;
  state.clearTimer = 0;
  state.coin = null;
  state.coinSpawnTimer = 99;
  state.levelCoins = 0;
  state.doubleCoinActive = false;
  state.reviveArmed = false;
  state.reviveUsed = false;
  state.shieldTimer = 0;
  state.obstacleShields = 0;
  state.clearSummary = null;
  state.score = 0;
  state.bestAtStart = bestScore;
  state.newRecord = false;
  state.boostHeld = false;
  state.boostActive = false;
  state.energy = 100;
  state.stepAccumulator = 0;
  state.happyTimer = 0;
  state.particles = [];
  state.rings = [];
  state.popups = [];
  state.missionQueue = [];
  state.missionElapsed = 0;
  state.snake = [
    { x: 6, y: 11 },
    { x: 7, y: 11 },
    { x: 8, y: 11 }
  ];
  state.prevSnake = state.snake.map(s => ({ ...s }));
  state.dir = { x: -1, y: 0 };
  state.inputQueue = [];
  placeTutorialTarget(1);
  state.mode = 'playing';
  publish();
}

function tutorialSafeRespawn(msg) {
  const keepLen = Math.min(state.snake.length, 4);
  const startX = 6, startY = 11;
  state.snake = Array.from({ length: keepLen }, (_, i) => ({ x: startX + i, y: startY }));
  state.prevSnake = state.snake.map(s => ({ ...s }));
  state.dir = { x: -1, y: 0 };
  state.inputQueue = [];
  state.shieldTimer = 1.6;
  const head = state.snake[0];
  state.popups.push({
    x: (head.x + 0.5) * state.tileSize,
    y: (head.y + 0.2) * state.tileSize,
    vy: -state.tileSize * 0.9,
    text: msg || '小心边界哦～',
    life: 0,
    maxLife: 1.1,
    isBonus: true
  });
  audio.playEat();
  publish();
}

function pickWeightedFoodType(includeTarget = true) {
  const weights=getLevel(state.level).foodWeights;
  const palette=FOOD_TYPES.filter(f=>weights[f.type]>0 && (includeTarget || f.type!==state.targetType));
  const total = palette.reduce((sum, f) => sum + weights[f.type], 0);
  let r = Math.random() * total;
  for (const f of palette) {
    r -= weights[f.type];
    if (r <= 0) return f;
  }
  return palette[0];
}

function isNeededMissionType(type) {
  return state.missions.some(m => m.type === type && m.collected < m.target);
}
function nextNeededMissionType() {
  const pending = state.missions.filter(m => m.collected < m.target);
  if (!pending.length) return state.targetType;
  const missingOnBoard = pending.find(m => !state.foods.some(f => f.type === m.type));
  return (missingOnBoard || pending[0]).type;
}
function spawnFood(mode = 'queue', forcedType = '') {
  const occupied = new Set();
  state.snake.forEach(s => occupied.add(`${s.x},${s.y}`));
  state.foods.forEach(f => occupied.add(`${f.x},${f.y}`));
  if(state.coin) occupied.add(`${state.coin.x},${state.coin.y}`);
  if(state.itemPickup) occupied.add(`${state.itemPickup.x},${state.itemPickup.y}`);
  state.obstacles.forEach(p => occupied.add(`${p.x},${p.y}`));

  const freeCells = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (!occupied.has(`${x},${y}`)) {
        freeCells.push({ x, y });
      }
    }
  }
  if (freeCells.length === 0) return false;

  const hasNeededOnBoard = state.foods.some(f => isNeededMissionType(f.type));
  let spec;
  if (forcedType) {
    spec = FOOD_TYPES.find(f => f.type === forcedType) || FOOD_TYPES[0];
  } else if (mode === 'target' || (mode === 'queue' && !hasNeededOnBoard)) {
    const needType = nextNeededMissionType();
    spec = FOOD_TYPES.find(f => f.type === needType) || FOOD_TYPES[0];
  } else {
    spec = pickWeightedFoodType(mode !== 'random');
  }
  // Advance matching queued entry once a free cell has been found.
  const qIdx = state.missionQueue.findIndex(q => q.type === spec.type);
  if (qIdx !== -1) state.missionQueue.splice(qIdx, 1);
  // Mission food favours its themed region; a full region falls back to any free cell.
  const preferred=isNeededMissionType(spec.type) ? getLevel(state.level).spawnCells.filter(p=>!occupied.has(`${p.x},${p.y}`)) : [];
  const pool=preferred.length && Math.random()<.8 ? preferred : freeCells;
  const cell=pool[Math.floor(Math.random()*pool.length)];
  state.foods.push({
    x: cell.x,
    y: cell.y,
    ...spec,
    phase: Math.random() * Math.PI * 2,
    spawnScale: 0.1
  });
  return true;
}

function releaseMissionFood() {
  while (state.missionQueue.length && state.missionQueue[0].at <= state.missionElapsed) {
    if (!spawnFood('target', state.missionQueue[0].type)) break;
  }
}

function queueDirection(dx, dy) {
  if (state.mode !== 'playing') return;
  // If a single buffered turn hasn't executed yet and the player immediately
  // corrects to its opposite (which is perpendicular to current dir), replace it.
  if (state.inputQueue.length === 1) {
    const queued = state.inputQueue[0];
    if (dx === -queued.x && dy === -queued.y &&
        !(dx === state.dir.x && dy === state.dir.y) &&
        !(dx === -state.dir.x && dy === -state.dir.y)) {
      state.inputQueue[0] = { x: dx, y: dy };
      return;
    }
  }
  const lastPlanned = state.inputQueue.length > 0
    ? state.inputQueue[state.inputQueue.length - 1]
    : state.dir;

  // Ignore same direction or direct 180-degree reversal
  if ((dx === lastPlanned.x && dy === lastPlanned.y) ||
      (dx === -lastPlanned.x && dy === -lastPlanned.y)) {
    return;
  }
  if (state.inputQueue.length < 2) {
    state.inputQueue.push({ x: dx, y: dy });
    if (state.isTutorial && !state.tutorialSwiped) {
      state.tutorialSwiped = true;
      publish();
    }
  }
}

function getCurrentStepMs() {
  if (state.isTutorial) return 380;
  // Speed is set by the level, gently modulated by character perk & slow item.
  const perk = getPerk();
  const base = getLevel(state.level).stepMs / (perk.slowFactor || 1);
  return state.activeItem==='slow' ? base / .7 : base;
}

function spawnEatEffects(gridX, gridY, food) {
  const ts = state.tileSize;
  const cx = (gridX + 0.5) * ts;
  const cy = (gridY + 0.5) * ts;

  // Expanding glowing ring
  state.rings.push({
    x: cx,
    y: cy,
    radius: ts * 0.25,
    maxRadius: ts * 1.45,
    alpha: 0.9,
    color: food.type === 'star' ? '#ffd95c' : '#ff85ba'
  });

  // Floating golden glossy "+10" popup text
  state.popups.push({
    x: cx,
    y: cy - ts * 0.2,
    vy: -ts * 1.15,
    text: `+${food.points}`,
    life: 0,
    maxLife: 0.95,
    isBonus: food.bonus
  });

  // Bursting hearts, stars, and candy sparkles
  const count = food.bonus ? 16 : 11;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
    const speed = ts * (1.2 + Math.random() * 2.1);
    const shapes = ['heart', 'star', 'dot'];
    const shape = shapes[i % shapes.length];
    const colors = ['#ff6ba8', '#ff9ec8', '#ffd95c', '#ffffff', '#ff528c'];
    state.particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - ts * 0.35,
      size: ts * (0.14 + Math.random() * 0.14),
      shape,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 6,
      life: 0,
      maxLife: 0.55 + Math.random() * 0.35
    });
  }
}

function spawnBoostTrail() {
  if (state.snake.length < 2) return;
  const ts = state.tileSize;
  const tail = state.snake[state.snake.length - 1];
  const cx = (tail.x + 0.5 + (Math.random() - 0.5) * 0.4) * ts;
  const cy = (tail.y + 0.5 + (Math.random() - 0.5) * 0.4) * ts;
  state.particles.push({
    x: cx,
    y: cy,
    vx: (Math.random() - 0.5) * ts * 0.5,
    vy: (Math.random() - 0.5) * ts * 0.5,
    size: ts * (0.14 + Math.random() * 0.1),
    shape: Math.random() < 0.55 ? 'heart' : 'star',
    color: Math.random() < 0.5 ? '#ff85ba' : '#ffe680',
    rot: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 4,
    life: 0,
    maxLife: 0.42
  });
}

function tryRevive(reason) {
  if (!state.reviveArmed || state.reviveUsed) return false;
  if (!hooks.consumeItem || !hooks.consumeItem('revive')) return false;
  state.reviveArmed = false;
  state.reviveUsed = true;
  state.boostActive = false;
  state.boostHeld = false;
  state.inputQueue = [];
  if (reason === 'timeout') {
    state.remaining += 20;
  } else {
    // Reposition safely along open row 7 with 3s invincible shield
    const startX = Math.floor(GRID_COLS / 2) - 1;
    const startY = Math.floor(GRID_ROWS / 2);
    const keepLen = Math.min(state.snake.length, 4);
    state.snake = Array.from({ length: keepLen }, (_, i) => ({ x: startX + i, y: startY }));
    state.prevSnake = state.snake.map(s => ({ ...s }));
    state.dir = { x: -1, y: 0 };
    state.shieldTimer = 3.0;
  }
  const head = state.snake[0];
  spawnEatEffects(head.x, head.y, { type: 'star', points: 0, bonus: true });
  state.popups.pop();
  state.popups.push({
    x: (head.x + 0.5) * state.tileSize,
    y: (head.y + 0.3) * state.tileSize,
    vy: -state.tileSize * 1.1,
    text: reason === 'timeout' ? '💖 续命 +20s!' : '💖 复活护盾!',
    life: 0,
    maxLife: 1.2,
    isBonus: true
  });
  audio.playNewRecord();
  if (hooks.onRevive) hooks.onRevive(reason);
  publish();
  return true;
}

function triggerGameOver(reason = '碰到自己啦') {
  state.mode = 'gameover';
  state.failureReason = reason;
  state.boostActive = false;
  state.boostHeld = false;
  state.newRecord = state.score > state.bestAtStart;
  audio.playGameOver();
  if (state.newRecord) audio.playNewRecord();
  publish();
}

function clearLevel() {
  state.mode = 'clear_pause'; state.clearTimer=0;
  const ratio=state.remaining/getLevel(state.level).timeLimit;
  state.stars=ratio>=.5?3:ratio>=.25?2:1;
  const timeSec=Math.max(0,Math.ceil(state.remaining));
  const coinMultiplier=state.doubleCoinActive?2:1;
  const timeBonusCoins=Math.round(timeSec*(getPerk().timeCoinMult||1))*coinMultiplier;
  state.clearSummary={
    pickedCoins:state.levelCoins,
    timeSec,
    timeBonusCoins,
    coinMultiplier,
    totalEarnedCoins:state.levelCoins+timeBonusCoins
  };
  state.prevSnake=state.snake.map(p=>({...p}));
  state.boostHeld = false; state.boostActive = false; state.inputQueue = [];
  state.newRecord = state.score > state.bestAtStart;
  try { if (hooks.onLevelClear) hooks.onLevelClear(state.level,state.stars,state.clearSummary); } catch (_) {}
  publish();
}

function celebrate() {
  state.mode='celebrating'; state.clearTimer=0;
  audio.playNewRecord();
  const ts=state.tileSize;
  for(let i=0;i<5;i++) spawnEatEffects(1+i*2,4+(i%2)*3,{type:'star',points:0,bonus:true});
  state.popups=[];
  state.rings.push({x:GRID_COLS*ts/2,y:GRID_ROWS*ts/2,radius:ts,maxRadius:ts*8,alpha:1,color:'#ffd95c'});
}

function useItem(id) {
  if(state.mode!=='playing'||!getItem(id)) return false;
  // Avoid consuming another timed effect while one is already active.
  if((id==='slow'||id==='magnet') && state.itemTimer>0) return false;
  if(hooks.consumeItem && !hooks.consumeItem(id)) return false;
  if(!hooks.consumeItem) return false;
  const bonusSec = getPerk().itemBonusSec || 0;
  if(id==='time') state.remaining+=25;
  else {state.activeItem=id;state.itemTimer=10+bonusSec;}
  const head=state.snake[0];
  spawnEatEffects(head.x,head.y,{type:'star',points:0,bonus:true});
  state.popups.pop();
  audio.playBonus();publish();return true;
}

function spawnItemNearMouth(id) {
  if (!id || !getItem(id)) return false;
  const head = state.snake[0];
  const dx = state.dir.x, dy = state.dir.y;
  const blocked = new Set([...state.snake, ...state.obstacles].map(p => `${p.x},${p.y}`));
  const candidates = [
    { x: head.x + dx * 2, y: head.y + dy * 2 },
    { x: head.x + dx, y: head.y + dy },
    { x: head.x + dx * 3, y: head.y + dy * 3 },
    { x: head.x + dx * 2, y: head.y - 1 },
    { x: head.x + dx * 2, y: head.y + 1 },
    { x: head.x + dx, y: head.y - 1 },
    { x: head.x + dx, y: head.y + 1 },
    { x: head.x, y: head.y - 2 },
    { x: head.x, y: head.y + 2 }
  ];
  let chosen = null;
  for (const p of candidates) {
    if (p.x >= 0 && p.x < GRID_COLS && p.y >= 0 && p.y < GRID_ROWS && !blocked.has(`${p.x},${p.y}`)) {
      chosen = p;
      break;
    }
  }
  if (!chosen) {
    for (let y = 0; y < GRID_ROWS && !chosen; y++) {
      for (let x = 0; x < GRID_COLS && !chosen; x++) {
        if (!blocked.has(`${x},${y}`)) chosen = { x, y };
      }
    }
  }
  if (!chosen) return false;
  // Clear any overlapping food or coin so the item sits cleanly in front of the mouth.
  const overlapFoodIdx = state.foods.findIndex(f => f.x === chosen.x && f.y === chosen.y);
  state.itemPickup = { x: chosen.x, y: chosen.y, id };
  if (overlapFoodIdx !== -1) {
    const removed = state.foods.splice(overlapFoodIdx, 1)[0];
    spawnFood('target', removed.type);
  }
  if (state.coin && state.coin.x === chosen.x && state.coin.y === chosen.y) {
    state.coin = null;
    spawnCoin();
  }
  return true;
}

function collectItemPickup() {
  const pickup=state.itemPickup, head=state.snake[0];
  if (!pickup || pickup.x!==head.x || pickup.y!==head.y) return;
  const item = getItem(pickup.id);
  if (useItem(pickup.id)) {
    state.itemPickup=null;
    if (item) {
      state.popups.push({
        x: (head.x + 0.5) * state.tileSize,
        y: (head.y + 0.25) * state.tileSize,
        vy: -state.tileSize * 1.1,
        text: `✨ ${item.name}!`,
        life: 0,
        maxLife: 1.1,
        isBonus: true
      });
    }
  }
}

function spawnCoin() {
  const occupied = new Set([...state.snake, ...state.obstacles, ...state.foods].map(p => `${p.x},${p.y}`));
  if (state.itemPickup) occupied.add(`${state.itemPickup.x},${state.itemPickup.y}`);
  const free = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (!free.length) { state.coinSpawnTimer = 1.5; return false; }
  const cell = free[Math.floor(Math.random() * free.length)];
  const big = Math.random() < (getPerk().bigCoinChance || 0.22);
  state.coin = { x: cell.x, y: cell.y, big, value: big ? 20 : 5, spawnScale: 0.1, phase: Math.random() * Math.PI * 2 };
  return true;
}

function updateCoin(dt) {
  if (state.coin) {
    state.coin.spawnScale = Math.min(1, state.coin.spawnScale + dt * 6);
    return;
  }
  state.coinSpawnTimer -= dt;
  if (state.coinSpawnTimer > 0) return;
  spawnCoin();
}

function collectCoin() {
  const c = state.coin;
  if (!c) return;
  const baseVal = c.value || (c.big ? 20 : 5);
  const gained = Math.round(baseVal * (getPerk().coinPickupMult || 1)) * (state.doubleCoinActive ? 2 : 1);
  state.levelCoins += gained;
  state.happyTimer = c.big ? 0.8 : 0.45;
  spawnEatEffects(c.x, c.y, { type: 'star', points: 0, bonus: true });
  state.popups.pop();
  if (c.big) {
    // Extra dazzling golden shockwave & sparkle burst for Big Gold Coin!
    const ts = state.tileSize, cx = (c.x + 0.5) * ts, cy = (c.y + 0.5) * ts;
    state.rings.push({ x: cx, y: cy, radius: ts * 0.3, maxRadius: ts * 2.4, alpha: 1, color: '#ffd447' });
    state.rings.push({ x: cx, y: cy, radius: ts * 0.15, maxRadius: ts * 1.8, alpha: 0.9, color: '#ff85ba' });
    for (let i = 0; i < 12; i++) {
      const ang = (Math.PI * 2 * i) / 12;
      const spd = ts * (2.0 + Math.random() * 1.6);
      state.particles.push({
        x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - ts * 0.4,
        size: ts * 0.22, shape: 'star', color: i % 2 === 0 ? '#ffe066' : '#fff8c2',
        rot: Math.random() * Math.PI * 2, vRot: (Math.random() - 0.5) * 8, life: 0, maxLife: 0.85
      });
    }
    audio.playNewRecord();
  } else {
    audio.playBonus();
  }
  state.popups.push({
    x: (c.x + 0.5) * state.tileSize,
    y: (c.y + 0.3) * state.tileSize,
    vy: -state.tileSize * (c.big ? 1.35 : 1.15),
    text: c.big ? `+${gained}💰✨` : `+${gained}💰`,
    life: 0,
    maxLife: c.big ? 1.3 : 1.05,
    isBonus: true
  });
  state.coin = null;
  state.coinSpawnTimer = 1.5;
  publish();
}

function drawCoin() {
  const c = state.coin;
  if (!c) return;
  const ts = state.tileSize;
  const t = state.elapsedTime;
  const bob = Math.sin(t * (c.big ? 5.2 : 4.2) + c.phase) * (ts * (c.big ? 0.08 : 0.06));
  const scale = c.spawnScale * (1 + Math.sin(t * (c.big ? 6.5 : 5) + c.phase) * (c.big ? 0.07 : 0.04));
  const cx = (c.x + 0.5) * ts;
  const cy = (c.y + 0.5) * ts + bob;
  const r = ts * (c.big ? 0.44 : 0.34);

  ctx.save();
  ctx.translate(cx, cy);

  if (c.big) {
    // Rotating golden halo rays & pulsing sparkle ring for Big Gold Coin!
    const pulseR = ts * (0.64 + Math.sin(t * 7) * 0.08);
    ctx.strokeStyle = 'rgba(255, 206, 58, 0.72)';
    ctx.lineWidth = Math.max(1.8, ts * 0.06);
    ctx.beginPath(); ctx.arc(0, 0, pulseR, 0, Math.PI * 2); ctx.stroke();

    // 4 orbiting tiny golden sparkles
    for (let i = 0; i < 4; i++) {
      const a = t * 2.8 + (i * Math.PI) / 2;
      const sx = Math.cos(a) * (r + ts * 0.16), sy = Math.sin(a) * (r + ts * 0.16);
      ctx.fillStyle = i % 2 === 0 ? '#fff9c4' : '#ff9ec8';
      drawStarPath(ctx, sx, sy, ts * 0.11, ts * 0.05, 4);
      ctx.fill();
    }
  }

  // Soft golden glow
  const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, ts * (c.big ? 0.78 : 0.56));
  glow.addColorStop(0, c.big ? 'rgba(255, 212, 58, 0.85)' : 'rgba(255, 218, 78, 0.65)');
  glow.addColorStop(1, 'rgba(255, 218, 78, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, ts * (c.big ? 0.78 : 0.56), 0, Math.PI * 2); ctx.fill();

  ctx.scale(scale, scale);
  // Outer coin ring
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  grad.addColorStop(0, '#fff9c2');
  grad.addColorStop(0.48, c.big ? '#ffcb36' : '#ffd447');
  grad.addColorStop(1, c.big ? '#e68619' : '#efa424');
  ctx.fillStyle = grad;
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineWidth = Math.max(1.8, ts * (c.big ? 0.068 : 0.055));
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Inner embossed rim
  ctx.strokeStyle = '#fff7cc';
  ctx.lineWidth = Math.max(1.2, ts * 0.042);
  ctx.beginPath(); ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2); ctx.stroke();

  // Center star emblem (5-point bold star on Big Coin, 4-point sparkle on normal coin)
  ctx.fillStyle = '#fffbe0';
  drawStarPath(ctx, 0, 0, r * (c.big ? 0.48 : 0.40), r * (c.big ? 0.22 : 0.19), c.big ? 5 : 4);
  ctx.fill();
  ctx.restore();
}

function drawItemPickup() {
  const pickup = state.itemPickup;
  if (!pickup) return;
  const ts = state.tileSize;
  const t = state.elapsedTime;
  const x = (pickup.x + 0.5) * ts;
  const y = (pickup.y + 0.5) * ts + Math.sin(t * 3.8) * (ts * 0.05);
  const pulse = 1 + Math.sin(t * 4.5) * 0.06;
  const lw = Math.max(1.5, ts * 0.055);

  ctx.save();
  ctx.translate(x, y);

  // Soft magical aura behind pickup
  const aura = ctx.createRadialGradient(0, 0, ts * 0.1, 0, 0, ts * 0.64);
  aura.addColorStop(0, 'rgba(218, 168, 255, 0.72)');
  aura.addColorStop(1, 'rgba(218, 168, 255, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, ts * 0.64, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(pulse, pulse);

  // Creamy badge backing
  ctx.beginPath();
  ctx.arc(0, 0, ts * 0.44, 0, Math.PI * 2);
  ctx.fillStyle = '#fff9e6';
  ctx.fill();
  ctx.strokeStyle = '#9c5ac9';
  ctx.lineWidth = lw;
  ctx.stroke();

  if (pickup.id === 'slow') {
    // Ice-blue freeze clock candy
    const r = ts * 0.25;
    ctx.fillStyle = '#8ee3ff';
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = lw * 0.85;
    ctx.beginPath();
    ctx.arc(0, ts * 0.03, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Top button
    ctx.beginPath();
    ctx.moveTo(-ts * 0.08, -r + ts * 0.01);
    ctx.lineTo(ts * 0.08, -r + ts * 0.01);
    ctx.stroke();
    // Clock hands
    ctx.beginPath();
    ctx.moveTo(0, ts * 0.03);
    ctx.lineTo(0, ts * 0.03 - r * 0.58);
    ctx.moveTo(0, ts * 0.03);
    ctx.lineTo(r * 0.48, ts * 0.03 + r * 0.15);
    ctx.stroke();
  } else if (pickup.id === 'magnet') {
    // Pink horseshoe magnet
    const r = ts * 0.22;
    ctx.strokeStyle = '#ff5a93';
    ctx.lineWidth = Math.max(3, ts * 0.12);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.arc(0, -ts * 0.02, r, Math.PI, 0, false);
    ctx.lineTo(r, ts * 0.2);
    ctx.moveTo(-r, -ts * 0.02);
    ctx.lineTo(-r, ts * 0.2);
    ctx.stroke();
    // Silver tips
    ctx.fillStyle = '#eef6ff';
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = Math.max(1.2, ts * 0.04);
    ctx.fillRect(-r - ts * 0.065, ts * 0.12, ts * 0.13, ts * 0.1);
    ctx.strokeRect(-r - ts * 0.065, ts * 0.12, ts * 0.13, ts * 0.1);
    ctx.fillRect(r - ts * 0.065, ts * 0.12, ts * 0.13, ts * 0.1);
    ctx.strokeRect(r - ts * 0.065, ts * 0.12, ts * 0.13, ts * 0.1);
  } else {
    // Golden hourglass (time)
    const w = ts * 0.2, h = ts * 0.24;
    ctx.fillStyle = '#ffd55a';
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = lw * 0.85;
    ctx.beginPath();
    ctx.moveTo(-w, -h);
    ctx.lineTo(w, -h);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w, h);
    ctx.lineTo(w, h);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function collectFood(index) {
  const food=state.foods.splice(index,1)[0];
  const m=state.missions.find(item=>item.type===food.type && item.collected<item.target);
  if(m){ m.collected++; state.collected++; }
  state.score+=food.points;state.energy=Math.min(100,state.energy+food.energy);state.happyTimer=.45;
  if(!state.isTutorial && state.score>bestScore) {bestScore=state.score;try{hooks.saveBest(bestScore);}catch(_){}}
  spawnEatEffects(food.x,food.y,food);
  if(food.bonus)audio.playBonus();else audio.playEat();
}

function attractFood() {
  if(state.activeItem!=='magnet') return;
  const head=state.snake[0], reachable=new Set([`${head.x},${head.y}`]);
  let edge=[head];
  const blocked=new Set([...state.obstacles,...state.snake.slice(1)].map(p=>`${p.x},${p.y}`));
  for(let distance=0;distance<3;distance++) {
    const next=[];
    for(const p of edge) for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x=p.x+dx,y=p.y+dy,key=`${x},${y}`;
      if(x<0||x>=GRID_COLS||y<0||y>=GRID_ROWS||blocked.has(key)||reachable.has(key))continue;
      reachable.add(key);next.push({x,y});
    }
    edge=next;
  }
  for(let i=state.foods.length-1;i>=0;i--) if(reachable.has(`${state.foods[i].x},${state.foods[i].y}`)) {
    const isTarget=isNeededMissionType(state.foods[i].type);
    collectFood(i);
    if(isTarget) state.growthPending++;
  }
  if(state.coin && reachable.has(`${state.coin.x},${state.coin.y}`)) collectCoin();
}

function stepSimulation() {
  if (state.mode !== 'playing') return;
  // Consume next buffered turn
  if (state.inputQueue.length > 0) {
    state.dir = state.inputQueue.shift();
  }

  const head = state.snake[0];
  let nextX = head.x + state.dir.x;
  let nextY = head.y + state.dir.y;
  // Every level has solid outer walls; revive card can save once!
  if (nextX < 0 || nextX >= GRID_COLS || nextY < 0 || nextY >= GRID_ROWS) {
    if (state.isTutorial) { tutorialSafeRespawn('小心边界，再划动试试～'); return; }
    if (tryRevive('wall')) return;
    triggerGameOver('碰到边界啦'); return;
  }
  const phasing = state.shieldTimer > 0;
  if (!phasing && state.obstacles.some(p => p.x === nextX && p.y === nextY)) {
    if (state.obstacleShields > 0) {
      state.obstacleShields--;
      state.shieldTimer = 2.0;
      spawnEatEffects(nextX, nextY, { type: 'star', points: 0, bonus: true });
      state.popups.pop();
      state.popups.push({ x: (nextX + 0.5) * state.tileSize, y: (nextY + 0.3) * state.tileSize, vy: -state.tileSize, text: '🌈 护盾挡下!', life: 0, maxLife: 1.0, isBonus: true });
      audio.playBonus();
    } else {
      if (tryRevive('obstacle')) return;
      triggerGameOver('碰到糖果路障啦'); return;
    }
  }

  // Check if eating a food item
  const eatenIdx = state.foods.findIndex(f => f.x === nextX && f.y === nextY);
  const skipGrowth = eatenIdx !== -1 && !isNeededMissionType(state.foods[eatenIdx].type) && (getPerk().skipNonTargetGrowthChance || 0) > 0 && Math.random() < getPerk().skipNonTargetGrowthChance;
  const willGrow = (eatenIdx !== -1 && !skipGrowth) || state.growthPending>0;

  // Check self-collision (tail vacates unless growing; energy juice / revive shield phases through)
  if (!phasing) {
    const checkLength = willGrow ? state.snake.length : state.snake.length - 1;
    for (let i = 0; i < checkLength; i++) {
      if (state.snake[i].x === nextX && state.snake[i].y === nextY) {
        if (state.isTutorial) { tutorialSafeRespawn('别撞到自己哦～'); return; }
        if (tryRevive('self')) return;
        triggerGameOver();
        return;
      }
    }
  }

  // Snapshot previous snake for smooth linear interpolation
  state.prevSnake = state.snake.map(s => ({ ...s }));
  if (willGrow) {
    // Duplicate tail in prevSnake so new tail emerges smoothly
    const last = state.snake[state.snake.length - 1];
    state.prevSnake.push({ ...last });
  }

  // Advance snake array
  const newHead = { x: nextX, y: nextY };
  state.snake.unshift(newHead);
  if (!willGrow) {
    state.snake.pop();
  }
  else if(eatenIdx===-1) state.growthPending--;

  // Process eaten food & coins
  if (eatenIdx !== -1) collectFood(eatenIdx);
  if (state.coin && state.coin.x === newHead.x && state.coin.y === newHead.y) collectCoin();
  collectItemPickup();
  attractFood();
  if (state.missions.every(m => m.collected >= m.target)) {
    if (state.isTutorial) {
      state.mode = 'tutorial_done';
      state.tutorialStep = 4;
      state.inputQueue = [];
      state.prevSnake = state.snake.map(p => ({ ...p }));
      audio.playNewRecord();
      const head = state.snake[0];
      spawnEatEffects(head.x, head.y, { type: 'star', points: 0, bonus: true });
      state.popups.pop();
      publish();
      return;
    }
    clearLevel(); return;
  }
  if (state.isTutorial) {
    if (state.foods.length === 0) {
      state.tutorialStep = Math.min(3, state.collected + 1);
      state.tutorialSwiped = false;
      placeTutorialTarget(state.tutorialStep);
      publish();
    }
    return;
  }
  while (state.foods.length < ACTIVE_FOOD_COUNT && spawnFood()) {}
  if(!state.foods.length) {triggerGameOver('棋盘已满，未完成收集');return;}
}
function drawHeartPath(c, x, y, size) {
  c.beginPath();
  c.moveTo(x, y + size * 0.42);
  c.bezierCurveTo(x - size * 0.72, y - size * 0.05, x - size * 0.65, y - size * 0.65, x, y - size * 0.25);
  c.bezierCurveTo(x + size * 0.65, y - size * 0.65, x + size * 0.72, y - size * 0.05, x, y + size * 0.42);
  c.closePath();
}

function drawStarPath(c, x, y, outerR, innerR, points = 5) {
  c.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}

/** Draw pastel pink & warm cream checkerboard */
function drawCheckerboard() {
  const ts = state.tileSize;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#fff1e2' : '#ffd4e4';
      ctx.fillRect(c * ts, r * ts, ts, ts);
    }
  }
}

/** Draw each hand-crafted glossy food sprite */
function drawFood(food, t) {
  const ts = state.tileSize;
  const bob = Math.sin(t * 3.4 + food.phase) * (ts * 0.055);
  const pulse = 1 + Math.sin(t * 4.2 + food.phase) * 0.035;
  const scale = food.spawnScale * pulse;

  const cx = (food.x + 0.5) * ts;
  const cy = (food.y + 0.5) * ts + bob;

  ctx.save();
  ctx.translate(cx, cy);

  // Soft radiant glow behind food
  const glowGrad = ctx.createRadialGradient(0, 0, ts * 0.06, 0, 0, ts * 0.56);
  glowGrad.addColorStop(0, food.glow);
  glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(0, 0, ts * 0.56, 0, Math.PI * 2);
  ctx.fill();

  // Ground shadow on tile
  ctx.fillStyle = 'rgba(107, 45, 71, 0.14)';
  ctx.beginPath();
  ctx.ellipse(0, ts * 0.36 - bob * 0.5, ts * 0.25 * scale, ts * 0.08 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(scale, scale);
  const lw = Math.max(1.8, ts * 0.055);

  if (food.type === 'strawberry') {
    // Plump glossy strawberry body
    const sGrad = ctx.createLinearGradient(0, -ts * 0.28, 0, ts * 0.34);
    sGrad.addColorStop(0, '#ff7597');
    sGrad.addColorStop(0.55, '#ff3b6b');
    sGrad.addColorStop(1, '#d91e52');

    ctx.beginPath();
    ctx.moveTo(0, ts * 0.34);
    ctx.bezierCurveTo(-ts * 0.34, ts * 0.18, -ts * 0.36, -ts * 0.18, -ts * 0.14, -ts * 0.25);
    ctx.quadraticCurveTo(0, -ts * 0.29, ts * 0.14, -ts * 0.25);
    ctx.bezierCurveTo(ts * 0.36, -ts * 0.18, ts * 0.34, ts * 0.18, 0, ts * 0.34);
    ctx.closePath();
    ctx.fillStyle = sGrad;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.stroke();

    // Tiny golden strawberry seeds
    ctx.fillStyle = '#fff0a8';
    const seeds = [[-0.12, -0.05], [0.12, -0.04], [0, 0.03], [-0.1, 0.12], [0.1, 0.12], [0, 0.2]];
    seeds.forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.ellipse(sx * ts, sy * ts, ts * 0.024, ts * 0.036, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Glossy specular shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-ts * 0.14, -ts * 0.09, ts * 0.065, ts * 0.035, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Cute green leafy crown
    ctx.fillStyle = '#6fd957';
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = lw * 0.85;
    ctx.beginPath();
    ctx.moveTo(-ts * 0.2, -ts * 0.21);
    ctx.quadraticCurveTo(-ts * 0.1, -ts * 0.34, 0, -ts * 0.24);
    ctx.quadraticCurveTo(ts * 0.1, -ts * 0.34, ts * 0.2, -ts * 0.21);
    ctx.quadraticCurveTo(ts * 0.08, -ts * 0.16, 0, -ts * 0.14);
    ctx.quadraticCurveTo(-ts * 0.08, -ts * 0.16, -ts * 0.2, -ts * 0.21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

  } else if (food.type === 'cherries') {
    // Green stems
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = lw * 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-ts * 0.14, ts * 0.08);
    ctx.quadraticCurveTo(-ts * 0.08, -ts * 0.2, ts * 0.03, -ts * 0.28);
    ctx.quadraticCurveTo(ts * 0.14, -ts * 0.16, ts * 0.16, ts * 0.1);
    ctx.stroke();

    ctx.strokeStyle = '#7ad65c';
    ctx.lineWidth = lw * 0.55;
    ctx.stroke();

    // Little leaf
    ctx.fillStyle = '#75db5e';
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.ellipse(ts * 0.13, -ts * 0.24, ts * 0.11, ts * 0.06, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Twin glossy cherries
    const berries = [[-ts * 0.15, ts * 0.16], [ts * 0.15, ts * 0.18]];
    berries.forEach(([bx, by]) => {
      const cGrad = ctx.createRadialGradient(bx - ts * 0.05, by - ts * 0.06, ts * 0.02, bx, by, ts * 0.19);
      cGrad.addColorStop(0, '#ff8aa8');
      cGrad.addColorStop(0.55, '#f22962');
      cGrad.addColorStop(1, '#b81445');
      ctx.beginPath();
      ctx.arc(bx, by, ts * 0.165, 0, Math.PI * 2);
      ctx.fillStyle = cGrad;
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(bx - ts * 0.055, by - ts * 0.06, ts * 0.045, ts * 0.025, -0.5, 0, Math.PI * 2);
      ctx.fill();
    });

  } else if (food.type === 'heart') {
    // 3D Glossy Pink Heart Candy
    const hGrad = ctx.createLinearGradient(0, -ts * 0.3, 0, ts * 0.34);
    hGrad.addColorStop(0, '#ffb0d5');
    hGrad.addColorStop(0.5, '#ff5299');
    hGrad.addColorStop(1, '#d62872');
    drawHeartPath(ctx, 0, ts * 0.04, ts * 0.62);
    ctx.fillStyle = hGrad;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-ts * 0.13, -ts * 0.11, ts * 0.075, ts * 0.04, -0.45, 0, Math.PI * 2);
    ctx.fill();

  } else if (food.type === 'star') {
    // Pastel Glowing Star Candy
    ctx.rotate(Math.sin(t * 2.4 + food.phase) * 0.15);
    const stGrad = ctx.createLinearGradient(0, -ts * 0.34, 0, ts * 0.34);
    stGrad.addColorStop(0, '#fff7b2');
    stGrad.addColorStop(0.5, '#ffc845');
    stGrad.addColorStop(1, '#ff7ca8');
    drawStarPath(ctx, 0, 0, ts * 0.36, ts * 0.18, 5);
    ctx.fillStyle = stGrad;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Inner bright shine
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.beginPath();
    ctx.ellipse(-ts * 0.05, -ts * 0.09, ts * 0.07, ts * 0.038, -0.35, 0, Math.PI * 2);
    ctx.fill();

  } else if (food.type === 'candy') {
    // Wrapped Lavender-Pink Bonbon Candy
    ctx.rotate(-0.42);
    // Wrapper ends
    ctx.fillStyle = '#c58cff';
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = lw * 0.9;
    ctx.lineJoin = 'round';

    // Left wrapper wing
    ctx.beginPath();
    ctx.moveTo(-ts * 0.18, 0);
    ctx.lineTo(-ts * 0.36, -ts * 0.14);
    ctx.lineTo(-ts * 0.34, ts * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right wrapper wing
    ctx.beginPath();
    ctx.moveTo(ts * 0.18, 0);
    ctx.lineTo(ts * 0.36, -ts * 0.14);
    ctx.lineTo(ts * 0.34, ts * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center oval candy
    const caGrad = ctx.createLinearGradient(0, -ts * 0.2, 0, ts * 0.2);
    caGrad.addColorStop(0, '#ffc7f0');
    caGrad.addColorStop(0.5, '#d178ff');
    caGrad.addColorStop(1, '#9c4ce6');
    ctx.beginPath();
    ctx.ellipse(0, 0, ts * 0.22, ts * 0.165, 0, 0, Math.PI * 2);
    ctx.fillStyle = caGrad;
    ctx.fill();
    ctx.stroke();

    // Candy diagonal stripe + highlight
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(-ts * 0.06, -ts * 0.065, ts * 0.075, ts * 0.032, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/** Compute smoothly interpolated pixel position of snake segment i */
function getInterpolatedSegmentPos(i, alpha) {
  const curr = state.snake[i];
  const prev = state.prevSnake[i] || curr;
  const ts = state.tileSize;

  const gx = prev.x + (curr.x - prev.x) * alpha;
  const gy = prev.y + (curr.y - prev.y) * alpha;
  return {
    x: (gx + 0.5) * ts,
    y: (gy + 0.5) * ts,
    gx,
    gy
  };
}

/** Determine snake head facial expression */
function getSnakeExpression(headPos) {
  if (state.mode === 'gameover') return 'dizzy';
  if (state.happyTimer > 0) return 'happy';

  // Check if within 2 tiles of any food for excited ":D" expression
  for (const f of state.foods) {
    const dist = Math.hypot(f.x - headPos.gx, f.y - headPos.gy);
    if (dist <= 2.25) return 'excited';
  }
  return 'normal';
}

/** Draw glossy spherical pink snake with crown and dynamic facial expressions */
function drawSnake(alpha, t) {
  const len = state.snake.length;
  if (len === 0) return;

  const ts = state.tileSize;
  const lw = Math.max(2, ts * 0.062);

  // Precompute interpolated coordinates
  const points = [];
  for (let i = 0; i < len; i++) {
    points.push(getInterpolatedSegmentPos(i, alpha));
  }

  // 1. Soft ground shadow beneath entire snake
  ctx.save();
  ctx.fillStyle = 'rgba(107, 45, 71, 0.15)';
  for (let i = len - 1; i >= 0; i--) {
    const p = points[i];
    const taper = i >= len - 3 ? 0.58 + (len - 1 - i) * 0.14 : 1;
    const r = (i === 0 ? ts * 0.48 : ts * 0.41) * taper;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.34, r * 0.96, r * 0.68, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 2. Plump spherical bead segments drawn from tail -> neck (using equipped snake skin!)
  const skin = getSnake(state.skinId);
  const beadPalettes = skin.rainbow
    ? skin.rainbow.map(c => [skin.belly, c, skin.bodyDark])
    : [
        [skin.belly, skin.bodyLight, skin.bodyMid],
        [skin.bodyLight, skin.bodyMid, skin.bodyDark],
        [skin.belly, skin.bodyMid, skin.bodyDark]
      ];

  for (let i = len - 1; i >= 1; i--) {
    const p = points[i];
    // Smooth tapering for last 3 tail beads
    let radius = ts * 0.425;
    if (i === len - 1) radius = ts * 0.27;
    else if (i === len - 2) radius = ts * 0.34;
    else if (i === len - 3) radius = ts * 0.39;

    // Subtle adorable breathing wiggle
    const wiggle = Math.sin(t * 7 - i * 0.7) * (ts * 0.012);
    const r = radius + wiggle;
    const pal = beadPalettes[i % beadPalettes.length];

    const bGrad = ctx.createRadialGradient(p.x - r * 0.28, p.y - r * 0.32, r * 0.1, p.x, p.y, r);
    bGrad.addColorStop(0, pal[0]);
    bGrad.addColorStop(0.58, pal[1]);
    bGrad.addColorStop(1, pal[2]);

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = bGrad;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.stroke();

    // Glossy candy specular highlight on each bead
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.beginPath();
    ctx.ellipse(p.x - r * 0.32, p.y - r * 0.35, r * 0.34, r * 0.18, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Cute Glossy Snake Head + Crown + Dynamic Expressions
  const head = points[0];
  const hr = ts * 0.495;
  const dx = state.dir.x;
  const dy = state.dir.y;
  const expr = getSnakeExpression(head);

  ctx.save();
  ctx.translate(head.x, head.y);

  // Subtle head tilt following direction while keeping face & crown naturally readable
  let headTilt = 0;
  if (dx === -1) headTilt = -0.08;
  else if (dx === 1) headTilt = 0.08;
  else if (dy === -1) headTilt = 0;
  else if (dy === 1) headTilt = 0;
  ctx.rotate(headTilt);

  // Soft boost aura around head
  if (state.boostActive) {
    const aura = ctx.createRadialGradient(0, 0, hr * 0.6, 0, 0, hr * 1.45);
    aura.addColorStop(0, 'rgba(255, 210, 90, 0.55)');
    aura.addColorStop(1, 'rgba(255, 130, 185, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, hr * 1.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head sphere gradient (skin-driven)
  const hGrad = ctx.createRadialGradient(-hr * 0.25, -hr * 0.3, hr * 0.12, 0, 0, hr);
  hGrad.addColorStop(0, skin.belly);
  hGrad.addColorStop(0.55, skin.bodyLight);
  hGrad.addColorStop(1, skin.bodyDark);

  ctx.beginPath();
  ctx.arc(0, 0, hr, 0, Math.PI * 2);
  ctx.fillStyle = hGrad;
  ctx.fill();
  ctx.lineWidth = lw * 1.08;
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.stroke();

  // Top glossy shine on forehead
  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.beginPath();
  ctx.ellipse(-hr * 0.25, -hr * 0.42, hr * 0.34, hr * 0.16, -0.32, 0, Math.PI * 2);
  ctx.fill();

  // Shift facial features gently toward direction of movement
  const fx = dx * hr * 0.18;
  const fy = dy * hr * 0.14;

  // Rosy blushed cheeks
  ctx.fillStyle = 'rgba(255, 92, 146, 0.56)';
  ctx.beginPath();
  ctx.ellipse(fx - hr * 0.44, fy + hr * 0.2, hr * 0.19, hr * 0.115, 0, 0, Math.PI * 2);
  ctx.ellipse(fx + hr * 0.44, fy + hr * 0.2, hr * 0.19, hr * 0.115, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes & Mouth by Expression
  const eyeY = fy - hr * 0.04;
  const eyeSep = hr * 0.32;

  if (expr === 'dizzy') {
    // Cute x_x / swirl dizzy eyes on collision
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = Math.max(1.8, hr * 0.1);
    ctx.lineCap = 'round';
    [-eyeSep, eyeSep].forEach(ex => {
      const r = hr * 0.14;
      ctx.beginPath();
      ctx.moveTo(fx + ex - r, eyeY - r);
      ctx.lineTo(fx + ex + r, eyeY + r);
      ctx.moveTo(fx + ex + r, eyeY - r);
      ctx.lineTo(fx + ex - r, eyeY + r);
      ctx.stroke();
    });
    // Wavy oops mouth
    ctx.beginPath();
    ctx.arc(fx, fy + hr * 0.28, hr * 0.12, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

  } else if (expr === 'happy') {
    // Happy cute winking/smiling "^ ^" arcs right after eating
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = Math.max(2, hr * 0.105);
    ctx.lineCap = 'round';
    [-eyeSep, eyeSep].forEach(ex => {
      ctx.beginPath();
      ctx.arc(fx + ex, eyeY + hr * 0.05, hr * 0.15, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    });
    // Sweet happy open smile
    ctx.fillStyle = '#ff4d88';
    ctx.beginPath();
    ctx.arc(fx, fy + hr * 0.18, hr * 0.17, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

  } else {
    // Normal or Excited big sparkling eyes (with occasional idle blink)
    const isBlinking = expr === 'normal' && state.blinkDuration > 0;
    if (isBlinking) {
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = Math.max(2, hr * 0.1);
      ctx.lineCap = 'round';
      [-eyeSep, eyeSep].forEach(ex => {
        ctx.beginPath();
        ctx.moveTo(fx + ex - hr * 0.13, eyeY);
        ctx.quadraticCurveTo(fx + ex, eyeY - hr * 0.07, fx + ex + hr * 0.13, eyeY);
        ctx.stroke();
      });
    } else {
      const eyeR = expr === 'excited' ? hr * 0.19 : hr * 0.165;
      [-eyeSep, eyeSep].forEach(ex => {
        ctx.fillStyle = '#4f1d33';
        ctx.beginPath();
        ctx.arc(fx + ex, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        // Twin kawaii catchlights
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(fx + ex - eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(fx + ex + eyeR * 0.3, eyeY + eyeR * 0.32, eyeR * 0.18, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (expr === 'excited') {
      // Excited ":D" open mouth anticipating nearby food!
      ctx.fillStyle = '#e83e7a';
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = Math.max(1.8, hr * 0.085);
      ctx.beginPath();
      ctx.arc(fx, fy + hr * 0.17, hr * 0.21, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Cute tiny pink tongue
      ctx.fillStyle = '#ff9ec2';
      ctx.beginPath();
      ctx.arc(fx, fy + hr * 0.31, hr * 0.1, Math.PI, 0);
      ctx.fill();
    } else {
      // Classic adorable ":3" cat smile
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.lineWidth = Math.max(1.8, hr * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fx - hr * 0.18, fy + hr * 0.19);
      ctx.quadraticCurveTo(fx - hr * 0.09, fy + hr * 0.32, fx, fy + hr * 0.21);
      ctx.quadraticCurveTo(fx + hr * 0.09, fy + hr * 0.32, fx + hr * 0.18, fy + hr * 0.19);
      ctx.stroke();
    }
  }

  // Shiny Mini 3-Point Golden Crown Perched on Top of Head
  ctx.save();
  const crownOffsetX = -dx * hr * 0.12;
  const crownOffsetY = -hr * 0.92;
  ctx.translate(crownOffsetX, crownOffsetY);
  ctx.rotate(dx * 0.16);
  const cw = hr * 0.92;
  const ch = hr * 0.62;

  const crownGrad = ctx.createLinearGradient(0, -ch * 0.6, 0, ch * 0.5);
  crownGrad.addColorStop(0, '#fff4a3');
  crownGrad.addColorStop(0.55, '#ffcb3b');
  crownGrad.addColorStop(1, '#f09412');

  ctx.beginPath();
  ctx.moveTo(-cw * 0.42, ch * 0.42);
  ctx.lineTo(-cw * 0.52, -ch * 0.28);
  ctx.lineTo(-cw * 0.2, ch * 0.04);
  ctx.lineTo(0, -ch * 0.52);
  ctx.lineTo(cw * 0.2, ch * 0.04);
  ctx.lineTo(cw * 0.52, -ch * 0.28);
  ctx.lineTo(cw * 0.42, ch * 0.42);
  ctx.closePath();
  ctx.fillStyle = crownGrad;
  ctx.fill();
  ctx.lineWidth = Math.max(1.6, lw * 0.85);
  ctx.strokeStyle = OUTLINE_COLOR;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Tiny pearl tips on the 3 crown points
  ctx.fillStyle = '#fff9cc';
  [[-cw * 0.52, -ch * 0.3], [0, -ch * 0.55], [cw * 0.52, -ch * 0.3]].forEach(([px, py]) => {
    ctx.beginPath();
    ctx.arc(px, py, hr * 0.085, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Little pink gem in crown center
  ctx.fillStyle = '#ff5a9d';
  ctx.beginPath();
  ctx.arc(0, ch * 0.16, hr * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Spinning stars above head when dizzy (Game Over)
  if (expr === 'dizzy') {
    for (let s = 0; s < 3; s++) {
      const ang = t * 4.5 + (s * Math.PI * 2) / 3;
      const sx = Math.cos(ang) * hr * 0.85;
      const sy = -hr * 1.05 + Math.sin(ang) * hr * 0.24;
      drawStarPath(ctx, sx, sy, hr * 0.2, hr * 0.09, 5);
      ctx.fillStyle = '#ffe159';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = OUTLINE_COLOR;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/** Draw expanding glow rings, bursting hearts/stars, and floating +10 score text */
function drawEffects() {
  // 1. Expanding pastel rings
  state.rings.forEach(ring => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, ring.alpha);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = Math.max(2, state.tileSize * 0.08);
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });

  // 2. Heart, star & sparkle particles
  state.particles.forEach(p => {
    const progress = p.life / p.maxLife;
    const alpha = Math.max(0, 1 - progress);
    const scale = 1 - progress * 0.45;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;

    if (p.shape === 'heart') {
      drawHeartPath(ctx, 0, 0, p.size * 1.45);
      ctx.fill();
    } else if (p.shape === 'star') {
      drawStarPath(ctx, 0, 0, p.size, p.size * 0.45, 5);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // 3. Floating glossy golden 3D score popups (+10 / +15 / +20 / +30)
  state.popups.forEach(pop => {
    const prog = pop.life / pop.maxLife;
    const alpha = prog < 0.7 ? 1 : Math.max(0, (1 - prog) / 0.3);
    const scale = prog < 0.18 ? 0.65 + (prog / 0.18) * 0.48 : 1.13 - prog * 0.12;
    const fontSize = Math.round(state.tileSize * (pop.isBonus ? 0.54 : 0.46));

    ctx.save();
    ctx.translate(pop.x, pop.y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${fontSize}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dark-berry outline
    ctx.lineWidth = Math.max(3.5, fontSize * 0.24);
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineJoin = 'round';
    ctx.strokeText(pop.text, 0, 0);

    // Glossy golden gradient fill
    const tGrad = ctx.createLinearGradient(0, -fontSize * 0.5, 0, fontSize * 0.5);
    tGrad.addColorStop(0, '#fff7b2');
    tGrad.addColorStop(0.55, '#ffd046');
    tGrad.addColorStop(1, '#ff7ca8');
    ctx.fillStyle = tGrad;
    ctx.fillText(pop.text, 0, 0);
    ctx.restore();
  });
}

/* =====================================================================
   9. MAIN ANIMATION LOOP (SMOOTH INTERPOLATION + PARTICLES + ENERGY)
   ===================================================================== */
function updateParticlesAndTimers(dt) {
  // Food pop-in animation
  state.foods.forEach(f => {
    if (f.spawnScale < 1) {
      f.spawnScale = Math.min(1, f.spawnScale + dt * 5.2);
    }
  });

  // Facial expression timers
  if (state.happyTimer > 0) {
    state.happyTimer = Math.max(0, state.happyTimer - dt);
  }

  state.blinkTimer -= dt;
  if (state.blinkTimer <= 0) {
    state.blinkDuration = 0.14;
    state.blinkTimer = 2.6 + Math.random() * 2.4;
  }
  if (state.blinkDuration > 0) {
    state.blinkDuration = Math.max(0, state.blinkDuration - dt);
  }

  // Update rings
  for (let i = state.rings.length - 1; i >= 0; i--) {
    const r = state.rings[i];
    r.radius += (r.maxRadius - r.radius) * Math.min(1, dt * 8.5);
    r.alpha -= dt * 2.2;
    if (r.alpha <= 0) state.rings.splice(i, 1);
  }

  // Update particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += state.tileSize * 2.4 * dt; // Soft gravity
    p.rot += p.vRot * dt;
    if (p.life >= p.maxLife) state.particles.splice(i, 1);
  }

  // Update floating score popups
  for (let i = state.popups.length - 1; i >= 0; i--) {
    const pop = state.popups[i];
    pop.life += dt;
    pop.y += pop.vy * dt;
    pop.vy *= 0.96;
    if (pop.life >= pop.maxLife) state.popups.splice(i, 1);
  }
}

function render(alpha) {
  ctx.save();
  ctx.scale(state.dpr, state.dpr);
  drawCheckerboard();
  const ts=state.tileSize;
  state.obstacles.forEach(p=>{
    const x=p.x*ts, y=p.y*ts;
    ctx.fillStyle='#6b2d47'; ctx.fillRect(x+1,y+1,ts-2,ts-2);
    ctx.fillStyle=getLevel(state.level).obstacleColor; ctx.fillRect(x+3,y+3,ts-6,ts-6);
    ctx.fillStyle=getLevel(state.level).obstacleHighlight; ctx.fillRect(x+4,y+4,ts-8,Math.max(2,ts*.15));
    ctx.fillStyle='#7d3d61'; ctx.fillRect(x+4,y+ts-7,ts-8,3);
  });

  // Draw foods & special gold coin
  state.foods.forEach(f => drawFood(f, state.elapsedTime));
  drawCoin();

  drawItemPickup();

  // Draw snake with smooth interpolation
  drawSnake(alpha, state.elapsedTime);

  // Draw particles & popups on top
  drawEffects();
  if(state.itemTimer>0 || state.shieldTimer>0) {
    const head=state.snake[0], cx=(head.x+.5)*ts, cy=(head.y+.5)*ts;
    if(state.activeItem==='magnet') {
      ctx.beginPath();ctx.arc(cx,cy,ts*2.6,0,Math.PI*2);
      ctx.strokeStyle='rgba(223,128,217,0.32)';ctx.lineWidth=Math.max(1.5,ts*.05);ctx.stroke();
    }
    ctx.beginPath();ctx.arc(cx,cy,ts*(.72+Math.sin(state.elapsedTime*6)*.09),0,Math.PI*2);
    ctx.strokeStyle=state.shieldTimer>0?'#ff75b5':state.activeItem==='slow'?'#5ec8ff':state.activeItem==='energy'?'#ffb830':'#df80d9';ctx.lineWidth=ts*.09;ctx.stroke();
  }
  if(state.mode==='celebrating') {
    const w=GRID_COLS*ts,h=GRID_ROWS*ts,t=state.clearTimer;
    const scale=Math.min(1,t/.24)*(1+Math.sin(Math.min(1,t/.24)*Math.PI)*.12);
    ctx.fillStyle='rgba(255,242,249,0.26)';ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(w/2,h*.43);ctx.scale(scale,scale);
    ctx.fillStyle='#fff4cd';ctx.fillRect(-w*.43,-ts*1.15,w*.86,ts*2.5);
    
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`bold ${Math.round(ts*1.05)}px sans-serif`;
    ctx.fillStyle='#c34f80';ctx.fillText(state.level===LEVELS.length?'全部通关！':'过关啦！',0,-ts*.12);
    ctx.font=`bold ${Math.round(ts*.43)}px sans-serif`;ctx.fillStyle='#96566e';
    ctx.fillText(`第 ${state.level} 关 · 甜蜜目标达成`,0,ts*.8);ctx.restore();
  }
  ctx.restore();
}
function tick(dt) {
  const elapsed=Math.max(0,dt);
  dt = Math.max(0, Math.min(dt, 0.08));
  state.elapsedTime += dt;
  let alpha = 1;
  if (state.mode === 'playing') {
    if (state.isTutorial) {
      if (state.coin) state.coin.spawnScale = Math.min(1, state.coin.spawnScale + dt * 6);
    } else {
      if(state.activeItem!=='slow') state.remaining=Math.max(0,state.remaining-elapsed);
      state.missionElapsed += elapsed;
      releaseMissionFood();
      updateCoin(dt);
      if(state.remaining<=0) {
        if(!tryRevive('timeout')) {triggerGameOver('时间到啦');render(1);return;}
      }
    }
    if(state.itemTimer>0) {state.itemTimer=Math.max(0,state.itemTimer-dt);if(!state.itemTimer)state.activeItem='';}
    if(state.shieldTimer>0) {state.shieldTimer=Math.max(0,state.shieldTimer-dt);}
    const stepMs = getCurrentStepMs();
    state.stepAccumulator += dt * 1000;
    while (state.stepAccumulator >= stepMs && state.mode === 'playing') {
      state.stepAccumulator -= stepMs;
      stepSimulation();
    }
    alpha = state.mode === 'playing' ? Math.min(1, state.stepAccumulator / getCurrentStepMs()) : 1;
  } else if(state.mode==='clear_pause') {
    state.clearTimer+=dt;
    if(state.clearTimer>=.55) celebrate();
  } else if(state.mode==='celebrating') {
    state.clearTimer+=dt;
    if(state.clearTimer>=1.45) state.mode=state.level===LEVELS.length?'completed':'cleared';
  }
  updateParticlesAndTimers(dt);
  render(alpha);
  publish();
}
resetGame();
return {
  state, tick, render,
  clearBest() {bestScore=0;state.bestAtStart=0;state.newRecord=false;publish();},
  setBest(value) {bestScore=Math.max(0,Number(value)||0);state.bestAtStart=bestScore;publish();},
  resize(tile, dpr) { state.tileSize = tile; state.dpr = dpr; state.particles=[]; state.popups=[]; state.rings=[]; render(1); },
  setSkin(id) { state.skinId = getSnake(id).id; if(state.mode==='start') resetGame(state.level); else render(1); },
  prepare(level = state.level) {resetGame(level);state.mode='start';publish();},
  startTutorial() { resetTutorialStage(); },
  start(level = state.level, item = '', options = {}) {
    resetGame(level);
    const itemSpec = getItem(item);
    if (itemSpec && itemSpec.kind !== 'passive' && (!hooks.getItemCount || hooks.getItemCount(item) > 0)) {
      state.equippedItem = item;
      spawnItemNearMouth(item);
    } else {
      state.equippedItem = '';
    }
    if (options && options.doubleCoin && hooks.consumeItem && hooks.consumeItem('doubleCoin')) {
      state.doubleCoinActive = true;
    }
    if (options && options.revive) {
      state.reviveArmed = true;
    }
    state.mode='playing';
    publish();
  },
  useItem,
  nextLevel() { if(state.mode!=='cleared'||state.level>=LEVELS.length) return false; resetGame(state.level+1); state.mode='start'; publish(); return true; },
  pause() { if (state.mode === 'playing') { state.mode='paused'; state.inputQueue=[]; } state.boostHeld=false; state.boostActive=false; publish(); },
  resume() { if(state.mode==='paused') { state.mode='playing'; state.stepAccumulator=0; publish(); } },
  coinContinue(type) {
    if (state.mode !== 'gameover' || state.reviveUsed) return false;
    state.reviveUsed = true;
    state.failureReason = '';
    state.boostActive = false;
    state.boostHeld = false;
    state.inputQueue = [];
    state.stepAccumulator = 0;
    if (type === 'time') {
      state.remaining = Math.max(state.remaining, 0) + 25;
    } else {
      const startX = Math.floor(GRID_COLS / 2) - 1;
      const startY = Math.floor(GRID_ROWS / 2);
      const keepLen = Math.min(state.snake.length, 4);
      state.snake = Array.from({ length: keepLen }, (_, i) => ({ x: startX + i, y: startY }));
      state.prevSnake = state.snake.map(s => ({ ...s }));
      state.dir = { x: -1, y: 0 };
      state.shieldTimer = 3.0;
    }
    state.mode = 'playing';
    const head = state.snake[0];
    spawnEatEffects(head.x, head.y, { type: 'star', points: 0, bonus: true });
    state.popups.pop();
    state.popups.push({
      x: (head.x + 0.5) * state.tileSize,
      y: (head.y + 0.3) * state.tileSize,
      vy: -state.tileSize * 1.1,
      text: type === 'time' ? '⏱ 加时 +25s!' : '💖 复活继续!',
      life: 0,
      maxLife: 1.2,
      isBonus: true
    });
    audio.playNewRecord();
    publish();
    return true;
  },
  turn(dx,dy) { if (Math.abs(dx)+Math.abs(dy)===1) queueDirection(dx,dy); },
  boost() {},
  // Exposed deterministic simulation step for regression tests.
  step: stepSimulation
};
}
export { createGame, GRID_COLS, GRID_ROWS, FOOD_TYPES };
