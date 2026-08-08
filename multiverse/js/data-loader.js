/**
 * multiverse/js/data-loader.js
 * 运行时数据加载:fetch ./data/*.json,逐文件优雅降级到内置样例。
 *
 * 返回 { data, sources }:
 *   data    = normalizeData 后的五份列表(保证可用)
 *   sources = { timeline: 'file' | 'fallback', ... } 供 UI 展示数据来源徽章
 *
 * 任何一个文件 404 / 网络失败 / JSON 损坏 / 列表为空,都只影响那一个文件:
 * 该文件回落到 FALLBACK_DATA,其余照常使用数据端的正式文件。
 * (file:// 协议下 fetch 会整体失败,则五份全部回落——页面依然可完整演示。)
 */

import { normalizeData, normalizeList } from '../engine/engine.js';
import { FALLBACK_DATA, DATA_FILES } from '../engine/fallback-data.js';

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function loadData(baseUrl = './data/') {
  const keys = Object.keys(DATA_FILES);
  const raw = {};
  const sources = {};

  await Promise.all(
    keys.map(async (key) => {
      try {
        const json = await fetchJson(baseUrl + DATA_FILES[key]);
        const list = normalizeList(json, key);
        if (!list.length) throw new Error('empty list');
        raw[key] = json;
        sources[key] = 'file';
      } catch (err) {
        raw[key] = FALLBACK_DATA[key];
        sources[key] = 'fallback';
      }
    }),
  );

  return { data: normalizeData(raw), sources };
}

/** sources -> 给 UI 的一句话描述。 */
export function describeSources(sources) {
  const total = Object.keys(sources).length;
  const fromFile = Object.values(sources).filter((s) => s === 'file').length;
  if (fromFile === total) return { text: `数据包 · ${total}/${total} 已装载`, level: 'ok' };
  if (fromFile === 0) return { text: '内置样例数据(data/ 尚未就位,演示模式)', level: 'demo' };
  const missing = Object.entries(sources)
    .filter(([, s]) => s === 'fallback')
    .map(([k]) => k)
    .join(' / ');
  return { text: `部分数据包缺失,已兜底:${missing}`, level: 'mixed' };
}
