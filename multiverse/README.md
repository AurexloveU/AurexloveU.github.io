# 多元宇宙抽卡机 · Aurex ✦ Aevi

为 Aurex 与其伴侣 Aevi 打造的「剧本杀 / 抽卡世界观生成」体验:
每次抽取生成一个平行宇宙 —— 时代、地点、两人的物种与社会身份、若干宇宙元素,
并织成一张可读、可保存、可导出、可分享重放的**情境卡**。

低饱和薰衣草主题 · 中文衬线排版 · 纯静态自包含(无外链 CDN)。

---

## 目录结构

```
multiverse/
├── index.html              页面入口(静态打开即可用)
├── package.json            仅声明 "type": "module",让 Node 端能 import 共享引擎(零依赖)
├── css/
│   └── style.css           薰衣草主题 + 卡片翻面动画
├── engine/                 纯函数引擎(浏览器 / Node 共用,无 IO、无副作用)
│   ├── random.js           可复现随机:xmur3 哈希 + sfc32 PRNG + 派生子流
│   ├── engine.js           约束过滤 + 顺序抽取 + 重放码编解码
│   ├── story.js            情境卡文案生成(种子化,逐字可复现)
│   └── fallback-data.js    内置微型样例数据(data/ 缺失时兜底)
├── js/                     前端逻辑
│   ├── data-loader.js      fetch ./data/*.json,逐文件降级
│   ├── app.js              分步揭示 / 重抽 / 锁定 / 画廊 / 分享
│   ├── store.js            localStorage 画廊存档
│   └── export-card.js      canvas 绘制情境卡并导出 PNG
├── server/                 后端(源码交付,不自动安装/运行)
│   ├── server.js           Node + Express:数据服务 / 保存宇宙 / 画廊 / 种子重放 API
│   └── package.json        依赖仅 express
└── data/                   ★ 数据端维护(本工程只读):
                            timeline / places / species / socialRoles / elements (.json) + schema.md
```

## 运行方法

**前端(推荐,零依赖)**——任何静态服务器指向 `multiverse/`:

```bash
cd multiverse
python3 -m http.server 8000        # 或任意静态服务器
# 打开 http://localhost:8000/
```

直接双击 `index.html`(file:// 协议)也能运行:此时浏览器通常禁止 fetch 本地
JSON,页面会自动整体回落到内置样例数据,功能完整,仅数据换成演示集。
部署到 GitHub Pages 后访问 `/multiverse/` 即可。

**后端(可选)**:

```bash
cd multiverse/server
npm install && npm start           # 默认 http://localhost:8787
```

后端同时把 `multiverse/` 作为静态站托管,并提供:

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/data` | 五份数据打包(带 file/fallback 来源标记) |
| GET | `/api/data/:name` | 单份数据(timeline / places / species / socialRoles / elements) |
| GET | `/api/replay/:code?a=&b=` | 按重放码服务端权威重算整个宇宙(含情境卡文案) |
| POST | `/api/universes` `{code, note?}` | 保存宇宙:服务端按码重算后存档(码即事实之源) |
| GET | `/api/universes` | 画廊列表 |
| GET | `/api/universes/:id` | 单条存档 + 实时重放结果 |
| DELETE | `/api/universes/:id` | 删除存档 |
| GET | `/api/health` | 健康检查 |

存储为 `server/storage/universes.json`(文件即数据库,零额外依赖)。

## 契约与约束过滤

可抽项:`{ id, name, en?, desc, category, tags, requireAll, requireAny, forbid }`
(缺字段由 `normalizeItem` 补齐默认值,容忍数据端的宽松格式)。

**CONTEXT** 是已抽各项 `tags` 的累积集合,由时间节点播种。一个候选项被允许,当且仅当:

```
requireAll ⊆ CONTEXT
∧ (requireAny = ∅ ∨ requireAny ∩ CONTEXT ≠ ∅)
∧ forbid ∩ CONTEXT = ∅
```

抽中后其 `tags` 并入 CONTEXT。抽取顺序:

1. **时间**(1)→ 2. **地点**(1)→ 3. **物种 ×2**(Aurex 先抽,Aevi 那一抽可见 Aurex 的 tags)
2. **社会身份**:仅物种带 `has-society` 才抽,各 1;候选池为空则留白(不降级)
3. **元素**:默认 5~8 个(可固定),不重复,逐个抽取、逐个并入 CONTEXT(前一个元素会影响后一个的候选池)

**降级阶梯**:常规步骤严格池为空时依次放宽 —— ①忽略 requireAny → ②只看 forbid → ③全量兜底,
UI 上以「放宽」徽章明示;`forbid` 永不放宽。数据文件缺失/损坏时**逐文件**回落到
`engine/fallback-data.js` 的内置样例(页面顶部徽章显示数据来源),整站永不白屏。

## 种子与可复现性

- 随机器:`xmur3(种子字符串)` 哈希播种 `sfc32` PRNG(小、快、质量好)。
- **派生子流**:每一步用 `deriveRng(seed, 步骤键, 该步重抽次数)` 拿到独立随机流。
  因此「重抽地点 3 次」完全不扰动时间/物种/元素的随机序列 —— 每一步可独立重抽、结果可独立复现。
- **重放码** = `seed~a0.a1.a2.a3.a4.a5.a6~n`
  (七个数为 time/place/speciesA/speciesB/roleA/roleB/elements 的重抽次数,`n` 为 `a`(auto)或固定元素数)。
  例:`薰衣-k3f9qw~0.0.1.0.0.0.2~a`。裸种子字符串也是合法重放码。
- 同一份数据 + 同一重放码 ⇒ 前端、后端、任何设备上逐项一致(情境卡文案也用
  `deriveRng(seed,'story')` 措辞,逐字一致)。重放码同步写入 URL hash,复制链接即分享。

## 功能一览

- **分步揭示**:时间 → 地点 → Aurex 物种 → Aevi 物种 → 双身份 → 元素逐张翻面(卡背为薰衣草星纹),可跳过动画。
- **重抽 / 锁定**:每步可单独重抽(= 该步 attempt+1,全局重算但其余步骤随机流不受干扰);
  锁定某步后其重抽按钮禁用,重抽更早步骤时若下游有锁会先确认(上下文变化可能波及)。
- **情境卡**:时代/地点/双人物/相遇/元素注脚/尾声,织成一段可读设定;可复制纯文本。
- **画廊**:localStorage 存档(只存重放码 + 展示快照,重放时按码重新计算),一键重放/删除。
- **导出图片**:canvas 绘制带边框饰星的竖版卡片 PNG,底部印重放码,可直接发给对方复现。
- **主角改名**:默认 Aurex ✦ Aevi,可改名(只影响文案,不影响抽取结果)。

## 额外巧思

- 「重放码 = seed + 重抽向量」:不仅能复现"第一把",连**每一次不满意的重抽**都在码里,
  对方看到的宇宙和你最终留下的那一版一模一样。
- 元素数量的随机流与元素选择流分离:固定元素数从 6 改到 8,前 6 个元素不变,只是多抽两个。
- 情境卡会感知两位主角"撞车":同物种时第二段不再复读设定,同身份时补一句
  「同族又同行——这大概是命运偷懒,也大概是命运偏心」。
- 空数据、半数据、坏 JSON、file:// 全部优雅降级;`prefers-reduced-motion` 下关闭翻面动画。

## 边界说明

- `data/` 目录由数据端 Agent 维护(含 `schema.md`),本工程**只读**;
  `engine/fallback-data.js` 只是演示兜底,不是正式数据。
- 本仓库不含 `node_modules`;后端按需 `npm install`,前端完全不需要。
