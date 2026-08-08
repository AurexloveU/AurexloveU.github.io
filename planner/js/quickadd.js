/* Aurex 计划台 · 快速添加语法解析
   示例:写周报 #工作 !1 p:高 @明天 due:08-15 r:周一三五 %30
   - #标签        → 标签(可多个)
   - !1..!4       → 象限
   - p:高/中/低    → 优先级(也支持 p:h/m/l)
   - @日期        → 安排日:@今天 @明天 @后天 @周三 @08-15 @2026-08-15
   - due:日期     → 截止日(语法同上)
   - r:规则       → 重复:r:日 · r:周 · r:周一三五 · r:3天
   - %数字        → 进度(0–100)
*/
'use strict';

const QuickAdd = (() => {
  const CN_NUM = { '一': 0, '二': 1, '三': 2, '四': 3, '五': 4, '六': 5, '日': 6, '天': 6, '7': 6 };

  function parseDateWord(word, base) {
    const today = base || U.todayStr();
    if (!word) return null;
    word = word.trim();
    if (word === '今天' || word === 'today' || word === 'td') return today;
    if (word === '明天' || word === 'tomorrow' || word === 'tm') return U.addDays(today, 1);
    if (word === '后天') return U.addDays(today, 2);
    if (word === '大后天') return U.addDays(today, 3);

    // @周X / @下周X → 未来最近的那个周 X(含今天)
    let m = word.match(/^(下?)(?:周|星期|礼拜)([一二三四五六日天1-7])$/);
    if (m) {
      let target = CN_NUM[m[2]];
      if (target === undefined) target = (Number(m[2]) - 1);
      const cur = U.dowMon(today);
      let delta = (target - cur + 7) % 7;
      if (m[1] === '下') delta += (delta === 0 ? 7 : (cur > target ? 0 : 7));
      return U.addDays(today, delta);
    }

    // YYYY-MM-DD / MM-DD(支持 . 和 / 分隔)
    m = word.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
    if (m) return `${m[1]}-${U.pad2(+m[2])}-${U.pad2(+m[3])}`;
    m = word.match(/^(\d{1,2})[-./](\d{1,2})$/);
    if (m) {
      const y = U.parse(today).getFullYear();
      let ds = `${y}-${U.pad2(+m[1])}-${U.pad2(+m[2])}`;
      if (ds < today) ds = `${y + 1}-${U.pad2(+m[1])}-${U.pad2(+m[2])}`; // 已过则视为明年
      return ds;
    }
    // +N 天
    m = word.match(/^\+(\d{1,3})$/);
    if (m) return U.addDays(today, +m[1]);
    return null;
  }

  function parseRepeat(word) {
    if (!word) return null;
    word = word.trim();
    if (word === '日' || word === '每日' || word === '每天' || word === 'daily' || word === 'd') {
      return { type: 'daily' };
    }
    let m = word.match(/^(?:每?周|星期|礼拜|w|weekly)([一二三四五六日天1-7]*)$/);
    if (m) {
      const days = [];
      for (const ch of m[1]) {
        const d = CN_NUM[ch] !== undefined ? CN_NUM[ch] : (Number(ch) - 1);
        if (d >= 0 && d <= 6 && !days.includes(d)) days.push(d);
      }
      return { type: 'weekly', days: days.sort((a, b) => a - b) }; // 空 days → 以起始日的星期为准
    }
    m = word.match(/^(?:每)?(\d{1,3})天$/) || word.match(/^(\d{1,3})d$/);
    if (m) return { type: 'interval', n: Math.max(1, +m[1]) };
    return null;
  }

  /** 解析输入行 → { title, props },base 为默认安排日 */
  function parse(line, base) {
    const props = { tags: [] };
    let title = line;

    const eat = (re, fn) => {
      title = title.replace(re, (all, ...groups) => { fn(...groups); return ' '; });
    };

    eat(/(?:^|\s)#([^\s#!@%]+)/g, tag => props.tags.push(tag));
    eat(/(?:^|\s)!([1-4])(?=\s|$)/g, q => { props.quadrant = +q; });
    eat(/(?:^|\s)p:(高|中|低|h|m|l|high|mid|low)(?=\s|$)/gi, p => {
      const map = { '高': 'high', h: 'high', high: 'high', '中': 'mid', m: 'mid', mid: 'mid', '低': 'low', l: 'low', low: 'low' };
      props.priority = map[p.toLowerCase()] || map[p];
    });
    eat(/(?:^|\s)due:(\S+)/g, w => {
      const ds = parseDateWord(w, base);
      if (ds) props.due = ds;
    });
    eat(/(?:^|\s)@(\S+)/g, w => {
      const ds = parseDateWord(w, base);
      if (ds) props.date = ds;
    });
    eat(/(?:^|\s)r:(\S+)/g, w => {
      const r = parseRepeat(w);
      if (r) props.repeat = r;
    });
    eat(/(?:^|\s)%(\d{1,3})(?=\s|$)/g, n => { props.progress = U.clamp(+n, 0, 100); });

    title = title.replace(/\s+/g, ' ').trim();
    if (!props.date && base) props.date = base;
    return { title, props };
  }

  return { parse, parseDateWord, parseRepeat };
})();
