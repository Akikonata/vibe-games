// data/kitchen_recipes.js
// 经营模式（轻度胡闹厨房）每道甜点的真实制作动线与基础售价

const KITCHEN_FLOWS = {
  madeleine: {
    steps: ['oven'],
    basePrice: 36,
    flowText: '原料 → 烤炉'
  },
  tarte_tatin: {
    steps: ['oven'],
    basePrice: 52,
    flowText: '原料 → 烤炉'
  },
  canele: {
    steps: ['oven'],
    basePrice: 46,
    flowText: '原料 → 烤炉'
  },
  basque_cheesecake: {
    steps: ['oven'],
    basePrice: 58,
    flowText: '原料 → 烤炉'
  },
  macaron: {
    steps: ['oven', 'cream'],
    basePrice: 54,
    flowText: '原料 → 烤炉 → 裱花'
  },
  tiramisu: {
    steps: ['cream', 'decor'],
    basePrice: 56,
    flowText: '原料 → 裱花 → 筛粉'
  },
  mille_feuille: {
    steps: ['oven', 'cream'],
    basePrice: 64,
    flowText: '原料 → 烤炉 → 裱花'
  },
  mont_blanc: {
    steps: ['cream', 'decor'],
    basePrice: 68,
    flowText: '原料 → 裱花 → 糖粉'
  },
  sachertorte: {
    steps: ['oven', 'decor'],
    basePrice: 70,
    flowText: '原料 → 烤炉 → 淋面'
  },
  opera: {
    steps: ['oven', 'cream', 'decor'],
    basePrice: 82,
    flowText: '原料 → 烤炉 → 裱花 → 金箔'
  },
  saint_honore: {
    steps: ['oven', 'cream', 'decor'],
    basePrice: 96,
    flowText: '原料 → 烤炉 → 裱花 → 封顶'
  }
};

const STATION_META = {
  oven: { id: 'oven', name: '红砖烤炉', verb: '烘烤', duration: 24, burnTicks: 95 },
  cream: { id: 'cream', name: '裱花台', verb: '裱花', duration: 14, burnTicks: 999 },
  decor: { id: 'decor', name: '糖粉装饰台', verb: '装饰', duration: 12, burnTicks: 999 }
};

function getKitchenFlow(recipeId) {
  return KITCHEN_FLOWS[recipeId] || KITCHEN_FLOWS.madeleine;
}

export {
  KITCHEN_FLOWS,
  STATION_META,
  getKitchenFlow
};
