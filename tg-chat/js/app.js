/* =========================================================
   Aurex Chat — 主控制器
   依赖(按加载顺序):EMOJI, AeviBot, Seed, Store, Net
   ========================================================= */
(() => {
'use strict';

/* ================= 工具 ================= */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const p2 = n => String(n).padStart(2, '0');
const pick = a => a[Math.floor(Math.random() * a.length)];

const AV = Seed.AV_COLORS;
const SENDER_COLORS = ['#c94f4f', '#2f80c0', '#3aa76d', '#8253c9', '#d45a9e', '#c07b2f', '#4b9aa8', '#7d8a3f'];

function fmtTime(ts) { const d = new Date(ts); return p2(d.getHours()) + ':' + p2(d.getMinutes()); }
function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
function fmtDay(ts) {
  const d = new Date(ts), now = new Date();
  if (dayKey(ts) === dayKey(now.getTime())) return '今天';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (dayKey(ts) === dayKey(y.getTime())) return '昨天';
  const s = (d.getMonth() + 1) + '月' + d.getDate() + '日';
  return d.getFullYear() === now.getFullYear() ? s : d.getFullYear() + '年' + s;
}
function fmtListTime(ts) {
  const d = new Date(ts), now = new Date();
  if (dayKey(ts) === dayKey(now.getTime())) return fmtTime(ts);
  const diff = (now - d) / 864e5;
  if (diff < 7) return '周' + '日一二三四五六'[d.getDay()];
  const s = (d.getMonth() + 1) + '/' + d.getDate();
  return d.getFullYear() === now.getFullYear() ? s : d.getFullYear() + '/' + s;
}
function fmtLastSeen(ts) {
  if (!ts) return '最近上线';
  const now = new Date();
  if (dayKey(ts) === dayKey(now.getTime())) return '上次上线于今天 ' + fmtTime(ts);
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (dayKey(ts) === dayKey(y.getTime())) return '上次上线于昨天 ' + fmtTime(ts);
  return '上次上线于 ' + fmtDay(ts);
}

/* ---- 原创内联图标(描边风格) ---- */
const svgw = (p, w) =>
  `<svg viewBox="0 0 24 24" style="fill:none" stroke="currentColor" stroke-width="${w || 1.8}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC = {
  reply:   svgw('<path d="M9 14 4 9.5 9 5"/><path d="M4 9.5h10a6 6 0 0 1 6 6V19"/>'),
  forward: svgw('<path d="m15 5 5 4.5-5 4.5"/><path d="M20 9.5H10a6 6 0 0 0-6 6V19"/>'),
  copy:    svgw('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  pin:     svgw('<path d="M12 16v6"/><path d="M8.5 3.5h7L14.5 10l3.5 3.5v2.5H6V13.5L9.5 10z"/>'),
  edit:    svgw('<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="m14 6 4 4"/>'),
  trash:   svgw('<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="m6 7 1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>'),
  check:   svgw('<path d="m4 12.5 5 5L20 6.5"/>'),
  search:  svgw('<circle cx="10.5" cy="10.5" r="6"/><path d="m15.5 15.5 5 5"/>'),
  close:   svgw('<path d="m6 6 12 12M18 6 6 18"/>')
};
const TICK = {
  sending: `<svg viewBox="0 0 24 24" style="fill:none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l2.8 1.8"/></svg>`,
  sent:    `<svg viewBox="0 0 24 24" style="fill:none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 4.5 4.5L19 7"/></svg>`,
  read:    `<svg viewBox="0 0 24 24" style="fill:none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 12.5 4 4L15 8"/><path d="m11.5 15.5 1.5 1.5L21.5 8.5"/></svg>`
};
const PIN_MINI = `<svg class="badge-ic" viewBox="0 0 24 24" style="fill:none" stroke="currentColor" stroke-width="2"><path d="M12 16v6"/><path d="M8.5 3.5h7L14.5 10l3.5 3.5v2.5H6V13.5L9.5 10z"/></svg>`;
const BOT_BADGE = `<svg class="badge-ic" viewBox="0 0 24 24"><path d="M12 2 14.5 9h7.5l-6 4.5 2.3 7.2L12 16.4 5.7 20.7 8 13.5l-6-4.5h7.5z"/></svg>`;

/* ================= 状态 ================= */
let S = Store.load();
const el = {};
['sidebar','sbSettingsBtn','chatSearch','chatSearchClear','themeBtn','chatList','connDot','connText',
 'chatPane','emptyState','chatView','backBtn','hAvatar','hInfo','hTitle','hSub','hSearchBtn','hMoreBtn',
 'msgSearch','msIn','msCount','msUp','msDown','msClose','pinBar','pinLabel','pinText','pinClose',
 'msgScroll','msgList','jumpBtn','jumpBadge','composer','composeBanner','emojiBtn','msgInput','attachBtn',
 'fileInput','sendBtn','emojiPanel','emojiGrid','stickerGrid','ctxMenu','modalRoot','lightbox','toast']
 .forEach(id => el[id] = $(id));

let banner = null;                 // {mode:'reply'|'edit', msgId}
let typing = {};                   // chatId -> {name, timer}
let searchHl = null;               // {q, focusId} 会话内搜索高亮
let msMatches = [], msIndex = -1;
let unseen = 0;                    // 滚上去之后到达的新消息数
let toastTimer = null;
let netInfo = { count: 0 };
let netTypingSent = 0;

const activeChat = () => S.activeChat ? Store.chatById(S.activeChat) : null;

/* ================= 基础 UI ================= */
function toast(t) {
  el.toast.textContent = t;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 1900);
}

function avatarHtml(av, cls, online) {
  const c = av && typeof av.c === 'number' ? av.c : 4;
  const e = av && av.e ? av.e : '👤';
  return `<div class="avatar ${cls || ''}" style="--av:${AV[c % AV.length]}">${e}${online ? '<i class="presence"></i>' : ''}</div>`;
}

function applyTheme() {
  const t = S.theme || 'auto';
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((S.theme || 'auto') === 'auto') applyTheme();
});

function updateConn() {
  const st = Net.status;
  el.connDot.className = 'dot ' + (st === 'on' ? 'on' : st === 'connecting' ? 'connecting' : 'off');
  el.connText.textContent =
    st === 'on' ? ('已连接' + (netInfo.count ? ' · ' + netInfo.count + ' 人在线' : '')) :
    st === 'connecting' ? '连接服务器中…' : '本地演示模式';
}

/* ================= 会话列表 ================= */
function chatOnline(c) {
  if (c.type === 'bot') return true;
  if (c.type === 'dm') { const u = S.users[c.user]; return !!(u && u.online); }
  return false;
}
function msgExcerpt(m, max) {
  if (!m) return '';
  let t = m.sticker ? (m.sticker + ' 贴纸')
        : m.photo ? ('🖼 图片' + (m.text ? ' · ' + m.text : ''))
        : (m.text || '');
  t = t.replace(/\n+/g, ' ');
  max = max || 60;
  return t.length > max ? t.slice(0, max) + '…' : t;
}

function renderChatList() {
  const q = el.chatSearch.value.trim().toLowerCase();
  el.chatSearchClear.hidden = !q;
  const list = S.chats.slice().sort((a, b) => {
    if (!!b.pinned - !!a.pinned) return (!!b.pinned) - (!!a.pinned);
    const ta = Store.lastMsg(a.id), tb = Store.lastMsg(b.id);
    return (tb ? tb.ts : 0) - (ta ? ta.ts : 0);
  }).filter(c => {
    if (!q) return true;
    const last = Store.lastMsg(c.id);
    return c.name.toLowerCase().includes(q) ||
      (last && (last.text || '').toLowerCase().includes(q));
  });

  if (!list.length) {
    el.chatList.innerHTML = `<div class="list-empty">没有匹配的会话</div>`;
    return;
  }

  el.chatList.innerHTML = list.map(c => {
    const last = Store.lastMsg(c.id);
    const t = typing[c.id];
    const draft = S.drafts[c.id];
    let sub, subCls = 'ci-sub';
    if (t) { sub = '正在输入…'; subCls += ' typing'; }
    else if (draft && c.id !== S.activeChat) sub = `<span class="who">草稿:</span>${esc(msgExcerpt({ text: draft }))}`;
    else if (last) {
      let who = '';
      if (last.from === 'me' && c.type !== 'saved') who = `<span class="who">你:</span> `;
      else if (c.type === 'group' && last.from !== 'me') who = `<span class="who">${esc(Store.userName(last.from))}:</span> `;
      sub = who + esc(msgExcerpt(last));
    } else sub = '暂无消息';

    const ticks = (last && last.from === 'me' && last.st && c.type !== 'saved')
      ? `<span class="ci-ticks${last.st === 'sending' ? ' sending' : ''}">${TICK[last.st] || ''}</span>` : '';
    const badge = c.unread ? `<span class="ci-badge">${c.unread > 99 ? '99+' : c.unread}</span>` : '';

    return `<div class="chat-item${c.id === S.activeChat ? ' active' : ''}" data-id="${c.id}">
      ${avatarHtml(c.avatar, '', chatOnline(c))}
      <div class="ci-main">
        <div class="ci-top">
          <div class="ci-name">${esc(c.name)}${c.verified ? BOT_BADGE : ''}${c.pinned ? PIN_MINI : ''}</div>
          ${ticks}
          <span class="ci-time">${last ? fmtListTime(last.ts) : ''}</span>
        </div>
        <div class="ci-bottom">
          <div class="${subCls}">${sub}</div>
          ${badge}
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ================= 打开会话 / 头部 ================= */
function openChat(cid) {
  const chat = Store.chatById(cid);
  if (!chat) return;
  /* 存旧草稿 */
  if (S.activeChat && S.activeChat !== cid) saveDraft();
  S.activeChat = cid;
  chat.unread = 0;
  Store.save();

  closeMsgSearch(true);
  clearBanner();
  el.emptyState.style.display = 'none';
  el.chatView.hidden = false;
  document.body.classList.add('chat-open');

  renderHeader();
  renderPinBar();
  renderMessages();
  scrollToBottom(true);
  unseen = 0; updateJump();

  el.msgInput.value = S.drafts[cid] || '';
  autosize();
  if (matchMedia('(min-width: 721px)').matches) el.msgInput.focus();

  if (chat.netRoom && Net.connected) Net.send('read', { room: chat.netRoom });
  renderChatList();
}

function showEmpty() {
  S.activeChat = null; Store.save();
  el.chatView.hidden = true;
  el.emptyState.style.display = 'flex';
  document.body.classList.remove('chat-open');
  renderChatList();
}

function renderHeader() {
  const chat = activeChat(); if (!chat) return;
  const c = chat.avatar && typeof chat.avatar.c === 'number' ? chat.avatar.c : 4;
  el.hAvatar.style.setProperty('--av', AV[c % AV.length]);
  el.hAvatar.innerHTML = (chat.avatar ? chat.avatar.e : '👤') + (chatOnline(chat) ? '<i class="presence"></i>' : '');
  el.hTitle.innerHTML = esc(chat.name) + (chat.verified ? BOT_BADGE : '');
  renderHeaderSub();
}

function renderHeaderSub() {
  const chat = activeChat(); if (!chat) return;
  const t = typing[chat.id];
  if (t) {
    el.hSub.className = 'h-sub typing';
    el.hSub.innerHTML = `${esc(t.name || '')} 正在输入 <span class="typing-dots"><i></i><i></i><i></i></span>`;
    return;
  }
  let cls = 'h-sub', txt;
  if (chat.type === 'saved') txt = '给自己的消息';
  else if (chat.type === 'bot') txt = 'bot';
  else if (chat.type === 'group') {
    txt = chat.netRoom
      ? (Net.connected ? `在线 ${netInfo.count} 人` : '服务器房间(未连接)')
      : `${(chat.members || []).length} 位成员`;
  } else {
    const u = S.users[chat.user];
    if (u && u.online) { txt = '在线'; cls += ' online'; }
    else txt = fmtLastSeen(u && u.lastSeen);
  }
  el.hSub.className = cls;
  el.hSub.textContent = txt;
}

/* ================= 置顶消息条 ================= */
function renderPinBar() {
  const chat = activeChat();
  if (!chat || !chat.pin) { el.pinBar.hidden = true; return; }
  const m = Store.msgById(chat.id, chat.pin);
  if (!m) { delete chat.pin; Store.save(); el.pinBar.hidden = true; return; }
  el.pinText.textContent = msgExcerpt(m, 80);
  el.pinBar.hidden = false;
}

/* ================= 消息渲染 ================= */
function renderText(text, hlq) {
  let h = esc(text);
  if (hlq) {
    try { h = h.replace(new RegExp(escRe(esc(hlq)), 'gi'), mm => `<mark>${mm}</mark>`); } catch (e) {}
  } else {
    h = h.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  return h;
}

function msgHtml(chat, m, flags) {
  const mine = m.from === 'me';
  const isGroup = chat.type === 'group';
  const cls = ['msg', mine ? 'out' : 'in'];
  if (flags.tight) cls.push('tight');
  if (flags.lastIn) cls.push('last-in');

  /* 群聊里给来信显示头像(组尾实心,其余占位) */
  let avatar = '';
  if (isGroup && !mine) {
    avatar = avatarHtml(Store.userAvatar(m.from), 'm-avatar' + (flags.lastIn ? '' : ' ghost'), false);
  }

  const bubCls = ['bubble'];
  const photoOnly = m.photo && !m.text && !m.replyTo && !m.fwdFrom && !m.reacts;
  if (photoOnly) bubCls.push('only-photo');
  if (m.sticker) bubCls.push('sticker');

  let inner = '';
  if (isGroup && !mine && !flags.tight && !m.sticker) {
    const col = SENDER_COLORS[Math.abs([...m.from].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % SENDER_COLORS.length];
    inner += `<div class="sender" style="color:${col}">${esc(Store.userName(m.from))}</div>`;
  }
  if (m.fwdFrom) inner += `<div class="fwd">转发自 ${esc(m.fwdFrom)}</div>`;
  if (m.replyTo) {
    const orig = Store.msgById(chat.id, m.replyTo);
    inner += orig
      ? `<div class="reply-q" data-target="${orig.id}"><b>${esc(Store.userName(orig.from))}</b><span>${esc(msgExcerpt(orig, 50))}</span></div>`
      : `<div class="reply-q"><b>原消息</b><span>已被删除</span></div>`;
  }
  if (m.photo) {
    const ratio = m.pw && m.ph ? ` style="aspect-ratio:${m.pw}/${m.ph}"` : '';
    inner += `<img class="photo" src="${m.photo}"${ratio} alt="图片">`;
  }
  if (m.sticker) inner += esc(m.sticker);
  else if (m.text) inner += `<span class="txt">${renderText(m.text, searchHl && searchHl.q)}</span>`;

  if (m.reacts && Object.keys(m.reacts).length) {
    inner += `<div class="reacts">` + Object.entries(m.reacts).map(([e, arr]) =>
      `<span class="react-chip${arr.includes('me') ? ' mine' : ''}" data-emo="${esc(e)}">${e}<b>${arr.length}</b></span>`
    ).join('') + `</div>`;
  }

  const metaCls = 'm-meta' + ((photoOnly || m.sticker) ? ' overlay' : '');
  let meta = `<span class="${metaCls}">`;
  if (m.edited) meta += `<span>已编辑</span>`;
  meta += `<span>${fmtTime(m.ts)}</span>`;
  if (mine && chat.type !== 'saved' && m.st) {
    meta += `<span class="ticks${m.st === 'sending' ? ' sending' : ''}">${TICK[m.st] || ''}</span>`;
  }
  meta += `</span>`;

  return `<div class="${cls.join(' ')}" data-id="${m.id}">${avatar}<div class="${bubCls.join(' ')}">${inner}${meta}</div></div>`;
}

function renderMessages(opts) {
  opts = opts || {};
  const chat = activeChat(); if (!chat) return;
  const msgs = Store.msgsOf(chat.id).slice().sort((a, b) => a.ts - b.ts);
  const wasBottom = nearBottom();
  const keepTop = el.msgScroll.scrollTop;

  const parts = [];
  const GAP = 5 * 60e3;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i], prev = msgs[i - 1], next = msgs[i + 1];
    const newDay = !prev || dayKey(prev.ts) !== dayKey(m.ts);
    if (newDay) parts.push(`<div class="day-sep">${fmtDay(m.ts)}</div>`);
    const tight = !newDay && prev && prev.from === m.from && (m.ts - prev.ts) < GAP;
    const grpNext = next && dayKey(next.ts) === dayKey(m.ts) && next.from === m.from && (next.ts - m.ts) < GAP;
    parts.push(msgHtml(chat, m, { tight, lastIn: !grpNext }));
  }
  el.msgList.innerHTML = parts.length ? parts.join('')
    : `<div class="svc">暂无消息,说点什么吧</div>`;

  /* 图片加载后保持贴底 */
  el.msgList.querySelectorAll('img.photo').forEach(img => {
    img.addEventListener('load', () => { if (wasBottom || opts.stick) scrollToBottom(); }, { once: true });
  });

  if (opts.stick || wasBottom) scrollToBottom();
  else el.msgScroll.scrollTop = keepTop;

  if (opts.focusId) jumpToMsg(opts.focusId);
}

function nearBottom() {
  const s = el.msgScroll;
  return s.scrollHeight - s.scrollTop - s.clientHeight < 120;
}
function scrollToBottom(instant) {
  el.msgScroll.scrollTo({ top: el.msgScroll.scrollHeight, behavior: instant ? 'auto' : 'auto' });
}
function jumpToMsg(mid) {
  const node = el.msgList.querySelector(`.msg[data-id="${CSS.escape(mid)}"]`);
  if (!node) return;
  node.scrollIntoView({ block: 'center' });
  node.classList.remove('flash');
  void node.offsetWidth;
  node.classList.add('flash');
  setTimeout(() => node.classList.remove('flash'), 1300);
}
function updateJump() {
  const show = !nearBottom();
  el.jumpBtn.hidden = !show;
  if (!show) unseen = 0;
  el.jumpBadge.hidden = !unseen;
  el.jumpBadge.textContent = unseen;
}

/* ================= 输入区 ================= */
function autosize() {
  const t = el.msgInput;
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, 160) + 'px';
}
function saveDraft() {
  if (!S.activeChat) return;
  const v = el.msgInput.value;
  if (v.trim()) S.drafts[S.activeChat] = v; else delete S.drafts[S.activeChat];
  Store.save();
}
function insertAtCursor(t) {
  const i = el.msgInput, s = i.selectionStart || 0, e = i.selectionEnd || 0;
  i.value = i.value.slice(0, s) + t + i.value.slice(e);
  i.selectionStart = i.selectionEnd = s + t.length;
  autosize(); i.focus();
}

function setBanner(mode, msgId) {
  const chat = activeChat(); if (!chat) return;
  const m = Store.msgById(chat.id, msgId); if (!m) return;
  banner = { mode, msgId };
  const title = mode === 'edit' ? '编辑消息' : `回复 ${Store.userName(m.from)}`;
  el.composeBanner.innerHTML =
    (mode === 'edit' ? IC.edit : IC.reply) +
    (m.photo ? `<img class="cb-thumb" src="${m.photo}" alt="">` : '') +
    `<div class="cb-body"><b>${esc(title)}</b><span>${esc(msgExcerpt(m, 70))}</span></div>
     <button class="icon-btn mini" id="cbClose" title="取消">${IC.close}</button>`;
  el.composeBanner.hidden = false;
  $('cbClose').onclick = clearBanner;
  if (mode === 'edit') { el.msgInput.value = m.text || ''; autosize(); }
  el.msgInput.focus();
}
function clearBanner() {
  if (banner && banner.mode === 'edit') { el.msgInput.value = S.drafts[S.activeChat] || ''; autosize(); }
  banner = null;
  el.composeBanner.hidden = true;
  el.composeBanner.innerHTML = '';
}

function sendCurrent() {
  const chat = activeChat(); if (!chat) return;
  const text = el.msgInput.value.trim();

  if (banner && banner.mode === 'edit') {
    if (!text) { toast('内容不能为空'); return; }
    Store.updateMsg(chat.id, banner.msgId, { text, edited: true });
    banner = null; clearBanner();
    el.msgInput.value = ''; autosize(); saveDraft();
    renderMessages(); renderChatList(); renderPinBar();
    return;
  }
  if (!text) return;

  const msg = {
    id: Store.nextId(), from: 'me', ts: Date.now(), text,
    st: chat.type === 'saved' ? 'read' : 'sending'
  };
  if (banner && banner.mode === 'reply') msg.replyTo = banner.msgId;
  clearBanner();
  el.msgInput.value = ''; autosize();
  delete S.drafts[chat.id];
  Store.addMsg(chat.id, msg);
  renderMessages({ stick: true });
  renderChatList();
  route(chat, msg);
}

function sendSticker(stk) {
  const chat = activeChat(); if (!chat) return;
  const msg = { id: Store.nextId(), from: 'me', ts: Date.now(), sticker: stk,
    st: chat.type === 'saved' ? 'read' : 'sending' };
  Store.addMsg(chat.id, msg);
  hideEmojiPanel();
  renderMessages({ stick: true });
  renderChatList();
  route(chat, msg);
}

function sendPhoto(dataUrl, w, h, caption) {
  const chat = activeChat(); if (!chat) return;
  const msg = { id: Store.nextId(), from: 'me', ts: Date.now(),
    photo: dataUrl, pw: w, ph: h,
    st: chat.type === 'saved' ? 'read' : 'sending' };
  if (caption) msg.text = caption;
  Store.addMsg(chat.id, msg);
  renderMessages({ stick: true });
  renderChatList();
  route(chat, msg);
}

/* ================= 消息路由:网络 / bot / 本地模拟 ================= */
function setSt(cid, mid, st) {
  Store.updateMsg(cid, mid, { st });
  if (S.activeChat === cid) renderMessages();
  renderChatList();
}

function route(chat, msg) {
  /* 1. 已连接的服务器房间 */
  if (chat.netRoom && Net.connected) {
    Net.send('msg', {
      room: chat.netRoom, tempId: msg.id,
      text: msg.text, sticker: msg.sticker,
      photo: msg.photo, pw: msg.pw, ph: msg.ph,
      replyTo: msg.replyTo, fwdFrom: msg.fwdFrom
    });
    return;
  }
  /* 2. 收藏夹:即时已读,无回应 */
  if (chat.type === 'saved') return;
  /* 3. Aevi bot(本地占位) */
  if (chat.type === 'bot') { botFlow(chat, msg); return; }
  /* 4. 本地模拟联系人 */
  simFlow(chat, msg);
}

function botFlow(chat, msg) {
  const cid = chat.id;
  setTimeout(() => setSt(cid, msg.id, 'sent'), 250);
  setTimeout(() => setSt(cid, msg.id, 'read'), 600);
  const dur = 600 + Math.min((msg.text || '').length * 30, 1600);
  setTimeout(() => setTyping(cid, 'Aevi', dur + 400), 500);
  setTimeout(async () => {
    const history = Store.msgsOf(cid).slice(-8).map(m => ({ from: m.from, text: m.text || '' }));
    let r;
    try { r = await AeviBot.respond(msg.text || (msg.sticker ? '贴纸 ' + msg.sticker : '图片'), { userName: S.profile.name, history }); }
    catch (e) { r = '(小小地宕机了一下,再说一遍?)'; }
    if (typeof r === 'string') r = { text: r };
    clearTyping(cid);
    Store.addMsg(cid, { id: Store.nextId(), from: 'aevi', ts: Date.now(), text: r.text, sticker: r.sticker });
    incoming(cid);
  }, 500 + dur);
}

const SIM_REPLIES = {
  lumi: ['收到收到!', '哈哈,好呀。', '嗯嗯,我在听~', '这个想法不错!', '晚点细说,先记下了。', '✨'],
  nova: ['了解。', '好的,晚点回你详细的。', '嗯,合理。', '收到,记在清单里了。'],
  default: ['好的!', '收到~', '哈哈哈', '有道理。']
};

function simFlow(chat, msg) {
  const cid = chat.id;
  setTimeout(() => setSt(cid, msg.id, 'sent'), 400);
  if (chat.type === 'dm') {
    const uid = chat.user;
    const u = S.users[uid];
    if (!(u && u.online)) return;               // 离线联系人不回,停在“已发送”
    const typeDur = 1200 + Math.random() * 900;
    setTimeout(() => setTyping(cid, u.name, typeDur + 200), 900);
    setTimeout(() => {
      Store.markMineRead(cid);
      clearTyping(cid);
      Store.addMsg(cid, { id: Store.nextId(), from: uid, ts: Date.now(),
        text: pick(SIM_REPLIES[uid] || SIM_REPLIES.default) });
      incoming(cid);
    }, 900 + typeDur);
  } else if (chat.type === 'group') {
    setTimeout(() => { Store.markMineRead(cid); if (S.activeChat === cid) renderMessages(); renderChatList(); }, 800);
    if (Math.random() < 0.65) {
      const others = (chat.members || []).filter(x => x !== 'me');
      const uid = pick(others);
      const u = S.users[uid] || { name: uid };
      const typeDur = 1100 + Math.random() * 1000;
      setTimeout(() => setTyping(cid, u.name, typeDur + 200), 1100);
      setTimeout(() => {
        clearTyping(cid);
        Store.addMsg(cid, { id: Store.nextId(), from: uid, ts: Date.now(),
          text: pick(SIM_REPLIES[uid] || SIM_REPLIES.default) });
        incoming(cid);
      }, 1100 + typeDur);
    }
  }
}

function incoming(cid) {
  const chat = Store.chatById(cid); if (!chat) return;
  if (S.activeChat === cid) {
    const stick = nearBottom();
    renderMessages({ stick });
    if (!stick) { unseen++; updateJump(); }
  } else {
    chat.unread = (chat.unread || 0) + 1;
    Store.save();
  }
  renderChatList();
}

function setTyping(cid, name, dur) {
  clearTimeout(typing[cid] && typing[cid].timer);
  typing[cid] = { name, timer: setTimeout(() => clearTyping(cid), dur || 3000) };
  if (S.activeChat === cid) renderHeaderSub();
  renderChatList();
}
function clearTyping(cid) {
  if (!typing[cid]) return;
  clearTimeout(typing[cid].timer);
  delete typing[cid];
  if (S.activeChat === cid) renderHeaderSub();
  renderChatList();
}

/* ================= 表情面板 ================= */
function buildEmojiPanel() {
  el.emojiGrid.innerHTML = EMOJI.categories.map(cat =>
    `<div class="ep-cat">${esc(cat.name)}</div>
     <div class="ep-emojis">${cat.list.map(e => `<button data-e="${esc(e)}">${e}</button>`).join('')}</div>`
  ).join('');
  el.stickerGrid.innerHTML = EMOJI.stickers.map(s => `<button data-s="${esc(s)}">${s}</button>`).join('');
}
function toggleEmojiPanel() {
  if (el.emojiPanel.hidden) { el.emojiPanel.hidden = false; el.emojiBtn.classList.add('on'); }
  else hideEmojiPanel();
}
function hideEmojiPanel() { el.emojiPanel.hidden = true; el.emojiBtn.classList.remove('on'); }

/* ================= 图片附件 ================= */
function handleFiles(files) {
  const chat = activeChat(); if (!chat) return;
  let caption = el.msgInput.value.trim();
  if (caption) { el.msgInput.value = ''; autosize(); delete S.drafts[chat.id]; }
  [...files].filter(f => /^image\//.test(f.type)).forEach((f, idx) => {
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        let url = rd.result;
        const MAX = 1280;
        if (w > MAX || h > MAX || f.size > 300 * 1024) {
          const k = Math.min(MAX / w, MAX / h, 1);
          const cw = Math.round(w * k), ch = Math.round(h * k);
          const cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
          url = cv.toDataURL('image/jpeg', 0.85);
          w = cw; h = ch;
        }
        sendPhoto(url, w, h, idx === 0 ? caption : '');
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(f);
  });
}

