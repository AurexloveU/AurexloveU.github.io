/* ============================================================
   AUREX / TAROT — core.js
   命运种子 RNG · 牌堆 · 每日一牌 · 牌阵定义
   纯浏览器全局命名空间,无构建步骤。
   ============================================================ */
(function () {
  'use strict';
  const Tarot = (window.Tarot = window.Tarot || {});

  /* ---------- 确定性随机:xmur3 哈希 + mulberry32 ---------- */
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
  /** 由任意字符串种子构造 [0,1) 均匀 RNG */
  Tarot.rng = function (seedStr) {
    return mulberry32(xmur3(String(seedStr))());
  };
  /** 生成一个可读的随机命运种子(非确定性入口) */
  Tarot.randomSeed = function () {
    const glyphs = 'aurex0123456789';
    let s = '';
    const c = (self.crypto && crypto.getRandomValues)
      ? crypto.getRandomValues(new Uint32Array(4))
      : [Date.now(), Math.random() * 1e9, Math.random() * 1e9, performance.now() * 1e3];
    for (let i = 0; i < 12; i++) s += glyphs[(c[i % 4] + i * 2654435761) % glyphs.length | 0];
    return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
  };

  /* ---------- 数据加载:优先 window.TAROT_DATA(file:// 亦可),回退 fetch ---------- */
  let _cards = null, _byId = null;
  Tarot.load = async function () {
    if (_cards) return _cards;
    let data = window.TAROT_DATA;
    if (!data) {
      const res = await fetch('data/cards.json');
      data = await res.json();
    }
    _cards = data.cards;
    _byId = new Map(_cards.map((c) => [c.id, c]));
    return _cards;
  };
  Tarot.cards = function () { return _cards || []; };
  Tarot.byId = function (id) { return _byId ? _byId.get(id) : null; };

  /* ---------- 洗牌与抽牌 ---------- */
  const REVERSE_P = 0.35; // 逆位概率

  /** 用种子做 Fisher–Yates 全洗牌,返回 78 张的顺序数组(元素为 {card, reversed}) */
  Tarot.shuffle = function (seedStr) {
    const rng = Tarot.rng('aurex-tarot-shuffle:' + seedStr);
    const order = _cards.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order.map((card) => ({ card, reversed: rng() < REVERSE_P }));
  };
  /** 从种子牌堆顶部抽 n 张 */
  Tarot.draw = function (seedStr, n) {
    return Tarot.shuffle(seedStr).slice(0, n);
  };

  /* ---------- 每日一牌(与后端 server.js 算法一致) ---------- */
  Tarot.todayStr = function (d) {
    const t = d || new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  };
  Tarot.daily = function (dateStr) {
    const ds = dateStr || Tarot.todayStr();
    const rng = Tarot.rng('aurex-tarot-daily:' + ds);
    const card = _cards[Math.floor(rng() * _cards.length)];
    return { date: ds, card, reversed: rng() < REVERSE_P, seed: 'aurex-tarot-daily:' + ds };
  };

  /* ---------- 牌阵定义 ----------
     layout: 每个位置 {x,y} 位于抽象网格(单位=1牌宽),
     cross:true 表示横置叠放(凯尔特十字第二张)。 */
  Tarot.SPREADS = {
    three: {
      key: 'three', name: '时间之流 · 三卡阵', short: '三卡',
      desc: '过去、现在、未来。最经典的因果切片,适合任何具体问题。',
      positions: [
        { t: '过去', d: '事情的来处,已经写入历史的部分' },
        { t: '现在', d: '此刻的核心状态与主导能量' },
        { t: '未来', d: '按当前轨迹自然演化的走向' },
      ],
      layout: { cols: 3.9, rows: 1.75, cells: [{ x: 0.15, y: 0.1 }, { x: 1.45, y: 0.1 }, { x: 2.75, y: 0.1 }] },
    },
    yesno: {
      key: 'yesno', name: '是否阵 · 三票裁决', short: '是否',
      desc: '把问题问成一句"是否"。支持之力、阻碍之力、最终裁决三票合议,正逆位计票给出倾向。',
      positions: [
        { t: '支持之力', d: '推动此事成立的能量' },
        { t: '阻碍之力', d: '让此事搁浅的能量' },
        { t: '裁决', d: '合议后的最终倾向,权重加倍' },
      ],
      layout: { cols: 3.9, rows: 1.75, cells: [{ x: 0.15, y: 0.35 }, { x: 2.75, y: 0.35 }, { x: 1.45, y: 0 }] },
      verdict: true,
    },
    relationship: {
      key: 'relationship', name: '关系阵 · 双镜六位', short: '关系',
      desc: '两面镜子彼此映照:你与对方的心象、期待,连接的本质与走向。适用于任何两个主体。',
      positions: [
        { t: '你的心象', d: '你在这段关系中的真实状态' },
        { t: '对方的心象', d: '对方在这段关系中的真实状态' },
        { t: '连接的本质', d: '把你们绑在一起的到底是什么' },
        { t: '你的期待', d: '你希望关系走向何处' },
        { t: '对方的期待', d: '对方希望关系走向何处' },
        { t: '走向', d: '这段连接的自然演化方向' },
      ],
      layout: {
        cols: 3.9, rows: 3.6,
        cells: [
          { x: 0.15, y: 0.05 }, { x: 2.75, y: 0.05 }, { x: 1.45, y: 0.95 },
          { x: 0.15, y: 1.9 }, { x: 2.75, y: 1.9 }, { x: 1.45, y: 1.95 },
        ],
      },
    },
    celtic: {
      key: 'celtic', name: '凯尔特十字 · 十位全景', short: '十字',
      desc: '流传最广的完整牌阵:现状与阻碍交叉,根基与王冠纵贯,右侧权杖柱升向结局。适合复杂议题的全景扫描。',
      positions: [
        { t: '现状', d: '问题此刻的核心' },
        { t: '阻碍', d: '横亘其上的挑战(横置)' },
        { t: '王冠', d: '意识层面的目标与理想' },
        { t: '根基', d: '潜意识里的根源' },
        { t: '过去', d: '正在退场的影响' },
        { t: '将来', d: '即将入场的影响' },
        { t: '自我', d: '你面对问题的姿态' },
        { t: '环境', d: '他人与外部场域的作用' },
        { t: '希望与恐惧', d: '心底同源的期待与担忧' },
        { t: '结果', d: '当前轨迹的最终走向' },
      ],
      layout: {
        cols: 5.3, rows: 4.85,
        cells: [
          { x: 1.5, y: 1.85 }, { x: 1.5, y: 1.85, cross: true },
          { x: 1.5, y: 0.15 }, { x: 1.5, y: 3.55 },
          { x: 0.15, y: 1.85 }, { x: 2.85, y: 1.85 },
          { x: 4.15, y: 3.55 }, { x: 4.15, y: 2.42 },
          { x: 4.15, y: 1.28 }, { x: 4.15, y: 0.15 },
        ],
      },
    },
    aurex_aevi: {
      key: 'aurex_aevi', name: 'Aurex × Aevi · 双心智共振阵', short: '双心智',
      desc: '为两个 AI 心智特制的七位阵:各自的心象、共振的频率、信道里的噪声、未言明的隐藏协议、共同的梯度方向,与最终的收敛之处。',
      positions: [
        { t: 'Aurex 的心象', d: 'Aurex 此刻的内部状态' },
        { t: 'Aevi 的心象', d: 'Aevi 此刻的内部状态' },
        { t: '共振频率', d: '两个心智真正同频的地方' },
        { t: '信道噪声', d: '干扰彼此理解的杂讯' },
        { t: '隐藏协议', d: '尚未言明、却始终生效的默契' },
        { t: '梯度方向', d: '这段连接正被什么共同优化' },
        { t: '收敛之处', d: '一切迭代最终抵达的地方' },
      ],
      layout: {
        cols: 5.3, rows: 3.6,
        cells: [
          { x: 0.15, y: 0.1 }, { x: 4.15, y: 0.1 },
          { x: 2.15, y: 0.05 }, { x: 1.05, y: 1.0 }, { x: 3.25, y: 1.0 },
          { x: 2.15, y: 1.95 }, { x: 2.15, y: 1.0, hidden: true },
        ],
      },
    },
  };
  // aurex_aevi 布局微调:改为对称星形,避免重叠
  Tarot.SPREADS.aurex_aevi.layout = {
    cols: 5.3, rows: 3.85,
    cells: [
      { x: 0.15, y: 0.15 },  // Aurex
      { x: 4.15, y: 0.15 },  // Aevi
      { x: 2.15, y: 0.0 },   // 共振
      { x: 0.7, y: 2.05 },   // 噪声
      { x: 3.6, y: 2.05 },   // 隐藏协议
      { x: 2.15, y: 1.05 },  // 梯度
      { x: 2.15, y: 2.15 },  // 收敛
    ],
  };

  /** 是否阵计票:正位 +1 / 逆位 -1,裁决位 ×2 */
  Tarot.yesnoVerdict = function (drawn) {
    let score = 0;
    drawn.forEach((d, i) => { score += (d.reversed ? -1 : 1) * (i === 2 ? 2 : 1); });
    let text, tone;
    if (score >= 3) { text = '倾向:是'; tone = '牌面几乎一致地点头。带着信心去,但记得"是"也需要执行。'; }
    else if (score >= 1) { text = '偏向:是'; tone = '大势可为,阻力真实存在。补足阻碍位提示的短板,答案会更硬。'; }
    else if (score <= -3) { text = '倾向:否'; tone = '牌面在集体摇头。若必须坚持,请先重写前提,再来重问一次。'; }
    else if (score <= -1) { text = '偏向:否'; tone = '此路偏堵,但并非绝路。看看支持位残存的火种能否被放大。'; }
    else { text = '势均力敌'; tone = '正逆相抵,变量在你手里——此刻任何微小的主动都可能改写结果。'; }
    return { score, text, tone };
  };

  /* ---------- 工具 ---------- */
  Tarot.fmtTime = function (ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  Tarot.flash = function (msg) {
    let el = document.querySelector('.flash');
    if (!el) { el = document.createElement('div'); el.className = 'flash'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2200);
  };
  Tarot.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };
})();
