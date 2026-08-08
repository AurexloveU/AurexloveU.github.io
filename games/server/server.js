/* ============================================================
   奕苑 · 联机后端
   - Express 静态托管上级目录(games/),即 http://localhost:8787/
   - WebSocket(同端口)房间制对战:chess / gomoku
   - 服务器端走子校验(国际象棋复用前端引擎;五子棋校验+判胜)
   - 对局持久化(server/data/games.json)与简单 ELO(players.json)
   运行:npm install && npm start
   ============================================================ */
"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const { WebSocketServer } = require("ws");

const ChessEngine = require(path.join(__dirname, "..", "chess", "chess-engine.js"));
const Gomoku = require(path.join(__dirname, "..", "gomoku", "gomoku-ai.js"));

const PORT = process.env.PORT || 8787;
const DATA_DIR = path.join(__dirname, "data");
const GAMES_FILE = path.join(DATA_DIR, "games.json");
const PLAYERS_FILE = path.join(DATA_DIR, "players.json");

/* ---------------- 持久化 ---------------- */
function loadJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return fallback; }
}
function saveJSON(file, obj) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}

let gamesDB = loadJSON(GAMES_FILE, []);       // [{id, game, players, result, reason, moves, started, ended}]
let playersDB = loadJSON(PLAYERS_FILE, {});   // { name: { elo, games, wins, draws } }

/* ---------------- ELO ---------------- */
const ELO_START = 1200, ELO_K = 32;

function getPlayer(name) {
  if (!playersDB[name]) playersDB[name] = { elo: ELO_START, games: 0, wins: 0, draws: 0 };
  return playersDB[name];
}

/**
 * scoreA:A 的得分(1 / 0.5 / 0)。返回 [{name, elo, delta}, ...]
 */
function applyElo(nameA, nameB, scoreA) {
  const a = getPlayer(nameA), b = getPlayer(nameB);
  const expA = 1 / (1 + Math.pow(10, (b.elo - a.elo) / 400));
  const dA = Math.round(ELO_K * (scoreA - expA));
  a.elo += dA; b.elo -= dA;
  a.games++; b.games++;
  if (scoreA === 1) a.wins++;
  else if (scoreA === 0) b.wins++;
  else { a.draws++; b.draws++; }
  saveJSON(PLAYERS_FILE, playersDB);
  return [
    { name: nameA, elo: a.elo, delta: dA },
    { name: nameB, elo: b.elo, delta: -dA }
  ];
}

/* ---------------- 房间 ---------------- */
const rooms = new Map();  // code -> room
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 去掉易混字符

function newCode() {
  for (let tries = 0; tries < 50; tries++) {
    let c = "";
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}

function sidesFor(game) {
  return game === "chess" ? ["w", "b"] : [1, 2];
}

function makeRoom(game) {
  const code = newCode();
  if (!code) return null;
  const room = {
    code, game,
    clients: [],           // [{ws, name, side}]
    moves: [],
    started: false, finished: false,
    startedAt: null,
    state: null,           // chess: 引擎状态 + keys;gomoku: {board, turn}
  };
  rooms.set(code, room);
  return room;
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}
function broadcast(room, obj) {
  room.clients.forEach((c) => send(c.ws, obj));
}
function other(room, ws) {
  return room.clients.find((c) => c.ws !== ws) || null;
}
function clientOf(room, ws) {
  return room.clients.find((c) => c.ws === ws) || null;
}

function startRoom(room) {
  room.started = true;
  room.startedAt = new Date().toISOString();
  if (room.game === "chess") {
    room.state = { s: ChessEngine.initialState(), keys: {} };
    bumpKey(room.state);
  } else {
    room.state = { board: Gomoku.emptyBoard(), turn: 1, count: 0 };
  }
  broadcast(room, {
    type: "start",
    players: room.clients.map((c) => ({
      name: c.name, side: c.side, elo: getPlayer(c.name).elo
    }))
  });
}

function bumpKey(st) {
  const k = ChessEngine.positionKey(st.s);
  st.keys[k] = (st.keys[k] || 0) + 1;
  return st.keys[k];
}

/* ---------------- 终局与归档 ---------------- */
function finishRoom(room, result, reason) {
  if (room.finished) return;
  room.finished = true;

  let eloInfo = null;
  if (room.clients.length === 2 && result) {
    const first = room.clients.find((c) => c.side === sidesFor(room.game)[0]);
    const second = room.clients.find((c) => c.side === sidesFor(room.game)[1]);
    if (first && second && first.name !== second.name) {
      const scoreA = result === "1-0" ? 1 : (result === "0-1" ? 0 : 0.5);
      eloInfo = applyElo(first.name, second.name, scoreA);
    }
  }

  gamesDB.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    game: room.game,
    players: room.clients.map((c) => ({ name: c.name, side: c.side })),
    result, reason: reason || "",
    moves: room.moves,
    started: room.startedAt,
    ended: new Date().toISOString()
  });
  saveJSON(GAMES_FILE, gamesDB);

  broadcast(room, { type: "result", result, reason: reason || "", elo: eloInfo });
}

/* ---------------- 走子校验 ---------------- */
function tryChessMove(room, side, data) {
  const st = room.state;
  if (st.s.turn !== side) return { ok: false, err: "还没轮到你" };
  const mv = ChessEngine.genLegal(st.s).find((m) =>
    m.from === data.from && m.to === data.to && (m.promo || null) === (data.promo || null)
  );
  if (!mv) return { ok: false, err: "非法着法" };
  const san = ChessEngine.san(st.s, mv);
  ChessEngine.makeMove(st.s, mv);
  const rep = bumpKey(st);
  room.moves.push({ from: mv.from, to: mv.to, promo: mv.promo || null, san });
  const status = ChessEngine.gameStatus(st.s, rep);
  return { ok: true, over: status.over, result: status.result, reason: status.reason };
}

