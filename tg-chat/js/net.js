/* =========================================================
   Aurex Chat — WebSocket 客户端(可选后端)
   ---------------------------------------------------------
   不连接后端时整个 app 走本地模拟;在设置面板填入
   ws://localhost:8790 并点“连接”即可启用实时模式。
   协议(与 server/server.js 对应,均为 JSON 文本帧):
     C→S  hello   {user:{id,name,avatar}}
     C→S  join    {room}
     C→S  msg     {room, tempId, text?|sticker?|photo?...}
     C→S  typing  {room, on}
     C→S  read    {room}
     S→C  welcome {rooms:[{id,name}], users:[...]}
     S→C  history {room, msgs:[...]}
     S→C  msg     {room, msg:{id,from,fromName,ts,...}}
     S→C  ack     {room, tempId, id, ts}
     S→C  typing  {room, from, fromName, on}
     S→C  presence{count, users:[{id,name}]}
     S→C  read    {room, from}
   ========================================================= */
window.Net = (() => {

  let ws = null;
  let status = 'off';           // off | connecting | on
  let wantUrl = null;           // 手动断开后不再重连
  let retryTimer = null;
  let retryDelay = 1500;
  const handlers = {};

  function on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); }
  function emit(type, data) { (handlers[type] || []).forEach(fn => { try { fn(data); } catch (e) {} }); }

  function setStatus(s) { status = s; emit('status', s); }

  function connect(url, profile) {
    disconnect(true);
    wantUrl = url;
    open(url, profile);
  }

  function open(url, profile) {
    setStatus('connecting');
    let sock;
    try { sock = new WebSocket(url); }
    catch (e) { setStatus('off'); emit('error', '地址无效:' + url); return; }
    ws = sock;

    sock.onopen = () => {
      retryDelay = 1500;
      setStatus('on');
      send('hello', { user: profile });
    };
    sock.onmessage = ev => {
      let data;
      try { data = JSON.parse(ev.data); } catch (e) { return; }
      if (data && data.type) emit(data.type, data);
    };
    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null;
      setStatus('off');
      /* 仍想连着 → 指数退避重连 */
      if (wantUrl) {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          if (wantUrl) open(wantUrl, profile);
        }, retryDelay);
        retryDelay = Math.min(retryDelay * 1.8, 15000);
      }
    };
    sock.onerror = () => { /* onclose 会跟着触发 */ };
  }

  function disconnect(silent) {
    wantUrl = null;
    clearTimeout(retryTimer);
    if (ws) {
      const s = ws; ws = null;
      try { s.close(); } catch (e) {}
    }
    if (!silent) setStatus('off');
  }

  function send(type, payload) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(Object.assign({ type }, payload || {})));
      return true;
    }
    return false;
  }

  return {
    connect, disconnect, send, on,
    get status() { return status; },
    get connected() { return status === 'on'; }
  };
})();
