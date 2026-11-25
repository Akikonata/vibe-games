// src/utils/tutorial.js
// 全游戏统一新手教程图解卡 + 交互式首步手指引导 + 操作点飘字特效系统

export const TUTORIAL_CARDS = {
  kitchen: {
    badge: '☕ 营业厨房指南',
    title: '4 步轻松招待风铃湾顾客',
    steps: [
      { icon: '🧺', head: '① 选订单 / 取料', desc: '点中央【大竹篮】智能拿首位顾客要的生面糊，或点篮下 3 枚甜点按钮指定取料' },
      { icon: '🔥', head: '② 烘烤 / 取出', desc: '点发光的【红砖烤炉】烘烤；显示「可取餐」后及时点烤炉取出，久放会烤糊' },
      { icon: '🍰', head: '③ 按配方裱花或装饰', desc: '玛德琳/苹果塔烤好即成品；千层酥等双工序半成品取出后，请按提示再去【裱花台 / 装饰台】' },
      { icon: '🤝', head: '④ 交给对应顾客', desc: '成品端在手中后点对应顾客收金币！左下【暂存台】可腾手，满手点熟炉可顺手换锅，点糊炉直接清渣' }
    ],
    firstTip: '首单练习期间营业倒计时、顾客耐心与烤焦计时全部冻结，放心熟悉操作！',
    helpTip: '营业已暂停：倒计时、顾客耐心与烤炉计时均已冻结，关闭说明后平滑继续！',
    tip: '首单练习期间营业倒计时、顾客耐心与烤焦计时全部冻结，放心熟悉操作！'
  },
  oven: {
    badge: '🔥 烤炉温控指南',
    title: '瞄准 180°C 黄金区点火',
    steps: [
      { icon: '🌡️', head: '① 观察指针', desc: '下方黄铜温度计指针会左右平滑摆动' },
      { icon: '✨', head: '② 精准点击', desc: '指针滑进金色【180°C 黄金区】时点击烤炉或按空格' },
      { icon: '🥐', head: '③ 命中 3 次', desc: '越靠近正中心得分越高，命中 3 次即可金黄出炉！' }
    ],
    tip: '手机点击屏幕任意处，电脑可用【空格 / 回车】！'
  },
  multi_pan: {
    badge: '🍳 多锅火候指南',
    title: '看准焦糖金区 · 稳稳掌控三口铜锅',
    steps: [
      { icon: '🔥', head: '① 即将出锅预警', desc: '教学先用 2 口铜锅无惩罚练习 2 份，完成后重置计时开启 3 口铜锅正式挑战' },
      { icon: '✨', head: '② 金区出锅 / 中心完美', desc: '进入金色区（约 1.5~2 秒）点铜锅或按【1/2/3】出锅 +75，中心完美焦糖 +100' },
      { icon: '🛟', head: '③ 抢救不扣容错 · 烧焦才扣', desc: '「快糊了」时抢救 +35 不扣容错；真正烧焦扣 1 次容错并短暂冷却，烧焦 4 次失败' },
      { icon: '🏆', head: '④ B / A / S 评级规则', desc: 'B级过关：≥3份、≥240分且烧焦<4；A级：满6份、≥432分且烧焦≤1；S级：满6份、≥540分且0烧焦' }
    ],
    firstTip: '支持点击或按【1 / 2 / 3】（A / S / D），可随时暂停或重玩教学！',
    helpTip: '本轮已暂停：计时与火候均已冻结，关闭说明后平滑继续！',
    tip: '直接点对应铜锅，电脑可用键盘【1 / 2 / 3】或【A / S / D】！'
  },
  whisk_dash: {
    badge: '🔥 巴斯克高温出炉指南',
    title: '看准焦糖金区 · 稳稳抓拍流心出炉',
    steps: [
      { icon: '🔥', head: '① 即将出炉预警', desc: '烤位升温接近金区会先提示「即将出炉」，教学先开 2 个烤位上手，再解锁第 3 烤位' },
      { icon: '✨', head: '② 金区出炉 / 中心完美', desc: '进入金色区（约 1.5~2 秒）点烤位或按【1/2/3】出炉 +75，命中中心完美流心区 +100' },
      { icon: '🛟', head: '③ 抢救不扣容错 · 烧焦才扣', desc: '刚超金区「快糊了」时点出炉可抢救（+35，不扣容错）；真正烧焦才扣 1 次容错并进入短暂冷却，烧焦 4 次失败' },
      { icon: '🏆', head: '④ B / A / S 评级规则', desc: 'B级过关：≥3份、≥240分且烧焦<4；A级：满6份、≥432分(72%)且烧焦≤1；S级：满6份、≥540分(90%)且0烧焦' }
    ],
    firstTip: '支持点击烤位或按键盘【1 / 2 / 3】（A / S / D）！教学期间倒计时冻结，放心上手。',
    helpTip: '已为你暂停本轮烘烤：倒计时与所有烤位温度均已冻结，关闭说明后继续！',
    tip: '点击烤位或按键盘【1 / 2 / 3】（A / S / D），可随时暂停或重玩教学！'
  },
  stacker: {
    badge: '🍰 物理堆叠指南',
    title: '对准动态虚线 · 稳稳叠起甜点塔',
    steps: [
      { icon: '↔️', head: '① 虚线跟踪真实落点', desc: '虚线会自动跟随上一层甜点的真实中心，看准虚线对齐即可' },
      { icon: '👇', head: '② 点击或按空格松手', desc: '精准对齐中心获 +100 并自动回正，滑落会给短暂缓冲再继续' },
      { icon: '🏆', head: '③ B / A / S 评级规则', desc: '叠完全部层数且生命>0（≥35%分）即B级过关；≥72%且≥2心获A；≥90%且满3心获S' }
    ],
    helpTip: '本轮已暂停：摆动与下落已冻结，关闭说明后继续！',
    tip: '手机点击舞台，电脑可用【空格 / 回车】快速松手！'
  },
  rhythm: {
    badge: '🎵 三轨节拍指南',
    title: '音符落进底部圆圈时点击或按 1/2/3',
    steps: [
      { icon: '🎓', head: '① 慢速练习 + 3-2-1 准备', desc: '首次进入先慢速练习命中 2 拍（不扣分），随后 3-2-1 倒数正式发拍' },
      { icon: '🎯', head: '② 进圈击打（附早/晚提示）', desc: '音符落入底部发光圆圈时点对应轨道或按【1 / 2 / 3】（A / S / D）' },
      { icon: '🏆', head: '③ B / A / S 评级规则', desc: '命中≥半数且≥42%分即B级过关；≥72%且漏拍≤2获A；≥90%且0漏拍获S' }
    ],
    helpTip: '本轮已暂停：音符下落已冻结，关闭说明后继续！',
    tip: '点击轨道或底部按键，电脑可用【1 / 2 / 3】或【A / S / D】！'
  },
  catch: {
    badge: '🎁 食材收集指南',
    title: '左右移动接好料、躲坏料',
    steps: [
      { icon: '👆', head: '① 丝滑拖动或键盘移动', desc: '按住画面左右拖动礼盒，或按键盘【← / →】（A / D）平滑移动' },
      { icon: '🍓', head: '② 接好料 · 躲坏料', desc: '接住优质甜点原料得分，避开瑕疵坏料（接到 3 次坏料失败）' },
      { icon: '🏆', head: '③ 过关线与满额说明', desc: '接住≥4份且≥320分(40%)即B级过关；8份为满额上限，满8份+≥72%且≥2心获A，满3心+≥90%获S' }
    ],
    helpTip: '本轮已暂停：食材下落与倒计时均已冻结，关闭说明后继续！',
    tip: '支持直接拖动礼盒，电脑可用【← / →】或【A / D】！'
  }
};

