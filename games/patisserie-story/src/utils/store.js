// src/utils/store.js
// 《甜点屋物语》纯 HTML5 存档、经营经济（金币/口碑/天数/装潢）与分歧标记持久化

import { LEVELS } from '../data/levels.js';
import { RECIPES } from '../data/recipes.js';
import { CHARACTERS } from '../data/characters.js';
import { computeShopBonuses } from '../data/shop_upgrades.js';
import { createStorage } from '../../../../shared/web-ui.js';

const storage = createStorage('patisserie_story_html5');
const STORAGE_KEY = 'save_v1';
const RANK_ORDER = { B: 1, A: 2, S: 3 };
const RANK_REWARD_COINS = { S: 120, A: 80, B: 50 };
const RANK_REWARD_REP = { S: 30, A: 20, B: 10 };

function getDefaultSave() {
  return {
    completedLevelIds: [],
    unlockedRecipeIds: [],
    levelRanks: {},
    levelScores: {},
    storyFlags: {},
    hasSeenIntro: false,
    coins: 120,
    reputation: 0,
    day: 1,
    purchasedUpgradeIds: [],
    menuRecipeIds: []
  };
}

export function loadProgress() {
  const saved = storage.get(STORAGE_KEY);
  if (!saved || !Array.isArray(saved.completedLevelIds)) {
    return getDefaultSave();
  }
  return Object.assign(getDefaultSave(), saved, {
    completedLevelIds: saved.completedLevelIds || [],
    unlockedRecipeIds: saved.unlockedRecipeIds || [],
    levelRanks: saved.levelRanks || {},
    levelScores: saved.levelScores || {},
    storyFlags: saved.storyFlags || {},
    purchasedUpgradeIds: saved.purchasedUpgradeIds || [],
    menuRecipeIds: saved.menuRecipeIds || [],
    coins: typeof saved.coins === 'number' ? saved.coins : 120,
    reputation: typeof saved.reputation === 'number' ? saved.reputation : 0,
    day: typeof saved.day === 'number' ? saved.day : 1
  });
}

export function markIntroSeen() {
  const progress = loadProgress();
  progress.hasSeenIntro = true;
  storage.set(STORAGE_KEY, progress);
  return progress;
}

export function setStoryFlag(flagKey, value = true) {
  if (!flagKey) return loadProgress();
  const progress = loadProgress();
  progress.storyFlags[flagKey] = value;
  storage.set(STORAGE_KEY, progress);
  return progress;
}

export function hasStoryFlag(flagKey) {
  const progress = loadProgress();
  return !!(progress.storyFlags && progress.storyFlags[flagKey]);
}

export function hasSeenTutorial(mode) {
  return hasStoryFlag(`tut_${mode}`);
}

export function markTutorialSeen(mode) {
  return setStoryFlag(`tut_${mode}`, true);
}

export function completeLevel(levelId, rank = 'A', score = 0) {
  const level = LEVELS.find(item => item.id === levelId);
  if (!level) return loadProgress();

  const progress = loadProgress();
  if (!progress.completedLevelIds.includes(levelId)) {
    progress.completedLevelIds.push(levelId);
  }
  if (level.recipeId && !progress.unlockedRecipeIds.includes(level.recipeId)) {
    progress.unlockedRecipeIds.push(level.recipeId);
    if (progress.menuRecipeIds.length < 3) {
      progress.menuRecipeIds.push(level.recipeId);
    }
  }
  if (rank) {
    const prevRank = progress.levelRanks[levelId];
    if (!prevRank || (RANK_ORDER[rank] || 0) >= (RANK_ORDER[prevRank] || 0)) {
      progress.levelRanks[levelId] = rank;
    }
  }
  if (typeof score === 'number') {
    const prevScore = progress.levelScores[levelId] || 0;
    if (score > prevScore) {
      progress.levelScores[levelId] = score;
    }
  }
  progress.coins += RANK_REWARD_COINS[rank] || 60;
  progress.reputation += RANK_REWARD_REP[rank] || 15;

  storage.set(STORAGE_KEY, progress);
  return progress;
}

