/**
 * multiverse/js/export-card.js
 * 把情境卡绘制到 canvas 并导出 PNG。
 * 纯前端、无外链资源;字体走系统衬线栈,与页面主题一致的低饱和薰衣草配色。
 */

const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, "SimSun", serif';

const C = {
  bgTop: '#f7f5fa',
  bgBottom: '#ece7f4',
  frame: '#b9aed2',
  ink: '#3d3651',
  soft: '#7a6f9b',
  faint: '#a49bc0',
  rule: '#d8d0e8',
};

/** 中文友好的逐字换行(CJK 无空格,按字符宽度折行)。 */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = wrapText(ctx, text, maxWidth);
  for (const l of lines) {
    ctx.fillText(l, x, y);
    y += lineHeight;
  }
  return y;
}

/**
 * story: composeStory 的返回值;replayCode: 印在卡片底部。
 * 返回已绘制完成的 canvas(高度按内容自适应)。
 */
export function renderCardCanvas(story, replayCode) {
  const W = 1080;
  const PAD = 84;
  const contentW = W - PAD * 2;

  /* 先用一块量尺 canvas 计算总高度 */
  const measure = document.createElement('canvas').getContext('2d');
  let h = 0;
  const bodyFont = `30px ${SERIF}`;
  const bodyLH = 50;

  measure.font = bodyFont;
  h += 190; // 头部:标题 + 副题 + 分隔符
  for (const p of story.paragraphs) {
    h += wrapText(measure, p, contentW).length * bodyLH + 22;
  }
  if (story.elementLines.length) {
    h += 56; // 元素引言
    measure.font = `28px ${SERIF}`;
    for (const l of story.elementLines) {
      h += wrapText(measure, '· ' + l, contentW - 24).length * 44 + 8;
    }
  }
  h += 170; // 尾声 + 重放码 + 下边距
  const H = Math.max(760, Math.ceil(h) + PAD);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  /* 背景:纵向薰衣草渐变 + 双线框 */
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, C.bgTop);
  grad.addColorStop(1, C.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = C.frame;
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, W - 56, H - 56);
  ctx.lineWidth = 1;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  /* 四角饰星 */
  ctx.fillStyle = C.faint;
  ctx.font = `26px ${SERIF}`;
  ctx.textAlign = 'center';
  for (const [sx, sy] of [[40, 52], [W - 40, 52], [40, H - 32], [W - 40, H - 32]]) {
    ctx.fillText('✦', sx, sy);
  }

  /* 头部 */
  let y = PAD + 46;
  ctx.fillStyle = C.ink;
  ctx.font = `600 46px ${SERIF}`;
  ctx.fillText(story.title, W / 2, y);
  y += 52;
  ctx.fillStyle = C.soft;
  ctx.font = `26px ${SERIF}`;
  ctx.fillText(story.subtitle, W / 2, y);
  y += 44;
  ctx.fillStyle = C.faint;
  ctx.fillText('— ✦ —', W / 2, y);
  y += 56;

  /* 正文段落 */
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = bodyFont;
  for (const p of story.paragraphs) {
    y = drawParagraph(ctx, p, PAD, y, contentW, bodyLH) + 22;
  }

  /* 元素清单 */
  if (story.elementLines.length) {
    ctx.fillStyle = C.soft;
    ctx.font = `600 28px ${SERIF}`;
    ctx.fillText(story.elementLead, PAD, y);
    y += 48;
    ctx.font = `28px ${SERIF}`;
    ctx.fillStyle = C.ink;
    for (const l of story.elementLines) {
      y = drawParagraph(ctx, '· ' + l, PAD + 12, y, contentW - 24, 44) + 8;
    }
    y += 16;
  }

  /* 尾声 */
  ctx.strokeStyle = C.rule;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 46;
  ctx.fillStyle = C.soft;
  ctx.font = `italic 28px ${SERIF}`;
  y = drawParagraph(ctx, story.footer, PAD, y, contentW, 46) + 18;

  /* 重放码 */
  ctx.textAlign = 'center';
  ctx.fillStyle = C.faint;
  ctx.font = `22px ${SERIF}`;
  ctx.fillText(`[重放码] ${replayCode}`, W / 2, Math.min(y + 12, H - 58));

  return canvas;
}

/** 触发浏览器下载。 */
export function downloadCard(story, replayCode) {
  const canvas = renderCardCanvas(story, replayCode);
  const a = document.createElement('a');
  a.download = `multiverse-${String(replayCode).replace(/[^\w一-鿿-]+/g, '_')}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}
