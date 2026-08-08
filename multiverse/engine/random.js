/**
 * multiverse/engine/random.js
 * 可复现随机 —— 同一个种子字符串,永远产生同一串随机数。
 *
 * 组合:xmur3(字符串哈希) -> sfc32(PRNG)。
 * deriveRng(seed, ...path) 用 "seed + 路径" 派生独立子流:
 * 每个抽取步骤、每次重抽,都有自己互不干扰的随机流,
 * 因此「种子 + 各步重抽次数」即可完整重放一次抽取。
 */

/** 把任意字符串搅拌成 32 位整数序列(用作 PRNG 的种子)。 */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** sfc32:小而快、质量好的 128 位状态 PRNG,返回 [0,1) 浮点。 */
export function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** 由种子字符串创建 rng()。同字符串 => 同序列。 */
export function makeRng(seedStr) {
  const gen = xmur3(String(seedStr));
  return sfc32(gen(), gen(), gen(), gen());
}

/**
 * 派生子随机流:makeRng(seed + '' + path...)。
 * 例:deriveRng(seed, 'speciesA', 2) —— Aurex 物种第 3 次抽取专属的流。
 */
export function deriveRng(seedStr, ...path) {
  return makeRng(String(seedStr) + '' + path.join(''));
}

/** [min, max] 闭区间随机整数。 */
export function pickInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** 随机取数组一项(数组为空返回 undefined)。 */
export function pickOne(rng, arr) {
  if (!arr || !arr.length) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

/** Fisher–Yates 洗牌(返回副本,不改原数组)。 */
export function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SEED_WORDS = [
  '紫雾', '星屑', '薰衣', '半梦', '侧影', '余晖', '低语', '环流',
  '浮岛', '夜航', '洄游', '镜潮', '未名', '晨白', '雨檐', '空弦',
  '叠嶂', '细雪', '橙昼', '幽蓝', '茧月', '拾光', '折纸', '同频',
];

/**
 * 生成一个好念、好分享的新种子,如「薰衣-k3f9qw」。
 * (这里用 Math.random 没关系:它只负责“发牌”,重放靠的是种子本身。)
 */
export function randomSeed() {
  const w = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
  const tail = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  return `${w}-${tail}`;
}
