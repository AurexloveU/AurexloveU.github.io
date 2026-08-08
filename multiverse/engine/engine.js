/**
 * multiverse/engine/engine.js
 * 多元宇宙抽卡引擎 —— 纯函数:约束过滤 + 顺序抽取 + 种子可复现。
 *
 * 与数据端的契约(见 ../data/schema.md 与根 README):
 *   可抽项 item = { id, name, en?, desc, category, tags[], requireAll[], requireAny[], forbid[] }
 *   CONTEXT   = 已抽出各项 tags 的累积集合,由时间节点播种。
 *   过滤规则  = requireAll ⊆ CONTEXT
 *             ∧ (requireAny 为空 ∨ requireAny ∩ CONTEXT ≠ ∅)
 *             ∧ forbid ∩ CONTEXT = ∅
 *   抽取顺序  = 时间(1) → 地点(1) → 物种×2(Aurex 先、Aevi 后,后者可见前者 tags)
 *             → 社会身份(物种带 has-society 才抽,按 CONTEXT 里的时代标签自然过滤)
 *             → 元素×N(默认 5~8,不重复,逐个并入 CONTEXT)
 *
 * 可复现性:每一步用 deriveRng(seed, 步骤键, 该步重抽次数) 派生独立随机流。
 * 因此「seed + attempts 向量」即可精确重放整次抽取(包括每一次重抽)。
 * 本模块无副作用、不做 IO,浏览器与 Node(后端重放)共用同一份代码。
 */

import { deriveRng, pickInt } from './random.js';

/** 步骤顺序(同时是 attempts 向量的编码顺序)。 */
export const STEP_KEYS = ['time', 'place', 'speciesA', 'speciesB', 'roleA', 'roleB', 'elements'];

/** 物种是否拥有社会结构(决定要不要抽社会身份)。 */
export const SOCIETY_TAG = 'has-society';

export const DEFAULT_ELEMENT_RANGE = [5, 8];

/* ------------------------------------------------------------------ */
/* 数据归一化                                                          */
/* ------------------------------------------------------------------ */

/** 把单个可抽项补齐默认字段(容忍数据端缺字段)。 */
export function normalizeItem(raw, fallbackCategory) {
  if (!raw || typeof raw !== 'object') return null;
  const item = {
    id: String(raw.id != null ? raw.id : ''),
    name: String(raw.name != null ? raw.name : raw.id != null ? raw.id : '未命名'),
    en: raw.en != null ? String(raw.en) : '',
    desc: raw.desc != null ? String(raw.desc) : '',
    category: String(raw.category != null ? raw.category : fallbackCategory || ''),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    requireAll: Array.isArray(raw.requireAll) ? raw.requireAll.map(String) : [],
    requireAny: Array.isArray(raw.requireAny) ? raw.requireAny.map(String) : [],
    forbid: Array.isArray(raw.forbid) ? raw.forbid.map(String) : [],
  };
  if (!item.id) item.id = item.name;
  return item;
}

/** 数据文件可能是数组,也可能是 {items:[...]} / {list:[...]},统一成数组。 */
export function normalizeList(raw, fallbackCategory) {
  let arr = raw;
  if (raw && !Array.isArray(raw)) {
    arr = raw.items || raw.list || raw.data || [];
  }
  if (!Array.isArray(arr)) arr = [];
  return arr.map((it) => normalizeItem(it, fallbackCategory)).filter(Boolean);
}

/**
 * 归一化整套数据 { timeline, places, species, socialRoles, elements }。
 * 任一缺失则为空数组(由调用方决定是否用兜底数据)。
 */
export function normalizeData(raw) {
  const r = raw || {};
  return {
    timeline: normalizeList(r.timeline, 'time'),
    places: normalizeList(r.places, 'place'),
    species: normalizeList(r.species, 'species'),
    socialRoles: normalizeList(r.socialRoles, 'socialRole'),
    elements: normalizeList(r.elements, 'element'),
  };
}

/* ------------------------------------------------------------------ */
/* 约束过滤                                                            */
/* ------------------------------------------------------------------ */

/** a(数组)与 ctx(Set)是否有交集。 */
function intersects(arr, ctx) {
  if (!arr || !arr.length) return false;
  for (const t of arr) if (ctx.has(t)) return true;
  return false;
}

/**
 * 单项是否被当前上下文允许。
 * opts.ignoreAny / opts.ignoreAll 用于兜底降级(forbid 永远生效)。
 */
export function contextAllows(item, ctx, opts = {}) {
  if (intersects(item.forbid, ctx)) return false;
  if (!opts.ignoreAll) {
    for (const t of item.requireAll) if (!ctx.has(t)) return false;
  }
  if (!opts.ignoreAny) {
    if (item.requireAny.length && !intersects(item.requireAny, ctx)) return false;
  }
  return true;
}

