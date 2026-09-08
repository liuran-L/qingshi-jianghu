import type { DialogueAIService } from './types.ts';
import type { AIInteractionProposal, InteractionIntent } from '../game/types.ts';

const proposal = (
  intent: InteractionIntent,
  dialogue?: string,
  narration?: string,
  riskTags?: string[],
): AIInteractionProposal => ({ intent, dialogue, narration, riskTags });

export const mockAIService: DialogueAIService = {
  async reply(view, request) {
    const turns = view.conversationTurns;
    switch (request.actionId) {
      case 'tell-attack':
        return proposal('state-claim', '“路引丢了？姓名、籍贯、同行何人，一样样说。说不清，今夜便别想过这道门。”', '他没有让路，先看你衣角未干的血迹，又用铁尺压住了行囊口。');
      case 'tell-pass-lost':
        return proposal('state-claim', '“只丢了路引？那便把籍贯、同行与落脚处说清楚。公门可不收一句‘与进城无关’。”', '他把你的含糊回答记在心里，目光停在行囊上。', ['suspicion']);
      case 'ask-guard-name':
        return proposal('ask-information', '“问起爷来了？城门巡检马三刀。如今是我问你——路引、来由，一样样说。”');
      case 'stay-silent':
        return proposal('wait', '“装哑巴？那便站到一边，等我腾出手来慢慢查。”', '他用铁尺点了点墙根，两名同僚也看了过来。', ['suspicion']);
      case 'ask-lodging':
        return proposal('ask-information', '“投宿？进城沿主街走，见着旧酒旗便是悦来客栈。掌柜认不认你，与我无关。”');
      case 'ask-clinic':
        return proposal('ask-information', '“有伤病便去回春堂。还能自己走，就别指望衙门派人抬你。”');
      case 'mention-ding17':
        return proposal('ask-information', '“什么丁十七、丁十八？这里查的是人和路引，不替你寻丢失的货。”', '他回答得很快，随即借着催赶后方行旅，向城内一名闲汉使了个眼色。', ['dangerous-information']);
      case 'challenge-search':
        return proposal('provoke', turns === 0 ? '“嘴倒硬。路引拿不出来，便把行囊解开，一件件验。”' : '“再多一句，便随我去班房里慢慢说。”', '守门差役横过铁尺，先招手唤近另一名差役。', ['search']);
      case 'offer-bribe':
        return proposal('bribe', '“两两，换这一次不细查。进城后别说在我这里见过什么。”', '他借着登记簿遮住手，收走了两两碎银。');
      case 'present-gate-document':
        return proposal('request-service', '“文书能对上。登记过便进，出了差错仍要回来问话。”', '差役核过印记，将文书原样交回。');
      case 'show-gate-fragment':
        return proposal('request-service', '“残缺公文也得登记来源。东西先扣，人到墙边候复核。”', '差役当面记下残片字样和经手人，将原物封在纸袋里。');
      case 'request-entry':
        return proposal('request-service', '“说得清不清，不由你定。站直了，让我再看一遍。”');
      case 'submit-search':
        return proposal('request-service', '“别乱动。查完有没有事，自有公门说法。”', '铁尺挑开包袱结，差役开始逐件翻看。');
      case 'inspect-wound':
        return proposal('inspect', undefined, '伤口并不算深，却迟迟不能止血。皮肉边缘泛着暗色，雨水冲过时传来一阵细密灼痛。以你现在的医术，还无法判断原因。');
      case 'inspect-bag':
        return proposal('inspect', undefined, '你摸遍湿透的行囊，在割开的夹层里发现沾血的公文残片。纸上只能辨出“丁字十七”与半枚县衙火漆。外带内侧还有一道很新的短划痕，像是给认得记号的人辨包用。');
      case 'inspect-fragment':
        return proposal('inspect', undefined, view.player.fatigue >= 85 ? '雨光在模糊的字迹上晃动。你头痛得厉害，暂时看不出比先前更多的东西。' : '你再次展开残片。翻到背面时，一小块鱼鳞形黑蜡在雨光中发亮，纸上还留着极淡的苦涩药味。');
      case 'observe-gate':
        return proposal('observe', undefined, '城门告示被雨水泡得发皱，只能辨出“严查行旅”几字。普通商贩都被盘问，几辆盖着油布的车却很快过去。');
      case 'request-room':
        return proposal('request-service', '“住店先付银，一晚二两。楼上还空着两间，想住便去柜前登记。”', '柜后女子抬手指了指楼梯，仍没有主动通报姓名。');
      case 'rest-night':
        return proposal('request-service', undefined, view.player.money < 2 ? '你摸了摸钱袋，碎银不够支付一夜房钱。柜台后的目光没有因此变得更热络。' : '你付了房钱，按自己的姓名登记，在二楼狭小客房里睡下。雨声断续敲窗，醒来时已过去六个时辰。');
      case 'request-treatment':
        return proposal('request-service', view.player.money < 3 ? '“这一回诊金三两。你若凑不齐，先别拆布条；眼下还没法给你用药。”' : '“我叫沈砚秋。这回诊金三两。创口不深，难处在血止得太慢。残血里有股异常苦味，像沾过药，却还不能断定是什么。”', view.player.money < 3 ? '医者没有拆开伤口，也没有取用药材。伤势尚未得到处理。' : '医者以药酒清创，又敷上一层气味辛苦的药泥。他把染黑的棉布单独收进瓷碟。');
      case 'ask-corpse':
        return proposal('ask-information', '“送来时已没了气。创口很浅，人却因失血没了。身上没有路引，也没有能认身份的物件。左耳有旧豁口，一根小指缺了半节，或许有人认得。”', '医者把声音压低，向你描述已经验过的体貌；姓名仍须由认识死者的人或商旅名册核对。');
      case 'compare-corpse-wound':
        return proposal('ask-information', '“像。创口走向与刃宽相近，两处都残着同一种苦味。我又验了一遍，应当是乌鳞散：同类淬毒兵刃所伤，不能据此断言是同一个凶手。”', '沈砚秋看着染黑棉布的瓷碟，说死者失血与毒性加重相叠，才没能撑过来。医学结论止于伤痕，不替任何势力定罪。');
      case 'ask-news':
        return view.sceneSignals.includes('nameless-corpse-spread')
          ? view.npc?.id === 'lu-guanlan'
            ? proposal('ask-information', '“酒客说河边捞上来一个无名客，送去回春堂了。我没去河边，真假你自己掂量。”')
            : proposal('ask-information', view.knownFactIds.includes('inn-corpse-rumor') ? '“能说的都说了。人已经送进回春堂，旁的消息还没传开。”' : '“今晨河边捞上来一个无名客，听说后来送去了回春堂。县里最近不太平，客官夜里少走动。”')
          : proposal('ask-information', '“雨天路滑，生意清淡。真要说反常，便是近来查路引比往常严。”');
      case 'ask-name':
        return view.npc?.id === 'shen-yanqiu'
          ? proposal('ask-information', '“沈砚秋。坐堂看病而已，不必称先生。”')
          : proposal('ask-information', '“萍水相逢，名字未必有你想的那般要紧。”', `${view.npc?.observedLabel ?? '对方'}没有给出足以确认身份的信息。`);
      case 'observe-inn':
      case 'observe-clinic':
      case 'observe-scene':
        return proposal('observe', undefined, '你留意了片刻，只把眼前的人、出入口和明显物件记在心里，没有凭空得出更多结论。');
      case 'ask-local-news':
        return proposal('ask-information', '“这里的事，与外乡人知道得太多没有好处。”');
      case 'leave-conversation':
        return proposal('wait', undefined, '你没有继续搭话，只退到一旁留意动静。');
      default:
        return proposal('wait', undefined, '你没有找到合适的行动时机。');
    }
  },
};
