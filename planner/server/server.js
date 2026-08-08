/* ============================================================
   Aurex 计划台 · 可选后端
   Node + Express · JSON 文件持久化(零外部数据库)

   启动:
     cd planner/server
     npm install
     npm start          # 默认 http://localhost:8787

   同时静态托管上级目录的前端,
   即打开 http://localhost:8787 就是完整应用。
   ============================================================ */
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/* ---------------- 存储:载入 / 防抖落盘(临时文件 + 原子改名) ---------------- */

let db = { tasks: [] };

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (Array.isArray(raw.tasks)) db = raw;
    }
  } catch (e) {
    console.warn('[db] 读取失败,使用空库:', e.message);
  }
}

let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}
function saveNow() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('[db] 写入失败:', e.message);
  }
}

/* ---------------- 日期与重复规则(与前端 recur.js 语义一致) ---------------- */

const pad2 = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDs = ds => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => fmt(new Date());
const addDays = (ds, n) => { const d = parseDs(ds); d.setDate(d.getDate() + n); return fmt(d); };
const diffDays = (a, b) => Math.round((parseDs(b) - parseDs(a)) / 86400000);
const dowMon = ds => (parseDs(ds).getDay() + 6) % 7;

function occursOn(t, ds) {
  if (t.deleted) return false;
  if (!t.repeat) return t.date === ds;
  if (!t.date || ds < t.date) return false;
  const r = t.repeat;
  if (r.type === 'daily') return true;
  if (r.type === 'weekly') {
    const days = (r.days && r.days.length) ? r.days : [dowMon(t.date)];
    return days.includes(dowMon(ds));
  }
  if (r.type === 'interval') return diffDays(t.date, ds) % Math.max(1, r.n | 0) === 0;
  return false;
}

const isDoneOn = (t, ds) => t.repeat ? !!(t.doneDates && t.doneDates[ds]) : !!t.done;

/* ---------------- 合并:按 updatedAt 新者胜(墓碑参与,删除得以传播) ---------------- */

function mergeTasks(a, b) {
  const map = new Map();
  for (const t of a) if (t && t.id) map.set(t.id, t);
  for (const t of b) {
    if (!t || !t.id) continue;
    const cur = map.get(t.id);
    if (!cur || (t.updatedAt || 0) > (cur.updatedAt || 0)) map.set(t.id, t);
  }
  return [...map.values()];
}

/** 清理 30 天前的墓碑 */
function purgeTombstones() {
  const cutoff = Date.now() - 30 * 86400000;
  db.tasks = db.tasks.filter(t => !t.deleted || (t.updatedAt || 0) > cutoff);
}

/* ---------------- 应用 ---------------- */

const app = express();
app.use(express.json({ limit: '4mb' }));

// CORS:前端可能由 GitHub Pages / file:// / 其他端口打开
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const activeTasks = () => db.tasks.filter(t => !t.deleted);

/* --- 健康检查 --- */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'aurex-planner-server', tasks: activeTasks().length, time: new Date().toISOString() });
});

/* --- 任务 CRUD --- */

app.get('/api/tasks', (req, res) => {
  res.json({ tasks: db.tasks });   // 含墓碑,供客户端正确合并删除
});

app.post('/api/tasks', (req, res) => {
  const body = req.body || {};
  if (!body.title || typeof body.title !== 'string') {
    return res.status(400).json({ error: 'title 必填' });
  }
  const now = Date.now();
  const task = {
    id: body.id || ('srv-' + now.toString(36) + '-' + Math.random().toString(36).slice(2, 8)),
    title: body.title,
    notes: body.notes || '',
    quadrant: [1, 2, 3, 4].includes(body.quadrant) ? body.quadrant : 2,
    priority: ['high', 'mid', 'low'].includes(body.priority) ? body.priority : 'mid',
    tags: Array.isArray(body.tags) ? body.tags : [],
    date: body.date || todayStr(),
    due: body.due || null,
    progress: Math.max(0, Math.min(100, body.progress | 0)),
    repeat: body.repeat || null,
    done: !!body.done,
    doneAt: body.doneAt || null,
    doneDates: body.doneDates || {},
    order: body.order || (db.tasks.reduce((m, t) => Math.max(m, t.order || 0), 0) + 10),
    createdAt: body.createdAt || now,
    updatedAt: now,
    deleted: false,
  };
  db.tasks.push(task);
  saveSoon();
  res.status(201).json({ task });
});

