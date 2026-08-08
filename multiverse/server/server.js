/**
 * multiverse/server/server.js
 * 后端:数据服务 + 保存宇宙 + 画廊 + 种子重放 API。
 *
 * 与前端共用同一份纯函数引擎(../engine/*.js),因此
 * 「前端抽到的宇宙」与「后端按重放码重算的宇宙」逐项一致 —— 服务端可信重放。
 *
 * 运行(按需,本仓库不自动安装/启动):
 *   cd multiverse/server && npm install && npm start
 *   默认 http://localhost:8787 ,同时把 ../(multiverse 目录)作为静态站点托管。
 *
 * 存储:server/storage/universes.json(文件即数据库,零依赖)。
 * 数据:优先读 ../data/*.json;缺失时与前端一样回落到内置样例。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

import { drawUniverse, normalizeData, normalizeList, parseReplay, encodeReplay } from '../engine/engine.js';
import { composeStory } from '../engine/story.js';
import { FALLBACK_DATA, DATA_FILES } from '../engine/fallback-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');            // multiverse/
const DATA_DIR = path.join(ROOT, 'data');              // 只读!数据端地盘
const STORAGE_DIR = path.join(__dirname, 'storage');
const DB_FILE = path.join(STORAGE_DIR, 'universes.json');

const PORT = process.env.PORT || 8787;

/* ------------------------------------------------------------------ */
/* 数据装载(与前端 data-loader 同样的逐文件降级语义)                  */
/* ------------------------------------------------------------------ */

async function loadDataFromDisk() {
  const raw = {};
  const sources = {};
  await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, file]) => {
      try {
        const text = await fs.readFile(path.join(DATA_DIR, file), 'utf8');
        const json = JSON.parse(text);
        if (!normalizeList(json, key).length) throw new Error('empty');
        raw[key] = json;
        sources[key] = 'file';
      } catch {
        raw[key] = FALLBACK_DATA[key];
        sources[key] = 'fallback';
      }
    }),
  );
  return { data: normalizeData(raw), sources };
}

/* ------------------------------------------------------------------ */
/* 存储(文件即数据库)                                                */
/* ------------------------------------------------------------------ */

async function readDb() {
  try {
    const arr = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeDb(list) {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(list, null, 2), 'utf8');
}

/* ------------------------------------------------------------------ */
/* 重放:code -> 完整宇宙(服务端权威计算)                             */
/* ------------------------------------------------------------------ */

async function replayCode(code, names) {
  const parsed = parseReplay(String(code || ''));
  if (!parsed) return null;
  const { data, sources } = await loadDataFromDisk();
  const result = drawUniverse({
    data,
    seed: parsed.seed,
    attempts: parsed.attempts,
    elementCountSpec: parsed.elementCountSpec,
    elementCount: parsed.elementCountSpec,
    names,
  });
  const story = composeStory(result);
  return { code: encodeReplay(parsed), result, story, dataSources: sources };
}

/* ------------------------------------------------------------------ */
/* 应用                                                                */
/* ------------------------------------------------------------------ */

const app = express();
app.use(express.json({ limit: '256kb' }));

/* 数据服务 ---------------------------------------------------------- */

// 五份数据打包(带来源标记),前端可用它替代逐文件 fetch
app.get('/api/data', async (_req, res) => {
  const { data, sources } = await loadDataFromDisk();
  res.json({ data, sources });
});

// 单份数据:/api/data/timeline 等
app.get('/api/data/:name', async (req, res) => {
  const key = req.params.name;
  if (!DATA_FILES[key]) {
    return res.status(404).json({ error: `未知数据集:${key}` });
  }
  const { data, sources } = await loadDataFromDisk();
  res.json({ items: data[key], source: sources[key] });
});

/* 种子重放 ---------------------------------------------------------- */

// GET /api/replay/:code —— 按重放码重算整个宇宙(含情境卡文案)
app.get('/api/replay/:code', async (req, res) => {
  const names = {
    a: String(req.query.a || 'Aurex').slice(0, 24),
    b: String(req.query.b || 'Aevi').slice(0, 24),
  };
  const out = await replayCode(req.params.code, names);
  if (!out) return res.status(400).json({ error: '无法解析的重放码' });
  res.json(out);
});

/* 画廊(保存宇宙) --------------------------------------------------- */

// POST /api/universes  { code, note? } —— 服务端按码重算并存档
app.post('/api/universes', async (req, res) => {
  const { code, note } = req.body || {};
  const out = await replayCode(code);
  if (!out) return res.status(400).json({ error: '缺少或无法解析的重放码 code' });

  const list = await readDb();
  const existed = list.find((r) => r.code === out.code);
  if (existed) return res.status(200).json({ record: existed, existed: true });

  const record = {
    id: 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    code: out.code,
    savedAt: new Date().toISOString(),
    note: typeof note === 'string' ? note.slice(0, 500) : '',
    title: out.story.title,
    subtitle: out.story.subtitle,
    elementNames: out.result.steps.elements.items.map((r) => r.item.name),
  };
  list.push(record);
  await writeDb(list);
  res.status(201).json({ record, existed: false });
});

// GET /api/universes —— 画廊列表(最新在前;只存码与快照,重放才是事实之源)
app.get('/api/universes', async (_req, res) => {
  const list = await readDb();
  list.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
  res.json({ universes: list });
});

// GET /api/universes/:id —— 单条存档 + 实时重放的完整宇宙
app.get('/api/universes/:id', async (req, res) => {
  const list = await readDb();
  const rec = list.find((r) => r.id === req.params.id);
  if (!rec) return res.status(404).json({ error: '没有这条存档' });
  const replay = await replayCode(rec.code);
  res.json({ record: rec, replay });
});

// DELETE /api/universes/:id
app.delete('/api/universes/:id', async (req, res) => {
  const list = await readDb();
  const next = list.filter((r) => r.id !== req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: '没有这条存档' });
  await writeDb(next);
  res.json({ ok: true });
});

/* 其他 -------------------------------------------------------------- */

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'multiverse-server', now: new Date().toISOString() });
});

// 同时托管前端静态站(multiverse/ 整目录),开箱即用
app.use(express.static(ROOT));

app.listen(PORT, () => {
  console.log(`multiverse-server listening on http://localhost:${PORT}`);
  console.log(`静态站点: http://localhost:${PORT}/index.html`);
});
