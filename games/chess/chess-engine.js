/* ============================================================
   奕苑 · 国际象棋引擎
   - 完整规则:王车易位 / 吃过路兵 / 兵升变 / 将军·将死·逼和
     / 五十步 / 子力不足(三次重复由界面层按局面键计数)
   - AI:negamax + α-β 剪枝 + 静态搜索(吃子延伸),四档难度
   - 浏览器挂 window.ChessEngine;Node 下 module.exports(便于测试)
   棋盘表示:长度 64 数组,下标 0 = a8 … 63 = h1。
   白子 "PNBRQK",黑子 "pnbrqk",空格 null。
   ============================================================ */
(function () {
  "use strict";

  var WHITE = "w", BLACK = "b";

  var KN = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  var KG = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  var ORTH = [[-1,0],[1,0],[0,-1],[0,1]];
  var DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];

  var START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  function isWhitePiece(p) { return p >= "A" && p <= "Z"; }
  function up(p) { return p.toUpperCase(); }
  function fileOf(i) { return i & 7; }
  function rankOf(i) { return i >> 3; }
  function alg(i) { return "abcdefgh"[i & 7] + (8 - (i >> 3)); }
  function idx(algStr) {
    return ("abcdefgh".indexOf(algStr[0])) + (8 - parseInt(algStr[1], 10)) * 8;
  }

  /* ---------------- FEN ---------------- */
  function parseFEN(fen) {
    var parts = fen.trim().split(/\s+/);
    var board = new Array(64).fill(null);
    var i = 0;
    for (var c = 0; c < parts[0].length; c++) {
      var ch = parts[0][c];
      if (ch === "/") continue;
      if (ch >= "1" && ch <= "8") i += parseInt(ch, 10);
      else board[i++] = ch;
    }
    var castling = { K: false, Q: false, k: false, q: false };
    if (parts[2] && parts[2] !== "-") {
      for (var j = 0; j < parts[2].length; j++) castling[parts[2][j]] = true;
    }
    return {
      board: board,
      turn: parts[1] === "b" ? BLACK : WHITE,
      castling: castling,
      ep: (parts[3] && parts[3] !== "-") ? idx(parts[3]) : -1,
      halfmove: parts[4] ? parseInt(parts[4], 10) : 0,
      fullmove: parts[5] ? parseInt(parts[5], 10) : 1
    };
  }

  function toFEN(s) {
    var rows = [];
    for (var r = 0; r < 8; r++) {
      var row = "", empty = 0;
      for (var f = 0; f < 8; f++) {
        var p = s.board[r * 8 + f];
        if (!p) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        row += p;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    var cast = (s.castling.K ? "K" : "") + (s.castling.Q ? "Q" : "") +
               (s.castling.k ? "k" : "") + (s.castling.q ? "q" : "");
    return rows.join("/") + " " + s.turn + " " + (cast || "-") + " " +
           (s.ep >= 0 ? alg(s.ep) : "-") + " " + s.halfmove + " " + s.fullmove;
  }

  /** 用于三次重复判定的局面键(不含步数计数) */
  function positionKey(s) {
    return toFEN(s).split(" ").slice(0, 4).join(" ");
  }

  function initialState() { return parseFEN(START_FEN); }

  function cloneState(s) {
    return {
      board: s.board.slice(),
      turn: s.turn,
      castling: { K: s.castling.K, Q: s.castling.Q, k: s.castling.k, q: s.castling.q },
      ep: s.ep, halfmove: s.halfmove, fullmove: s.fullmove
    };
  }

  /* ---------------- 攻击判定 ---------------- */
  function attacked(s, sq, by) {
    var r = rankOf(sq), f = fileOf(sq), j, q, k, d;
    // 兵
    var pr = by === WHITE ? r + 1 : r - 1;
    if (pr >= 0 && pr <= 7) {
      var pp = by === WHITE ? "P" : "p";
      if (f - 1 >= 0 && s.board[pr * 8 + f - 1] === pp) return true;
      if (f + 1 <= 7 && s.board[pr * 8 + f + 1] === pp) return true;
    }
    // 马
    var kn = by === WHITE ? "N" : "n";
    for (k = 0; k < 8; k++) {
      var nr = r + KN[k][0], nf = f + KN[k][1];
      if (nr < 0 || nr > 7 || nf < 0 || nf > 7) continue;
      if (s.board[nr * 8 + nf] === kn) return true;
    }
    // 王
    var kg = by === WHITE ? "K" : "k";
    for (k = 0; k < 8; k++) {
      var kr = r + KG[k][0], kf = f + KG[k][1];
      if (kr < 0 || kr > 7 || kf < 0 || kf > 7) continue;
      if (s.board[kr * 8 + kf] === kg) return true;
    }
    // 直线(车/后)
    var rq = by === WHITE ? "RQ" : "rq";
    for (d = 0; d < 4; d++) {
      var dr = ORTH[d][0], df = ORTH[d][1], cr = r + dr, cf = f + df;
      while (cr >= 0 && cr <= 7 && cf >= 0 && cf <= 7) {
        q = s.board[cr * 8 + cf];
        if (q) { if (rq.indexOf(q) >= 0) return true; break; }
        cr += dr; cf += df;
      }
    }
    // 斜线(象/后)
    var bq = by === WHITE ? "BQ" : "bq";
    for (d = 0; d < 4; d++) {
      var dr2 = DIAG[d][0], df2 = DIAG[d][1], cr2 = r + dr2, cf2 = f + df2;
      while (cr2 >= 0 && cr2 <= 7 && cf2 >= 0 && cf2 <= 7) {
        q = s.board[cr2 * 8 + cf2];
        if (q) { if (bq.indexOf(q) >= 0) return true; break; }
        cr2 += dr2; cf2 += df2;
      }
    }
    return false;
  }

  function kingSq(s, color) {
    var target = color === WHITE ? "K" : "k";
    for (var i = 0; i < 64; i++) if (s.board[i] === target) return i;
    return -1;
  }

  function inCheck(s, color) {
    var ks = kingSq(s, color);
    return ks >= 0 && attacked(s, ks, color === WHITE ? BLACK : WHITE);
  }

  /* ---------------- 走法生成 ---------------- */
  function pushPawn(ms, from, to, capture) {
    var toRank = rankOf(to);
    if (toRank === 0 || toRank === 7) {
      ms.push({ from: from, to: to, promo: "Q" });
      ms.push({ from: from, to: to, promo: "R" });
      ms.push({ from: from, to: to, promo: "B" });
      ms.push({ from: from, to: to, promo: "N" });
    } else {
      ms.push({ from: from, to: to });
    }
  }

  function genPseudo(s) {
    var ms = [], me = s.turn, meWhite = me === WHITE;
    for (var i = 0; i < 64; i++) {
      var p = s.board[i];
      if (!p || isWhitePiece(p) !== meWhite) continue;
      var t = up(p), r = rankOf(i), f = fileOf(i), k, j, q;

      if (t === "P") {
        var dir = meWhite ? -1 : 1;
        var one = i + dir * 8;
        if (one >= 0 && one < 64 && !s.board[one]) {
          pushPawn(ms, i, one);
          var startRank = meWhite ? 6 : 1;
          if (r === startRank) {
            var two = i + dir * 16;
            if (!s.board[two]) ms.push({ from: i, to: two, flags: "d" });
          }
        }
        for (var dd = -1; dd <= 1; dd += 2) {
          var nf = f + dd;
          if (nf < 0 || nf > 7) continue;
          var tsq = (r + dir) * 8 + nf;
          if (tsq < 0 || tsq >= 64) continue;
          q = s.board[tsq];
          if (q && isWhitePiece(q) !== meWhite) pushPawn(ms, i, tsq, true);
          else if (!q && tsq === s.ep) ms.push({ from: i, to: tsq, flags: "e" });
        }
      } else if (t === "N" || t === "K") {
        var offs = t === "N" ? KN : KG;
        for (k = 0; k < 8; k++) {
          var nr = r + offs[k][0], nf2 = f + offs[k][1];
          if (nr < 0 || nr > 7 || nf2 < 0 || nf2 > 7) continue;
          j = nr * 8 + nf2; q = s.board[j];
          if (!q || isWhitePiece(q) !== meWhite) ms.push({ from: i, to: j });
        }
        if (t === "K") genCastling(s, ms, meWhite);
      } else {
        var dirs = t === "B" ? DIAG : (t === "R" ? ORTH : ORTH.concat(DIAG));
        for (k = 0; k < dirs.length; k++) {
          var dr = dirs[k][0], df = dirs[k][1], cr = r + dr, cf = f + df;
          while (cr >= 0 && cr <= 7 && cf >= 0 && cf <= 7) {
            j = cr * 8 + cf; q = s.board[j];
            if (!q) ms.push({ from: i, to: j });
            else { if (isWhitePiece(q) !== meWhite) ms.push({ from: i, to: j }); break; }
            cr += dr; cf += df;
          }
        }
      }
    }
    return ms;
  }

  function genCastling(s, ms, meWhite) {
    var opp = meWhite ? BLACK : WHITE;
    if (meWhite) {
      if (s.castling.K && !s.board[61] && !s.board[62] &&
          s.board[63] === "R" && s.board[60] === "K" &&
          !attacked(s, 60, opp) && !attacked(s, 61, opp) && !attacked(s, 62, opp))
        ms.push({ from: 60, to: 62, flags: "k" });
      if (s.castling.Q && !s.board[57] && !s.board[58] && !s.board[59] &&
          s.board[56] === "R" && s.board[60] === "K" &&
          !attacked(s, 60, opp) && !attacked(s, 59, opp) && !attacked(s, 58, opp))
        ms.push({ from: 60, to: 58, flags: "q" });
    } else {
      if (s.castling.k && !s.board[5] && !s.board[6] &&
          s.board[7] === "r" && s.board[4] === "k" &&
          !attacked(s, 4, opp) && !attacked(s, 5, opp) && !attacked(s, 6, opp))
        ms.push({ from: 4, to: 6, flags: "k" });
      if (s.castling.q && !s.board[1] && !s.board[2] && !s.board[3] &&
          s.board[0] === "r" && s.board[4] === "k" &&
          !attacked(s, 4, opp) && !attacked(s, 3, opp) && !attacked(s, 2, opp))
        ms.push({ from: 4, to: 2, flags: "q" });
    }
  }

  /* ---------------- 走子 / 撤销 ---------------- */
  function makeMove(s, m) {
    var undo = {
      ep: s.ep,
      castling: { K: s.castling.K, Q: s.castling.Q, k: s.castling.k, q: s.castling.q },
      halfmove: s.halfmove,
      captured: null, capturedSq: -1
    };
    var meWhite = s.turn === WHITE;
    var piece = s.board[m.from];
    s.ep = -1;
    s.halfmove++;
    if (up(piece) === "P") s.halfmove = 0;

    if (m.flags === "e") {
      var capSq = m.to + (meWhite ? 8 : -8);
      undo.captured = s.board[capSq]; undo.capturedSq = capSq;
      s.board[capSq] = null; s.halfmove = 0;
    } else if (s.board[m.to]) {
      undo.captured = s.board[m.to]; undo.capturedSq = m.to;
      s.halfmove = 0;
    }

    s.board[m.to] = m.promo ? (meWhite ? m.promo : m.promo.toLowerCase()) : piece;
    s.board[m.from] = null;

    if (m.flags === "d") s.ep = m.from + (meWhite ? -8 : 8);
    if (m.flags === "k") {
      var rk = meWhite ? 63 : 7, rt = meWhite ? 61 : 5;
      s.board[rt] = s.board[rk]; s.board[rk] = null;
    }
    if (m.flags === "q") {
      var rq = meWhite ? 56 : 0, rqt = meWhite ? 59 : 3;
      s.board[rqt] = s.board[rq]; s.board[rq] = null;
    }

    if (piece === "K") { s.castling.K = false; s.castling.Q = false; }
    if (piece === "k") { s.castling.k = false; s.castling.q = false; }
    if (m.from === 63 || m.to === 63) s.castling.K = false;
    if (m.from === 56 || m.to === 56) s.castling.Q = false;
    if (m.from === 7  || m.to === 7)  s.castling.k = false;
    if (m.from === 0  || m.to === 0)  s.castling.q = false;

    if (s.turn === BLACK) s.fullmove++;
    s.turn = meWhite ? BLACK : WHITE;
    return undo;
  }

  function unmakeMove(s, m, undo) {
    s.turn = s.turn === WHITE ? BLACK : WHITE;
    var meWhite = s.turn === WHITE;
    if (s.turn === BLACK) s.fullmove--;
    s.board[m.from] = m.promo ? (meWhite ? "P" : "p") : s.board[m.to];
    s.board[m.to] = null;
    if (undo.captured) s.board[undo.capturedSq] = undo.captured;
    if (m.flags === "k") {
      var rk = meWhite ? 63 : 7, rt = meWhite ? 61 : 5;
      s.board[rk] = s.board[rt]; s.board[rt] = null;
    }
    if (m.flags === "q") {
      var rq = meWhite ? 56 : 0, rqt = meWhite ? 59 : 3;
      s.board[rq] = s.board[rqt]; s.board[rqt] = null;
    }
    s.ep = undo.ep; s.castling = undo.castling; s.halfmove = undo.halfmove;
  }

  function genLegal(s) {
    var pseudo = genPseudo(s), legal = [], me = s.turn;
    for (var i = 0; i < pseudo.length; i++) {
      var undo = makeMove(s, pseudo[i]);
      if (!inCheck(s, me)) legal.push(pseudo[i]);
      unmakeMove(s, pseudo[i], undo);
    }
    return legal;
  }

  /* ---------------- 对局状态 ---------------- */
  function insufficientMaterial(s) {
    var minorsW = 0, minorsB = 0, bishopsColor = [];
    for (var i = 0; i < 64; i++) {
      var p = s.board[i];
      if (!p) continue;
      var t = up(p);
      if (t === "K") continue;
      if (t === "P" || t === "R" || t === "Q") return false;
      if (isWhitePiece(p)) minorsW++; else minorsB++;
      if (t === "B") bishopsColor.push(((i >> 3) + (i & 7)) & 1);
    }
    var total = minorsW + minorsB;
    if (total === 0) return true;                      // 王对王
    if (total === 1) return true;                      // 王对王+单轻子
    if (minorsW === 1 && minorsB === 1 && bishopsColor.length === 2 &&
        bishopsColor[0] === bishopsColor[1]) return true; // 同色象
    return false;
  }

  /**
   * 返回 { over, result, reason }
   * result: "1-0" | "0-1" | "1/2-1/2" | null
   * repCount:当前局面键出现次数(由界面层维护),可省略。
   */
  function gameStatus(s, repCount) {
    var legal = genLegal(s);
    if (legal.length === 0) {
      if (inCheck(s, s.turn)) {
        return { over: true, result: s.turn === WHITE ? "0-1" : "1-0", reason: "checkmate" };
      }
      return { over: true, result: "1/2-1/2", reason: "stalemate" };
    }
    if (s.halfmove >= 100) return { over: true, result: "1/2-1/2", reason: "fifty" };
    if (repCount >= 3) return { over: true, result: "1/2-1/2", reason: "threefold" };
    if (insufficientMaterial(s)) return { over: true, result: "1/2-1/2", reason: "material" };
    return { over: false, result: null, reason: null };
  }

  /* ---------------- SAN 记谱 ---------------- */
  function san(s, m) {
    var str;
    if (m.flags === "k") str = "O-O";
    else if (m.flags === "q") str = "O-O-O";
    else {
      var piece = s.board[m.from], t = up(piece);
      var isCap = !!s.board[m.to] || m.flags === "e";
      if (t === "P") {
        str = isCap ? ("abcdefgh"[m.from & 7] + "x" + alg(m.to)) : alg(m.to);
        if (m.promo) str += "=" + m.promo;
      } else {
        var legal = genLegal(s), d = "";
        var others = legal.filter(function (x) {
          return x.from !== m.from && x.to === m.to && up(s.board[x.from]) === t;
        });
        if (others.length) {
          var shareFile = others.some(function (x) { return (x.from & 7) === (m.from & 7); });
          var shareRank = others.some(function (x) { return (x.from >> 3) === (m.from >> 3); });
          if (!shareFile) d = "abcdefgh"[m.from & 7];
          else if (!shareRank) d = String(8 - (m.from >> 3));
          else d = alg(m.from);
        }
        str = t + d + (isCap ? "x" : "") + alg(m.to);
      }
    }
    var undo = makeMove(s, m);
    var oppLegal = genLegal(s);
    if (inCheck(s, s.turn)) str += (oppLegal.length === 0 ? "#" : "+");
    unmakeMove(s, m, undo);
    return str;
  }

  /* ---------------- 评估 ---------------- */
  var VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };

  // 位置表:下标 0 = a8(黑方底线)。白方直接取 pst[i],黑方取 pst[i ^ 56]。
  var PST = {
    P: [
       0,  0,  0,  0,  0,  0,  0,  0,
      55, 55, 55, 55, 55, 55, 55, 55,
      18, 22, 30, 35, 35, 30, 22, 18,
       8, 10, 14, 26, 26, 14, 10,  8,
       4,  6,  8, 22, 22,  8,  6,  4,
       4,  2,  0,  6,  6,  0,  2,  4,
       4,  8,  8,-14,-14,  8,  8,  4,
       0,  0,  0,  0,  0,  0,  0,  0
    ],
    N: [
      -45,-35,-25,-25,-25,-25,-35,-45,
      -35,-15,  0,  0,  0,  0,-15,-35,
      -25,  0, 12, 16, 16, 12,  0,-25,
      -25,  4, 16, 20, 20, 16,  4,-25,
      -25,  0, 16, 20, 20, 16,  0,-25,
      -25,  4, 12, 16, 16, 12,  4,-25,
      -35,-15,  0,  4,  4,  0,-15,-35,
      -45,-35,-25,-25,-25,-25,-35,-45
    ],
    B: [
      -18,-10,-10,-10,-10,-10,-10,-18,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  6, 10, 10,  6,  0,-10,
      -10,  6,  6, 10, 10,  6,  6,-10,
      -10,  0, 10, 10, 10, 10,  0,-10,
      -10, 10, 10, 10, 10, 10, 10,-10,
      -10,  6,  0,  0,  0,  0,  6,-10,
      -18,-10,-10,-10,-10,-10,-10,-18
    ],
    R: [
       0,  0,  0,  0,  0,  0,  0,  0,
       6, 10, 10, 10, 10, 10, 10,  6,
      -4,  0,  0,  0,  0,  0,  0, -4,
      -4,  0,  0,  0,  0,  0,  0, -4,
      -4,  0,  0,  0,  0,  0,  0, -4,
      -4,  0,  0,  0,  0,  0,  0, -4,
      -4,  0,  0,  0,  0,  0,  0, -4,
       0,  0,  0,  4,  4,  0,  0,  0
    ],
    Q: [
      -10, -6, -6, -3, -3, -6, -6,-10,
       -6,  0,  0,  0,  0,  0,  0, -6,
       -6,  0,  3,  3,  3,  3,  0, -6,
       -3,  0,  3,  5,  5,  3,  0, -3,
        0,  0,  3,  5,  5,  3,  0, -3,
       -6,  3,  3,  3,  3,  3,  0, -6,
       -6,  0,  3,  0,  0,  0,  0, -6,
      -10, -6, -6, -3, -3, -6, -6,-10
    ],
    K: [
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20,
      -10,-20,-20,-20,-20,-20,-20,-10,
       14, 14, -4, -4, -4, -4, 14, 14,
       18, 24, 10, -4, -4, 10, 24, 18
    ]
  };

  function evaluate(s) {
    var score = 0;
    for (var i = 0; i < 64; i++) {
      var p = s.board[i];
      if (!p) continue;
      var t = up(p);
      if (isWhitePiece(p)) score += VAL[t] + PST[t][i];
      else score -= VAL[t] + PST[t][i ^ 56];
    }
    // 微量随机,避免机械重复
    return (s.turn === WHITE ? score : -score);
  }

  /* ---------------- 搜索 ---------------- */
  var nodes = 0;

  function moveScore(s, m) {
    var sc = 0;
    var victim = m.flags === "e" ? "P" : (s.board[m.to] ? up(s.board[m.to]) : null);
    if (victim) sc += 10 * VAL[victim] - VAL[up(s.board[m.from])];
    if (m.promo) sc += VAL[m.promo];
    return sc;
  }

  function orderMoves(s, ms) {
    var scored = ms.map(function (m) { return { m: m, sc: moveScore(s, m) }; });
    scored.sort(function (a, b) { return b.sc - a.sc; });
    return scored.map(function (x) { return x.m; });
  }

  function qsearch(s, alpha, beta, depth) {
    nodes++;
    var stand = evaluate(s);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (depth <= 0) return alpha;
    var ms = genLegal(s).filter(function (m) {
      return s.board[m.to] || m.flags === "e" || m.promo === "Q";
    });
    ms = orderMoves(s, ms);
    for (var i = 0; i < ms.length; i++) {
      var undo = makeMove(s, ms[i]);
      var sc = -qsearch(s, -beta, -alpha, depth - 1);
      unmakeMove(s, ms[i], undo);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function alphabeta(s, depth, alpha, beta, ply) {
    nodes++;
    if (depth === 0) return qsearch(s, alpha, beta, 6);
    var ms = genLegal(s);
    if (ms.length === 0) {
      if (inCheck(s, s.turn)) return -100000 + ply;   // 被将死,越早越差
      return 0;                                       // 逼和
    }
    if (s.halfmove >= 100) return 0;
    ms = orderMoves(s, ms);
    for (var i = 0; i < ms.length; i++) {
      var undo = makeMove(s, ms[i]);
      var sc = -alphabeta(s, depth - 1, -beta, -alpha, ply + 1);
      unmakeMove(s, ms[i], undo);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  /**
   * 难度 level:1 随手 / 2 入门 / 3 进阶 / 4 挑战
   * 返回 { move, score, nodes } 或 null(无合法着法)
   */
  function bestMove(state, level) {
    var s = cloneState(state);
    var depth = [0, 1, 2, 3, 4][level] || 2;
    var noise = [0, 60, 18, 0, 0][level] || 0;
    var ms = orderMoves(s, genLegal(s));
    if (ms.length === 0) return null;
    nodes = 0;
    var best = null, bestSc = -Infinity;
    for (var i = 0; i < ms.length; i++) {
      var undo = makeMove(s, ms[i]);
      var sc = -alphabeta(s, depth - 1, -Infinity, Infinity, 1);
      unmakeMove(s, ms[i], undo);
      if (noise) sc += (Math.random() * 2 - 1) * noise;
      if (sc > bestSc) { bestSc = sc; best = ms[i]; }
    }
    return { move: best, score: bestSc, nodes: nodes };
  }

  /* ---------------- perft(自测用) ---------------- */
  function perft(s, depth) {
    if (depth === 0) return 1;
    var ms = genLegal(s), total = 0;
    for (var i = 0; i < ms.length; i++) {
      var undo = makeMove(s, ms[i]);
      total += perft(s, depth - 1);
      unmakeMove(s, ms[i], undo);
    }
    return total;
  }

  var Engine = {
    WHITE: WHITE, BLACK: BLACK, START_FEN: START_FEN,
    parseFEN: parseFEN, toFEN: toFEN, positionKey: positionKey,
    initialState: initialState, cloneState: cloneState,
    genLegal: genLegal, makeMove: makeMove, unmakeMove: unmakeMove,
    attacked: attacked, inCheck: inCheck, kingSq: kingSq,
    gameStatus: gameStatus, san: san, evaluate: evaluate,
    bestMove: bestMove, perft: perft, alg: alg, idx: idx
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else window.ChessEngine = Engine;
})();
