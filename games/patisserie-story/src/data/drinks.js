// src/data/drinks.js
// 星月糖屋饮品菜单（现点现萃、零备货积压风险、与甜点组成下午茶套餐触发高额小费）

export const DRINKS = [
  {
    id: 'sea_latte',
    name: '海风手冲拿铁',
    shortName: '海风拿铁',
    emoji: '☕',
    iconImg: 'assets/images/drinks/drink_sea_latte.png',
    basePrice: 26,
    unitCost: 8,
    brewTicks: 24, // 2.4s 现萃
    comboTipBonus: 8,
    unlockDesc: '默认解锁',
    isUnlocked: () => true
  },
  {
    id: 'matcha_au_lait',
    name: '宇治抹茶欧蕾',
    shortName: '抹茶欧蕾',
    emoji: '🍵',
    iconImg: 'assets/images/drinks/drink_matcha_au_lait.png',
    basePrice: 32,
    unitCost: 10,
    brewTicks: 26,
    comboTipBonus: 10,
    unlockDesc: '口碑 ≥ 60 ⭐ 或通关 2 关解锁',
    isUnlocked: (progress) => (progress.reputation || 0) >= 60 || (progress.completedLevelIds || []).length >= 2
  },
  {
    id: 'rose_berry_fizz',
    name: '玫瑰树莓气泡饮',
    shortName: '玫瑰气泡',
    emoji: '🍓',
    iconImg: 'assets/images/drinks/drink_rose_berry_fizz.png',
    basePrice: 36,
    unitCost: 11,
    brewTicks: 22,
    comboTipBonus: 12,
    unlockDesc: '口碑 ≥ 140 ⭐ 或通关 4 关解锁',
    isUnlocked: (progress) => (progress.reputation || 0) >= 140 || (progress.completedLevelIds || []).length >= 4
  },
  {
    id: 'velvet_cocoa',
    name: '法式热可可棉花糖',
    shortName: '热可可',
    emoji: '🍫',
    iconImg: 'assets/images/drinks/drink_velvet_cocoa.png',
    basePrice: 42,
    unitCost: 13,
    brewTicks: 28,
    comboTipBonus: 15,
    unlockDesc: '购入黄铜咖啡机或口碑 ≥ 240 ⭐ 解锁',
    isUnlocked: (progress) => (progress.purchasedUpgradeIds || []).includes('brass_espresso') || (progress.reputation || 0) >= 240
  }
];

export function getUnlockedDrinks(progress) {
  return DRINKS.filter(d => d.isUnlocked(progress || {}));
}
