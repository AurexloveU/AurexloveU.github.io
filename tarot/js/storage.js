/* ============================================================
   AUREX / TAROT — storage.js
   解读存档:localStorage 独立工作;检测到后端时可双向同步。
   记录结构:
   { id, ts, updated, kind: 'daily'|'spread', spread, question,
     seed, cards: [{id, reversed, position}], note, extra }
   ============================================================ */
(function () {
  'use strict';
  const Tarot = (window.Tarot = window.Tarot || {});
  const KEY = 'aurex-tarot-history-v1';
  const API_KEY = 'aurex-tarot-api-base';

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function writeAll(arr) {
    localStorage.setItem(KEY, JSON.stringify(arr));
  }
  function uid() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  Tarot.store = {
    list() {
      return readAll().sort((a, b) => b.ts - a.ts);
    },
    get(id) {
      return readAll().find((r) => r.id === id) || null;
    },
    /** 保存一条解读;返回记录 */
    save(rec) {
      const arr = readAll();
      const full = Object.assign({ id: uid(), ts: Date.now(), note: '' }, rec, { updated: Date.now() });
      const i = arr.findIndex((r) => r.id === full.id);
      if (i >= 0) arr[i] = full; else arr.push(full);
      writeAll(arr);
      this._push(full);
      return full;
    },
    setNote(id, note) {
      const arr = readAll();
      const r = arr.find((x) => x.id === id);
      if (!r) return;
      r.note = note; r.updated = Date.now();
      writeAll(arr);
      this._push(r);
    },
    remove(id) {
      writeAll(readAll().filter((r) => r.id !== id));
      const base = this.apiBase();
      if (base) fetch(base + '/api/history/' + encodeURIComponent(id), { method: 'DELETE' }).catch(() => {});
    },
    /** 今天是否已存过每日一牌 */
    hasDaily(dateStr) {
      return readAll().some((r) => r.kind === 'daily' && r.extra && r.extra.date === dateStr);
    },

    /* ---------- 后端同步(可选) ---------- */
    apiBase() {
      const v = localStorage.getItem(API_KEY);
      if (v !== null) return v.replace(/\/+$/, '');
      // 未配置时:若页面本身由 tarot 后端服务(端口 7777),自动同源
      if (location.port === '7777') return '';
      return null;
    },
    setApiBase(v) {
      if (v == null || v === '') localStorage.removeItem(API_KEY);
      else localStorage.setItem(API_KEY, v.trim().replace(/\/+$/, ''));
    },
    async ping() {
      const base = this.apiBase();
      if (base === null) return { ok: false, reason: 'unset' };
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch(base + '/api/health', { signal: ctrl.signal });
        clearTimeout(t);
        const j = await res.json();
        return { ok: !!j.ok, server: j };
      } catch (e) {
        return { ok: false, reason: String(e && e.message || e) };
      }
    },
    /** 单条静默上行(尽力而为,失败即忽略) */
    _push(rec) {
      const base = this.apiBase();
      if (base === null) return;
      fetch(base + '/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rec),
      }).catch(() => {});
    },
    /** 双向合并同步:以 updated 较新者为准 */
    async sync() {
      const base = this.apiBase();
      if (base === null) throw new Error('未配置后端地址');
      const res = await fetch(base + '/api/history/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: readAll() }),
      });
      if (!res.ok) throw new Error('同步失败:HTTP ' + res.status);
      const j = await res.json();
      if (Array.isArray(j.items)) writeAll(j.items);
      return { merged: (j.items || []).length };
    },
    /** 导出/导入 JSON 备份 */
    exportJSON() {
      return JSON.stringify({ app: 'aurex-tarot', exported: Date.now(), items: readAll() }, null, 2);
    },
    importJSON(text) {
      const j = JSON.parse(text);
      const items = Array.isArray(j) ? j : j.items;
      if (!Array.isArray(items)) throw new Error('格式不正确');
      const arr = readAll();
      const byId = new Map(arr.map((r) => [r.id, r]));
      let added = 0;
      items.forEach((r) => {
        if (!r || !r.id) return;
        const old = byId.get(r.id);
        if (!old || (r.updated || 0) > (old.updated || 0)) { byId.set(r.id, r); added++; }
      });
      writeAll([...byId.values()]);
      return added;
    },
  };
})();
