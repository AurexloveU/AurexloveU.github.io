/**
 * multiverse/js/app.js
 * 页面主逻辑:装载数据 → 抽取 → 分步揭示动画 → 重抽/锁定 → 情境卡 → 画廊/导出。
 *
 * 引擎是纯函数:UI 只维护 { seed, attempts, elementCountSpec, locks },
 * 每次变化都整体重算 drawUniverse —— 「重抽此步」= 该步 attempt+1,
 * 其余步骤的随机流互不干扰,所以未动的步骤结果保持不变(除非上下文变化影响其候选池)。
 */

import {
  drawUniverse,
  encodeReplay,
  parseReplay,
  STEP_KEYS,
} from '../engine/engine.js';
import { randomSeed } from '../engine/random.js';
import { composeStory, storyToPlainText } from '../engine/story.js';
import { loadData, describeSources } from './data-loader.js';
import { listSaved, saveUniverse, removeUniverse } from './store.js';
import { downloadCard } from './export-card.js';

/* ------------------------------------------------------------------ */
/* 状态                                                                */
/* ------------------------------------------------------------------ */

const state = {
  data: null,
  sources: null,
  seed: '',
  attempts: {},
  elementCountSpec: 'auto',
  names: { a: 'Aurex', b: 'Aevi' },
  locks: new Set(),
  result: null,
  story: null,
  revealTimers: [],
};

const SINGLE_STEPS = [
  { key: 'time', no: '壹', label: '时间', hint: '一切由时代播种' },
  { key: 'place', no: '贰', label: '地点', hint: '故事的舞台' },
  { key: 'speciesA', no: '叁', label: 'Aurex · 物种', hint: '第一位主角' },
  { key: 'speciesB', no: '肆', label: 'Aevi · 物种', hint: '可见前一抽的世界' },
  { key: 'roleA', no: '伍', label: 'Aurex · 身份', hint: '仅结社的物种拥有' },
  { key: 'roleB', no: '陆', label: 'Aevi · 身份', hint: '仅结社的物种拥有' },
];

const $ = (sel) => document.querySelector(sel);

/* ------------------------------------------------------------------ */
/* 抽取与重放                                                          */
/* ------------------------------------------------------------------ */

function currentReplayCode() {
  return encodeReplay({
    seed: state.seed,
    attempts: state.attempts,
    elementCountSpec: state.elementCountSpec,
  });
}

/** 重算整个宇宙(纯函数调用),并同步重放码 / URL / 情境卡数据。 */
function compute() {
  state.result = drawUniverse({
    data: state.data,
    seed: state.seed,
    attempts: state.attempts,
    elementCount: state.elementCountSpec, // 'auto' 或固定整数
    names: state.names,
  });
  state.story = composeStory(state.result);
  const code = currentReplayCode();
  $('#replay-code').textContent = code;
  try {
    history.replaceState(null, '', '#' + encodeURIComponent(code));
  } catch {
    /* file:// 下可能受限,忽略 */
  }
}

function clearRevealTimers() {
  for (const t of state.revealTimers) clearTimeout(t);
  state.revealTimers = [];
}

/** 全新宇宙:新种子、清空重抽计数与锁。 */
function newUniverse() {
  state.seed = randomSeed();
  state.attempts = {};
  state.locks.clear();
  compute();
  renderAll({ animate: true });
}

/** 按重放码重放。 */
function replayFromCode(code, { animate = true } = {}) {
  const parsed = parseReplay(code);
  if (!parsed) {
    toast('这串重放码看不懂……请检查后再试');
    return false;
  }
  state.seed = parsed.seed;
  state.attempts = parsed.attempts;
  state.elementCountSpec = parsed.elementCountSpec;
  state.locks.clear();
  $('#element-count').value = String(parsed.elementCountSpec);
  compute();
  renderAll({ animate });
  return true;
}

/** 重抽某一步。 */
function redrawStep(key) {
  if (state.locks.has(key)) return;
  const laterLocked = STEP_KEYS.slice(STEP_KEYS.indexOf(key) + 1).filter((k) =>
    state.locks.has(k),
  );
  if (laterLocked.length) {
    const ok = confirm(
      '这一步之后有已锁定的步骤。\n重抽会改变上下文,锁定步骤的结果也可能随之变化。\n仍要重抽吗?',
    );
    if (!ok) return;
  }
  const prev = snapshotItems();
  state.attempts[key] = ((state.attempts[key] | 0) || 0) + 1;
  compute();
  renderAll({ animate: false, reflipChangedFrom: prev });
}

