/* Aurex 计划台 · 数据仓库:localStorage 持久化 + 撤销/重做 */
'use strict';

const Store = (() => {
  const KEY = 'aurex-planner-v1';
  const UNDO_MAX = 60;
  const TOMBSTONE_DAYS = 30;

  const state = {
    tasks: [],
    settings: {
      theme: 'auto',          // auto | light | dark
      apiBase: '',
      syncEnabled: false,
      seeded: false,
    },
  };

  const undoStack = []; // { label, tasks(json string) }
  const redoStack = [];
  const listeners = [];

  /* ---------- 持久化 ---------- */

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.tasks)) state.tasks = data.tasks;
        if (data.settings) Object.assign(state.settings, data.settings);
      }
    } catch (e) {
      console.warn('本地数据读取失败,使用空白状态', e);
    }
    purgeTombstones();
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ tasks: state.tasks, settings: state.settings }));
    } catch (e) {
      console.warn('本地保存失败', e);
      U.toast('本地存储已满或不可用,数据可能不会保存');
    }
  }

  function purgeTombstones() {
    const cutoff = Date.now() - TOMBSTONE_DAYS * 86400000;
    state.tasks = state.tasks.filter(t => !t.deleted || (t.updatedAt || 0) > cutoff);
  }

  /* ---------- 变更(经过这里的修改才可撤销) ---------- */

  function commit(label, fn) {
    undoStack.push({ label, tasks: JSON.stringify(state.tasks) });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    redoStack.length = 0;
    fn(state);
    save();
    emit();
  }

  /** 静默替换(同步合并用,不进撤销栈) */
  function replaceTasks(tasks) {
    state.tasks = tasks;
    save();
    emit();
  }

  function saveSettings() { save(); emit(); }

  function undo() {
    const item = undoStack.pop();
    if (!item) { U.toast('没有可撤销的操作'); return; }
    redoStack.push({ label: item.label, tasks: JSON.stringify(state.tasks) });
    state.tasks = JSON.parse(item.tasks);
    save();
    emit();
    U.toast(`已撤销:${item.label}`);
  }

  function redo() {
    const item = redoStack.pop();
    if (!item) { U.toast('没有可重做的操作'); return; }
    undoStack.push({ label: item.label, tasks: JSON.stringify(state.tasks) });
    state.tasks = JSON.parse(item.tasks);
    save();
    emit();
    U.toast(`已重做:${item.label}`);
  }

  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(fn => fn()); }

  /* ---------- 查询 ---------- */

  function active() { return state.tasks.filter(t => !t.deleted); }
  function byId(id) { return state.tasks.find(t => t.id === id); }

  function nextOrder() {
    return active().reduce((m, t) => Math.max(m, t.order || 0), 0) + 10;
  }

  /* ---------- 任务工厂 ---------- */

  function makeTask(props = {}) {
    const now = Date.now();
    return Object.assign({
      id: U.uid(),
      title: '未命名任务',
      notes: '',
      quadrant: 2,
      priority: 'mid',          // high | mid | low
      tags: [],
      date: U.todayStr(),       // 安排日(重复任务的起始日)
      due: null,                // 截止日
      progress: 0,
      repeat: null,             // null | {type:'daily'} | {type:'weekly',days:[0..6]} | {type:'interval',n}
      done: false,
      doneAt: null,
      doneDates: {},            // 重复任务:{ 'YYYY-MM-DD': 时间戳 }
      order: nextOrder(),
      createdAt: now,
      updatedAt: now,
      deleted: false,
    }, props);
  }

  function touch(t) { t.updatedAt = Date.now(); }

  /* ---------- 示例数据 ---------- */

  function seedDemo() {
    const today = U.todayStr();
    const demo = [
      makeTask({ title: '给母站写一篇新日志', quadrant: 1, priority: 'high', tags: ['写作'], date: today, due: U.addDays(today, 1), progress: 40 }),
      makeTask({ title: '规划下个月的塔罗专栏', quadrant: 2, priority: 'mid', tags: ['灵感'], date: today }),
      makeTask({ title: '晨间拉伸十分钟', quadrant: 2, priority: 'low', tags: ['自护'], date: today, repeat: { type: 'daily' } }),
      makeTask({ title: '回复积攒的留言', quadrant: 3, priority: 'mid', tags: ['社交'], date: today }),
      makeTask({ title: '整理素材收藏夹', quadrant: 4, priority: 'low', tags: ['杂事'], date: U.addDays(today, 2) }),
      makeTask({ title: '周更进度检查', quadrant: 2, priority: 'mid', tags: ['写作'], date: today, repeat: { type: 'weekly', days: [0, 3] } }),
    ];
    // 补一点历史完成记录,让热力图不至于空白
    for (let i = 1; i <= 12; i++) {
      const ds = U.addDays(today, -i);
      if (i % 3 === 0) continue;
      const t = makeTask({
        title: `示例·过去的小事 ${i}`, quadrant: (i % 4) + 1, priority: 'low',
        tags: ['示例'], date: ds, done: true, doneAt: U.parse(ds).getTime() + 12 * 3600000, progress: 100,
      });
      demo.push(t);
    }
    state.tasks = state.tasks.concat(demo);
    state.settings.seeded = true;
    save();
    emit();
  }

  function clearAll() {
    state.tasks = [];
    undoStack.length = 0;
    redoStack.length = 0;
    save();
    emit();
  }

  return {
    state, load, save, commit, replaceTasks, saveSettings,
    undo, redo, onChange,
    active, byId, makeTask, touch, nextOrder,
    seedDemo, clearAll,
    get undoCount() { return undoStack.length; },
    get redoCount() { return redoStack.length; },
  };
})();
