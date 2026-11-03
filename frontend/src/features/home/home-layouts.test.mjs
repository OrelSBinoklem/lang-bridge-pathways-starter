import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require=createRequire(import.meta.url), React=require('react');
const {renderToStaticMarkup}=require('react-dom/server'), {load:html}=require('cheerio');
const directory=path.dirname(fileURLToPath(import.meta.url)), cache=new Map();
const root=path.resolve(directory,'../..');
function load(file) {
  file=['.tsx','.ts',''].map(ext=>file+ext).find(existsSync);
  if(!file)throw Error('Missing component');
  if(cache.has(file))return cache.get(file);
  const exports={};cache.set(file,exports);
  const source=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function('require','exports',source)(name=>{
    if(name.endsWith('.css'))return {__esModule:true,default:new Proxy({}, {get:(_t,k)=>String(k)})};
    if(name==='next/link')return {__esModule:true,default:({prefetch:_,...props})=>React.createElement('a',props)};
    if(name==='next/dynamic')return {__esModule:true,default:()=>()=>null};
    if(name==='next-intl')return {useTranslations:()=>key=>({soundYes:'Озвучка есть',empty:'Пусто',grammarBtn:'Обзорная грамматика',conceptsBtn:'Понятия'}[key]??key)};
    if(name==='@/lib/api')return {ApiError:class ApiError extends Error {}};
    if(name.startsWith('@/'))return load(path.join(root,name.slice(2)));
    if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name));
    return require(name);
  },exports);
  return exports;
}
const {EnglishHomeLayout}=load(path.join(directory,'layouts/EnglishHomeLayout'));
const {LatvianHomeLayout}=load(path.join(directory,'layouts/LatvianHomeLayout'));
const dictionary=(id,name)=>({id,name,words:123,level:1,max_level:4,sound:true,lang:'ru',learn_lang:'en'});
const content={loading:false,courseLevels:[],courseError:null,uk:false,onOpenIntro:()=>{}};

test('English layout preserves every real dictionary and routes grammar, practice and exams to English',()=>{
  const dictionaries=[dictionary(31,'Тематический'),dictionary(32,'Расширенный'),dictionary(38,'По уровням и темам'),dictionary(39,'Дополнительный')];
  const $=html(renderToStaticMarkup(React.createElement(EnglishHomeLayout,{...content,dictionaries})));
  assert.equal($('[data-home-layout="en"]').length,1);
  assert.deepEqual($('[data-dictionary-id]').map((_i,el)=>Number($(el).attr('data-dictionary-id'))).get(),[31,32,38,39]);
  for(const url of ['/grammar/english','/grammar/practice?learn_lang=en','/exams?learn_lang=en'])assert($(`a[href="${url}"]`).length);
  for(const url of ['/grammar','/grammar/practice','/exams','/course'])assert.equal($(`a[href="${url}"]`).length,0);
  assert.equal($('[data-home-module="course"]').length,1);
  assert.equal($('[data-home-course-cards] > a').length,4);
  for(const id of ['A1','A2','B1','B2'])assert.equal($(`a[href="/course/english?level=${id}"]`).length,1);
  assert.equal($('[data-home-useful-links] li').length,7);
  assert(!$('[data-home-course-cards]').text().includes('LATVIEŠU'));
  assert.equal($('[data-home-module="intro"] button').length,2);
  assert(!$('[data-home-layout="en"]').text().includes('LANGBRIDGE / LV'));
});

test('English course cards display their real progress and retain language-specific destinations',()=>{
  const courseLevels=[{id:'B1',completed:9,total:10,status:'active',perfect:false}];
  const $=html(renderToStaticMarkup(React.createElement(EnglishHomeLayout,{...content,dictionaries:[],courseLevels})));
  const card=$('a[href="/course/english?level=B1"]');
  assert.equal(card.find('progress').attr('value'),'90');
  assert.equal(card.attr('data-rank'),'gold');
  assert.equal(card.attr('data-current'),'true');
  assert(card.text().includes('9 / 10'));
  assert($('[data-home-module="course"] a[href="/course/english"]').length);
  assert.equal($('a[href^="/course?"]').length,0);
});