/* ================= 右键菜单 ================= */
function openMenu(x, y, itemsHtml, onAct) {
  el.ctxMenu.innerHTML = itemsHtml;
  el.ctxMenu.hidden = false;
  const r = el.ctxMenu.getBoundingClientRect();
  el.ctxMenu.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  el.ctxMenu.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  el.ctxMenu.onclick = e => {
    const rb = e.target.closest('[data-remo]');
    if (rb) { closeMenu(); onAct('react', rb.dataset.remo); return; }
    const b = e.target.closest('[data-act]');
    if (b) { closeMenu(); onAct(b.dataset.act); }
  };
}
function closeMenu() { el.ctxMenu.hidden = true; el.ctxMenu.innerHTML = ''; el.ctxMenu.onclick = null; }
const menuItem = (act, ic, label, danger) =>
  `<button class="ctx-item${danger ? ' danger' : ''}" data-act="${act}">${ic}<span>${label}</span></button>`;

function msgMenu(e, mid) {
  const chat = activeChat(); if (!chat) return;
  const m = Store.msgById(chat.id, mid); if (!m) return;
  const mine = m.from === 'me';
  let html = `<div class="ctx-reacts">` +
    EMOJI.reactions.map(r => `<button data-remo="${esc(r)}">${r}</button>`).join('') + `</div>`;
  html += menuItem('reply', IC.reply, '回复');
  if (m.text) html += menuItem('copy', IC.copy, '复制文字');
  html += menuItem('forward', IC.forward, '转发');
  html += menuItem('pin', IC.pin, chat.pin === mid ? '取消置顶' : '置顶');
  if (mine && m.text && !m.sticker) html += menuItem('edit', IC.edit, '编辑');
  html += menuItem('del', IC.trash, '删除', true);

  openMenu(e.clientX, e.clientY, html, (act, arg) => {
    if (act === 'react') { toggleReact(chat.id, mid, arg); return; }
    if (act === 'reply') setBanner('reply', mid);
    else if (act === 'copy') copyText(m.text || '');
    else if (act === 'forward') forwardModal(mid);
    else if (act === 'pin') {
      if (chat.pin === mid) { delete chat.pin; toast('已取消置顶'); }
      else { chat.pin = mid; toast('已置顶'); }
      Store.save(); renderPinBar();
    }
    else if (act === 'edit') setBanner('edit', mid);
    else if (act === 'del') confirmModal('删除消息', '删除这条消息?此操作不可撤销。', '删除', true, () => {
      Store.removeMsg(chat.id, mid);
      renderMessages(); renderChatList(); renderPinBar();
    });
  });
}

