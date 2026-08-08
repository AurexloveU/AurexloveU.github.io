/* =========================================================
   Aurex Chat — 演示后端
   Express(静态托管 + REST) + ws(实时)
   功能:多房间 / 私聊房间 / 消息持久化(JSON 文件)
        presence / 输入状态 / 已读回执 / Aevi bot 端点
   运行:cd server && npm install && npm start
   前端在设置面板填 ws://localhost:8790 即可连接。
   协议见 ../js/net.js 顶部注释,两端保持一致。
   ========================================================= */
'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const aevi = require('./aevi-bot');

const PORT = process.env.PORT || 8790;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const MAX_PER_ROOM = 500;

/* ================= 持久化 ================= */
let db = { rooms: {}, messages: {} };

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (raw && raw.rooms && raw.messages) db = raw;
    }
  } catch (e) { console.error('[db] 读取失败,使用空库:', e.message); }
  ensureRoom('lobby', '大厅', 'group');
}

let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(db));
    } catch (e) { console.error('[db] 写入失败:', e.message); }
  }, 300);
}

function ensureRoom(id, name, type) {
  if (!db.rooms[id]) {
    db.rooms[id] = { id, name: name || id, type: type || 'group', createdAt: Date.now() };
    saveDb();
  }
  if (!db.messages[id]) db.messages[id] = [];
  return db.rooms[id];
}

let idSeq = 0;
const nextId = () => 's' + Date.now().toString(36) + (idSeq++).toString(36);

function storeMsg(room, msg) {
  ensureRoom(room);
  const arr = db.messages[room];
  arr.push(msg);
  if (arr.length > MAX_PER_ROOM) arr.splice(0, arr.length - MAX_PER_ROOM);
  saveDb();
  return msg;
}

/* 私聊房间 id:双方 id 排序拼接,任何一方都能算出同一房间 */
function dmRoomId(a, b) { return 'dm:' + [a, b].sort().join(':'); }

/* Aevi 私有房间:每个用户一间,互不可见 */
function aeviRoomOf(userId) { return 'aevi:' + userId; }

/* ================= HTTP ================= */
const app = express();
app.use(express.json({ limit: '8mb' }));

/* 静态托管前端(tg-chat 根目录) */
app.use(express.static(path.join(__dirname, '..')));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'aurex-chat-server' }));

app.get('/api/rooms', (req, res) => {
  res.json(Object.values(db.rooms).filter(r => !r.id.startsWith('aevi:') && !r.id.startsWith('dm:')));
});

app.get('/api/rooms/:id/messages', (req, res) => {
  const room = req.params.id;
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, MAX_PER_ROOM);
  const arr = db.messages[room] || [];
  res.json(arr.slice(-limit));
});

app.post('/api/rooms/:id/messages', (req, res) => {
  const room = req.params.id;
  const b = req.body || {};
  if (!b.text && !b.sticker && !b.photo) return res.status(400).json({ error: 'empty message' });
  const msg = sanitizeMsg(b, b.from || 'api', b.fromName || 'API');
  storeMsg(room, msg);
  broadcastRoom(room, { type: 'msg', room, msg }, null);
  res.json(msg);
});

/* ---- Aevi bot REST 端点(接真实 AI 时可整段替换为反代) ---- */
app.post('/api/bot/aevi', async (req, res) => {
  const b = req.body || {};
  try {
    let r = await aevi.respond(b.text, { userName: b.userName, history: b.history });
    if (typeof r === 'string') r = { text: r };
    res.json({ reply: r });
  } catch (e) {
    res.status(500).json({ error: 'bot error' });
  }
});

/* ================= WebSocket ================= */
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

/* ws -> {id, name, avatar, rooms:Set} */
const clients = new Map();

function wsSend(ws, obj) {
  if (ws.readyState === 1) { try { ws.send(JSON.stringify(obj)); } catch (e) {} }
}

/* 发给房间内除 except 外的所有已加入成员 */
function broadcastRoom(room, obj, except) {
  for (const [ws, c] of clients) {
    if (ws !== except && c.rooms.has(room)) wsSend(ws, obj);
  }
}

function broadcastAll(obj, except) {
  for (const ws of clients.keys()) if (ws !== except) wsSend(ws, obj);
}

function presencePayload() {
  const users = [...clients.values()].map(c => ({ id: c.id, name: c.name }));
  return { type: 'presence', count: users.length, users };
}

function sanitizeMsg(b, from, fromName, avatar) {
  const msg = { id: nextId(), ts: Date.now(), from, fromName };
  if (avatar) msg.avatar = avatar;
  if (typeof b.text === 'string' && b.text) msg.text = String(b.text).slice(0, 4000);
  if (typeof b.sticker === 'string' && b.sticker) msg.sticker = String(b.sticker).slice(0, 8);
  if (typeof b.photo === 'string' && /^data:image\//.test(b.photo) && b.photo.length < 4e6) {
    msg.photo = b.photo;
    if (Number.isFinite(+b.pw)) msg.pw = +b.pw;
    if (Number.isFinite(+b.ph)) msg.ph = +b.ph;
  }
  if (typeof b.fwdFrom === 'string' && b.fwdFrom) msg.fwdFrom = String(b.fwdFrom).slice(0, 60);
  if (typeof b.replyTo === 'string') msg.replyTo = b.replyTo;
  return msg;
}

