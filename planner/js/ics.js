/* Aurex 计划台 · ICS(iCalendar)导出:含 RRULE 重复规则 */
'use strict';

const ICS = (() => {
  const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']; // 0=周一

  function escText(s) {
    return String(s ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  /** RFC 5545:每行 ≤ 75 字节,续行以空格开头(按字符近似折行即可) */
  function fold(line) {
    const out = [];
    let s = line;
    while (s.length > 74) {
      out.push(s.slice(0, 74));
      s = ' ' + s.slice(74);
    }
    out.push(s);
    return out.join('\r\n');
  }

  function dateVal(ds) { return ds.replace(/-/g, ''); }

  function stampNow() {
    const d = new Date();
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function rrule(t) {
    const r = t.repeat;
    if (!r) return null;
    if (r.type === 'daily') return 'RRULE:FREQ=DAILY';
    if (r.type === 'weekly') {
      const days = (r.days && r.days.length) ? r.days : [U.dowMon(t.date)];
      return 'RRULE:FREQ=WEEKLY;BYDAY=' + days.map(d => BYDAY[d]).join(',');
    }
    if (r.type === 'interval') return `RRULE:FREQ=DAILY;INTERVAL=${Math.max(1, r.n | 0)}`;
    return null;
  }

  function build() {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Aurex Planner//ZH-CN//',
      'CALSCALE:GREGORIAN',
      'X-WR-CALNAME:Aurex 计划台',
    ];
    const stamp = stampNow();

    for (const t of Store.active()) {
      if (!t.date) continue;
      const descParts = [];
      if (t.notes) descParts.push(t.notes);
      descParts.push(`象限 Q${t.quadrant} · 优先级 ${({ high: '高', mid: '中', low: '低' })[t.priority] || '中'}`);
      if (t.progress) descParts.push(`进度 ${t.progress}%`);
      if (t.due) descParts.push(`截止 ${t.due}`);

      lines.push('BEGIN:VEVENT');
      lines.push(fold(`UID:${t.id}@aurex-planner`));
      lines.push(`DTSTAMP:${stamp}`);
      lines.push(`DTSTART;VALUE=DATE:${dateVal(t.date)}`);
      lines.push(`DTEND;VALUE=DATE:${dateVal(U.addDays(t.date, 1))}`);
      const rr = rrule(t);
      if (rr) lines.push(rr);
      lines.push(fold(`SUMMARY:${escText(t.title)}`));
      if (descParts.length) lines.push(fold(`DESCRIPTION:${escText(descParts.join('\n'))}`));
      if (t.tags && t.tags.length) lines.push(fold(`CATEGORIES:${t.tags.map(escText).join(',')}`));
      if (!t.repeat && t.done) lines.push('STATUS:CANCELLED'); // 已完成的一次性任务标记为不再需要提醒
      lines.push('END:VEVENT');

      // 有截止日的一次性任务,额外生成一条 VTODO,便于任务类应用识别
      if (t.due && !t.repeat) {
        lines.push('BEGIN:VTODO');
        lines.push(fold(`UID:${t.id}-todo@aurex-planner`));
        lines.push(`DTSTAMP:${stamp}`);
        lines.push(`DUE;VALUE=DATE:${dateVal(t.due)}`);
        lines.push(fold(`SUMMARY:${escText(t.title)}`));
        lines.push(`PERCENT-COMPLETE:${t.progress || 0}`);
        lines.push(`STATUS:${t.done ? 'COMPLETED' : 'NEEDS-ACTION'}`);
        lines.push('END:VTODO');
      }
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  function download() {
    const text = build();
    const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aurex-planner-${U.todayStr()}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    U.toast('已导出 .ics 日历文件');
  }

  return { build, download };
})();
