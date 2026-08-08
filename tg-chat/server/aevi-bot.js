/* =========================================================
   Aevi bot — 服务器端占位实现(与前端 js/bot.js 同款逻辑)
   ---------------------------------------------------------
   为 Aurex 的伴侣 Aevi 预留的后端钩子。接口:

     const reply = await aevi.respond(inputText, ctx)
       inputText : 用户文本
       ctx       : { userName?, history? }
       返回      : 字符串 或 { text?, sticker? }

   日后接真实 AI:把 respond() 内部换成对 AI 服务的调用
   (例如 Claude API),路由与 WebSocket 层零改动。
   对外暴露位置:
     - WebSocket:发到 'aevi' 房间的消息自动走这里
     - REST:POST /api/bot/aevi  { text, userName } → { reply }
   ========================================================= */
'use strict';

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
        return `你好,${who}!我是 ${NAME}(服务器版),Aevi 的占位分身。\n输入 /help 看看我目前会什么。`;
      case 'help':
        return HELP;
      case 'time': {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return `服务器时间:${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      }
      case 'dice':
        return { text: `🎲 掷出了 ${1 + Math.floor(Math.random() * 6)} 点!` };
      case 'echo':
        return c.arg ? c.arg : '要回声的话,在 /echo 后面写点什么吧。';
      case 'about':
        return `${NAME} v0.1(服务器版)— 占位壳。\n接入真实 Aevi:改写 server/aevi-bot.js 的 respond(),或让 POST /api/bot/aevi 转发到你的 AI 服务。`;
      default:
        return `不认识 /${c.name} 这个命令呢,试试 /help`;
    }
  }
  return ECHO_WRAP[echoIdx++ % ECHO_WRAP.length](text);
}

module.exports = { id: 'aevi', name: NAME, respond };
