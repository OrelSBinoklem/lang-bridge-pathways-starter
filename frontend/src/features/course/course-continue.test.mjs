import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('./course-continue.module.css',import.meta.url),'utf8');
const bar=css.match(/\.bar \{([^}]+)\}/)?.[1];
test('continue controls share the content layer above fixed background effects',()=>{
  assert.match(bar,/position: relative;/);
  assert.match(bar,/z-index: 1;/);
  assert.match(bar,/background: var\(--background, #fff\);/);
  assert.doesNotMatch(bar,/position: fixed|position: sticky/);
});
test('button and goal are centred together and still wrap on mobile',()=>{
  assert.match(bar,/justify-content: center;/);
  assert.match(bar,/flex-wrap: wrap;/);
  assert.match(css,/@media \(max-width: 600px\)/);
  assert.match(css,/\.continue \{ width: 100%; \}/);
});
test('effect-only focus still hides the continue controls with the rest of the page',()=>{
  const global=readFileSync(new URL('../../app/globals.css',import.meta.url),'utf8');
  assert.match(global,/html.course-effect-focus body \* \{\s*visibility: hidden !important;/);
  assert.doesNotMatch(global,/course-effect-focus[^\n]*data-course-continue/);
});
test('navigation uses one responsive instance and an out-of-flow desktop goal panel',()=>{
  const source=readFileSync(new URL('./CourseContinue.tsx',import.meta.url),'utf8');
  const shell=readFileSync(new URL('../../components/app-shell.tsx',import.meta.url),'utf8');
  assert.match(source,/matchMedia\('\(max-width: 800px\)'\)/);
  assert.match(source,/createPortal\(content, menuSlot\)/);
  assert.match(source,/data-course-continue-placement=/);
  assert.match(css,/\.popover \{\s*position: absolute;/);
  assert.equal((shell.match(/<CourseContinue\b/g)||[]).length,1);
  assert(shell.indexOf('<CourseContinue')<shell.indexOf('</header>'));
  assert.match(shell,/id="course-continue-menu-root"/);
  assert.match(source,/onNavigate\?\.\(\)/);
});
test('desktop continue and goal toggle form one joined split button',()=>{
  assert.match(css,/\.header \{[^}]*gap: 0;/);
  assert.match(css,/\.header \.continue \{[^}]*border-radius: 0;[^}]*border-right-width: 0;/);
  assert.match(css,/\.header \.helpToggle \{[^}]*border-radius: 6px 0 0 6px;/);
  assert.match(css,/\.targetToggle \{[^}]*border-radius: 0 6px 6px 0;/);
  assert.match(css,/\.targetToggle, \.helpToggle \{[^}]*background: #11765e; color: #fff;/);
});
test('help explains the actual recommendation formula in Russian and Ukrainian',async()=>{
  const {createRequire}=await import('node:module');
  const require=createRequire(import.meta.url),ts=require('typescript');
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{load}=require('cheerio');
  const compiled={exports:{}};
  new Function('require','exports',ts.transpileModule(readFileSync(new URL('./CourseContinueHelp.tsx',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022},
  }).outputText)(require,compiled.exports);
  for(const uk of [false,true])for(const target of [60,80,90,100]){
    const $=load(renderToStaticMarkup(React.createElement(compiled.exports.CourseContinueHelp,{target,uk})));
    const text=$.text();
    assert.equal($('ol li').length,3);
    assert.equal($('details summary').length,1);
    assert(text.includes(`${target}% × 2,5 = ${target*2.5}`));
    assert(text.includes(uk?'середнє арифметичне':'среднее арифметическое'));
    assert(text.includes(uk?'середнє 20%':'среднее 20%'));
    assert(text.includes(uk?'недобір до цілі — 60':'недобор до цели — 60'));
    assert(text.includes(uk?'Ще +0,5':'Ещё +0,5'));
    assert(!text.includes(uk?'а не кількість переходів':'а не число переходов'));
    assert(text.includes(uk?'Ціль визначає ваше навантаження':'Цель определяет нагрузку на вас'));
    assert(!text.includes(uk?'саме сума відсотків':'именно сумма процентов'));
    assert(text.includes(uk?'не менше нуля':'не меньше нуля'));
    assert(text.includes(uk?'не змінює правила заліку':'не меняет правила зачёта'));
  }
});