app.patch('/api/tasks/:id', (req, res) => {
  const t = db.tasks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: '任务不存在' });
  const allow = ['title', 'notes', 'quadrant', 'priority', 'tags', 'date', 'due',
    'progress', 'repeat', 'done', 'doneAt', 'doneDates', 'order', 'deleted'];
  for (const k of allow) if (k in req.body) t[k] = req.body[k];
  t.updatedAt = Date.now();
  saveSoon();
  res.json({ task: t });
});

app.delete('/api/tasks/:id', (req, res) => {
  const t = db.tasks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: '任务不存在' });
  t.deleted = true;               // 墓碑,供同步传播;30 天后自动清理
  t.updatedAt = Date.now();
  saveSoon();
  res.json({ ok: true });
});

/* --- 双向同步:客户端整表上传,按 updatedAt 合并后返回权威结果 --- */
app.post('/api/sync', (req, res) => {
  const incoming = (req.body && Array.isArray(req.body.tasks)) ? req.body.tasks : [];
  db.tasks = mergeTasks(db.tasks, incoming);
  purgeTombstones();
  saveSoon();
  res.json({ tasks: db.tasks, mergedAt: Date.now() });
});

/* --- 统计端点 --- */
app.get('/api/stats', (req, res) => {
  const today = todayStr();
  const tasks = activeTasks();

  // 近 30 天完成率
  let total = 0, done = 0;
  for (let i = 0; i < 30; i++) {
    const ds = addDays(today, -i);
    for (const t of tasks) {
      if (occursOn(t, ds)) { total++; if (isDoneOn(t, ds)) done++; }
    }
  }

  // 每日完成数(近 140 天,热力图可直接使用)
  const perDay = {};
  const from = addDays(today, -139);
  const bump = ds => { if (ds >= from && ds <= today) perDay[ds] = (perDay[ds] || 0) + 1; };
  for (const t of tasks) {
    if (t.repeat) for (const ds of Object.keys(t.doneDates || {})) bump(ds);
    else if (t.done) bump(t.doneAt ? fmt(new Date(t.doneAt)) : t.date);
  }

  // 连击(与前端同语义:连续全勤日,空日不打断)
  let streak = 0, ds = today;
  for (let guard = 0; guard < 366; guard++) {
    const occ = tasks.filter(t => occursOn(t, ds));
    if (!occ.length) {
      if (guard >= 60) break;
      ds = addDays(ds, -1);
      continue;
    }
    const all = occ.every(t => isDoneOn(t, ds));
    if (all) streak++;
    else if (ds !== today) break;
    ds = addDays(ds, -1);
  }

  res.json({
    today,
    tasks: tasks.length,
    pendingToday: tasks.filter(t => occursOn(t, today) && !isDoneOn(t, today)).length,
    rate30: total ? +(done / total).toFixed(4) : null,
    done30: done,
    total30: total,
    streak,
    perDay,
  });
});

/* --- 静态托管前端(上级目录),API 之外的路径都交给它 --- */
app.use(express.static(path.join(__dirname, '..')));

/* --- 启动 --- */
loadDB();
purgeTombstones();
app.listen(PORT, () => {
  console.log(`Aurex 计划台后端已启动:http://localhost:${PORT}`);
  console.log(`  · 前端同址托管,直接打开上面的链接即可`);
  console.log(`  · 数据文件:${DB_FILE}`);
});

process.on('SIGINT', () => { saveNow(); process.exit(0); });
process.on('SIGTERM', () => { saveNow(); process.exit(0); });