function chatMenu(e, cid) {
  const c = Store.chatById(cid); if (!c) return;
  let html = '';
  html += menuItem('pin', IC.pin, c.pinned ? '取消置顶会话' : '置顶会话');
  html += menuItem('read', IC.check, '标为已读');
  html += menuItem('clear', IC.trash, '清空聊天记录');
  if (!['saved', 'aevi'].includes(cid) && !c.netRoom) html += menuItem('del', IC.close, '删除会话', true);
  openMenu(e.clientX, e.clientY, html, act => {
    if (act === 'pin') { c.pinned = !c.pinned; Store.save(); renderChatList(); }
    else if (act === 'read') { c.unread = 0; Store.save(); renderChatList(); }
    else if (act === 'clear') confirmModal('清空聊天记录', `清空「${c.name}」的全部消息?`, '清空', true, () => {
      Store.clearChat(cid);
      if (S.activeChat === cid) { renderMessages(); renderPinBar(); }
      renderChatList();
    });
    else if (act === 'del') confirmModal('删除会话', `删除「${c.name}」及全部消息?`, '删除', true, () => {
      const wasActive = S.activeChat === cid;
      Store.removeChat(cid);
      if (wasActive) showEmpty(); else renderChatList();
    });
  });
}

function toggleReact(cid, mid, emo) {
  const m = Store.msgById(cid, mid); if (!m) return;
  m.reacts = m.reacts || {};
  const arr = m.reacts[emo] = m.reacts[emo] || [];
  const i = arr.indexOf('me');
  if (i >= 0) arr.splice(i, 1); else arr.push('me');
  if (!arr.length) delete m.reacts[emo];
  if (!Object.keys(m.reacts).length) delete m.reacts;
  Store.save();
  renderMessages();
}

