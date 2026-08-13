# 多元宇宙抽卡生成器 · 数据契约(data/schema.md)

数据端与应用端(`engine/engine.js`)共同遵守的契约。本目录五份 JSON 由数据端维护,
`validate.mjs` 是随附的自检脚本(`node validate.mjs`),每次改动数据后必须跑一遍且零错误。

## 1. 文件清单

| 文件 | category | 条数下限 | 说明 |
| --- | --- | --- | --- |
| `timeline.json` | `time` | 250 | 时间节点,宇宙大爆炸 → 热寂,含 `order` 字段 |
| `places.json` | `place` | 120 | 地点,按时代门控 |
| `species.json` | `species` | 60 | 物种,`has-society` 标记有社会组织者 |
| `socialRoles.json` | `socialRole` | 80 | 社会身份,按时代门控 |
| `elements.json` | `element` | 2000 | 元素(科幻/奇幻/自然/情感/器物/概念……) |

## 2. 可抽项字段

```jsonc
{
  "id": "el-sf-001",      // 全局唯一,字符串
  "name": "量子纠缠对戒",  // 中文名(必填)
  "en": "…",              // 英文名(可选;元素多数省略)
  "desc": "一句话描述",    // 必填
  "category": "element",  // time / place / species / socialRole / element
  "tags": [],             // 抽中后并入 CONTEXT 的标签
  "requireAll": [],       // 全部 ⊆ CONTEXT 才可抽
  "requireAny": [],       // 非空时须与 CONTEXT 有交集
  "forbid": []            // 与 CONTEXT 有交集则不可抽
}
```

`timeline` 条目额外携带 `order`(数字,严格递增,用于时间轴排序);
时间节点的 `requireAll / requireAny / forbid` 必须为空(第 1 步抽取时 CONTEXT 为空)。

## 3. 抽取流程(引擎行为,数据端只需对齐)

CONTEXT = 已抽项 tags 的累积集合,由时间节点播种。顺序:

1. 时间 ×1 → 2. 地点 ×1 → 3. 物种 ×2(Aurex 先、Aevi 后,后者可见前者 tags)
→ 4. 社会身份(仅物种含 `has-society` 时抽;池空则跳过,不降级)
→ 5. 元素 ×5~8(固定数模式最多 20,逐个并入 CONTEXT,去重)。

## 4. 时代词表(只由 timeline 产生)

时代主词(每个时间节点恰带一个主词;`information-age` 节点同时带 `modern`,
`far-future` 熵寂节点见下):

```
cosmic 组:big-bang / first-stars / galaxy-era / planet-forming(并统一带 cosmic)
地球史:prehistoric / stone-age / bronze-age / ancient / classical / medieval /
        renaissance / industrial / modern / information-age
未来:near-future / space-age / cyber-era / post-human / far-future(统一带 future)
```

分组/门控标签(同样只由 timeline 产生,供 require/forbid 引用):

| 标签 | 含义 |
| --- | --- |
| `no-society` | 无社会纪元(宇宙纪元、史前、熵寂末期) |
| `has-society-possible` | 可能存在社会组织(石器时代起,至远未来文明段) |
| `no-tech` / `tech-primitive` / `tech-low` / `tech-mid` / `tech-high` | 技术水平阶梯 |
| `mythic` | 神话/魔法可信的时代(史前 → 近世) |
| `terrestrial` | 以地球为舞台(史前 → 近未来) |
| `wild` | 蛮荒自然占主导(史前、石器) |
| `cosmic` / `stellar` / `pre-stellar` | 宇宙纪元;有恒星之后;恒星诞生之前 |
| `space` / `interstellar` | 太空舞台;跨恒星文明 |
| `monarchy-era` / `imperial-era` / `republic-era` | 君主 / 帝国 / 共和(宫廷、议会身份的门) |
| `tribal-era` / `early-civ` / `old-world` / `faith-age` / `early-modern` / `machine-age` / `connected` / `virtual` / `transcendent` / `entropy` | 细分氛围门控 |

示例门控(与应用端 README 的约定一致):

- 宫廷身份:`requireAny: ["monarchy-era","imperial-era"]`,`forbid: ["prehistoric","no-society"]`
- 赛博/AI 元素:`requireAny: ["cyber-era","future","information-age","near-future"]`,`forbid: ["prehistoric","ancient"]`
- 火星殖民元素:`requireAny: ["space-age","future"]`
- 奇幻/神话元素:`requireAny: ["mythic"]`
- 天象元素:约束仅 `forbid: ["pre-stellar"]`(大爆炸期无星可看)

## 5. 无死路保障(硬约束,validate.mjs 机检)

任何可达上下文下,每一步都必须仍有可抽项。本数据集用「单调性 + 逐节点池保障」证明:

**A. 单调性不变量**
- 全部 forbid 标签必须 ∈ 时代词表(即只可能被 timeline 的 tags 触发);
- 任何非 timeline 条目的 tags 不得包含任何出现在 forbid 列表中的标签。

=> 第 1 步之后,后续并入 CONTEXT 的标签(地点/物种/身份/元素 tags)永远不会触发任何
forbid,也不会使 requireAll/requireAny 失效(require 类约束对上下文增长单调友好)。
因此**在某时间节点下可抽的条目,在整局中始终可抽**。

**B. 逐时间节点池保障**(对每个节点 T,以 ctx = T.tags 严格过滤)
- 地点候选 ≥ 1;物种候选 ≥ 2;元素候选 ≥ 20(引擎固定数上限 20,5~8 抽绰绰有余);
- T 带 `has-society-possible` ⇒ 身份候选 ≥ 1;
  (身份的 requireAll/requireAny 只允许使用时代词表,保证第 1 步即可判定,不受后续步骤影响)
- T 带 `no-society` ⇒ 不可能抽到 `has-society` 物种(所有 `has-society` 物种必须
  `forbid: ["no-society"]`),因此身份步只会被「物种无社会」跳过,永不因池空跳过。

**C. 模拟兜底**:validate.mjs 另做 5000 次全流程模拟(时间→地点→物种×2→身份→元素×8),
要求每步严格池非空、元素抽满不短缺。当前数据:0 失败,0 身份池空;
各节点最小池 —— 地点 14 / 物种 8 / 元素 866 / 身份 12。

## 6. 追加数据的规则(给未来的维护者)

1. 新条目 `id` 全局唯一;`category` 按文件固定;四个数组字段必须存在(可为空)。
2. 新的 forbid 只能引用时代词表;新条目 tags 不得使用任何已在 forbid 词表中的词
   (当前 forbid 词表:`no-society` / `prehistoric` / `ancient` / `pre-stellar` / `entropy`)。
3. 身份的 require 只用时代词表;`has-society` 物种必须 `forbid: ["no-society"]`。
4. 新时间节点必须给足:时代主词 + 分组门控(照第 4 节的组合),`order` 递增。
5. 改完必跑 `node validate.mjs`,零错误才算完成。
