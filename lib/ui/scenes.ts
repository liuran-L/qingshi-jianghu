import type { GameState, DialogueLine } from '../game/types.ts';
import { getLocation } from '../game/world.ts';
import { assetPath } from './asset-path.ts';
export function sceneFor(s: GameState, line?: DialogueLine) {
 if (s.campaign.finale) return {id:'saltstore',name:'盐仓内外',description:'河风穿过仓门。留下的纸与人，都要在今夜有个去处。',src:assetPath('scenes/saltstore.svg')};
 if (!s.campaign.startedAt && line && s.dialogue.indexOf(line)>=0 && s.dialogue.indexOf(line)<2 && line.kind==='narration') return {id:'road',name:'青石县外 · 荒道',description:'雨水漫过车辙，城楼在暮色里露出一点轮廓。',src:assetPath('scenes/road.svg')};
 const place=getLocation(s.locationId);
 return {id:place.id,name:place.name,description:place.description,src:assetPath(`scenes/${place.id}.svg`)};
}
