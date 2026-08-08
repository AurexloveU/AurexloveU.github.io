/* Aurex 计划台 · 统计计算:完成率 / 连击 / 热力图 / 分布 */
'use strict';

const Stats = (() => {

  /** [from, to] 闭区间内的全部出现:[{task, ds, done}] */
  function occurrencesInRange(from, to) {
    const out = [];
    const tasks = Store.active();
    let ds = from;
    while (ds <= to) {
      for (const t of tasks) {
        if (Recur.occursOn(t, ds)) {
          out.push({ task: t, ds, done: Recur.isDoneOn(t, ds) });
        }
      }
      ds = U.addDays(ds, 1);
    }
    return out;
  }

  /** 近 N 天完成率(含今天) */
  function completionRate(days = 30) {
    const today = U.todayStr();
    const occ = occurrencesInRange(U.addDays(today, -(days - 1)), today);
    if (!occ.length) return { rate: null, done: 0, total: 0 };
    const done = occ.filter(o => o.done).length;
    return { rate: done / occ.length, done, total: occ.length };
  }

  /** 每日完成数(热力图用):Map<ds, count>,统计范围 [from, to] */
  function completionsPerDay(from, to) {
    const map = new Map();
    const bump = ds => { if (ds >= from && ds <= to) map.set(ds, (map.get(ds) || 0) + 1); };
    for (const t of Store.active()) {
      if (t.repeat) {
        for (const ds of Object.keys(t.doneDates || {})) bump(ds);
      } else if (t.done) {
        // 以完成时刻所在天计;缺 doneAt 的旧数据退回安排日
        const ds = t.doneAt ? U.fmt(new Date(t.doneAt)) : t.date;
        bump(ds);
      }
    }
    return map;
  }

  /** 连击:连续「当日安排全部完成」的天数。
      无安排的日子不打断也不累计;今天若尚未全部完成,从昨天起算(不提前判负)。 */
  function streak() {
    const today = U.todayStr();
    let n = 0;
    let ds = today;
    for (let guard = 0; guard < 366; guard++) {
      const occ = Recur.tasksOn(ds);
      if (occ.length === 0) {
        // 无安排:今天为空则看昨天;历史空日跳过(但连续 30 个空日视为断点)
        if (guard >= 30 && n === 0) break;
        if (guard >= 60) break;
        ds = U.addDays(ds, -1);
        continue;
      }
      const allDone = occ.every(t => Recur.isDoneOn(t, ds));
      if (allDone) {
        n++;
      } else if (ds === today) {
        // 今天还没做完不算失败,继续看昨天
      } else {
        break;
      }
      ds = U.addDays(ds, -1);
    }
    return n;
  }

  /** 累计完成次数 */
  function totalDone() {
    let n = 0;
    for (const t of Store.active()) {
      if (t.repeat) n += Object.keys(t.doneDates || {}).length;
      else if (t.done) n += 1;
    }
    return n;
  }

  /** 象限分布(未来 7 天内未完成的出现,去重到任务) */
  function quadrantDist() {
    const today = U.todayStr();
    const occ = occurrencesInRange(today, U.addDays(today, 6)).filter(o => !o.done);
    const seen = new Set();
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const o of occ) {
      const key = o.task.id;
      if (seen.has(key)) continue;
      seen.add(key);
      dist[o.task.quadrant] = (dist[o.task.quadrant] || 0) + 1;
    }
    return dist;
  }

  /** 标签排行 [[tag, count], …](按任务数) */
  function tagRank(limit = 12) {
    const map = new Map();
    for (const t of Store.active()) {
      for (const tag of (t.tags || [])) map.set(tag, (map.get(tag) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  }

  /** 近 N 天每日完成数序列(条形图用):[{ds, count}] */
  function recentDaily(days = 14) {
    const today = U.todayStr();
    const from = U.addDays(today, -(days - 1));
    const per = completionsPerDay(from, today);
    const out = [];
    for (let i = 0; i < days; i++) {
      const ds = U.addDays(from, i);
      out.push({ ds, count: per.get(ds) || 0 });
    }
    return out;
  }

  return { occurrencesInRange, completionRate, completionsPerDay, streak, totalDone, quadrantDist, tagRank, recentDaily };
})();
