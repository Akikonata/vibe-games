// data/minigame_scenes.js
// 全 11 关场景化烘焙模拟配置（彻底移除粗糙通用图标配对模式）

const CRAFT_SCENES = {
  pan_flip: {
    prefix: 'tatin',
    statusLabel: '翻转苹果塔工序',
    steps: [
      { kind: 'tap', taps: 3, btn: '搅拌融化黄油砂糖', tip: '小火搅拌铜锅里的黄油与砂糖，熬出浅金糖浆' },
      { kind: 'tap', taps: 3, btn: '绕圈码放红苹果瓣', tip: '把切好的新鲜红苹果瓣紧密码入焦糖锅底' },
      {
        kind: 'rise_timing',
        sweetMin: 54,
        sweetMax: 84,
        labels: ['浅金糖浆', '琥珀收汁区', '小心糊锅!'],
        btn: '趁热盖上千层酥皮！',
        tip: '中火焦糖收汁中！进入【琥珀收汁区】且糊锅前盖上酥皮！',
        earlyTip: '糖浆还不够浓稠，再熬一会儿等进入【琥珀收汁区】！',
        burnTip: '冒焦烟啦！调小火重新收汁，看准【琥珀收汁区】！'
      },
      { kind: 'flip', btn: '一键倒扣翻转出盘！', tip: '酥皮已烤至金黄！扣上复古骨瓷盘，准备灵魂倒扣！' }
    ],
    doneTip: '琥珀焦糖苹果塔闪亮出盘，香气弥漫星月糖屋！'
  },

  orbit_match: {
    prefix: 'macaron',
    statusLabel: '马卡龙制作工序',
    steps: [
      { kind: 'tap', taps: 3, btn: '过筛杏仁粉并翻拌', tip: '将杏仁粉与蛋白霜轻柔翻拌至丝带状顺滑光泽' },
      { kind: 'tap', taps: 3, btn: '裱花袋挤出蛋白饼', tip: '在烤盘上挤出大小均匀的树莓、开心果与柠檬蛋白壳' },
      {
        kind: 'osc_timing',
        sweetMin: 36,
        sweetMax: 64,
        labels: ['湿度偏高', '完美裙边区', '烤色过深'],
        btn: '精准烘烤出蕾丝裙边！',
        tip: '指针滑入【完美裙边区】时点击，烤出圆润不开裂的马卡龙壳！',
        missTip: '火候偏了一点，瞄准中央【完美裙边区】再试一次！'
      },
      { kind: 'tap', taps: 2, btn: '挤入鲜果甘纳许夹心', tip: '将两片马卡龙壳夹入树莓与开心果甘纳许装盒！' }
    ],
    doneTip: '缤纷法式彩虹马卡龙礼盒装盒完成！'
  },

  rhythm_bake: {
    prefix: 'canele',
    statusLabel: '波尔多可露丽工序',
    steps: [
      { kind: 'tap', taps: 2, btn: '预热手工波尔多铜模', tip: '先将格雷戈里师傅锻造的凹槽铜模均匀温热' },
      { kind: 'tap', taps: 3, btn: '节拍刷入融化蜂蜡', tip: '顺着铜模凹槽薄薄刷上一层融化的天然蜂蜡与黄油' },
      { kind: 'tap', taps: 2, btn: '注入朗姆香草面糊', tip: '将静置 24 小时的朗姆酒香草蛋黄糊倒入铜模八分满' },
      {
        kind: 'osc_timing',
        sweetMin: 36,
        sweetMax: 64,
        labels: ['表皮偏软', '焦糖脆壳区', '烤焦发苦'],
        btn: '精准出炉脱模！',
        tip: '抓准指针滑入【焦糖脆壳区】的瞬间出炉，成就外脆内软的天使之铃！',
        missTip: '再等等最佳焦糖火候，瞄准【焦糖脆壳区】！'
      }
    ],
    doneTip: '琥珀焦脆、内芯绵密的波尔多可露丽完美脱模！'
  },

  layer_merge: {
    prefix: 'tiramisu',
    statusLabel: '意式提拉米苏工序',
    steps: [
      { kind: 'tap', taps: 3, btn: '手指饼干铺满烤盘', tip: '将酥脆的手指饼干整齐码入玻璃烤盘底层' },
      {
        kind: 'osc_timing',
        sweetMin: 36,
        sweetMax: 64,
        labels: ['浸润不足', '黄金吸液区', '泡得过软'],
        btn: '精准淋入意式浓缩！',
        tip: '在【黄金吸液区】淋入浓缩咖啡液，让饼干香浓而不散架！',
        missTip: '咖啡浸润要刚刚好，瞄准【黄金吸液区】！'
      },
      { kind: 'tap', taps: 3, btn: '厚涂马斯卡彭芝士糊', tip: '把巴特大叔的新鲜马斯卡彭打发至顺滑，层层铺满' },
      { kind: 'tap', taps: 2, btn: '细筛丝绒黑可可粉', tip: '最后在顶面均匀筛上一层醇香法芙娜可可粉！' }
    ],
    doneTip: '苦甜交织、层次分明的意式提拉米苏制作完成！'
  },

  stack_balance: {
    prefix: 'mille',
    statusLabel: '法式千层酥工序',
    steps: [
      { kind: 'tap', taps: 2, btn: '铺放底层焦糖酥皮', tip: '先放上刚出炉、烤出 729 层的焦糖酥脆千层底' },
      { kind: 'tap', taps: 3, btn: '挤满香草卡仕达花球', tip: '现点现挤饱满的马达加斯加香草籽卡仕达奶油' },
      {
        kind: 'osc_timing',
        sweetMin: 36,
        sweetMax: 64,
        labels: ['向左偏斜', '平衡中心区', '向右偏斜'],
        btn: '精准叠放中层酥皮！',
        tip: '趁酥皮未受潮，在【平衡中心区】稳稳叠上第二层与顶层！',
        missTip: '手抖歪了一点，等指针回到【平衡中心区】再落手！'
      },
      { kind: 'tap', taps: 2, btn: '拉出法式羽毛纹糖霜', tip: '用细签在白糖霜与巧克力线上拉出经典法式羽毛纹！' }
    ],
    doneTip: '一刀切下咔嚓作响的 729 层法式千层酥完成！'
  },

  spiral_draw: {
    prefix: 'montblanc',
    statusLabel: '蒙布朗裱花工序',
    steps: [
      { kind: 'tap', taps: 2, btn: '骨瓷盘放蛋白霜底', tip: '在艾米莉手绘的骨瓷盘中央摆好酥脆蛋白霜底座' },
      { kind: 'tap', taps: 2, btn: '挤出云朵鲜奶油山芯', tip: '用鲜奶油筑起轻盈柔和的阿尔卑斯山峰内芯' },
      {
        kind: 'osc_timing',
        sweetMin: 36,
        sweetMax: 64,
        labels: ['力度偏轻', '均匀丝带区', '挤断丝带'],
        btn: '螺旋挤出细密栗子泥！',
        tip: '在【均匀丝带区】点击，绕着山峰挤出不断线的细腻栗子泥！',
        missTip: '力度不稳会断线，瞄准【均匀丝带区】挤出完美丝带！'
      },
      { kind: 'tap', taps: 2, btn: '筛落初雪糖粉与栗子', tip: '撒下皑皑糖粉白雪，山顶缀上一颗光泽糖渍栗子！' }
    ],
    doneTip: '宛如盘中阿尔卑斯雪峰的蒙布朗优雅落成！'
  },

  whisk_dash: {
    prefix: 'basque',
    statusLabel: '巴斯克芝士工序',
    steps: [
      { kind: 'tap', taps: 3, btn: '顺滑打散奶油奶酪', tip: '快速搅拌本地牧场奶油奶酪与鸡蛋，消除全部小颗粒' },
      { kind: 'tap', taps: 2, btn: '倒入皱褶牛皮纸模', tip: '将顺滑的乳酪糊稳稳倒入揉皱的复古烘焙纸模具' },
      {
        kind: 'rise_timing',
        sweetMin: 56,
        sweetMax: 84,
        labels: ['表皮尚浅', '焦香流心区', '烤干过头!'],
        btn: '230°C 精准拉出烤盘！',
        tip: '超高温短时烘烤中！进入【焦香流心区】立刻拉出保持流心！',
        earlyTip: '表面还没焦糖化呢，再烤一下等进入【焦香流心区】！',
        burnTip: '烤得有点太老了，重新掌控 230°C 黄金出炉时机！'
      },
      { kind: 'tap', taps: 1, btn: '静置切开流心乳酪', tip: '焦黑表皮下藏着布丁般温柔的流心，准备上桌！' }
    ],
    doneTip: '外焦里嫩、温柔治愈的巴斯克芝士蛋糕完成！'
  },

  balance_scale: {
    prefix: 'sacher',
    statusLabel: '维也纳萨赫工序',
    steps: [
      { kind: 'tap', taps: 2, btn: '横切浓郁可可蛋糕胚', tip: '将卡斯帕带来的厄瓜多尔可可海绵蛋糕平稳一分为二' },
      {
        kind: 'osc_timing',
        sweetMin: 36,
        sweetMax: 64,
        labels: ['黑巧过苦', '酸甜平衡区', '果酱过甜'],
        btn: '精准涂抹杏子果酱！',
        tip: '指针落入【酸甜平衡区】时涂抹微酸杏子酱，完美化解甜腻！',
        missTip: '苦甜比例差一点点，瞄准【酸甜平衡区】！'
      },
      { kind: 'tap', taps: 3, btn: '浇淋黑巧镜面糖衣', tip: '淋下调温黑巧克力糖衣，静置出能照见人影的镜面光泽' },
      { kind: 'tap', taps: 2, btn: '盖上金色 S 印章', tip: '放上萨赫经典金色巧克力印章，配上一勺无糖鲜奶油！' }
    ],
    doneTip: '奥地利维也纳国宝级名点——萨赫蛋糕华丽登场！'
  },

  memory_layers: {
    prefix: 'opera',
    statusLabel: '歌剧院 7 层工序',
    steps: [
      { kind: 'tap', taps: 2, btn: '刷满咖啡酒糖液', tip: '在薄如蝉翼的杏仁海绵胚上细致刷满浓缩咖啡糖浆' },
      { kind: 'tap', taps: 3, btn: '交替抹平奶油与甘纳许', tip: '手工精准抹平咖啡奶油霜与黑巧克力甘纳许夹层' },
      {
        kind: 'osc_timing',
        sweetMin: 36,
        sweetMax: 64,
        labels: ['厚度偏薄', '3cm 黄金厚区', '厚度偏厚'],
        btn: '精准压平 7 层结构！',
        tip: '传统歌剧院要求 7 层总厚严格约 3 厘米，在【黄金厚区】定型！',
        missTip: '厚度偏差了一点，瞄准【3cm 黄金厚区】压平！'
      },
      { kind: 'tap', taps: 2, btn: '淋镜面黑巧缀金箔', tip: '淋上丝滑黑巧镜面，用镊子轻轻放上璀璨金箔！' }
    ],
    doneTip: '七层工整如乐谱的巴黎歌剧院蛋糕完胜流水线！'
  },

  festival_relay: {
    prefix: 'honore',
    statusLabel: '美食节压轴工序',
    steps: [
      { kind: 'tap', taps: 2, btn: '铺好金黄千层塔底', tip: '汇聚全镇伙伴食材，先铺好酥脆的法式千层酥圆底' },
      { kind: 'tap', taps: 3, btn: '琥珀焦糖泡芙围边', tip: '将裹满琥珀焦糖脆壳的小泡芙一圈圈稳稳粘在塔边' },
      {
        kind: 'osc_timing',
        sweetMin: 36,
        sweetMax: 64,
        labels: ['花纹偏扁', '圣奥诺雷花峰', '奶油偏软'],
        btn: '挤出希布斯特奶油塔！',
        tip: '在【圣奥诺雷花峰】区间挤出层层褶皱如花瓣的轻盈奶油！',
        missTip: '差一点就能挤出皇冠花瓣，瞄准【圣奥诺雷花峰】！'
      },
      { kind: 'tap', taps: 2, btn: '安放顶冠泡芙与金箔', tip: '放上最闪亮的顶冠焦糖泡芙与金箔，迎接美食节欢呼！' }
    ],
    doneTip: '献给烘焙师守护神的圣奥诺雷泡芙塔夺得美食节金徽章！'
  }
};

