/* =========================================================
   Aurex Chat — 状态存储
   内存 state + localStorage 持久化(防抖写入)
   消息结构:
     { id, from, ts, text?, photo?, pw?, ph?, sticker?,
       st?('sending'|'sent'|'read'  仅自己的消息),
       replyTo?, fwdFrom?, edited?, reacts?: {emoji:[uid]} }
   ========================================================= */
window.Store = (() => {

  const KEY = 'aurex.tgchat.v1';
  let state = null;
  let saveTimer = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.v === 1 && s.chats && s.msgs) { state = s; return state; }
      }
    } catch (e) { /* 损坏则重建 */ }
    state = Seed.build();
    save(true);
    return state;
  }

  function save(now) {
    clearTimeout(saveTimer);
    const doSave = () => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); }
      catch (e) { /* 配额满(通常是大图):静默忽略,内存态仍可用 */ }
    };
    if (now) doSave(); else saveTimer = setTimeout(doSave, 180);
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    state = Seed.build();
    save(true);
    return state;
  }

  /* ---------- 查询 ---------- */
  const chatById = id => state.chats.find(c => c.id === id) || null;
  const msgsOf   = id => (state.msgs[id] = state.msgs[id] || []);
  const msgById  = (cid, mid) => msgsOf(cid).find(m => m.id === mid) || null;
  const lastMsg  = cid => { const a = msgsOf(cid); return a.length ? a[a.length - 1] : null; };

  function userName(uid) {
    if (uid === 'me') return state.profile.name || 'Aurex';
    const u = state.users[uid];
    return u ? u.name : uid;
  }
  function userAvatar(uid) {
    if (uid === 'me') return state.profile.avatar;
    const u = state.users[uid];
    return u ? u.avatar : { e: '👤', c: 7 };
  }

  let idSeq = 0;
  const nextId = () => 'm' + Date.now().toString(36) + (idSeq++).toString(36);

  /* ---------- 变更 ---------- */
  function addChat(chat) {
    if (!chatById(chat.id)) { state.chats.push(chat); save(); }
    return chatById(chat.id);
  }
  function removeChat(cid) {
    state.chats = state.chats.filter(c => c.id !== cid);
    delete state.msgs[cid];
    delete state.drafts[cid];
    if (state.activeChat === cid) state.activeChat = null;
    save();
  }
  function addMsg(cid, msg) {
    if (!msg.id) msg.id = nextId();
    if (!msg.ts) msg.ts = Date.now();
    msgsOf(cid).push(msg);
    save();
    return msg;
  }
  function updateMsg(cid, mid, patch) {
    const m = msgById(cid, mid);
    if (m) { Object.assign(m, patch); save(); }
    return m;
  }
  function removeMsg(cid, mid) {
    const arr = msgsOf(cid);
    const i = arr.findIndex(m => m.id === mid);
    if (i >= 0) arr.splice(i, 1);
    const c = chatById(cid);
    if (c && c.pin === mid) delete c.pin;
    save();
  }
  function clearChat(cid) {
    state.msgs[cid] = [];
    const c = chatById(cid);
    if (c) { delete c.pin; c.unread = 0; }
    save();
  }
  /* 我的所有未读消息标记为已读(对方读了我) */
  function markMineRead(cid) {
    let changed = false;
    msgsOf(cid).forEach(m => {
      if (m.from === 'me' && m.st !== 'read') { m.st = 'read'; changed = true; }
    });
    if (changed) save();
    return changed;
  }

  return {
    load, save, reset,
    get state() { return state; },
    chatById, msgsOf, msgById, lastMsg,
    userName, userAvatar, nextId,
    addChat, removeChat, addMsg, updateMsg, removeMsg, clearChat, markMineRead
  };
})();
