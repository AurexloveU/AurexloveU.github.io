# 拾光集 · Aurex 的日记本

一本**低饱和、多主题、离线可用**的中文日记本 DEMO。前端纯静态、零依赖、无外链 CDN,双击即可使用;后端(Node + Express)可选,启动后前端自动探测并同步。

## 目录结构

```
journal/
├── index.html          # 单页应用入口
├── css/
│   ├── themes.css      # 8 套低饱和主题(CSS 自定义属性)
│   └── main.css        # 布局、纸张质感(纯 CSS 渐变)、中文衬线排版
├── js/
│   ├── markdown.js     # 轻量 Markdown 渲染器(先转义再解析,防注入)
│   ├── prompts.js      # 每日写作提示(按日期确定性取题)
│   ├── store.js        # 数据层:localStorage 优先 + 可选后端同步
│   └── app.js          # 应用逻辑:视图、编辑器、图表、导出
├── server/             # 可选后端(不启动也不影响前端)
│   ├── package.json
│   └── server.js       # CRUD + JSON 落盘 + 搜索 + 导出 + 静态托管
└── README.md
```

## 运行

**前端(无需任何安装)**

- 直接用浏览器打开 `index.html` 即可,数据保存在浏览器 localStorage;
- 或用任意静态服务器托管本目录,例如 `python3 -m http.server 8000`。

**后端(可选)**

```bash
cd server
npm install
npm start        # 默认 http://localhost:4870
```

启动后直接访问 `http://localhost:4870/` 即是日记本(后端顺带托管前端)。前端每次启动会自动探测 `http://localhost:4870`,连上后:双向合并数据(按修改时间新者胜),之后所有增删改实时镜像到后端,落盘于 `server/data/entries.json`。也可在「统计与导出」页手动填写 API 地址。

## 主题(8 套,全部低饱和)

| 主题 | 基调 | | 主题 | 基调 |
|---|---|---|---|---|
| 晨雾 mist | 青灰 | | 黄昏 dusk | 灰粉暖褐 |
| 薰衣草 lavender | 灰紫 | | 海盐 seasalt | 淡青 |
| 旧纸 sepia | 泛黄纸页 | | 水墨 ink | 炭黑微青(深色) |
| 鼠尾草 sage | 灰绿 | | 夜航 night | 蓝灰夜色(深色) |

- 左侧色板切换**全局主题**,0.45s 平滑过渡;
- 编辑器右上角下拉框可为**单篇日记指定专属主题**(打开该篇时自动生效,返回列表恢复全局);
- 纸张纤维质感由 CSS 渐变绘制,不使用任何图片。

## 功能

- **书写**:Markdown(标题/粗斜体/引用/列表/代码块/链接/==高亮==)、编写/预览切换、格式工具栏、专注模式(Esc 退出)、自动保存(0.7s 去抖)、字数与预计阅读时长;
- **记录**:五档心情、标签、收藏、置顶、按篇导出 `.md`;
- **回看**:时间线(按月分组、置顶优先)、日历视图(心情表情落点)、全文搜索(标题/正文/标签,命中高亮)、「那年今日」回忆卡片;
- **统计**:篇数/累计字数/连续天数/收藏数、最近 30 天心情折线图(内联 SVG,随主题变色)、心情分布、常用标签云;
- **导出**:全部日记一键导出 `.md` / `.json`(前端本地生成,离线可用;后端另有导出端点);
- **快捷键**:`N` 新建、`Ctrl/⌘+B` 粗体、`Ctrl/⌘+I` 斜体、`Ctrl/⌘+S` 立即保存、`Esc` 退出专注/收起侧栏。

首次打开会生成两篇示例日记(其中一篇日期在一年前,用来演示「那年今日」),可直接删除。

## 后端 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查(前端探测用) |
| GET | `/api/entries` | 列表,支持 `?q= tag= mood= from= to= fav=1 pinned=1` |
| GET | `/api/entries/:id` | 单篇 |
| POST | `/api/entries` | 新建(缺 id 自动生成) |
| PUT | `/api/entries/:id` | 更新/幂等写入(同步用) |
| DELETE | `/api/entries/:id` | 删除 |
| GET | `/api/search?q=` | 全文搜索,返回带上下文片段 |
| GET | `/api/export/markdown` | 导出全部为 Markdown 附件 |
| GET | `/api/export/json` | 导出全部为 JSON 附件 |

## 数据与隐私

- 本地数据只存在浏览器 localStorage(键:`shiguang.entries.v1` / `shiguang.settings.v1`);
- 未连接后端时不发出任何网络请求(仅启动时对本机 4870 端口做一次探测);
- 随时可通过导出功能带走全部数据。