const STACKER_RECIPES = {
  stack_balance: {
    title: '法式千层酥堆叠',
    baseSpeed: 2.3,
    speedStep: 0.35,
    layers: [
      { name: '底层焦糖千层酥皮', style: 'puff', width: 58 },
      { name: '香草籽卡仕达奶油', style: 'custard', width: 54 },
      { name: '中层焦糖千层酥皮', style: 'puff', width: 56 },
      { name: '双倍香草卡仕达', style: 'custard', width: 52 },
      { name: '法式羽毛纹白糖霜顶', style: 'fondant', width: 56 }
    ]
  },
  layer_merge: {
    title: '意式提拉米苏叠层',
    baseSpeed: 2.1,
    speedStep: 0.3,
    layers: [
      { name: '浓缩咖啡手指饼干', style: 'ladyfinger', width: 60 },
      { name: '丝滑马斯卡彭芝士', style: 'mascarpone', width: 58 },
      { name: '第二层咖啡手指饼干', style: 'ladyfinger', width: 56 },
      { name: '醇厚马斯卡彭乳酪', style: 'mascarpone', width: 56 },
      { name: '法芙娜丝绒可可粉顶', style: 'cocoa', width: 58 }
    ]
  },
  memory_layers: {
    title: '歌剧院 7 层精密堆叠',
    baseSpeed: 2.5,
    speedStep: 0.32,
    layers: [
      { name: '咖啡酒杏仁海绵胚', style: 'sponge', width: 58 },
      { name: '黑巧克力甘纳许', style: 'ganache', width: 56 },
      { name: '杏仁海绵蛋糕胚', style: 'sponge', width: 56 },
      { name: '意式咖啡奶油霜', style: 'coffee_cream', width: 54 },
      { name: '顶层杏仁海绵胚', style: 'sponge', width: 54 },
      { name: '浓醇黑巧甘纳许', style: 'ganache', width: 54 },
      { name: '黑巧镜面与金箔', style: 'gold_glaze', width: 56 }
    ]
  },
  festival_relay: {
    title: '圣奥诺雷泡芙塔堆叠',
    baseSpeed: 2.6,
    speedStep: 0.35,
    layers: [
      { name: '金黄千层酥塔底', style: 'puff', width: 62 },
      { name: '焦糖脆壳小泡芙环', style: 'caramel_puff', width: 56 },
      { name: '希布斯特香草奶油', style: 'chiboust', width: 50 },
      { name: '第二层焦糖泡芙圈', style: 'caramel_puff', width: 44 },
      { name: '圣奥诺雷花峰奶油', style: 'chiboust', width: 38 },
      { name: '顶冠金箔焦糖泡芙', style: 'crown_puff', width: 30 }
    ]
  }
};

export {
  CRAFT_SCENES,
  STACKER_RECIPES
};
