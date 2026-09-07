/* eslint-disable @typescript-eslint/no-explicit-any -- 与既有 UI 容器一致，遍历编译后的元素回调。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import {uiModule} from './helpers/ui-module.ts';
import {navigationPath,currentRoute} from '../lib/ui/desktop-route.ts';
void test('V04 资源失败显示文字占位，下一角色资源重建且不残留错误',()=>{
 let failed=false;
 const {ReliableImage}=uiModule('app/reliable-image.tsx',{react:{...React,useState:()=>[failed,(v:boolean)=>{failed=v;}]}});
 const wrapper=ReliableImage({src:'/portraits/ma-sandao.svg',alt:'差役的水墨立绘'});
 let element=wrapper.type(wrapper.props);assert.equal(element.type,'img');element.props.onError();
 element=wrapper.type(wrapper.props);assert.equal(element.type,'span');assert.match(element.props.children[0],/差役/);
 const next=ReliableImage({src:'/portraits/su-wantang.svg',alt:'掌柜的水墨立绘'});assert.notEqual(next.key,wrapper.key);
 failed=false;assert.equal(next.type(next.props).type,'img');
 assert.equal(ReliableImage({alt:'未知人物'}).type({alt:'未知人物'}).type,'span');
});
void test('V05 地图和返回在项目子路径内导航，根站桌面路径保持兼容',()=>{
 assert.equal(navigationPath('/map','/qingshi-jianghu/'),'/qingshi-jianghu/#/map');
 assert.equal(navigationPath('/','/qingshi-jianghu/'),'/qingshi-jianghu/#/');
 assert.equal(navigationPath('/map','/'),'/map');
 assert.equal(currentRoute('/qingshi-jianghu/','#/map'),'/map');
});
