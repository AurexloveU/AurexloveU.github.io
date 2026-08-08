/* Aurex 计划台 · 可选后端同步
   离线优先:localStorage 永远是事实来源之一;
   配置了 API 地址并启用同步后,按 updatedAt 双向合并(墓碑保留删除)。 */
'use strict';

const Sync = (() => {
  let status = 'offline'; // offline | busy | online | error

  function api(path) {
    const base = (Store.state.settings.apiBase || '').replace(/\/+$/, '');
    return base + path;
  }

  function enabled() {
    return Store.state.settings.syncEnabled && !!Store.state.settings.apiBase;
  }

  function setStatus(s) {
    status = s;
    const dot = document.getElementById('sync-dot');
    const lbl = document.getElementById('sync-label');
    if (!dot) return;
    dot.className = 'sync-dot ' + ({ online: 'online', busy: 'busy', error: 'error', offline: '' })[s];
    if (lbl) lbl.textContent = ({ online: '已同步', busy: '同步中', error: '同步失败', offline: '本地模式' })[s];
  }

  /** 按 updatedAt 合并两份任务表(墓碑同样参与,删除得以传播) */
  function merge(a, b) {
    const map = new Map();
    for (const t of a) map.set(t.id, t);
    for (const t of b) {
      const cur = map.get(t.id);
      if (!cur || (t.updatedAt || 0) > (cur.updatedAt || 0)) map.set(t.id, t);
    }
    return [...map.values()];
  }

  async function pull() {
    if (!enabled()) return;
    setStatus('busy');
    try {
      const res = await fetch(api('/api/tasks'), { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const merged = merge(Store.state.tasks, data.tasks || []);
      if (JSON.stringify(merged) !== JSON.stringify(Store.state.tasks)) {
        Store.replaceTasks(merged);
      }
      setStatus('online');
    } catch (e) {
      console.warn('拉取失败(继续本地工作)', e);
      setStatus('error');
    }
  }

  async function pushNow() {
    if (!enabled()) return;
    setStatus('busy');
    try {
      const res = await fetch(api('/api/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: Store.state.tasks }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.tasks) {
        const merged = merge(Store.state.tasks, data.tasks);
        if (JSON.stringify(merged) !== JSON.stringify(Store.state.tasks)) {
          Store.replaceTasks(merged);
        }
      }
      setStatus('online');
    } catch (e) {
      console.warn('推送失败(数据仍在本地)', e);
      setStatus('error');
    }
  }

  const schedulePush = U.debounce(pushNow, 1500);

  async function testConnection(base) {
    const url = (base || '').replace(/\/+$/, '') + '/api/health';
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function start() {
    if (!enabled()) { setStatus('offline'); return; }
    await pull();
    await pushNow();
  }

  return { start, pull, pushNow, schedulePush, testConnection, setStatus, enabled, merge, get status() { return status; } };
})();
