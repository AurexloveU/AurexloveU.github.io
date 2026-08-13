/**
 * data/validate.mjs —— 数据自检:字段完整性 + 无死路保障。
 * 运行:node data/validate.mjs   (或在 data/ 目录内 node validate.mjs)
 *
 * 无死路的证明思路(与 schema.md 一致):
 *  A. 时代/门控标签只由 timeline 产生;所有 forbid 标签只允许命中 timeline 标签,
 *     且任何非 timeline 条目的 tags 都不得包含任何出现在 forbid 列表中的标签。
 *     => 第 1 步(时间)之后,上下文再怎么累积,都不会把「已可用」的条目反向禁用(单调性)。
 *  B. 在此前提下,只需对每个时间节点 T 逐一验证(ctx = T.tags):
 *     - 地点严格候选 ≥ 1;物种严格候选 ≥ 2;元素严格候选 ≥ 20(引擎固定数上限 20);
 *     - 若 T 含 has-society-possible:身份严格候选 ≥ 1(身份的 require 只用时代词表,第 1 步即可判定);
 *     - 若 T 含 no-society:不存在可抽到的 has-society 物种(has-society 物种必须 forbid no-society)。
 *  C. 再以 5000 次全流程随机模拟(时间→地点→物种×2→身份→元素×8)做经验兜底,
 *     要求每一步严格池非空、元素抽满 8 个不短缺。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(HERE, f), 'utf8'));

const timeline = load('timeline.json');
const places = load('places.json');
const species = load('species.json');
const socialRoles = load('socialRoles.json');
const elements = load('elements.json');

const FILES = { timeline, places, species, socialRoles, elements };
const CATEGORY = { timeline: 'time', places: 'place', species: 'species', socialRoles: 'socialRole', elements: 'element' };
const MIN = { timeline: 250, places: 120, species: 60, socialRoles: 80, elements: 2000 };

let errors = 0, warnings = 0;
const err = (m) => { errors += 1; console.error('  [ERR]', m); };
const warn = (m) => { warnings += 1; console.warn('  [WARN]', m); };

/* ---------- 1. 字段完整性 / 唯一性 / 体量 ---------- */
console.log('== 1. 字段与体量 ==');
const allIds = new Set();
for (const [key, list] of Object.entries(FILES)) {
  if (!Array.isArray(list)) { err(`${key}.json 不是数组`); continue; }
  if (list.length < MIN[key]) err(`${key} 条数 ${list.length} < 下限 ${MIN[key]}`);
  list.forEach((it, i) => {
    const where = `${key}[${i}] (${it && it.id})`;
    if (!it || typeof it !== 'object') return err(`${where} 非对象`);
    if (typeof it.id !== 'string' || !it.id) err(`${where} 缺 id`);
    else if (allIds.has(it.id)) err(`${where} id 重复: ${it.id}`);
    else allIds.add(it.id);
    if (typeof it.name !== 'string' || !it.name) err(`${where} 缺 name`);
    if (typeof it.desc !== 'string' || !it.desc) err(`${where} 缺 desc`);
    if (it.category !== CATEGORY[key]) err(`${where} category 应为 ${CATEGORY[key]},实为 ${it.category}`);
    for (const f of ['tags', 'requireAll', 'requireAny', 'forbid']) {
      if (!Array.isArray(it[f]) || it[f].some((x) => typeof x !== 'string')) err(`${where} 字段 ${f} 必须是字符串数组`);
    }
    if (Array.isArray(it.tags) && Array.isArray(it.forbid)) {
      const bad = it.tags.filter((t) => it.forbid.includes(t));
      if (bad.length) err(`${where} 自相矛盾:tags 与 forbid 交集 ${bad}`);
    }
    if (key === 'timeline') {
      if (!Number.isFinite(it.order)) err(`${where} 缺 order`);
      if (it.requireAll.length || it.requireAny.length || it.forbid.length) err(`${where} 时间节点约束必须为空(第 1 步无上下文)`);
    }
  });
  console.log(`  ${key}: ${list.length} 条`);
}
const orders = timeline.map((t) => t.order);
for (let i = 1; i < orders.length; i++) if (orders[i] <= orders[i - 1]) { err('timeline.order 未严格递增'); break; }

/* ---------- 2. 单调性不变量(无死路的前提 A) ---------- */
console.log('== 2. 标签单调性不变量 ==');
const eraVocab = new Set(timeline.flatMap((t) => t.tags));
const nonTimeline = [...places, ...species, ...socialRoles, ...elements];
const forbidVocab = new Set([...timeline, ...nonTimeline].flatMap((x) => x.forbid));
for (const t of forbidVocab) {
  if (!eraVocab.has(t)) err(`forbid 标签「${t}」不在时代词表(timeline tags)中`);
}
for (const it of nonTimeline) {
  const bad = it.tags.filter((t) => forbidVocab.has(t));
  if (bad.length) err(`非 timeline 条目 ${it.id}(${it.name}) 携带了 forbid 词表中的标签: ${bad} —— 会破坏单调性`);
}
for (const r of socialRoles) {
  const outside = [...r.requireAll, ...r.requireAny].filter((t) => !eraVocab.has(t));
  if (outside.length) err(`身份 ${r.id}(${r.name}) 的 require 用了非时代词表标签 ${outside}(身份必须在第 1 步可判定)`);
}
for (const s of species) {
  if (s.tags.includes('has-society') && !s.forbid.includes('no-society')) {
    err(`物种 ${s.id}(${s.name}) 带 has-society 但未 forbid no-society`);
  }
}
console.log(`  时代词表 ${eraVocab.size} 个标签;forbid 词表 ${forbidVocab.size} 个标签;非 timeline 条目 ${nonTimeline.length} 条`);

