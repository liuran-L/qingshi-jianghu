/* eslint-disable @typescript-eslint/no-explicit-any -- 只遍历测试容器生成的 React 元素树并调用真实界面回调。 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { uiModule } from './helpers/ui-module.ts';
import { artGraph } from '../lib/ui/art-graph.ts';
import { knowledgeGroups, knowledgeScope } from '../lib/ui/knowledge.ts';
import { createInitialGame } from '../lib/game/engine.ts';
import { artNodes } from '../lib/game/arts-content.ts';
import { getAvailableActions } from '../lib/game/limited-actions.ts';
import { beginning, click } from './helpers/campaign.ts';
import { encodeSave, decodeSave } from '../lib/game/storage.ts';
import { returnToTitle } from '../lib/game/session.ts';
import { worldEvents } from '../lib/game/world.ts';

void test('UI01 功法真实分支、四种状态、阅读锁与旧档投影', async()=>{
 let s=await beginning();s=await click(s,'journey-care');s=await click(s,'journey-wait');s=await click(s,'journey-attend:temple');s=await click(s,'journey-choose:temple:medicine');s=await click(s,'journey-teach:medicine');
 const before=encodeSave(s), old=JSON.parse(before);delete old.arts;delete old.battles;
 const loaded=decodeSave(JSON.stringify(old));assert.ok(loaded);
 const graph=artGraph(loaded,'medicine',getAvailableActions(loaded,null));
 assert.equal(graph.nodes[0].state,'available');assert.equal(graph.nodes[1].state,'locked');
 assert.deepEqual(graph.edges.map(e=>[e.from.id,e.to.id]),artNodes.filter(n=>n.tree==='medicine'&&n.prerequisite).map(n=>[n.prerequisite,n.id]));
 assert.equal(artGraph(loaded,'medicine',getAvailableActions(loaded,null),false).nodes[0].state,'blocked');
 assert.equal(artGraph(loaded,'medicine',[]).nodes[0].state,'blocked');
 s=await click(s,'journey-node:medicine-diagnosis');
 const learned=artGraph(s,'medicine',getAvailableActions(s,null));assert.equal(learned.nodes[0].state,'learned');assert.equal(learned.nodes[1].state,'blocked');
 for(const a of learned.nodes) for(const b of learned.nodes) if(a.id!==b.id) assert.ok(Math.abs(a.x-b.x)>=234||Math.abs(a.y-b.y)>=204,'节点不得重叠');
 assert.deepEqual(JSON.parse(encodeSave(loaded)),JSON.parse(before));
 for(const mutate of [(v:typeof s)=>{v.growth.medicine.availablePoints=1;},(v:typeof s)=>{v.growth.medicine.nodes=['medicine-bandage'];},(v:typeof s)=>{v.growth.medicine.nodes=['illegal' as never];}]) {const bad=structuredClone(s);mutate(bad);assert.equal(decodeSave(encodeSave(bad)),null);}
});

void test('UI02 见闻札记七分类仅投影已知条目，更新/场景/同档重读隔离展开状态',()=>{
 const s=createInitialGame('旅人'), before=encodeSave(s), groups=knowledgeGroups(s);
 assert.deepEqual(groups.map(g=>g.title),['见闻札记 · 亲见与取得','见闻札记 · 他人说法','见闻札记 · 待解疑问','随身物','地点','人物','世界事件']);
 for(const e of worldEvents) assert.ok(!JSON.stringify(groups).includes(e.hiddenSummary));
 assert.ok(!groups[5].entries.some(e=>e.id==='yue-hansheng'));
 const scope=knowledgeScope(s,0);assert.notEqual(scope,knowledgeScope(s,1));
 assert.notEqual(scope,knowledgeScope({...s,locationId:'inn'},0));
 assert.notEqual(scope,knowledgeScope({...s,playerKnownFactIds:[...s.playerKnownFactIds,'cart-mark']},0));
 assert.equal(encodeSave(s),before);
});

void test('UI03 实际情报组件默认无详情，展开/收起与切分类、ARIA、空状态',()=>{
 const groups=knowledgeGroups(createInitialGame('旅人'));
 const {KnownInformation}=uiModule('app/known-information.tsx');
 const html=renderToStaticMarkup(createElement(KnownInformation,{groups}));
 assert.match(html,/aria-expanded="false"/);assert.ok(!html.includes(groups[0].entries[0].detail));
 // 用轻量 hook 容器触发组件真实回调；不模拟 DOM 布局或浏览器事件分发。
 const slots:unknown[]=[];let index=0;
 const mockReact={...React,useState:(value:unknown)=>{const slot=index++;if(!(slot in slots)) slots[slot]=value;return [slots[slot],(next:unknown)=>{slots[slot]=next;}];}};
 const Component=uiModule('app/known-information.tsx',{react:mockReact}).KnownInformation;
 const render=()=>{index=0;return Component({groups});};
 const collect=(node:any,tag:string):any[]=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(x=>collect(x,tag)):[...(node.type===tag?[node]:[]),...collect(node.props?.children,tag)];
 let tree=render();collect(tree,'button')[0].props.onClick();tree=render();
 assert.equal(collect(tree,'button')[0].props['aria-expanded'],true);assert.ok(renderToStaticMarkup(tree).includes(groups[0].entries[0].detail));
 collect(tree,'button')[0].props.onClick();assert.equal(collect(render(),'button')[0].props['aria-expanded'],false);
 collect(render(),'select')[0].props.onChange({target:{value:'journal-hearsay'}});assert.equal(slots[1],null);assert.match(renderToStaticMarkup(render()),/此分类暂无已知条目/);
});

void test('UI04 返回实际按钮只有取消和确定，分别保留或丢弃内存',()=>{
 const {ReturnJourneyActions}=uiModule('app/return-journey-actions.tsx');
 const original=createInitialGame('旅人');let state:typeof original|null=original,open=true;
 const tree=ReturnJourneyActions({busy:false,onCancel:()=>{open=false;state=returnToTitle(state!,false);},onConfirm:()=>{open=false;state=returnToTitle(state!,true);}});
 const buttons=tree.props.children;
 assert.deepEqual(buttons.map((b:any)=>b.props.children),['取消','确定']);assert.equal(buttons.length,2);
 buttons[0].props.onClick();assert.equal(open,false);assert.equal(state,original);
 open=true;buttons[1].props.onClick();assert.equal(open,false);assert.equal(state,null);
 assert.equal(ReturnJourneyActions({busy:true}).props.children[1].props.disabled,true);
});

void test('UI05 功法组件输出真实连线与键盘节点，聚焦展开说明不修改游戏',()=>{
 const game=createInitialGame('旅人'), before=encodeSave(game);
 const {ArtTreeDiagram}=uiModule('app/art-tree.tsx');
 const props={game,tree:'step',actions:[],ready:true,onLearn:()=>assert.fail('锁定节点不能投入')};
 const html=renderToStaticMarkup(createElement(ArtTreeDiagram,props));
 assert.equal((html.match(/class="art-node /g)??[]).length,4);
 assert.match(html,/前置：基础步法/);assert.match(html,/class="art-lines"/);assert.match(html,/tabindex="0"/);
 let selected:string|null=null;
 const Component=uiModule('app/art-tree.tsx',{react:{...React,useState:()=>[selected,(id:string)=>{selected=id;}]}}).ArtTreeDiagram;
 const collect=(node:any):any[]=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(collect):[...(node.type==='button'?[node]:[]),...collect(node.props?.children)];
 collect(Component(props))[0].props.onFocus();
 const expanded=renderToStaticMarkup(Component(props));
 assert.match(expanded,/获得与成本/);assert.match(expanded,/六小时/);assert.match(expanded,/用法与去处/);assert.match(expanded,/aria-expanded="true"/);
 assert.equal(encodeSave(game),before);
});


