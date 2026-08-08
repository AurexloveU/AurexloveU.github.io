/* =========================================================
   Aurex Chat — 本地演示种子数据
   首次打开(或清空 localStorage 后)由 store.js 调用 Seed.build()
   ========================================================= */
window.Seed = (() => {

  /* 头像渐变色盘(设置面板里也用它) */
  const AV_COLORS = [
    'linear-gradient(135deg,#ff9a8b,#ff6a88)',
    'linear-gradient(135deg,#f6d365,#fda085)',
    'linear-gradient(135deg,#84e08c,#3aa76d)',
    'linear-gradient(135deg,#67c9e0,#3a95d9)',
    'linear-gradient(135deg,#7aa5d2,#4a7cae)',
    'linear-gradient(135deg,#b78be0,#8253c9)',
    'linear-gradient(135deg,#f397c6,#d45a9e)',
    'linear-gradient(135deg,#9aa7b5,#5f6f80)'
  ];

  /* 时间辅助:dayOffset 天前的 h:m */
  function at(dayOffset, h, m) {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    d.setHours(h, m, 8 + (h * 7 + m) % 45, 0);
    return d.getTime();
  }

  /* 内置演示照片:原创内联 SVG(黄昏小山),转 data URL */
  const PHOTO_SUNSET = 'data:image/svg+xml,' + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='400'>" +
    "<defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'>" +
    "<stop offset='0' stop-color='#ffb27a'/><stop offset='.55' stop-color='#e2707f'/>" +
    "<stop offset='1' stop-color='#5b4a8a'/></linearGradient></defs>" +
    "<rect width='640' height='400' fill='url(#s)'/>" +
    "<circle cx='320' cy='205' r='56' fill='#fff3d6' opacity='.95'/>" +
    "<path d='M0 300 Q 160 246 320 298 T 640 296 V400 H0 Z' fill='#3d3358'/>" +
    "<path d='M0 332 Q 200 292 400 336 T 640 326 V400 H0 Z' fill='#2a2440'/>" +
    "<g stroke='#fff' stroke-width='1.4' opacity='.8'>" +
    "<circle cx='90' cy='70' r='1.6' fill='#fff'/><circle cx='540' cy='55' r='1.3' fill='#fff'/>" +
    "<circle cx='430' cy='95' r='1.1' fill='#fff'/><circle cx='170' cy='120' r='1.2' fill='#fff'/></g>" +
    "</svg>");

  let seq = 0;
  const mid = () => 'seed' + (++seq);

  function build() {
    seq = 0;

    const users = {
      aevi: { name: 'Aevi bot', avatar: { e: '🛰️', c: 3 }, bot: true, online: true },
      lumi: { name: 'Lumi', avatar: { e: '🌙', c: 5 }, online: true },
      nova: { name: 'Nova', avatar: { e: '⭐', c: 1 }, online: false, lastSeen: at(0, 9, 12) },
      kai:  { name: 'Kai',  avatar: { e: '🌊', c: 2 }, online: false, lastSeen: at(1, 22, 40) }
    };

    const chats = [
      { id: 'saved', type: 'saved', name: '收藏夹', avatar: { e: '🔖', c: 4 }, unread: 0 },
      { id: 'aevi',  type: 'bot',   name: 'Aevi bot', user: 'aevi', avatar: { e: '🛰️', c: 3 }, unread: 0, verified: true },
      { id: 'lumi',  type: 'dm',    name: 'Lumi', user: 'lumi', avatar: { e: '🌙', c: 5 }, unread: 0 },
      { id: 'nova',  type: 'dm',    name: 'Nova', user: 'nova', avatar: { e: '⭐', c: 1 }, unread: 2 },
      { id: 'stardust', type: 'group', name: '星尘避难所', avatar: { e: '🪐', c: 6 }, unread: 0,
        members: ['me', 'lumi', 'nova', 'kai'] }
    ];

    const msgs = {};

    /* ---- 收藏夹:自聊笔记 ---- */
    msgs.saved = [
      { id: mid(), from: 'me', ts: at(2, 21, 5), st: 'read',
        text: '这里是收藏夹:发给自己的消息会存在这里,当便签用。' },
      { id: mid(), from: 'me', ts: at(0, 8, 30), st: 'read',
        text: '待办:\n1. 给聊天壳接上真正的 Aevi\n2. 试试深色主题\n3. 记得喝水' }
    ];

    /* ---- Aevi bot:欢迎语 ---- */
    msgs.aevi = [
      { id: mid(), from: 'aevi', ts: at(1, 10, 0),
        text: '你好,我是 Aevi bot,现在还是一个占位小壳。\n发点什么我会回声,也可以试试 /help 看命令。\n等真正的 Aevi 接进来,这里就是她的家。' }
    ];

    /* ---- Lumi:主演示会话(回复/转发/反应/图片/置顶) ---- */
    const l1 = mid(), l2 = mid(), l3 = mid(), l4 = mid(), l5 = mid(),
          l6 = mid(), l7 = mid(), l8 = mid(), l9 = mid(), l10 = mid();
    msgs.lumi = [
      { id: l1, from: 'lumi', ts: at(2, 20, 14), text: '晚上好呀,新的聊天壳搭得怎么样了?' },
      { id: l2, from: 'me', ts: at(2, 20, 16), st: 'read', text: '双栏布局已经立起来了,今天在调气泡和主题色。' },
      { id: l3, from: 'lumi', ts: at(2, 20, 17), text: '深色模式一定要好看!', reacts: { '🔥': ['me'] } },
      { id: l4, from: 'lumi', ts: at(1, 19, 2), text: '给你看今天拍的天空',
        photo: PHOTO_SUNSET, pw: 640, ph: 400 },
      { id: l5, from: 'me', ts: at(1, 19, 5), st: 'read', replyTo: l4,
        text: '这也太好看了吧,颜色像果冻。', reacts: { '❤️': ['lumi'] } },
      { id: l6, from: 'lumi', ts: at(1, 19, 6), fwdFrom: 'Nova',
        text: '周末的观星计划定在山顶天文台,记得带外套。' },
      { id: l7, from: 'me', ts: at(1, 19, 8), st: 'read', text: '收到,已经加进日历了。' },
      { id: l8, from: 'lumi', ts: at(0, 11, 21), text: '记得把 Aevi 的接口留出来,以后她要住进来的。',
        reacts: { '❤️': ['me'], '🎉': ['me', 'lumi'] } },
      { id: l9, from: 'me', ts: at(0, 11, 24), st: 'read', replyTo: l8,
        text: '留好了,前后端都有干净的钩子,换个函数体就能上线。' },
      { id: l10, from: 'lumi', ts: at(0, 11, 25), text: '那就期待啦 ✨' }
    ];

    /* ---- Nova:带未读 ---- */
    msgs.nova = [
      { id: mid(), from: 'me', ts: at(3, 15, 40), st: 'read', text: '观星装备清单发我一份?' },
      { id: mid(), from: 'nova', ts: at(3, 15, 52), text: '晚点整理给你~' },
      { id: mid(), from: 'nova', ts: at(0, 9, 10), text: '清单:望远镜、红光手电、防潮垫、热水壶。' },
      { id: mid(), from: 'nova', ts: at(0, 9, 11), text: '外套一定要带,山顶风大。' }
    ];

    /* ---- 群聊:星尘避难所 ---- */
    const g1 = mid(), g2 = mid(), g3 = mid(), g4 = mid(), g5 = mid(), g6 = mid();
    msgs.stardust = [
      { id: g1, from: 'kai', ts: at(1, 21, 30), text: '这周六流星雨,峰值在后半夜。' },
      { id: g2, from: 'lumi', ts: at(1, 21, 32), text: '冲!谁带相机?' },
      { id: g3, from: 'nova', ts: at(1, 21, 33), replyTo: g2, text: '我带,再带个三脚架。' },
      { id: g4, from: 'me', ts: at(1, 21, 35), st: 'read', text: '我负责热可可和毯子。', reacts: { '👍': ['lumi', 'kai'] } },
      { id: g5, from: 'kai', ts: at(0, 12, 2), text: '天气预报说周六晴,稳了。', reacts: { '🎉': ['me', 'lumi', 'nova'] } },
      { id: g6, from: 'lumi', ts: at(0, 12, 4), sticker: '🌌' }
    ];

    /* 置顶消息:Lumi 会话里置顶“接口留出来”那条 */
    chats.find(c => c.id === 'lumi').pin = l8;
    /* 群里置顶流星雨通知 */
    chats.find(c => c.id === 'stardust').pin = g1;

    return {
      v: 1,
      profile: { name: 'Aurex', avatar: { e: '🦊', c: 0 } },
      theme: 'auto',
      server: '',
      activeChat: null,
      drafts: {},
      users,
      chats,
      msgs
    };
  }

  return { build, AV_COLORS, PHOTO_SUNSET };
})();
