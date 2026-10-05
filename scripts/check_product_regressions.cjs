/* Required publication regressions for corpus, cache, selection and authored locales. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path'), root = path.resolve(__dirname,'..');
if (!globalThis.crypto) globalThis.crypto = require('node:crypto').webcrypto;
const data = require('../assets/data-core.js');
require('../assets/ui-locales.js'); require('../assets/i18n-runtime.js');
(async()=>{
 const text=fs.readFileSync(require('node:path').join(__dirname,'../data/disarm.json'),'utf8');
 const corpus=await data.validateText(text);
 const envelope={schema:data.schema,digest:data.digest,savedAt:new Date().toISOString(),text};
 assert.deepEqual((await data.readCache(JSON.stringify(envelope))).data,corpus);
 assert.equal(await data.readCache(JSON.stringify({...envelope,schema:'old'})),null);
 assert.equal(await data.readCache(JSON.stringify({...envelope,digest:'old'})),null);
 await assert.rejects(data.readCache(JSON.stringify({...envelope,text:text+' '})));
 await assert.rejects(data.validateText('{}'));
 for (const mutate of [d=>d.techniques.pop(),d=>d.techniques[1].disarm_id=d.techniques[0].disarm_id,d=>d.techniques[0].tactic_id='TA99',d=>d.incidents[0].techniques=['T9999']]) {
  const altered=structuredClone(corpus);mutate(altered);assert.throws(()=>data.validate(altered));
 }
 assert.deepEqual(data.normalizeSelection(['T0001',' T0001 ','T9999','C00008','T0002'],corpus.techniques),{selected:['T0001','T0002'],rejected:['T9999','C00008']});
 for (const locale of ['en','kk']) {
  DisarmI18n.setLocale(locale);
  for(const [key,values] of Object.entries(DisarmLocaleCatalog)) assert.equal(DisarmI18n.text(key),values[locale],key);
  assert.equal(DisarmI18n.text('наблюдение, гипотеза, источник…'), locale === 'en' ? 'observation, hypothesis, source…' : 'бақылау, болжам, дереккөз…');
  assert.ok(!DisarmI18n.text('Только 2017 год').includes('Только'));
  assert.ok(!DisarmI18n.text('страна Armenia').includes('страна'));
  assert.equal(DisarmI18n.text('неизвестная фраза год'),'неизвестная фраза год');
  assert.equal(DisarmI18n.text('Create fake Social Media Profiles / Pages / Groups'),'Create fake Social Media Profiles / Pages / Groups');
  assert.ok(!DisarmI18n.text('Найдено: 3 · показано: 2 · фильтров: 7').includes('Найдено'));
 }
 for(const locale of ['en','kk']) {
  DisarmI18n.setLocale(locale);
  if(locale==='en') assert.equal(DisarmI18n.text('1 контр.'),'1 counter');
  assert.equal(DisarmI18n.text('1 контрмера'),locale==='en'?'1 countermeasure':'1 қарсы шара');
  assert.equal(DisarmI18n.text('2 контрмеры'),locale==='en'?'2 countermeasures':'2 қарсы шара');
 }
 DisarmI18n.setLocale('kk');
 assert.equal(DisarmI18n.reportDate(new Date(2026,9,6)), '2026 ж. 6 қазан');
 assert.equal(DisarmI18n.reportDate(new Date(2026,0,1)), '2026 ж. 1 қаңтар');
 DisarmI18n.setLocale('ru');
 assert.equal(DisarmI18n.text('71 техник · 140 контрмер'), '71 техника · 140 контрмер');
 assert.equal(DisarmI18n.text('2 инцидентов; 1 техник'), '2 инцидента; 1 техника');
 const markup=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.equal((markup.match(/class="matrix-wrap" tabindex="0" role="region"/g)||[]).length,2);
 assert.ok(!fs.readFileSync(path.join(root,'assets/avds-disarm-adapter.css'),'utf8').includes('.search-type-chip input { display: none; }'));
 const app=fs.readFileSync(path.join(root,'assets/app.js'),'utf8');
 for(const disclosure of ['masthead-intro','workspace-settings','incident-analytics']) assert.ok(markup.includes('id="'+disclosure+'"'),disclosure);
 assert.ok(markup.includes('class="pb-export-formats"'));
 assert.ok(app.includes("quick.hidden = name === 'search'"));
 assert.ok(app.includes('searchTarget?.focus()') && app.includes('searchTarget?.select()'));
 assert.ok(app.includes('<button type="button" class="matrix-col-head"'));
 assert.ok(app.includes("head.setAttribute('aria-expanded'"));
 assert.ok(app.includes("$('#red-filter').oninput = renderRedMatrix") && app.includes("$('#blue-filter').oninput = renderBlueMatrix"));
 for(const name of ['Red','Blue']) {
  const start=app.indexOf('function render'+name+'Matrix()');
  const end=app.indexOf('/* ----',start+1);
  assert.equal((app.slice(start,end).match(/const restoreFocus = document.activeElement === btn/g)||[]).length,1);
 }
 assert.ok(app.includes('MATRIX_COLLAPSED.red') && app.includes('MATRIX_COLLAPSED.blue'));
 assert.ok(app.includes('role="button" tabindex="0" aria-haspopup="dialog"'));
 assert.ok(app.includes("e.key === 'Enter' || e.key === ' '"));
 assert.ok(app.includes('aria-pressed="${Boolean(INCIDENT_FILTERS.country && countryFilterIncludes(c))}"'));
 for(const id of ['workspace-search','global-search','red-filter','blue-filter','incident-filter','pb-tech-filter']) {
  const input=markup.match(new RegExp('<input[^>]*id="'+id+'"[^>]*>'));
  assert.ok(input && input[0].includes('aria-label='),id);
 }
 for(const label of ['Настройки отображения','О фреймворке DISARM','Другие форматы','Описание','Сравнения по корпусу']) {
  assert.ok(DisarmLocaleCatalog[label]?.kk && DisarmLocaleCatalog[label]?.en,label);
 }
 console.log('PRODUCT_REGRESSIONS_OK: corpus identity, cache rejection, references, normalized IDs, RU/KK/EN authored catalog');
})().catch(error=>{console.error(error);process.exit(1)});
