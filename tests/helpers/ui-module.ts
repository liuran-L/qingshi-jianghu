/* eslint-disable @typescript-eslint/no-explicit-any -- 编译后组件的运行时导出边界，业务模块仍严格类型检查。 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import ts from 'typescript';
import { compileFunction } from 'node:vm';

/** 使用项目已有 TypeScript 编译器装载纯界面组件，不启动浏览器或服务。 */
export function uiModule(file:string, overrides: Record<string, unknown> = {}) {
 const filename=resolve(file), require=createRequire(filename);
 const code=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 const compiled={exports:{} as Record<string, (...args: any[])=>any>};
 const load=(name:string)=>name in overrides?overrides[name]:require(name.startsWith('.')?`${name}.ts`:name);
 compileFunction(code,['require','module','exports'])(load,compiled,compiled.exports);
 return compiled.exports;
}
