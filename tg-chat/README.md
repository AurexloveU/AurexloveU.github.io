# Aurex Chat — Telegram 风格聊天壳 DEMO

给 Aurex 的双栏聊天外壳:前端纯静态、零依赖、无外链 CDN,可直接打开演示;
另附可选后端(Node + Express + WebSocket 源码,不需要安装也能用前端)。
所有图标为内联 SVG 原创绘制,不含 Telegram 商标或官方素材。

## 文件清单

```
tg-chat/
├── index.html          页面骨架(双栏布局 + 浮层)
├── README.md           本文件
├── .gitignore
├── css/
│   └── style.css       主题变量(深/浅色)+ 全部组件样式
├── js/                 按加载顺序:
│   ├── emoji.js        表情 / 贴纸 / 快捷反应数据
│   ├── bot.js          Aevi bot 前端占位(回声 + 命令,预留 AI 钩子)
│   ├── data.js         本地演示种子数据(会话 / 消息 / 头像色盘)
│   ├── store.js        状态存储 + localStorage 持久化
│   ├── net.js          WebSocket 客户端(可选,协议注释在文件头)
│   └── app.js          主控制器(全部交互逻辑)
└── server/             可选后端(源码,未安装未运行)
    ├── package.json    依赖:express、ws
    ├── server.js       静态托管 + REST + WebSocket 实时服务
    └── aevi-bot.js     Aevi bot 服务器端占位(与前端同款逻辑)
```

## 运行方法

### 1. 纯前端(本地演示模式,推荐先看这个)

直接用浏览器打开 `tg-chat/index.html` 即可,无需任何构建或服务。
想走 http 的话,任选一种静态服务(可选):

```bash
cd tg-chat
python3 -m http.server 8080     # 或任何静态服务器
```

无后端时,联系人回复、已读双勾、正在输入等均由本地模拟数据驱动,
所有数据存在浏览器 localStorage,完整功能可演示。

### 2. 带后端(实时模式,可选)

```bash
cd tg-chat/server
npm install
npm start                        # 默认端口 8790
```

然后打开 `http://localhost:8790/`(后端顺带托管前端),
在 设置 → 实时服务器 填 `ws://localhost:8790` 点“连接”:

- 出现「大厅(服务器)」房间,多开几个浏览器窗口即是多人实时聊天;
- Aevi bot 会话自动切到服务器版 bot(每个用户私有房间,互不可见);
- presence(在线人数)、输入状态、已读回执实时同步;
- 消息持久化在 `server/data/db.json`(已被 .gitignore 忽略)。

后端还提供 REST:
`GET /api/health`、`GET /api/rooms`、`GET/POST /api/rooms/:id/messages`、
`POST /api/bot/aevi`(`{text, userName}` → `{reply}`)。

## 功能一览

- 会话列表 + 聊天窗双栏;窄屏(≤720px)自动切换单栏,带返回键
- 消息气泡、按日期分隔、发送中 / 单勾 / 已读双勾、正在输入动画
- 右键(或长按)消息:回复、复制、转发、置顶、编辑、删除、快捷反应
- 会话内搜索(高亮 + 上下跳转)、侧栏会话搜索
- 表情选择器(分类)+ 贴纸页 + reactions;消息置顶条、会话置顶
- 图片附件:选择或拖拽发送,自动压缩为 data URL,点击看大图
- 深 / 浅色主题 + 跟随系统;设置面板(头像表情、底色、昵称、服务器地址、重置数据)
- Saved Messages 收藏夹自聊;草稿按会话保存
- Aevi bot 占位:回声 + `/start` `/help` `/time` `/dice` `/echo` `/about`

## Aevi 接入钩子(重点)

界面与逻辑已完全解耦,日后接真实 Aevi 只动一处:

- 前端:`js/bot.js` 里的 `AeviBot.respond(input, ctx)` —— 把内部实现换成
  对 AI 服务的异步调用,返回字符串或 `{text, sticker}` 即可,UI 零改动;
- 后端:`server/aevi-bot.js` 同名 `respond()`,或直接把
  `POST /api/bot/aevi` 反代到真正的 AI 服务。

`ctx` 里带 `userName` 与最近 8 条 `history`,足够做上下文接入的起点。

## 本轮补全内容

前一轮已有 `index.html`、`css/style.css`、`.gitignore`(js/ 与 server/ 为空目录)。
本轮补齐:`js/emoji.js`、`js/bot.js`、`js/data.js`、`js/store.js`、
`js/net.js`、`js/app.js`、`server/package.json`、`server/server.js`、
`server/aevi-bot.js`、`README.md` —— 即全部逻辑层与后端源码及文档。
