// data/story_branches.js
// 不同得分评级（S 传奇 / A 合格 / B 微瑕趣味分支）对应的差异化 RPG 剧情支线

const RANK_META = {
  S: {
    code: 'S',
    label: 'S 级 · 传奇出品',
    toast: '✨ S 级 · 传奇出品！',
    badgeClass: 'rank-s'
  },
  A: {
    code: 'A',
    label: 'A 级 · 美味过关',
    toast: '⭐ A 级 · 美味完成',
    badgeClass: 'rank-a'
  },
  B: {
    code: 'B',
    label: 'B 级 · 险胜微瑕',
    toast: '🌿 B 级 · 勉强出炉',
    badgeClass: 'rank-b'
  }
};

const OUTRO_BRANCHES = {
  main_1: {
    S: [
      { speaker: 'madeleine', emotion: 'happy', text: '零失误唤醒老烤炉！你看这金黄鼓起的“小肚子”，连焦化黄油的香气都分毫不差……可可，你天生就属于这座烤炉。' },
      { speaker: 'coco', emotion: 'happy', text: '太棒了婆婆！有了这个开门红，我要立刻去风铃湾地图上拜访各位供应商伙伴！' }
    ],
    A: [
      { speaker: 'madeleine', emotion: 'normal', text: '色泽金黄、柠檬香气清甜，这第一盘玛德琳已经很有星月糖屋的味道啦。' },
      { speaker: 'coco', emotion: 'happy', text: '嘿嘿，接下来我会更熟悉老烤炉的脾气，去小镇上寻找更多好食材！' }
    ],
    B: [
      { speaker: 'madeleine', emotion: 'surprised', text: '哎呀，边缘稍微烤深了一点点，像极了你小时候偷吃的第一炉……不过掰开来内芯还是很松软的。' },
      { speaker: 'coco', emotion: 'serious', text: '呜，老烤炉脾气真倔！我一定再多练练控温，下次烤出 S 级完美金黄！' }
    ]
  },

  main_2: {
    S: [
      { speaker: 'madeleine', emotion: 'happy', text: '琥珀焦糖亮得像琉璃，倒扣那一瞬间连街坊们都鼓掌了！开业复核不仅是“通过”，简直是满分惊艳！' },
      { speaker: 'coco', emotion: 'happy', text: '原来“将错就错”也能做出这么棒的奇迹，星月糖屋正式拿回营业许可啦！' }
    ],
    A: [
      { speaker: 'coco', emotion: 'happy', text: '焦糖苹果和酥皮结合得刚刚好，街坊们排队夸赞，开业复核顺利通过啦！' },
      { speaker: 'madeleine', emotion: 'normal', text: '干得漂亮，不过焦糖收汁还可以再大胆一分，香气会更迷人。' }
    ],
    B: [
      { speaker: 'madeleine', emotion: 'normal', text: '虽然刚才差点冒焦烟，苹果边角也微苦了一点，但好在及时翻转救回来了——街坊们说这叫“风味粗犷”呢。' },
      { speaker: 'coco', emotion: 'surprised', text: '好险好险！还好复核过了，下回我一定把焦糖火候拿捏得死死的！' }
    ]
  },

  main_3: {
    S: [
      { speaker: 'theo', emotion: 'surprised', text: '……每一层酥皮对齐得像建筑图纸，刀尖落下清脆的“咔嚓”声简直是艺术！我收回之前的话，明天《风铃湾周报》头版全留给星月糖屋！' },
      { speaker: 'coco', emotion: 'happy', text: '耶！连毒舌美食作家都被 729 层千层酥彻底征服啦！' }
    ],
    A: [
      { speaker: 'theo', emotion: 'normal', text: '现点现挤的卡仕达酱香草籽很足，酥皮也够脆，配得上风铃湾老店的招牌。我会写一篇公正的好评。' },
      { speaker: 'coco', emotion: 'happy', text: '谢谢西奥多先生！下次来我一定叠出更完美的头版水准！' }
    ],
    B: [
      { speaker: 'theo', emotion: 'serious', text: '啧，这千层酥堆得歪歪扭扭的，我举着相机找了半天角度才没拍穿帮……不过现挤奶油的味道确实没得挑。' },
      { speaker: 'coco', emotion: 'surprised', text: '对、对不起！酥皮太滑了……西奥多先生你先别发稿，下次我一定叠得笔直给你拍！' }
    ]
  },

  main_4: {
    S: [
      { speaker: 'bart', emotion: 'happy', text: '哈哈！这焦香外皮配流心乳酪，连暴雨声都被满屋的奶香盖过去了！客人们说这是风铃湾最治愈的夜晚！' },
      { speaker: 'coco', emotion: 'happy', text: '多亏巴特大叔冒雨送来牧场鲜奶酪，真诚的食材永远不会让人失望！' }
    ],
    A: [
      { speaker: 'coco', emotion: 'happy', text: '焦黑外表下藏着温柔的乳酪流心，今晚预约的客人们全都满意而归啦！' },
      { speaker: 'bart', emotion: 'normal', text: '不错不错，本地牧场的奶源没让你丢脸！' }
    ],
    B: [
      { speaker: 'bart', emotion: 'surprised', text: '表皮烤得稍微有点太黑啦，差点变成“炭烧巴斯克”！好在切开里面还有流心，客人们倒觉得挺有意思。' },
      { speaker: 'coco', emotion: 'serious', text: '230°C 的高温真刺激……下次我一定卡准秒表拉出烤盘！' }
    ]
  },

  main_5: {
    S: [
      { speaker: 'silver_spoon', emotion: 'surprised', text: '不可能……七层手工结构居然比精密机械还工整，风味层次却远远甩开流水线！风铃湾这一局我们认输，王都大赛再见！' },
      { speaker: 'coco', emotion: 'happy', text: '手工的温度，是冰冷机器永远模仿不来的！' }
    ],
    A: [
      { speaker: 'silver_spoon', emotion: 'serious', text: '哼，咖啡与黑巧的融合确实有点门道。风铃湾算你们赢了，但下个月的王都味觉大赛可没这么简单。' },
      { speaker: 'coco', emotion: 'normal', text: '无论在哪里，星月糖屋都会用手艺说话！' }
    ],
    B: [
      { speaker: 'silver_spoon', emotion: 'serious', text: '切面虽然歪了点、显得有些手工粗糙，但……可恶，评委居然说“这才是活生生的蛋糕”！下回王都大赛我们不会再输！' },
      { speaker: 'coco', emotion: 'surprised', text: '呼……虽然叠得有点惊险，但手工的味道还是赢下来了！下次一定要冲个 S 级把他们彻底服气！' }
    ]
  },

  main_6: {
    S: [
      { speaker: 'theo', emotion: 'happy', text: '完美无瑕的圣奥诺雷泡芙塔！“风铃湾失去的不是一家老店，而是一段甜蜜的时光；今天，它以最耀眼的姿态回来了！”' },
      { speaker: 'madeleine', emotion: 'surprised', text: '……等等，柜台角上是谁留下的“银色铃兰胸针”和半张《皇家甜点手账》？看来，第二卷的新旅程正等着我们呢。' }
    ],
    A: [
      { speaker: 'theo', emotion: 'happy', text: '全镇供应商齐心协力的滋味都在这座泡芙塔里了。恭喜星月糖屋正式重现荣光！' },
      { speaker: 'madeleine', emotion: 'surprised', text: '快看柜台角落——那枚银色铃兰胸针和《皇家甜点手账·残页》……风铃湾之外的故事，要开始了。' }
    ],
    B: [
      { speaker: 'theo', emotion: 'normal', text: '虽然泡芙塔稍微有点倾斜，像座可爱的“风铃湾斜塔”，但每一颗焦糖泡芙都脆得让人感动！金徽章实至名归！' },
      { speaker: 'madeleine', emotion: 'surprised', text: '哈哈，斜一点也挡不住全镇的欢呼……对了可可，柜台角上突然多了一枚银色铃兰胸针和半张手账残页，是谁留下的？' }
    ]
  },

  side_1: {
    S: [
      { speaker: 'lillian', emotion: 'happy', text: '天哪！每一颗马卡龙都圆润饱满、裙边像蕾丝花边一样精致！果园今后就是星月糖屋的独家鲜果庄园啦！' }
    ],
    A: [
      { speaker: 'lillian', emotion: 'happy', text: '色彩缤纷又酸甜不腻，树莓和开心果的香气太搭了！签约成功！' }
    ],
    B: [
      { speaker: 'lillian', emotion: 'surprised', text: '虽然有两颗裙边稍微歪了点，但夹心果酱实在太好吃啦！没关系，果园照样跟你签约，以后一起慢慢打磨！' }
    ]
  },

  side_2: {
    S: [
      { speaker: 'gregory', emotion: 'happy', text: '咔嚓一声琥珀脆壳、内里像丝绒香草布丁……二十年没见过这么地道的可露丽了！这套传家铜模归你了！' }
    ],
    A: [
      { speaker: 'gregory', emotion: 'normal', text: '肯老老实实刷蜂蜡、守火候的年轻人不多了。铜模拿去，别辜负它们！' }
    ],
    B: [
      { speaker: 'gregory', emotion: 'serious', text: '哼，火候差了一丁点，外壳还不够亮——不过看在你肯耐心手工刷蜡的份上，铜模先借你，下次烤个 S 级给我看！' }
    ]
  },

  side_3: {
    S: [
      { speaker: 'casper', emotion: 'surprised', text: '每一层叠得严丝合缝，咖啡的微苦和马斯卡彭的醇厚同时在舌尖绽放……巴特，这次算我们双赢！' },
      { speaker: 'bart', emotion: 'happy', text: '哈哈！以后星月糖屋的鲜奶酪和咖啡豆，我们两家联手直供！' }
    ],
    A: [
      { speaker: 'bart', emotion: 'happy', text: '奶香和咖啡香居然这么和谐，可可你真有两下子！牧场和货栈都挺你！' }
    ],
    B: [
      { speaker: 'casper', emotion: 'normal', text: '虽然叠得像被海风吹歪的小塔，但挖一勺送进嘴里居然意外地好吃……行吧，巴特，看在味道的份上咱俩和解！' }
    ]
  },

  side_4: {
    S: [
      { speaker: 'emily', emotion: 'happy', text: '细密如发丝的栗子泥、恰到好处的糖粉初雪……我的银杏骨瓷盘终于遇到了命中注定的甜点！全套瓷器归你！' }
    ],
    A: [
      { speaker: 'emily', emotion: 'happy', text: '构图优雅、配色高级，摆在骨瓷盘里太有仪式感了，伴手礼盒也交给我设计吧！' }
    ],
    B: [
      { speaker: 'emily', emotion: 'normal', text: '栗子泥丝带稍微粗了一点点，像座胖乎乎的小雪丘——倒也有种憨态可掬的可爱呢，瓷盘还是送给你！' }
    ]
  },

  side_5: {
    S: [
      { speaker: 'casper', emotion: 'happy', text: '黑巧镜面亮得能照出星光，微酸杏子酱更是点睛之笔！可可，你和玛德琳婆婆一样，天生听得懂可可的声音！' }
    ],
    A: [
      { speaker: 'casper', emotion: 'happy', text: '厚重可可与微酸杏子平衡得恰到好处，这批厄瓜多尔顶级可可豆优先留给星月糖屋！' }
    ],
    B: [
      { speaker: 'casper', emotion: 'normal', text: '杏子酱稍微多抹了一丢丢，酸味挺提神的！维也纳老咖啡馆就喜欢这种率性的风味，可可豆照样供给你！' }
    ]
  }
};

function getOutroDialogue(level, rank) {
  const safeRank = RANK_META[rank] ? rank : 'A';
  const branches = OUTRO_BRANCHES[level.id];
  if (branches && branches[safeRank]) {
    return branches[safeRank];
  }
  return level.outroDialogue || [];
}

export {
  RANK_META,
  OUTRO_BRANCHES,
  getOutroDialogue
};
