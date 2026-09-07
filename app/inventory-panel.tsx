import type { GameState } from '../lib/game/types';
import type { LimitedAction } from '../lib/game/limited-actions';
import { inventoryView } from '../lib/ui/inventory';
import { Button } from '../components/ui/button';
export function InventoryPanel({game,actions,onUse,ready}:{game:GameState;actions:LimitedAction[];onUse:(a:LimitedAction)=>void;ready:boolean}) {
 const items=inventoryView(game,actions);
 return <div className="space-y-4">{items.length?items.map(item=><section key={item.id} className="border-b border-ink/20 pb-3"><h3 className="font-serif text-lg">{item.name}</h3><p className="text-sm">{item.detail}</p><details className="mt-2 text-sm leading-7"><summary>来源与用途</summary><p>{item.source}</p><p>{item.where}</p><p>{item.status}</p></details>{item.actions.map(a=><Button key={a.id} disabled={!ready} className="mt-2 h-auto whitespace-normal" onClick={()=>onUse(a)}>{a.label}</Button>)}</section>):<p>行囊里暂无可查看的纸物。已交出的证物不会自行回来；记住的线索仍可在已知情报中查看。</p>}</div>;
}