/** 过滤出所有被上下文允许的候选项。 */
export function filterCandidates(items, ctx, opts = {}) {
  return items.filter((it) => contextAllows(it, ctx, opts));
}

/** 把一项的 tags 并入上下文,返回本次新增的 tags(用于 UI 展示)。 */
export function mergeTags(ctx, item) {
  const gained = [];
  if (!item) return gained;
  for (const t of item.tags) {
    if (!ctx.has(t)) {
      ctx.add(t);
      gained.push(t);
    }
  }
  return gained;
}

/* ------------------------------------------------------------------ */
/* 单步抽取                                                            */
/* ------------------------------------------------------------------ */

/**
 * 从 items 中按上下文抽 1 项。
 * 严格池为空时的降级阶梯(relaxLevel):
 *   0 = 严格命中;1 = 忽略 requireAny;2 = 只看 forbid;3 = 全量兜底。
 * opts.noRelax = true(社会身份用)则不降级,池空即返回 empty。
 * opts.exclude = Set(id) 排除已抽走的项(元素去重用)。
 */
export function drawStep(items, ctx, seed, stepKey, attempt, opts = {}) {
  const rng = deriveRng(seed, stepKey, attempt | 0);
  const exclude = opts.exclude || null;
  const usable = exclude ? items.filter((it) => !exclude.has(it.id)) : items;

  let pool = filterCandidates(usable, ctx);
  let relaxLevel = 0;
  if (!pool.length && !opts.noRelax) {
    pool = filterCandidates(usable, ctx, { ignoreAny: true });
    relaxLevel = 1;
    if (!pool.length) {
      pool = filterCandidates(usable, ctx, { ignoreAny: true, ignoreAll: true });
      relaxLevel = 2;
      if (!pool.length) {
        pool = usable.slice();
        relaxLevel = 3;
      }
    }
  }
  if (!pool.length) {
    return { key: stepKey, item: null, empty: true, poolSize: 0, relaxLevel: 0, attempt: attempt | 0 };
  }
  const item = pool[Math.floor(rng() * pool.length)];
  return { key: stepKey, item, poolSize: pool.length, relaxLevel, attempt: attempt | 0 };
}

/* ------------------------------------------------------------------ */
/* 整次抽取                                                            */
/* ------------------------------------------------------------------ */

/**
 * 主入口:抽出一个完整宇宙。纯函数,同参数必同结果。
 *
 * @param {object} opts
 *   data          归一化后的五份数据(可用 normalizeData 得到)
 *   seed          种子字符串
 *   attempts      各步重抽次数 { time, place, speciesA, speciesB, roleA, roleB, elements },缺省 0
 *   elementCount  'auto'(由种子在 elementRange 内定)或固定整数
 *   elementRange  auto 模式的 [min, max],默认 [5, 8]
 *   names         { a, b } 两位主角名,默认 Aurex / Aevi
 *
 * @returns {object} result —— 见文件尾注释的结构说明。
 */
