/* Aurex 计划台 · 应用主控:事件 / 拖拽 / 键盘 / 弹窗 / 主题 */
'use strict';

const App = {
  ui: {
    view: 'today',          // today | day | week | month | stats
    date: U.todayStr(),
    monthExpand: null,
  },

  /* ================= 初始化 ================= */

  init() {
    Store.load();
    if (!Store.state.settings.seeded && Store.active().length === 0) {
      Store.seedDemo();
      setTimeout(() => U.toast('已载入示例数据,可在设置中清空 ✧'), 600);
    }
    App.applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (Store.state.settings.theme === 'auto') App.applyTheme();
    });

    Store.onChange(() => App.render());
    App.bindEvents();
    App.render();
    Sync.setStatus(Sync.enabled() ? 'busy' : 'offline');
    Sync.start();
  },

  /* ================= 渲染 ================= */

  render() {
    document.querySelectorAll('.tab').forEach(b =>
      b.classList.toggle('active', b.dataset.view === App.ui.view));
    Views.render(document.getElementById('view-root'));
    const ub = document.getElementById('btn-undo'), rb = document.getElementById('btn-redo');
    if (ub) ub.disabled = Store.undoCount === 0;
    if (rb) rb.disabled = Store.redoCount === 0;
  },

  /* ================= 主题 ================= */

  applyTheme() {
    const s = Store.state.settings.theme;
    const dark = s === 'dark' || (s === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#1b1926' : '#f6f4f9';
  },

  toggleTheme() {
    const dark = document.documentElement.dataset.theme === 'dark';
    Store.state.settings.theme = dark ? 'light' : 'dark';
    Store.saveSettings();
    App.applyTheme();
    U.toast(dark ? '已切换到浅色 ☀' : '已切换到深色 ☾');
  },

  /* ================= 日期导航 ================= */

  navigate(dir) { // dir: -1 | 0(今天) | 1
    const v = App.ui.view;
    if (dir === 0) {
      App.ui.date = U.todayStr();
      if (v === 'month') App.ui.monthExpand = null;
    } else if (v === 'week') {
      App.ui.date = U.addDays(U.weekStart(App.ui.date), dir * 7);
    } else if (v === 'month') {
      const d = U.parse(App.ui.date);
      App.ui.date = U.fmt(new Date(d.getFullYear(), d.getMonth() + dir, 1));
      App.ui.monthExpand = null;
    } else {
      App.ui.date = U.addDays(App.ui.date, dir);
    }
    App.render();
  },

  setView(v) {
    App.ui.view = v;
    App.render();
  },

  /* ================= 快速添加 ================= */

  quickAddBase() {
    return (App.ui.view === 'day' || App.ui.view === 'week' || App.ui.view === 'month')
      ? App.ui.date : U.todayStr();
  },

  submitQuickAdd(input) {
    const line = input.value.trim();
    if (!line) return;
    const { title, props } = QuickAdd.parse(line, App.quickAddBase());
    if (!title) { U.toast('请输入任务内容(标记之外还需要一个标题)'); return; }
    Store.commit('添加任务', () => {
      Store.state.tasks.push(Store.makeTask(Object.assign({ title }, props)));
    });
    input.value = '';
    U.toast(`已添加「${title}」`);
  },

  focusQuickAdd(prefill) {
    const el = document.getElementById('quickadd');
    if (!el) return;
    if (prefill !== undefined) el.value = prefill;
    el.focus();
    el.setSelectionRange(0, 0);
  },

  /* ================= 任务操作 ================= */

  toggleDone(id, ds) {
    const t = Store.byId(id);
    if (!t) return;
    const to = !Recur.isDoneOn(t, ds);
    Store.commit(to ? '完成任务' : '取消完成', () => Recur.setDoneOn(t, ds, to));
  },

  bumpProgress(id) {
    const t = Store.byId(id);
    if (!t || t.repeat) return;
    Store.commit('调整进度', () => {
      t.progress = t.progress >= 100 ? 0 : Math.min(100, (t.progress || 0) + 25);
      if (t.progress >= 100) { t.done = true; t.doneAt = Date.now(); }
      else if (t.done) { t.done = false; t.doneAt = null; }
      Store.touch(t);
    });
  },

  deleteTask(id) {
    const t = Store.byId(id);
    if (!t) return;
    Store.commit('删除任务', () => { t.deleted = true; Store.touch(t); });
    U.toast(`已删除「${t.title}」,Ctrl+Z 可撤销`);
  },

  deferToTomorrow(id) {
    const t = Store.byId(id);
    if (!t || t.repeat) return;
    Store.commit('顺延任务', () => { t.date = U.addDays(U.todayStr(), 1); Store.touch(t); });
    U.toast('已顺延到明天,今天先放过自己');
  },

  deferAllOverdue() {
    const list = Recur.overdue(U.todayStr());
    if (!list.length) return;
    Store.commit('顺延逾期任务', () => {
      for (const t of list) { t.date = U.todayStr(); Store.touch(t); }
    });
    U.toast(`已把 ${list.length} 件逾期任务移到今天`);
  },

  /* ================= 事件绑定 ================= */

  bindEvents() {
    /* --- 顶栏静态按钮 --- */
    document.querySelectorAll('.tab').forEach(b =>
      b.addEventListener('click', () => App.setView(b.dataset.view)));
    document.getElementById('btn-undo').addEventListener('click', () => Store.undo());
    document.getElementById('btn-redo').addEventListener('click', () => Store.redo());
    document.getElementById('btn-ics').addEventListener('click', () => ICS.download());
    document.getElementById('btn-theme').addEventListener('click', () => App.toggleTheme());
    document.getElementById('btn-help').addEventListener('click', () => App.openHelp());
    document.getElementById('btn-settings').addEventListener('click', () => App.openSettings());

    const qa = document.getElementById('quickadd');
    qa.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); App.submitQuickAdd(qa); }
      if (e.key === 'Escape') qa.blur();
    });

    /* --- 主区点击(事件委托) --- */
    document.getElementById('view-root').addEventListener('click', e => App.onViewClick(e));
    document.getElementById('view-root').addEventListener('change', e => {
      if (e.target.id === 'jump-date' && e.target.value) {
        App.ui.date = e.target.value;
        App.render();
      }
    });

    /* --- 拖拽 --- */
    App.bindDnD();

    /* --- 键盘 --- */
    document.addEventListener('keydown', e => App.onKeydown(e));
  },

  onViewClick(e) {
    const actEl = e.target.closest('[data-act]');
    const card = e.target.closest('.task-card');
    if (!actEl && !card) return;
    const act = actEl ? actEl.dataset.act : null;

    if (card && act) {
      const id = card.dataset.id, ds = card.dataset.ds;
      if (act === 'toggle') return App.toggleDone(id, ds);
      if (act === 'progress') return App.bumpProgress(id);
      if (act === 'edit') return App.openEdit(id);
      if (act === 'del') return App.deleteTask(id);
    }
    if (!act) { // 点卡片空白处 → 编辑
      if (card) App.openEdit(card.dataset.id);
      return;
    }

    switch (act) {
      case 'nav-prev': return App.navigate(-1);
      case 'nav-next': return App.navigate(1);
      case 'nav-today': return App.navigate(0);
      case 'goto-day':
        App.ui.date = actEl.dataset.date;
        App.ui.view = 'day';
        return App.render();
      case 'month-cell': {
        const ds = actEl.dataset.date;
        App.ui.date = ds;
        App.ui.monthExpand = (App.ui.monthExpand === ds) ? null : ds;
        return App.render();
      }
      case 'month-collapse':
        App.ui.monthExpand = null;
        return App.render();
      case 'q-add':
        return App.focusQuickAdd(`  !${actEl.dataset.q} @${actEl.dataset.date}`);
      case 'focus-done': {
        const id = actEl.dataset.id;
        return App.toggleDone(id, U.todayStr());
      }
      case 'focus-defer': return App.deferToTomorrow(actEl.dataset.id);
      case 'focus-edit': return App.openEdit(actEl.dataset.id);
      case 'defer-all': return App.deferAllOverdue();
    }
  },

  onKeydown(e) {
    const tag = e.target.tagName;
    const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable;

    if (e.key === 'Escape') {
      if (App.closeModal()) return;
      if (editing) e.target.blur();
      return;
    }
    if (editing) return;

    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); return Store.undo(); }
    if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); return Store.redo(); }
    if (mod || e.altKey) return;

    switch (e.key) {
      case 'n': case 'N': case '/': e.preventDefault(); return App.focusQuickAdd();
      case '1': return App.setView('today');
      case '2': return App.setView('day');
      case '3': return App.setView('week');
      case '4': return App.setView('month');
      case '5': return App.setView('stats');
      case 't': case 'T': return App.navigate(0);
      case 'ArrowLeft': e.preventDefault(); return App.navigate(-1);
      case 'ArrowRight': e.preventDefault(); return App.navigate(1);
      case 'e': case 'E': return ICS.download();
      case 'd': case 'D': return App.toggleTheme();
      case '?': return App.openHelp();
    }
  },

  /* ================= 拖拽(HTML5 DnD,事件委托) ================= */

  dnd: { id: null, fromDs: null, ph: null, lastZone: null },

  bindDnD() {
    const root = document.getElementById('view-root');

    root.addEventListener('dragstart', e => {
      const card = e.target.closest('.task-card');
      if (!card) return;
      App.dnd.id = card.dataset.id;
      App.dnd.fromDs = card.dataset.ds;
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => card.classList.add('dragging'), 0);
    });

    root.addEventListener('dragend', () => App.cleanupDnD());

    root.addEventListener('dragover', e => {
      if (!App.dnd.id) return;
      const zone = e.target.closest('.dropzone');
      if (!zone) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (App.dnd.lastZone && App.dnd.lastZone !== zone) App.dnd.lastZone.classList.remove('drag-over');
      App.dnd.lastZone = zone;
      zone.classList.add('drag-over');

      if (zone.classList.contains('month-cell')) { // 月历格子:整格接收,不放占位条
        if (App.dnd.ph) App.dnd.ph.remove();
        return;
      }
      if (!App.dnd.ph) {
        App.dnd.ph = document.createElement('div');
        App.dnd.ph.className = 'drop-placeholder';
      }
      const cards = [...zone.querySelectorAll(':scope > .task-card:not(.dragging)')];
      let before = null;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { before = c; break; }
      }
      if (before) zone.insertBefore(App.dnd.ph, before);
      else zone.appendChild(App.dnd.ph);
    });

    root.addEventListener('drop', e => {
      if (!App.dnd.id) return;
      const zone = e.target.closest('.dropzone');
      if (!zone) return App.cleanupDnD();
      e.preventDefault();
      App.handleDrop(zone);
      App.cleanupDnD();
    });
  },

  cleanupDnD() {
    if (App.dnd.ph) App.dnd.ph.remove();
    if (App.dnd.lastZone) App.dnd.lastZone.classList.remove('drag-over');
    document.querySelectorAll('.task-card.dragging').forEach(c => c.classList.remove('dragging'));
    App.dnd.id = App.dnd.fromDs = App.dnd.ph = App.dnd.lastZone = null;
  },

  handleDrop(zone) {
    const t = Store.byId(App.dnd.id);
    if (!t) return;
    const newQ = zone.dataset.q ? +zone.dataset.q : null;
    const zoneDate = zone.dataset.date || null;
    const wantsDateChange = zoneDate && zoneDate !== t.date && !t.repeat;
    const repeatDateBlocked = zoneDate && t.repeat && !Recur.occursOn(t, zoneDate);

    // 计算插入位置(占位条前有几张卡)
    let prevEl = App.dnd.ph ? App.dnd.ph.previousElementSibling : null;
    while (prevEl && !(prevEl.classList.contains('task-card') && !prevEl.classList.contains('dragging'))) {
      prevEl = prevEl.previousElementSibling;
    }
    let nextEl = App.dnd.ph ? App.dnd.ph.nextElementSibling : null;
    while (nextEl && !(nextEl.classList.contains('task-card') && !nextEl.classList.contains('dragging'))) {
      nextEl = nextEl.nextElementSibling;
    }
    const prev = prevEl ? Store.byId(prevEl.dataset.id) : null;
    const next = nextEl ? Store.byId(nextEl.dataset.id) : null;

    const quadChanged = newQ && newQ !== t.quadrant;
    const orderChanges = prev || next;
    if (!quadChanged && !wantsDateChange && !orderChanges) {
      if (repeatDateBlocked) U.toast('重复任务的日期由规则决定,可在「编辑」中改起始日或规则');
      return;
    }

    Store.commit('移动任务', () => {
      if (newQ) t.quadrant = newQ;
      if (wantsDateChange) t.date = zoneDate;
      if (prev && next) t.order = ((prev.order || 0) + (next.order || 0)) / 2;
      else if (prev) t.order = (prev.order || 0) + 10;
      else if (next) t.order = (next.order || 0) - 10;
      Store.touch(t);
    });
    if (repeatDateBlocked) U.toast('已移动象限;重复任务的日期请在「编辑」中调整规则');
  },

  /* ================= 弹窗 ================= */

  closeModal() {
    const m = document.querySelector('.modal-backdrop');
    if (m) { m.remove(); return true; }
    return false;
  },

  openModal(innerHTML) {
    App.closeModal();
    const bg = document.createElement('div');
    bg.className = 'modal-backdrop';
    bg.innerHTML = `<div class="modal">${innerHTML}</div>`;
    bg.addEventListener('mousedown', e => { if (e.target === bg) App.closeModal(); });
    document.body.appendChild(bg);
    return bg;
  },

  /* --- 编辑任务 --- */

  openEdit(id) {
    const t = Store.byId(id);
    if (!t) return;
    const r = t.repeat || {};
    const weeklyDays = (r.type === 'weekly' && r.days && r.days.length) ? r.days : [U.dowMon(t.date)];

    const bg = App.openModal(`
      <h3>编辑任务</h3>
      <div class="form-grid">
        <div class="field full"><label>标题</label>
          <input type="text" id="f-title" value="${U.esc(t.title)}"></div>
        <div class="field full"><label>备注</label>
          <textarea id="f-notes">${U.esc(t.notes)}</textarea></div>
        <div class="field"><label>象限</label>
          <select id="f-quadrant">
            ${[1, 2, 3, 4].map(q => `<option value="${q}" ${t.quadrant === q ? 'selected' : ''}>Q${q} ${Views.Q_META[q].title}</option>`).join('')}
          </select></div>
        <div class="field"><label>优先级</label>
          <select id="f-priority">
            ${['high', 'mid', 'low'].map(p => `<option value="${p}" ${t.priority === p ? 'selected' : ''}>${Views.PRIO_CN[p]}</option>`).join('')}
          </select></div>
        <div class="field"><label>安排日${t.repeat ? '(重复起始)' : ''}</label>
          <input type="date" id="f-date" value="${t.date || ''}"></div>
        <div class="field"><label>截止日(可空)</label>
          <input type="date" id="f-due" value="${t.due || ''}"></div>
        <div class="field full"><label>标签(空格或逗号分隔)</label>
          <input type="text" id="f-tags" value="${U.esc((t.tags || []).join(' '))}" placeholder="写作 灵感"></div>
        <div class="field full" id="f-progress-wrap" ${t.repeat ? 'style="display:none"' : ''}>
          <label>进度 <span class="range-val" id="f-progress-val">${t.progress || 0}%</span></label>
          <input type="range" id="f-progress" min="0" max="100" step="5" value="${t.progress || 0}"></div>
        <div class="field"><label>重复</label>
          <select id="f-repeat">
            <option value="" ${!t.repeat ? 'selected' : ''}>不重复</option>
            <option value="daily" ${r.type === 'daily' ? 'selected' : ''}>每日</option>
            <option value="weekly" ${r.type === 'weekly' ? 'selected' : ''}>每周(选星期)</option>
            <option value="interval" ${r.type === 'interval' ? 'selected' : ''}>每 N 天</option>
          </select></div>
        <div class="field" id="f-interval-wrap" ${r.type === 'interval' ? '' : 'style="display:none"'}>
          <label>间隔天数 N</label>
          <input type="number" id="f-interval" min="1" max="365" value="${r.n || 2}"></div>
        <div class="field full" id="f-weekly-wrap" ${r.type === 'weekly' ? '' : 'style="display:none"'}>
          <label>每周的哪几天</label>
          <div class="weekday-picker" id="f-weekdays">
            ${U.DOW_CN.map((w, i) => `<button type="button" data-d="${i}" class="${weeklyDays.includes(i) ? 'on' : ''}">${w}</button>`).join('')}
          </div></div>
      </div>
      <div class="modal-actions">
        <button class="btn danger left" id="f-delete">删除</button>
        <button class="btn" id="f-cancel">取消</button>
        <button class="btn primary" id="f-save">保存</button>
      </div>`);

    const $ = sel => bg.querySelector(sel);
    $('#f-repeat').addEventListener('change', () => {
      const v = $('#f-repeat').value;
      $('#f-weekly-wrap').style.display = v === 'weekly' ? '' : 'none';
      $('#f-interval-wrap').style.display = v === 'interval' ? '' : 'none';
      $('#f-progress-wrap').style.display = v ? 'none' : '';
    });
    $('#f-progress').addEventListener('input', () => {
      $('#f-progress-val').textContent = $('#f-progress').value + '%';
    });
    $('#f-weekdays').addEventListener('click', e => {
      const b = e.target.closest('button[data-d]');
      if (b) b.classList.toggle('on');
    });
    $('#f-cancel').addEventListener('click', () => App.closeModal());
    $('#f-delete').addEventListener('click', () => { App.closeModal(); App.deleteTask(id); });
    $('#f-save').addEventListener('click', () => {
      const title = $('#f-title').value.trim();
      if (!title) { U.toast('标题不能为空'); return; }
      const repeatType = $('#f-repeat').value;
      let repeat = null;
      if (repeatType === 'daily') repeat = { type: 'daily' };
      else if (repeatType === 'weekly') {
        const days = [...bg.querySelectorAll('#f-weekdays button.on')].map(b => +b.dataset.d).sort((a, b2) => a - b2);
        repeat = { type: 'weekly', days };
      } else if (repeatType === 'interval') {
        repeat = { type: 'interval', n: U.clamp(+$('#f-interval').value || 2, 1, 365) };
      }
      Store.commit('编辑任务', () => {
        t.title = title;
        t.notes = $('#f-notes').value.trim();
        t.quadrant = +$('#f-quadrant').value;
        t.priority = $('#f-priority').value;
        t.date = $('#f-date').value || U.todayStr();
        t.due = $('#f-due').value || null;
        t.tags = $('#f-tags').value.split(/[,,\s]+/).map(s => s.replace(/^#/, '').trim()).filter(Boolean);
        t.repeat = repeat;
        if (!repeat) t.progress = +$('#f-progress').value || 0;
        if (!repeat && t.progress >= 100 && !t.done) { t.done = true; t.doneAt = Date.now(); }
        if (!repeat && t.progress < 100 && t.done) { t.done = false; t.doneAt = null; }
        Store.touch(t);
      });
      App.closeModal();
    });
    $('#f-title').focus();
  },

  /* --- 设置 --- */

  openSettings() {
    const s = Store.state.settings;
    const bg = App.openModal(`
      <h3>设置</h3>
      <div class="form-grid">
        <div class="field full"><label>主题</label>
          <select id="s-theme">
            <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>跟随系统</option>
            <option value="light" ${s.theme === 'light' ? 'selected' : ''}>浅色 · 薰衣草晨雾</option>
            <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>深色 · 薰衣草夜色</option>
          </select></div>
        <div class="field full"><label>后端 API 地址(可空,留空则纯本地)</label>
          <input type="url" id="s-api" value="${U.esc(s.apiBase)}" placeholder="http://localhost:8787"></div>
        <div class="field full"><label>
          <input type="checkbox" id="s-sync" ${s.syncEnabled ? 'checked' : ''} style="width:auto;margin-right:6px">
          启用同步(按修改时间双向合并,离线照常工作)</label>
          <button class="btn small" id="s-test" style="margin-top:6px">测试连接</button>
          <span id="s-test-result" style="font-size:.8rem;color:var(--muted);margin-left:8px"></span>
        </div>
      </div>
      <div class="help-sec">数 据</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn small" id="s-seed">载入示例数据</button>
        <button class="btn small" id="s-export">导出 .ics</button>
        <button class="btn small danger" id="s-clear">清空全部数据</button>
      </div>
      <div class="modal-actions">
        <button class="btn" id="s-cancel">取消</button>
        <button class="btn primary" id="s-save">保存</button>
      </div>`);

    const $ = sel => bg.querySelector(sel);
    $('#s-test').addEventListener('click', async () => {
      const out = $('#s-test-result');
      out.textContent = '连接中…';
      try {
        const info = await Sync.testConnection($('#s-api').value.trim());
        out.textContent = `✓ 已连通(${info.tasks ?? '?'} 条任务)`;
      } catch (err) {
        out.textContent = '✗ 无法连接:' + err.message;
      }
    });
    $('#s-seed').addEventListener('click', () => { Store.seedDemo(); U.toast('已载入示例数据'); });
    $('#s-export').addEventListener('click', () => ICS.download());
    $('#s-clear').addEventListener('click', () => {
      if (confirm('确定清空全部任务数据吗?此操作不可撤销。')) {
        Store.clearAll();
        App.closeModal();
        U.toast('已清空,一切从头开始');
      }
    });
    $('#s-cancel').addEventListener('click', () => App.closeModal());
    $('#s-save').addEventListener('click', () => {
      Store.state.settings.theme = $('#s-theme').value;
      Store.state.settings.apiBase = $('#s-api').value.trim();
      Store.state.settings.syncEnabled = $('#s-sync').checked;
      Store.saveSettings();
      App.applyTheme();
      App.closeModal();
      Sync.setStatus(Sync.enabled() ? 'busy' : 'offline');
      Sync.start();
      U.toast('设置已保存');
    });
  },

  /* --- 帮助 --- */

  openHelp() {
    App.openModal(`
      <h3>快捷键 & 快速添加语法</h3>
      <div class="help-sec">键 盘</div>
      <table class="help-table">
        <tr><td><kbd>N</kbd> / <kbd>/</kbd></td><td>聚焦快速添加框</td></tr>
        <tr><td><kbd>1</kbd>–<kbd>5</kbd></td><td>切换视图:今日 / 象限 / 周 / 月 / 统计</td></tr>
        <tr><td><kbd>T</kbd></td><td>回到今天</td></tr>
        <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>上/下 一天·一周·一月(随视图)</td></tr>
        <tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>撤销 · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> 重做</td></tr>
        <tr><td><kbd>E</kbd></td><td>导出 .ics 日历</td></tr>
        <tr><td><kbd>D</kbd></td><td>切换深浅主题</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>关闭弹窗 / 离开输入框</td></tr>
      </table>
      <div class="help-sec">快 速 添 加(可组合,顺序随意)</div>
      <table class="help-table">
        <tr><td><code class="qk">#标签</code></td><td>加标签,可多个:<code class="qk">#写作 #灵感</code></td></tr>
        <tr><td><code class="qk">!1 … !4</code></td><td>象限:1 重要紧急 · 2 重要不紧急 · 3 紧急不重要 · 4 都不</td></tr>
        <tr><td><code class="qk">p:高/中/低</code></td><td>优先级</td></tr>
        <tr><td><code class="qk">@明天</code></td><td>安排日:@今天 @后天 @周五 @08-15 @+3(三天后)</td></tr>
        <tr><td><code class="qk">due:周日</code></td><td>截止日,语法同上</td></tr>
        <tr><td><code class="qk">r:日</code></td><td>重复:r:日 · r:周一三五 · r:3天</td></tr>
        <tr><td><code class="qk">%40</code></td><td>初始进度 40%</td></tr>
      </table>
      <div class="help-sec">小 提 示</div>
      <table class="help-table">
        <tr><td>拖拽</td><td>卡片可在象限间、周的天列间、月历格子上拖动;上下拖动可排序</td></tr>
        <tr><td>进度条</td><td>点击卡片上的进度条,每次 +25%,满格自动完成</td></tr>
        <tr><td>数据</td><td>保存在浏览器 localStorage;配置后端后自动双向同步</td></tr>
      </table>
      <div class="modal-actions"><button class="btn primary" onclick="App.closeModal()">知道啦</button></div>`);
  },
};

document.addEventListener('DOMContentLoaded', App.init);
