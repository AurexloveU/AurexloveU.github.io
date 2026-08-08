/* ============================================================
   拾光集 · 数据层
   本地优先:一切读写先落 localStorage,离线完整可用。
   可选后端:探测到 server/(Node+Express)在线时,自动双向
   合并(按 updatedAt 新者胜),之后所有增删改静默镜像到后端。
   ============================================================ */
(function (global) {
  'use strict';

  var LS_ENTRIES  = 'shiguang.entries.v1';
  var LS_SETTINGS = 'shiguang.settings.v1';
  var LS_SEEDED   = 'shiguang.seeded.v1';
  var DEFAULT_API = 'http://localhost:4870';

  var Store = {
    entries: [],
    settings: { theme: 'mist', apiBase: '' },
    online: false,
    base: '',
    /** app.js 注册的回调:连接探测/远端合并完成后调用,参数为是否在线 */
    onRemoteSync: null,

    /* ---------- 本地 ---------- */

    init: function () {
      try {
        var raw = JSON.parse(localStorage.getItem(LS_ENTRIES));
        this.entries = Array.isArray(raw) ? raw : [];
      } catch (e) { this.entries = []; }
      try {
        var s = JSON.parse(localStorage.getItem(LS_SETTINGS));
        if (s && typeof s === 'object') {
          if (typeof s.theme === 'string') this.settings.theme = s.theme;
          if (typeof s.apiBase === 'string') this.settings.apiBase = s.apiBase;
        }
      } catch (e) { /* 忽略坏数据 */ }
    },

    persist: function () {
      try { localStorage.setItem(LS_ENTRIES, JSON.stringify(this.entries)); }
      catch (e) { /* 存储满等异常不阻塞书写 */ }
    },

    saveSettings: function (patch) {
      var k;
      for (k in patch) { if (Object.prototype.hasOwnProperty.call(patch, k)) this.settings[k] = patch[k]; }
      try { localStorage.setItem(LS_SETTINGS, JSON.stringify(this.settings)); } catch (e) {}
    },

    seededOnce: function () {
      if (localStorage.getItem(LS_SEEDED)) return false;
      try { localStorage.setItem(LS_SEEDED, '1'); } catch (e) {}
      return true;
    },

    newId: function () {
      return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    list: function () { return this.entries.slice(); },

    get: function (id) {
      for (var i = 0; i < this.entries.length; i++) {
        if (this.entries[i].id === id) return this.entries[i];
      }
      return null;
    },

    upsert: function (entry) {
      entry.updatedAt = Date.now();
      if (!entry.createdAt) entry.createdAt = entry.updatedAt;
      var i;
      for (i = 0; i < this.entries.length; i++) {
        if (this.entries[i].id === entry.id) { this.entries[i] = entry; break; }
      }
      if (i === this.entries.length) this.entries.push(entry);
      this.persist();
      this.pushRemote(entry);
      return entry;
    },

    remove: function (id) {
      this.entries = this.entries.filter(function (e) { return e.id !== id; });
      this.persist();
      if (this.online) {
        this.api('/api/entries/' + encodeURIComponent(id), { method: 'DELETE' }).catch(function () {});
      }
    },

    /* ---------- 后端(可选) ---------- */

    api: function (path, opts) {
      var self = this;
      opts = opts || {};
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 2500) : null;
      return fetch(self.base + path, {
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.status === 204 ? null : res.json();
      }, function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
    },

    /** 探测后端;在线则拉取远端并双向合并 */
    connect: function () {
      var self = this;
      this.base = (this.settings.apiBase || DEFAULT_API).replace(/\/+$/, '');
      if (typeof fetch !== 'function') { self.online = false; return Promise.resolve(false); }
      return this.api('/api/health')
        .then(function (h) {
          if (!h || h.ok !== true) throw new Error('health check failed');
          self.online = true;
          return self.pullMerge();
        })
        .catch(function () { self.online = false; })
        .then(function () {
          if (typeof self.onRemoteSync === 'function') self.onRemoteSync(self.online);
          return self.online;
        });
    },

    /** 远端 + 本地按 id 合并,updatedAt 新者胜;本地较新/独有的推回远端 */
    pullMerge: function () {
      var self = this;
      return this.api('/api/entries').then(function (data) {
        var remote = Array.isArray(data) ? data : ((data && data.entries) || []);
        var map = {}, i, e;
        for (i = 0; i < self.entries.length; i++) { map[self.entries[i].id] = self.entries[i]; }
        var remoteAt = {};
        for (i = 0; i < remote.length; i++) {
          e = remote[i];
          if (!e || !e.id) continue;
          remoteAt[e.id] = e.updatedAt || 0;
          var local = map[e.id];
          if (!local || (e.updatedAt || 0) > (local.updatedAt || 0)) map[e.id] = e;
        }
        var merged = [], toPush = [];
        for (var id in map) {
          if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
          merged.push(map[id]);
          if (!(id in remoteAt) || (map[id].updatedAt || 0) > remoteAt[id]) toPush.push(map[id]);
        }
        self.entries = merged;
        self.persist();
        toPush.forEach(function (en) { self.pushRemote(en); });
      });
    },

    pushRemote: function (entry) {
      if (!this.online) return;
      this.api('/api/entries/' + encodeURIComponent(entry.id), { method: 'PUT', body: entry })
        .catch(function () { /* 静默失败,本地已保存 */ });
    }
  };

  global.Store = Store;
})(window);
