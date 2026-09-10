import { battleChoices } from './battle.ts';
import { artEchoChoices } from './arts-content.ts';
import type { LifeRoute, StoryEvent } from './campaign-types.ts';

export const routeNames: Record<LifeRoute, string> = { xia: '侠行', trade: '商道', shadow: '夜行', office: '公门', healer: '医道' };
export const coreNames: Record<string, string> = { 'ma-sandao': '马三刀', 'su-wantang': '苏晚棠', 'gu-qinghe': '顾清河', 'ning-buping': '宁不平', 'qiao-wu': '乔五', 'shen-yanqiu': '沈砚秋', 'yue-hansheng': '岳寒声', 'lu-guanlan': '陆观澜' };
export const evidenceNames: Record<string, string> = { official: '县衙真档副本', transport: '漕运账副本', medicine: '药库出入记录', testament: '掌门遗嘱', witness: '幸存商旅证言' };

export interface FirstActPrelude {
  eventId: 'temple' | 'assassin' | 'inheritance' | 'fire' | 'identity';
  label: string;
  hint?: string;
  minutes: number;
  money: number;
  flags?: string[];
  naturalSource: string;
  activeSource: string;
  recoverySource: string;
  aftermath: string;
}

/** 第四至八日只写玩家可观察的前兆与来源，不在文本中确认幕后归属。 */
export const firstActPreludes: FirstActPrelude[] = [
  {
    eventId: 'temple', label: '沿药渣与脚印去城外看看（半个时辰）', minutes: 30, money: 0,
    naturalSource: '药铺伙计从城外回来，鞋边沾着带血草叶。他说破庙旁散着新药渣，门前还有人来回踩过。',
    activeSource: '你沿药渣和折断的芦茎走去，泥里两行脚印一深一浅：有人带伤进了庙，另有人仍在附近找他。',
    recoverySource: '后来庙祝交给你一截换下的血绷带，又说几个问路人往北山去了。绷带上只有伤药与尘土。',
    aftermath: '雨水打散了庙前火灰。来换香的人还记得血迹和脚印，庙里的人却已随那一夜各有去处。',
  },
  {
    eventId: 'assassin', label: '查一遍廊门、琴弦与屋脊（半个时辰）', minutes: 30, money: 0,
    naturalSource: '县衙贴出告示，请旧案见证人入廊问话；侧门却早早合上，廊下也比往日多了一班差役。',
    activeSource: '琴弦像是新换的，廊门的索结发涩，屋脊还有几枚逆着雨痕的干脚印。有人上过屋顶，并为仓促关门动过手脚。',
    recoverySource: '后来书吏领你看过箭孔、断弦和当日值守簿。三处痕迹对得上那场伏击，簿上却没有幕后人的名字。',
    aftermath: '县衙换了廊门木板，把那日值守簿另锁一匣。院里的人记得谁活了下来，也记得你当时守在何处。',
  },
  {
    eventId: 'inheritance', label: '核一核讣帖与赴山名册（半个时辰）', minutes: 30, money: 0,
    naturalSource: '青岳门的讣帖送进客栈，门人随即分头召回同门。纸上只写掌门身故、择日议位。',
    activeSource: '讣帖纸印、送帖门牌与赴山名册都能对上。山门正召人议位；陆观澜却逐个追问师父临终前见过谁。',
    recoverySource: '后来客栈还留着一张讣帖存根和未赴山者名单。谁曾当面许诺作证，纸上并没有记。',
    aftermath: '酒客仍在争论谁该赴山。苏晚棠只认店里签过的名字；陆观澜则记得你递过遗嘱、名单，还是路粮。',
  },
  {
    eventId: 'fire', label: '补水、移油，备下破窗绳（45分钟、三两）', hint: '耗去三两与四十五分钟，只为眼前火险多留一条救人的路。', minutes: 45, money: 3, flags: ['firebreak-ready'],
    naturalSource: '木账房墙边又添了几只油罐，守夜水缸却已见底。东风正往仓门里灌，换岗簿上还空着一班。',
    activeSource: '你核过油罐仓号和空水缸，花三两请脚夫补水、把一排油罐挪远，又在东窗备下破窗钩与疏散绳。风若把火星卷进来，至少有人能从窗下撤出。',
    recoverySource: '火后，幸存脚夫从灰里捡出烧裂的油罐牌，又找来那日的水缸领用单。火起前，有人撤过水，也挪过油罐。',
    aftermath: '码头依照烧损重排船位。账房、东仓、账册和被拦下的人各留下各的痕迹，少掉的那一处再没人替你补回。',
  },
  {
    eventId: 'identity', label: '比对封城榜与自己的旧口供（半个时辰）', minutes: 30, money: 0,
    naturalSource: '城门添了横木，榜上写着逐栏复核姓名。候验、担保和改口的人各排一列，差役正按页叫号。',
    activeSource: '你把榜文、旧口供页码和新复核簿逐一对过。自报、住店登记、官面核验分栏落笔，旧话与改口都会留在纸上。',
    recoverySource: '后来公示栏还贴着复核章程，也留着你的旧登记页号。身份仍可补办，封城当日那一次担保却已经散场。',
    aftermath: '此后过城门，差役会一并翻看路引、担保簿与旧口供。经手人只认自己落过笔的那一栏。',
  },
];

