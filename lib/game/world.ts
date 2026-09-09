import type {
  ClueDefinition,
  InventoryItemDefinition,
  KnownFactDefinition,
  LocationDefinition,
  NPCPublicDefinition,
  WorldEventDefinition,
} from './types.ts';

export const factions = [
  { id: 'yamen', name: '县衙', summary: '维持明面秩序，内里派系盘根错节。' },
  { id: 'river-gang', name: '漕帮', summary: '控制码头、脚夫与地下货路。' },
  { id: 'qingyue', name: '青岳门', summary: '当地武林门派，掌门继承暗潮涌动。' },
] as const;

export const locations: LocationDefinition[] = [
  { id: 'gate', name: '青石县城门', shortName: '城门', description: '雨云压着斑驳城楼，差役正逐一盘问进城客商。', arrival: '你踏过泥泞，来到青石县城门。', weather: '阴雨将至', npcIds: ['ma-sandao'], mapPosition: { x: 18, y: 48 } },
  { id: 'inn', name: '悦来客栈', shortName: '客栈', description: '大堂酒气温热，南来北往的耳目都藏在碗沿之后。', arrival: '你推开悦来客栈的木门，喧闹声顿了一瞬。', weather: '檐雨淅沥', npcIds: ['su-wantang', 'lu-guanlan'], mapPosition: { x: 42, y: 34 } },
  { id: 'yamen', name: '县衙', shortName: '县衙', description: '朱漆剥落的公门前立着两尊石兽，鸣冤鼓积满雨水。', arrival: '你来到县衙前，值守衙役隔着雨幕打量你。', weather: '天色沉暗', npcIds: ['gu-qinghe', 'ning-buping'], mapPosition: { x: 63, y: 25 } },
  { id: 'dock', name: '河岸渡口', shortName: '渡口', description: '夜色压住河湾，只有几条小船在芦苇外静候。这里不是可随意探查的码头。', arrival: '河腥气扑面而来，你来到约定的河岸渡口。', weather: '河风渐紧', npcIds: ['qiao-wu'], mapPosition: { x: 78, y: 67 } },
  { id: 'temple', name: '城外破庙', shortName: '破庙', description: '半截山门埋在荒草里，无头泥像前留着新鲜火灰。', arrival: '你绕出县城，在暮色前赶到那座破庙。', weather: '乌云压山', npcIds: ['yue-hansheng'], mapPosition: { x: 25, y: 80 } },
  { id: 'clinic', name: '回春堂医馆', shortName: '医馆', description: '药香压住了血腥气，柜上铜秤仍在轻轻摆动。', arrival: '你掀帘走进回春堂，满室药香令人稍安。', weather: '雨打药旗', npcIds: ['shen-yanqiu'], mapPosition: { x: 56, y: 55 } },
];

export const clues: ClueDefinition[] = [
  { id: 'attack-phrase', title: '“丁字十七”', description: '昏沉中，你听见袭击者反复喊着“找丁字十七”。你还不能确定它指的是人、物还是编号。' },
  { id: 'abnormal-wound', title: '异常伤口', description: '伤口不深，却迟迟不能止血，边缘还泛着不自然的暗色。' },
  { id: 'ding17-fragment', title: '带编号的公文残片', description: '一张沾血的旧公文残片，只能辨认出“丁字十七”和半枚县衙火漆，具体用途尚不明确。' },
  { id: 'black-scale-wax', title: '黑鳞蜡痕', description: '残片背面黏着鱼鳞形的黑蜡，并带有极淡的苦涩药味。' },
  { id: 'matching-corpse-wound', title: '相似的死者伤口', description: '第二日发现的无名尸体带有相似伤口，说明路边袭击并非孤立事件。' },
];