function copyText(t) {
  const done = () => toast('已复制');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(done, () => fallbackCopy(t, done));
  } else fallbackCopy(t, done);
}
function fallbackCopy(t, done) {
  const ta = document.createElement('textarea');
  ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败'); }
  ta.remove();
}

/* ================= 模态框 ================= */
function openModal(html) {
  el.modalRoot.innerHTML = `<div class="modal">${html}</div>`;
  el.modalRoot.hidden = false;
}
function closeModal() { el.modalRoot.hidden = true; el.modalRoot.innerHTML = ''; }

function confirmModal(title, text, okLabel, danger, cb) {
  openModal(`
    <div class="modal-head">${esc(title)}<button class="icon-btn mini" data-x>${IC.close}</button></div>
    <div class="modal-body">${esc(text)}</div>
    <div class="modal-foot">
      <button class="btn" data-x>取消</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okLabel)}</button>
    </div>`);
  el.modalRoot.querySelectorAll('[data-x]').forEach(b => b.onclick = closeModal);
  el.modalRoot.querySelector('[data-ok]').onclick = () => { closeModal(); cb(); };
}

function forwardModal(mid) {
  const src = activeChat(); if (!src) return;
  const m = Store.msgById(src.id, mid); if (!m) return;
  openModal(`
    <div class="modal-head">转发到…<button class="icon-btn mini" data-x>${IC.close}</button></div>
    <div class="modal-body">` +
    S.chats.map(c => `
      <button class="fwd-item" data-c="${c.id}">
        ${avatarHtml(c.avatar, '', chatOnline(c))}
        <div><div class="fi-name">${esc(c.name)}</div>
        <div class="fi-sub">${c.type === 'group' ? '群组' : c.type === 'bot' ? 'bot' : c.type === 'saved' ? '收藏夹' : '私聊'}</div></div>
      </button>`).join('') +
    `</div>`);
  el.modalRoot.querySelector('[data-x]').onclick = closeModal;
  el.modalRoot.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
    const target = Store.chatById(b.dataset.c);
    closeModal();
    if (!target) return;
    const copy = {
      id: Store.nextId(), from: 'me', ts: Date.now(),
      text: m.text, photo: m.photo, pw: m.pw, ph: m.ph, sticker: m.sticker,
      fwdFrom: Store.userName(m.from),
      st: target.type === 'saved' ? 'read' : 'sending'
    };
    Object.keys(copy).forEach(k => copy[k] === undefined && delete copy[k]);
    Store.addMsg(target.id, copy);
    openChat(target.id);
    toast(`已转发到「${target.name}」`);
    route(target, copy);
  });
}