/* ---------- 过滤器(与 engine.contextAllows 一致) ---------- */
const allows = (it, ctx) => {
  for (const t of it.forbid) if (ctx.has(t)) return false;
  for (const t of it.requireAll) if (!ctx.has(t)) return false;
  if (it.requireAny.length && !it.requireAny.some((t) => ctx.has(t))) return false;
  return true;
};
const pool = (list, ctx) => list.filter((it) => allows(it, ctx));

/* ---------- 3. 逐时间节点静态保障(无死路的前提 B) ---------- */
console.log('== 3. 逐时间节点候选池 ==');
let minPlace = Infinity, minSpecies = Infinity, minElem = Infinity, minRole = Infinity;
for (const t of timeline) {
  const ctx = new Set(t.tags);
  const p = pool(places, ctx).length;
  const s = pool(species, ctx).length;
  const e = pool(elements, ctx).length;
  minPlace = Math.min(minPlace, p); minSpecies = Math.min(minSpecies, s); minElem = Math.min(minElem, e);
  if (p < 1) err(`节点 ${t.id}(${t.name}) 地点候选为 0`);
  if (s < 2) err(`节点 ${t.id}(${t.name}) 物种候选 ${s} < 2`);
  if (e < 20) err(`节点 ${t.id}(${t.name}) 元素候选 ${e} < 20`);
  if (t.tags.includes('has-society-possible')) {
    const r = pool(socialRoles, ctx).length;
    minRole = Math.min(minRole, r);
    if (r < 1) err(`节点 ${t.id}(${t.name}) 为社会纪元但身份候选为 0`);
  }
  if (t.tags.includes('no-society')) {
    const soc = pool(species, ctx).filter((x) => x.tags.includes('has-society'));
    if (soc.length) err(`节点 ${t.id}(${t.name}) 为无社会纪元却能抽到 has-society 物种: ${soc.map((x) => x.id)}`);
  }
}
console.log(`  各节点最小候选池 —— 地点: ${minPlace}, 物种: ${minSpecies}, 元素: ${minElem}, 身份(社会纪元): ${minRole}`);

/* ---------- 4. 全流程随机模拟(经验兜底 C) ---------- */
console.log('== 4. 全流程模拟 ==');
let mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t2 = Math.imul(a ^ (a >>> 15), 1 | a); t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2; return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296; };
const rng = mulberry(20260813);
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
let simFail = 0, roleDraws = 0, roleSkips = 0;
const N = 5000;
for (let i = 0; i < N; i++) {
  const ctx = new Set();
  const add = (it) => it.tags.forEach((t) => ctx.add(t));
  const t = pick(timeline); add(t);
  const pp = pool(places, ctx); if (!pp.length) { simFail++; continue; } add(pick(pp));
  const sp1 = pool(species, ctx); if (!sp1.length) { simFail++; continue; } const a = pick(sp1); add(a);
  const sp2 = pool(species, ctx); if (!sp2.length) { simFail++; continue; } const b = pick(sp2); add(b);
  for (const who of [a, b]) {
    if (who.tags.includes('has-society')) {
      roleDraws += 1;
      const rp = pool(socialRoles, ctx);
      if (!rp.length) { roleSkips += 1; simFail++; } else add(pick(rp));
    }
  }
  const used = new Set();
  let got = 0;
  for (let k = 0; k < 8; k++) {
    const ep = pool(elements, ctx).filter((x) => !used.has(x.id));
    if (!ep.length) break;
    const e = pick(ep); used.add(e.id); add(e); got += 1;
  }
  if (got < 8) simFail++;
}
console.log(`  模拟 ${N} 次:失败 ${simFail};身份步触发 ${roleDraws} 次,其中池空跳过 ${roleSkips} 次`);
if (simFail) err(`模拟中出现 ${simFail} 次死路/短缺`);

/* ---------- 5. 分布统计 ---------- */
console.log('== 5. 分布统计 ==');
const eraWords = ['big-bang', 'first-stars', 'galaxy-era', 'planet-forming', 'prehistoric', 'stone-age', 'bronze-age', 'ancient', 'classical', 'medieval', 'renaissance', 'industrial', 'modern', 'information-age', 'near-future', 'space-age', 'cyber-era', 'post-human', 'far-future'];
const eraCount = Object.fromEntries(eraWords.map((w) => [w, timeline.filter((t) => t.tags.includes(w)).length]));
console.log('  timeline 时代分布:', JSON.stringify(eraCount));
const famCount = {};
for (const e of elements) { const fam = e.id.split('-')[1]; famCount[fam] = (famCount[fam] || 0) + 1; }
console.log('  elements 家族分布:', JSON.stringify(famCount));
console.log(`  species: ${species.length}(has-society: ${species.filter((s) => s.tags.includes('has-society')).length})`);
console.log(`  socialRoles: ${socialRoles.length};places: ${places.length}`);

console.log('');
if (errors) { console.error(`✗ 校验失败:${errors} 个错误,${warnings} 个警告`); process.exit(1); }
console.log(`✓ 校验通过:0 错误,${warnings} 个警告 —— 字段完整、无死路保障成立`);
