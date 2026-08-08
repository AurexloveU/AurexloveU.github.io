/* ============================================================
   奕苑 · 五子棋引擎
   - 15×15;1 = 黑,2 = 白,0 = 空
   - 胜负判定(自由规则 / 连珠规则)
   - 黑方禁手(可选):长连 / 双四 / 双三(标准近似,不做递归禁手)
   - 启发式 AI:五元窗口打分 + 必胜/必挡 + 浅层对抗(三档难度)
   - 浏览器挂 window.Gomoku;Node 下 module.exports
   ============================================================ */
(function () {
  "use strict";

  var N = 15;
  var DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  function emptyBoard() {
    var b = new Array(N * N).fill(0);
    return b;
  }
  function at(bd, x, y) {
    if (x < 0 || x >= N || y < 0 || y >= N) return 3; // 边界
    return bd[y * N + x];
  }
  function put(bd, x, y, v) { bd[y * N + x] = v; }

  /** 某方向上从 (x,y) 出发(不含自身)的连续同色子数 */
  function runLen(bd, x, y, dx, dy, who) {
    var n = 0;
    var cx = x + dx, cy = y + dy;
    while (at(bd, cx, cy) === who) { n++; cx += dx; cy += dy; }
    return n;
  }

  /** 落子后此方向的总连长(含自身) */
  function lineLen(bd, x, y, dx, dy, who) {
    return 1 + runLen(bd, x, y, dx, dy, who) + runLen(bd, x, y, -dx, -dy, who);
  }

  /**
   * 落子 (x,y)(who)是否成胜。
   * renju=true 时黑棋须恰好五连(长连不算胜,而是禁手);白棋 ≥5 即胜。
   */
  function isWinningMove(bd, x, y, who, renju) {
    for (var d = 0; d < 4; d++) {
      var L = lineLen(bd, x, y, DIRS[d][0], DIRS[d][1], who);
      if (renju && who === 1) { if (L === 5) return true; }
      else if (L >= 5) return true;
    }
    return false;
  }

  /* ---------------- 禁手判定(黑方) ---------------- */
  /** (px,py) 是否落在以 (ex,ey) 为内点、方向 d、前 f 后 b 的连段上 */
  function runContains(ex, ey, dx, dy, f, b, px, py) {
    for (var k = -b; k <= f; k++) {
      if (ex + k * dx === px && ey + k * dy === py) return true;
    }
    return false;
  }

  /** 假设黑已落于 (x,y),检查方向 d 上,e 点补子能否成含 (x,y) 的恰五连 */
  function completesFive(bd, ex, ey, dx, dy, x, y) {
    put(bd, ex, ey, 1);
    var f = runLen(bd, ex, ey, dx, dy, 1), b = runLen(bd, ex, ey, -dx, -dy, 1);
    var ok = (1 + f + b === 5) && runContains(ex, ey, dx, dy, f, b, x, y);
    put(bd, ex, ey, 0);
    return ok;
  }

  /** 方向 d 上,以 (x,y)(已落黑)为基准的"四"个数(冲四/活四) */
  function foursInDir(bd, x, y, dx, dy) {
    // 活四(_BBBB_,恰四连且两端皆空)记 1;
    // 否则统计能一步成恰五的补点数(BBB_B 之类,各补点各记 1)。
    var L = lineLen(bd, x, y, dx, dy, 1);
    if (L === 4) {
      var f = runLen(bd, x, y, dx, dy, 1), b = runLen(bd, x, y, -dx, -dy, 1);
      var e1x = x + (f + 1) * dx, e1y = y + (f + 1) * dy;
      var e2x = x - (b + 1) * dx, e2y = y - (b + 1) * dy;
      if (at(bd, e1x, e1y) === 0 && at(bd, e2x, e2y) === 0 &&
          at(bd, e1x + dx, e1y + dy) !== 1 && at(bd, e2x - dx, e2y - dy) !== 1) {
        return 1; // 活四整体算一个四
      }
    }
    var cnt = 0;
    for (var k = -4; k <= 4; k++) {
      if (k === 0) continue;
      var ex = x + k * dx, ey = y + k * dy;
      if (at(bd, ex, ey) !== 0) continue;
      if (completesFive(bd, ex, ey, dx, dy, x, y)) cnt++;
    }
    return cnt;
  }

  /** 方向 d 上,(x,y)(已落黑)是否构成活三(可一步成活四) */
  function openThreeInDir(bd, x, y, dx, dy) {
    for (var k = -4; k <= 4; k++) {
      if (k === 0) continue;
      var ex = x + k * dx, ey = y + k * dy;
      if (at(bd, ex, ey) !== 0) continue;
      put(bd, ex, ey, 1);
      var f = runLen(bd, ex, ey, dx, dy, 1), b = runLen(bd, ex, ey, -dx, -dy, 1);
      var isStraightFour = false;
      if (1 + f + b === 4) {
        var h1x = ex + (f + 1) * dx, h1y = ey + (f + 1) * dy;
        var h2x = ex - (b + 1) * dx, h2y = ey - (b + 1) * dy;
        if (at(bd, h1x, h1y) === 0 && at(bd, h2x, h2y) === 0 &&
            at(bd, h1x + dx, h1y + dy) !== 1 && at(bd, h2x - dx, h2y - dy) !== 1 &&
            runContains(ex, ey, dx, dy, f, b, x, y)) {
          isStraightFour = true; // 补 e 后成含 (x,y) 的活四 → (x,y) 处为活三
        }
      }
      put(bd, ex, ey, 0);
      if (isStraightFour) return true;
    }
    return false;
  }

  /**
   * 黑方在 (x,y) 落子是否禁手。
   * 返回 null(不禁)或 "overline" | "double-four" | "double-three"。
   * 恰五连优先于一切禁手(直接获胜)。
   */
  function forbidden(bd, x, y) {
    if (bd[y * N + x] !== 0) return null;
    put(bd, x, y, 1);
    var five = false, over = false, d;
    for (d = 0; d < 4; d++) {
      var L = lineLen(bd, x, y, DIRS[d][0], DIRS[d][1], 1);
      if (L === 5) five = true;
      if (L >= 6) over = true;
    }
    if (five) { put(bd, x, y, 0); return null; }
    if (over) { put(bd, x, y, 0); return "overline"; }
    var fours = 0, threes = 0;
    for (d = 0; d < 4; d++) {
      var fc = foursInDir(bd, x, y, DIRS[d][0], DIRS[d][1]);
      fours += fc;
      if (fc === 0 && openThreeInDir(bd, x, y, DIRS[d][0], DIRS[d][1])) threes++;
    }
    put(bd, x, y, 0);
    if (fours >= 2) return "double-four";
    if (threes >= 2) return "double-three";
    return null;
  }

  /* ---------------- 评估 ---------------- */
  /**
   * (x,y) 落 who 的启发分:四方向五元窗口求和。
   * 窗口内无对方子时按己子数计分,再按窗口两端开阔度微调。
   */
  var WSCORE = [0, 4, 40, 500, 8000, 100000];

  function pointScore(bd, x, y, who) {
    var total = 0, opp = 3 - who;
    for (var d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1];
      var dirScore = 0;
      for (var s = -4; s <= 0; s++) {           // 含 (x,y) 的 5 个窗口
        var own = 0, blocked = false;
        for (var k = 0; k < 5; k++) {
          var c = at(bd, x + (s + k) * dx, y + (s + k) * dy);
          if (k === -s) c = who;                // 假设落子
          if (c === opp || c === 3) { blocked = true; break; }
          if (c === who) own++;
        }
        if (!blocked) dirScore += WSCORE[own];
      }
      total += dirScore;
    }
    return total;
  }

  /* ---------------- 候选点 ---------------- */
  function candidates(bd) {
    var has = false, marks = new Array(N * N).fill(false), out = [];
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (bd[y * N + x] === 0) continue;
      has = true;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) {
        var nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
        var i = ny * N + nx;
        if (bd[i] === 0 && !marks[i]) { marks[i] = true; out.push({ x: nx, y: ny }); }
      }
    }
    if (!has) out.push({ x: 7, y: 7 });
    return out;
  }

  /* ---------------- AI ---------------- */
  /**
   * bestMove(bd, who, level, renju) -> {x, y}
   * level: 1 随手 / 2 稳健 / 3 深思
   * renju=true 时黑方会避开禁手点。
   */
  function bestMove(bd, who, level, renju) {
    var opp = 3 - who;
    var cands = candidates(bd);
    var legal = cands.filter(function (c) {
      if (renju && who === 1 && forbidden(bd, c.x, c.y)) return false;
      return true;
    });
    if (legal.length === 0) legal = cands;      // 全是禁手时只能认栽落子
    if (legal.length === 0) return null;

    // 1) 一步致胜
    for (var i = 0; i < legal.length; i++) {
      if (isWinningMove(bd, legal[i].x, legal[i].y, who, renju)) return legal[i];
    }
    // 2) 挡对方一步致胜(对方不吃我方禁手限制)
    for (i = 0; i < cands.length; i++) {
      if (isWinningMove(bd, cands[i].x, cands[i].y, opp, renju)) {
        var blockOK = legal.some(function (c) { return c.x === cands[i].x && c.y === cands[i].y; });
        if (blockOK) return cands[i];
      }
    }

    // 3) 启发打分:攻 + 守
    var defW = level >= 2 ? 0.9 : 0.45;
    var scored = legal.map(function (c) {
      var sc = pointScore(bd, c.x, c.y, who) + defW * pointScore(bd, c.x, c.y, opp);
      return { c: c, sc: sc };
    });
    scored.sort(function (a, b) { return b.sc - a.sc; });

    if (level <= 1) {
      // 随手:前五名里随机挑
      var top = scored.slice(0, Math.min(5, scored.length));
      return top[Math.floor(Math.random() * top.length)].c;
    }
    if (level === 2) return scored[0].c;

    // 4) level 3:对前 8 名做一层对抗 —— 我走后,对方最佳回应有多凶
    var K = Math.min(8, scored.length);
    var best = null, bestVal = -Infinity;
    for (i = 0; i < K; i++) {
      var c = scored[i].c;
      put(bd, c.x, c.y, who);
      var reply = 0;
      var oppCands = candidates(bd);
      for (var j = 0; j < oppCands.length; j++) {
        var oc = oppCands[j];
        if (renju && opp === 1 && forbidden(bd, oc.x, oc.y)) continue;
        var r = pointScore(bd, oc.x, oc.y, opp) + 0.5 * pointScore(bd, oc.x, oc.y, who);
        if (r > reply) reply = r;
      }
      put(bd, c.x, c.y, 0);
      var val = scored[i].sc - 0.55 * reply;
      if (val > bestVal) { bestVal = val; best = c; }
    }
    return best || scored[0].c;
  }

  var Gomoku = {
    N: N,
    emptyBoard: emptyBoard,
    at: at,
    isWinningMove: isWinningMove,
    forbidden: forbidden,
    pointScore: pointScore,
    candidates: candidates,
    bestMove: bestMove
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Gomoku;
  else window.Gomoku = Gomoku;
})();