/* 客户端说的房间名 → 实际存储房间(aevi 映射为私有间) */
function realRoom(c, room) {
  if (room === 'aevi') return aeviRoomOf(c.id);
  return String(room || 'lobby').slice(0, 80);
}

wss.on('connection', ws => {
  ws.on('message', async raw => {
    let d;
    try { d = JSON.parse(raw); } catch (e) { return; }
    if (!d || typeof d.type !== 'string') return;

    /* ---- 注册 ---- */
    if (d.type === 'hello') {
      const u = d.user || {};
      clients.set(ws, {
        id: String(u.id || 'anon' + Math.random().toString(36).slice(2, 8)).slice(0, 40),
        name: String(u.name || '访客').slice(0, 40),
        avatar: u.avatar || { e: '👤', c: 7 },
        rooms: new Set()
      });
      wsSend(ws, {
        type: 'welcome',
        rooms: Object.values(db.rooms).filter(r => !r.id.startsWith('aevi:') && !r.id.startsWith('dm:')),
        users: [...clients.values()].map(c => ({ id: c.id, name: c.name }))
      });
      broadcastAll(presencePayload());
      return;
    }

    const c = clients.get(ws);
    if (!c) return;                      // 未 hello 先到的帧一律忽略

    /* ---- 加入房间(含私聊房间与 aevi 私有间) ---- */
    if (d.type === 'join') {
      const room = realRoom(c, d.room);
      ensureRoom(room, d.room === 'aevi' ? 'Aevi' : d.room);
      c.rooms.add(room);
      if (d.room === 'aevi') c.rooms.add('aevi');   // 客户端语义名也记一份
      wsSend(ws, {
        type: 'history',
        room: d.room,
        msgs: (db.messages[room] || []).slice(-100)
      });
      return;
    }

    /* ---- 私聊:请求与某用户开房间 ---- */
    if (d.type === 'dm') {
      const room = dmRoomId(c.id, String(d.with || ''));
      ensureRoom(room, 'DM', 'dm');
      c.rooms.add(room);
      wsSend(ws, { type: 'history', room, msgs: (db.messages[room] || []).slice(-100) });
      return;
    }

    /* ---- 消息 ---- */
    if (d.type === 'msg') {
      const clientRoom = String(d.room || 'lobby');
      const room = realRoom(c, clientRoom);
      if (!c.rooms.has(room) && !c.rooms.has(clientRoom)) return;
      const msg = sanitizeMsg(d, c.id, c.name, c.avatar);
      if (!msg.text && !msg.sticker && !msg.photo) return;
      storeMsg(room, msg);
      wsSend(ws, { type: 'ack', room: clientRoom, tempId: d.tempId, id: msg.id, ts: msg.ts });

      if (clientRoom === 'aevi') {
        /* Aevi 私有间:只回给本人 */
        await aeviReply(ws, c, room, msg);
      } else {
        broadcastRoom(room, { type: 'msg', room: clientRoom, msg }, ws);
      }
      return;
    }

    /* ---- 输入状态 ---- */
    if (d.type === 'typing') {
      const clientRoom = String(d.room || 'lobby');
      const room = realRoom(c, clientRoom);
      broadcastRoom(room, { type: 'typing', room: clientRoom, from: c.id, fromName: c.name, on: !!d.on }, ws);
      return;
    }

    /* ---- 已读回执 ---- */
    if (d.type === 'read') {
      const clientRoom = String(d.room || 'lobby');
      const room = realRoom(c, clientRoom);
      broadcastRoom(room, { type: 'read', room: clientRoom, from: c.id }, ws);
      return;
    }
  });

  ws.on('close', () => {
    if (clients.delete(ws)) broadcastAll(presencePayload());
  });
});

/* Aevi 回复:typing → 延迟 → 消息(只发给提问的连接) */
async function aeviReply(ws, c, room, userMsg) {
  wsSend(ws, { type: 'typing', room: 'aevi', from: 'aevi', fromName: 'Aevi', on: true });
  const delay = 500 + Math.min((userMsg.text || '').length * 25, 1500);
  setTimeout(async () => {
    let r;
    try {
      const history = (db.messages[room] || []).slice(-8).map(m => ({ from: m.from, text: m.text || '' }));
      r = await aevi.respond(userMsg.text || (userMsg.sticker ? '贴纸 ' + userMsg.sticker : '图片'),
        { userName: c.name, history });
    } catch (e) { r = '(小小地宕机了一下,再说一遍?)'; }
    if (typeof r === 'string') r = { text: r };
    const reply = { id: nextId(), ts: Date.now(), from: 'aevi', fromName: aevi.name };
    if (r.text) reply.text = r.text;
    if (r.sticker) reply.sticker = r.sticker;
    storeMsg(room, reply);
    wsSend(ws, { type: 'typing', room: 'aevi', from: 'aevi', fromName: 'Aevi', on: false });
    wsSend(ws, { type: 'msg', room: 'aevi', msg: reply });
  }, delay);
}

/* ================= 启动 ================= */
loadDb();
server.listen(PORT, () => {
  console.log(`Aurex Chat server 已启动:`);
  console.log(`  前端     http://localhost:${PORT}/`);
  console.log(`  WebSocket ws://localhost:${PORT}`);
  console.log(`  Bot 端点  POST http://localhost:${PORT}/api/bot/aevi`);
});