export function drawUniverse(opts) {
  const {
    data,
    seed,
    attempts = {},
    elementCount = 'auto',
    elementRange = DEFAULT_ELEMENT_RANGE,
    names = { a: 'Aurex', b: 'Aevi' },
  } = opts;

  const at = (k) => (attempts[k] | 0) || 0;
  const ctx = new Set();
  const steps = {};

  /* 1) 时间 —— 播种上下文 */
  steps.time = drawStep(data.timeline, ctx, seed, 'time', at('time'));
  steps.time.gainedTags = mergeTags(ctx, steps.time.item);

  /* 2) 地点 */
  steps.place = drawStep(data.places, ctx, seed, 'place', at('place'));
  steps.place.gainedTags = mergeTags(ctx, steps.place.item);

  /* 3) 物种 ×2 —— Aevi 的一抽可见 Aurex 物种的 tags,保持配对协调 */
  steps.speciesA = drawStep(data.species, ctx, seed, 'speciesA', at('speciesA'));
  steps.speciesA.forWhom = 'a';
  steps.speciesA.gainedTags = mergeTags(ctx, steps.speciesA.item);

  steps.speciesB = drawStep(data.species, ctx, seed, 'speciesB', at('speciesB'));
  steps.speciesB.forWhom = 'b';
  steps.speciesB.gainedTags = mergeTags(ctx, steps.speciesB.item);

  /* 4) 社会身份 —— 仅当该角色物种带 has-society;池空则跳过,不降级 */
  const drawRole = (who, speciesStep, stepKey) => {
    const sp = speciesStep.item;
    if (!sp || !sp.tags.includes(SOCIETY_TAG)) {
      return { key: stepKey, forWhom: who, skipped: true, reason: 'no-society', item: null, gainedTags: [] };
    }
    const rec = drawStep(data.socialRoles, ctx, seed, stepKey, at(stepKey), { noRelax: true });
    rec.forWhom = who;
    if (rec.empty) {
      return { key: stepKey, forWhom: who, skipped: true, reason: 'no-candidate', item: null, gainedTags: [] };
    }
    rec.gainedTags = mergeTags(ctx, rec.item);
    return rec;
  };
  steps.roleA = drawRole('a', steps.speciesA, 'roleA');
  steps.roleB = drawRole('b', steps.speciesB, 'roleB');

  /* 5) 元素 ×N —— 数量流与选择流分离,固定 N 不影响元素序列 */
  const elemAttempt = at('elements');
  let count;
  if (elementCount === 'auto') {
    const countRng = deriveRng(seed, 'elementCount', elemAttempt);
    count = pickInt(countRng, elementRange[0], elementRange[1]);
  } else {
    count = Math.max(1, Math.min(20, elementCount | 0));
  }

  const elemRng = deriveRng(seed, 'elements', elemAttempt);
  const drawnElems = [];
  const used = new Set();
  for (let i = 0; i < count; i++) {
    const pool = filterCandidates(
      data.elements.filter((it) => !used.has(it.id)),
      ctx,
    );
    if (!pool.length) break;
    const item = pool[Math.floor(elemRng() * pool.length)];
    used.add(item.id);
    const gainedTags = mergeTags(ctx, item);
    drawnElems.push({ item, poolSize: pool.length, gainedTags });
  }
  steps.elements = {
    key: 'elements',
    items: drawnElems,
    requested: count,
    shortfall: count - drawnElems.length,
    attempt: elemAttempt,
  };

  return {
    seed,
    names: { a: names.a || 'Aurex', b: names.b || 'Aevi' },
    attempts: STEP_KEYS.reduce((m, k) => ((m[k] = at(k)), m), {}),
    elementCountSpec: elementCount === 'auto' ? 'auto' : count,
    elementCount: count,
    steps,
    context: Array.from(ctx),
  };
}

/* ------------------------------------------------------------------ */
/* 重放码(分享 / 回放)                                               */
/* ------------------------------------------------------------------ */

/**
 * 重放码格式:  seed~a0.a1.a2.a3.a4.a5.a6~n
 *   a0..a6 = STEP_KEYS 顺序的重抽次数;n = 'a'(auto)或固定元素数。
 * 例:薰衣-k3f9qw~0.0.1.0.0.0.2~a
 */
export function encodeReplay({ seed, attempts = {}, elementCountSpec = 'auto' }) {
  const vec = STEP_KEYS.map((k) => (attempts[k] | 0) || 0).join('.');
  const n = elementCountSpec === 'auto' ? 'a' : String(elementCountSpec | 0);
  return `${String(seed).replace(/~/g, '-')}~${vec}~${n}`;
}

/** 解析重放码;容忍只有 seed 的裸字符串。解析失败返回 null。 */
export function parseReplay(code) {
  if (typeof code !== 'string' || !code.trim()) return null;
  const parts = code.trim().split('~');
  if (parts.length === 1) {
    return { seed: parts[0], attempts: {}, elementCountSpec: 'auto' };
  }
  const nRaw = parts.length >= 3 ? parts[parts.length - 1] : 'a';
  const vecRaw = parts.length >= 3 ? parts[parts.length - 2] : parts[1];
  const seed = parts.slice(0, parts.length >= 3 ? -2 : -1).join('~');
  if (!seed) return null;
  const nums = String(vecRaw).split('.').map((x) => parseInt(x, 10));
  const attempts = {};
  STEP_KEYS.forEach((k, i) => {
    attempts[k] = Number.isFinite(nums[i]) && nums[i] > 0 ? nums[i] : 0;
  });
  const elementCountSpec =
    nRaw === 'a' || nRaw === '' || nRaw == null
      ? 'auto'
      : Math.max(1, Math.min(20, parseInt(nRaw, 10) || 0)) || 'auto';
  return { seed, attempts, elementCountSpec };
}

/*
 * result 结构说明
 * ----------------
 * {
 *   seed, names: {a, b},
 *   attempts: {time, place, speciesA, speciesB, roleA, roleB, elements},
 *   elementCountSpec: 'auto' | number,   // 配置
 *   elementCount: number,                // 实际请求数
 *   context: string[],                   // 最终累积标签
 *   steps: {
 *     time / place / speciesA / speciesB:
 *       { item, poolSize, relaxLevel, gainedTags, attempt, forWhom? } | { item: null, empty: true },
 *     roleA / roleB:
 *       同上,或 { skipped: true, reason: 'no-society' | 'no-candidate' },
 *     elements:
 *       { items: [{ item, poolSize, gainedTags }], requested, shortfall, attempt },
 *   },
 * }
 */
