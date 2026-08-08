/* Aurex 计划台 · 视图渲染:今日聚焦 / 四象限 / 周 / 月 / 统计 */
'use strict';

const Views = (() => {
  const Q_META = {
    1: { title: '重要 · 紧急', hint: '立即去做' },
    2: { title: '重要 · 不紧急', hint: '安排去做' },
    3: { title: '紧急 · 不重要', hint: '快速处理或委托' },
    4: { title: '不紧急 · 不重要', hint: '有空再说' },
  };
  const PRIO_CN = { high: '高', mid: '中', low: '低' };

  /* ---------- 任务卡片(共享) ---------- */

  function taskCardHTML(t, ds, opts = {}) {
    const done = Recur.isDoneOn(t, ds);
    const today = U.todayStr();
    const metas = [];

    metas.push(`<span class="chip" title="象限">Q${t.quadrant}</span>`);
    for (const tag of (t.tags || [])) metas.push(`<span class="chip">#${U.esc(tag)}</span>`);
    if (t.due) {
      const overdue = !done && t.due < today;
      metas.push(`<span class="badge-due ${overdue ? 'overdue' : ''}" title="截止日">⏳ ${U.esc(U.relLabel(t.due))}${overdue ? ' 逾期' : ''}</span>`);
    }
    if (t.repeat) metas.push(`<span class="badge-repeat" title="重复">↻ ${U.esc(Recur.repeatLabel(t))}</span>`);
    if (opts.showDate) metas.push(`<span title="安排日">📅 ${U.esc(U.relLabel(ds))}</span>`);

    const showProgress = !t.repeat && !done && (t.progress > 0 || !opts.compact);
    const progressHTML = showProgress
      ? `<div class="t-progress" data-act="progress" title="进度 ${t.progress}%,点击 +25%"><div class="bar" style="width:${t.progress}%"></div></div>`
      : '';

    return `
      <div class="task-card prio-${t.priority} ${done ? 'done-card' : ''}"
           draggable="true" data-id="${t.id}" data-ds="${ds}"
           style="border-left:3px solid var(--q${t.quadrant})">
        <div class="t-row1">
          <button class="t-check ${done ? 'checked' : ''}" data-act="toggle"
                  title="${done ? '取消完成' : '标记完成'}" aria-label="完成">✓</button>
          <div class="t-main">
            <div class="t-title"><span class="prio-dot" title="优先级:${PRIO_CN[t.priority]}"></span>${U.esc(t.title)}</div>
            ${metas.length ? `<div class="t-meta">${metas.join('')}</div>` : ''}
            ${progressHTML}
          </div>
        </div>
        <div class="t-actions">
          <button data-act="edit" title="编辑">✎</button>
          <button data-act="del" title="删除">✕</button>
        </div>
      </div>`;
  }

  /* ---------- 四象限面板(日视图与月视图展开共用) ---------- */

  function quadrantGridHTML(ds) {
    let html = '<div class="quadrant-grid">';
    for (const q of [1, 2, 3, 4]) {
      const tasks = Recur.tasksOnQuadrant(ds, q);
      const doneN = tasks.filter(t => Recur.isDoneOn(t, ds)).length;
      html += `
        <section class="quadrant" data-q="${q}">
          <div class="quadrant-head">
            <span class="q-title">${Q_META[q].title}</span>
            <span class="q-hint">${Q_META[q].hint}</span>
            <span class="q-count">${doneN}/${tasks.length}</span>
            <button class="iconbtn" data-act="q-add" data-q="${q}" data-date="${ds}" title="在此象限快速添加" style="width:26px;height:26px">＋</button>
          </div>
          <div class="dropzone" data-q="${q}" data-date="${ds}">
            ${tasks.length
              ? tasks.map(t => taskCardHTML(t, ds)).join('')
              : '<div class="empty-hint">拖任务到这里,或点 ＋ 添加</div>'}
          </div>
        </section>`;
    }
    return html + '</div>';
  }

  /* ---------- 今日聚焦 ---------- */

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return '夜深了,Aurex';
    if (h < 11) return '早安,Aurex';
    if (h < 14) return '午安,Aurex';
    if (h < 18) return '下午好,Aurex';
    return '晚上好,Aurex';
  }

  function renderToday(root) {
    const today = U.todayStr();
    const all = Recur.tasksOn(today);
    const pending = all.filter(t => !Recur.isDoneOn(t, today));
    const doneList = all.filter(t => Recur.isDoneOn(t, today));
    const focus = pending[0] || null;
    const overdue = Recur.overdue(today);
    const rate = Stats.completionRate(30);
    const streak = Stats.streak();

    let heroInner;
    if (focus) {
      const metas = [];
      metas.push(`<span class="chip">Q${focus.quadrant} · ${Q_META[focus.quadrant].hint}</span>`);
      metas.push(`<span>优先级 ${PRIO_CN[focus.priority]}</span>`);
      if (focus.due) metas.push(`<span>截止 ${U.esc(U.relLabel(focus.due))}</span>`);
      if (focus.repeat) metas.push(`<span>↻ ${U.esc(Recur.repeatLabel(focus))}</span>`);
      heroInner = `
        <div class="focus-label">现 在 专 注</div>
        <div class="focus-title">${U.esc(focus.title)}</div>
        <div class="focus-meta">${metas.join('')}</div>
        <div class="focus-acts">
          <button class="btn primary" data-act="focus-done" data-id="${focus.id}">完成 ✓</button>
          ${focus.repeat ? '' : `<button class="btn" data-act="focus-defer" data-id="${focus.id}">顺延到明天</button>`}
          <button class="btn" data-act="focus-edit" data-id="${focus.id}">编辑</button>
        </div>`;
    } else if (all.length) {
      heroInner = `<div class="all-clear">今日事已尽 ✧ 去喝杯茶吧</div>
        <div class="focus-meta" style="margin-top:8px">完成了 ${doneList.length} 件事,辛苦了。</div>`;
    } else {
      heroInner = `<div class="all-clear">今天还是一张白纸</div>
        <div class="focus-meta" style="margin-top:8px">按 <kbd>N</kbd> 或点上方输入框,写下第一件事。</div>`;
    }

    let html = `
      <div class="view-head">
        <h2>今日聚焦</h2>
        <span class="date-sub">${U.dateLabel(today)}</span>
      </div>
      <div class="focus-wrap">
        <div class="focus-hero">
          <div class="greeting">${greeting()}</div>
          ${heroInner}
        </div>
        <div class="side-cards">
          <div class="stat-strip">
            <div class="mini-stat"><div class="num">${doneList.length}<span style="font-size:.9rem;color:var(--muted)">/${all.length}</span></div><div class="lbl">今日完成</div></div>
            <div class="mini-stat"><div class="num">${streak}</div><div class="lbl">连击天数</div></div>
            <div class="mini-stat"><div class="num">${rate.rate === null ? '—' : Math.round(rate.rate * 100) + '%'}</div><div class="lbl">30 天完成率</div></div>
          </div>`;

    if (overdue.length) {
      html += `
        <div class="panel">
          <h3>⚠ 逾期未完成 <span class="cnt">${overdue.length} 件</span>
            <span class="spacer"></span>
            <button class="btn small" data-act="defer-all">全部顺延到今天</button>
          </h3>
          <div class="tasklist">${overdue.map(t => taskCardHTML(t, t.date, { compact: true, showDate: true })).join('')}</div>
        </div>`;
    }
    html += `</div></div>`;

    html += `
      <div class="panel section-gap">
        <h3>今日清单 <span class="cnt">未完成 ${pending.length} · 已完成 ${doneList.length}</span></h3>
        ${all.length
          ? `<div class="tasklist dropzone" data-date="${today}">
               ${pending.map(t => taskCardHTML(t, today)).join('')}
               ${doneList.map(t => taskCardHTML(t, today)).join('')}
             </div>`
          : `<div class="empty-state"><div class="big-icon">☁</div><p>暂无安排。快速添加试试:<code class="qk">写日志 #写作 !2 @今天 p:高</code></p></div>`}
      </div>`;
    root.innerHTML = html;
  }

  /* ---------- 四象限(日)视图 ---------- */

  function renderDay(root) {
    const ds = App.ui.date;
    root.innerHTML = `
      <div class="view-head">
        <h2>四象限</h2>
        <span class="date-sub">${U.dateLabel(ds)}${ds === U.todayStr() ? ' · 今天' : ''}</span>
        <span class="spacer"></span>
        <div class="nav-group">
          <button class="navbtn" data-act="nav-prev" title="前一天 (←)">◀</button>
          <button class="navbtn today-btn" data-act="nav-today" title="回到今天 (T)">今天</button>
          <button class="navbtn" data-act="nav-next" title="后一天 (→)">▶</button>
          <input type="date" id="jump-date" value="${ds}" class="navbtn" style="padding:3px 8px" title="跳转日期">
        </div>
      </div>
      ${quadrantGridHTML(ds)}`;
  }

  /* ---------- 周视图 ---------- */

  function renderWeek(root) {
    const start = U.weekStart(App.ui.date);
    const today = U.todayStr();
    const end = U.addDays(start, 6);
    const sd = U.parse(start), ed = U.parse(end);
    const rangeLabel = `${sd.getMonth() + 1}/${sd.getDate()} – ${ed.getMonth() + 1}/${ed.getDate()}`;

    let cols = '';
    for (let i = 0; i < 7; i++) {
      const ds = U.addDays(start, i);
      const tasks = Recur.tasksOn(ds);
      const pending = tasks.filter(t => !Recur.isDoneOn(t, ds));
      const doneList = tasks.filter(t => Recur.isDoneOn(t, ds));
      cols += `
        <div class="week-col ${ds === today ? 'is-today' : ''}">
          <div class="week-col-head" data-act="goto-day" data-date="${ds}" title="打开这一天的四象限">
            <div class="dow">周${U.DOW_CN[i]}</div>
            <div class="dnum">${U.parse(ds).getDate()}</div>
          </div>
          <div class="dropzone" data-date="${ds}">
            ${tasks.length
              ? pending.concat(doneList).map(t => taskCardHTML(t, ds, { compact: true })).join('')
              : '<div class="empty-hint">空</div>'}
          </div>
        </div>`;
    }

    root.innerHTML = `
      <div class="view-head">
        <h2>周视图</h2>
        <span class="date-sub">${rangeLabel} · 拖动卡片可跨天移动</span>
        <span class="spacer"></span>
        <div class="nav-group">
          <button class="navbtn" data-act="nav-prev" title="上一周 (←)">◀</button>
          <button class="navbtn today-btn" data-act="nav-today" title="本周 (T)">本周</button>
          <button class="navbtn" data-act="nav-next" title="下一周 (→)">▶</button>
        </div>
      </div>
      <div class="week-grid">${cols}</div>`;
  }

  /* ---------- 月视图 ---------- */

  function renderMonth(root) {
    const cursor = App.ui.date;
    const today = U.todayStr();
    const d0 = U.parse(cursor);
    const first = new Date(d0.getFullYear(), d0.getMonth(), 1);
    const firstDs = U.fmt(first);
    const gridStart = U.weekStart(firstDs);
    const thisMonth = first.getMonth();

    let cells = U.DOW_CN.map(w => `<div class="month-dow">${w}</div>`).join('');
    for (let i = 0; i < 42; i++) {
      const ds = U.addDays(gridStart, i);
      const d = U.parse(ds);
      const tasks = Recur.tasksOn(ds);
      const pending = tasks.filter(t => !Recur.isDoneOn(t, ds));
      const qSet = [...new Set(pending.map(t => t.quadrant))].sort();
      const dots = qSet.map(q => `<span class="cell-dot q${q}"></span>`).join('');
      let badge = '';
      if (pending.length) badge = `<span class="cell-count" title="待办 ${pending.length} 件">${pending.length}</span>`;
      else if (tasks.length) badge = `<span class="cell-count all-done" title="全部完成">✓</span>`;
      cells += `
        <div class="month-cell dropzone ${d.getMonth() !== thisMonth ? 'other-month' : ''}
                    ${ds === today ? 'is-today' : ''} ${ds === App.ui.monthExpand ? 'selected' : ''}"
             data-act="month-cell" data-date="${ds}"
             title="${U.dateLabel(ds)} · 待办 ${pending.length} / 共 ${tasks.length}">
          <span class="dnum">${d.getDate()}</span>
          ${badge}
          <div class="cell-dots">${dots}</div>
        </div>`;
    }

    let expand = '';
    if (App.ui.monthExpand) {
      const ds = App.ui.monthExpand;
      expand = `
        <div class="month-expand">
          <div class="expand-head">
            <h3>${U.dateLabel(ds)}</h3>
            <button class="btn small" data-act="goto-day" data-date="${ds}">在四象限视图打开</button>
            <button class="btn small" data-act="month-collapse">收起</button>
          </div>
          ${quadrantGridHTML(ds)}
        </div>`;
    }

    root.innerHTML = `
      <div class="view-head">
        <h2>月视图</h2>
        <span class="date-sub">${U.monthLabel(cursor)} · 点击日期展开四象限,可把卡片拖进任意日子</span>
        <span class="spacer"></span>
        <div class="nav-group">
          <button class="navbtn" data-act="nav-prev" title="上个月 (←)">◀</button>
          <button class="navbtn today-btn" data-act="nav-today" title="本月 (T)">本月</button>
          <button class="navbtn" data-act="nav-next" title="下个月 (→)">▶</button>
        </div>
      </div>
      <div class="month-grid">${cells}</div>
      ${expand}`;
  }

  /* ---------- 统计 ---------- */

  function ringSVG(rate) {
    const R = 26, C = 2 * Math.PI * R;
    const pct = rate === null ? 0 : rate;
    const off = C * (1 - pct);
    const label = rate === null ? '—' : Math.round(rate * 100) + '%';
    return `
      <svg class="ring" width="72" height="72" viewBox="0 0 72 72" role="img" aria-label="近 30 天完成率 ${label}">
        <circle class="ring-bg" cx="36" cy="36" r="${R}" fill="none" stroke-width="8"/>
        <circle class="ring-fg" cx="36" cy="36" r="${R}" fill="none" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
                transform="rotate(-90 36 36)"/>
        <text x="36" y="41" text-anchor="middle">${label}</text>
      </svg>`;
  }

  function heatmapHTML() {
    const today = U.todayStr();
    const WEEKS = 20;
    const gridStart = U.addDays(U.weekStart(today), -(WEEKS - 1) * 7);
    const per = Stats.completionsPerDay(gridStart, today);
    let cells = '';
    for (let w = 0; w < WEEKS; w++) {
      for (let r = 0; r < 7; r++) {
        const ds = U.addDays(gridStart, w * 7 + r);
        if (ds > today) { cells += '<span class="heat-cell" style="visibility:hidden"></span>'; continue; }
        const n = per.get(ds) || 0;
        const lvl = n === 0 ? '' : n === 1 ? 'l1' : n === 2 ? 'l2' : n <= 4 ? 'l3' : 'l4';
        cells += `<span class="heat-cell ${lvl}" title="${U.dateLabel(ds)} · 完成 ${n} 件"></span>`;
      }
    }
    return `
      <div class="heatmap-scroll"><div class="heatmap">${cells}</div></div>
      <div class="heat-legend">少
        <span class="heat-cell"></span><span class="heat-cell l1"></span><span class="heat-cell l2"></span>
        <span class="heat-cell l3"></span><span class="heat-cell l4"></span> 多
      </div>`;
  }

  function barChartSVG() {
    const data = Stats.recentDaily(14);
    const W = 420, H = 120, top = 14, bottom = 22, left = 6;
    const plotH = H - top - bottom;
    const slot = (W - left * 2) / data.length;
    const barW = Math.min(20, slot * 0.62);
    const max = Math.max(1, ...data.map(d => d.count));
    const maxIdx = data.reduce((mi, d, i) => (d.count > data[mi].count ? i : mi), 0);

    let bars = '';
    data.forEach((d, i) => {
      const h = d.count === 0 ? 0 : Math.max(3, (d.count / max) * plotH);
      const x = left + i * slot + (slot - barW) / 2;
      const y = top + plotH - h;
      const dd = U.parse(d.ds);
      bars += `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3">
        <title>${U.dateLabel(d.ds)} · 完成 ${d.count} 件</title></rect>`;
      if (i === maxIdx && d.count > 0) {
        bars += `<text class="val-label" x="${(x + barW / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${d.count}</text>`;
      }
      if (i % 2 === (data.length - 1) % 2) {
        bars += `<text x="${(x + barW / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${dd.getMonth() + 1}/${dd.getDate()}</text>`;
      }
    });

    return `
      <svg class="barchart" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="近 14 天每日完成数">
        <line class="axis" x1="${left}" y1="${top + plotH + .5}" x2="${W - left}" y2="${top + plotH + .5}" stroke-width="1"/>
        ${bars}
      </svg>`;
  }

  function renderStats(root) {
    const rate = Stats.completionRate(30);
    const streak = Stats.streak();
    const total = Stats.totalDone();
    const today = U.todayStr();
    const todayAll = Recur.tasksOn(today);
    const todayPending = todayAll.filter(t => !Recur.isDoneOn(t, today)).length;
    const dist = Stats.quadrantDist();
    const distMax = Math.max(1, ...Object.values(dist));
    const tags = Stats.tagRank();

    root.innerHTML = `
      <div class="view-head"><h2>统计</h2>
        <span class="date-sub">数字会说话,但请温柔地听</span></div>

      <div class="stats-tiles">
        <div class="stat-tile">${ringSVG(rate.rate)}
          <div><div class="lbl">近 30 天完成率</div>
          <div class="lbl" style="margin-top:4px">${rate.done} / ${rate.total} 件</div></div>
        </div>
        <div class="stat-tile"><div>
          <div class="big">${streak}<span class="unit"> 天</span></div>
          <div class="lbl">当前连击(全勤日)</div></div>
        </div>
        <div class="stat-tile"><div>
          <div class="big">${total}<span class="unit"> 件</span></div>
          <div class="lbl">累计完成</div></div>
        </div>
        <div class="stat-tile"><div>
          <div class="big">${todayPending}<span class="unit"> 件</span></div>
          <div class="lbl">今日待办</div></div>
        </div>
      </div>

      <div class="stats-row">
        <div class="panel">
          <h3>完成热力 <span class="cnt">近 20 周,每列一周</span></h3>
          ${heatmapHTML()}
        </div>
        <div class="panel">
          <h3>象限分布 <span class="cnt">未来 7 天的待办任务</span></h3>
          <div class="qdist">
            ${[1, 2, 3, 4].map(q => `
              <div class="qdist-row">
                <span class="qname"><span class="swatch" style="background:var(--q${q})"></span>Q${q} ${Q_META[q].title}</span>
                <span class="track"><span class="fill" style="width:${(dist[q] / distMax) * 100}%;background:var(--q${q});display:block"></span></span>
                <span class="n">${dist[q]}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="stats-row">
        <div class="panel">
          <h3>近 14 天 · 每日完成</h3>
          <div class="barchart-wrap">${barChartSVG()}</div>
        </div>
        <div class="panel">
          <h3>常用标签</h3>
          ${tags.length
            ? `<div class="tagcloud">${tags.map(([tag, n]) => `<span class="chip">#${U.esc(tag)}<span class="tcnt">×${n}</span></span>`).join('')}</div>`
            : '<div class="empty-state" style="padding:20px"><p>给任务加上 <code class="qk">#标签</code>,这里会长出一片小花园。</p></div>'}
        </div>
      </div>`;
  }

  /* ---------- 出口 ---------- */

  function render(root) {
    switch (App.ui.view) {
      case 'today': return renderToday(root);
      case 'day': return renderDay(root);
      case 'week': return renderWeek(root);
      case 'month': return renderMonth(root);
      case 'stats': return renderStats(root);
    }
  }

  return { render, taskCardHTML, quadrantGridHTML, Q_META, PRIO_CN };
})();