export function createTutorialCardHtml(mode, { isFirstTime = true } = {}) {
  const cfg = TUTORIAL_CARDS[mode] || TUTORIAL_CARDS.oven;
  const tipText = isFirstTime ? (cfg.firstTip || cfg.tip) : (cfg.helpTip || cfg.tip);
  return `
    <div class="tut-modal-mask" data-tut-action="backdrop" role="dialog" aria-modal="true" aria-label="${cfg.title}">
      <div class="card tut-modal-card" data-stop="true">
        <div class="tut-badge">${cfg.badge}</div>
        <h3 class="tut-title">${cfg.title}</h3>
        <div class="tut-steps-list">
          ${cfg.steps.map(s => `
            <div class="tut-step-row">
              <div class="tut-step-icon" aria-hidden="true">${s.icon}</div>
              <div class="tut-step-body">
                <span class="tut-step-head">${s.head}</span>
                <span class="tut-step-desc">${s.desc}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="tut-tip-box">💡 ${tipText}</div>
        <div class="tut-actions">
          <button type="button" class="btn-primary tut-start-btn" data-tut-action="start">
            ${isFirstTime ? '✨ 开始互动教学' : '👍 继续营业'}
          </button>
          ${isFirstTime ? '<button type="button" class="tut-skip-link" data-tut-action="skip">我是老手，跳过教学直接营业 ›</button>' : ''}
        </div>
      </div>
    </div>
  `;
}

export function spawnFloatText(container, { xPct = 50, yPct = 45, text = '+100', kind = 'gold' } = {}) {
  if (!container) return;
  const el = document.createElement('div');
  el.className = `vg-float-fx fx-${kind}`;
  el.style.left = `${xPct}%`;
  el.style.top = `${yPct}%`;
  el.textContent = text;
  container.appendChild(el);
  setTimeout(() => el.remove(), 920);
}
