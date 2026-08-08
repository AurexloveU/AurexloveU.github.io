/* Aurex 计划台 · 通用工具 */
'use strict';

const U = {
  pad2(n) { return String(n).padStart(2, '0'); },

  /** Date -> 'YYYY-MM-DD'(本地时区) */
  fmt(d) { return `${d.getFullYear()}-${U.pad2(d.getMonth() + 1)}-${U.pad2(d.getDate())}`; },

  /** 'YYYY-MM-DD' -> Date(本地时区零点) */
  parse(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    return new Date(y, m - 1, d);
  },

  todayStr() { return U.fmt(new Date()); },

  addDays(ds, n) {
    const d = U.parse(ds);
    d.setDate(d.getDate() + n);
    return U.fmt(d);
  },

  diffDays(a, b) {
    return Math.round((U.parse(b) - U.parse(a)) / 86400000);
  },

  /** 星期,0=周一 … 6=周日 */
  dowMon(ds) { return (U.parse(ds).getDay() + 6) % 7; },

  /** 所在周的周一 */
  weekStart(ds) { return U.addDays(ds, -U.dowMon(ds)); },

  monthLabel(ds) {
    const d = U.parse(ds);
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
  },

  DOW_CN: ['一', '二', '三', '四', '五', '六', '日'],

  dateLabel(ds) {
    const d = U.parse(ds);
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${U.DOW_CN[U.dowMon(ds)]}`;
  },

  /** 相对称呼:今天/明天/昨天,否则短日期 */
  relLabel(ds) {
    const diff = U.diffDays(U.todayStr(), ds);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    if (diff === -1) return '昨天';
    const d = U.parse(ds);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },

  uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  },

  esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  debounce(fn, ms) {
    let t = null;
    const wrapped = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => { t = null; fn(...args); }, ms);
    };
    wrapped.cancel = () => clearTimeout(t);
    return wrapped;
  },

  toast(msg, ms = 2400) {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.classList.add('fade'), ms);
    setTimeout(() => el.remove(), ms + 500);
  },

  clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); },
};
