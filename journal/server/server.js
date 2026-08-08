/* ============================================================
   拾光集 · 后端(Node + Express)

   启动:
     cd server
     npm install
     npm start          # 默认 http://localhost:4870

   提供:
     - 前端静态托管(上一级目录,即 journal/)
     - 日记 CRUD:GET/POST /api/entries、GET/PUT/DELETE /api/entries/:id
     - 全文搜索:GET /api/search?q=
     - 导出:GET /api/export/markdown、GET /api/export/json
     - 健康检查:GET /api/health(前端用它自动探测后端)

   持久化:server/data/entries.json(先写临时文件再改名,防止写坏)。
   前端离线也完整可用;后端在线时,前端启动会双向合并并实时镜像。
   ============================================================ */
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 4870;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'entries.json');

/* ---------------- 持久化 ---------------- */

let entries = [];

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    entries = Array.isArray(raw) ? raw : [];
  } catch (e) {
    entries = [];
  }
}

let saveTimer = null;
function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 150);
}
function persistNow() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

/* ---------------- 数据校验 ---------------- */

const MOOD_IDS = ['happy', 'calm', 'tired', 'anxious', 'sad'];
const THEME_IDS = ['mist', 'lavender', 'sepia', 'sage', 'dusk', 'seasalt', 'ink', 'night'];

function newId() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 只保留白名单字段,并做类型清洗;返回 null 表示不合法 */
function sanitize(raw, forcedId) {
  if (!raw || typeof raw !== 'object') return null;
  const date = String(raw.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const e = {
    id: String(forcedId || raw.id || newId()),
    date,
    title: String(raw.title || '').slice(0, 300),
    body: String(raw.body || '').slice(0, 200000),
    tags: Array.isArray(raw.tags)
      ? raw.tags.map(t => String(t).trim()).filter(Boolean).slice(0, 30)
      : [],
    mood: MOOD_IDS.includes(raw.mood) ? raw.mood : null,
    theme: THEME_IDS.includes(raw.theme) ? raw.theme : null,
    pinned: !!raw.pinned,
    fav: !!raw.fav,
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now()
  };
  return e;
}

function findIndex(id) {
  return entries.findIndex(e => e.id === id);
}

function sortedDesc(list) {
  return list.slice().sort((a, b) =>
    a.date === b.date ? (b.updatedAt || 0) - (a.updatedAt || 0) : (a.date < b.date ? 1 : -1));
}

/* ---------------- 导出格式 ---------------- */

const MOOD_LABEL = { happy: '😄 开心', calm: '😌 平静', tired: '🥱 疲惫', anxious: '😟 烦躁', sad: '😢 低落' };

function entryToMd(e) {
  const meta = ['- 日期:' + e.date];
  if (e.mood) meta.push('- 心情:' + (MOOD_LABEL[e.mood] || e.mood));
  if (e.tags.length) meta.push('- 标签:' + e.tags.join('、'));
  if (e.fav) meta.push('- 收藏:★');
  return '# ' + (e.title || '无题') + '\n\n' + meta.join('\n') + '\n\n' + (e.body || '').trim() + '\n';
}

/* ---------------- 应用 ---------------- */

const app = express();
app.use(express.json({ limit: '5mb' }));

// CORS:前端可能从 file:// 或其他端口访问,放开跨域(本地单机应用)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 顺带托管前端:启动后直接访问 http://localhost:4870/ 即是日记本
app.use(express.static(path.join(__dirname, '..')));

/* -------- 健康检查 -------- */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'shiguangji-server', count: entries.length, time: Date.now() });
});

/* -------- 列表(带过滤) --------
   支持 ?q= 关键词 ?tag= 标签 ?mood= 心情 ?from=&to= 日期区间
        ?fav=1 只看收藏 ?pinned=1 只看置顶                    */
