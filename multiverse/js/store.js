/**
 * multiverse/js/store.js
 * 画廊存档 —— localStorage 持久化。
 *
 * 存档记录只存「重放码 + 展示快照」:重放码是事实之源(种子 + 各步重抽次数 + 元素数),
 * 快照(标题、元素名等)仅用于画廊列表渲染,重放时一律按码重新计算。
 */

const KEY = 'multiverse.gallery.v1';

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // 隐私模式 / 配额满:静默失败,由调用方提示
  }
}

/** 列出全部存档,最新在前。 */
export function listSaved() {
  return readAll().sort((x, y) => y.savedAt - x.savedAt);
}

/**
 * 保存一条宇宙存档。snapshot: { title, subtitle, elementNames[] }。
 * 同一重放码只存一份(重复保存会刷新时间戳与快照)。
 */
export function saveUniverse(replayCode, snapshot) {
  const list = readAll().filter((rec) => rec.code !== replayCode);
  const rec = {
    id: 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    code: replayCode,
    savedAt: Date.now(),
    ...snapshot,
  };
  list.push(rec);
  return writeAll(list) ? rec : null;
}

export function removeUniverse(id) {
  const list = readAll().filter((rec) => rec.id !== id);
  return writeAll(list);
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