/** 锚点共用时间轴，取证、救人、谋生各有真实代价；缺席有独立结果。 */
export const storyEvents: StoryEvent[] = [
  { id: 'temple', day: 4, title: '破庙一灯', location: 'temple', speaker: 'yue-hansheng',
    opening: ['破庙里药气未散。神龛后的人按着渗血的肩，把油灯挪远半尺；门外那两行脚印还停在草间。', '“岳寒声。老朽不问你是哪一派，只问一句：人死以后，答应过的话还算不算？”'],
    choices: [
      { id: 'shelter', label: '留下守他一夜，引开寻来的人', hint: '留下护人，也把自己卷进追索；今夜不再去办别的事。', reply: '你替他换过干草，又在岔路压出一串向西的脚印。天将亮时，岳寒声把遗嘱递来，信物仍收在自己怀中：“纸给你，命还得我自己担。”', effect: { route: 'xia', flags: ['yue-safe'], evidence: ['testament'], help: 'yue-hansheng' } },
      { id: 'medicine', label: '花四两，请沈砚秋赶来救治', hint: '当场付四两保住伤者；寻人的脚印会在这段时间里走远。', need: { money: 4 }, reply: '沈砚秋在灯下剪开旧绷带：“我能稳住这口气，旧伤却还得慢养。”岳寒声让你抄下药库签押，抵作诊资之外的人情。', effect: { route: 'healer', money: -4, flags: ['yue-safe'], evidence: ['medicine'], help: 'shen-yanqiu' } },
      { id: 'copy', label: '只替他送信，带走一份遗嘱抄件', hint: '带走抄件去送信；岳寒声仍独自留在庙里。', reply: '你答应送信，却没有应下护送。岳寒声听完，只说一声“够了”，让你抄走遗嘱；门外脚步未停，他仍得独自熬过这一夜。', effect: { route: 'trade', evidence: ['testament'], help: 'lu-guanlan' } },
      { id: 'steal', label: '趁他昏睡取走遗嘱，留下水囊', hint: '取走遗嘱，放弃照料伤者；醒来后他会知道托付落了空。', reply: '纸从他袖中抽出时，几乎没有声响。你把水囊放在灯边，带走遗嘱，也把负伤的老人留给了渐近的脚步。', effect: { route: 'shadow', evidence: ['testament'], harm: 'yue-hansheng', wanted: 1 } },
    ], missed: { text: '你再到破庙时，只见一滩干血。旧香客说那名伤者没能熬过夜，另有一份遗嘱抄件已被送往北山。', effect: { dead: ['yue-hansheng'] } } },
  { id: 'assassin', day: 5, title: '廊下的第二声弦', location: 'yamen', speaker: 'ning-buping',
    opening: ['你才跨进廊门，帘后忽然绷断一根琴弦。屋脊传来瓦片轻响，梁间一点寒光已经对准书房。', '宁不平按住刀柄：“别看琴。看梁上。”'],
    choices: [
      { id: 'warn', label: '踢倒灯架，和宁不平合上廊门', hint: '先封住射向书房的箭路；屋脊上的人会趁隙退走。', reply: '你一脚踢倒灯架，宁不平借势扯落门索。箭簇钉进厚木，离顾清河只差半步。屋脊脚步已经远去，他看着门上的箭：“这条命先记下，案子照证据办。”', effect: { route: 'office', flags: ['gu-safe'], help: 'gu-qinghe' } },
      { id: 'shield', label: '拖书吏下石阶，让宁不平护住书房', hint: '先护住门外伤者与书房；放弃追上屋脊的人。', reply: '你把跌倒的书吏拖下石阶，箭从他方才伏地处擦过。宁不平得以退守书房，护着顾清河从后门撤出；屋脊上的身影早已越墙。', effect: { route: 'xia', flags: ['gu-safe', 'people-safe'], help: 'ning-buping' } },
      { id: 'archive', label: '抢下廊边真档，抄走盐引要目', hint: '保住真档线索；书房中的顾清河无人照应。', reply: '你压住被风掀起的案页，抄下盐引编号与官印尺寸。书房门在身后洞开，惨叫只响了一声；等你回头，已经来不及了。', effect: { route: 'shadow', evidence: ['official'], dead: ['gu-qinghe'], wanted: 1 } },
      { id: 'triage', label: '留在廊外，为倒地伤者止血', hint: '救下门外伤者；书房中的顾清河无人照应。', reply: '你撕开干净衣角，为门外伤者压住创口。几个人活了下来，书房里的脚步却忽然断了；黄昏时，县衙挂出顾清河的讣告。', effect: { route: 'healer', flags: ['people-safe'], dead: ['gu-qinghe'], help: 'shen-yanqiu' } },
    ], missed: { text: '县衙黄昏挂出讣告：顾清河遇刺身亡。临时接事的县丞闭紧廊门，只让众人各守本业。', effect: { dead: ['gu-qinghe'] } } },
  { id: 'inheritance', day: 6, title: '没有人坐的椅子', location: 'inn', speaker: 'lu-guanlan',
    opening: ['青岳门掌门的讣帖压在酒盏下，旁边已摆着赴山名册。陆观澜把那几行字看了很久，第一次没有笑。', '“他们催我回山议一把椅子。我只想先问清，师父临终前见过谁。”'],
    choices: [
      { id: 'will', label: '把岳寒声的遗嘱交给陆观澜看', hint: '让遗嘱进入山门公议；你不替陆观澜答应继位。', need: { evidence: 'testament' }, reply: '陆观澜从头读到末尾，把遗嘱重新封好还你：“我回山作证。至于那把椅子，等师父的话说完再议。”', effect: { route: 'xia', flags: ['lu-pledged'], help: 'lu-guanlan' } },
      { id: 'record', label: '同他记下愿意赴山作证的人', hint: '留下证人名单；眼下不争掌门之位。', reply: '你逐桌问过，愿意作证的人亲手留下名字。陆观澜收起名单：“这些人只替自己见过的事开口。”这张纸成了入山公议的凭据。', effect: { route: 'office', flags: ['assembly-pass'], help: 'lu-guanlan' } },
      { id: 'supply', label: '垫三两路粮，记作门人赊欠', hint: '当场付出三两，只保这批门人能按时赴山。', need: { money: 3 }, reply: '你把三两本钱与领粮人的名字一并写下。陆观澜提起粮袋：“账摆在明处，便不欠一句空人情。”', effect: { route: 'trade', money: -3, flags: ['mountain-credit'], help: 'lu-guanlan' } },
    ], missed: { text: '掌门死讯传遍客栈时，陆观澜已经随门人赴山。韩百川一方仍在布置继位仪式，桌上只剩一张未签完的名册。', effect: {} } },
  { id: 'fire', day: 7, title: '火里只够走一次', location: 'dock', speaker: 'su-wantang',
    opening: ['码头木账房已经烧上横梁，东风把火星一团团卷向仓门。空水缸歪倒在地，后窗里有人拍打木板。', '苏晚棠攥着一只滴水的空茶壶：“人和原账都在里头。东仓也快沾火了。”'],
    choices: [
      { id: 'prepared', label: '照预先布置分人压火、破窗救人', hint: '救出账房并护住东仓；原账与追人都来不及。', need: { flag: 'firebreak-ready' }, reply: '补满的水缸压住东侧火头，脚夫用破窗钩扯开木窗。你沿疏散绳把账房带出，东仓也保住了；内室原账烧成黑灰，点火的人趁乱脱身。苏晚棠交出一份抄账，让你从仓号接着查。', effect: { route: 'xia', flags: ['clerk-safe', 'cargo-safe'], evidence: ['transport'], help: 'su-wantang' } },
      { id: 'people', label: '砸开后窗，先把账房拖出来', hint: '救出账房；原账与东仓只能留给火势。', reply: '你们从后窗拽出两名账房。内室原账没能抢出，东仓也被飞火燎着。苏晚棠把藏下的抄账塞到你手里：“人活着，纸上的缺口还能问。”', effect: { route: 'xia', flags: ['clerk-safe'], evidence: ['transport'], help: 'su-wantang' } },
      { id: 'ledger', label: '从近门抢出运输原账', hint: '保住原账；后窗里的账房无人救援。', reply: '你贴地闯到近门，抱出一册烫手的运输账。身后的门梁随即塌下，后窗拍击声渐渐停了；焦黑的纸页保住了，里面的人没有出来。', effect: { route: 'shadow', evidence: ['transport'], harm: 'su-wantang' } },
      { id: 'cargo', label: '召集脚夫，把东仓粮货移开', hint: '护住东仓；账房与原账无人照应。', reply: '你和脚夫把粮包一袋袋推离火墙，保住了东仓。账房屋顶却在身后塌下，人和原账都没能带出；脚夫按旧约给了你八两救货钱。', effect: { route: 'trade', money: 8, flags: ['cargo-safe'], help: 'qiao-wu' } },
      { id: 'cordon', label: '随官差封住巷口，追拦点火的人', hint: '追人并留下口供；火场救人、抢账交给脚夫。', reply: '你随差役封住巷口，截下一名带油味的汉子。火场里的人和原账都没能救出；那人只供出油罐领用的仓号，幕后是谁仍没有开口。', effect: { route: 'office', evidence: ['transport'], help: 'ning-buping' } },
    ], missed: { text: '你赶到时，木账房已经烧塌。值夜账房没能逃出，原账尽毁，东仓也过了火；幸存脚夫还记得油罐仓号，苏晚棠手里或许另有抄件。', effect: {} } },
  { id: 'identity', day: 8, title: '封城后的姓名', location: 'gate', speaker: 'ma-sandao',
    opening: ['城门横木已经落下。新来的差役摊开复核簿，旧口供夹在后页；马三刀被叫到桌边辨认自己的签押。', '“自报、住店、官验，三栏分着写。”差役抬头看你，“你今日来补哪一栏？”'],
    choices: [
      { id: 'correct', label: '说明旧口供差异，补验路引', hint: '更正会附在旧口供后；须等三日商旅回函。', reply: '差役没有撕去旧页，只把你的更正附在后面。三日后商旅回函送到，你领到一张新路引；往后查验时，新旧两页仍会一同翻开。', effect: { route: 'office', pass: true, wanted: -2, flags: ['identity-checked'], help: 'ning-buping' } },
      { id: 'bond', label: '交五两押金，请商旅名簿担保', hint: '当场付五两换得通行；押金要等盐案结束才可领回。', need: { money: 5 }, reply: '五两押金入了公账，你也在担保簿上签下姓名。差役准你往来验关、接运普通货物；这笔银子须等盐案结束才能领回。', effect: { route: 'trade', money: -5, pass: true, flags: ['identity-checked'] } },
      { id: 'hide', label: '避开复核，摸清换岗时的水道', hint: '取得一条夜路；放弃这次补验路引的机会。', reply: '你避开叫号的人群，沿墙根记下换岗时无人照看的水道。路引没有补成，旧姓名仍在册；往后走正门，差役会多问你一遍。', effect: { route: 'shadow', wanted: 1, flags: ['waterway'] } },
    ], missed: { text: '城门开始逐户复核。没有路引的外乡人仍在横木内候验，你的旧口供也照旧留在簿中。', effect: {} } },
  { id: 'survivor', day: 12, title: '活人的价', location: 'dock', speaker: 'qiao-wu',
    opening: ['乔五掀开茶盖。隔墙有人咳嗽，声音像荒道上替你赶过骡子的商旅。', '“人吃饭要钱，养伤也要钱。你来谈人，还是来谈道理？”'],
    choices: [
      { id: 'ransom', label: '付八两赎回商旅', need: { money: 8 }, reply: '乔五收钱开门。你让商旅先吃粥，再逐字记下他亲见的袭击；他说不认识下令的人，你没有替他补上名字。', effect: { route: 'trade', money: -8, flags: ['survivor-safe'], evidence: ['witness'], help: 'su-wantang' } },
      { id: 'escort', label: '用三日护送劳力换他自由', reply: '你签下三日运货的约，只护普通粮船。商旅由客栈接走；自己的三日，须实实在在还。', effect: { route: 'xia', flags: ['survivor-safe'], evidence: ['witness'], help: 'su-wantang' } },
      { id: 'writ', label: '凭验过的身份请差役公开验人', need: { flag: 'identity-checked' }, reply: '宁不平带人来验，乔五不愿在白日留下伤人证据。你只领走活口，没有把乔五一句讨价还价写成认罪。', effect: { route: 'office', flags: ['survivor-safe'], evidence: ['witness'], harm: 'qiao-wu' } },
      { id: 'key', label: '借送饭机会把门闩松开', reply: '夜里那人逃出来，你接他到安全处录下证言。乔五在门上找到撬痕，从此加派两个人看你。', effect: { route: 'shadow', flags: ['survivor-safe'], evidence: ['witness'], wanted: 1, harm: 'qiao-wu' } },
    ], missed: { text: '失散商旅被移往上游，此后没有回音。同行货单仍可查，但已无人能补述那一夜的面孔。', effect: {} } },
  { id: 'sister', day: 16, title: '茶凉以前', location: 'inn', speaker: 'su-wantang',
    opening: ['苏晚棠撤下最后一桌酒，才把一纸卖身契摹本摊开。', '“我妹妹，小蝉。换船的日子到了。我不求你替全城人主持公道，就问这一个人。”'],
    choices: [
      { id: 'buy', label: '付十二两，把人赎到客栈', need: { money: 12 }, reply: '契纸在炭盆里蜷成一卷。小蝉到店时不敢坐下，苏晚棠只说：“坐，椅子不是租的。”', effect: { route: 'trade', money: -12, flags: ['sister-safe'], evidence: ['transport'], help: 'su-wantang' } },
      { id: 'rescue', label: '随脚夫换班，把她护送出盐场', reply: '你借搬货人群护住小蝉，留下了自己的面孔。苏晚棠收下妹妹，把抄账塞进你掌心。', effect: { route: 'xia', flags: ['sister-safe'], evidence: ['transport'], wanted: 1, help: 'su-wantang' } },
      { id: 'swap', label: '偷换转运签，让她随民船离开', reply: '船签换对了，人送到了。乔五查出空额后撕碎点名簿，夜路上的盘问从此多了一重。', effect: { route: 'shadow', flags: ['sister-safe'], evidence: ['transport'], wanted: 2, help: 'su-wantang' } },
      { id: 'petition', label: '担名递状，请官府查拘人契据', reply: '你把自己的姓名写在具状人一栏。差役查出拘留超期，把小蝉带回；苏晚棠只交一份抄账，不说你可以处置她所有秘密。', effect: { route: 'office', flags: ['sister-safe'], evidence: ['transport'], help: 'su-wantang' } },
    ], missed: { text: '客栈闭门三日。苏小蝉又被转走，苏晚棠留下找人的灯，没有留下答应过你的真账。', effect: {} } },
  { id: 'roads', day: 20, title: '县城以外', location: 'gate', speaker: 'lu-guanlan',
    opening: ['封锁终于松动。北山、河道、邻府，三份路程单被风吹到一起；无论选哪一条，都需两日往返，每日一两食宿。', '陆观澜留下字条：“山外不是另一座青石。路上有人等盐，有人等药，有人等一封寄不出去的状纸。”'],
    choices: [
      { id: 'mountain', label: '走北山，访被逐的药农', reply: '你替药农搬开被砸的篱笆，换来一张药库进货留底。上面有韩百川的签押，却还不能单凭此纸证明他下毒。', effect: { route: 'xia', evidence: ['medicine'], flags: ['assembly-pass'] } },
      { id: 'river', label: '沿河押货，用实货核对税重', reply: '一船盐，两份税重。你把各码头的过秤签缝在一起，运输账终于有了货物佐证。', effect: { route: 'trade', money: 10, evidence: ['transport'], flags: ['cargo-safe'] } },
      { id: 'prefecture', label: '往邻府递状，查官盐底档', reply: '邻府书吏不认你的气话，只认旧印存样。他给你一份盖章副本，嘱你别拿副本冒充原件。', effect: { route: 'office', evidence: ['official'], pass: true } },
      { id: 'backdoor', label: '借北山旧道，换取药栈留底', reply: '你替药栈伙计带走一封求救信，他把留底交给你。你们互不问出身，只记这次交接。', effect: { route: 'shadow', evidence: ['medicine'], flags: ['waterway'] } },
    ], missed: { text: '三条外路都有人走过。药农迁散，河船照运，邻府旧档仍待具名查取。', effect: {} } },
  { id: 'pharmacy', day: 25, title: '空药库', location: 'clinic', speaker: 'shen-yanqiu',
    opening: ['药库清空的消息由药农带回。沈砚秋把三张药签铺在干净布上。', '“药没有正邪，剂量、去处和用它的人有。别把所有签押都看成同一个人的刀。”'],
    choices: [
      { id: 'test', label: '协助核对残渣与药签', reply: '你逐项记录，沈砚秋逐项复核。乌鳞散原料的去处与青岳药库相接，病案只证明药性，不能代替人证。', effect: { route: 'healer', evidence: ['medicine'], help: 'shen-yanqiu' } },
      { id: 'purchase', label: '付四两买药农留底，保住来源', need: { money: 4 }, reply: '钱付给逃难的药农，不付给某种结论。你拿到原始领药日期，自己核对出一段隐匿运输。', effect: { route: 'trade', money: -4, evidence: ['medicine'] } },
      { id: 'recover', label: '夜取废仓中未烧尽的签押', reply: '你带回半箱焦纸，花了一整夜按日期拼合。清点记录终于可读，仓主却把你的身形报给了追兵。', effect: { route: 'shadow', evidence: ['medicine'], wanted: 1 } },
    ], missed: { text: '药库被搬空。回春堂仍留有毒伤样本，可是原料领用记录散入药农和废仓之中。', effect: {} } },
  { id: 'assembly', day: 28, title: '山门公议', location: 'temple', speaker: 'lu-guanlan',
    opening: ['公议借山脚祠堂召开。韩百川的人堵住正门，陆观澜把剑留在门外。', '“今天谁先拔剑，明天留下的就只有谁赢。你带来的是能说清的话，还是能核对的纸？”'],
    choices: [
      { id: 'testament', label: '让门人核对遗嘱与掌门笔迹', need: { evidence: 'testament' }, reply: '旧门人认了笔迹，陆观澜却拒绝接位：“先把药库查完。”一批弟子跟他下山，公议从夺位变成了问责。', effect: { route: 'xia', flags: ['assembly-won', 'lu-pledged'], help: 'lu-guanlan' } },
      { id: 'medicine', label: '提交药库记录，让领药人对签', need: { evidence: 'medicine' }, reply: '记录被分开核对。韩百川不能再把全部领药推给岳寒声，门人封住药库等问讯，没有当场杀他。', effect: { route: 'office', flags: ['assembly-won'], help: 'lu-guanlan' } },
      { id: 'withdraw', label: '护送不愿站队的弟子下山', reply: '你把路粮分给离开的弟子。山门里的高位暂时有了主人，山门外的人却不必替那把椅子送命。', effect: { route: 'trade', flags: ['disciples-safe'], help: 'lu-guanlan' } },
    ], missed: { text: '韩百川接掌大部门人。陆观澜拒绝争位，带少数弟子离山；药库疑点未在门中公开。', effect: {} } },
  { id: 'riverfight', day: 32, title: '盐河断索', location: 'dock', speaker: 'qiao-wu',
    opening: ['乔五扣下一条货船，许惟谦派来的人站在另一岸。两边的弓都没有放下。', '“这回不谈人情。”乔五把刀插进船板，“要账，拿个能让我下船的价。”'],
    choices: [
      { id: 'bargain', label: '付六两雇船接走他的伤员，换账', need: { money: 6 }, reply: '乔五肯让账的副本下船，不肯让原账离手。伤员送走，你给船工的钱一文不少。', effect: { route: 'trade', money: -6, evidence: ['transport'], help: 'qiao-wu' } },
      { id: 'copy', label: '趁两岸对峙，取走底舱备账', reply: '你从绳梯撤离，只取到副本，没碰装药的桶。乔五发现账夹空了，令手下记住你的鞋印。', effect: { route: 'shadow', evidence: ['transport'], wanted: 1, harm: 'qiao-wu' } },
      { id: 'rescue', label: '解开民船，让被夹住的人先走', reply: '你把缆绳松开，民船顺水漂出箭程。逃出来的脚夫肯替你证明扣船经过，盐账仍在乔五手里。', effect: { route: 'xia', flags: ['people-safe'], evidence: ['witness'], help: 'lu-guanlan' } },
    ], missed: { text: '盐河发生截杀，乔五带账撤走，民船损毁。两岸都宣称自己只是在查私货。', effect: {} } },
  { id: 'hearing', day: 36, title: '巡按只要一页纸', location: 'yamen', speaker: 'ning-buping',
    opening: ['巡按抵县后先问盐税，后问死者。宁不平将空白证词纸推给你。', '“他说一页就够。可那一夜死的人，一页写不完。”'],
    choices: [
      { id: 'official', label: '交真档副本，要求留原始收据', need: { evidence: 'official' }, reply: '书吏不得不把编号、来源和签收人全写进去。许惟谦的印样第一次被摆到桌面上，事情还没有判完。', effect: { route: 'office', flags: ['hearing-filed'], help: 'ning-buping', wanted: -2 } },
      { id: 'witness', label: '请幸存商旅作证，不替他补词', need: { evidence: 'witness' }, reply: '他有几处记不清，你没有替他接话。宁不平把不确定之处圈出来，反而把证言留下了。', effect: { route: 'xia', flags: ['hearing-filed'], help: 'ning-buping' } },
      { id: 'buycopy', label: '付五两抄录公示底档，另作准备', need: { money: 5 }, reply: '你付的是抄录纸墨与核章费，拿到盖章真档。今天不急着下结论，留待三份账能够相合的那一天。', effect: { route: 'trade', money: -5, evidence: ['official'] } },
      { id: 'amnesty', label: '交出夜行路线，请求减免追查', reply: '你交代自己确实走过的水道，没有编造同伙。官府撤去部分追查，乔五却少了一条退路。', effect: { route: 'shadow', wanted: -3, harm: 'qiao-wu', flags: ['amnesty'] } },
    ], missed: { text: '巡按暂以亏空立案，未收到你的具名材料。临时结论不等于全案真相。', effect: {} } },
  { id: 'olddebt', day: 41, title: '掌柜的最后一本账', location: 'inn', speaker: 'su-wantang',
    opening: ['苏晚棠把茶壶搁在柜台上，手指却没有离开账本。', '“以前你怎么待人，我记得。但记得，不等于今晚便能什么都给你。”'],
    choices: [
      { id: 'sister', label: '请已安置好的小蝉核对货签', need: { flag: 'sister-safe' }, reply: '小蝉从盐场旧签里认出一枚印。姐姐这才打开藏账的夹层，你逐页抄下，没有取走她的原本。', effect: { route: 'trade', evidence: ['transport'], flags: ['safehouse'], help: 'su-wantang' } },
      { id: 'hide', label: '替客栈安排后门转移，不问账藏何处', reply: '你先把两名伙计安顿好，才回来取自己的行李。苏晚棠交给你一把后门钥匙，账仍由她保管。', effect: { route: 'xia', flags: ['safehouse'], help: 'su-wantang' } },
      { id: 'shadow', label: '带人从水道脱身，换一次掩护', need: { flag: 'waterway' }, reply: '你们约好只亮一次灯。苏晚棠不问你在外做过什么，只记下你今夜确实带走了要救的人。', effect: { route: 'shadow', flags: ['safehouse'], wanted: -1, help: 'su-wantang' } },
    ], missed: { text: '客栈撤走伙计，苏晚棠自行藏身。没人承诺为你的去处作掩护。', effect: {} } },
  { id: 'hunt', day: 45, title: '名单上的灯', location: 'clinic', speaker: 'shen-yanqiu',
    opening: ['回春堂窗纸上多了一道刀口。沈砚秋没有抬头，先熄灭了你身后的灯。', '“来的人知道我们住哪儿。今晚留下，得先想好怎样让病人走。”'],
    choices: [
      { id: 'hide', label: '用已准备的落脚处转移医者', need: { flag: 'safehouse' }, reply: '你不点灯，按旧约敲了三下门。医者与病人躲过这一夜，追兵只扑到一间空药房。', effect: { route: 'shadow', flags: ['shen-safe'], help: 'shen-yanqiu' } },
      { id: 'escort', label: '请陆观澜守后巷，自己带病人走', need: { flag: 'lu-pledged', ally: 'lu-guanlan' }, reply: '陆观澜在巷口收住来刀，你没有回头逞强。医者把最后一位病人背上车，约好的每一步都有人做。', effect: { route: 'xia', flags: ['shen-safe'], help: 'lu-guanlan' } },
      { id: 'hire', label: '付八两雇三辆车分路转移', need: { money: 8 }, reply: '你付足车钱，三队人从不同巷口离开。追兵只截住一车空药箱，沈砚秋得以保存病案。', effect: { route: 'trade', money: -8, flags: ['shen-safe'], help: 'shen-yanqiu' } },
      { id: 'writ', label: '公开递报，把医馆列入保护名单', reply: '你带着病人守在衙门前，来人不愿当着巡按的差役动刀。病案留下了，落脚处也不再是秘密。', effect: { route: 'office', flags: ['shen-safe'], wanted: 1, help: 'shen-yanqiu' } },
    ], missed: { text: '回春堂遭袭，沈砚秋未能逃出。旧病案尚有抄件，却再也不会有人替他把新病人扶进门。', effect: { dead: ['shen-yanqiu'] } } },
  { id: 'ship', day: 49, title: '一船黑水', location: 'dock', speaker: 'qiao-wu',
    opening: ['装乌鳞散原料的船准备连夜出境。船底开始进水，搬货的脚夫还没有上岸。', '岸上有人举起火把。你看见的只是湿木、药桶和挣命的人，火不能替你分清谁有罪。'],
    choices: [
      { id: 'people', label: '先救脚夫，放弃抢货', reply: '你把人拉上岸，药桶随船沉下去。后来沿岸封了取水口，救人的决定没有让药害自行消失。', effect: { route: 'xia', flags: ['boatmen-safe', 'river-poisoned'], evidence: ['witness'], help: 'lu-guanlan' } },
      { id: 'tow', label: '花十两雇拖船，把人货一起扣在浅滩', need: { money: 10 }, reply: '拖船把船身顶向浅滩，药桶逐只封存，人逐个点名。你亏了船钱，却保住了一条还能行船的河。', effect: { route: 'trade', money: -10, flags: ['boatmen-safe', 'river-safe'], evidence: ['medicine'] } },
      { id: 'seal', label: '召差役封住引水口，再救人', reply: '你们先将船拖离水井上游，再把脚夫救出。几只药桶破了，损害被限制在封锁的河湾。', effect: { route: 'office', flags: ['boatmen-safe', 'river-safe'], evidence: ['medicine'] } },
      { id: 'leverage', label: '截下乔五的逃船，以救他换原料清单', reply: '你让乔五先把清单扔过来，才给他缆绳。人上岸了，他把这一笔认作交易；大船沉下，药水仍须有人清理。', effect: { route: 'shadow', evidence: ['medicine', 'transport'], flags: ['river-poisoned'], help: 'qiao-wu' } },
    ], missed: { text: '运药船沉没，部分原料流入河湾，脚夫下落不明。沿岸开始封井。', effect: { flags: ['river-poisoned'] } } },
  { id: 'order', day: 53, title: '谁来开粮仓', location: 'gate', speaker: 'ning-buping',
    opening: ['县衙、漕帮、山门各派了人守粮仓。排队的人只问今日能领几升。', '宁不平放下刀：“谁的旗挂得高，米也不会自己长出来。”'],
    choices: [
      { id: 'escort', label: '组织乡民互保，把粮送进各巷', reply: '你不收投名状，只请每巷两人对数签名。领粮簿留在乡民手里，谁也不能独吞整仓。', effect: { route: 'xia', flags: ['civil-order'], help: 'ning-buping' } },
      { id: 'market', label: '垫八两开平价转运行', need: { money: 8 }, reply: '你公开进价与运价，邀脚夫入股。第一船只够温饱，往后能不能做大，要靠每天按约交货。', effect: { route: 'trade', money: -8, flags: ['guild-founded', 'civil-order'], help: 'su-wantang' } },
      { id: 'office', label: '把仓钥交公账保管，签名承担核对', reply: '三把钥匙分给三人，你在核对册上签名。往后若少粮，不能再说自己只是路过。', effect: { route: 'office', flags: ['civil-order', 'public-duty'], help: 'ning-buping' } },
      { id: 'redistribute', label: '夜取被藏的粮票，送给漏登的人', reply: '粮票回到没有被登记的人手里。仓主追查失窃，百姓记住了来送票的人，两种名声一同留下。', effect: { route: 'shadow', flags: ['civil-order'], wanted: 1, help: 'su-wantang' } },
    ], missed: { text: '粮仓由临时守军接管，先供官差再供百姓。县城恢复了秩序，街口仍排着长队。', effect: {} } },
  { id: 'threeledgers', day: 55, title: '三份账之间', location: 'yamen', speaker: 'ning-buping',
    opening: ['到了最后，仍不是谁喊得响就能定案。县衙真档、漕运账、药库记录，要各自有来处。', '“缺哪一份，就补哪一份。没有的，留空。死人也不该替活人把空白填满。”'],
    choices: [
      { id: 'official', label: '查公示档号，补真档副本', reply: '你按档号申请核章，拿到真档副本。许惟谦的两枚印出现在同一批盐的不同纸上。', effect: { route: 'office', evidence: ['official'] } },
      { id: 'transport', label: '用五两纸墨钱重抄散落货签', need: { money: 5 }, reply: '货签从三个码头汇来，错开的税重拼出了运输账。它不是原件，每一张仍留着来人的签名。', effect: { route: 'trade', money: -5, evidence: ['transport'] } },
      { id: 'medicine', label: '从废栈与药农手中补药库签押', reply: '你循残签查到药农，再回废栈核年份。药库记录补齐，药性是否相合仍要看先前病案。', effect: { route: 'shadow', evidence: ['medicine'] } },
      { id: 'witness', label: '整理已经取得的商旅证言', need: { evidence: 'witness' }, reply: '你删去自己推想的句子，只留下他确认的事。较短的证言，反倒比一篇无所不知的控词更站得住。', effect: { route: 'xia', flags: ['witness-ready'] } },
    ], missed: { text: '收证期限已过。你没有递交新的材料，最终只能使用手里实际留存的证据。', effect: {} } },
  { id: 'lastprice', day: 56, title: '不落款的开价', location: 'yamen', speaker: 'ning-buping',
    opening: ['有人把银票压在具名证词上，也有人递来一张没有填名字的任用牒。宁不平把两样东西都推远了。', '“想走什么路，此前已经走了许多步。最后这一步，别让别人替你签。”'],
    choices: [
      { id: 'copy', label: '保留副本，约定次日公开核验', reply: '你把保管人和交接时刻分别写下。递银票的人收回手，此后只能从证据本身与你争辩。', effect: { route: 'office', flags: ['public-copies'], help: 'ning-buping' } },
      { id: 'mutual', label: '邀各巷伙计、脚夫互相作保', reply: '没人替整座城许诺，只替认识的人留一道门。互保名单分了三份，谁也不能独占。', effect: { route: 'xia', flags: ['safehouse'], help: 'lu-guanlan' } },
      { id: 'freight', label: '接下最后一趟粮运，实做实结', reply: '你核清最后一船粮，收下六两运费。对方想用一纸独家约留住你，你只签了这一趟。', effect: { route: 'trade', money: 6, help: 'su-wantang' } },
      { id: 'vanish', label: '交代一次旧案，请求撤去部分追查', reply: '你只认自己确实做过的事，换一份减免文书。旧笔录仍在，往后出示文书，也须承认它从何而来。', effect: { route: 'shadow', wanted: -2, flags: ['amnesty'] } },
    ], missed: { text: '最后的开价无人替你应承。你仍可以按已经积累的本事和证据选择终局。', effect: {} } },
  { id: 'witnessnight', day: 57, title: '最后一盏灯', location: 'inn', speaker: 'su-wantang',
    opening: ['具名证人收到最后一次威胁。客栈的灯照着三条巷口，你一个人守不住全部。', '门缝里递进一句话：“明日盐仓相见。带你自己肯承担的东西来。”'],
    choices: [
      { id: 'network', label: '启用已经安排的落脚处', need: { flag: 'safehouse' }, reply: '一处熄灯，另一处才亮。旧约替你守住了不能亲到的门，证人熬过这一夜。', effect: { route: 'shadow', flags: ['witnesses-safe'], wanted: -1 } },
      { id: 'guard', label: '请愿意相助的陆观澜守证人', need: { flag: 'lu-pledged', ally: 'lu-guanlan' }, reply: '陆观澜守在门外，你守在桥头。你们没有挡住全城的恶意，只挡住今夜这两条路。', effect: { route: 'xia', flags: ['witnesses-safe'] } },
      { id: 'cars', label: '花六两把具名证人送入官驿', need: { money: 6 }, reply: '官驿记下每个抵达的人名。你把最后一笔车钱结清，天明时没有少人。', effect: { route: 'trade', money: -6, flags: ['witnesses-safe'] } },
      { id: 'public', label: '把威胁信公开登记，请差役轮值', reply: '信被抄在告示旁，刀客不再敢轻易下手。你也留下了自己的住处，明日再不能装作局外人。', effect: { route: 'office', flags: ['witnesses-safe'], wanted: 1 } },
    ], missed: { text: '证人散走，具名作证的人数不足。纸上仍有材料，明日却少了当面质问的声音。', effect: {} } },
];

for (const event of storyEvents) event.choices.push(...artEchoChoices(event.id), ...battleChoices(event.id));