app.get('/api/entries', (req, res) => {
  let list = entries;
  const { q, tag, mood, from, to, fav, pinned } = req.query;
  if (q) {
    const t = String(q).toLowerCase();
    list = list.filter(e =>
      e.title.toLowerCase().includes(t) ||
      e.body.toLowerCase().includes(t) ||
      e.tags.join(' ').toLowerCase().includes(t));
  }
  if (tag) list = list.filter(e => e.tags.includes(String(tag)));
  if (mood) list = list.filter(e => e.mood === String(mood));
  if (from) list = list.filter(e => e.date >= String(from));
  if (to) list = list.filter(e => e.date <= String(to));
  if (fav === '1') list = list.filter(e => e.fav);
  if (pinned === '1') list = list.filter(e => e.pinned);
  res.json(sortedDesc(list));
});

/* -------- 单篇 -------- */
app.get('/api/entries/:id', (req, res) => {
  const i = findIndex(req.params.id);
  if (i < 0) return res.status(404).json({ error: 'entry not found' });
  res.json(entries[i]);
});

/* -------- 新建(缺 id 时生成) -------- */
app.post('/api/entries', (req, res) => {
  const e = sanitize(req.body);
  if (!e) return res.status(400).json({ error: 'invalid entry: need date as YYYY-MM-DD' });
  const i = findIndex(e.id);
  if (i >= 0) entries[i] = e; else entries.push(e);
  persistSoon();
  res.status(i >= 0 ? 200 : 201).json(e);
});

/* -------- 更新 / 幂等写入(前端同步用) -------- */
app.put('/api/entries/:id', (req, res) => {
  const e = sanitize(req.body, req.params.id);
  if (!e) return res.status(400).json({ error: 'invalid entry: need date as YYYY-MM-DD' });
  const i = findIndex(e.id);
  if (i >= 0) entries[i] = e; else entries.push(e);
  persistSoon();
  res.json(e);
});

/* -------- 删除 -------- */
app.delete('/api/entries/:id', (req, res) => {
  const i = findIndex(req.params.id);
  if (i < 0) return res.status(404).json({ error: 'entry not found' });
  entries.splice(i, 1);
  persistSoon();
  res.sendStatus(204);
});

/* -------- 全文搜索(带上下文片段) -------- */
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.json([]);
  const out = [];
  for (const e of sortedDesc(entries)) {
    const hay = (e.title + '\n' + e.body + '\n' + e.tags.join(' ')).toLowerCase();
    const pos = hay.indexOf(q);
    if (pos < 0) continue;
    const plain = e.title + '\n' + e.body + '\n' + e.tags.join(' ');
    const start = Math.max(0, pos - 30);
    out.push({
      id: e.id,
      date: e.date,
      title: e.title || '无题',
      snippet: (start > 0 ? '…' : '') + plain.slice(start, pos + q.length + 50).replace(/\s+/g, ' ') + '…'
    });
  }
  res.json(out);
});

/* -------- 导出 -------- */
app.get('/api/export/markdown', (req, res) => {
  const list = sortedDesc(entries).reverse();
  const head = '# 拾光集 · 日记导出\n\n> 共 ' + list.length + ' 篇 · 导出于 ' +
    new Date().toISOString().slice(0, 10) + '\n\n---\n\n';
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="journal-export.md"');
  res.send(head + list.map(entryToMd).join('\n---\n\n'));
});

app.get('/api/export/json', (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="journal-export.json"');
  res.send(JSON.stringify({
    app: '拾光集',
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: sortedDesc(entries).reverse()
  }, null, 2));
});

/* -------- 兜底 -------- */
app.use('/api', (req, res) => res.status(404).json({ error: 'unknown api route' }));
app.use((err, req, res, next) => {          // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

/* ---------------- 启动 ---------------- */

load();
app.listen(PORT, () => {
  console.log('拾光集后端已启动: http://localhost:' + PORT);
  console.log('  前端页面   GET  /');
  console.log('  健康检查   GET  /api/health');
  console.log('  日记列表   GET  /api/entries');
  console.log('  数据文件   ' + DATA_FILE);
});
