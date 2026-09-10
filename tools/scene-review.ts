import { storyEvents } from '../lib/game/campaign-content.ts';
/** 内部准入清单，不导入玩家界面。 */
export const proofPaths = {
 official: [['assassin','archive'],['roads','prefecture'],['hearing','buycopy']],
 transport: [['fire','cordon'],['roads','river'],['riverfight','bargain']],
 medicine: [['temple','medicine'],['roads','mountain'],['pharmacy','recover']],
} as const;
const notes:Record<string,[string,string,string]>={
 temple:['不承诺护送，只送信或暂离；保留自由但不护住老人','遗嘱可用于公议，陆观澜仅承认实际托付','岳寒声知道门内药源，不知道官档'],
 assassin:['救门外伤者或暂离；不追凶但县令可能无人保护','顾清河存亡与官档去向分开，邻府仍留底档','宁不平看见弦与梁上动静，不能指认幕后'],
 inheritance:['不争位，登记证人或暂离；不作护送承诺也无守诺助阵','名单可供公议，遗嘱不能替陆观澜决定继位','陆只依据所见遗嘱、师门死讯和证人名册'],
 fire:['留在火外保粮或暂离；避免深入却不能保全人与账','脚夫门路、苏的抄账与账房存亡各自回收','苏只知抄账，不知伪印制作'],
 identity:['避开复核或暂离；省担保银却无合法路引','公门差事、公开验人、水道盘问受实际身份影响','自报、登记、核验三栏独立'],
 survivor:['暂离，不赎也不订三日约；保住银钱和时间，失去活人口供','其后可查货单和三账，不能伪造此人的目击证言','商旅只能述亲见袭击，不指认未见的下令人'],
 sister:['不救或暂离；不花钱、不露面，却失去救人窗口','第四十一日不得假称妹妹已获救，也不能凭空核货签','苏优先妹妹，只交自己掌握的抄账'],
 roads:['留县不出门；省两日食宿，但错失本轮外路材料','药库、听审和补账仍可补证','药农、秤签、邻府分别只证一段'],
 pharmacy:['不买不夜取或暂离；省钱免追查，却拿不到当场药库记录','药源可由前期留底或后续补账确认','沈能辨药性，不能替人证定罪'],
 assembly:['护不站队者下山；放弃当场问责，保全离山者','公议问责和乡民互保都是侠行资格来源','门人核笔迹，药农核领用，遗嘱不是毒案判词'],
 riverfight:['救民船不取账或撤离；不用替乔五付钱，但运输账留在对方','幸存脚夫可作证；后续仍可补账','乔五只交易实际掌握的账'],
 hearing:['不具结，抄底档或暂离；不补虚词，暂失当场立案机会','真档可留到末期核卷；交夜路会损害旧关系','宁区分证词、抄件和判词'],
 olddebt:['不护客栈或暂离；免当夜风险，也无安全屋安排','证人之夜只承认实际设置的落脚处','苏只回收妹妹、护店、已知水道经历'],
 hunt:['撤退或暂离；保自己但可能失证或失去医者','医者生死影响差事与助阵，病案不能补回一个人','医者只对亲自验过的伤作证'],
 ship:['保人、保货、封水分选或退开；免现场风险而药害继续','河水、船工与药记录进入终局','不能把沉船说成毒物已消失'],
 order:['不接公账或暂离；免持续责任，却无转运行或互保资格','民生责任分别支撑侠行、行商、公门','乡民互保不代表全县一致同意'],
 threeledgers:['只补缺账或暂离；不凑伪证，缺账只能有限控告','三种来源分别核验，终局保留缺口','副本不能冒充原件，人证不能代替药性'],
 lastprice:['拒绝站队或暂离；不拿即时好处，旧债追查不抹去','终局仍受实际钱债、材料、门路限制','买家不能知道未交付的材料'],
 witnessnight:['不护证或暂离；免守候和车费，证人散去','未设落脚处不能写成证人获救','可公开威胁信，幕后指使仍需证据'],
};
type CausalAudit={promoterMotive:string;trigger:string;playerKnown:string;prelude:string;naturalSource:string;activeSource:string;recoverySource:string;aftermath:string;changeable:string;saveImpact:string;tests:string};
const causal:Record<string,CausalAudit>={
 temple:{promoterMotive:'岳寒声为躲避搜捕、保住遗嘱与药库所知而藏入破庙；追索者的最终授意人仍不在此事件定死。',trigger:'第4日来信窗口开启，岳寒声仍存活且事件未结算。',playerKnown:'只知道破庙有负伤老者、有人沿路搜索，以及他自报姓名后的当面托付。',prelude:'药渣、血草叶和两组脚印先于见面出现。',naturalSource:'药铺伙计归途所见把玩家带到破庙。',activeSource:'沿药渣、折芦与深浅脚印主动追查伤者和搜索者。',recoverySource:'庙祝保存的血绷带与追问者去向补证“此处发生过什么”。',aftermath:'破庙火灰、岳寒声存亡与遗嘱实际去向分别回应。',changeable:'可改变岳寒声处境、遗嘱归属、关系与侠行/医道/商道/夜行积累。',saveImpact:'resolved.temple、npcAlive.yue-hansheng、testament/medicine、yue-safe 与 NPC 记忆；只结算一次。',tests:'A01/A02、P2-04 前兆三源与缺席回看。'},
 assassin:{promoterMotive:'匿名刺客直接要阻止顾清河继续处理盐路案卷；雇主身份在本事件只作为待证问题。',trigger:'第5日县衙请见证人入廊，顾清河仍在且事件未结算。',playerKnown:'只看见断弦、梁上寒光、箭路与县衙当场反应。',prelude:'侧门提前关闭、新琴弦、发涩门索与逆雨干脚印。',naturalSource:'县衙公开请见证人的告示与反常戒备。',activeSource:'主动核对琴弦、廊门和屋脊落脚处。',recoverySource:'书吏保存的箭孔、断弦和当日值守簿。',aftermath:'补门木板、另存值守簿，并按县令和书吏真实存亡回应。',changeable:'可改变顾清河/书吏存亡、官档去向、关系与追查。',saveImpact:'resolved.assassin、gu-safe/people-safe、npcAlive.gu-qinghe、official、关系及战斗记录。',tests:'A01/A02、B 系列、P2-04 回声与防重复。'},
 inheritance:{promoterMotive:'韩百川及支持者要尽快稳定继位；陆观澜更在意先查清师父死因而不肯把议位当答案。',trigger:'第6日掌门讣帖公开送达，事件未结算。',playerKnown:'只知道掌门死讯、公开议位和陆观澜当面表达的查因立场。',prelude:'讣帖、召回门牌与赴山名册先出现。',naturalSource:'青岳门公开讣帖送到客栈。',activeSource:'核验纸印、送帖门牌和赴山签名。',recoverySource:'客栈留下的讣帖存根和未赴山者名单。',aftermath:'酒桌议论与签名回执只对应实际遗嘱、名单或路粮。',changeable:'可改变陆观澜是否赴议、证人名册、路粮与门派关系。',saveImpact:'resolved.inheritance、lu-pledged/assembly-pass/mountain-credit、testament 与关系。',tests:'A01/A02、P2-04 来源差异和错过边界。'},
 fire:{promoterMotive:'实施纵火者要毁去码头账目，乔五一方也借乱清除异己；具体幕后责任仍需后续证据。',trigger:'第7日账房起火；此前水缸、油罐和守夜布置会影响可选处置。',playerKnown:'只知道火场、风向、账房与货仓同时受威胁，以及自己实际做过的布置。',prelude:'油罐贴近木账房、守夜水缸见底、换岗留空。',naturalSource:'连续两日码头堆油与当日风向让火险自然可见。',activeSource:'花三两验仓号、补水、移油并预置破窗钩和疏散绳。',recoverySource:'幸存脚夫给出的烧裂油罐牌和空水缸领用单。',aftermath:'账房生死、东仓损失、原账/抄账和纵火者是否被截各自留下回声。',changeable:'可凭前期有代价布置同时保人保东仓，但牺牲抓人和原账；失败后仍可追抄件与仓号。',saveImpact:'journal scout:fire、firebreak-ready、resolved.fire、clerk-safe/cargo-safe、transport、关系；禁止重复领布置。',tests:'P2-05 最坏结果阻止、费用、失败继续、读档与重复点击。'},
 identity:{promoterMotive:'县衙在连续死讯、刺杀与火灾后要重建城门秩序并复核身份；不同差役也会据旧记录自保。',trigger:'第8日封城榜生效，旧口供、登记与当前身份进入复核。',playerKnown:'只知道公开复核规则、自己的三栏记录和当面担保条件。',prelude:'城门增挂横木、抄录旧页并预贴逐栏复核榜。',naturalSource:'县衙封城榜公开说明复核方式。',activeSource:'比对榜文、旧口供页码与新复核簿。',recoverySource:'公示栏留存规则和个人旧登记页号，可供日后补办。',aftermath:'往后盘问按真实路引、担保、口供差异或水道记录变化。',changeable:'可改路引、追查、通行与后续公门/商道/夜行路径。',saveImpact:'resolved.identity、hasRoadPass、identity-checked/waterway、wanted 与 NPC 记忆。',tests:'A01/A02、P2-04 第八日回声、v7 严格存读。'},
 survivor:{promoterMotive:'乔五扣住幸存商旅作筹码并阻断公开证言；商旅只求脱身。',trigger:'第12日获知活口被扣且事件未结算。',playerKnown:'只知道活口被拘、乔五提出的当面交换和活口亲见范围。',prelude:'码头送饭次数增加、后仓门闩换新、客栈寻人未果。',naturalSource:'苏晚棠收到一张写着活口衣着的赎人条。',activeSource:'查送饭碗数与后仓轮班，确认有人被单独看守。',recoverySource:'错过后由船工交出货单缺名和空牢饭签。',aftermath:'活口是否安全、证词是否存在和乔五态度分别变化。',changeable:'可用钱、劳力、公验或夜路救人并取得有限证言。',saveImpact:'resolved.survivor、survivor-safe、witness、wanted、关系与三日耗时。',tests:'A01/A02、L 系列长耗时与证言边界。'},
 sister:{promoterMotive:'控制盐场转运的一方扣留苏小蝉以牵制苏晚棠；苏晚棠要先救妹妹再谈账。',trigger:'第16日拘人契据和转运班次形成短窗口。',playerKnown:'只知道小蝉被限制去留、当日转运与苏晚棠提出的救人办法。',prelude:'客栈收到缺角契纸，盐场女工名册少一人。',naturalSource:'苏晚棠拿出妹妹来信和拘人契副页。',activeSource:'核对盐场点名、船签和换班路线。',recoverySource:'错过后从空床铺、退回契纸和离场船签补知去向。',aftermath:'姐妹是否团聚、抄账是否交付与乔五警觉分别回收。',changeable:'可改变小蝉处境、运输证据、追查和苏晚棠关系。',saveImpact:'resolved.sister、sister-safe、transport、wanted 与关系。',tests:'A01/A02、L 系列人物存亡和证物一致性。'},
 roads:{promoterMotive:'封锁松动后药农、船户与书吏各想保住自己的生计或底档；玩家只能花两日走一条外路。',trigger:'第20日城外道路重新可走且两日窗口尚在。',playerKnown:'知道四条公开去向、耗时和每条能核的材料类型。',prelude:'城门换路牌、船户招押货、北山药农求助、邻府开放递状。',naturalSource:'城门公告列出恢复通行的三条官民道路。',activeSource:'分别向药农、船户或书吏核对实物与签押。',recoverySource:'错过后可从回城货签、药铺转抄或邻府公示补一段，不补两日实践。',aftermath:'所走路线改变药、货、官档与后续关系，其余道路照常运转。',changeable:'选择一种证据、收入、通行或水道门路，承担两日时间与食宿。',saveImpact:'resolved.roads、medicine/transport/official、assembly-pass/cargo-safe/waterway、时间债务。',tests:'A01/A02、proofPaths、长时行动存档。'},
 pharmacy:{promoterMotive:'经手药物流出者要清空药库痕迹；沈砚秋要保存可复核的药性与领用记录。',trigger:'第25日药库被搬空后残渣和焦签仍可查。',playerKnown:'只知道空库、残渣、药签与沈砚秋亲验边界。',prelude:'药柜提前退空、废栈夜间运箱、药农躲避点名。',naturalSource:'回春堂发现常用原料断供并邀人核残渣。',activeSource:'逐项对照药性反应、领用日期和仓签。',recoverySource:'错过后从病案留样、药农底单或废栈焦纸补证。',aftermath:'医馆供药、沈砚秋存亡与药库证据各自影响后续。',changeable:'可花钱、夜取或协助检验取得药证并改变关系/追查。',saveImpact:'resolved.pharmacy、medicine、wanted 与沈砚秋关系。',tests:'A01/A02、proofPaths medicine 三源。'},
 assembly:{promoterMotive:'韩百川要完成继位并压下药库追问；陆观澜与部分门人要求先核遗嘱和领药记录。',trigger:'第28日山门公议召开，入场材料和前期关系决定选项。',playerKnown:'只知道公议席位、公开主张和现场核验的笔迹/签押。',prelude:'山门分发席牌、封药库、召旧门人核笔迹。',naturalSource:'青岳门公示公议时辰与到场门规。',activeSource:'向旧门人、药农与抄录者分别核材料来源。',recoverySource:'错过后由下山弟子带回公议抄本和封库告示。',aftermath:'公议问责、门人离山或高位归属按实际结果延续。',changeable:'可改变问责、陆观澜承诺、门人安全与侠行资格。',saveImpact:'resolved.assembly、assembly-won/disciples-safe/lu-pledged、关系。',tests:'A01/A02、L 路线资格与材料门槛。'},
 riverfight:{promoterMotive:'乔五与争夺盐路的对手都要控制河道、账副本和船位，民船被夹在冲突中。',trigger:'第32日盐河断索、两岸对峙并出现救人/取账窗口。',playerKnown:'只知道现场两方争船、伤员、账副本和民船危险。',prelude:'缆索被割半股、两岸囤箭、民船收到停航口信。',naturalSource:'船户敲锣示警并请求解开民船。',activeSource:'查断索切口、船位和底舱备账位置。',recoverySource:'错过后由幸存脚夫的伤单、断索和过秤签补证。',aftermath:'民船、伤员、运输账和乔五关系分别延续。',changeable:'可救人、换账、取副本或战斗，改变证据、钱、追查与关系。',saveImpact:'resolved.riverfight、transport/witness、people-safe、wanted、战斗记录。',tests:'A01/A02、B 系列、proofPaths transport。'},
 hearing:{promoterMotive:'巡按要形成可落卷的有限案件；宁不平要保留可核证词而非用虚词填满案卷。',trigger:'第36日听审开堂，实际持有材料和证人决定可用选项。',playerKnown:'知道听审要求、自己持有的副本/证言及每项不确定处。',prelude:'公示列明具结格式、原件副本分栏和证人候位。',naturalSource:'巡按听审榜公开征集具名材料。',activeSource:'查档号、签收人、证人记忆空白和抄件印样。',recoverySource:'错过后可从公示底档和宁不平留存页补取有限副本。',aftermath:'立案、追查减免、乔五关系与真档留存按递交内容变化。',changeable:'可入卷、保留材料、买抄件或交代夜路，改变证据与追查。',saveImpact:'resolved.hearing、hearing-filed/amnesty、official、wanted 与关系。',tests:'A01/A02、proofPaths official、证词边界。'},
 olddebt:{promoterMotive:'追账和寻证者要逼苏晚棠交出藏账与落脚处；她要先转移伙计及妹妹。',trigger:'第41日客栈受压、后门转移窗口开启。',playerKnown:'只知道来人催账、店内要转移的人和苏晚棠愿交出的有限物件。',prelude:'陌生客轮守后门、房簿被索看、伙计行李提前打包。',naturalSource:'苏晚棠关半扇店门并当面说明护店需求。',activeSource:'核对盯梢班次、后门路线和实际在店人员。',recoverySource:'错过后从封条、散落房簿页和邻铺证言补知店变。',aftermath:'安全屋、藏账、伙计与姐妹处境分别进入后续。',changeable:'可护店、转移人员、核货签或走水道，改变安全屋和关系。',saveImpact:'resolved.olddebt、safehouse、transport、wanted 与关系。',tests:'A01/A02、witnessnight 前置和人物边界。'},
 hunt:{promoterMotive:'未具名追杀者要灭掉沈砚秋及病案这一证据来源；下令人身份仍须另证。',trigger:'第45日医馆被列入追索名单且夜袭临近。',playerKnown:'只知道名单、盯梢、病人与医者面临的当夜危险。',prelude:'药旗被割、后巷出现记号、病人名单遭人抄看。',naturalSource:'沈砚秋发现名单页被翻动并请求转移病人。',activeSource:'查后巷脚印、空药箱车和盯梢换岗。',recoverySource:'错过后从碎灯、病案缺页和幸存病人口述补知夜袭。',aftermath:'医者存亡、病案保存、病人去向与落脚处暴露分别回收。',changeable:'可凭安全屋、同伴、车钱或公开保护救人，改变关系与追查。',saveImpact:'resolved.hunt、npcAlive.shen-yanqiu、shen-safe、关系。',tests:'A01/A02、L 医道资格与人物死亡。'},
 ship:{promoterMotive:'运药一方要转移或销毁问题货物，拦截者要夺人夺清单；双方冲突把沿河居民置于药害风险。',trigger:'第49日装药船在封锁河湾失控。',playerKnown:'只知道船上人员、药桶、取水口与当场可行的救援代价。',prelude:'船身吃水异常、桶缝渗黑、上游取水口仍开。',naturalSource:'船工呼救和沿岸异味把玩家引到河湾。',activeSource:'验桶签、吃水、风向和引水口位置。',recoverySource:'错过后从漂桶、死鱼带和船工名册补知污染范围。',aftermath:'船工、药桶、河水封锁与清单各有独立后果。',changeable:'可救人、拖船、封水或交易清单，改变药证、运输证据和河道安全。',saveImpact:'resolved.ship、boatmen-safe、river-safe/river-poisoned、medicine/transport/witness。',tests:'A01/A02、终局 worldReckoning 与河道后果。'},
 order:{promoterMotive:'县衙、仓主、脚夫与各巷居民都要在秩序真空中取得粮仓控制或分配保障。',trigger:'第53日粮仓必须开仓且原有运转失灵。',playerKnown:'知道仓粮数量、钥匙分持、各巷缺口和公开方案代价。',prelude:'粮价上浮、领粮簿漏名、三把钥匙无人共管。',naturalSource:'县衙贴出开仓召集并公开现存仓数。',activeSource:'逐巷核人数、仓重、运价和钥匙经手。',recoverySource:'错过后从领粮簿、空仓封条和巷口签名补知分配结果。',aftermath:'互保、平价转运、公账责任或夜送粮票成为不同民生回声。',changeable:'可改变粮食分配、公责、商路与侠行资格。',saveImpact:'resolved.order、civil-order/guild-founded/public-duty、money、wanted 与关系。',tests:'A01/A02、L 侠行/商道资格。'},
 threeledgers:{promoterMotive:'宁不平和愿作证者要在期限前把官档、运输账、药签分源核验；反对者希望缺口继续存在。',trigger:'第55日终局核卷前最后补账窗口。',playerKnown:'只知道当前缺哪类材料、每份来源和副本限制。',prelude:'候事廊分设三桌、档号与签收人先行公示。',naturalSource:'宁不平按现有案卷发出缺账清单。',activeSource:'分别追档号、码头货签、药农签押，拒绝跨源代证。',recoverySource:'错过后只能在末页看到缺口记录，不能凭空生成材料。',aftermath:'三账齐全或有限控告直接改变最后可说到哪一步。',changeable:'可补一类真实证据、花钱重抄或承认缺口。',saveImpact:'resolved.threeledgers、official/transport/medicine、最终 mainProof。',tests:'A01/A02、proofPaths、终局不夸大。'},
 lastprice:{promoterMotive:'各利益方在落卷前用银钱、职位、保护或威胁购买玩家手中材料与立场。',trigger:'第56日材料、债务、追查和关系进入最后报价。',playerKnown:'只知道当面报价者、自身持有物和明确交换条件。',prelude:'不同信使问同一份材料但给出不同交割地点。',naturalSource:'具名或可辨来处的报价信送到当前落脚处。',activeSource:'核对信使、交割物、付款能力与自己实际持有材料。',recoverySource:'错过后只保留未接受报价的信封和既有债务，不补交易收益。',aftermath:'拒绝、公开或交易分别改变钱、追查、关系与终局入口。',changeable:'可接受有限交易、公开筹码或拒绝站队，承担对应代价。',saveImpact:'resolved.lastprice、money/debt/wanted、evidence、关系与末期 flags。',tests:'A01/A02、存档实物一致性与终局资格。'},
 witnessnight:{promoterMotive:'威胁者要在最终听审前驱散或压服证人；幕后主使仍须靠可核证据确认。',trigger:'第57日证人集中落脚且威胁信到达。',playerKnown:'只知道威胁信、落脚名单和当夜可用守护资源。',prelude:'巷口暗号被试探、车轮钉遭拔、威胁信写明散去时限。',naturalSource:'证人把收到的威胁信交给玩家或宁不平。',activeSource:'查守夜路线、车辆、灯号和实际到场证人。',recoverySource:'错过后从空房、遗落行李与撤回证词记录补知证人散去。',aftermath:'证人是否留下、安全屋是否有效和公开威胁材料分别进入核卷。',changeable:'可守护、用车分送、公开威胁或联络旧网，改变证人与终局助力。',saveImpact:'resolved.witnessnight、witnesses-safe、safehouse/关系/钱与终局助阵。',tests:'A01/A02、终局证人状态和缺席不补救人。'},
};
export const eventReviews=storyEvents.map((e,i)=>({id:e.id,title:e.title,defaultResult:e.missed.text,deadline:storyEvents[i+1]?.day??58,refusal:notes[e.id]?.[0],echo:notes[e.id]?.[1],knowledge:notes[e.id]?.[2],...causal[e.id],feedback:e.choices.filter(c=>!c.id.startsWith('art-')&&!c.id.startsWith('battle-')).map(c=>`${c.id}：${c.reply}`)}));
export const specialReviews=[
 ['gate','城门盘查','车流与盘查照常进行，等候耗时','不报细节但被继续盘问，不等同安全放行','gate-echo只核当时口供，不向医馆共享','gatePhase / playerClaims / npcStates.memory / dayOne','D03、D20、A04'],
 ['inn','客栈登记','只按实际登记提供客房','拒绝登记不留姓名，也不能入住；可重新登记','inn-echo区分登记与亲见残片','lodgingRecords / dayOne.registration / npcStates.memory','D04、A04'],
 ['clinic','医馆授权','伤口随时间恶化，不强制验伤','拒绝来历保隐私；拒检不花诊金但延误止血，可重新授权','clinic-echo区分止血、验毒、留样、保密和报案授权','dayOne.interview / consent / cloth / reportAuthorized','G03、D05、A04'],
 ['custody','证物归属转折','搜查、交存、交易和战败按实物扣除','不交存保有纸张，却不能声称已经封案','背包只显示仍持有物；已知线索不会因失物抹去','inventoryItemIds / evidenceCustody / campaign.evidence / battles.records','D03、P10、A05'],
 ['relations','立约与拒绝转折','NPC继续自身职责','解约付六两或记债；不锁死路线、不归零所学','旧伙伴减少协助，新差事仍可积累','campaign.pledge / journal / npcStates.memory','L系列、A04'],
 ['prologue','序章三种暂结','第三日船车按时离开','封存、夜渡、交物都不强迫查全案','接续长篇保留伤势、旧债、身份、实物','prologueEnding / saltCase / campaign.prologueRecord','P01–P18、L系列'],
 ['ending-career','人生立业终局','第六十日最后时刻按事实定稿','五方向各有承担，有限追责不等于真相大白','三账齐全才公开链条，人物逐项核卷','campaign.finale / finaleStep / ending / flags','L01十条通关样本、A02'],
 ['ending-open','退隐与远走终局','到时留城；满足窗口可远走','不担清算职责，旧债与未解问题仍在','不奖励完整真相与深度关系','campaign.ending / endedAt / debt','L系列、A02'],
 ['ending-forced','死亡与拘押终局','明示危险或认拘后冻结','认拘保命却冻结；死亡不能由休息复活','可存读回看，不能继续移动、战斗、取物','player.alive / deathCause / gatePhase / campaign.ending','D20、D23、B系列、A02'],
] as const;
export function reviewErrors() {
 const errors:string[]=[];
 if(eventReviews.length!==19||new Set(eventReviews.map(r=>r.id)).size!==19) errors.push('关键事件登记不完整');
 for(const r of eventReviews) {
  if(!r.refusal||!r.echo||!r.knowledge||!r.feedback.length||!r.promoterMotive||!r.trigger||!r.playerKnown||!r.prelude||!r.naturalSource||!r.activeSource||!r.recoverySource||!r.aftermath||!r.changeable||!r.saveImpact||!r.tests) errors.push(`${r.id} 模板缺项`);
  if(new Set([r.naturalSource,r.activeSource,r.recoverySource]).size!==3) errors.push(`${r.id} 三层来源重复`);
 }
 for(const [proof,paths] of Object.entries(proofPaths)) {
  if(new Set(paths.map(p=>p[0])).size<3) errors.push(`${proof} 不足三个独立场景来源`);
  for(const [id,choice] of paths) if(!storyEvents.find(e=>e.id===id)?.choices.find(c=>c.id===choice)?.effect.evidence?.includes(proof)) errors.push(`${proof} 来源未实现`);
 }
 return errors;
}
