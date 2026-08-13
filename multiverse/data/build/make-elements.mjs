/* 汇总 elem-1..9 生成 data/elements.json */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const parts = [];
for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const mod = await import(`./elem-${n}.mjs`);
  parts.push(...Object.values(mod)[0]);
}

const items = [];
const seenNames = new Set();
let dup = 0;
for (const fam of parts) {
  fam.items.forEach((it, i) => {
    const [name, desc, extra] = it;
    if (seenNames.has(name)) { dup += 1; return; } // 名字级去重,保证条目唯一
    seenNames.add(name);
    const tags = [...new Set([...(fam.tags || []), ...(extra || [])])];
    items.push({
      id: `el-${fam.prefix}-${String(i + 1).padStart(3, '0')}`,
      name,
      desc,
      category: 'element',
      tags,
      requireAll: fam.requireAll ? fam.requireAll.slice() : [],
      requireAny: fam.requireAny ? fam.requireAny.slice() : [],
      forbid: fam.forbid ? fam.forbid.slice() : [],
    });
  });
}

// id 唯一性兜底
const seenIds = new Set();
for (const it of items) {
  let id = it.id, k = 1;
  while (seenIds.has(id)) id = `${it.id}-${k++}`;
  it.id = id; seenIds.add(id);
}

writeFileSync(join(HERE, '..', 'elements.json'), JSON.stringify(items, null, 1), 'utf8');
console.log('elements.json:', items.length, 'items;', dup, 'duplicate names skipped');