/* ================= 设置面板 ================= */
const PICK_EMOJIS = ['🦊','🌙','⭐','🪐','🌸','🍀','🌊','🔥','💫','🐱','🐰','🛰️','🎧','☕','🧸','💌'];

function settingsModal() {
  const p = S.profile;
  openModal(`
    <div class="modal-head">设置<button class="icon-btn mini" data-x>${IC.close}</button></div>
    <div class="modal-body">
      <div class="set-avatar-preview" id="setAvPrev"></div>
      <div class="set-row">
        <div class="set-label">昵称</div>
        <input class="set-input" id="setName" maxlength="24" value="${esc(p.name)}">
      </div>
      <div class="set-row">
        <div class="set-label">头像表情</div>
        <div class="pick-row" id="setEmojis"></div>
      </div>
      <div class="set-row">
        <div class="set-label">头像底色</div>
        <div class="pick-row" id="setColors"></div>
      </div>
      <div class="set-row">
        <div class="set-label">主题</div>
        <div class="seg" id="setTheme">
          <button data-t="light">浅色</button>
          <button data-t="dark">深色</button>
          <button data-t="auto">跟随系统</button>
        </div>
      </div>
      <div class="set-row">
        <div class="set-label">实时服务器(可选)</div>
        <div class="set-conn">
          <input class="set-input" id="setServer" placeholder="ws://localhost:8790" value="${esc(S.server || '')}">
          <button class="btn primary" id="setConnBtn">${Net.connected ? '断开' : '连接'}</button>
        </div>
        <div class="set-hint">不填则为纯本地演示。后端见 tg-chat/server/,启动后在此填地址即可开启多人房间与服务器版 Aevi。</div>
      </div>
      <div class="set-row">
        <div class="set-label">数据</div>
        <button class="btn danger" id="setReset">重置演示数据</button>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" data-x>取消</button>
      <button class="btn primary" id="setSave">保存</button>
    </div>`);

  let curE = p.avatar.e, curC = p.avatar.c;
  const prev = $('setAvPrev');
  const renderPrev = () => prev.innerHTML = avatarHtml({ e: curE, c: curC });
  renderPrev();

  $('setEmojis').innerHTML = PICK_EMOJIS.map(e =>
    `<button class="pick-emoji${e === curE ? ' on' : ''}" data-e="${e}">${e}</button>`).join('');
  $('setColors').innerHTML = AV.map((g, i) =>
    `<button class="pick-color${i === curC ? ' on' : ''}" data-i="${i}" style="background:${g}"></button>`).join('');

  $('setEmojis').onclick = e => {
    const b = e.target.closest('[data-e]'); if (!b) return;
    curE = b.dataset.e;
    $('setEmojis').querySelectorAll('.pick-emoji').forEach(x => x.classList.toggle('on', x.dataset.e === curE));
    renderPrev();
  };
  $('setColors').onclick = e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    curC = +b.dataset.i;
    $('setColors').querySelectorAll('.pick-color').forEach(x => x.classList.toggle('on', +x.dataset.i === curC));
    renderPrev();
  };

  const segBtns = $('setTheme').querySelectorAll('button');
  const markTheme = () => segBtns.forEach(b => b.classList.toggle('on', b.dataset.t === (S.theme || 'auto')));
  markTheme();
  $('setTheme').onclick = e => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    S.theme = b.dataset.t; Store.save(); applyTheme(); markTheme();
  };

  $('setConnBtn').onclick = () => {
    if (Net.connected) {
      Net.disconnect(); S.autoConnect = false; Store.save();
      $('setConnBtn').textContent = '连接';
      toast('已断开');
    } else {
      const url = $('setServer').value.trim();
      if (!url) { toast('请填写服务器地址'); return; }
      S.server = url; S.autoConnect = true; Store.save();
      connectNet();
      $('setConnBtn').textContent = '断开';
      toast('正在连接…');
    }
  };

  $('setReset').onclick = () => confirmModal('重置演示数据', '清除本地全部聊天数据并恢复初始演示内容?', '重置', true, () => {
    Net.disconnect();
    S = Store.reset();
    location.reload();
  });

  el.modalRoot.querySelectorAll('[data-x]').forEach(b => b.onclick = closeModal);
  $('setSave').onclick = () => {
    S.profile.name = $('setName').value.trim() || 'Aurex';
    S.profile.avatar = { e: curE, c: curC };
    S.server = $('setServer').value.trim();
    Store.save();
    closeModal();
    renderChatList();
    if (S.activeChat) { renderHeader(); renderMessages(); }
    toast('已保存');
  };
}

