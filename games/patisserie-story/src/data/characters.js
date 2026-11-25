// data/characters.js
// 主角、主线NPC与上下游供应商角色档案（含全员多表情二次元立绘路径）

const VALID_EMOTIONS = ['normal', 'happy', 'surprised', 'serious'];

const EMOTION_LABELS = {
  normal: '微笑',
  happy: '开心',
  surprised: '惊讶',
  serious: '认真'
};

function getPortraitPath(charId, emotion) {
  const safeId = CHARACTERS[charId] ? charId : 'coco';
  const safeEmo = VALID_EMOTIONS.includes(emotion) ? emotion : 'normal';
  return `assets/images/portraits/${safeId}.png`;
}

const CHARACTERS = {
  coco: {
    id: 'coco',
    name: '可可',
    title: '星月糖屋新任店主',
    role: 'protagonist',
    avatar: '🥐',
    avatarImg: 'assets/images/coco_avatar.png',
    themeColor: '#C8824B',
    appearance: '焦糖色微卷齐肩发，奶油白贝雷帽别着金色徽章，牛油果绿背带围裙。',
    bio: '乐观执着的甜点学徒，接手尘封的“星月糖屋”，立志用手工甜点重新串联起风铃湾的记忆与人情。'
  },
  madeleine: {
    id: 'madeleine',
    name: '玛德琳婆婆',
    title: '老店前任店主 / 导师',
    role: 'main_npc',
    avatar: '🫖',
    avatarImg: 'assets/images/portraits/madeleine.png',
    themeColor: '#8F3D4B',
    appearance: '银白色高盘发，圆框老花镜，酒红色天鹅绒开衫。',
    bio: '星月糖屋的传奇老店主，总在关键时刻给出温柔却切中要害的烘焙哲学。'
  },
  theo: {
    id: 'theo',
    name: '西奥多',
    title: '《风铃湾周报》美食专栏作家',
    role: 'main_npc',
    avatar: '📷',
    avatarImg: 'assets/images/portraits/theo.png',
    themeColor: '#3E5368',
    appearance: '深栗色短发，半框眼镜，格纹马甲配深蓝风衣。',
    bio: '以毒舌和严谨著称的美食评论家，对真正用心的风味毫无抵抗力。'
  },
  lillian: {
    id: 'lillian',
    name: '莉莉安',
    title: '阳光梯田果园主 · 水果与坚果供应',
    role: 'supplier',
    avatar: '🍓',
    avatarImg: 'assets/images/portraits/lillian.png',
    themeColor: '#BA7336',
    appearance: '双麻花辫，草编遮阳帽，碎花连衣裙配园艺围裙。',
    bio: '浪漫的果园少女，一心想让自家种的树莓、柠檬和杏仁变成惊艳小镇的甜点。'
  },
  gregory: {
    id: 'gregory',
    name: '格雷戈里',
    title: '红砖铁匠铺 · 烘焙模具与铜器供应',
    role: 'supplier',
    avatar: '🔨',
    avatarImg: 'assets/images/portraits/gregory.png',
    themeColor: '#704226',
    appearance: '花白短发，额前推着护目镜，厚重深棕色皮围裙。',
    bio: '外冷内热的老派工匠，只愿为真正爱惜火候与手工的人锻造传家铜模。'
  },
  bart: {
    id: 'bart',
    name: '巴特大叔',
    title: '晨露牧场主 · 鲜奶与乳酪供应',
    role: 'supplier',
    avatar: '🧀',
    avatarImg: 'assets/images/portraits/bart.png',
    themeColor: '#9E5F2F',
    appearance: '络腮胡，宽檐草帽，格子法兰绒衬衫配背带裤。',
    bio: '豪爽固执的牧场主，坚信“没有好牧草就没有好黄油与马斯卡彭”。'
  },
  casper: {
    id: 'casper',
    name: '卡斯帕',
    title: '旧港香料货栈 · 咖啡/可可/香料供应',
    role: 'supplier',
    avatar: '☕',
    avatarImg: 'assets/images/portraits/casper.png',
    themeColor: '#6F4E37',
    appearance: '小麦色皮肤，深棕头巾，单边铜框眼镜，亚麻马甲。',
    bio: '走南闯北的香料商人，熟悉远洋航线与欧洲宫廷的美食轶事。'
  },
  emily: {
    id: 'emily',
    name: '艾米莉',
    title: '月光瓷艺坊 · 骨瓷餐具与礼盒包装',
    role: 'supplier',
    avatar: '🎀',
    avatarImg: 'assets/images/portraits/emily.png',
    themeColor: '#695875',
    appearance: '淡紫微卷长发，珍珠耳钉，莫兰迪色针织衫。',
    bio: '追求仪式感的完美主义设计师，认为甜点的最后一步是装盘与礼盒。'
  },
  silver_spoon: {
    id: 'silver_spoon',
    name: '银匙代表',
    title: '都市连锁“银匙机械烘焙”负责人',
    role: 'rival',
    avatar: '⚙️',
    avatarImg: 'assets/images/portraits/silver_spoon.png',
    themeColor: '#46515E',
    appearance: '银灰背头，笔挺西装，表情一丝不苟。',
    bio: '奉行标准化与流水线效率的竞争对手，认为手工甜点屋注定被淘汰。'
  }
};

export {
  CHARACTERS,
  EMOTION_LABELS,
  getPortraitPath
};
