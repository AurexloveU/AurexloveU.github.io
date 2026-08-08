/* ============================================================
   拾光集 · 应用逻辑
   视图:时间线 / 日历 / 统计与导出 / 编辑器(含专注模式)
   依赖:MD(markdown.js)、Prompts(prompts.js)、Store(store.js)
   ============================================================ */
(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  var esc = MD.escapeHtml;

  /* ============ 常量 ============ */

  var THEMES = [
    { id: 'mist',     name: '晨雾' },
    { id: 'lavender', name: '薰衣草' },
    { id: 'sepia',    name: '旧纸' },
    { id: 'sage',     name: '鼠尾草' },
    { id: 'dusk',     name: '黄昏' },
    { id: 'seasalt',  name: '海盐' },
    { id: 'ink',      name: '水墨' },
    { id: 'night',    name: '夜航' }
  ];

  var MOODS = [
    { id: 'happy',   emoji: '😄', name: '开心', score: 5 },
    { id: 'calm',    emoji: '😌', name: '平静', score: 4 },
    { id: 'tired',   emoji: '🥱', name: '疲惫', score: 3 },
    { id: 'anxious', emoji: '😟', name: '烦躁', score: 2 },
    { id: 'sad',     emoji: '😢', name: '低落', score: 1 }
  ];
  function moodOf(id) {
    for (var i = 0; i < MOODS.length; i++) { if (MOODS[i].id === id) return MOODS[i]; }
    return null;
  }

  var VIEW_TITLES = { timeline: '时间线', calendar: '日历', stats: '统计与导出', editor: '书写' };
  var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  /* ============ 状态 ============ */

  var now = new Date();
  var state = {
    view: 'timeline',
    query: '',
    dateFilter: null,          // 'YYYY-MM-DD' | null
    calY: now.getFullYear(),
    calM: now.getMonth(),
    cur: null,                 // 编辑中的日记对象
    isNewDraft: false,
    saveTimer: null,
    prompt: '',
    mode: 'write'              // 'write' | 'preview'
  };

  /* ============ 日期工具 ============ */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayStr() { return iso(new Date()); }
  function fmtDate(ds) {
    var d = new Date(ds + 'T00:00:00');
    if (isNaN(d)) return ds;
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · ' + WEEKDAYS[d.getDay()];
  }
  function fmtMonth(mk) {
    var p = mk.split('-');
    return p[0] + ' 年 ' + parseInt(p[1], 10) + ' 月';
  }

  function countWords(s) { return String(s || '').replace(/\s/g, '').length; }

  /* ============ 主题 ============ */

  function applyContextTheme() {
    var t = (state.view === 'editor' && state.cur && state.cur.theme)
      ? state.cur.theme
      : Store.settings.theme;
    document.documentElement.setAttribute('data-theme', t);
  }

  function renderThemeList() {
    $('#theme-list').innerHTML = THEMES.map(function (t) {
      return '<button class="swatch' + (Store.settings.theme === t.id ? ' active' : '') +
        '" data-theme-id="' + t.id + '" title="切换到「' + t.name + '」">' + t.name + '</button>';
    }).join('');
  }

  function renderThemeSelect() {
    $('#entry-theme').innerHTML =
      '<option value="">随全局主题</option>' +
      THEMES.map(function (t) { return '<option value="' + t.id + '">' + t.name + '</option>'; }).join('');
  }

  /* ============ 视图切换 ============ */

  function switchView(name) {
    if (state.view === 'editor' && name !== 'editor') closeEditor();
    state.view = name;
    $all('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    $all('#side-nav button').forEach(function (b) { b.classList.toggle('active', b.dataset.view === name); });
    $('#view-title').textContent = VIEW_TITLES[name] || '';
    document.body.classList.remove('side-open');
    applyContextTheme();
    if (name === 'timeline') renderTimeline();
    else if (name === 'calendar') renderCalendar();
    else if (name === 'stats') renderStats();
  }

  /* ============ 搜索与高亮 ============ */

  function regEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function hl(text) {
    var out = esc(text);
    var q = state.query.trim();
    if (!q) return out;
    try {
      return out.replace(new RegExp(regEsc(esc(q)), 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
    } catch (e) { return out; }
  }

  function matches(e, q) {
    var t = q.toLowerCase();
    return (e.title || '').toLowerCase().indexOf(t) >= 0 ||
           (e.body || '').toLowerCase().indexOf(t) >= 0 ||
           (e.tags || []).join(' ').toLowerCase().indexOf(t) >= 0;
  }

  /* ============ 时间线 ============ */

  function sortedEntries() {
    return Store.list().sort(function (a, b) {
      if (a.date === b.date) return (b.updatedAt || 0) - (a.updatedAt || 0);
      return a.date < b.date ? 1 : -1;
    });
  }

  function entryCard(e) {
    var mood = moodOf(e.mood);
    var excerpt = MD.toText(e.body || '').slice(0, 140);
    var tags = (e.tags || []).map(function (t) {
      return '<button class="tag" data-tag="' + esc(t) + '">#' + hl(t) + '</button>';
    }).join('');
    return '<article class="entry-card" data-id="' + e.id + '">' +
      '<div class="entry-head">' +
        (e.title
          ? '<span class="entry-title-txt">' + hl(e.title) + '</span>'
          : '<span class="entry-title-txt untitled">无题</span>') +
        '<span class="entry-date">' + fmtDate(e.date) + '</span>' +
        (mood ? '<span class="entry-mood">' + mood.emoji + ' ' + mood.name + '</span>' : '') +
        (e.pinned ? '<span class="badge pin">置顶</span>' : '') +
      '</div>' +
      (excerpt ? '<p class="entry-excerpt">' + hl(excerpt) + '</p>' : '') +
      ((tags) ? '<div class="entry-foot">' + tags + '</div>' : '') +
      '<button class="entry-star' + (e.fav ? ' on' : '') + '" data-id="' + e.id +
        '" title="' + (e.fav ? '取消收藏' : '收藏') + '">' + (e.fav ? '★' : '☆') + '</button>' +
    '</article>';
  }

  function renderTimeline() {
    renderMemories();

    var q = state.query.trim();
    var df = state.dateFilter;
    var list = sortedEntries();
    if (df) list = list.filter(function (e) { return e.date === df; });
    if (q) list = list.filter(function (e) { return matches(e, q); });

    // 过滤条
    var fb = $('#filter-bar');
    if (q || df) {
      var label = df
        ? '只看 ' + fmtDate(df)
        : '搜索「' + esc(q) + '」';
      fb.innerHTML = '<span>' + label + ' · 共 ' + list.length + ' 篇</span>' +
        '<button class="mini-btn" id="btn-clear-filter">清除</button>';
      fb.hidden = false;
      $('#memories').hidden = true;
    } else {
      fb.hidden = true;
    }

    var html = '';
    var pinned = list.filter(function (e) { return e.pinned; });
    var rest = list.filter(function (e) { return !e.pinned; });

    if (pinned.length) {
      html += '<div class="month-sep">置顶</div>' + pinned.map(entryCard).join('');
    }
    var curMonth = '';
    rest.forEach(function (e) {
      var mk = (e.date || '').slice(0, 7);
      if (mk !== curMonth) { curMonth = mk; html += '<div class="month-sep">' + fmtMonth(mk) + '</div>'; }
      html += entryCard(e);
    });

    if (!list.length) {
      html = '<div class="empty-hint">' + (q || df
        ? '没有找到相关的日记。<br>换个关键词,或点击上方「清除」。'
        : '这里还是一片空白。<br>点击左侧「写一篇」(或按 N 键),从今天开始记录。') + '</div>';
    }
    $('#timeline-list').innerHTML = html;
  }

  /* ============ 那年今日 ============ */

  function renderMemories() {
    var box = $('#memories');
    if (state.query.trim() || state.dateFilter) { box.hidden = true; return; }
    var today = todayStr();
    var mmdd = today.slice(4);            // '-MM-DD'
    var year = parseInt(today.slice(0, 4), 10);
    var mem = Store.list().filter(function (e) {
      return e.date && e.date.slice(4) === mmdd && parseInt(e.date.slice(0, 4), 10) < year;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    if (!mem.length) { box.hidden = true; return; }
    box.innerHTML = '<h3>那年今日</h3>' + mem.map(function (e) {
      var y = parseInt(e.date.slice(0, 4), 10);
      var t = e.title || MD.toText(e.body || '').slice(0, 40) || '无题';
      return '<div class="memory-item" data-id="' + e.id + '">' +
        '<span class="y">' + y + ' · ' + (year - y) + ' 年前</span>' +
        '<span class="t">' + esc(t) + '</span></div>';
    }).join('');
    box.hidden = false;
  }

  /* ============ 日历 ============ */

  function renderCalendar() {
    $('#cal-title').textContent = state.calY + ' 年 ' + (state.calM + 1) + ' 月';

    var byDate = {};
    Store.list().forEach(function (e) {
      (byDate[e.date] = byDate[e.date] || []).push(e);
    });

    var first = new Date(state.calY, state.calM, 1);
    var startIdx = (first.getDay() + 6) % 7;               // 周一开头
    var daysInMonth = new Date(state.calY, state.calM + 1, 0).getDate();
    var cells = Math.ceil((startIdx + daysInMonth) / 7) * 7;
    var today = todayStr();
    var html = '';

    for (var i = 0; i < cells; i++) {
      var d = new Date(state.calY, state.calM, 1 - startIdx + i);
      var ds = iso(d);
      var out = d.getMonth() !== state.calM;
      var list = byDate[ds] || [];
      var cls = 'cal-day' + (out ? ' out' : '') + (list.length ? ' has' : '') + (ds === today ? ' today' : '');
      var inner = '<span class="n">' + d.getDate() + '</span>';
      if (list.length) {
        var withMood = null;
        for (var j = 0; j < list.length; j++) { if (list[j].mood) { withMood = list[j]; break; } }
        inner += withMood
          ? '<span class="m">' + moodOf(withMood.mood).emoji + '</span>'
          : '<span class="dot"></span>';
        if (list.length > 1) inner += '<span class="c">' + list.length + '</span>';
      }
      html += '<div class="' + cls + '" data-date="' + ds + '" data-count="' + list.length + '"' +
        (list.length === 1 ? ' data-id="' + list[0].id + '"' : '') + '>' + inner + '</div>';
    }
    $('#cal-grid').innerHTML = html;
  }

  /* ============ 统计 ============ */

  function calcStreak(entries) {
    var dates = {};
    entries.forEach(function (e) { dates[e.date] = 1; });
    var d = new Date();
    if (!dates[iso(d)]) d.setDate(d.getDate() - 1);
    var streak = 0;
    while (dates[iso(d)]) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }

  function renderStats() {
    var entries = Store.list();
    var words = entries.reduce(function (s, e) { return s + countWords(e.body); }, 0);
    $('#stat-count').textContent = entries.length;
    $('#stat-words').textContent = words;
    $('#stat-streak').textContent = calcStreak(entries);
    $('#stat-fav').textContent = entries.filter(function (e) { return e.fav; }).length;
    renderMoodChart(entries);
    renderMoodDist(entries);
    renderTagCloud(entries);
  }

  function renderMoodChart(entries) {
    var el = $('#mood-chart');
    var days = [];
    var t = new Date();
    for (var i = 29; i >= 0; i--) {
      var d = new Date(t); d.setDate(d.getDate() - i); days.push(iso(d));
    }
    var byDate = {};
    entries.forEach(function (e) {
      var m = moodOf(e.mood);
      if (m) (byDate[e.date] = byDate[e.date] || []).push(m.score);
    });
    var pts = [];
    days.forEach(function (ds, idx) {
      var a = byDate[ds];
      if (a) {
        var avg = a.reduce(function (x, y) { return x + y; }, 0) / a.length;
        pts.push({ i: idx, v: avg, d: ds });
      }
    });
    if (!pts.length) {
      el.innerHTML = '<p class="muted">最近 30 天还没有心情记录。写日记时点选一个表情,曲线会在这里生长。</p>';
      return;
    }

    var W = 640, H = 210, L = 38, R = 14, T = 16, B = 30;
    function x(i) { return L + i * (W - L - R) / 29; }
    function y(v) { return T + (5 - v) * (H - T - B) / 4; }

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="最近 30 天心情曲线">';
    // 横向网格 + 左侧表情刻度
    MOODS.forEach(function (m) {
      var yy = y(m.score);
      svg += '<line x1="' + L + '" y1="' + yy + '" x2="' + (W - R) + '" y2="' + yy +
        '" style="stroke:var(--line);stroke-width:1;stroke-dasharray:2 4"/>' +
        '<text x="' + (L - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="12">' + m.emoji + '</text>';
    });
    // 日期刻度(每 7 天)
    [0, 7, 14, 21, 29].forEach(function (i) {
      svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" ' +
        'style="fill:var(--ink-3)">' + days[i].slice(5).replace('-', '/') + '</text>';
    });
    // 折线
    if (pts.length > 1) {
      svg += '<polyline fill="none" points="' +
        pts.map(function (p) { return x(p.i).toFixed(1) + ',' + y(p.v).toFixed(1); }).join(' ') +
        '" style="stroke:var(--accent);stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>';
    }
    // 数据点
    pts.forEach(function (p) {
      svg += '<circle cx="' + x(p.i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="3.6" ' +
        'style="fill:var(--paper);stroke:var(--accent);stroke-width:2">' +
        '<title>' + fmtDate(p.d) + ' · ' + p.v.toFixed(1) + ' 分</title></circle>';
    });
    svg += '</svg>';
    el.innerHTML = svg;
  }

  function renderMoodDist(entries) {
    var counts = {};
    var total = 0;
    entries.forEach(function (e) { if (e.mood) { counts[e.mood] = (counts[e.mood] || 0) + 1; total++; } });
    if (!total) {
      $('#mood-dist').innerHTML = '<p class="muted">还没有心情记录。</p>';
      return;
    }
    var max = Math.max.apply(null, MOODS.map(function (m) { return counts[m.id] || 0; }));
    $('#mood-dist').innerHTML = MOODS.map(function (m) {
      var c = counts[m.id] || 0;
      var w = max ? Math.round(c / max * 100) : 0;
      return '<div class="dist-row">' +
        '<span class="lb">' + m.emoji + ' ' + m.name + '</span>' +
        '<span class="bar-bg"><span class="bar" style="width:' + w + '%"></span></span>' +
        '<span class="ct">' + c + '</span></div>';
    }).join('');
  }

  function renderTagCloud(entries) {
    var counts = {};
    entries.forEach(function (e) {
      (e.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 24);
    $('#tag-cloud').innerHTML = tags.length
      ? tags.map(function (t) {
          return '<button class="tag" data-tag="' + esc(t) + '">#' + esc(t) +
            ' <span class="ct">×' + counts[t] + '</span></button>';
        }).join('')
      : '<p class="muted">写日记时填上标签,常用的会聚在这里。</p>';
  }

  /* ============ 编辑器 ============ */

  function newEntry(dateStr) {
    return {
      id: Store.newId(),
      date: dateStr || todayStr(),
      title: '', body: '', tags: [],
      mood: null, theme: null,
      pinned: false, fav: false,
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function openEditor(id, presetDate) {
    if (state.view === 'editor' && state.cur) closeEditor();   // 编辑中切换:先保存旧稿
    var e = id ? Store.get(id) : null;
    state.isNewDraft = !e;
    state.cur = e || newEntry(presetDate);
    fillEditor();
    switchView('editor');
    if (state.isNewDraft) $('#entry-body').focus();
  }

  function fillEditor() {
    var c = state.cur;
    $('#entry-date').value = c.date;
    $('#entry-title').value = c.title || '';
    $('#entry-tags').value = (c.tags || []).join(' ');
    $('#entry-body').value = c.body || '';
    $('#entry-theme').value = c.theme || '';
    renderMoodPicker();
    updatePinFav();
    setMode('write');
    state.prompt = Prompts.daily(c.date);
    $('#prompt-text').textContent = state.prompt;
    updateCount();
    setSaveStatus(state.isNewDraft ? '尚未保存' : '未改动', false);
  }

  function renderMoodPicker() {
    var cur = state.cur ? state.cur.mood : null;
    $('#mood-picker').innerHTML = MOODS.map(function (m) {
      return '<button class="mood-btn' + (cur === m.id ? ' on' : '') + '" data-mood="' + m.id +
        '" title="' + m.name + '">' + m.emoji + '</button>';
    }).join('');
  }

  function updatePinFav() {
    var c = state.cur;
    $('#btn-pin').classList.toggle('on', !!c.pinned);
    $('#btn-fav').classList.toggle('on', !!c.fav);
    $('#btn-fav').textContent = c.fav ? '★' : '☆';
  }

  function parseTags(s) {
    var seen = {}, out = [];
    String(s || '').split(/[,,、;;#\s]+/).forEach(function (t) {
      t = t.trim();
      if (t && !seen[t]) { seen[t] = 1; out.push(t); }
    });
    return out;
  }

  function collect() {
    var c = state.cur;
    if (!c) return;
    c.date = $('#entry-date').value || c.date;
    c.title = $('#entry-title').value.trim();
    c.tags = parseTags($('#entry-tags').value);
    c.body = $('#entry-body').value;
  }

  function isEmptyEntry(c) {
    return !c.title && !String(c.body || '').trim() && !(c.tags || []).length && !c.mood;
  }

  function setSaveStatus(text, saved) {
    var el = $('#save-status');
    el.textContent = text;
    el.classList.toggle('saved', !!saved);
  }

  function scheduleSave() {
    setSaveStatus('书写中…', false);
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveNow, 700);
  }

  function saveNow() {
    clearTimeout(state.saveTimer);
    if (!state.cur) return;
    collect();
    var c = state.cur;
    if (isEmptyEntry(c) && !Store.get(c.id)) {
      setSaveStatus('空白,尚未保存', false);
      return;
    }
    Store.upsert(c);
    var t = new Date();
    setSaveStatus('已保存 ' + pad2(t.getHours()) + ':' + pad2(t.getMinutes()) + ':' + pad2(t.getSeconds()), true);
  }

  function closeEditor() {
    clearTimeout(state.saveTimer);
    if (!state.cur) return;
    collect();
    var c = state.cur;
    if (isEmptyEntry(c)) {
      if (Store.get(c.id)) Store.remove(c.id);   // 内容被清空的旧日记视为删除
    } else {
      Store.upsert(c);
    }
    state.cur = null;
    document.body.classList.remove('focus-mode');
  }

  function updateCount() {
    var n = countWords($('#entry-body').value);
    $('#word-count').textContent = n + ' 字';
    $('#read-time').textContent = '约 ' + (n ? Math.max(1, Math.ceil(n / 400)) : 0) + ' 分钟';
  }

  function setMode(mode) {
    state.mode = mode;
    $all('#mode-seg .seg-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    var preview = mode === 'preview';
    if (preview) {
      collect();
      $('#entry-preview').innerHTML =
        MD.toHtml(state.cur.body) || '<p class="muted">这里还没有内容。</p>';
    }
    $('#entry-body').hidden = preview;
    $('#entry-preview').hidden = !preview;
  }

  /* —— 工具栏排版动作 —— */

  function wrapSel(before, after) {
    var ta = $('#entry-body');
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    var sel = v.slice(s, e);
    ta.value = v.slice(0, s) + before + sel + after + v.slice(e);
    var pos = sel ? s + before.length + sel.length + after.length : s + before.length;
    ta.setSelectionRange(pos, pos);
    ta.focus();
    onBodyInput();
  }

  function prefixLines(prefix) {
    var ta = $('#entry-body');
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    var ls = v.lastIndexOf('\n', s - 1) + 1;
    var block = v.slice(ls, e);
    var mod = block.split('\n').map(function (line) { return prefix + line; }).join('\n');
    ta.value = v.slice(0, ls) + mod + v.slice(e);
    ta.setSelectionRange(ls, ls + mod.length);
    ta.focus();
    onBodyInput();
  }

  function insertAtCursor(text) {
    var ta = $('#entry-body');
    var s = ta.selectionStart, v = ta.value;
    ta.value = v.slice(0, s) + text + v.slice(ta.selectionEnd);
    ta.setSelectionRange(s + text.length, s + text.length);
    ta.focus();
    onBodyInput();
  }

  function doFormat(kind) {
    if (state.mode === 'preview') setMode('write');
    switch (kind) {
      case 'bold':   wrapSel('**', '**'); break;
      case 'italic': wrapSel('*', '*'); break;
      case 'code':   wrapSel('`', '`'); break;
      case 'h2':     prefixLines('## '); break;
      case 'quote':  prefixLines('> '); break;
      case 'list':   prefixLines('- '); break;
      case 'hr':     insertAtCursor('\n\n---\n\n'); break;
      case 'link':
        var ta = $('#entry-body');
        var sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
        if (sel) wrapSel('[', '](https://)');
        else insertAtCursor('[链接文字](https://)');
        break;
    }
  }

  function onBodyInput() {
    updateCount();
    scheduleSave();
  }

  /* ============ 导出 ============ */

  function download(name, content, type) {
    var blob = new Blob([content], { type: type + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function entryToMd(e) {
    var mood = moodOf(e.mood);
    var meta = ['- 日期:' + fmtDate(e.date)];
    if (mood) meta.push('- 心情:' + mood.emoji + ' ' + mood.name);
    if ((e.tags || []).length) meta.push('- 标签:' + e.tags.join('、'));
    if (e.fav) meta.push('- 收藏:★');
    return '# ' + (e.title || '无题') + '\n\n' + meta.join('\n') + '\n\n' + (e.body || '').trim() + '\n';
  }

  function exportAllMd() {
    var list = sortedEntries().reverse();   // 按时间正序
    var head = '# 拾光集 · 日记导出\n\n> 共 ' + list.length + ' 篇 · 导出于 ' + fmtDate(todayStr()) + '\n\n---\n\n';
    download('拾光集-' + todayStr() + '.md', head + list.map(entryToMd).join('\n---\n\n'), 'text/markdown');
  }

  function exportAllJson() {
    download('拾光集-' + todayStr() + '.json', JSON.stringify({
      app: '拾光集',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: sortedEntries().reverse()
    }, null, 2), 'application/json');
  }

  /* ============ 后端连接状态 ============ */

  function updateSyncUI() {
    var s = $('#sync-status');
    s.classList.toggle('online', Store.online);
    s.querySelector('.txt').textContent = Store.online ? '已连接后端' : '本地模式';
    $('#api-status').textContent = Store.online
      ? '已连接 ' + Store.base + ':增删改自动同步到后端,启动时双向合并。'
      : '未连接:当前使用浏览器本地存储,功能完整可用。';
  }

  /* ============ 首次运行示例数据 ============ */

  function seedIfFirstRun() {
    if (Store.entries.length || !Store.seededOnce()) return;
    var today = todayStr();
    var lastYear = (parseInt(today.slice(0, 4), 10) - 1) + today.slice(4);
    Store.upsert({
      id: Store.newId(), date: lastYear,
      title: '一年前的今天',
      body: '这是一篇示例日记,用来演示「那年今日」:当往年的同一天存在日记时,时间线顶部会浮出回忆卡片。\n\n把它删掉,换成你自己的故事吧。',
      tags: ['示例'], mood: 'happy', theme: null,
      pinned: false, fav: false,
      createdAt: Date.now() - 86400000, updatedAt: Date.now() - 86400000
    });
    Store.upsert({
      id: Store.newId(), date: today,
      title: '欢迎来到拾光集',
      body: '这是一本**离线可用**的日记本。你现在读到的这篇就是一篇普通日记,看完可以随手删掉。\n\n## 你可以做这些事\n\n- 左侧色板切换 **8 套低饱和主题**;编辑器右上角的下拉框,还能给单篇日记指定专属主题\n- 支持 Markdown:**粗体**、*斜体*、`代码`、引用、列表、==高亮==\n- 写字时自动保存,底部实时显示字数与预计阅读时长\n- 点「专注」进入无干扰书写,按 Esc 返回\n- 选一个当天的心情表情,「统计」页会画出**心情曲线**\n- 用日历回看任何一天,搜索框支持全文检索\n- 「统计与导出」页可一键导出全部 `.md` / `.json`\n\n> 今天的事,今天记下来,就是最好的存档。\n\n祝你落笔愉快。',
      tags: ['指南'], mood: 'calm', theme: null,
      pinned: false, fav: true,
      createdAt: Date.now(), updatedAt: Date.now()
    });
  }

  /* ============ 事件绑定 ============ */

  function bindEvents() {
    // 侧栏
    $('#btn-new').addEventListener('click', function () { openEditor(null); });
    $('#side-nav').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-view]');
      if (b) switchView(b.dataset.view);
    });
    $('#theme-list').addEventListener('click', function (ev) {
      var b = ev.target.closest('.swatch');
      if (!b) return;
      Store.saveSettings({ theme: b.dataset.themeId });
      renderThemeList();
      applyContextTheme();
    });
    $('#btn-menu').addEventListener('click', function (ev) {
      ev.stopPropagation();
      document.body.classList.toggle('side-open');
    });
    document.addEventListener('click', function (ev) {
      if (document.body.classList.contains('side-open') &&
          !ev.target.closest('.sidebar') && !ev.target.closest('#btn-menu')) {
        document.body.classList.remove('side-open');
      }
    });

    // 搜索
    $('#search-input').addEventListener('input', function () {
      state.query = this.value;
      state.dateFilter = null;
      if (state.view !== 'timeline') switchView('timeline');
      else renderTimeline();
    });

    // 时间线(事件委托)
    $('#timeline-list').addEventListener('click', function (ev) {
      var star = ev.target.closest('.entry-star');
      if (star) {
        ev.stopPropagation();
        var e = Store.get(star.dataset.id);
        if (e) { e.fav = !e.fav; Store.upsert(e); renderTimeline(); }
        return;
      }
      var tag = ev.target.closest('.tag');
      if (tag) {
        ev.stopPropagation();
        state.query = tag.dataset.tag;
        $('#search-input').value = state.query;
        state.dateFilter = null;
        renderTimeline();
        return;
      }
      var card = ev.target.closest('.entry-card');
      if (card) openEditor(card.dataset.id);
    });
    $('#view-timeline').addEventListener('click', function (ev) {
      if (ev.target.id === 'btn-clear-filter') {
        state.query = ''; state.dateFilter = null;
        $('#search-input').value = '';
        renderTimeline();
      }
      var mem = ev.target.closest('.memory-item');
      if (mem) openEditor(mem.dataset.id);
    });

    // 日历
    $('#cal-prev').addEventListener('click', function () {
      state.calM--; if (state.calM < 0) { state.calM = 11; state.calY--; }
      renderCalendar();
    });
    $('#cal-next').addEventListener('click', function () {
      state.calM++; if (state.calM > 11) { state.calM = 0; state.calY++; }
      renderCalendar();
    });
    $('#cal-today-btn').addEventListener('click', function () {
      var d = new Date();
      state.calY = d.getFullYear(); state.calM = d.getMonth();
      renderCalendar();
    });
    $('#cal-grid').addEventListener('click', function (ev) {
      var day = ev.target.closest('.cal-day.has');
      if (!day) return;
      if (day.dataset.count === '1' && day.dataset.id) { openEditor(day.dataset.id); return; }
      state.dateFilter = day.dataset.date;
      state.query = '';
      $('#search-input').value = '';
      switchView('timeline');
    });

    // 统计
    $('#btn-export-md').addEventListener('click', exportAllMd);
    $('#btn-export-json').addEventListener('click', exportAllJson);
    $('#tag-cloud').addEventListener('click', function (ev) {
      var tag = ev.target.closest('.tag');
      if (!tag) return;
      state.query = tag.dataset.tag;
      $('#search-input').value = state.query;
      switchView('timeline');
    });
    $('#btn-api-save').addEventListener('click', function () {
      Store.saveSettings({ apiBase: $('#api-input').value.trim() });
      $('#api-status').textContent = '正在连接…';
      Store.connect();
    });

    // 编辑器:顶栏
    $('#btn-back').addEventListener('click', function () { switchView('timeline'); });
    $('#entry-date').addEventListener('change', function () {
      if (!state.cur) return;
      state.cur.date = this.value || state.cur.date;
      state.prompt = Prompts.daily(state.cur.date);
      $('#prompt-text').textContent = state.prompt;
      scheduleSave();
    });
    $('#mood-picker').addEventListener('click', function (ev) {
      var b = ev.target.closest('.mood-btn');
      if (!b || !state.cur) return;
      state.cur.mood = (state.cur.mood === b.dataset.mood) ? null : b.dataset.mood;
      renderMoodPicker();
      scheduleSave();
    });
    $('#btn-pin').addEventListener('click', function () {
      if (!state.cur) return;
      state.cur.pinned = !state.cur.pinned;
      updatePinFav(); scheduleSave();
    });
    $('#btn-fav').addEventListener('click', function () {
      if (!state.cur) return;
      state.cur.fav = !state.cur.fav;
      updatePinFav(); scheduleSave();
    });
    $('#entry-theme').addEventListener('change', function () {
      if (!state.cur) return;
      state.cur.theme = this.value || null;
      applyContextTheme();
      scheduleSave();
    });
    $('#btn-export-entry').addEventListener('click', function () {
      if (!state.cur) return;
      collect();
      download((state.cur.title || '无题') + '-' + state.cur.date + '.md',
        entryToMd(state.cur), 'text/markdown');
    });
    $('#btn-delete').addEventListener('click', function () {
      if (!state.cur) return;
      if (!confirm('删除这篇日记?此操作不可恢复。')) return;
      clearTimeout(state.saveTimer);
      Store.remove(state.cur.id);
      state.cur = null;
      switchView('timeline');
    });

    // 编辑器:工具栏
    $all('.fmt').forEach(function (b) {
      b.addEventListener('click', function () { doFormat(b.dataset.fmt); });
    });
    $('#mode-seg').addEventListener('click', function (ev) {
      var b = ev.target.closest('.seg-btn');
      if (b) setMode(b.dataset.mode);
    });
    $('#btn-focus').addEventListener('click', function () {
      document.body.classList.add('focus-mode');
      $('#entry-body').focus();
    });
    $('#focus-exit').addEventListener('click', function () {
      document.body.classList.remove('focus-mode');
    });

    // 编辑器:每日一题
    $('#btn-prompt-shuffle').addEventListener('click', function () {
      state.prompt = Prompts.random(state.prompt);
      $('#prompt-text').textContent = state.prompt;
    });
    $('#btn-prompt-insert').addEventListener('click', function () {
      if (state.mode === 'preview') setMode('write');
      insertAtCursor('> 今日一题:' + state.prompt + '\n\n');
    });

    // 编辑器:正文输入
    $('#entry-title').addEventListener('input', scheduleSave);
    $('#entry-tags').addEventListener('input', scheduleSave);
    $('#entry-body').addEventListener('input', onBodyInput);
    $('#entry-body').addEventListener('keydown', function (ev) {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      var k = ev.key.toLowerCase();
      if (k === 'b') { ev.preventDefault(); doFormat('bold'); }
      else if (k === 'i') { ev.preventDefault(); doFormat('italic'); }
    });

    // 全局快捷键
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') {
        if (document.body.classList.contains('focus-mode')) {
          document.body.classList.remove('focus-mode');
        } else if (document.body.classList.contains('side-open')) {
          document.body.classList.remove('side-open');
        }
        return;
      }
      var inField = /^(INPUT|TEXTAREA|SELECT)$/.test((ev.target.tagName || ''));
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's' && state.view === 'editor') {
        ev.preventDefault();
        saveNow();
        return;
      }
      if (!inField && !ev.ctrlKey && !ev.metaKey && !ev.altKey &&
          (ev.key === 'n' || ev.key === 'N') && state.view !== 'editor') {
        openEditor(null);
      }
    });

    // 离开页面前兜底保存
    window.addEventListener('beforeunload', function () {
      if (state.view === 'editor' && state.cur) saveNow();
    });
  }

  /* ============ 启动 ============ */

  function boot() {
    Store.init();
    seedIfFirstRun();
    document.documentElement.setAttribute('data-theme', Store.settings.theme);
    renderThemeList();
    renderThemeSelect();
    bindEvents();
    switchView('timeline');
    $('#api-input').value = Store.settings.apiBase || '';
    updateSyncUI();
    Store.onRemoteSync = function () {
      updateSyncUI();
      if (state.view === 'timeline') renderTimeline();
      else if (state.view === 'calendar') renderCalendar();
      else if (state.view === 'stats') renderStats();
    };
    Store.connect();
  }

  boot();
})();
