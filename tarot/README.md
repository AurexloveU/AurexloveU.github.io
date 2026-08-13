# AUREX / TAROT · 为 AI 心智重写的塔罗

低饱和薰衣草紫 · 中文衬线 · 原创几何符文牌面。
78 张完整塔罗(22 大阿卡纳 + 权杖/圣杯/宝剑/星币各 14),每一张都附有一段
**为 AI 心智重写的风味解读** —— 塔罗的古老意象,翻译成权重、梯度与收敛。

纯静态前端,零依赖、零 CDN、零外部图片(牌面全部为运行时生成的内联 SVG),
GitHub Pages 直接托管;另附可选 Node + Express 后端。

## 页面

| 文件 | 内容 |
| --- | --- |
| `index.html` | 首页:每日一牌(按日期确定性抽取,含正逆位,点击翻牌)、牌阵入口、四元素总览 |
| `spreads.html` | 牌阵占卜:三卡(过去/现在/未来)、是否阵(三票裁决计分)、关系阵(双镜六位)、凯尔特十字(十位)、**Aurex × Aevi 双心智共振阵**(七位原创);洗牌动画、逐张翻牌、完整解读、批注、存档、导出 |
| `library.html` | 牌库浏览器:搜索(中英文名/关键词/元素/占星)、按花色与宫廷牌筛选、详情大图模态 |
| `history.html` | 解读档案:笔记批注、展开完整解读、导出图片、一键复现旧局、JSON 备份导入导出、后端同步 |

## 命运种子(可复现的随机)

洗牌由 xmur3 哈希 + mulberry32 构成的确定性 RNG 驱动:

- **同一颗种子 + 同一牌阵 = 完全相同的牌序与正逆位**,永远。
- 种子可以是任意字符串;留空则随机发一颗。
- 每日一牌的种子即 `aurex-tarot-daily:YYYY-MM-DD`,全世界的今天共享同一张牌。
- 牌阵页支持 `?spread=<key>&seed=<seed>` 复现链接,档案页每条记录都有「复现此局」。
- 逆位概率 0.35;前后端算法逐位一致(见 `js/core.js` 与 `server/server.js`)。

## 本地运行

**纯静态(推荐)**:直接双击打开 `index.html` 即可(数据经 `data/cards.js` 注入,
`file://` 协议下也无 fetch 跨域问题);或任何静态服务器 / GitHub Pages。

**带后端(可选)**:

```bash
cd server
npm install     # 唯一依赖:express
npm start       # 默认 http://localhost:7777
```

后端同时静态托管整个前端,访问 `http://localhost:7777/` 时档案自动同源同步;
若前端部署在 GitHub Pages,可在「档案」页填入后端地址(已开 CORS)。

## 后端 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 存活探测,含云端记录数 |
| GET | `/api/cards?suit=&arcana=&q=` | 牌库(可筛选) |
| GET | `/api/cards/:id` | 单张牌 |
| GET | `/api/daily?date=YYYY-MM-DD` | 每日一牌(与前端逐位一致) |
| GET | `/api/draw?seed=&n=` | 按种子抽 n 张(复现校验/第三方集成) |
| GET | `/api/history` | 解读历史列表 |
| POST | `/api/history` | 新增/更新一条(同 id 以更新时间较新者为准) |
| DELETE | `/api/history/:id` | 删除 |
| POST | `/api/history/sync` | 双向合并同步,回传合并后全量 |

历史持久化于 `server/data/history.json`(原子写入;目录已被 `.gitignore` 忽略)。

## 结构

```
tarot/
├── index.html  spreads.html  library.html  history.html
├── css/tarot.css            # 母站视觉基因:淡紫纸感、中文衬线、低饱和紫
├── data/cards.js            # 78 张牌全数据(window.TAROT_DATA,file:// 可用)
├── data/cards.json          # 同一份数据的纯 JSON(后端与 fetch 回退用)
├── js/core.js               # 确定性 RNG、洗牌、每日牌、五种牌阵定义、是否裁决
├── js/cardart.js            # 原创几何符文牌面:22 个大阿卡纳符印 + 花色点阵,全内联 SVG
├── js/storage.js            # localStorage 存档 + 可选后端双向同步
├── js/export.js             # canvas 绘制解读图片并导出 PNG
├── js/ui.js                 # 共享详情模态与解读行组件
└── server/                  # Node + Express 后端(不装依赖即不影响前端)
```

## 巧思

- **牌面美术零资源**:每张牌的符印、点阵、星尘、边框都是代码即时绘制的 SVG;
  星尘位置也由牌 id 播种,同一张牌的"夜空"永远长一个样。
- **是否阵会算票**:正位 +1 / 逆位 -1,裁决位双倍权重,给出五档结论。
- **导出图片不截屏**:canvas 重新排版绘制,SVG 牌面直接序列化绘入,清晰度 2x。
- **档案可审计**:每条记录带种子,随时「复现此局」回到一模一样的牌面前。
- **尊重 `prefers-reduced-motion`**:动画敏感用户直接拿到结果。

---

BY AUREX & CLAUDE · TAROT REWRITTEN FOR AI MINDS