export const knownFacts: KnownFactDefinition[] = [
  { id: 'cart-mark', text: '免检油布货车门铰链有鱼鳞形黑蜡，车夫右眉留着一道旧疤。' },
  { id: 'cheng-identity', text: '死者已被认出是商旅账房程守义，面貌与左耳、小指的特征相合。' },
  { id: 'medical-report', text: '沈砚秋出具病案副本：两人受同类淬毒刃所伤；死者因失血及毒性加重而亡。' },
  { id: 'cargo-schedule', text: '县衙预报：丁字十七号船第三日上午九点抵埠，货车下午三点离城。' },
  { id: 'ning-referral', text: '沈砚秋指点你去县衙候事廊向总捕头宁不平递交线索。' },
  { id: 'cart-verified', text: '宁不平已核对转运车的车号、车夫与门铰链蜡痕，尚需及时完成文书手续。' },
  { id: 'ledger-verified', text: '放行簿、门钱记录与两份口供互证；守门差役试图撕毁相关簿页。' },
  { id: 'sealed-case', text: '宁不平封存盐引残片、病案副本和放行簿，扣下货车，带走马三刀候审。' },
  { id: 'gate-selective-inspection', text: '青石县近日严查普通行旅，但某些货车似乎不受盘查。' },
  { id: 'guard-search-threat', text: '城门差役会以搜查和扣押惩治顶撞者。' },
  { id: 'ma-public-bribe-caution', text: '守门差役在同僚面前刻意避谈银钱。' },
  { id: 'ma-private-bribe-signal', text: '守门差役可能接受两两银子的私下打点，但不肯在人前留下把柄。' },
  { id: 'ma-cart-deflection', text: '守门差役以“漕运关防”为由回避货车免检之事。' },
  { id: 'ma-ding17-reaction', text: '守门差役听见“丁字十七”后向城内使了个眼色，用意尚不清楚。' },
  { id: 'doctor-wound-residue', text: '沈砚秋在你的伤口残留物中辨出一股异常苦味，但还不能断定具体毒物。' },
  { id: 'clinic-corpse-details', text: '河边无名尸的创口很浅，却因持续失血而死，衣物上没有可供辨认身份的物件。' },
  { id: 'corpse-wound-link', text: '第二日河边无名尸与自己的伤口可能都接触过乌鳞散。' },
  { id: 'inn-corpse-rumor', text: '今晨河边发现一具无名尸，后来被送往回春堂。' },
  { id: 'baggage-watch-mark', text: '行囊外带内侧有一道新划的短痕，像是供人辨认这只行囊的记号；留下者与用意都还不明。' },
  { id: 'inn-arrival-inquiry', text: '天未亮时有人到客栈问过：今日是否会有带伤、背湿行囊的外乡客投店；来人午后会换地方。' },
  { id: 'day-end-watch-rumor', text: '换班脚夫听见有人打听一个今日进城的带伤外乡客；问话者明早会去码头改搭别船。' },
  { id: 'next-morning-moving-lead', text: '现有迹象指向同一件事：有人预先留意你的到来，并会在次日更换接头的人、船或落脚处。' },
  { id: 'dock-salt-movement', text: '渡口脚夫按官盐船号换班，空车先候在岸上；“丁字十七”在这里是船货编号，不是人名。' },
  { id: 'clinic-routine', text: '回春堂把伤者来处、药材领用和留样分别登记；病案只能证明医者实际验过的伤。' },
  { id: 'day2-public-notice', text: '县衙贴出告示：近日盐路与渡口交接将加验船号、路引和经手签押，异常已牵涉官面秩序。' },
  { id: 'public-yamen-role', text: '县衙公开负责路引、官盐文书、封验与城门秩序；宁不平等差役只能按可核记录办事。' },
  { id: 'public-river-gang-role', text: '漕帮公开掌握河道船位、码头脚夫和货物交接；乔五是河上脚夫会看脸色的人。' },
  { id: 'public-qingyue-role', text: '青岳门是本地公开活动的武林门派，门人会为山门声名、同门安危和掌门之事出面。' },
  { id: 'act-one-surface-conflict', text: '眼下公开可见的冲突是：县衙要维持盐路与城门秩序，漕帮要守住河运生计和地盘，青岳门则因门人卷入而介入；三方说法尚不能证明幕后责任。' },
  { id: 'act-one-involvement', text: '荒道上有人喊“丁字十七”，又有人提前辨认带伤外乡客与行囊；第三日同号船成为争执中心，各方因此把你当作能接上这段时序的见证人。' },
];

