// src/data/drinks.js
// 星月糖屋饮品菜单与专属获取剧情（现点现萃、零备货积压风险、与甜点组成下午茶套餐触发高额小费）

export const DRINKS = [
  {
    id: 'sea_latte',
    name: '海风手冲拿铁',
    shortName: '海风拿铁',
    englishName: 'Sea Breeze Café Latte',
    emoji: '☕',
    iconImg: 'assets/images/drinks/drink_sea_latte.png',
    basePrice: 26,
    unitCost: 8,
    brewTicks: 24,
    comboTipBonus: 8,
    storyTitle: '饮品物语 · 第一杯海风拿铁',
    storyLocation: '星月糖屋 · 吧台角落',
    storyNpcId: 'theo',
    storyBg: 'assets/images/jobs/job_cafe_bg.jpg',
    storyDesc: '中浅烘风铃湾海风拼配豆，融入绵密焦糖奶泡，是搭配玛德琳与苹果塔的绝佳下午茶起点。',
    unlockDesc: '开店即解锁（可随时重温配方剧情）',
    canTriggerStory: () => true,
    isUnlocked: (progress) => !progress || !Array.isArray(progress.unlockedDrinkIds) || progress.unlockedDrinkIds.includes('sea_latte'),
    storyDialogue: [
      { speaker: 'theo', emotion: 'normal', text: '可可，光靠甜点撑起下午茶还少了半壁江山——客人们吃一口焦糖黄油，总会下意识寻找一杯微苦回甘的热咖啡。' },
      { speaker: 'coco', emotion: 'surprised', text: '西奥多先生！您手里这罐带着淡淡海盐焦糖香气的咖啡豆，难道是南岸烘焙工坊的私藏拼配吗？' },
      { speaker: 'theo', emotion: 'happy', text: '眼光不错。这份【海风手冲拿铁】的萃取比例留给你——饮品现点现萃不用提前囤货，和甜点凑成下午茶套餐，客人们会慷慨给出额外小费。' },
      { speaker: 'coco', emotion: 'happy', text: '太棒啦！我马上把【海风手冲拿铁】写进星月糖屋的饮品单，给每一位客人奉上暖呼呼的下午茶！' }
    ]
  },
  {
    id: 'matcha_au_lait',
    name: '宇治抹茶欧蕾',
    shortName: '抹茶欧蕾',
    englishName: 'Uji Matcha au Lait',
    emoji: '🍵',
    iconImg: 'assets/images/drinks/drink_matcha_au_lait.png',
    basePrice: 32,
    unitCost: 10,
    brewTicks: 26,
    comboTipBonus: 10,
    storyTitle: '饮品物语 · 瓷杯里的春日抹茶',
    storyLocation: '月光瓷艺坊',
    storyNpcId: 'emily',
    storyBg: 'assets/images/shop_facade.jpg',
    storyDesc: '石磨细研的宇治一番茶与温热牧场鲜奶分层交融，茶韵清雅解腻，与奶油千层酥堪称绝配。',
    unlockDesc: '口碑 ≥ 60 ⭐ 或通关 2 关触发剧情解锁',
    canTriggerStory: (progress) => (progress.reputation || 0) >= 60 || (progress.completedLevelIds || []).length >= 2,
    isUnlocked: (progress) => (progress.unlockedDrinkIds || []).includes('matcha_au_lait'),
    storyDialogue: [
      { speaker: 'emily', emotion: 'happy', text: '可可！我刚烧好一批手绘樱花釉面的茶杯，总觉得里面该盛着一抹温柔的翠绿，于是特意托商船带了宇治头采抹茶粉来！' },
      { speaker: 'coco', emotion: 'surprised', text: '哇，打开罐子就有好清新的海苔茶香！如果用热鲜奶打出厚厚的奶泡，再筛上一片抹茶叶拉花……' },
      { speaker: 'emily', emotion: 'normal', text: '微苦的茶香刚好能平衡法式甜点的甜润，连平时怕甜的客人都一定会爱上这套下午茶组合。' },
      { speaker: 'coco', emotion: 'happy', text: '谢谢艾米莉！新饮品【宇治抹茶欧蕾】研发成功，我现在就把它加入今日饮品单！' }
    ]
  },
  {
    id: 'rose_berry_fizz',
    name: '玫瑰树莓气泡饮',
    shortName: '玫瑰气泡',
    englishName: 'Rose & Raspberry Fizz',
    emoji: '🍓',
    iconImg: 'assets/images/drinks/drink_rose_berry_fizz.png',
    basePrice: 36,
    unitCost: 11,
    brewTicks: 22,
    comboTipBonus: 12,
    storyTitle: '饮品物语 · 阳光梯田的粉红气泡',
    storyLocation: '阳光梯田果园',
    storyNpcId: 'lillian',
    storyBg: 'assets/images/jobs/job_florist_bg.jpg',
    storyDesc: '晨摘红树莓熬成鲜果露，冲入冰爽气泡水并点缀可食用玫瑰花瓣，出杯极快、酸甜沁心。',
    unlockDesc: '口碑 ≥ 140 ⭐ 或通关 4 关触发剧情解锁',
    canTriggerStory: (progress) => (progress.reputation || 0) >= 140 || (progress.completedLevelIds || []).length >= 4,
    isUnlocked: (progress) => (progress.unlockedDrinkIds || []).includes('rose_berry_fizz'),
    storyDialogue: [
      { speaker: 'lillian', emotion: 'happy', text: '可可快尝尝！梯田今年新收的红树莓甜度爆表，我还摘了带露水的可食用玫瑰花瓣，熬成了亮晶晶的红宝石果露！' },
      { speaker: 'coco', emotion: 'happy', text: '咕嘟咕嘟倒进冰镇气泡水里，粉红渐变像把风铃湾的晚霞装进了水晶杯！而且制作只要 2.2 秒，超适合高峰期出杯！' },
      { speaker: 'lillian', emotion: 'surprised', text: '真的吗？那以后只要店里人气旺起来，果园的树莓和薄荷叶我天天清晨第一个给你送来！' },
      { speaker: 'coco', emotion: 'happy', text: '一言为定！【玫瑰树莓气泡饮】正式收录进星月糖屋饮品单！' }
    ]
  },
  {
    id: 'velvet_cocoa',
    name: '法式热可可棉花糖',
    shortName: '热可可',
    englishName: 'Velvet French Hot Cocoa',
    emoji: '🍫',
    iconImg: 'assets/images/drinks/drink_velvet_cocoa.png',
    basePrice: 42,
    unitCost: 13,
    brewTicks: 28,
    comboTipBonus: 15,
    storyTitle: '饮品物语 · 远洋航线的丝绒热可可',
    storyLocation: '旧港香料货栈',
    storyNpcId: 'casper',
    storyBg: 'assets/images/jobs/job_harbor_bg.jpg',
    storyDesc: '70% 单一产地黑巧慢融于鲜奶油，顶层点缀微烤焦香棉花糖与锡兰肉桂棒，套餐小费全场最高。',
    unlockDesc: '购入黄铜咖啡机或口碑 ≥ 240 ⭐ 触发剧情解锁',
    canTriggerStory: (progress) => (progress.purchasedUpgradeIds || []).includes('brass_espresso') || (progress.reputation || 0) >= 240,
    isUnlocked: (progress) => (progress.unlockedDrinkIds || []).includes('velvet_cocoa'),
    storyDialogue: [
      { speaker: 'casper', emotion: 'serious', text: '可可，真正的巴黎老牌沙龙热可可，从来不用可可粉冲泡——必须把整块 70% 单源黑巧融进热鲜奶与淡奶油里。' },
      { speaker: 'coco', emotion: 'serious', text: '还要在出杯前用喷枪把手工棉花糖表面烤出一层微焦糖壳，再插上一根锡兰肉桂棒提香！' },
      { speaker: 'casper', emotion: 'happy', text: '哈哈哈，不愧是玛德琳婆婆看中的继承人！这批珍藏黑巧豆和肉桂棒交给你，一定能卖出风铃湾最高的下午茶小费！' },
      { speaker: 'coco', emotion: 'happy', text: '太感谢卡斯帕先生了！压轴特调【法式热可可棉花糖】正式解锁上架！' }
    ]
  }
];

export function getDrinkById(id) {
  return DRINKS.find(d => d.id === id) || null;
}

export function getUnlockedDrinks(progress) {
  return DRINKS.filter(d => d.isUnlocked(progress || {}));
}
