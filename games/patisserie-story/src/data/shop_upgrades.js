// data/shop_upgrades.js
// 星月糖屋经营装潢与设备升级目录

const SHOP_UPGRADES = [
  {
    id: 'oak_counter',
    name: '法式橡木玻璃展示柜',
    icon: '🪵',
    cost: 160,
    effectDesc: '所有甜点基础售价 +20%，购买立得 +25 口碑',
    priceBonus: 0.2,
    tipBonus: 0,
    patienceBonus: 0,
    repBonus: 0
  },
  {
    id: 'herb_boxes',
    name: '窗台迷迭香与常春藤花箱',
    icon: '🌿',
    cost: 240,
    effectDesc: '店内花香舒缓，顾客等待耐心 +25%，购买立得 +25 口碑',
    priceBonus: 0,
    tipBonus: 0,
    patienceBonus: 0.25,
    repBonus: 0
  },
  {
    id: 'brass_espresso',
    name: '复古黄铜浓缩咖啡机',
    icon: '☕',
    cost: 340,
    effectDesc: '搭配手冲咖啡，每单额外小费 +15 金币，购买立得 +25 口碑',
    priceBonus: 0,
    tipBonus: 15,
    patienceBonus: 0,
    repBonus: 0
  },
  {
    id: 'crystal_lamp',
    name: '暖光复古铜艺吊灯',
    icon: '🕯️',
    cost: 460,
    effectDesc: '氛围拉满，营业口碑获取 +30%，购买立得 +25 口碑',
    priceBonus: 0,
    tipBonus: 0,
    patienceBonus: 0,
    repBonus: 0.3
  },
  {
    id: 'porcelain_gift',
    name: '月光骨瓷伴手礼盒',
    icon: '🎁',
    cost: 620,
    effectDesc: '精致包装溢价，所有甜点售价再 +35%，购买立得 +25 口碑',
    priceBonus: 0.35,
    tipBonus: 0,
    patienceBonus: 0,
    repBonus: 0
  }
];

function computeShopBonuses(purchasedIds = []) {
  const result = {
    priceMult: 1,
    tipBonus: 0,
    patienceMult: 1,
    repMult: 1
  };
  SHOP_UPGRADES.forEach(u => {
    if (purchasedIds.includes(u.id)) {
      result.priceMult += u.priceBonus;
      result.tipBonus += u.tipBonus;
      result.patienceMult += u.patienceBonus;
      result.repMult += u.repBonus;
    }
  });
  return result;
}

SHOP_UPGRADES.forEach(u => {
  u.iconImg = `assets/images/upgrades/${u.id}.svg`;
});

export {
  SHOP_UPGRADES,
  computeShopBonuses
};