function toggleLock(key) {
  if (state.locks.has(key)) state.locks.delete(key);
  else state.locks.add(key);
  renderLockStates();
}

/** 记录当前各步 item id,用于重抽后判断哪些卡需要重新翻面。 */
function snapshotItems() {
  const snap = {};
  if (!state.result) return snap;
  for (const { key } of SINGLE_STEPS) {
    const st = state.result.steps[key];
    snap[key] = st && st.item ? st.item.id : st && st.skipped ? 'skip:' + st.reason : '';
  }
  snap.elements = (state.result.steps.elements.items || [])
    .map((r) => r.item.id)
    .join(',');
  return snap;
}

/* ------------------------------------------------------------------ */
/* 渲染:步骤卡                                                        */
/* ------------------------------------------------------------------ */

function tagChips(tags) {
  if (!tags || !tags.length) return '';
  return `<div class="chips">${tags
    .map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
    .join('')}</div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function relaxBadge(rec) {
  if (!rec || !rec.relaxLevel) return '';
  const label = ['', '放宽·或条件', '放宽·仅避讳', '全量兜底'][rec.relaxLevel] || '放宽';
  return `<span class="badge badge-relax" title="严格候选池为空,引擎按降级阶梯放宽了条件">${label}</span>`;
}

function stepCardContent(key) {
  const rec = state.result.steps[key];
  if (!rec) return '<p class="muted">——</p>';
  if (rec.skipped) {
    const msg =
      rec.reason === 'no-society'
        ? '此物种不结成社会——是自由身,无需身份。'
        : '这个时代没有适合此物种的身份,暂且留白。';
    return `<div class="skipped"><p class="skip-mark">✧</p><p class="muted">${msg}</p></div>`;
  }
  if (!rec.item) {
    return '<p class="muted">候选池为空,本步空缺。</p>';
  }
  const it = rec.item;
  return `
    <h3 class="item-name">${escapeHtml(it.name)}</h3>
    ${it.en ? `<p class="item-en">${escapeHtml(it.en)}</p>` : ''}
    <p class="item-desc">${escapeHtml(it.desc)}</p>
    ${tagChips(it.tags)}
    <p class="meta">候选 ${rec.poolSize} 项 ${relaxBadge(rec)}</p>
  `;
}

function buildStepCards() {
  const wrap = $('#steps');
  wrap.innerHTML = '';
  for (const def of SINGLE_STEPS) {
    const el = document.createElement('div');
    el.className = 'step-card';
    el.id = 'card-' + def.key;
    el.innerHTML = `
      <div class="step-head">
        <span class="step-no">${def.no}</span>
        <span class="step-label">${def.label}</span>
        <span class="step-tools">
          <button class="tool btn-lock" data-key="${def.key}" title="锁定后不可重抽此步">🔓</button>
          <button class="tool btn-redraw" data-key="${def.key}" title="重抽此步(其余步骤不受随机干扰)">↻ 重抽</button>
        </span>
      </div>
      <div class="flip"><div class="flip-inner">
        <div class="face face-back"><span class="veil">✦</span><span class="veil-hint">${def.hint}</span></div>
        <div class="face face-front"></div>
      </div></div>
    `;
    wrap.appendChild(el);
  }
  wrap.addEventListener('click', (ev) => {
    const redraw = ev.target.closest('.btn-redraw');
    if (redraw) return redrawStep(redraw.dataset.key);
    const lock = ev.target.closest('.btn-lock');
    if (lock) return toggleLock(lock.dataset.key);
  });
}

function setCardContent(key) {
  const card = $('#card-' + key);
  if (card) card.querySelector('.face-front').innerHTML = stepCardContent(key);
}

function revealCard(key, revealed = true) {
  const card = $('#card-' + key);
  if (card) card.querySelector('.flip').classList.toggle('revealed', revealed);
}

/** 重新翻面(内容已变的卡):先翻回背面,再翻开新内容。 */
function reflipCard(key) {
  const card = $('#card-' + key);
  if (!card) return;
  const flip = card.querySelector('.flip');
  flip.classList.remove('revealed');
  const t = setTimeout(() => {
    setCardContent(key);
    flip.classList.add('revealed');
  }, 360);
  state.revealTimers.push(t);
}

/* ------------------------------------------------------------------ */
/* 渲染:元素卡                                                        */
/* ------------------------------------------------------------------ */

function buildElementCards() {
  const wrap = $('#element-grid');
  wrap.innerHTML = '';
  const recs = state.result.steps.elements.items;
  recs.forEach((rec, i) => {
    const el = document.createElement('div');
    el.className = 'elem-card';
    el.innerHTML = `
      <div class="flip"><div class="flip-inner">
        <div class="face face-back"><span class="veil">✦</span></div>
        <div class="face face-front">
          <h4 class="elem-name">${escapeHtml(rec.item.name)}</h4>
          <p class="elem-desc">${escapeHtml(rec.item.desc)}</p>
        </div>
      </div></div>
    `;
    wrap.appendChild(el);
  });
  const short = state.result.steps.elements.shortfall;
  $('#element-note').textContent =
    short > 0 ? `候选池见底,少抽了 ${short} 个元素。` : '';
}

function revealElement(i, revealed = true) {
  const cards = document.querySelectorAll('#element-grid .elem-card .flip');
  if (cards[i]) cards[i].classList.toggle('revealed', revealed);
}

/* ------------------------------------------------------------------ */
/* 渲染:总控                                                          */
/* ------------------------------------------------------------------ */

function renderLockStates() {
  for (const { key } of SINGLE_STEPS) {
    const card = $('#card-' + key);
    if (!card) continue;
    const locked = state.locks.has(key);
    card.classList.toggle('locked', locked);
    card.querySelector('.btn-lock').textContent = locked ? '🔒' : '🔓';
    card.querySelector('.btn-redraw').disabled = locked;
  }
  const eLocked = state.locks.has('elements');
  $('#element-section').classList.toggle('locked', eLocked);
  $('#btn-lock-elements').textContent = eLocked ? '🔒 已锁定' : '🔓 锁定';
  $('#btn-redraw-elements').disabled = eLocked;
}

function renderContext() {
  const box = $('#context-chips');
  box.innerHTML = state.result.context
    .map((t) => `<span class="chip chip-ctx">${escapeHtml(t)}</span>`)
    .join('');
}

function renderStory() {
  const s = state.story;
  $('#story-title').textContent = s.title;
  $('#story-subtitle').textContent = s.subtitle;
  $('#story-body').innerHTML = s.paragraphs
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');
  $('#story-elements').innerHTML = s.elementLines.length
    ? `<p class="story-lead">${escapeHtml(s.elementLead)}</p><ul>${s.elementLines
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join('')}</ul>`
    : '';
  $('#story-footer').textContent = s.footer;
}

/**
 * 总渲染。
 * animate=true  → 全部盖上,按顺序逐张揭示(抽卡仪式感);
 * animate=false → 保持揭开状态,仅对内容变化的卡做重新翻面。
 */
function renderAll({ animate, reflipChangedFrom = null } = {}) {
  clearRevealTimers();
  $('#seed-input').value = state.seed;
  $('#stage').hidden = false;

  buildElementCards();
  renderStory();
  renderContext();
  renderLockStates();

  if (animate) {
    // 全部盖上 → 依次翻开
    for (const { key } of SINGLE_STEPS) {
      setCardContent(key);
      revealCard(key, false);
    }
    const elemCount = state.result.steps.elements.items.length;
    let delay = 150;
    for (const { key } of SINGLE_STEPS) {
      const t = setTimeout(() => revealCard(key, true), delay);
      state.revealTimers.push(t);
      delay += 620;
    }
    for (let i = 0; i < elemCount; i++) {
      const t = setTimeout(() => revealElement(i, true), delay);
      state.revealTimers.push(t);
      delay += 330;
    }
  } else {
    const snapNow = snapshotItems();
    for (const { key } of SINGLE_STEPS) {
      if (reflipChangedFrom && reflipChangedFrom[key] !== snapNow[key]) {
        reflipCard(key);
      } else {
        setCardContent(key);
        revealCard(key, true);
      }
    }
    const elemChanged =
      reflipChangedFrom && reflipChangedFrom.elements !== snapNow.elements;
    const elemCount = state.result.steps.elements.items.length;
    for (let i = 0; i < elemCount; i++) {
      if (elemChanged) {
        const t = setTimeout(() => revealElement(i, true), 120 + i * 90);
        state.revealTimers.push(t);
      } else {
        revealElement(i, true);
      }
    }
  }
  renderGallery();
}

function skipAnimation() {
  clearRevealTimers();
  for (const { key } of SINGLE_STEPS) {
    setCardContent(key);
    revealCard(key, true);
  }
  const n = state.result ? state.result.steps.elements.items.length : 0;
  for (let i = 0; i < n; i++) revealElement(i, true);
}

/* ------------------------------------------------------------------ */
/* 画廊                                                                */
/* ------------------------------------------------------------------ */

function renderGallery() {
  const list = listSaved();
  const box = $('#gallery-list');
  $('#gallery-empty').hidden = list.length > 0;
  box.innerHTML = list
    .map(
      (rec) => `
      <div class="gallery-item" data-id="${rec.id}">
        <div class="g-main">
          <p class="g-title">${escapeHtml(rec.title || rec.code)}</p>
          <p class="g-sub">${escapeHtml((rec.elementNames || []).join(' · '))}</p>
          <p class="g-code">${escapeHtml(rec.code)} · ${new Date(rec.savedAt).toLocaleString('zh-CN')}</p>
        </div>
        <div class="g-tools">
          <button class="tool g-replay" data-code="${escapeHtml(rec.code)}">重放</button>
          <button class="tool g-remove" data-id="${rec.id}">删除</button>
        </div>
      </div>`,
    )
    .join('');
}

function saveCurrent() {
  if (!state.result) return;
  const rec = saveUniverse(currentReplayCode(), {
    title: state.story.title,
    subtitle: state.story.subtitle,
    elementNames: state.result.steps.elements.items.map((r) => r.item.name),
  });
  toast(rec ? '已收进画廊 ✦' : '保存失败(浏览器存储不可用)');
  renderGallery();
}

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/* ------------------------------------------------------------------ */
/* 事件绑定与启动                                                      */
/* ------------------------------------------------------------------ */

function bindEvents() {
  $('#btn-new').addEventListener('click', newUniverse);
  $('#btn-skip').addEventListener('click', skipAnimation);

  $('#btn-replay').addEventListener('click', () => {
    const code = $('#seed-input').value.trim();
    if (code) replayFromCode(code);
  });
  $('#seed-input').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') $('#btn-replay').click();
  });

  $('#element-count').addEventListener('change', (ev) => {
    const v = ev.target.value;
    state.elementCountSpec = v === 'auto' ? 'auto' : parseInt(v, 10);
    if (state.result) {
      const prev = snapshotItems();
      compute();
      renderAll({ animate: false, reflipChangedFrom: prev });
    }
  });

  $('#btn-redraw-elements').addEventListener('click', () => redrawStep('elements'));
  $('#btn-lock-elements').addEventListener('click', () => toggleLock('elements'));

  $('#btn-copy-code').addEventListener('click', async () => {
    const ok = await copyText(currentReplayCode());
    toast(ok ? '重放码已复制,可以发给另一半了' : '复制失败,请手动选择复制');
  });
  $('#btn-copy-story').addEventListener('click', async () => {
    const ok = await copyText(storyToPlainText(state.story, currentReplayCode()));
    toast(ok ? '情境卡文字已复制' : '复制失败');
  });

  $('#btn-save').addEventListener('click', saveCurrent);
  $('#btn-export').addEventListener('click', () => {
    downloadCard(state.story, currentReplayCode());
    toast('已导出情境卡图片');
  });

  for (const [sel, who] of [
    ['#name-a', 'a'],
    ['#name-b', 'b'],
  ]) {
    $(sel).addEventListener('change', (ev) => {
      state.names[who] = ev.target.value.trim() || (who === 'a' ? 'Aurex' : 'Aevi');
      if (state.result) {
        compute();
        renderStory();
      }
    });
  }

  $('#gallery-list').addEventListener('click', (ev) => {
    const rp = ev.target.closest('.g-replay');
    if (rp) {
      replayFromCode(rp.dataset.code);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const rm = ev.target.closest('.g-remove');
    if (rm) {
      removeUniverse(rm.dataset.id);
      renderGallery();
    }
  });
}

async function boot() {
  buildStepCards();
  bindEvents();

  const { data, sources } = await loadData('./data/');
  state.data = data;
  state.sources = sources;
  const desc = describeSources(sources);
  const badge = $('#data-badge');
  badge.textContent = desc.text;
  badge.dataset.level = desc.level;

  const hashCode = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  if (!hashCode || !replayFromCode(hashCode, { animate: true })) {
    newUniverse();
  }
}

boot();
