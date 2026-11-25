// data/levels.js
// 第一卷（风铃湾篇）主线 6 关 + 支线 5 关 关卡与 RPG 多表情剧情配置

const LEVELS = [
  {
    id: 'main_1',
    order: 1,
    chapterType: 'main',
    title: '序章 · 重启星月糖屋',
    location: '星月糖屋',
    bgImage: 'assets/images/shop_facade.jpg',
    npcId: 'madeleine',
    recipeId: 'madeleine',
    minigameType: 'oven_warmup',
    minigameTitle: '烤炉唤醒与温控',
    targetDesc: '将老烤炉预热至黄金烘焙区间并烤出第一盘玛德琳',
    prerequisiteIds: [],
    introDialogue: [
      { speaker: 'madeleine', emotion: 'normal', text: '推开这扇门，灰尘比记忆还厚吧？可可，你真的决定在风铃美食节前重开这家店吗？' },
      { speaker: 'coco', emotion: 'happy', text: '嗯！婆婆，我想让风铃湾的街坊们重新闻到刚出炉的黄油和柠檬香！' },
      { speaker: 'madeleine', emotion: 'happy', text: '好，那先把这台老烤炉唤醒吧——用这把刻着星月徽记的贝壳烤盘，做第一份玛德琳。' }
    ],
    outroDialogue: [
      { speaker: 'madeleine', emotion: 'happy', text: '金黄鼓起的“小肚子”，还有淡淡的焦化黄油香……像极了二十年前的那个清晨。' },
      { speaker: 'coco', emotion: 'happy', text: '太好了！接下来我得去风铃湾地图上拜访各位供应商伙伴，把菜单和设备慢慢补齐！' }
    ]
  },
  {
    id: 'side_1',
    order: 2,
    chapterType: 'side',
    title: '果园的彩色协奏',
    location: '阳光梯田果园',
    bgImage: 'assets/images/town_map_bg.jpg',
    npcId: 'lillian',
    recipeId: 'macaron',
    minigameType: 'orbit_match',
    minigameTitle: '果园马卡龙 · 鲜果接盘收集',
    targetDesc: '左右移动礼盒接住鲜果马卡龙、躲开烤裂壳（≥4份且≥320分过关，8份满额冲A/S）',
    prerequisiteIds: ['main_1'],
    introDialogue: [
      { speaker: 'lillian', emotion: 'surprised', text: '可可！你来得太及时了，今年梯田的树莓、开心果和柠檬大丰收，可我正愁找不到好搭档呢！' },
      { speaker: 'coco', emotion: 'happy', text: '不如用它们做夹心，搭配酥脆的杏仁蛋白饼，做成五颜六色的法式马卡龙吧！' }
    ],
    outroDialogue: [
      { speaker: 'lillian', emotion: 'happy', text: '哇！每一颗都有漂亮的蕾丝裙边！果园今后就是星月糖屋的专属鲜果供应站啦！' }
    ]
  },
  {
    id: 'side_2',
    order: 3,
    chapterType: 'side',
    title: '蜂蜡与铜模的约定',
    location: '红砖铁匠铺',
    bgImage: 'assets/images/town_map_bg.jpg',
    npcId: 'gregory',
    recipeId: 'canele',
    minigameType: 'rhythm_bake',
    minigameTitle: '节拍刷蜡与出炉控温',
    targetDesc: '按节拍涂抹蜂蜡并精准把握焦糖脆壳出炉时机',
    prerequisiteIds: ['main_1'],
    introDialogue: [
      { speaker: 'gregory', emotion: 'serious', text: '哼，现在的年轻人只想用廉价不粘锅图省事，谁还愿意伺候娇贵的波尔多铜模？' },
      { speaker: 'coco', emotion: 'serious', text: '格雷戈里师傅，我想做出真正外脆内软的“天使之铃”，请教我手工刷蜂蜡和控温吧！' }
    ],
    outroDialogue: [
      { speaker: 'gregory', emotion: 'happy', text: '焦糖壳脆得像琥珀，里面却软得像布丁……不错，这组手工铜模归你了！' }
    ]
  },
  {
    id: 'main_2',
    order: 4,
    chapterType: 'main',
    title: '街坊开放日 · 意外的焦糖',
    location: '星月糖屋',
    bgImage: 'assets/images/shop_facade.jpg',
    npcId: 'madeleine',
    recipeId: 'tarte_tatin',
    minigameType: 'pan_flip',
    minigameTitle: '多锅焦糖时间管理',
    targetDesc: '熬制焦糖苹果并在糊锅前完成翻转烤制',
    prerequisiteIds: ['main_1'],
    introDialogue: [
      { speaker: 'coco', emotion: 'surprised', text: '镇公所要求三天内办一场街坊试吃会才能通过开业复核……糟糕，第一批派皮底烤糊了！' },
      { speaker: 'madeleine', emotion: 'normal', text: '别慌，苹果在锅里已经裹满焦糖了。还记得十九世纪塔坦姐妹是怎么“将错就错”的吗？' }
    ],
    outroDialogue: [
      { speaker: 'coco', emotion: 'happy', text: '把派皮盖在焦糖苹果上烤好再倒扣——街坊们居然全都抢着要第二块，开业复核顺利通过！' }
    ]
  },
  {
    id: 'side_3',
    order: 5,
    chapterType: 'side',
    title: '牧场与旧港的和解',
    location: '晨露牧场 × 旧港货栈',
    bgImage: 'assets/images/town_map_bg.jpg',
    npcId: 'bart',
    recipeId: 'tiramisu',
    minigameType: 'layer_merge',
    minigameTitle: '风味层叠合成',
    targetDesc: '将手指饼干、浓缩咖啡与马斯卡彭芝士层层融合',
    prerequisiteIds: ['main_2'],
    introDialogue: [
      { speaker: 'bart', emotion: 'serious', text: '听着卡斯帕，甜点里的奶酪香才是灵魂！没有我的马斯卡彭，咖啡只是苦水！' },
      { speaker: 'casper', emotion: 'serious', text: '胡说！没有现磨意式浓缩和可可粉，甜点只会腻得让人发困！' },
      { speaker: 'coco', emotion: 'happy', text: '两位别吵了，如果把它们一层一层叠在一起呢？' }
    ],
    outroDialogue: [
      { speaker: 'casper', emotion: 'surprised', text: '苦与甜、醇厚与清醒居然在舌尖同时炸开……巴特，算你赢了一半！' },
      { speaker: 'bart', emotion: 'happy', text: '哈哈！以后星月糖屋的鲜奶酪和咖啡豆，我们两家一起包了！' }
    ]
  },
  {
    id: 'main_3',
    order: 6,
    chapterType: 'main',
    title: '试营业 · 毒舌作家的挑刺',
    location: '星月糖屋',
    bgImage: 'assets/images/shop_facade.jpg',
    npcId: 'theo',
    recipeId: 'mille_feuille',
    minigameType: 'stack_balance',
    minigameTitle: '酥皮精准堆叠',
    targetDesc: '在酥皮受潮前完成三层酥皮与卡仕达酱的黄金堆叠',
    prerequisiteIds: ['main_2'],
    introDialogue: [
      { speaker: 'theo', emotion: 'serious', text: '星月糖屋？我见过太多打着“复古情怀”旗号却卖着受潮点心的店了。给我来一份最考验酥皮功夫的千层酥。' },
      { speaker: 'coco', emotion: 'serious', text: '现点现挤、绝不隔夜——请接招吧，西奥多先生！' }
    ],
    outroDialogue: [
      { speaker: 'theo', emotion: 'surprised', text: '……刀尖落下去居然有清脆的“咔嚓”声，卡仕达酱香草籽也毫不吝啬。明天《风铃湾周报》见。' }
    ]
  },
  {
    id: 'side_4',
    order: 7,
    chapterType: 'side',
    title: '瓷盘上的阿尔卑斯',
    location: '月光瓷艺坊',
    bgImage: 'assets/images/town_map_bg.jpg',
    npcId: 'emily',
    recipeId: 'mont_blanc',
    minigameType: 'spiral_draw',
    minigameTitle: '蒙布朗 · 三轨节拍裱花',
    targetDesc: '音符落入底部瓷环时按 1/2/3 或点击轨道挤出栗子泥丝带（≥5拍过关）',
    prerequisiteIds: ['main_3'],
    introDialogue: [
      { speaker: 'emily', emotion: 'normal', text: '可可你看，我烧制了一整套“秋日银杏骨瓷盘”，却一直找不到能撑起它留白构图的甜点。' },
      { speaker: 'coco', emotion: 'happy', text: '秋天的话，不如堆一座覆盖着栗子泥与糖粉白雪的“蒙布朗”吧！' }
    ],
    outroDialogue: [
      { speaker: 'emily', emotion: 'happy', text: '太美了……就像真的把雪峰端上了瓷盘。这批骨瓷餐具和丝带礼盒，全留给星月糖屋！' }
    ]
  },
  {
    id: 'main_4',
    order: 8,
    chapterType: 'main',
    title: '暴雨夜的断供危机',
    location: '星月糖屋',
    bgImage: 'assets/images/shop_facade.jpg',
    npcId: 'bart',
    recipeId: 'basque_cheesecake',
    minigameType: 'whisk_dash',
    minigameTitle: '230°C 巴斯克高温出炉',
    targetDesc: '盯紧三烤位焦糖火候，金色区点击出炉（B级过关：≥3份、≥240分且焦糊<4；A级：满6份、≥432分且焦糊≤1；S级：满6份、≥540分且0焦糊）',
    prerequisiteIds: ['main_3'],
    introDialogue: [
      { speaker: 'coco', emotion: 'surprised', text: '暴风雨封锁了旧港，进口香草和可可全数延误……可今晚还有客人预约！' },
      { speaker: 'bart', emotion: 'happy', text: '别急丫头，我冒雨送来了最新鲜的牧场奶酪和鸡蛋，不用装饰，就做最纯粹的巴斯克吧！' }
    ],
    outroDialogue: [
      { speaker: 'coco', emotion: 'happy', text: '焦黑的外表下居然是这么温柔的流心……原来只要食材足够真诚，风雨夜也能发光。' }
    ]
  },
  {
    id: 'side_5',
    order: 9,
    chapterType: 'side',
    title: '远洋商船的可可秘方',
    location: '旧港香料货栈',
    bgImage: 'assets/images/town_map_bg.jpg',
    npcId: 'casper',
    recipeId: 'sachertorte',
    minigameType: 'balance_scale',
    minigameTitle: '萨赫蛋糕 · 黑巧杏子严选收集',
    targetDesc: '左右移动托盘接住黑可可与鲜杏子、躲开粗盐块（≥4份且≥320分过关，8份满额）',
    prerequisiteIds: ['main_4'],
    introDialogue: [
      { speaker: 'casper', emotion: 'happy', text: '天晴了！远洋商船带来了顶级黑可可豆。听说维也纳人喜欢用杏子果酱来解腻，你敢试试吗？' },
      { speaker: 'madeleine', emotion: 'normal', text: '（低声）维也纳的萨赫蛋糕啊……真是让人怀念的味道。' }
    ],
    outroDialogue: [
      { speaker: 'casper', emotion: 'happy', text: '镜面黑巧亮得能照出人影！可可，你和玛德琳婆婆一样，都有一双能听懂食材声音的手。' }
    ]
  },
  {
    id: 'main_5',
    order: 10,
    chapterType: 'main',
    title: '手工与流水线的对决',
    location: '星月糖屋门口',
    bgImage: 'assets/images/shop_facade.jpg',
    npcId: 'silver_spoon',
    recipeId: 'opera',
    minigameType: 'memory_layers',
    minigameTitle: '歌剧院 · 七层手工精准叠层',
    targetDesc: '对准动态虚线落点，依次叠好 7 层咖啡海绵与黑巧甘纳许（叠完且生命>0过关）',
    prerequisiteIds: ['main_4'],
    introDialogue: [
      { speaker: 'silver_spoon', emotion: 'serious', text: '我们“银匙机械烘焙”每天能产出三千块标准蛋糕。你们这种小作坊，拿什么和效率竞争？' },
      { speaker: 'coco', emotion: 'serious', text: '就用这道需要七层手工浸润、每一口都有温度变化的歌剧院蛋糕！' }
    ],
    outroDialogue: [
      { speaker: 'silver_spoon', emotion: 'surprised', text: '哼……算你们在风铃湾赢了一局。但下个月的“王都味觉标准大赛”，我们不会再手下留情。' }
    ]
  },
  {
    id: 'main_6',
    order: 11,
    chapterType: 'main',
    title: '第一卷终章 · 百年风铃美食节',
    location: '风铃湾中心广场',
    bgImage: 'assets/images/shop_facade.jpg',
    npcId: 'theo',
    recipeId: 'saint_honore',
    minigameType: 'festival_relay',
    minigameTitle: '美食节 · 圣奥诺雷泡芙塔堆叠',
    targetDesc: '对准动态虚线稳稳叠起 6 层焦糖泡芙塔，迎战百年美食节大典！',
    prerequisiteIds: ['main_5'],
    introDialogue: [
      { speaker: 'lillian', emotion: 'happy', text: '可可！清晨现摘的浆果和香草荚送到了！' },
      { speaker: 'bart', emotion: 'happy', text: '刚打发好的鲜奶油、刚出炉的铜模烤盘，大家全在台下为你加油呢！' },
      { speaker: 'coco', emotion: 'happy', text: '谢谢大家！星月糖屋的压轴之作——献给烘焙师守护神的“圣奥诺雷泡芙塔”，现在开始！' }
    ],
    outroDialogue: [
      { speaker: 'theo', emotion: 'happy', text: '（合上笔记本微笑）“风铃湾失去的不是一家老店，而是一段甜蜜的时光；今天，它回来了。”恭喜你，可可店长！' },
      { speaker: 'madeleine', emotion: 'surprised', text: '……等等，柜台角上是谁留下的“银色铃兰胸针”和半张《皇家甜点手账》？看来，我们的故事才刚刚走出风铃湾呢。' }
    ]
  }
];

export {
  LEVELS
};