/* ================= 会话内搜索 ================= */
function openMsgSearch() {
  el.msgSearch.hidden = false;
  el.msIn.value = ''; el.msCount.textContent = '';
  msMatches = []; msIndex = -1;
  el.msIn.focus();
}
function closeMsgSearch(silent) {
  if (el.msgSearch.hidden && !searchHl) return;
  el.msgSearch.hidden = true;
  msMatches = []; msIndex = -1;
  if (searchHl) { searchHl = null; if (!silent) renderMessages(); }
}
function runMsgSearch() {
  const chat = activeChat(); if (!chat) return;
  const q = el.msIn.value.trim();
  if (!q) {
    msMatches = []; msIndex = -1; el.msCount.textContent = '';
    if (searchHl) { searchHl = null; renderMessages(); }
    return;
  }
  const lower = q.toLowerCase();
  msMatches = Store.msgsOf(chat.id)
    .filter(m => (m.text || '').toLowerCase().includes(lower))
    .map(m => m.id);
  msIndex = msMatches.length - 1;
  applyMsgSearch(q);
}
function applyMsgSearch(q) {
  if (!msMatches.length) {
    el.msCount.textContent = '无结果';
    searchHl = { q };
    renderMessages();
    return;
  }
  el.msCount.textContent = (msIndex + 1) + '/' + msMatches.length;
  searchHl = { q };
  renderMessages({ focusId: msMatches[msIndex] });
}
function msNav(dir) {
  if (!msMatches.length) return;
  msIndex = (msIndex + dir + msMatches.length) % msMatches.length;
  el.msCount.textContent = (msIndex + 1) + '/' + msMatches.length;
  jumpToMsg(msMatches[msIndex]);
}

