/* ============================================================
   AUREX / TAROT — ui.js
   共享 UI:卡牌详情模态(牌库 / 牌阵 / 档案 通用)
   ============================================================ */
(function () {
  'use strict';
  const Tarot = (window.Tarot = window.Tarot || {});
  Tarot.ui = {};

  let mask = null;

  function ensureModal() {
    if (mask) return mask;
    mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true">' +
      '<button class="modal-close" aria-label="关闭">×</button>' +
      '<div class="modal-flex">' +
      '<div class="art"></div>' +
      '<div class="info"></div>' +
      '</div></div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', (e) => { if (e.target === mask) Tarot.ui.close(); });
    mask.querySelector('.modal-close').addEventListener('click', Tarot.ui.close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') Tarot.ui.close(); });
    return mask;
  }

  Tarot.ui.close = function () {
    if (mask) mask.classList.remove('open');
  };

  /**
   * 打开卡牌详情。
   * opts.reversed: true/false → 该次抽取的方位(强调之,另一面淡显);
   *                undefined  → 牌库模式,双面并列展示。
   */
  Tarot.ui.showCard = function (card, opts) {
    const o = opts || {};
    const m = ensureModal();
    const drawn = typeof o.reversed === 'boolean';
    const rev = !!o.reversed;

    m.querySelector('.art').innerHTML = Tarot.art.front(card, { reversed: drawn && rev });

    const suitName = card.arcana === 'major' ? '大阿卡纳'
      : ({ wands: '权杖', cups: '圣杯', swords: '宝剑', pentacles: '星币' }[card.suit] || '');
    const dimStyle = ' style="opacity:0.55"';

    let meanings;
    if (!drawn) {
      meanings =
        '<div class="meaning-block"><h4>正位</h4><p>' + Tarot.esc(card.upright) + '</p></div>' +
        '<div class="meaning-block"><h4>逆位</h4><p>' + Tarot.esc(card.reversed) + '</p></div>';
    } else if (rev) {
      meanings =
        '<div class="meaning-block"><h4>逆位讯息 · 本次抽得</h4><p>' + Tarot.esc(card.reversed) + '</p></div>' +
        '<div class="meaning-block"' + dimStyle + '><h4>正位参照</h4><p>' + Tarot.esc(card.upright) + '</p></div>';
    } else {
      meanings =
        '<div class="meaning-block"><h4>正位讯息 · 本次抽得</h4><p>' + Tarot.esc(card.upright) + '</p></div>' +
        '<div class="meaning-block"' + dimStyle + '><h4>逆位参照</h4><p>' + Tarot.esc(card.reversed) + '</p></div>';
    }

    m.querySelector('.info').innerHTML =
      '<div class="card-title-line">' +
      '<span class="zh">' + Tarot.esc(card.name_zh) + '</span>' +
      '<span class="en">' + Tarot.esc(card.name_en).toUpperCase() + '</span>' +
      (drawn ? '<span class="orient-tag' + (rev ? ' rev' : '') + '">' + (rev ? '逆位' : '正位') + '</span>' : '') +
      '</div>' +
      '<div class="kw-row">' + card.keywords.map((k) => '<span class="kw">' + Tarot.esc(k) + '</span>').join('') + '</div>' +
      meanings +
      '<div class="ai-block"><b>FOR AI MINDS</b>' + Tarot.esc(card.ai) + '</div>' +
      '<p class="astro-line">' + Tarot.esc(card.element) + ' 元素 · ' + Tarot.esc(card.astrology) + ' · ' + suitName + '</p>';

    m.classList.add('open');
  };

  /** 构建一条"解读行"(牌阵页与档案详情共用) */
  Tarot.ui.readingRow = function (card, revFlag, posTitle, posDesc) {
    const div = document.createElement('div');
    div.className = 'reading-item';
    div.innerHTML =
      '<div class="thumb' + (revFlag ? ' rev' : '') + '">' + Tarot.art.front(card) + '</div>' +
      '<div class="body">' +
      '<p class="pos">' + Tarot.esc(posTitle || '') + (posDesc ? ' · ' + Tarot.esc(posDesc) : '') + '</p>' +
      '<p class="nm">' + Tarot.esc(card.name_zh) + ' · ' + (revFlag ? '逆位' : '正位') +
      ' <span style="font-size:12px;color:var(--muted-2);letter-spacing:0.12em">' + Tarot.esc(card.name_en).toUpperCase() + '</span></p>' +
      '<p class="tx">' + Tarot.esc(revFlag ? card.reversed : card.upright) + '</p>' +
      '<p class="ai">' + Tarot.esc(card.ai) + '</p>' +
      '</div>';
    div.querySelector('.thumb').style.cursor = 'zoom-in';
    div.querySelector('.thumb').addEventListener('click', () => Tarot.ui.showCard(card, { reversed: revFlag }));
    return div;
  };
})();