function tryGomokuMove(room, side, data) {
  const st = room.state, N = Gomoku.N;
  if (st.turn !== side) return { ok: false, err: "还没轮到你" };
  const x = data.x | 0, y = data.y | 0;
  if (x < 0 || x >= N || y < 0 || y >= N) return { ok: false, err: "出界" };
  if (st.board[y * N + x] !== 0) return { ok: false, err: "已有子" };
  const win = Gomoku.isWinningMove(st.board, x, y, side, false);
  st.board[y * N + x] = side;
  st.count++;
  st.turn = 3 - side;
  room.moves.push({ x, y, side });
  if (win) return { ok: true, over: true, result: side === 1 ? "1-0" : "0-1", reason: "five" };
  if (st.count >= N * N) return { ok: true, over: true, result: "1/2-1/2", reason: "full" };
  return { ok: true, over: false };
}

/* ---------------- WebSocket ---------------- */
function onMessage(ws, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return; }

  if (msg.type === "create") {
    const game = msg.game === "gomoku" ? "gomoku" : "chess";
    const room = makeRoom(game);
    if (!room) { send(ws, { type: "error", message: "房间创建失败,请重试" }); return; }
    const side = sidesFor(game)[0];
    room.clients.push({ ws, name: sanitizeName(msg.name), side });
    ws._room = room.code;
    send(ws, { type: "created", room: room.code, side, players: room.clients.map((c) => c.name) });
    return;
  }

  if (msg.type === "join") {
    const room = rooms.get(String(msg.room || "").toUpperCase());
    if (!room) { send(ws, { type: "error", message: "找不到该房间" }); return; }
    if (room.finished) { send(ws, { type: "error", message: "该对局已结束" }); return; }
    if (room.clients.length >= 2) { send(ws, { type: "error", message: "房间已满" }); return; }
    const side = sidesFor(room.game)[1];
    room.clients.push({ ws, name: sanitizeName(msg.name), side });
    ws._room = room.code;
    send(ws, { type: "joined", room: room.code, side, players: room.clients.map((c) => c.name) });
    startRoom(room);
    return;
  }

  const room = rooms.get(ws._room);
  if (!room || !room.started || room.finished) return;
  const me = clientOf(room, ws);
  if (!me) return;

  if (msg.type === "move") {
    const r = room.game === "chess"
      ? tryChessMove(room, me.side, msg.data || {})
      : tryGomokuMove(room, me.side, msg.data || {});
    if (!r.ok) { send(ws, { type: "error", message: r.err }); return; }
    const peer = other(room, ws);
    if (peer) send(peer.ws, { type: "move", data: msg.data });
    if (r.over) finishRoom(room, r.result, r.reason);
    return;
  }

  if (msg.type === "resign") {
    const first = sidesFor(room.game)[0];
    const result = me.side === first ? "0-1" : "1-0";
    finishRoom(room, result, "resign");
    return;
  }

  if (msg.type === "result") {
    // 客户端申报的终局(如前端判出的三次重复等);仅在服务器尚未定局时采纳
    const okResults = ["1-0", "0-1", "1/2-1/2"];
    if (okResults.includes(msg.result)) finishRoom(room, msg.result, msg.reason || "client");
    return;
  }
}

function onClose(ws) {
  const room = rooms.get(ws._room);
  if (!room) return;
  const idx = room.clients.findIndex((c) => c.ws === ws);
  if (idx >= 0) {
    const leaver = room.clients[idx];
    room.clients.splice(idx, 1);
    if (room.started && !room.finished && room.clients.length === 1) {
      // 对局中离开:判负
      const first = sidesFor(room.game)[0];
      const result = leaver.side === first ? "0-1" : "1-0";
      room.clients.forEach((c) => send(c.ws, { type: "peer-leave" }));
      finishRoom(room, result, "peer-leave");
    } else {
      room.clients.forEach((c) => send(c.ws, { type: "peer-leave" }));
    }
  }
  if (room.clients.length === 0) rooms.delete(room.code);
}

function sanitizeName(n) {
  return String(n || "无名氏").trim().slice(0, 16) || "无名氏";
}

/* ---------------- HTTP ---------------- */
const app = express();
app.use(express.static(path.join(__dirname, "..")));   // 托管 games/,首页即合集

app.get("/api/leaderboard", (req, res) => {
  const rows = Object.entries(playersDB)
    .map(([name, p]) => ({ name, elo: p.elo, games: p.games, wins: p.wins, draws: p.draws }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 100);
  res.json(rows);
});

app.get("/api/games", (req, res) => {
  const rows = gamesDB.slice(-50).reverse().map((g) => ({
    id: g.id, game: g.game, players: g.players,
    result: g.result, reason: g.reason, ended: g.ended, moves: g.moves.length
  }));
  res.json(rows);
});

app.get("/api/games/:id", (req, res) => {
  const g = gamesDB.find((x) => x.id === req.params.id);
  if (!g) { res.status(404).json({ error: "not found" }); return; }
  res.json(g);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on("connection", (ws) => {
  ws.on("message", (raw) => onMessage(ws, raw));
  ws.on("close", () => onClose(ws));
  ws.on("error", () => { /* 连接层错误忽略 */ });
});

server.listen(PORT, () => {
  console.log("奕苑联机后端已启动:");
  console.log("  网页  http://localhost:" + PORT + "/");
  console.log("  排行  http://localhost:" + PORT + "/api/leaderboard");
  console.log("  WS    ws://localhost:" + PORT);
});