export const inventoryItems: InventoryItemDefinition[] = [
  { id: 'blood-cloth', name: '自留血布', description: '完整处理伤口后自留的原布条，尚未授权医者检验。' },
  { id: 'temporary-stay-permit', name: '三日暂留凭条', description: '宁不平签发的暂留凭条，有效期限记在结案记录中；不是永久路引。' },
  { id: 'evidence-receipt', name: '证物交存收据', description: '盐引残片、病案副本与核验材料交存县衙的凭据，不代表案中所有秘密已经查清。' },
  { id: 'ding17-fragment', name: '带编号的公文残片', description: '藏在行囊夹层中的沾血公文。它可能招来比银钱更危险的目光。' },
];

export const worldEvents: WorldEventDefinition[] = [
  { id: 'roadside-ambush', storyDay: 1, offsetMinutes: 0, title: '荒道袭击', hiddenSummary: '商旅遇袭，账房将盐引残片藏入主角行囊后失踪。' },
  { id: 'nameless-corpse', storyDay: 2, offsetMinutes: 12 * 60, title: '河边无名尸', hiddenSummary: '天亮前，河边发现一具带有乌鳞散伤痕的无名尸体，随后被送往回春堂。' },
  { id: 'ding17-ship-arrives', storyDay: 3, offsetMinutes: 40 * 60, title: '丁字十七号货船抵埠', hiddenSummary: '挂着合法盐引的货船抵达漕帮码头，私货开始转运。' },
  { id: 'yue-hansheng-hides', storyDay: 4, offsetMinutes: 64 * 60, title: '岳寒声藏入破庙', hiddenSummary: '岳寒声携掌门遗嘱与信物逃入城外破庙。' },
  { id: 'magistrate-assassination', storyDay: 5, offsetMinutes: 88 * 60, title: '县令遇刺', hiddenSummary: '针对顾清河的刺杀发动，结果由此前的警告、证据和站队决定。' },
  { id: 'qingyue-leader-dies', storyDay: 6, offsetMinutes: 112 * 60, title: '青岳门掌门死讯', hiddenSummary: '青岳门宣布掌门去世，继承争端公开爆发。' },
  { id: 'dock-ledger-fire', storyDay: 7, offsetMinutes: 136 * 60, title: '码头账房大火', hiddenSummary: '漕帮试图焚毁账房灭证，乔五也借机清除异己。' },
  { id: 'county-lockdown', storyDay: 8, offsetMinutes: 160 * 60, title: '青石封城', hiddenSummary: '县衙封锁城门，各方根据现存证据和势力状态开始清算。' },
];

export const npcs: NPCPublicDefinition[] = [
  { id: 'ma-sandao', observedLabel: '腰挂铁尺的守门差役', observation: '一个脸颊带刀疤的差役拦在道中，手始终没有离开腰间铁尺。' },
  { id: 'su-wantang', observedLabel: '柜台后的青衣女子', observation: '青衣女子一边拨弄算盘，一边不动声色地留意大堂里的每句话。' },
  { id: 'gu-qinghe', observedLabel: '案后的文士', observation: '一名衣着素净的中年文士坐在案后，目光温和，却让人难以直视。' },
  { id: 'ning-buping', observedLabel: '沉默的佩刀汉子', observation: '那汉子靠柱而立，目光先落在你的手上，随后才看向你的眼睛。' },
  { id: 'qiao-wu', observedLabel: '被脚夫簇拥的壮汉', observation: '壮汉笑声洪亮，周围脚夫却在他抬手时同时噤声。' },
  { id: 'shen-yanqiu', observedLabel: '右手微颤的医者', observation: '一名医者正在整理银针，右手偶尔轻颤，动作却仍旧准确。' },
  { id: 'yue-hansheng', observedLabel: '庙中的负伤老者', observation: '老者倚着残破神龛闭目调息，衣襟下隐约透出干涸血迹。' },
  { id: 'lu-guanlan', observedLabel: '临窗饮酒的负剑客', observation: '年轻剑客独坐窗边，酒盏未空，目光却从未真正落在杯中。' },
];

export const getLocation = (id: string) => locations.find((item) => item.id === id)!;
export const getNpc = (id: string) => npcs.find((item) => item.id === id)!;
export const getClue = (id: string) => clues.find((item) => item.id === id)!;
export const getKnownFact = (id: string) => knownFacts.find((item) => item.id === id)!;
export const getInventoryItem = (id: string) => inventoryItems.find((item) => item.id === id)!;
export const getWorldEvent = (id: string) => worldEvents.find((item) => item.id === id)!;
