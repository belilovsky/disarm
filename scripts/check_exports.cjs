/* Execute the actual UI exporters in an isolated DOM fixture, retaining delivered files. */
'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'), output=path.resolve(process.argv[2]); fs.mkdirSync(output,{recursive:true});
async function localeExports(locale) {
 const files=[]; const context={console,Blob,TextEncoder,Date,Intl,Map,Set,Math,URLSearchParams,structuredClone,crypto:require('node:crypto').webcrypto,navigator:{},localStorage:{getItem:()=>null,setItem:()=>{}},location:{pathname:'/',search:'?locale='+locale,origin:'https://disarm.qdev.run'},history:{replaceState:()=>{}},requestAnimationFrame:()=>{},setTimeout:()=>{},alert:message=>{throw Error(message)}};
 context.URL={createObjectURL:blob=>{files.push({blob});return 'blob:isolated-export'},revokeObjectURL:()=>{}};
 context.window={setTimeout:()=>{},addEventListener:()=>{}};
 context.document={addEventListener:()=>{},querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({click:()=>{},set download(value){files.at(-1).name=value;}}),body:{appendChild:()=>{},removeChild:()=>{}}};
 vm.createContext(context);
 for(const asset of ['analysis-core.js','data-core.js','ui-locales.js','i18n-runtime.js'])vm.runInContext(fs.readFileSync(path.join(root,'assets',asset),'utf8'),context,{filename:asset});
 let app=fs.readFileSync(path.join(root,'assets/app.js'),'utf8');
 const corpus=JSON.parse(fs.readFileSync(path.join(root,'data/disarm.json'),'utf8'));
 const injection=`\nSTATE.data=DATA.validate(${JSON.stringify(corpus)}); STATE.locale=${JSON.stringify(locale)}; I18N.setLocale(STATE.locale);
 for (const [bucket,type] of Object.entries({phases:'phase',tactics:'tactic',techniques:'technique',counters:'counter',incidents:'incident',metatechniques:'metatechnique',detections:'detection',tasks:'task',tools:'tool'})) for(const obj of STATE.data[bucket])STATE.byId.set(obj.disarm_id,{...obj,_type:type});
 for(const inc of STATE.data.incidents)for(const id of inc.techniques){ if(!STATE.incidentByTech.has(id))STATE.incidentByTech.set(id,[]);STATE.incidentByTech.get(id).push(inc); }
 PLAYBOOK.selected=new Set(DATA.normalizeSelection(['T0001','T0049','T9999','T0001'],STATE.data.techniques).selected);
 if (formatIncidentCount(1) !== ${JSON.stringify({ru:'1 инцидент',kk:'1 оқиға',en:'1 incident'}[locale])}) throw new Error('Export singular incident label');
 if (formatIncidentCount(2) !== ${JSON.stringify({ru:'2 инцидента',kk:'2 оқиға',en:'2 incidents'}[locale])}) throw new Error('Export plural incident label');
 if (playbookCountLabel('techniques',1) !== ${JSON.stringify({ru:'техника в плейбуке',kk:'жоспардағы техника',en:'technique in playbook'}[locale])}) throw new Error('Selected technique singular label');
 if (playbookCountLabel('core',1) !== ${JSON.stringify({ru:'мера в опорном наборе',kk:'негізгі жинақтағы шара',en:'measure in core set'}[locale])}) throw new Error('Core measure singular label');
 exportPlaybook();exportNavigatorJSON();exportStixBundle();\n`;
 app=app.replace(/\}\)\(\);\s*$/,injection+'})();');vm.runInContext(app,context,{filename:'app.js'});
 assert.equal(files.length,3);
 const written=[];
 for(const file of files){const text=await file.blob.text();const target=path.join(output,locale+'-'+file.name);fs.writeFileSync(target,text);written.push(target);
  assert.ok(text.includes('CC-BY-SA-4.0')&&text.includes('DISARMFoundation/DISARMframeworks-17'));assert.ok(!text.includes('T9999'));
  if(file.name.includes('navigator')){const layer=JSON.parse(text);assert.equal(layer.domain,'disarm-1.7-sqlite'); const domain=JSON.parse(decodeURIComponent(layer.customDataURL.split(',').slice(1).join(','))); assert.equal(domain.objects.filter(o=>o.type==='attack-pattern').length,71); for(const id of ['T0001','T0049'])assert.ok(domain.objects.some(o=>o.external_references?.[0]?.external_id===id));assert.equal(layer.versions.layer,'4.4');assert.deepEqual(layer.techniques.map(t=>t.techniqueID),['T0001','T0049']);assert.equal(layer.techniques.find(t=>t.techniqueID==='T0049').comment,'Flooding · '+{ru:'2 инцидента',kk:'2 оқиға',en:'2 incidents'}[locale]);}
  if(file.name.includes('stix')){const bundle=JSON.parse(text),ids=new Set(bundle.objects.map(o=>o.id));assert.equal(ids.size,bundle.objects.length);for(const o of bundle.objects){for(const prop of ['source_ref','target_ref','created_by_ref'])if(o[prop])assert.ok(ids.has(o[prop]));for(const ref of o.object_marking_refs||[])assert.ok(ids.has(ref));}assert.deepEqual(bundle.objects.filter(o=>o.type==='attack-pattern').map(o=>o.external_references[0].external_id),['T0001','T0049']);}
 }
 return {locale,files:written};
}
(async()=>{const receipt=[];for(const locale of ['ru','kk','en'])receipt.push(await localeExports(locale));fs.writeFileSync(path.join(output,'exports-receipt.json'),JSON.stringify({schema_version:'disarm-export-contract-v2',selected_ids:['T0001','T0049'],channels:receipt,structural:'passed',stix_profile:'pending',navigator_import:'pending'},null,2)+'\n');console.log('EXPORT_STRUCTURES_OK: 9 artifacts, normalized selection, source attribution, licence, object references');})().catch(error=>{console.error(error);process.exit(1)});
