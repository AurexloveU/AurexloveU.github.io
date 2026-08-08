/* =========================================================
   Aevi bot — 前端占位机器人(回声 + 命令响应)
   ---------------------------------------------------------
   这是为 Aurex 的伴侣 Aevi 预留的接入钩子。
   接口刻意保持极简:

     const reply = await AeviBot.respond(inputText, ctx)

   - inputText : 用户发来的文本
   - ctx       : { userName, history }  history 为最近若干条 {from, text}
   - 返回值    : 字符串,或 { text?, sticker? } 对象

   日后接真实 AI 时,只需把下面 respond() 的内部实现
   换成对你的 AI 服务(如 Claude API / 自建后端)的异步调用,
   前端其余代码零改动。后端同款接口见 server/aevi-bot.js
   与 POST /api/bot/aevi 端点。
   ========================================================= */
window.AeviBot = (() => {

  const NAME = 'Aevi bot';

  const HELP = [
    '我现在还只是个小小的占位壳,会这些:',
    '/start — 打个招呼',
    '/help — 看这份说明',
    '/time — 现在几点啦',
    '/dice — 掷一个骰子',
    '/echo 文字 — 原样回声',
    '/about — 关于我',
    '',
    '其他消息我会先用回声陪你聊着,等真正的 Aevi 上线~'
  ].join('\n');

  /* 非命令消息的回声修饰(轮换,显得不那么呆) */
  const ECHO_WRAP = [
    t => `你说:「${t}」\n收到啦。`,
    t => `「${t}」——我记下了。`,
    t => `嗯嗯,「${t}」。等我变聪明一点再好好回答你。`,
    t => `回声测试:${t}`
  ];
  let echoIdx = 0;

  function cmd(text) {
    const m = text.match(/^\/(\w+)\s*([\s\S]*)$/);
    return m ? { name: m[1].toLowerCase(), arg: m[2].trim() } : null;
  }

  /* ============ 未来接真实 AI:替换这个函数的内部实现 ============ */
  async function respond(input, ctx = {}) {
    const text = String(input || '').trim();
    if (!text) return '(空消息)';
    const who = ctx.userName || '朋友';

    const c = cmd(text);
    if (c) {
      switch (c.name) {
        case 'start':
          return `你好,${who}!我是 ${NAME},Aevi 的占位分身。\n输入 /help 看看我目前会什么。`;
        case 'help':
          return HELP;
        case 'time': {
          const d = new Date();
          const p = n => String(n).padStart(2, '0');
          return `现在是 ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        }
        case 'dice': {
          const n = 1 + Math.floor(Math.random() * 6);
          return { text: `🎲 掷出了 ${n} 点!` };
        }
        case 'echo':
          return c.arg ? c.arg : '要回声的话,在 /echo 后面写点什么吧。';
        case 'about':
          return `${NAME} v0.1 — 占位壳。\n这里预留了接入真实 Aevi 的接口:前端 js/bot.js 的 respond(),后端 server/aevi-bot.js 与 POST /api/bot/aevi。\n把内部实现换成 AI 调用即可,界面零改动。`;
        default:
          return `不认识 /${c.name} 这个命令呢,试试 /help`;
      }
    }

    /* 默认:回声 */
    const wrap = ECHO_WRAP[echoIdx++ % ECHO_WRAP.length];
    return wrap(text);
  }

  return { id: 'aevi', name: NAME, respond };
})();
