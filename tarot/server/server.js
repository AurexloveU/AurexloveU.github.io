/* ============================================================
   AUREX / TAROT — server.js
   每日牌 / 牌库 / 解读历史 API,JSON 文件持久化。
   与前端 js/core.js 使用完全相同的确定性 RNG(xmur3 + mulberry32),
   因此 GET /api/daily 与浏览器端 Tarot.daily() 逐位一致。

   启动:cd server && npm install && npm start
   默认端口 7777,可用环境变量 PORT 覆盖。
   同时静态托管上级目录(整个 tarot 前端),即
   http://localhost:7777/ 直接可用,且前端自动同源走本后端。
   ============================================================ */
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 7777;
const ROOT = path.join(__dirname, '..');               // tarot/ 前端根
const DATA_DIR = path.join(__dirname, 'data');
const HIST_FILE = path.join(DATA_DIR, 'history.json');

/* ---------- 牌库数据 ---------- */
const deck = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'cards.json'), 'utf8'));
const CARDS = deck.cards;
const byId = new Map(CARDS.map((c) => [c.id, c]));

/* ---------- 确定性 RNG(与前端 core.js 完全一致) ---------- */
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = (seedStr) => mulberry32(xmur3(String(seedStr))());
const REVERSE_P = 0.35;

function todayStr(d) {
  const t = d || new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}
function dailyDraw(dateStr) {
  const r = rng('aurex-tarot-daily:' + dateStr);
  const card = CARDS[Math.floor(r() * CARDS.length)];
  return { date: dateStr, card, reversed: r() < REVERSE_P, seed: 'aurex-tarot-daily:' + dateStr };
}
/** 与前端 Tarot.shuffle 一致的整副洗牌(供 /api/draw 复现校验) */
function shuffle(seedStr) {
  const r = rng('aurex-tarot-shuffle:' + seedStr);
  const order = CARDS.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.map((card) => ({ card, reversed: r() < REVERSE_P }));
}

/* ---------- 历史:JSON 文件持久化 ---------- */
function loadHistory() {
  try {
    const arr = JSON.parse(fs.readFileSync(HIST_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}
function saveHistory(arr) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = HIST_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(arr, null, 2));
  fs.renameSync(tmp, HIST_FILE); // 原子替换,避免写一半损坏
}
let history = loadHistory();

function validRecord(r) {
  return r && typeof r === 'object'
    && typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 64
    && typeof r.ts === 'number'
    && Array.isArray(r.cards) && r.cards.length > 0 && r.cards.length <= 20
    && r.cards.every((c) => c && typeof c.id === 'string' && byId.has(c.id));
}
/** 同 id 记录以 updated 较新者为准 */
function upsert(rec) {
  const i = history.findIndex((r) => r.id === rec.id);
  if (i < 0) { history.push(rec); return true; }
  if ((rec.updated || rec.ts || 0) >= (history[i].updated || history[i].ts || 0)) { history[i] = rec; return true; }
  return false;
}

/* ---------- 应用 ---------- */
const app = express();
app.use(express.json({ limit: '2mb' }));

// CORS:允许 GitHub Pages 等异源前端调用本地后端
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'aurex-tarot-server', version: '1.0.0', time: Date.now(), records: history.length, cards: CARDS.length });
});

/* --- 牌库 --- */
app.get('/api/cards', (req, res) => {
  const { suit, arcana, q } = req.query;
  let out = CARDS;
  if (arcana) out = out.filter((c) => c.arcana === arcana);
  if (suit) out = out.filter((c) => c.suit === suit);
  if (q) {
    const t = String(q).toLowerCase();
    out = out.filter((c) => (c.name_zh + c.name_en + c.keywords.join('')).toLowerCase().includes(t));
  }
  res.json({ meta: deck.meta, count: out.length, cards: out });
});
app.get('/api/cards/:id', (req, res) => {
  const c = byId.get(req.params.id);
  if (!c) return res.status(404).json({ error: 'card not found' });
  res.json(c);
});

/* --- 每日一牌 --- */
app.get('/api/daily', (req, res) => {
  const ds = req.query.date || todayStr();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) return res.status(400).json({ error: 'date 需为 YYYY-MM-DD' });
  res.json(dailyDraw(ds));
});

/* --- 种子抽牌(供复现校验 / 第三方集成) --- */
app.get('/api/draw', (req, res) => {
  const seed = String(req.query.seed || '');
  const n = Math.max(1, Math.min(78, parseInt(req.query.n, 10) || 3));
  if (!seed) return res.status(400).json({ error: '缺少 seed 参数' });
  const drawn = shuffle(seed).slice(0, n).map((d) => ({ id: d.card.id, name_zh: d.card.name_zh, name_en: d.card.name_en, reversed: d.reversed }));
  res.json({ seed, n, cards: drawn });
});

/* --- 解读历史 --- */
app.get('/api/history', (req, res) => {
  res.json({ count: history.length, items: [...history].sort((a, b) => b.ts - a.ts) });
});
app.get('/api/history/:id', (req, res) => {
  const r = history.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'record not found' });
  res.json(r);
});
app.post('/api/history', (req, res) => {
  const rec = req.body;
  if (!validRecord(rec)) return res.status(400).json({ error: '记录格式不正确(需 id/ts/cards,cards 的 id 必须存在于牌库)' });
  upsert(rec);
  saveHistory(history);
  res.json({ ok: true, id: rec.id, count: history.length });
});
app.delete('/api/history/:id', (req, res) => {
  const before = history.length;
  history = history.filter((r) => r.id !== req.params.id);
  if (history.length !== before) saveHistory(history);
  res.json({ ok: true, removed: before - history.length });
});
/* 双向合并:客户端上传全量,服务端合并后回传全量,双方各自落盘 */
app.post('/api/history/sync', (req, res) => {
  const items = req.body && req.body.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: '需要 { items: [...] }' });
  let accepted = 0;
  items.forEach((r) => { if (validRecord(r) && upsert(r)) accepted++; });
  saveHistory(history);
  res.json({ ok: true, accepted, items: [...history].sort((a, b) => b.ts - a.ts) });
});

/* --- 静态托管前端 --- */
app.use(express.static(ROOT, { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log('AUREX / TAROT server · http://localhost:' + PORT);
  console.log('  今日之牌:GET /api/daily  →  ' + dailyDraw(todayStr()).card.name_zh);
  console.log('  历史记录:' + history.length + ' 条,存于 ' + HIST_FILE);
});
