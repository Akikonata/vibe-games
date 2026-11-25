// src/data/part_time_jobs.js
// 风铃湾 3 处特色兼职打工场景配置（零本金、保底日薪 + 绩效提成，专治开店赤字与本金周转）

export const PART_TIME_JOBS = [
  {
    id: 'florist',
    title: '微风花坊 · 花束包装员',
    place: '鹅卵石花街转角',
    boss: '花店老板娘 莉莉安',
    icon: '💐',
    bgImg: 'assets/images/jobs/job_florist_bg.jpg',
    durationSec: 18,
    basePay: 25,
    payRangeText: '🪙 45 ~ 105 / 班',
    difficulty: '轻松上手',
    desc: '按顾客心愿依次挑选 2~3 种鲜花扎成花束，零成本稳赚还债本金。',
    ruleTip: '看清上方花束配方，按顺序点击对应鲜花桶即可打包出货！'
  },
  {
    id: 'cafe',
    title: '海风咖啡馆 · 控温拉花代班',
    place: '南岸观海咖啡吧',
    boss: '咖啡师 席奥',
    icon: '☕',
    bgImg: 'assets/images/jobs/job_cafe_bg.jpg',
    durationSec: 20,
    basePay: 25,
    payRangeText: '🪙 55 ~ 125 / 班',
    difficulty: '高薪节奏',
    desc: '看准蒸汽奶泡指针落入金色最佳温区时果断出杯，完美拉花给双倍小费！',
    ruleTip: '蒸汽指针来回摆动，落入金色区域时点击「☕ 精准出杯」拿高薪！'
  },
  {
    id: 'harbor',
    title: '钟楼码头杂货铺 · 食材分拣员',
    place: '风铃湾渔港货栈',
    boss: '老码头掌柜 巴特叔',
    icon: '📦',
    bgImg: 'assets/images/jobs/job_harbor_bg.jpg',
    durationSec: 18,
    basePay: 25,
    payRangeText: '🪙 50 ~ 115 / 班',
    difficulty: '眼疾手快',
    desc: '帮码头烘焙货栈快速把面粉黄油、新鲜果乳与发霉次品分拣到对应货篮。',
    ruleTip: '看清木桌上送来的货物，点下方对应分类篮快速分拣，连击加薪！'
  }
];
