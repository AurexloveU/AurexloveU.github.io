/* ============================================================
   奕苑 · 联机客户端(可选模块)
   封装与 games/server 的 WebSocket 协议。
   前端完全可以离线玩;本模块仅在用户主动连接时使用。
   ============================================================ */
(function () {
  "use strict";

  /**
   * new AurexNet.Client({
   *   url, game: "chess"|"gomoku", name,
   *   onStatus(text), onRoom({room, side, players}), onStart(),
   *   onMove(data), onPeerLeave(), onResult(result), onError(msg)
   * })
   */
  function Client(opts) {
    this.opts = opts || {};
    this.ws = null;
    this.room = null;
    this.side = null;      // 我执哪方(chess: "w"/"b";gomoku: 1/2)
    this.connected = false;
  }

  Client.prototype._emit = function (name, arg) {
    var fn = this.opts[name];
    if (typeof fn === "function") { try { fn(arg); } catch (e) { /* 回调错误不阻断 */ } }
  };

  Client.prototype.connect = function (then) {
    var self = this;
    var url = this.opts.url;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this._emit("onError", "无法建立连接:" + e.message);
      return;
    }
    this.ws.onopen = function () {
      self.connected = true;
      self._emit("onStatus", "已连接服务器");
      if (then) then();
    };
    this.ws.onclose = function () {
      self.connected = false;
      self.room = null;
      self._emit("onStatus", "连接已断开");
    };
    this.ws.onerror = function () {
      self._emit("onError", "连接出错(请确认后端已启动、地址正确)");
    };
    this.ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      switch (msg.type) {
        case "created":
        case "joined":
          self.room = msg.room;
          self.side = msg.side;
          self._emit("onRoom", msg);
          break;
        case "start":
          self._emit("onStart", msg);
          break;
        case "move":
          self._emit("onMove", msg.data);
          break;
        case "peer-leave":
          self._emit("onPeerLeave");
          break;
        case "result":
          self._emit("onResult", msg);
          break;
        case "error":
          self._emit("onError", msg.message || "服务器返回错误");
          break;
      }
    };
  };

  Client.prototype._send = function (obj) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  };

  Client.prototype.createRoom = function () {
    var self = this;
    var doit = function () {
      self._send({ type: "create", game: self.opts.game, name: self.opts.name || "无名氏" });
    };
    if (this.connected) doit(); else this.connect(doit);
  };

  Client.prototype.joinRoom = function (code) {
    var self = this;
    var doit = function () {
      self._send({ type: "join", room: String(code || "").trim().toUpperCase(), name: self.opts.name || "无名氏" });
    };
    if (this.connected) doit(); else this.connect(doit);
  };

  /** data 由各游戏自定义(chess 传 {from,to,promo};gomoku 传 {x,y}) */
  Client.prototype.sendMove = function (data) { this._send({ type: "move", data: data }); };

  /** result: "1-0" | "0-1" | "1/2-1/2",reason 为文字说明 */
  Client.prototype.sendResult = function (result, reason) {
    this._send({ type: "result", result: result, reason: reason || "" });
  };

  Client.prototype.resign = function () { this._send({ type: "resign" }); };

  Client.prototype.leave = function () {
    if (this.ws) { try { this.ws.close(); } catch (e) { /* 忽略 */ } }
    this.ws = null; this.room = null; this.connected = false;
  };

  /** 猜一个默认服务器地址:同源(经 server 托管时)或本机 8787 */
  function defaultUrl() {
    var proto = location.protocol === "https:" ? "wss://" : "ws://";
    if (location.port === "8787") return proto + location.host;
    return "ws://localhost:8787";
  }

  window.AurexNet = { Client: Client, defaultUrl: defaultUrl };
})();