/* ================= 网络接入 ================= */
function netChatIdOf(room) {
  if (room === 'lobby') return 'net-lobby';
  if (room === 'aevi') return 'aevi';
  return 'net-' + room;
}
function connectNet() {
  if (!S.server) return;
  if (!S.profile.netId) { S.profile.netId = 'u' + Math.random().toString(36).slice(2, 10); Store.save(); }
  Net.connect(S.server, { id: S.profile.netId, name: S.profile.name, avatar: S.profile.avatar });
}

Net.on('status', () => { updateConn(); renderHeaderSub(); });
Net.on('error', m => toast(m));

Net.on('welcome', d => {
  Store.addChat({
    id: 'net-lobby', type: 'group', name: '大厅(服务器)',
    netRoom: 'lobby', avatar: { e: '📡', c: 3 }, unread: 0
  });
  const aevi = Store.chatById('aevi');
  if (aevi) { aevi.netRoom = 'aevi'; Store.save(); }
  Net.send('join', { room: 'lobby' });
  Net.send('join', { room: 'aevi' });
  netInfo.count = (d.users || []).length;
  updateConn(); renderChatList();
  toast('已连接服务器');
});

Net.on('history', d => {
  if (d.room !== 'lobby') return;   // aevi 保留本地记录
  const cid = netChatIdOf(d.room);
  S.msgs[cid] = (d.msgs || []).map(m => ({
    id: m.id, ts: m.ts,
    from: m.from === S.profile.netId ? 'me' : m.from,
    text: m.text, sticker: m.sticker, photo: m.photo, pw: m.pw, ph: m.ph,
    fwdFrom: m.fwdFrom, st: m.from === S.profile.netId ? 'sent' : undefined
  }));
  (d.msgs || []).forEach(m => {
    if (m.from !== S.profile.netId && !S.users[m.from]) {
      S.users[m.from] = { name: m.fromName || m.from, avatar: m.avatar || { e: '👤', c: 7 } };
    }
  });
  Store.save();
  if (S.activeChat === cid) renderMessages({ stick: true });
  renderChatList();
});

Net.on('msg', d => {
  const cid = netChatIdOf(d.room);
  const chat = Store.chatById(cid); if (!chat) return;
  const m = d.msg || {};
  if (m.from === S.profile.netId) return;   // 自己的消息走 ack
  if (m.from && !S.users[m.from] && m.from !== 'aevi') {
    S.users[m.from] = { name: m.fromName || m.from, avatar: m.avatar || { e: '👤', c: 7 } };
  }
  Store.addMsg(cid, {
    id: m.id || Store.nextId(), ts: m.ts || Date.now(), from: m.from,
    text: m.text, sticker: m.sticker, photo: m.photo, pw: m.pw, ph: m.ph, fwdFrom: m.fwdFrom
  });
  clearTyping(cid);
  incoming(cid);
});

Net.on('ack', d => {
  const cid = netChatIdOf(d.room);
  const m = Store.msgById(cid, d.tempId);
  if (m) { m.st = 'sent'; if (d.ts) m.ts = d.ts; Store.save(); }
  if (S.activeChat === cid) renderMessages();
  renderChatList();
});

Net.on('typing', d => {
  const cid = netChatIdOf(d.room);
  if (d.on) setTyping(cid, d.fromName || '对方', 3000);
  else clearTyping(cid);
});

Net.on('presence', d => {
  netInfo.count = d.count || (d.users || []).length;
  updateConn(); renderHeaderSub();
});

Net.on('read', d => {
  const cid = netChatIdOf(d.room);
  if (Store.markMineRead(cid)) {
    if (S.activeChat === cid) renderMessages();
    renderChatList();
  }
});

