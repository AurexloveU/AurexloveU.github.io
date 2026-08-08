/**
 * multiverse/engine/story.js
 * 情境卡文案生成器 —— 把一次抽取结果(drawUniverse 的 result)
 * 织成一段可读的世界观设定。纯函数、种子化:同一 result 永远得到同一段文字。
 *
 * 文案的“随机措辞”用 deriveRng(seed, 'story') 派生,
 * 因此分享同一个重放码的两个人,看到的是逐字相同的情境卡。
 */

import { deriveRng } from './random.js';
import { pickOne } from './random.js';

const OPENERS = [
  '在无数平行宇宙之中,有这样一个世界——',
  '掷出的骰子停在了这样一格——',
  '命运抽屉里翻出的这张卡片写着——',
  '多元宇宙的某一页,被轻轻折了个角——',
];

const MEET_LINES = [
  '两条本不该相交的轨迹,在这里悄悄打了个结。',
  '没有人安排他们相遇,但整个宇宙都在为此让路。',
  '相遇没有预兆,像雨落进海里那样自然。',
  '他们隔着种族、身份与光年,却共享同一个频率的心跳。',
];

const ELEMENT_LEADS = [
  '这个宇宙还为他们准备了一些小小的注脚:',
  '故事的边角处,散落着这些线索:',
  '若你翻到这一页的背面,会看到:',
];

const CLOSERS = [
  '至于后来的事——那要由 Aurex 与 Aevi 自己写下去了。',
  '这张卡片到此为止,故事才刚刚开始。',
  '宇宙只负责发牌,幸福由他们自己出牌。',
  '愿这个版本的他们,也慢慢走,好好爱。',
];

/** 取 item 的展示名(带可选英文小注)。 */
function nm(item) {
  return item ? item.name : '未知';
}

/**
 * 物种 + 身份的一句话人物简介。
 * prev = 前一位主角的 { species, role },用于两人撞车时避免逐字重复:
 * 同物种省略重复描述,同身份补一句确定性的缘分小注。
 */
function personLine(name, speciesStep, roleStep, prev) {
  const sp = speciesStep && speciesStep.item;
  const role = roleStep && roleStep.item;
  if (!sp) return `${name}的身影尚未在这个宇宙显形。`;
  const sameSpecies = prev && prev.species && prev.species.id === sp.id;
  const sameRole = prev && prev.role && role && prev.role.id === role.id;

  let line = sameSpecies ? `${name}恰好也是${sp.name}` : `${name}在这里是${sp.name}`;
  if (role) {
    line += sameRole ? `,而且同样以「${role.name}」的身份生活` : `,以「${role.name}」的身份生活`;
  } else if (roleStep && roleStep.skipped && roleStep.reason === 'no-society') {
    line += `,不属于任何社会,只属于自己(和另一个人)`;
  } else if (roleStep && roleStep.skipped) {
    line += `,在这个时代还没有一个现成的身份能框住这样的存在`;
  }
  line += '。';
  if (sp.desc && !sameSpecies) line += sp.desc;
  if (sameRole) line += '同族又同行——这大概是命运偷懒,也大概是命运偏心。';
  return line;
}

/**
 * 主入口:result(drawUniverse 的返回值)-> { title, subtitle, paragraphs, elementLines, footer }
 * 各字段皆为纯文本,UI / canvas 导出 / 后端皆可直接使用。
 */
export function composeStory(result) {
  const rng = deriveRng(result.seed, 'story');
  const s = result.steps;
  const time = s.time && s.time.item;
  const place = s.place && s.place.item;
  const a = result.names.a;
  const b = result.names.b;

  const title = `${nm(time)} · ${nm(place)}`;
  const subtitle = `${a} ✦ ${b} 的第 ∞ 号平行宇宙`;

  const paragraphs = [];

  /* 开场:时间 + 地点 */
  let p1 = pickOne(rng, OPENERS);
  p1 += `这是「${nm(time)}」。`;
  if (time && time.desc) p1 += time.desc;
  paragraphs.push(p1);

  let p2 = `故事发生在${nm(place)}。`;
  if (place && place.desc) p2 += place.desc;
  paragraphs.push(p2);

  /* 两位主角(第二段可感知第一段,避免撞车时逐字重复) */
  paragraphs.push(personLine(a, s.speciesA, s.roleA, null));
  paragraphs.push(
    personLine(b, s.speciesB, s.roleB, {
      species: s.speciesA && s.speciesA.item,
      role: s.roleA && s.roleA.item,
    }),
  );

  /* 相遇 */
  paragraphs.push(pickOne(rng, MEET_LINES));

  /* 元素清单 */
  const elems = (s.elements && s.elements.items) || [];
  const elementLead = elems.length ? pickOne(rng, ELEMENT_LEADS) : '';
  const elementLines = elems.map((rec) => {
    const it = rec.item;
    return it.desc ? `${it.name} —— ${it.desc}` : it.name;
  });

  const footer = pickOne(rng, CLOSERS);

  return { title, subtitle, paragraphs, elementLead, elementLines, footer };
}

/** 把情境卡拍平成纯文本(后端存档 / 复制分享用)。 */
export function storyToPlainText(story, replayCode) {
  const lines = [story.title, story.subtitle, ''];
  for (const p of story.paragraphs) lines.push(p, '');
  if (story.elementLines.length) {
    lines.push(story.elementLead);
    for (const l of story.elementLines) lines.push('· ' + l);
    lines.push('');
  }
  lines.push(story.footer);
  if (replayCode) lines.push('', `[重放码] ${replayCode}`);
  return lines.join('\n');
}