export function recordBusinessDay({ earnedCoins = 0, earnedRep = 0 }) {
  const progress = loadProgress();
  progress.coins = Math.max(0, progress.coins + Math.round(earnedCoins));
  progress.reputation = Math.max(0, progress.reputation + Math.round(earnedRep));
  progress.day += 1;
  storage.set(STORAGE_KEY, progress);
  return progress;
}

export function buyShopUpgrade(upgradeId, cost) {
  const progress = loadProgress();
  if (progress.purchasedUpgradeIds.includes(upgradeId)) {
    return { ok: false, reason: 'already_owned', progress };
  }
  if (progress.coins < cost) {
    return { ok: false, reason: 'insufficient_coins', progress };
  }
  progress.coins -= cost;
  progress.purchasedUpgradeIds.push(upgradeId);
  progress.reputation += 25;
  storage.set(STORAGE_KEY, progress);
  return { ok: true, progress };
}

export function saveMenuRecipeIds(ids) {
  const progress = loadProgress();
  progress.menuRecipeIds = ids.slice(0, 3);
  storage.set(STORAGE_KEY, progress);
  return progress;
}

export function resetProgress() {
  const empty = getDefaultSave();
  storage.set(STORAGE_KEY, empty);
  return empty;
}

export function isLevelUnlocked(level, completedIds) {
  if (!level.prerequisiteIds || level.prerequisiteIds.length === 0) {
    return true;
  }
  return level.prerequisiteIds.every(reqId => completedIds.includes(reqId));
}

export function getShopTierTitle(reputation) {
  if (reputation >= 400) return '👑 风铃湾传奇糖屋';
  if (reputation >= 220) return '✨ 人气手工名店';
  if (reputation >= 90) return '🥐 街坊口碑小店';
  return '🌱 筹备见习糖屋';
}

export function getDashboardState() {
  const progress = loadProgress();
  const completedIds = progress.completedLevelIds;
  const totalCount = LEVELS.length;
  const completedCount = completedIds.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  const enrichedLevels = LEVELS.map(lvl => {
    const recipe = RECIPES.find(r => r.id === lvl.recipeId);
    const npc = CHARACTERS[lvl.npcId] || CHARACTERS.coco;
    const completed = completedIds.includes(lvl.id);
    const unlocked = isLevelUnlocked(lvl, completedIds);
    return Object.assign({}, lvl, {
      recipeName: recipe ? recipe.name : '',
      recipeEmoji: recipe ? recipe.emoji : '🍰',
      recipeIconImg: recipe ? recipe.iconImg : '',
      shopReward: recipe ? recipe.shopReward : '',
      npcName: npc.name,
      npcAvatar: npc.avatar,
      bestRank: (progress.levelRanks && progress.levelRanks[lvl.id]) || '',
      bestScore: (progress.levelScores && progress.levelScores[lvl.id]) || 0,
      completed,
      unlocked
    });
  });

  const nextMainLevel = enrichedLevels.find(
    l => l.chapterType === 'main' && l.unlocked && !l.completed
  ) || enrichedLevels.find(l => l.chapterType === 'main' && !l.completed) || null;

  const unlockedFacilities = enrichedLevels
    .filter(l => l.completed && l.shopReward)
    .map(l => ({
      id: l.recipeId,
      name: l.shopReward,
      emoji: l.recipeEmoji,
      iconImg: l.recipeIconImg
    }));

  const season1Finished = completedIds.includes('main_6');
  const bonuses = computeShopBonuses(progress.purchasedUpgradeIds);

  return {
    progress,
    totalCount,
    completedCount,
    percent,
    levels: enrichedLevels,
    nextMainLevel,
    unlockedFacilities,
    season1Finished,
    coins: progress.coins,
    reputation: progress.reputation,
    day: progress.day,
    shopTierTitle: getShopTierTitle(progress.reputation),
    bonuses
  };
}
