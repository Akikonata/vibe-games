// src/utils/tutorial.js
// 全游戏统一新手教程图解卡 + 交互式首步手指引导 + 操作点飘字特效系统

export const TUTORIAL_CARDS = {
  kitchen: {
    badge: '☕ 营业厨房指南',
    title: '4 步轻松招待风铃湾顾客',
    steps: [
      { icon: '🧺', head: '① 拿取原料', desc: '点大理石台中央的【竹编原料篮】，拿起生面糊' },
      { icon: '🔥', head: '② 放入加工', desc: '点发光的【红砖烤炉 / 裱花台 / 装饰台】自动制作' },
      { icon: '🍰', head: '③ 取餐上菜', desc: '烤好发光后点烤炉取餐，再点吧台后对应顾客收金币！' }
    ],
    tip: '首单教学期间倒计时与顾客耐心完全暂停，放心上手！'
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
    title: '盯紧 3 口锅 · 变金黄就出锅',
    steps: [
      { icon: '🔥', head: '① 同步升温', desc: '三口铜锅 / 烤模会以不同速度同时升温' },
      { icon: '✨', head: '② 金黄翻面', desc: '锅体发金光并出现【点我出锅】时立刻点击该锅' },
      { icon: '💨', head: '③ 谨防烤糊', desc: '超过红区会冒烟烤糊！烤糊 4 次本轮失败' }
    ],
    tip: '直接点对应铜锅，电脑可用键盘【1 / 2 / 3】或【A / S / D】！'
  },
  stacker: {
    badge: '🍰 物理堆叠指南',
    title: '对齐中心虚线 · 稳稳盖甜点塔',
    steps: [
      { icon: '↔️', head: '① 看准摇摆', desc: '上方甜点夹层会沿着焦糖吊轨左右来回移动' },
      { icon: '👇', head: '② 点击松手', desc: '对齐下方甜点正中虚线时点击屏幕松手下落' },
      { icon: '♥', head: '③ 保持重心', desc: '完美对齐自动回正拿高分，偏出边缘会滑落扣 1 心' }
    ],
    tip: '手机点击舞台，电脑可用【空格 / 回车】快速松手！'
  },
  rhythm: {
    badge: '🎵 节拍工坊指南',
    title: '音符落进底部器皿时点击',
    steps: [
      { icon: '💧', head: '① 观察下落', desc: '蜂蜡滴 / 栗子泥音符会沿 3 条轨道向下掉落' },
      { icon: '🎯', head: '② 进圈击打', desc: '音符正好落入底部发光铜模 / 瓷环圆圈时点击该轨' },
      { icon: '⚡', head: '③ 连击高分', desc: '不要提前空拍乱点（会扣分），踩准节拍轻松拿 S！' }
    ],
    tip: '点击轨道或底部按键，电脑可用【A / S / D】或【1 / 2 / 3】！'
  },
  catch: {
    badge: '🎁 实景接盘指南',
    title: '左右拖动礼盒接好料、躲坏料',
    steps: [
      { icon: '👆', head: '① 丝滑拖动', desc: '直接在画面上按住左右拖动礼盒，或点选目标位置' },
      { icon: '🍓', head: '② 接住鲜果', desc: '接住落下的马卡龙 / 黑巧杏子得分，漏接会扣分' },
      { icon: '💥', head: '③ 躲开坏料', desc: '避开烤焦碎壳 / 粗盐块！接到 3 次坏料会失败' }
    ],
    tip: '支持直接拖动礼盒，电脑可用【← / →】或【A / D】！'
  }
};

export function createTutorialCardHtml(mode, { isFirstTime = true } = {}) {
  const cfg = TUTORIAL_CARDS[mode] || TUTORIAL_CARDS.oven;
  return `
    <div class="tut-modal-mask" data-tut-action="backdrop">
      <div class="card tut-modal-card" data-stop="true">
        <div class="tut-badge">${cfg.badge}</div>
        <h3 class="tut-title">${cfg.title}</h3>
        <div class="tut-steps-list">
          ${cfg.steps.map(s => `
            <div class="tut-step-row">
              <div class="tut-step-icon">${s.icon}</div>
              <div class="tut-step-body">
                <span class="tut-step-head">${s.head}</span>
                <span class="tut-step-desc">${s.desc}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="tut-tip-box">💡 ${cfg.tip}</div>
        <div class="tut-actions">
          <div class="btn-primary tut-start-btn" data-tut-action="start">
            ${isFirstTime ? '✨ 开始互动教学' : '👍 我明白啦，继续游戏'}
          </div>
          ${isFirstTime ? '<div class="tut-skip-link" data-tut-action="skip">我是老手，跳过教学直接玩 ›</div>' : ''}
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
