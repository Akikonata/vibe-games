// data/cutscenes.js
// 开场漫画 + 主线 1~6 通关后的镜头移动式过场漫画配置

const CUTSCENES = {
  opening: {
    id: 'opening',
    title: '序幕过场漫画 · 风铃湾的甜蜜记忆',
    panels: [
      {
        id: 'op_1',
        tag: '第一幕 · 风铃湾的甜蜜记忆',
        bg: 'assets/images/town_map_bg.jpg',
        camClass: 'cam-pan-right',
        sepia: false,
        portrait: '',
        castRow: [],
        caption: '在依山傍海的欧洲小镇风铃湾，石板路尽头曾有一家飘满焦糖与黄油香气的百年甜点屋——星月糖屋。'
      },
      {
        id: 'op_2',
        tag: '第二幕 · 尘封的旧时光',
        bg: 'assets/images/shop_facade.jpg',
        camClass: 'cam-zoom-in',
        sepia: true,
        portrait: 'assets/images/portraits/madeleine.png',
        castRow: [],
        caption: '随着玛德琳婆婆年迈退休，老店停业多年。镇上的果园、牧场、铁匠铺与旧港，也渐渐失去了曾经默契的甜蜜羁绊。'
      },
      {
        id: 'op_3',
        tag: '第三幕 · 新店长的约定',
        bg: 'assets/images/shop_facade.jpg',
        camClass: 'cam-pan-left',
        sepia: false,
        portrait: 'assets/images/portraits/coco.png',
        castRow: [],
        caption: '直到这一天，元气甜点学徒可可接过了老店的黄铜钥匙——立志在【百年风铃美食节】前，重新点燃星月糖屋的烤炉！'
      },
      {
        id: 'op_4',
        tag: '序幕拉开 · 甜点屋物语',
        bg: 'assets/images/town_map_bg.jpg',
        camClass: 'cam-zoom-out',
        sepia: false,
        portrait: '',
        castRow: [
          'assets/images/portraits/lillian.png',
          'assets/images/portraits/gregory.png',
          'assets/images/portraits/bart.png',
          'assets/images/portraits/emily.png'
        ],
        caption: '拜访上下游供应商伙伴、闯关多样的烘焙小游戏、经营甜点屋并解锁百年食谱——属于你的甜点屋物语，就此启程！'
      }
    ]
  },

  main_1_end: {
    id: 'main_1_end',
    title: '第一章尾声 · 亮起的第一盏灯',
    panels: [
      {
        id: 'm1_1',
        tag: '第一章尾声 · 暖光重燃',
        bg: 'assets/images/shop_facade.jpg',
        camClass: 'cam-zoom-in',
        sepia: false,
        portrait: 'assets/images/portraits/coco.png',
        castRow: [],
        caption: '傍晚的微风吹过风铃湾，星月糖屋沉睡多年的铜烤炉终于冒出温暖炊烟，焦化黄油与柠檬香飘出石板街。'
      },
      {
        id: 'm1_2',
        tag: '新的邀约 · 供应链启程',
        bg: 'assets/images/town_map_bg.jpg',
        camClass: 'cam-pan-right',
        sepia: false,
        portrait: '',
        castRow: [
          'assets/images/portraits/lillian.png',
          'assets/images/portraits/gregory.png'
        ],
        caption: '山坡上的阳光果园与红砖铁匠铺纷纷亮起灯火——现在可以打开营业柜台接待街坊，也能去地图拜访第一位供应商啦！'
      }
    ]
  },

  main_2_end: {
    id: 'main_2_end',
    title: '第二章尾声 · 焦糖香飘满老街',
    panels: [
      {
        id: 'm2_1',
        tag: '第二章尾声 · 复核通过',
        bg: 'assets/images/shop_facade.jpg',
        camClass: 'cam-pan-left',
        sepia: false,
        portrait: 'assets/images/portraits/madeleine.png',
        castRow: [],
        caption: '一张崭新的《风铃湾手工烘焙营业许可》贴上了拱形玻璃门，翻转苹果塔的焦糖香气引来络绎不绝的街坊。'
      },
      {
        id: 'm2_2',
        tag: '暗流涌动 · 毒舌作家的目光',
        bg: 'assets/images/town_map_bg.jpg',
        camClass: 'cam-zoom-in',
        sepia: false,
        portrait: 'assets/images/portraits/theo.png',
        castRow: [],
        caption: '街角咖啡座上，《风铃湾周报》的毒舌专栏作家西奥多推了推半框眼镜：“老店翻红？明天试营业，我亲自去试一试。”'
      }
    ]
  },

  main_3_end: {
    id: 'main_3_end',
    title: '第三章尾声 · 头版上的千层酥',
    panels: [
      {
        id: 'm3_1',
        tag: '第三章尾声 · 名声大噪',
        bg: 'assets/images/shop_facade.jpg',
        camClass: 'cam-zoom-out',
        sepia: false,
        portrait: 'assets/images/portraits/theo.png',
        castRow: [],
        caption: '清晨的报童高喊着跑过石板街——《风铃湾周报》刊登了星月糖屋的现点千层酥评测，店门口第一次排起了长队！'
      },
      {
        id: 'm3_2',
        tag: '风云突变 · 海岸乌云',
        bg: 'assets/images/town_map_bg.jpg',
        camClass: 'cam-pan-right',
        sepia: true,
        portrait: 'assets/images/portraits/bart.png',
        castRow: [],
        caption: '然而远方的海平面悄然聚起乌云，一场突如其来的海滨暴雨正逼近旧港与风铃湾……'
      }
    ]
  },

  main_4_end: {
    id: 'main_4_end',
    title: '第四章尾声 · 雨夜后的晴空',
    panels: [
      {
        id: 'm4_1',
        tag: '第四章尾声 · 风雨同舟',
        bg: 'assets/images/shop_facade.jpg',
        camClass: 'cam-zoom-in',
        sepia: false,
        portrait: 'assets/images/portraits/bart.png',
        castRow: [],
        caption: '暴雨夜的一块焦香流心巴斯克，让全镇居民在暖黄灯光下相聚。天亮时分，旧港的远洋商船也终于鸣笛靠岸。'
      },
      {
        id: 'm4_2',
        tag: '新的对手 · 银匙降临',
        bg: 'assets/images/town_map_bg.jpg',
        camClass: 'cam-pan-left',
        sepia: false,
        portrait: 'assets/images/portraits/silver_spoon.png',
        castRow: [],
        caption: '可就在商业街正对面，挂着冷冽金属招牌的连锁品牌【银匙机械烘焙】连夜挂牌——真正的商业对决即将打响！'
      }
    ]
  },

  main_5_end: {
    id: 'main_5_end',
    title: '第五章尾声 · 手工的温度',
    panels: [
      {
        id: 'm5_1',
        tag: '第五章尾声 · 赢得尊重',
        bg: 'assets/images/shop_facade.jpg',
        camClass: 'cam-pan-right',
        sepia: false,
        portrait: 'assets/images/portraits/silver_spoon.png',
        castRow: [],
        caption: '七层歌剧院蛋糕的醇厚回甘彻底打动了风铃湾的食客。银匙代表收起公文包，留下一句：“王都大赛，我们不会再输。”'
      },
      {
        id: 'm5_2',
        tag: '终章前夕 · 百年美食节',
        bg: 'assets/images/town_map_bg.jpg',
        camClass: 'cam-zoom-out',
        sepia: false,
        portrait: '',
        castRow: [
          'assets/images/portraits/coco.png',
          'assets/images/portraits/lillian.png',
          'assets/images/portraits/bart.png',
          'assets/images/portraits/emily.png'
        ],
        caption: '中心广场张灯结彩，全镇的上下游供应商伙伴已全部集结——迎接【百年风铃美食节】的压轴决战吧！'
      }
    ]
  },

  main_6_end: {
    id: 'main_6_end',
    title: '第一卷终章 · 铃兰信笺与新航线',
    panels: [
      {
        id: 'm6_1',
        tag: '第一卷终章 · 星月荣光',
        bg: 'assets/images/shop_facade.jpg',
        camClass: 'cam-zoom-out',
        sepia: false,
        portrait: '',
        castRow: [
          'assets/images/portraits/coco.png',
          'assets/images/portraits/madeleine.png',
          'assets/images/portraits/theo.png',
          'assets/images/portraits/lillian.png'
        ],
        caption: '礼堂级圣奥诺雷泡芙塔惊艳全场，星月糖屋重新捧回“风铃湾金徽章”！小镇的夜晚被欢笑与焦糖香气点亮。'
      },
      {
        id: 'm6_2',
        tag: '第二卷伏笔 · 跨海汽笛',
        bg: 'assets/images/town_map_bg.jpg',
        camClass: 'cam-pan-right',
        sepia: false,
        portrait: 'assets/images/portraits/madeleine.png',
        castRow: [],
        caption: '庆功宴后，柜台角落静静躺着一枚【银色铃兰胸针】与半张《皇家甜点手账》；海雾尽头的跨海蒸汽火车站悄然亮灯——下一站，王都甜点博览会！'
      }
    ]
  }
};

function getCutscene(comicId) {
  return CUTSCENES[comicId] || CUTSCENES.opening;
}

export {
  CUTSCENES,
  getCutscene
};
