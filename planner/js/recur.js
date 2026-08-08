/* Aurex 计划台 · 重复规则:某任务在某天是否出现 / 是否完成 */
'use strict';

const Recur = {
  /** 任务 t 是否在 ds 这天出现(不含删除判断之外的过滤) */
  occursOn(t, ds) {
    if (t.deleted) return false;
    if (!t.repeat) return t.date === ds;
    if (ds < t.date) return false;
    const r = t.repeat;
    if (r.type === 'daily') return true;
    if (r.type === 'weekly') {
      const days = (r.days && r.days.length) ? r.days : [U.dowMon(t.date)];
      return days.includes(U.dowMon(ds));
    }
    if (r.type === 'interval') {
      const n = Math.max(1, r.n | 0);
      return U.diffDays(t.date, ds) % n === 0;
    }
    return false;
  },

  /** 这一天的这次出现是否已完成 */
  isDoneOn(t, ds) {
    if (t.repeat) return !!(t.doneDates && t.doneDates[ds]);
    return !!t.done;
  },

  /** 勾选 / 取消勾选某天的出现(直接改对象,须在 Store.commit 内调用) */
  setDoneOn(t, ds, val) {
    if (t.repeat) {
      t.doneDates = t.doneDates || {};
      if (val) t.doneDates[ds] = Date.now();
      else delete t.doneDates[ds];
    } else {
      t.done = val;
      t.doneAt = val ? Date.now() : null;
      t.progress = val ? 100 : 0;
    }
    Store.touch(t);
  },

  /** 某天的全部出现(含已完成),按象限+优先级+order 排序 */
  tasksOn(ds) {
    const PR = { high: 0, mid: 1, low: 2 };
    return Store.active()
      .filter(t => Recur.occursOn(t, ds))
      .sort((a, b) =>
        (a.quadrant - b.quadrant) ||
        (PR[a.priority] - PR[b.priority]) ||
        ((a.order || 0) - (b.order || 0)));
  },

  /** 某天某象限的出现,按 order 排序(象限视图用) */
  tasksOnQuadrant(ds, q) {
    return Store.active()
      .filter(t => t.quadrant === q && Recur.occursOn(t, ds))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  /** 逾期未完成:截止日或安排日早于今天的非重复未完成任务 */
  overdue(todayDs) {
    return Store.active().filter(t => {
      if (t.repeat || t.done) return false;
      const ref = t.due || t.date;
      return ref && ref < todayDs;
    }).sort((a, b) => (a.due || a.date).localeCompare(b.due || b.date));
  },

  repeatLabel(t) {
    if (!t.repeat) return '';
    const r = t.repeat;
    if (r.type === 'daily') return '每日';
    if (r.type === 'weekly') {
      const days = (r.days && r.days.length) ? r.days : [U.dowMon(t.date)];
      return '每周' + days.map(d => U.DOW_CN[d]).join('');
    }
    if (r.type === 'interval') return `每 ${Math.max(1, r.n | 0)} 天`;
    return '';
  },
};