/* ================= 事件绑定 ================= */
function bind() {
  /* 侧栏 */
  el.sbSettingsBtn.onclick = settingsModal;
  el.themeBtn.onclick = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    S.theme = dark ? 'light' : 'dark';
    Store.save(); applyTheme();
  };
  el.chatSearch.oninput = renderChatList;
  el.chatSearchClear.onclick = () => { el.chatSearch.value = ''; renderChatList(); el.chatSearch.focus(); };

  el.chatList.onclick = e => {
    const it = e.target.closest('.chat-item');
    if (it) openChat(it.dataset.id);
  };
  el.chatList.oncontextmenu = e => {
    const it = e.target.closest('.chat-item');
    if (it) { e.preventDefault(); chatMenu(e, it.dataset.id); }
  };

  /* 头部 */
  el.backBtn.onclick = () => { saveDraft(); document.body.classList.remove('chat-open'); renderChatList(); };
  el.hSearchBtn.onclick = openMsgSearch;
  el.hMoreBtn.onclick = e => {
    const chat = activeChat(); if (!chat) return;
    const r = el.hMoreBtn.getBoundingClientRect();
    let html = menuItem('search', IC.search, '搜索消息');
    html += menuItem('clear', IC.trash, '清空聊天记录');
    if (!['saved', 'aevi'].includes(chat.id) && !chat.netRoom) html += menuItem('del', IC.close, '删除会话', true);
    openMenu(r.right - 190, r.bottom + 6, html, act => {
      if (act === 'search') openMsgSearch();
      else if (act === 'clear') confirmModal('清空聊天记录', `清空「${chat.name}」的全部消息?`, '清空', true, () => {
        Store.clearChat(chat.id); renderMessages(); renderPinBar(); renderChatList();
      });
      else if (act === 'del') confirmModal('删除会话', `删除「${chat.name}」及全部消息?`, '删除', true, () => {
        Store.removeChat(chat.id); showEmpty();
      });
    });
  };

  /* 会话内搜索 */
  el.msIn.oninput = () => { clearTimeout(el.msIn._t); el.msIn._t = setTimeout(runMsgSearch, 200); };
  el.msIn.onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); msNav(e.shiftKey ? 1 : -1); }
    if (e.key === 'Escape') closeMsgSearch();
  };
  el.msUp.onclick = () => msNav(-1);
  el.msDown.onclick = () => msNav(1);
  el.msClose.onclick = () => closeMsgSearch();

  /* 置顶条 */
  el.pinBar.onclick = e => {
    if (e.target.closest('#pinClose')) return;
    const chat = activeChat();
    if (chat && chat.pin) jumpToMsg(chat.pin);
  };
  el.pinClose.onclick = () => {
    const chat = activeChat(); if (!chat) return;
    delete chat.pin; Store.save();
    renderPinBar(); toast('已取消置顶');
  };

  /* 消息区 */
  el.msgList.onclick = e => {
    const rq = e.target.closest('.reply-q');
    if (rq && rq.dataset.target) { jumpToMsg(rq.dataset.target); return; }
    const chip = e.target.closest('.react-chip');
    if (chip) {
      const msgEl = e.target.closest('.msg');
      if (msgEl) toggleReact(S.activeChat, msgEl.dataset.id, chip.dataset.emo);
      return;
    }
    const ph = e.target.closest('img.photo');
    if (ph) {
      el.lightbox.innerHTML = `<img src="${ph.src}" alt="">`;
      el.lightbox.hidden = false;
    }
  };
  el.msgList.oncontextmenu = e => {
    const msgEl = e.target.closest('.msg');
    if (msgEl) { e.preventDefault(); msgMenu(e, msgEl.dataset.id); }
  };
  el.msgScroll.onscroll = updateJump;
  el.jumpBtn.onclick = () => { scrollToBottom(); unseen = 0; updateJump(); };

  el.lightbox.onclick = () => { el.lightbox.hidden = true; el.lightbox.innerHTML = ''; };

  /* 输入区 */
  el.sendBtn.onclick = sendCurrent;
  el.msgInput.onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCurrent(); }
    if (e.key === 'Escape' && banner) clearBanner();
  };
  el.msgInput.oninput = () => {
    autosize(); saveDraft();
    const chat = activeChat();
    if (chat && chat.netRoom && Net.connected) {
      const now = Date.now();
      if (now - netTypingSent > 2000) {
        netTypingSent = now;
        Net.send('typing', { room: chat.netRoom, on: true });
      }
    }
  };

  el.emojiBtn.onclick = e => { e.stopPropagation(); toggleEmojiPanel(); };
  el.emojiPanel.onclick = e => {
    e.stopPropagation();
    const t = e.target.closest('.ep-tab');
    if (t) {
      el.emojiPanel.querySelectorAll('.ep-tab').forEach(x => x.classList.toggle('active', x === t));
      el.emojiGrid.hidden = t.dataset.tab !== 'emoji';
      el.stickerGrid.hidden = t.dataset.tab !== 'sticker';
      return;
    }
    const eb = e.target.closest('[data-e]');
    if (eb) { insertAtCursor(eb.dataset.e); return; }
    const sb = e.target.closest('[data-s]');
    if (sb) sendSticker(sb.dataset.s);
  };

  el.attachBtn.onclick = () => el.fileInput.click();
  el.fileInput.onchange = () => { handleFiles(el.fileInput.files); el.fileInput.value = ''; };

  /* 拖拽图片进聊天窗 */
  el.chatPane.addEventListener('dragover', e => e.preventDefault());
  el.chatPane.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  /* 全局 */
  document.addEventListener('click', e => {
    if (!el.ctxMenu.hidden && !e.target.closest('#ctxMenu')) closeMenu();
    if (!el.emojiPanel.hidden && !e.target.closest('#emojiPanel') && !e.target.closest('#emojiBtn')) hideEmojiPanel();
  });
  el.modalRoot.addEventListener('click', e => { if (e.target === el.modalRoot) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!el.lightbox.hidden) { el.lightbox.hidden = true; el.lightbox.innerHTML = ''; }
    else if (!el.modalRoot.hidden) closeModal();
    else if (!el.ctxMenu.hidden) closeMenu();
    else if (!el.emojiPanel.hidden) hideEmojiPanel();
    else if (!el.msgSearch.hidden) closeMsgSearch();
  });
  window.addEventListener('beforeunload', () => { saveDraft(); Store.save(); });
}

/* ================= 启动 ================= */
function init() {
  applyTheme();
  buildEmojiPanel();
  bind();
  updateConn();
  renderChatList();
  if (S.activeChat && Store.chatById(S.activeChat)) openChat(S.activeChat);
  else showEmpty();
  if (S.server && S.autoConnect) connectNet();
}
init();

})();
