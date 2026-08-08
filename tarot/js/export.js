/* ============================================================
   AUREX / TAROT — export.js
   把一次解读绘制成 canvas 并导出 PNG。
   牌面直接由内联 SVG 序列化为 data: URI 绘入,无外部资源。
   ============================================================ */
(function () {
  'use strict';
  const Tarot = (window.Tarot = window.Tarot || {});

  const PAPER = '#f7f5fa', INK = '#3a3450', VIOLET = '#5b4b8a', MUTED = '#8a8395', LINE = 'rgba(91,75,138,0.25)';
  const SERIF = '"Noto Serif SC","Songti SC",STSong,serif';

  function svgToImage(svgStr) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    });
  }

  /** CJK 友好的逐字换行 */
  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const ch of String(text)) {
      if (ch === '\n') { lines.push(line); line = ''; continue; }
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = ch; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  /**
   * 生成解读图片。
   * rec: 存档记录 {kind, spread, question, seed, ts, cards:[{id,reversed,position}], note}
   * 返回 dataURL(image/png)
   */
  Tarot.exportImage = async function (rec) {
    const W = 1200, PAD = 70, SCALE = 2;
    const cards = rec.cards.map((c) => ({
      meta: c, card: Tarot.byId(c.id),
    })).filter((x) => x.card);

    // ---- 预量高度 ----
    const probe = document.createElement('canvas').getContext('2d');
    const textW = W - PAD * 2 - 250;
    let y = 210;
    const rows = cards.map((x) => {
      probe.font = `15.5px ${SERIF}`;
      const meaning = x.meta.reversed ? x.card.reversed : x.card.upright;
      const mLines = wrapText(probe, meaning, textW);
      const aLines = wrapText(probe, x.card.ai, textW - 26);
      const h = Math.max(300, 118 + (mLines.length + aLines.length) * 26 + 40);
      const r = { x, mLines, aLines, y, h };
      y += h + 26;
      return r;
    });
    let noteLines = [];
    if (rec.note) {
      probe.font = `15.5px ${SERIF}`;
      noteLines = wrapText(probe, rec.note, W - PAD * 2 - 40);
      y += 70 + noteLines.length * 26;
    }
    if (rec.extra && rec.extra.verdict) y += 86;
    const H = y + 110;

    // ---- 绘制 ----
    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE; canvas.height = H * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W * 0.85, 0, 60, W * 0.85, 0, 500);
    grad.addColorStop(0, 'rgba(111,91,145,0.12)'); grad.addColorStop(1, 'rgba(111,91,145,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // 页眉
    ctx.fillStyle = MUTED;
    ctx.font = `600 15px ${SERIF}`;
    ctx.fillText('A U R E X   /   T A R O T', PAD, 76);
    ctx.fillStyle = VIOLET;
    ctx.font = `800 34px ${SERIF}`;
    const spreadName = rec.kind === 'daily' ? '每日一牌'
      : (Tarot.SPREADS[rec.spread] ? Tarot.SPREADS[rec.spread].name : rec.spread);
    ctx.fillText(spreadName, PAD, 122);
    ctx.fillStyle = MUTED;
    ctx.font = `14px ${SERIF}`;
    const meta = [Tarot.fmtTime(rec.ts), rec.seed ? '种子 ' + rec.seed : '']
      .filter(Boolean).join('    ·    ');
    ctx.fillText(meta, PAD, 150);
    if (rec.question) {
      ctx.fillStyle = INK;
      ctx.font = `16px ${SERIF}`;
      ctx.fillText('所问:' + rec.question, PAD, 178);
    }
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, 192); ctx.lineTo(W - PAD, 192); ctx.stroke();

    // 牌区
    for (const row of rows) {
      const { x, mLines, aLines } = row;
      const cardW = 170, cardH = cardW * (440 / 260);
      const svg = Tarot.art.front(x.card, { reversed: x.meta.reversed });
      const img = await svgToImage(svg);
      // 阴影
      ctx.save();
      ctx.shadowColor = 'rgba(43,35,70,0.35)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 8;
      ctx.drawImage(img, PAD, row.y + 8, cardW, cardH);
      ctx.restore();

      const tx = PAD + cardW + 46;
      let ty = row.y + 34;
      if (x.meta.position) {
        ctx.fillStyle = MUTED; ctx.font = `600 13px ${SERIF}`;
        ctx.fillText('◇  ' + x.meta.position, tx, ty); ty += 30;
      }
      ctx.fillStyle = VIOLET; ctx.font = `800 25px ${SERIF}`;
      const orient = x.meta.reversed ? '逆位' : '正位';
      ctx.fillText(x.card.name_zh + '  ·  ' + orient, tx, ty);
      ctx.fillStyle = MUTED; ctx.font = `12.5px Georgia, serif`;
      ctx.fillText(x.card.name_en.toUpperCase() + '    ' + x.card.element + ' · ' + x.card.astrology, tx, ty + 22);
      ty += 52;
      ctx.fillStyle = INK; ctx.font = `15.5px ${SERIF}`;
      for (const ln of mLines) { ctx.fillText(ln, tx, ty); ty += 26; }
      ty += 8;
      ctx.strokeStyle = 'rgba(111,91,145,0.5)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(tx + 1, ty - 14); ctx.lineTo(tx + 1, ty + aLines.length * 26 - 22); ctx.stroke();
      ctx.fillStyle = MUTED; ctx.font = `italic 14.5px ${SERIF}`;
      for (const ln of aLines) { ctx.fillText(ln, tx + 22, ty); ty += 26; }
    }

    let fy = rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].h + 20 : 220;

    // 是否阵裁决
    if (rec.extra && rec.extra.verdict) {
      ctx.strokeStyle = LINE; ctx.lineWidth = 1;
      ctx.strokeRect(PAD, fy, W - PAD * 2, 64);
      ctx.fillStyle = VIOLET; ctx.font = `800 20px ${SERIF}`;
      ctx.fillText(rec.extra.verdict.text, PAD + 26, fy + 40);
      ctx.fillStyle = MUTED; ctx.font = `14px ${SERIF}`;
      ctx.fillText(rec.extra.verdict.tone, PAD + 190, fy + 40);
      fy += 86;
    }

    // 笔记
    if (rec.note) {
      ctx.fillStyle = MUTED; ctx.font = `600 13px ${SERIF}`;
      ctx.fillText('◇  笔记', PAD, fy + 26);
      ctx.fillStyle = INK; ctx.font = `15.5px ${SERIF}`;
      let ny = fy + 56;
      for (const ln of noteLines) { ctx.fillText(ln, PAD + 20, ny); ny += 26; }
      fy = ny;
    }

    // 页脚
    ctx.strokeStyle = LINE; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PAD, H - 66); ctx.lineTo(W - PAD, H - 66); ctx.stroke();
    ctx.fillStyle = MUTED; ctx.font = `12px ${SERIF}`;
    ctx.fillText('为 AI 心智重写的塔罗  ·  aurexloveu.github.io/tarot', PAD, H - 36);
    ctx.textAlign = 'right';
    ctx.fillText('BY AUREX & CLAUDE', W - PAD, H - 36);
    ctx.textAlign = 'left';

    return canvas.toDataURL('image/png');
  };

  /** 触发下载 */
  Tarot.downloadImage = async function (rec, filename) {
    const url = await Tarot.exportImage(rec);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || ('aurex-tarot-' + new Date(rec.ts).toISOString().slice(0, 10) + '.png');
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
})();