test('English useful links have localized labels, safe external navigation and two emphasis levels',()=>{
  const {USEFUL_LINKS}=load(path.join(directory,'useful-links'));
  const links=USEFUL_LINKS.en;
  assert.equal(links.length,new Set(links.map(link=>link.href)).size);
  assert(links.some(link=>link.highlighted) && links.some(link=>!link.highlighted));
  for(const locale of ['ru','uk']) {
    const messages=JSON.parse(readFileSync(path.resolve(directory,`../../../messages/${locale}.json`),'utf8')).Home;
    for(const link of links){
      assert.equal(new URL(link.href).protocol,'https:');
      assert.equal(link.external,true);
      assert(messages[link.labelKey]?.length>10,`${locale}: ${link.labelKey}`);
    }
  }
});

test('English home uses the Latvian module arrangement with its own language routes',()=>{
  const components={en:EnglishHomeLayout,lv:LatvianHomeLayout};
  const layouts=Object.fromEntries(Object.entries(components).map(([language,Component])=>{
    const $=html(renderToStaticMarkup(React.createElement(Component,{...content,dictionaries:[dictionary(38,'Тематический')]})));
    const modules=$('[data-home-learning-hub] [data-home-module]').map((_i,el)=>$(el).attr('data-home-module')).get();
    assert.equal($('[data-home-module="intro"] button').map((_i,el)=>$(el).text()).get().join('|'),'Обзорная грамматика|Понятия');
    return [language,modules];
  }));
  assert.deepEqual(layouts.en,['exams','intro','technical-caption','grammar','dictionaries']);
  assert.deepEqual(layouts.en,layouts.lv);
});

test('English concepts use the shared searchable handbook with EN examples and RU/UK translations',()=>{
  const {englishConceptSections:sections}=load(path.join(directory,'../english-grammar/overview/concepts'));
  const Concepts=load(path.join(directory,'../english-grammar/overview/EnglishConcepts')).default;
  const {searchableText}=load(path.join(directory,'reference/ReferenceReader'));
  assert.equal(new Set(sections.map(section=>section.id)).size,sections.length);
  assert.deepEqual([...new Set(sections.map(section=>section.level))],['A1','A2','B1','B2']);
  for(const locale of ['ru','uk']) {
    const $=html(renderToStaticMarkup(React.createElement(Concepts,{locale})));
    assert.equal($('[data-reference-language="en"]').length,1);
    assert.equal($('[data-reference-section]').length,sections.length);
    assert.equal($('[lang="lv"]').length,0);
    assert($('input[type="search"]').attr('placeholder').includes(locale==='uk'?'англійське':'английское'));
    assert($('a[href*="britishcouncil.org"]').length);
    assert.equal($('a[href*="valoda.lv"]').length,0);
    for(const section of sections) {
      for(const text of [section.title,section.summary,section.remember,...section.paragraphs,...section.examples.map(example=>example.translation)])assert(text[locale]?.trim(),section.id);
      for(const example of section.examples) {
        assert(example.en && !example.lv,section.id);
        assert(searchableText(section,locale).includes(example.en.toLocaleLowerCase()),section.id);
      }
      for(const link of section.tableLinks) {
        const url=new URL(link.href,'https://example.test');
        assert.equal(url.pathname,'/grammar/english');
        assert(url.hash.startsWith('#en-'));
      }
    }
  }
});

test('Latvian composition retains real course progress, its destinations and both introduction modules',()=>{
  const levels=[{id:'A1',completed:10,total:12,status:'completed',perfect:false}];
  const $=html(renderToStaticMarkup(React.createElement(LatvianHomeLayout,{...content,dictionaries:[dictionary(20,'Авторский'),dictionary(21,'Дополнительно')],courseLevels:levels})));
  assert.equal($('[data-home-layout="lv"]').length,1);
  assert.equal($('[data-home-course-cards] > a').length,4);
  assert.equal($('[data-home-course-cards] progress').first().attr('value'),'83');
  assert.equal($('[data-mastery-tier="silver"]').length,1);
  for(const url of ['/grammar','/grammar/practice','/exams'])assert($(`a[href="${url}"]`).length);
  assert.equal($('[data-home-module="intro"] button').length,2);
  assert.equal($('a[href="/exams?learn_lang=en"]').length,0);
});

test('unknown course progress does not display earned awards or invented completion',()=>{
  const $=html(renderToStaticMarkup(React.createElement(LatvianHomeLayout,{...content,dictionaries:[]})));
  assert.equal($('[data-mastery-tier]').length,0);
  assert.equal($('progress').length,0);
  assert($('[data-home-course-cards]').text().includes('Нет данных'));
});
