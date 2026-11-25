// data/recipes.js
// 第一卷 11 道经典甜点食谱图鉴（含玩法映射、历史发展与文化背景）

const RECIPES = [
  {
    id: 'madeleine',
    name: '玛德琳蛋糕',
    englishName: 'Madeleine',
    emoji: '🐚',
    chapterType: 'main',
    origin: '法国 · 洛林',
    minigameType: 'oven_warmup',
    minigameLabel: '烤炉唤醒与温控',
    shopReward: '基础烘焙台启用',
    tagline: '唤醒童年记忆的贝壳小蛋糕',
    history: '相传 18 世纪，流亡法国洛林的前波兰国王斯坦尼斯瓦夫举行宴会时甜点师突然罢工。女仆玛德琳·波米耶临危受命，用祖母传下的扇形贝壳模具烤出这款柠檬香气的小蛋糕，惊艳全场，国王便以她的名字命名。',
    culture: '法国文豪普鲁斯特在《追忆似水年华》中写到，主人公将玛德琳蛋糕浸入椴花茶中，瞬间被唤醒整个童年的记忆——这便是著名的“普鲁斯特效应”（味觉与气味触发深层记忆）。'
  },
  {
    id: 'macaron',
    name: '法式马卡龙',
    englishName: 'Macaron',
    emoji: '🩷',
    chapterType: 'side',
    origin: '意大利 → 法国巴黎',
    minigameType: 'orbit_match',
    minigameLabel: '果园马卡龙 · 鲜果接盘收集',
    shopReward: '马卡龙彩虹展示柜',
    tagline: '外酥内软的“少女的酥胸”',
    history: '祖先是 8 世纪阿拉伯地区的杏仁甜点。1533 年凯瑟琳·德·美第奇嫁给法国国王亨利二世时，将意大利御用甜点师带入法国宫廷，单层杏仁蛋白饼（Maccherone）由此落地。19 世纪末，巴黎拉杜丽（Ladurée）糕点师用甘纳许奶油将两片饼干夹心，诞生了现代双层马卡龙。',
    culture: '法国大革命期间，南锡的两名修女靠售卖杏仁蛋白饼维持生计，被称为“马卡龙姐妹”。如今它以缤纷色彩与精致蕾丝“裙边”成为法式甜点的浪漫名片。'
  },
  {
    id: 'canele',
    name: '波尔多可露丽',
    englishName: 'Canelé de Bordeaux',
    emoji: '🔔',
    chapterType: 'side',
    origin: '法国 · 波尔多',
    minigameType: 'rhythm_bake',
    minigameLabel: '节拍刷蜡与出炉控温',
    shopReward: '手工波尔多铜模组',
    tagline: '焦糖脆壳包裹布丁内芯的“天使之铃”',
    history: '16 至 18 世纪，波尔多酒庄习惯用大量蛋白澄清红酒中的杂质，留下了海量蛋黄。当地圣母领报修道院的修女们收集这些蛋黄，加入牛奶、香草与码头运来的朗姆酒，倒入涂满蜂蜡的凹槽铜模中烘烤，分给城里的穷人。',
    culture: '因外型酷似教堂小钟铃，外皮焦脆如琥珀、内里柔软似香草布丁，被誉为波尔多的“天使之铃”，也是检验铜模导热与火候掌控的经典名点。'
  },
  {
    id: 'tiramisu',
    name: '意式提拉米苏',
    englishName: 'Tiramisù',
    emoji: '☕',
    chapterType: 'side',
    origin: '意大利 · 威尼托',
    minigameType: 'layer_merge',
    minigameLabel: '风味层叠合成',
    shopReward: '意式手冲咖啡吧台',
    tagline: '浓缩咖啡与马斯卡彭的“带我走”',
    history: '现代提拉米苏最公认的起源是 20 世纪 60 年代末，由意大利威尼托大区特雷维索市“Le Beccherie”餐厅的糕点师罗伯托·林瓜诺托创制。',
    culture: '在意大利语中，Tiramisù 意为“带我走（Pick me up）”，既指咖啡因与可可带来的提神能量，也流传着二战时期妻子为出征丈夫打包思念与能量的浪漫故事。'
  },
  {
    id: 'tarte_tatin',
    name: '翻转苹果塔',
    englishName: 'Tarte Tatin',
    emoji: '🍎',
    chapterType: 'main',
    origin: '法国 · 卢瓦尔河谷',
    minigameType: 'pan_flip',
    minigameLabel: '多锅焦糖时间管理',
    shopReward: '街坊口碑认证牌',
    tagline: '厨房失误中诞生的焦糖奇迹',
    history: '19 世纪 80 年代，法国卢瓦尔河谷的塔坦姐妹经营着一家小旅馆。忙乱中姐姐忘了先铺派皮，直接把裹满黄油和糖的苹果放进锅里焦糖化，只好把派皮盖在上面烤熟再倒扣装盘。',
    culture: '这道源自“美丽意外”的甜点因焦糖香气极其浓郁而名震巴黎，连著名的马克西姆餐厅都将其列为招牌，象征着烘焙师在危机中的灵感与应变。'
  },
  {
    id: 'mille_feuille',
    name: '法式千层酥',
    englishName: 'Mille-feuille',
    emoji: '🥐',
    chapterType: 'main',
    origin: '法国 · 巴黎',
    minigameType: 'stack_balance',
    minigameLabel: '酥皮精准堆叠',
    shopReward: '堂食临窗雅座',
    tagline: '729 层酥脆交响的“一千片叶子”',
    history: '法语 Mille-feuille 直译为“一千片叶子”。1651 年法国名厨拉·瓦雷讷在《法国厨师》中首次记载了它，后经 19 世纪“厨师之王”卡莱姆改良，以三折法反复擀压出数百层酥皮。',
    culture: '在中文和英语世界它常被称为“拿破仑”，其实与拿破仑本人无关，而是源于意大利那不勒斯式糕点（Napolitain）的拼写音译巧合。'
  },
  {
    id: 'mont_blanc',
    name: '蒙布朗',
    englishName: 'Mont Blanc',
    emoji: '🏔️',
    chapterType: 'side',
    origin: '意大利皮埃蒙特 / 法国萨瓦',
    minigameType: 'spiral_draw',
    minigameLabel: '蒙布朗 · 三轨节拍裱花',
    shopReward: '手绘骨瓷餐具与礼盒',
    tagline: '盘中的阿尔卑斯雪峰',
    history: '早在 15 世纪，盛产栗子的阿尔卑斯山区就流行将栗子泥做成山峰形状。1903 年，巴黎安吉丽娜（Angelina）茶室将其定型为蛋白霜底座、鲜奶油内芯、细丝栗子泥外衣与糖粉雪顶的经典模样。',
    culture: '名称直接取自阿尔卑斯山最高峰“勃朗峰（Mont Blanc）”，褐色栗子泥象征山脊，白色糖粉象征终年不化的山顶积雪。'
  },
  {
    id: 'basque_cheesecake',
    name: '巴斯克芝士蛋糕',
    englishName: 'Basque Burnt Cheesecake',
    emoji: '🧀',
    chapterType: 'main',
    origin: '西班牙 · 圣塞巴斯蒂安',
    minigameType: 'whisk_dash',
    minigameLabel: '230°C 巴斯克高温出炉',
    shopReward: '本地牧场直供铭牌',
    tagline: '不完美却最治愈的焦香流心',
    history: '1990 年，西班牙北部巴斯克地区圣塞巴斯蒂安的 La Viña 酒吧主厨圣地亚哥·里韦拉，为了做出“无需饼干底却风味极致”的甜点，大胆采用超高温短时烘烤，烤出深褐色焦糖外皮。',
    culture: '它彻底打破了传统芝士蛋糕追求“洁白无瑕、不开裂”的教条，以外焦里嫩、中心如布丁般绵密流心的反差感治愈了无数食客。'
  },
  {
    id: 'sachertorte',
    name: '维也纳萨赫蛋糕',
    englishName: 'Sachertorte',
    emoji: '🍫',
    chapterType: 'side',
    origin: '奥地利 · 维也纳',
    minigameType: 'balance_scale',
    minigameLabel: '萨赫蛋糕 · 黑巧杏子严选收集',
    shopReward: '古典巧克力镜面台',
    tagline: '16 岁学徒临危受命的国宝传奇',
    history: '1832 年，奥地利首相梅特涅要求厨房为贵宾准备一道全新甜点，主厨却恰巧病倒。年仅 16 岁的二年级学徒弗朗茨·萨赫临危受命，创作出这款巧克力海绵蛋糕配杏子果酱与黑巧淋面的名点。',
    culture: '微酸的杏子果酱完美中和了黑巧克力的厚重，使它成为奥地利维也纳咖啡馆文化中不可替代的“国宝级甜点”。'
  },
  {
    id: 'opera',
    name: '歌剧院蛋糕',
    englishName: 'Gâteau Opéra',
    emoji: '🎭',
    chapterType: 'main',
    origin: '法国 · 巴黎',
    minigameType: 'memory_layers',
    minigameLabel: '歌剧院 · 七层手工精准叠层',
    shopReward: '“手工之魂”金色匾额',
    tagline: '宛如巴黎歌剧院舞台的七层精密艺术',
    history: '1955 年由巴黎著名甜点店 Dalloyau 的糕点师西里亚克·加维永正式定名，其夫人感叹它金箔点缀、层次华丽的外观宛如巴黎加尼叶歌剧院的舞台。',
    culture: '传统歌剧院蛋糕要求浸润咖啡酒糖液的杏仁海绵蛋糕、咖啡奶油霜与黑巧克力甘纳许交替叠放至少 6 至 7 层，总厚度却控制在约 3 厘米，是对抗机械化流水线的手工巅峰。'
  },
  {
    id: 'saint_honore',
    name: '圣奥诺雷泡芙塔',
    englishName: 'Saint-Honoré',
    emoji: '👑',
    chapterType: 'main',
    origin: '法国 · 巴黎',
    minigameType: 'festival_relay',
    minigameLabel: '美食节 · 圣奥诺雷泡芙塔堆叠',
    shopReward: '星月糖屋金徽章盛大开业',
    tagline: '献给烘焙师守护神的皇冠甜点',
    history: '1847 年诞生于巴黎希布斯特（Chiboust）糕点店，以公元 6 世纪亚眠主教、同时也是全法国面包师与糕点师守护神——圣奥诺雷（Saint Honoré）命名，也纪念巴黎著名的圣奥诺雷街。',
    culture: '它将千层酥底、裹着琥珀色焦糖脆壳的小泡芙与轻盈的希布斯特奶油融为一体，象征着法式古典烘焙工艺的集大成者与全镇伙伴的齐心协力。'
  }
];

RECIPES.forEach(item => {
  item.iconImg = `assets/images/desserts/${item.id}.png`;
});

export {
  RECIPES
};
