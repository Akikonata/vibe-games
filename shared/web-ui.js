// shared/web-ui.js
// 纯 HTML5 公共基础能力：本地持久化、轻提示 Toast、确认弹窗 Modal、震动反馈

const memoryStore = new Map();

export function createStorage(namespace) {
  const prefix = namespace ? `${namespace}:` : '';
  return {
    get(key, fallback = null) {
      const fullKey = prefix + key;
      try {
        const raw = window.localStorage.getItem(fullKey);
        if (raw !== null) return JSON.parse(raw);
      } catch (_) {
        if (memoryStore.has(fullKey)) return JSON.parse(memoryStore.get(fullKey));
      }
      return fallback;
    },
    set(key, value) {
      const fullKey = prefix + key;
      const raw = JSON.stringify(value);
      memoryStore.set(fullKey, raw);
      try {
        window.localStorage.setItem(fullKey, raw);
        return true;
      } catch (_) {
        return false;
      }
    },
    remove(key) {
      const fullKey = prefix + key;
      memoryStore.delete(fullKey);
      try {
        window.localStorage.removeItem(fullKey);
      } catch (_) {}
    }
  };
}

let toastTimer = null;

export function showToast(message, duration = 1800) {
  let el = document.getElementById('vg-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'vg-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    Object.assign(el.style, {
      position: 'fixed',
      left: '50%',
      bottom: '68px',
      transform: 'translate(-50%, 12px)',
      background: 'rgba(46, 22, 16, 0.9)',
      color: '#fffbf6',
      padding: '10px 20px',
      borderRadius: '999px',
      fontSize: '14px',
      fontWeight: '700',
      maxWidth: '84vw',
      textAlign: 'center',
      zIndex: '9999',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)'
    });
    document.body.appendChild(el);
  }
  clearTimeout(toastTimer);
  el.textContent = message;
  el.style.opacity = '1';
  el.style.transform = 'translate(-50%, 0)';
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translate(-50%, 12px)';
  }, duration);
}

export function showConfirmDialog({
  title = '提示',
  content = '',
  confirmText = '确定',
  cancelText = '取消',
  confirmColor = '#b36024',
  showCancel = true
} = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'vg-dialog-backdrop';
    Object.assign(backdrop.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(38, 18, 12, 0.56)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      zIndex: '10000'
    });

    const card = document.createElement('div');
    card.setAttribute('role', 'alertdialog');
    card.setAttribute('aria-modal', 'true');
    Object.assign(card.style, {
      width: '100%',
      maxWidth: '330px',
      background: '#fffaf4',
      borderRadius: '22px',
      border: '2px solid rgba(107, 45, 71, 0.25)',
      padding: '22px 20px 16px',
      boxShadow: '0 18px 42px rgba(24, 10, 6, 0.32)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", sans-serif',
      color: '#4a2816'
    });

    const h = document.createElement('h3');
    h.textContent = title;
    Object.assign(h.style, {
      margin: '0 0 10px',
      fontSize: '18px',
      fontWeight: '800',
      textAlign: 'center'
    });

    const p = document.createElement('p');
    p.textContent = content;
    Object.assign(p.style, {
      margin: '0 0 18px',
      fontSize: '14px',
      lineHeight: '1.6',
      textAlign: 'center',
      color: '#6e4532'
    });

    const actions = document.createElement('div');
    Object.assign(actions.style, {
      display: 'flex',
      gap: '10px'
    });

    const finish = (confirmed) => {
      backdrop.remove();
      resolve(confirmed);
    };

    if (showCancel) {
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = cancelText;
      Object.assign(cancelBtn.style, {
        flex: '1',
        height: '42px',
        borderRadius: '14px',
        border: '1.5px solid #d4b8a6',
        background: '#f7eee5',
        color: '#6b4534',
        fontSize: '14px',
        fontWeight: '700',
        cursor: 'pointer'
      });
      cancelBtn.addEventListener('click', () => finish(false));
      actions.appendChild(cancelBtn);
    }

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.textContent = confirmText;
    Object.assign(okBtn.style, {
      flex: '1',
      height: '42px',
      borderRadius: '14px',
      border: 'none',
      background: confirmColor,
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: '800',
      cursor: 'pointer'
    });
    okBtn.addEventListener('click', () => finish(true));
    actions.appendChild(okBtn);

    card.append(h, p, actions);
    backdrop.appendChild(card);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && showCancel) finish(false);
    });
    document.body.appendChild(backdrop);
  });
}

export function vibrateLight() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(15);
    }
  } catch (_) {}
}
