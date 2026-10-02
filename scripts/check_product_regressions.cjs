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
 DisarmI18n.setLocale('ru');
 assert.equal(DisarmI18n.text('71 техник · 140 контрмер'), '71 техника · 140 контрмер');
 assert.equal(DisarmI18n.text('2 инцидентов; 1 техник'), '2 инцидента; 1 техника');
 const markup=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.equal((markup.match(/class="matrix-wrap" tabindex="0" role="region"/g)||[]).length,2);
 assert.ok(!fs.readFileSync(path.join(root,'assets/avds-disarm-adapter.css'),'utf8').includes('.search-type-chip input { display: none; }'));
 console.log('PRODUCT_REGRESSIONS_OK: corpus identity, cache rejection, references, normalized IDs, RU/KK/EN authored catalog');
})().catch(error=>{console.error(error);process.exit(1)});
