/* ============================================================
   奕苑 · 公共脚本
   主题(深/浅)、棋盘配色、音效开关 —— 均存 localStorage
   音效由 WebAudio 现场合成,零外部资源。
   ============================================================ */
(function () {
  "use strict";

  var LS = {
    theme: "aurex-theme",     // "light" | "dark"
    board: "aurex-board",     // "lavender" | "ink" | "sage" | "clay" | "moon"
    sound: "aurex-sound"      // "on" | "off"
  };

  var BOARD_SCHEMES = [
    { id: "lavender", name: "薰衣草" },
    { id: "ink",      name: "黛墨" },
    { id: "sage",     name: "苔青" },
    { id: "clay",     name: "陶土" },
    { id: "moon",     name: "月白" }
  ];

  function get(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
  }
  function set(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* 忽略 */ }
  }

  function applyTheme() {
    var t = get(LS.theme, "light");
    if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    var b = get(LS.board, "lavender");
    if (b === "lavender") document.documentElement.removeAttribute("data-board");
    else document.documentElement.setAttribute("data-board", b);
  }

  function toggleTheme() {
    set(LS.theme, get(LS.theme, "light") === "dark" ? "light" : "dark");
    applyTheme();
    refreshButtons();
  }

  function setBoard(id) { set(LS.board, id); applyTheme(); }

  function soundOn() { return get(LS.sound, "on") === "on"; }
  function toggleSound() {
    set(LS.sound, soundOn() ? "off" : "on");
    refreshButtons();
    if (soundOn()) sfx.click();
  }

  /* ---------------- WebAudio 音效 ---------------- */
  var actx = null;
  function ctx() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
    }
    if (actx.state === "suspended") actx.resume();
    return actx;
  }
  function tone(freq, dur, type, vol, when, glide) {
    var a = ctx(); if (!a || !soundOn()) return;
    var t0 = a.currentTime + (when || 0);
    var o = a.createOscillator();
    var g = a.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol) {
    var a = ctx(); if (!a || !soundOn()) return;
    var n = Math.floor(a.sampleRate * dur);
    var buf = a.createBuffer(1, n, a.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = a.createBufferSource(); src.buffer = buf;
    var g = a.createGain(); g.gain.value = vol || 0.1;
    var f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1600;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
  }

  var sfx = {
    click:   function () { tone(660, 0.06, "triangle", 0.10); },
    move:    function () { tone(420, 0.07, "sine", 0.14); noise(0.05, 0.05); },
    capture: function () { tone(300, 0.10, "triangle", 0.16, 0, 180); noise(0.08, 0.09); },
    check:   function () { tone(880, 0.10, "sine", 0.13); tone(660, 0.12, "sine", 0.11, 0.09); },
    dice:    function () { noise(0.12, 0.12); tone(520, 0.05, "square", 0.05, 0.02); },
    win:     function () { tone(523, 0.14, "sine", 0.14); tone(659, 0.14, "sine", 0.14, 0.13); tone(784, 0.22, "sine", 0.15, 0.26); },
    lose:    function () { tone(392, 0.16, "sine", 0.13); tone(330, 0.16, "sine", 0.12, 0.15); tone(262, 0.26, "sine", 0.12, 0.30); },
    illegal: function () { tone(220, 0.09, "square", 0.07); }
  };

  /* ---------------- 页头控件 ---------------- */
  function refreshButtons() {
    var tb = document.getElementById("btn-theme");
    if (tb) tb.textContent = get(LS.theme, "light") === "dark" ? "浅色" : "深色";
    var sb = document.getElementById("btn-sound");
    if (sb) {
      sb.textContent = soundOn() ? "音效 开" : "音效 关";
      sb.classList.toggle("on", soundOn());
    }
    var sel = document.getElementById("sel-board");
    if (sel) sel.value = get(LS.board, "lavender");
  }

  /** 在 .site-nav 里注入标准控件:棋盘配色 / 深浅色 / 音效 */
  function mountControls(nav) {
    if (!nav) return;
    var sel = document.createElement("select");
    sel.id = "sel-board";
    sel.title = "棋盘配色";
    BOARD_SCHEMES.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.id; o.textContent = "配色 · " + s.name;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () { setBoard(sel.value); sfx.click(); });

    var tb = document.createElement("button");
    tb.id = "btn-theme";
    tb.addEventListener("click", function () { toggleTheme(); sfx.click(); });

    var sb = document.createElement("button");
    sb.id = "btn-sound";
    sb.addEventListener("click", toggleSound);

    nav.appendChild(sel); nav.appendChild(tb); nav.appendChild(sb);
    refreshButtons();
  }

  applyTheme();
  document.addEventListener("DOMContentLoaded", function () {
    mountControls(document.querySelector(".site-nav"));
  });

  window.Aurex = {
    sfx: sfx,
    soundOn: soundOn,
    boardSchemes: BOARD_SCHEMES,
    setBoard: setBoard,
    toggleTheme: toggleTheme
  };
})();
