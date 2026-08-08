/* ============================================================
   AUREX / TAROT — cardart.js
   原创几何符文风牌面:纯内联 SVG,零外部资源。
   大阿卡纳 22 张各有独立符印;小阿卡纳按经典点阵排布花色图腾。
   ============================================================ */
(function () {
  'use strict';
  const Tarot = (window.Tarot = window.Tarot || {});
  const W = 260, H = 440, CX = 130;

  const ACCENT = {
    major: '#d9d0f0',
    wands: '#d99f78',
    cups: '#93b2d9',
    swords: '#bac5da',
    pentacles: '#cdbA82',
  };
  const DIM = '#8f83b8';      // 次级线条
  const FAINT = '#6c5f9b';    // 装饰
  const SW = 2.6;             // 主线宽

  /* ---------- 基础绘图助手 ---------- */
  const N = (v) => Math.round(v * 100) / 100;
  function L(x1, y1, x2, y2, w, col) {
    return `<line x1="${N(x1)}" y1="${N(y1)}" x2="${N(x2)}" y2="${N(y2)}" stroke="${col || 'CUR'}" stroke-width="${w || SW}" stroke-linecap="round"/>`;
  }
  function C(cx, cy, r, w, col, fill) {
    return `<circle cx="${N(cx)}" cy="${N(cy)}" r="${N(r)}" fill="${fill || 'none'}" stroke="${col || 'CUR'}" stroke-width="${w == null ? SW : w}"/>`;
  }
  function P(d, w, col, fill) {
    return `<path d="${d}" fill="${fill || 'none'}" stroke="${col || 'CUR'}" stroke-width="${w == null ? SW : w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  function G(pointsStr, w, col, close) {
    return `<${close ? 'polygon' : 'polyline'} points="${pointsStr}" fill="none" stroke="${col || 'CUR'}" stroke-width="${w || SW}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  function dot(cx, cy, r, col) {
    return `<circle cx="${N(cx)}" cy="${N(cy)}" r="${N(r || 2.4)}" fill="${col || 'CUR'}"/>`;
  }
  function sparkle(cx, cy, r, col) { // 四芒星
    return P(`M${N(cx)} ${N(cy - r)} Q${N(cx + r * 0.14)} ${N(cy - r * 0.14)} ${N(cx + r)} ${N(cy)} Q${N(cx + r * 0.14)} ${N(cy + r * 0.14)} ${N(cx)} ${N(cy + r)} Q${N(cx - r * 0.14)} ${N(cy + r * 0.14)} ${N(cx - r)} ${N(cy)} Q${N(cx - r * 0.14)} ${N(cy - r * 0.14)} ${N(cx)} ${N(cy - r)} Z`, 1, col, col);
  }
  function regularPoly(cx, cy, r, n, rot) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (rot || 0) + (i / n) * Math.PI * 2 - Math.PI / 2;
      pts.push(N(cx + r * Math.cos(a)) + ',' + N(cy + r * Math.sin(a)));
    }
    return pts.join(' ');
  }
  function starPath(cx, cy, r, n, inner, rot) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const rr = i % 2 === 0 ? r : r * (inner || 0.42);
      const a = (rot || 0) + (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      pts.push(N(cx + rr * Math.cos(a)) + ',' + N(cy + rr * Math.sin(a)));
    }
    return pts.join(' ');
  }

  /* ---------- 花色图腾(中心 0,0,尺度 r) ---------- */
  function glyphWand(r) {
    return L(0, -r, 0, r) +
      G(`0,${N(-r - 4)} ${N(r * 0.32)},${N(-r + r * 0.34 - 4)} 0,${N(-r + r * 0.62 - 4)} ${N(-r * 0.32)},${N(-r + r * 0.34 - 4)}`, SW * 0.8, null, true) +
      P(`M${N(-r * 0.42)} ${N(r * 0.1)} Q${N(-r * 0.8)} ${N(-r * 0.12)} ${N(-r * 0.5)} ${N(-r * 0.42)}`, SW * 0.7) +
      P(`M${N(r * 0.42)} ${N(r * 0.1)} Q${N(r * 0.8)} ${N(-r * 0.12)} ${N(r * 0.5)} ${N(-r * 0.42)}`, SW * 0.7) +
      L(-r * 0.28, r, r * 0.28, r, SW * 0.8);
  }
  function glyphCup(r) {
    return P(`M${N(-r * 0.78)} ${N(-r * 0.72)} L${N(-r * 0.78)} ${N(-r * 0.3)} A${N(r * 0.78)} ${N(r * 0.72)} 0 0 0 ${N(r * 0.78)} ${N(-r * 0.3)} L${N(r * 0.78)} ${N(-r * 0.72)}`) +
      L(0, r * 0.42, 0, r * 0.05) +
      L(-r * 0.52, r * 0.72, r * 0.52, r * 0.72) +
      P(`M${N(-r * 0.52)} ${N(r * 0.72)} Q0 ${N(r * 0.4)} ${N(r * 0.52)} ${N(r * 0.72)}`, SW * 0.8) +
      dot(0, -r * 0.5, r * 0.09);
  }
  function glyphSword(r) {
    return L(0, -r, 0, r * 0.62) +
      G(`${N(-r * 0.13)},${N(-r * 0.55)} 0,${N(-r - 3)} ${N(r * 0.13)},${N(-r * 0.55)}`, SW * 0.8) +
      L(-r * 0.5, r * 0.28, r * 0.5, r * 0.28) +
      P(`M${N(-r * 0.5)} ${N(r * 0.28)} Q${N(-r * 0.62)} ${N(r * 0.5)} ${N(-r * 0.42)} ${N(r * 0.56)}`, SW * 0.7) +
      P(`M${N(r * 0.5)} ${N(r * 0.28)} Q${N(r * 0.62)} ${N(r * 0.5)} ${N(r * 0.42)} ${N(r * 0.56)}`, SW * 0.7) +
      C(0, r * 0.82, r * 0.16, SW * 0.8);
  }
  function glyphPentacle(r) {
    return C(0, 0, r * 0.92, SW * 0.9) +
      G(starPath(0, 0, r * 0.66, 5, 0.42), SW * 0.75, null, true) +
      dot(0, 0, r * 0.07);
  }
  const GLYPH = { wands: glyphWand, cups: glyphCup, swords: glyphSword, pentacles: glyphPentacle };

  /* ---------- 大阿卡纳符印(画布中心约 130,195) ---------- */
  const cy0 = 195;
  const SIGIL = {
    0: () => P(`M${CX + 52} ${cy0 - 30} A60 60 0 1 0 ${CX + 52} ${cy0 + 30}`) + dot(CX + 66, cy0, 5) + C(CX + 66, cy0, 11, 1.4) + sparkle(CX - 30, cy0 - 68, 5, DIM),
    1: () => C(CX - 23, cy0 - 30, 22) + C(CX + 23, cy0 - 30, 22) + L(CX, cy0 + 4, CX, cy0 + 78) + L(CX - 16, cy0 + 78, CX + 16, cy0 + 78, SW * 0.8) + dot(CX, cy0 - 30, 2.6),
    2: () => L(CX - 56, cy0 - 62, CX - 56, cy0 + 68) + L(CX + 56, cy0 - 62, CX + 56, cy0 + 68) + P(`M${CX + 14} ${cy0 - 40} A40 40 0 1 0 ${CX + 14} ${cy0 + 40} A50 50 0 0 1 ${CX + 14} ${cy0 - 40}`) + dot(CX - 56, cy0 - 62, 3) + dot(CX + 56, cy0 - 62, 3),
    3: () => C(CX, cy0 - 26, 35) + L(CX, cy0 + 9, CX, cy0 + 66) + L(CX - 21, cy0 + 38, CX + 21, cy0 + 38) + G(starPath(CX, cy0 - 26, 12, 5, 0.45), 1.1, DIM, true),
    4: () => G(regularPoly(CX, cy0 + 6, 52, 4, Math.PI / 4), SW, null, true) + P(`M${CX - 37} ${cy0 - 31} Q${CX - 60} ${cy0 - 48} ${CX - 44} ${cy0 - 64} Q${CX - 32} ${cy0 - 72} ${CX - 26} ${cy0 - 62}`) + P(`M${CX + 37} ${cy0 - 31} Q${CX + 60} ${cy0 - 48} ${CX + 44} ${cy0 - 64} Q${CX + 32} ${cy0 - 72} ${CX + 26} ${cy0 - 62}`) + dot(CX, cy0 + 6, 3),
    5: () => L(CX, cy0 - 72, CX, cy0 + 74) + L(CX - 40, cy0 - 40, CX + 40, cy0 - 40) + L(CX - 29, cy0 - 12, CX + 29, cy0 - 12) + L(CX - 18, cy0 + 16, CX + 18, cy0 + 16) + dot(CX - 40, cy0 + 58, 3.4) + dot(CX + 40, cy0 + 58, 3.4),
    6: () => C(CX - 23, cy0 + 6, 40) + C(CX + 23, cy0 + 6, 40) + sparkle(CX, cy0 - 66, 9) + dot(CX, cy0 + 6, 2.8),
    7: () => G(regularPoly(CX, cy0 - 14, 46, 4, Math.PI / 4), SW, null, true) + C(CX - 36, cy0 + 56, 17) + C(CX + 36, cy0 + 56, 17) + L(CX - 36, cy0 + 39, CX - 36, cy0 + 73, 1.2, DIM) + L(CX - 53, cy0 + 56, CX - 19, cy0 + 56, 1.2, DIM) + L(CX + 36, cy0 + 39, CX + 36, cy0 + 73, 1.2, DIM) + L(CX + 19, cy0 + 56, CX + 53, cy0 + 56, 1.2, DIM) + sparkle(CX, cy0 - 14, 7, DIM),
    8: () => C(CX - 21, cy0 - 34, 20) + C(CX + 21, cy0 - 34, 20) + P(`M${CX - 46} ${cy0 + 26} Q${CX} ${cy0 + 74} ${CX + 46} ${cy0 + 26}`) + dot(CX - 46, cy0 + 26, 3) + dot(CX + 46, cy0 + 26, 3),
    9: () => G(regularPoly(CX, cy0 + 6, 38, 6), SW, null, true) + L(CX, cy0 - 74, CX, cy0 - 32) + P(`M${CX} ${cy0 - 74} Q${CX + 16} ${cy0 - 80} ${CX + 18} ${cy0 - 66}`, SW * 0.8) + sparkle(CX, cy0 + 6, 10),
    10: () => { let s = C(CX, cy0, 54) + C(CX, cy0, 21); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; s += L(CX + 21 * Math.cos(a), cy0 + 21 * Math.sin(a), CX + 54 * Math.cos(a), cy0 + 54 * Math.sin(a), 1.6); } for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; s += dot(CX + 68 * Math.cos(a), cy0 + 68 * Math.sin(a), 3, DIM); } return s; },
    11: () => L(CX, cy0 - 64, CX, cy0 + 62) + L(CX - 55, cy0 - 44, CX + 55, cy0 - 44) + L(CX - 55, cy0 - 44, CX - 55, cy0 - 14, 1.4, DIM) + L(CX + 55, cy0 - 44, CX + 55, cy0 - 14, 1.4, DIM) + P(`M${CX - 71} ${cy0 - 14} A16 16 0 0 0 ${CX - 39} ${cy0 - 14}`) + P(`M${CX + 39} ${cy0 - 14} A16 16 0 0 0 ${CX + 71} ${cy0 - 14}`) + G(`${CX - 18},${cy0 + 62} ${CX + 18},${cy0 + 62} ${CX},${cy0 + 44}`, SW * 0.8, null, true),
    12: () => L(CX - 50, cy0 - 66, CX + 50, cy0 - 66) + L(CX, cy0 - 66, CX, cy0 - 30) + G(`${CX - 30},${cy0 - 30} ${CX + 30},${cy0 - 30} ${CX},${cy0 + 34}`, SW, null, true) + C(CX, cy0 + 50, 14) + G(starPath(CX, cy0 + 50, 7, 4, 0.5), 1, DIM, true),
    13: () => P(`M${CX - 30} ${cy0 + 74} L${CX + 22} ${cy0 - 70}`) + P(`M${CX + 22} ${cy0 - 70} A64 64 0 0 0 ${CX - 52} ${cy0 - 40}`) + P(`M${CX + 22} ${cy0 - 70} A64 64 0 0 1 ${CX - 52} ${cy0 - 40}`, 1, DIM) + G(starPath(CX - 30, cy0 + 74, 8, 5, 0.5), 1.2, null, true),
    14: () => G(regularPoly(CX, cy0 - 26, 38, 3), SW, null, true) + G(regularPoly(CX, cy0 + 30, 38, 3, Math.PI), SW, null, true) + P(`M${CX - 52} ${cy0 + 2} Q${CX - 26} ${cy0 - 8} ${CX} ${cy0 + 2} T${CX + 52} ${cy0 + 2}`, 1.6, DIM),
    15: () => C(CX, cy0 + 4, 52) + G(starPath(CX, cy0 + 4, 40, 5, 0.42, Math.PI), SW * 0.85, null, true) + P(`M${CX - 30} ${cy0 - 46} Q${CX - 40} ${cy0 - 72} ${CX - 20} ${cy0 - 76}`) + P(`M${CX + 30} ${cy0 - 46} Q${CX + 40} ${cy0 - 72} ${CX + 20} ${cy0 - 76}`),
    16: () => G(`${CX - 24},${cy0 + 74} ${CX - 24},${cy0 - 44} ${CX + 24},${cy0 - 44} ${CX + 24},${cy0 + 74}`, SW) + G(`${CX - 30},${cy0 - 44} ${CX - 14},${cy0 - 60} ${CX + 4},${cy0 - 50} ${CX + 30},${cy0 - 44}`, SW * 0.8) + G(`${CX + 56},${cy0 - 84} ${CX + 20},${cy0 - 34} ${CX + 40},${cy0 - 30} ${CX + 2},${cy0 + 14}`, SW) + dot(CX - 40, cy0 + 6, 2.6, DIM) + dot(CX - 48, cy0 + 34, 2.2, DIM) + dot(CX + 46, cy0 + 42, 2.6, DIM),
    17: () => { let s = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, len = i % 2 === 0 ? 58 : 34; s += L(CX + 12 * Math.cos(a), cy0 - 22 + 12 * Math.sin(a), CX + len * Math.cos(a), cy0 - 22 + len * Math.sin(a), i % 2 === 0 ? SW : 1.4); } return s + C(CX, cy0 - 22, 7, SW * 0.8) + P(`M${CX - 46} ${cy0 + 62} Q${CX - 23} ${cy0 + 54} ${CX} ${cy0 + 62} T${CX + 46} ${cy0 + 62}`, 1.5, DIM) + P(`M${CX - 32} ${cy0 + 74} Q${CX - 16} ${cy0 + 68} ${CX} ${cy0 + 74} T${CX + 32} ${cy0 + 74}`, 1.2, DIM); },
    18: () => P(`M${CX + 20} ${cy0 - 58} A44 44 0 1 0 ${CX + 20} ${cy0 + 18} A54 54 0 0 1 ${CX + 20} ${cy0 - 58}`) + L(CX - 34, cy0 + 44, CX - 34, cy0 + 54, 1.6, DIM) + L(CX, cy0 + 48, CX, cy0 + 58, 1.6, DIM) + L(CX + 34, cy0 + 44, CX + 34, cy0 + 54, 1.6, DIM) + P(`M${CX - 52} ${cy0 + 74} Q${CX - 26} ${cy0 + 66} ${CX} ${cy0 + 74} T${CX + 52} ${cy0 + 74}`, 1.5, DIM) + dot(CX - 5, cy0 - 20, 2.4, DIM),
    19: () => { let s = C(CX, cy0, 34) + dot(CX, cy0, 3.2); for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r1 = 42, r2 = i % 2 === 0 ? 66 : 54; s += L(CX + r1 * Math.cos(a), cy0 + r1 * Math.sin(a), CX + r2 * Math.cos(a), cy0 + r2 * Math.sin(a), i % 2 === 0 ? SW : 1.3); } return s; },
    20: () => G(`${CX - 58},${cy0 - 60} ${CX + 6},${cy0 - 24} ${CX - 20},${cy0 + 8} Z`, SW, null, true) + L(CX + 18, cy0 - 38, CX + 52, cy0 - 56, 1.5, DIM) + L(CX + 22, cy0 - 18, CX + 60, cy0 - 24, 1.5, DIM) + L(CX + 16, cy0 + 2, CX + 50, cy0 + 12, 1.5, DIM) + P(`M${CX - 54} ${cy0 + 70} Q${CX} ${cy0 + 28} ${CX + 54} ${cy0 + 70}`) + dot(CX, cy0 + 44, 3),
    21: () => `<ellipse cx="${CX}" cy="${cy0}" rx="48" ry="66" fill="none" stroke="CUR" stroke-width="${SW}"/>` + `<ellipse cx="${CX}" cy="${cy0}" rx="38" ry="55" fill="none" stroke="${DIM}" stroke-width="1.1"/>` + G(starPath(CX, cy0, 14, 5, 0.45), 1.3, null, true) + sparkle(CX - 66, cy0 - 74, 6, DIM) + sparkle(CX + 66, cy0 - 74, 6, DIM) + sparkle(CX - 66, cy0 + 78, 6, DIM) + sparkle(CX + 66, cy0 + 78, 6, DIM),
  };

  /* ---------- 点阵布局(1-10) ---------- */
  const PIPS = {
    1: [[0.5, 0.5]],
    2: [[0.5, 0.2], [0.5, 0.8]],
    3: [[0.5, 0.16], [0.5, 0.5], [0.5, 0.84]],
    4: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.78], [0.72, 0.78]],
    5: [[0.28, 0.2], [0.72, 0.2], [0.5, 0.5], [0.28, 0.8], [0.72, 0.8]],
    6: [[0.28, 0.17], [0.72, 0.17], [0.28, 0.5], [0.72, 0.5], [0.28, 0.83], [0.72, 0.83]],
    7: [[0.28, 0.16], [0.72, 0.16], [0.5, 0.34], [0.28, 0.52], [0.72, 0.52], [0.28, 0.86], [0.72, 0.86]],
    8: [[0.28, 0.15], [0.72, 0.15], [0.5, 0.33], [0.28, 0.51], [0.72, 0.51], [0.5, 0.69], [0.28, 0.87], [0.72, 0.87]],
    9: [[0.28, 0.14], [0.72, 0.14], [0.28, 0.38], [0.72, 0.38], [0.5, 0.5], [0.28, 0.62], [0.72, 0.62], [0.28, 0.86], [0.72, 0.86]],
    10: [[0.28, 0.13], [0.72, 0.13], [0.5, 0.27], [0.28, 0.42], [0.72, 0.42], [0.28, 0.61], [0.72, 0.61], [0.5, 0.75], [0.28, 0.89], [0.72, 0.89]],
  };

  const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
  const COURT_CHAR = { page: '侍', knight: '骑', queen: '后', king: '王' };

  /* ---------- 宫廷牌饰记 ---------- */
  function courtMark(rank) {
    const y = 102;
    if (rank === 'page') return C(CX, y, 9, 1.6) + dot(CX, y, 2.2);
    if (rank === 'knight') return G(`${CX - 14},${y + 6} ${CX},${y - 8} ${CX + 14},${y + 6}`, 1.8) + G(`${CX - 9},${y + 12} ${CX},${y + 2} ${CX + 9},${y + 12}`, 1.3, DIM);
    if (rank === 'queen') return P(`M${CX - 16} ${y + 7} L${CX - 16} ${y - 4} Q${CX - 8} ${y + 4} ${CX} ${y - 7} Q${CX + 8} ${y + 4} ${CX + 16} ${y - 4} L${CX + 16} ${y + 7} Z`, 1.6) + dot(CX, y - 12, 2);
    return G(`${CX - 18},${y + 7} ${CX - 18},${y - 5} ${CX - 9},${y + 2} ${CX},${y - 9} ${CX + 9},${y + 2} ${CX + 18},${y - 5} ${CX + 18},${y + 7}`, 1.6, null, true) + L(CX, y - 13, CX, y - 19, 1.4) + L(CX - 3, y - 16, CX + 3, y - 16, 1.4);
  }

  /* ---------- 种子化背景星尘 ---------- */
  function stardust(card, accent) {
    const rng = Tarot.rng('art:' + card.id);
    let s = '';
    const n = 7 + Math.floor(rng() * 5);
    for (let i = 0; i < n; i++) {
      const x = 26 + rng() * (W - 52), y = 60 + rng() * 290;
      const r = 0.8 + rng() * 1.4;
      s += `<circle cx="${N(x)}" cy="${N(y)}" r="${N(r)}" fill="${accent}" opacity="${N(0.12 + rng() * 0.2)}"/>`;
    }
    return s;
  }

  /* ---------- 边框与骨架 ---------- */
  function frame(accent, suitKey) {
    const gid = 'tg-' + (suitKey || 'major');
    return `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0.6" y2="1">` +
      `<stop offset="0" stop-color="#332b52"/><stop offset="0.55" stop-color="#2c2542"/><stop offset="1" stop-color="#241e38"/>` +
      `</linearGradient></defs>` +
      `<rect width="${W}" height="${H}" rx="12" fill="url(#${gid})"/>` +
      `<rect x="7" y="7" width="${W - 14}" height="${H - 14}" rx="8" fill="none" stroke="${accent}" stroke-width="1.5" opacity="0.85"/>` +
      `<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="5" fill="none" stroke="${FAINT}" stroke-width="0.8"/>` +
      // 四角饰记
      [[20, 20, 1, 1], [W - 20, 20, -1, 1], [20, H - 20, 1, -1], [W - 20, H - 20, -1, -1]]
        .map(([x, y, sx, sy]) => `<path d="M${x} ${y + 10 * sy} L${x} ${y} L${x + 10 * sx} ${y}" fill="none" stroke="${accent}" stroke-width="1.2" opacity="0.7"/>`)
        .join('');
  }
  function nameBand(card, accent) {
    const en = Tarot.esc(card.name_en).toUpperCase();
    return `<line x1="40" y1="365" x2="${W - 40}" y2="365" stroke="${FAINT}" stroke-width="0.8"/>` +
      `<text x="${CX}" y="393" text-anchor="middle" font-family="'Noto Serif SC','Songti SC',serif" font-size="20" font-weight="700" fill="${accent}" letter-spacing="4">${Tarot.esc(card.name_zh)}</text>` +
      `<text x="${CX}" y="414" text-anchor="middle" font-family="Georgia,serif" font-size="9.5" fill="${DIM}" letter-spacing="2.4">${en}</text>`;
  }
  function topBand(card, accent) {
    let label;
    if (card.arcana === 'major') label = ROMAN[card.number];
    else if (card.number === 1) label = 'A';
    else if (card.number <= 10) label = ROMAN[card.number];
    else label = COURT_CHAR[card.rank];
    const isCJK = /[一-鿿]/.test(label);
    return `<text x="${CX}" y="${isCJK ? 47 : 45}" text-anchor="middle" font-family="${isCJK ? "'Noto Serif SC',serif" : 'Georgia,serif'}" font-size="${isCJK ? 15 : 16}" fill="${accent}" letter-spacing="2">${label}</text>` +
      `<line x1="96" y1="56" x2="${CX - 14}" y2="56" stroke="${FAINT}" stroke-width="0.8"/>` +
      `<line x1="${CX + 14}" y1="56" x2="164" y2="56" stroke="${FAINT}" stroke-width="0.8"/>` +
      dot(CX, 56, 1.6, FAINT);
  }

  /* ---------- 牌面主体 ---------- */
  function bodyArt(card) {
    if (card.arcana === 'major') {
      const fn = SIGIL[card.number];
      return `<g>${fn ? fn() : ''}</g>`;
    }
    const glyph = GLYPH[card.suit];
    if (card.number <= 10) {
      const pts = PIPS[card.number];
      const r = card.number === 1 ? 46 : card.number <= 3 ? 26 : card.number <= 6 ? 22 : 18.5;
      const x0 = 52, x1 = W - 52, y0 = 76, y1 = 336;
      let s = '';
      if (card.number === 1) s += C(CX, (y0 + y1) / 2, 64, 0.9, FAINT); // 王牌光环
      pts.forEach(([fx, fy]) => {
        const gx = x0 + fx * (x1 - x0), gy = y0 + fy * (y1 - y0);
        s += `<g transform="translate(${N(gx)} ${N(gy)})">${glyph(r)}</g>`;
      });
      return s;
    }
    // 宫廷牌:大图腾 + 头衔饰记 + 座环
    return C(CX, 210, 74, 0.9, FAINT) +
      `<g transform="translate(${CX} 210)">${glyph(52)}</g>` +
      courtMark(card.rank);
  }

  /** 生成一张牌的正面 SVG 字符串 */
  Tarot.art = {};
  Tarot.art.front = function (card, opts) {
    const o = opts || {};
    const accent = ACCENT[card.arcana === 'major' ? 'major' : card.suit];
    let inner = stardust(card, accent) + topBand(card, accent) +
      bodyArt(card).replace(/CUR/g, accent) + nameBand(card, accent);
    if (o.reversed) inner = `<g transform="rotate(180 ${W / 2} ${H / 2})">${inner}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${Tarot.esc(card.name_zh)}${o.reversed ? '(逆位)' : ''}">` +
      frame(accent, card.arcana === 'major' ? 'major' : card.suit) + inner + `</svg>`;
  };

  /** 牌背:对称几何织纹 */
  Tarot.art.back = function () {
    let lattice = '';
    for (let i = -6; i < 14; i++) {
      lattice += `<line x1="${i * 36}" y1="0" x2="${i * 36 + 220}" y2="440" stroke="#4a3f75" stroke-width="0.8"/>` +
        `<line x1="${i * 36}" y1="440" x2="${i * 36 + 220}" y2="0" stroke="#4a3f75" stroke-width="0.8"/>`;
    }
    let rays = '';
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      rays += `<line x1="${N(CX + 34 * Math.cos(a))}" y1="${N(220 + 34 * Math.sin(a))}" x2="${N(CX + 52 * Math.cos(a))}" y2="${N(220 + 52 * Math.sin(a))}" stroke="#9c8fc7" stroke-width="1.4" stroke-linecap="round"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="牌背">` +
      `<defs><linearGradient id="tg-back" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#38305c"/><stop offset="1" stop-color="#262040"/></linearGradient></defs>` +
      `<rect width="${W}" height="${H}" rx="12" fill="url(#tg-back)"/>` +
      `<clipPath id="tg-back-clip"><rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="7"/></clipPath>` +
      `<g clip-path="url(#tg-back-clip)" opacity="0.5">${lattice}</g>` +
      `<rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="7" fill="none" stroke="#9c8fc7" stroke-width="1.4"/>` +
      `<circle cx="${CX}" cy="220" r="46" fill="#2c2542" stroke="#9c8fc7" stroke-width="1.2"/>` +
      `<circle cx="${CX}" cy="220" r="26" fill="none" stroke="#7d6fae" stroke-width="0.9"/>` +
      `<polygon points="${starPath(CX, 220, 18, 4, 0.4)}" fill="#c9bfe6"/>` + rays +
      `</svg>`;
  };

  /** 便捷:构建一个可翻转的 DOM 牌元素 */
  Tarot.art.cardEl = function (card, opts) {
    const o = opts || {};
    const el = document.createElement('div');
    el.className = 'tcard' + (o.flipped ? ' flipped' : '') + (o.cross ? ' crossed' : '');
    if (o.width) el.style.setProperty('--cw', o.width + 'px');
    el.innerHTML =
      (o.reversed ? '<span class="rev-badge">逆位</span>' : '') +
      '<div class="tcard-inner">' +
      '<div class="tcard-face tcard-back">' + Tarot.art.back() + '</div>' +
      '<div class="tcard-face tcard-front">' + Tarot.art.front(card, { reversed: o.reversed }) + '</div>' +
      '</div>' +
      (o.label ? '<span class="pos-label">' + Tarot.esc(o.label) + '</span>' : '');
    return el;
  };
})();
