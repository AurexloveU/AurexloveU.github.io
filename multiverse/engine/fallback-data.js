/**
 * multiverse/engine/fallback-data.js
 * 内置微型样例数据 —— 当 ../data/*.json 缺失或加载失败时的优雅降级。
 *
 * 注意:这不是正式数据!正式数据由数据端维护在 multiverse/data/。
 * 本文件只保证:任何时候打开页面、或后端找不到数据文件,抽卡流程仍可完整演示。
 * 字段契约与 data/schema.md 一致:
 *   { id, name, en?, desc, category, tags, requireAll, requireAny, forbid }
 *
 * 前端(js/data-loader.js)与后端(server/server.js)共用本模块。
 */

export const FALLBACK_DATA = {
  timeline: [
    {
      id: 't-dawn', name: '洪荒纪元', en: 'The Mythic Dawn',
      desc: '山川尚未定名,魔力像晨雾一样浓。诸神打盹的间隙,世界自己长出了故事。',
      category: 'time', tags: ['era-myth', 'tech-low', 'magic-high', 'wild'],
      requireAll: [], requireAny: [], forbid: [],
    },
    {
      id: 't-old', name: '旧王朝', en: 'The Old Dynasty',
      desc: '灯笼与奏折的年代。城墙很高,规矩很多,而月亮照旧不守规矩。',
      category: 'time', tags: ['era-ancient', 'tech-low', 'magic-mid', 'has-court'],
      requireAll: [], requireAny: [], forbid: [],
    },
    {
      id: 't-neon', name: '霓虹世纪', en: 'The Neon Century',
      desc: '雨总是下在广告牌上。所有人都在线,孤独却比任何时代都清晰。',
      category: 'time', tags: ['era-modern', 'tech-high', 'urban'],
      requireAll: [], requireAny: [], forbid: [],
    },
    {
      id: 't-star', name: '星海纪元', en: 'The Starsea Era',
      desc: '人类学会了在恒星之间搬家。乡愁被重新定义为:某颗特定恒星的光谱。',
      category: 'time', tags: ['era-far-future', 'tech-high', 'space'],
      requireAll: [], requireAny: [], forbid: [],
    },
  ],

  places: [
    {
      id: 'p-isles', name: '悬浮群岛', en: 'The Drifting Isles',
      desc: '锁链般的浮岛悬在云上,岛与岛之间靠风桥和信任连接。',
      category: 'place', tags: ['sky', 'island'],
      requireAll: [], requireAny: ['magic-high', 'magic-mid'], forbid: [],
    },
    {
      id: 'p-street', name: '古都长街', en: 'The Old Capital Mile',
      desc: '一条从城门笔直走到宫墙的长街,卖花的、抄书的、算命的各占一段黄昏。',
      category: 'place', tags: ['city', 'court-adjacent'],
      requireAll: [], requireAny: ['era-ancient', 'has-court'], forbid: [],
    },
    {
      id: 'p-neoncity', name: '雨夜霓虹城', en: 'Neon Rain City',
      desc: '天桥下的拉面摊永远开着,全息招牌把雨滴染成十七种紫色。',
      category: 'place', tags: ['city', 'neon'],
      requireAll: ['tech-high'], requireAny: [], forbid: ['era-myth'],
    },
    {
      id: 'p-port', name: '环星港', en: 'Ringstar Port',
      desc: '绕着一颗温柔恒星旋转的巨港,到站广播用三百种语言说「欢迎回家」。',
      category: 'place', tags: ['station', 'space-port'],
      requireAll: ['space'], requireAny: [], forbid: [],
    },
    {
      id: 'p-forest', name: '迷雾森林', en: 'The Mistwood',
      desc: '树比记忆更老。迷路是这里的礼节,只有不赶路的人才被允许抵达。',
      category: 'place', tags: ['forest'],
      requireAll: [], requireAny: ['wild', 'magic-high', 'magic-mid'], forbid: [],
    },
    {
      id: 'p-saltlake', name: '无垠盐湖', en: 'The Boundless Salt Flat',
      desc: '雨后它变成一面天空的镜子,站在湖心的人会短暂地拥有两个宇宙。',
      category: 'place', tags: ['mirror', 'open'],
      requireAll: [], requireAny: [], forbid: [],
    },
  ],

  species: [
    {
      id: 's-human', name: '人类', en: 'Human',
      desc: '短暂、固执、擅长在任何时代恋爱。宇宙对他们最大的让步是允许其做梦。',
      category: 'species', tags: ['has-society', 'humanoid', 'adaptable'],
      requireAll: [], requireAny: [], forbid: [],
    },
    {
      id: 's-lunar', name: '月裔', en: 'Lunarkin',
      desc: '发梢会随月相变浅。他们不太说谎,因为情绪会先一步在皮肤上发光。',
      category: 'species', tags: ['has-society', 'humanoid', 'moon-touched'],
      requireAll: [], requireAny: ['magic-high', 'magic-mid', 'space'], forbid: [],
    },
    {
      id: 's-sylph', name: '林灵', en: 'Sylvan Spirit',
      desc: '半透明的森之精怪,不结成社会,以一整片林子为身体的延伸。认定一个人,就认定一生。',
      category: 'species', tags: ['fey', 'quiet', 'longlife'],
      requireAll: [], requireAny: ['forest', 'wild', 'magic-high', 'magic-mid'], forbid: [],
    },
    {
      id: 's-mech', name: '机核体', en: 'Coreframe',
      desc: '诞生于代码、以身体为外设的智械种族。他们把「心动」标记为无法复现的著名 bug。',
      category: 'species', tags: ['has-society', 'synthetic'],
      requireAll: ['tech-high'], requireAny: [], forbid: [],
    },
    {
      id: 's-dragonet', name: '幼龙', en: 'Dragonet',
      desc: '寿命以千年计的龙族少年体。囤积癖的对象不限于金币,也包括某个人说过的每一句话。',
      category: 'species', tags: ['dragonkind', 'longlife'],
      requireAll: [], requireAny: ['magic-high', 'magic-mid', 'era-myth'], forbid: ['neon'],
    },
    {
      id: 's-whale', name: '星鲸化身', en: 'Starwhale Avatar',
      desc: '巡游星海的巨兽把一缕意识凝成人形,只为体验「小小的、并肩走路的浪漫」。',
      category: 'species', tags: ['vast', 'gentle', 'longlife'],
      requireAll: [], requireAny: ['space', 'magic-high'], forbid: [],
    },
  ],

  socialRoles: [
    {
      id: 'r-scribe', name: '抄写员', en: 'Scribe',
      desc: '负责把口头的历史誊进竹简或羊皮。指尖常年带墨,句读之间夹带私货。',
      category: 'socialRole', tags: ['literate'],
      requireAll: [], requireAny: ['era-ancient', 'era-myth'], forbid: [],
    },
    {
      id: 'r-apothecary', name: '药铺掌柜', en: 'Apothecary',
      desc: '柜台后面有一百个小抽屉,能治风寒,也悄悄卖安神的月光。',
      category: 'socialRole', tags: ['healer'],
      requireAll: [], requireAny: ['era-ancient'], forbid: [],
    },
    {
      id: 'r-musician', name: '宫廷乐师', en: 'Court Musician',
      desc: '在礼制的缝隙里奏乐。真正想弹给谁听,只有琴知道。',
      category: 'socialRole', tags: ['artist', 'court'],
      requireAll: ['has-court'], requireAny: [], forbid: [],
    },
    {
      id: 'r-detective', name: '霓虹侦探', en: 'Neon Detective',
      desc: '风衣口袋里装着两枚硬币和半座城市的秘密,只接「找回丢失之物」的委托。',
      category: 'socialRole', tags: ['seeker'],
      requireAll: ['tech-high'], requireAny: ['city', 'neon', 'urban'], forbid: [],
    },
    {
      id: 'r-weaver', name: '数据织工', en: 'Data Weaver',
      desc: '在信息流里打捞、修补被遗忘的记忆碎片,按夜计费,按心情退款。',
      category: 'socialRole', tags: ['technician'],
      requireAll: ['tech-high'], requireAny: [], forbid: [],
    },
    {
      id: 'r-pilot', name: '星港领航员', en: 'Port Navigator',
      desc: '为进出港的巨舰指路。习惯说「一路顺风」,尽管太空里并没有风。',
      category: 'socialRole', tags: ['guide'],
      requireAll: ['space'], requireAny: [], forbid: [],
    },
    {
      id: 'r-bard', name: '游吟诗人', en: 'Wandering Bard',
      desc: '哪个时代都收留唱歌的人。传说他们的行囊里装着所有没讲完的故事。',
      category: 'socialRole', tags: ['artist', 'traveler'],
      requireAll: [], requireAny: [], forbid: [],
    },
    {
      id: 'r-teller', name: '茶馆说书人', en: 'Teahouse Storyteller',
      desc: '一块醒木拍碎悬念。最擅长的桥段,是把听众讲进故事里。',
      category: 'socialRole', tags: ['artist'],
      requireAll: [], requireAny: ['era-ancient', 'era-modern'], forbid: [],
    },
  ],

  elements: [
    {
      id: 'e-umbrella', name: '一把会哼歌的伞', en: 'A Humming Umbrella',
      desc: '雨点落上去会被谱成小调,曲风取决于撑伞人的心事。',
      category: 'element', tags: ['whimsy'],
      requireAll: [], requireAny: [], forbid: [],
    },
    {
      id: 'e-letter', name: '未寄出的信', en: 'An Unsent Letter',
      desc: '写完的那晚差一枚邮票,后来差的就是勇气了。',
      category: 'element', tags: ['keepsake'],
      requireAll: [], requireAny: [], forbid: [],
    },
    {
      id: 'e-twinmoons', name: '双月同升', en: 'Twin Moonrise',
      desc: '两枚月亮在同一条地平线上升起,当地人相信这晚许的愿会成双。',
      category: 'element', tags: ['celestial'],
      requireAll: [], requireAny: ['magic-high', 'magic-mid', 'space'], forbid: [],
    },
    {
      id: 'e-fireworks', name: '全息烟花', en: 'Holographic Fireworks',
      desc: '不会熄灭的烟花,可以暂停在最盛开的一帧,适合慢慢看。',
      category: 'element', tags: ['festival'],
      requireAll: ['tech-high'], requireAny: [], forbid: [],
    },
    {
      id: 'e-scale', name: '龙鳞护身符', en: 'Dragonscale Charm',
      desc: '龙只赠鳞给「愿意为之落地」的人。鳞片在危险靠近时会先一步变暖。',
      category: 'element', tags: ['keepsake'],
      requireAll: [], requireAny: ['dragonkind', 'magic-high', 'magic-mid'], forbid: [],
    },
    {
      id: 'e-radio', name: '深夜电台', en: 'The Midnight Broadcast',
      desc: '凌晨两点的频道,主持人只放点歌,不问点给谁。',
      category: 'element', tags: ['signal'],
      requireAll: ['tech-high'], requireAny: ['city', 'neon', 'urban'], forbid: [],
    },
    {
      id: 'e-zerog', name: '失重的一秒', en: 'One Second of Weightlessness',
      desc: '某个瞬间重力恰好打了个盹,来不及说的话趁机飘到了对方耳边。',
      category: 'element', tags: ['moment'],
      requireAll: [], requireAny: ['space', 'sky', 'station'], forbid: [],
    },
    {
      id: 'e-bookcode', name: '旧书店的暗号', en: 'The Bookshop Cipher',
      desc: '把想说的话夹在第三排某本书的第 42 页,懂的人自然会来取。',
      category: 'element', tags: ['secret'],
      requireAll: [], requireAny: ['city', 'era-ancient', 'urban'], forbid: [],
    },
    {
      id: 'e-firefly', name: '会指路的萤火', en: 'Wayfinding Fireflies',
      desc: '在林间迷路时出现,但它们指向的不是出口,而是「该去的地方」。',
      category: 'element', tags: ['guide-light'],
      requireAll: [], requireAny: ['forest', 'wild'], forbid: [],
    },
    {
      id: 'e-rain', name: '同一场雨', en: 'The Same Rain',
      desc: '隔着半座城或半个星系,两个人恰好在同一分钟抬头看雨。',
      category: 'element', tags: ['moment'],
      requireAll: [], requireAny: [], forbid: [],
    },
    {
      id: 'e-scarf', name: '交换的围巾', en: 'Swapped Scarves',
      desc: '各自围着对方的旧围巾过冬,毛线里存着两份体温的时差。',
      category: 'element', tags: ['keepsake'],
      requireAll: [], requireAny: [], forbid: [],
    },
    {
      id: 'e-initials', name: '名字的缩写刻痕', en: 'Carved Initials',
      desc: '某处不起眼的角落刻着 A ✦ A,笔画很浅,停留得很久。',
      category: 'element', tags: ['keepsake', 'secret'],
      requireAll: [], requireAny: [], forbid: [],
    },
    {
      id: 'e-mirrorlake', name: '镜面之上的倒影', en: 'Reflections on the Mirror',
      desc: '水面把两个人的影子接在一起,分不清哪一半属于天空。',
      category: 'element', tags: ['celestial'],
      requireAll: [], requireAny: ['mirror', 'open', 'sky', 'island'], forbid: [],
    },
    {
      id: 'e-starfuneral', name: '恒星的告别式', en: 'A Star’s Farewell',
      desc: '一颗恒星走到尽头时,方圆十光年的旅人都会停船,静默一分钟。',
      category: 'element', tags: ['celestial', 'solemn'],
      requireAll: ['space'], requireAny: [], forbid: [],
    },
  ],
};

/** 数据文件名 -> 键名 的映射(与 data/ 目录约定一致)。 */
export const DATA_FILES = {
  timeline: 'timeline.json',
  places: 'places.json',
  species: 'species.json',
  socialRoles: 'socialRoles.json',
  elements: 'elements.json',
};
