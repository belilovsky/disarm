/* DISARM 1.7 corpus boundary. Network and cache use exactly the same validation. */
(function (root) {
  'use strict';
  const schema = 'disarm-corpus-cache-v2';
  const digest = '474aba30cea415e47ee256143f5f17562406294747d40f6e03bb3898d261c2b2';
  const counts = { phases: 4, tactics: 13, techniques: 71, counters: 140, incidents: 63, metatechniques: 14, detections: 95, tasks: 42, tools: 151, examples: 43 };
  function validate(data) {
    const require = (ok, message) => { if (!ok) throw new Error(message); };
    require(data && typeof data === 'object', 'Invalid corpus');
    require(data.version === 'DISARM 1.7.0 (official SQLite, verified 2026-09-30)', 'Incompatible DISARM version');
    require(data.source === 'https://github.com/DISARMFoundation/DISARMframeworks-17' && data.license === 'CC-BY-SA-4.0', 'Invalid corpus provenance');
    const ids = new Map();
    for (const [bucket, count] of Object.entries(counts)) {
      require(Array.isArray(data[bucket]) && data[bucket].length === count, `Invalid ${bucket}`);
      for (const item of data[bucket]) {
        require(item && typeof item.disarm_id === 'string' && typeof item.name === 'string', `Invalid ${bucket} record`);
        require(!ids.has(item.disarm_id), `Duplicate ${item.disarm_id}`);
        ids.set(item.disarm_id, bucket);
      }
    }
    const ref = (id, bucket) => require(ids.get(id) === bucket, `Invalid ${bucket} reference: ${id}`);
    const links = { techniques: 'techniques', counters: 'counters', incidents: 'incidents', detections: 'detections' };
    for (const bucket of Object.keys(counts)) for (const item of data[bucket]) {
      if (item.phase_id) ref(item.phase_id, 'phases');
      if (item.tactic_id === 'ALL') require(bucket === 'detections' && item.disarm_id === 'F00070', 'Invalid tactic wildcard');
      else if (item.tactic_id) ref(item.tactic_id, 'tactics');
      if (item.metatechnique_id) ref(item.metatechnique_id, 'metatechniques');
      for (const [key, target] of Object.entries(links)) if (key in item) {
        require(Array.isArray(item[key]), `Invalid ${item.disarm_id}.${key}`);
        item[key].forEach(id => ref(id, target));
      }
      if (bucket === 'examples') require(ids.has(item.object_id), `Invalid example ${item.disarm_id}`);
    }
    for (const [key, parent, child] of [['phase_to_tactics', 'phases', 'tactics'], ['tactic_to_techniques', 'tactics', 'techniques'], ['tactic_to_counters', 'tactics', 'counters']]) {
      require(data[key] && typeof data[key] === 'object' && !Array.isArray(data[key]), `Invalid ${key}`);
      for (const [id, values] of Object.entries(data[key])) {
        ref(id, parent);
        require(Array.isArray(values) && new Set(values).size === values.length, `Invalid ${key}.${id}`);
        values.forEach(value => ref(value, child));
      }
    }
    return data;
  }
  async function validateText(text) {
    const bytes = new TextEncoder().encode(text);
    const actual = Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
    if (actual !== digest) throw new Error('Corpus digest mismatch');
    return validate(JSON.parse(text));
  }
  async function readCache(value) {
    const cache = JSON.parse(value || 'null');
    if (!cache || cache.schema !== schema || cache.digest !== digest || !Number.isFinite(Date.parse(cache.savedAt)) || typeof cache.text !== 'string') return null;
    return { data: await validateText(cache.text), savedAt: cache.savedAt };
  }
  function normalizeSelection(values, techniques) {
    const allowed = new Set(techniques.map(item => item.disarm_id));
    const selected = [], rejected = [];
    for (const value of values || []) {
      const id = typeof value === 'string' ? value.trim() : '';
      if (allowed.has(id)) { if (!selected.includes(id)) selected.push(id); }
      else if (id && !rejected.includes(id)) rejected.push(id);
    }
    return { selected, rejected };
  }
  function navigatorBundle(data) {
    validate(data);
    // Stable local STIX identifiers; official DISARM identifiers remain external_id.
    const id = (type, index) => type+'--68d792ce-57f1-4af9-80a7-'+String(index).padStart(12,'0');
    const now = '2026-09-30T00:00:00.000Z';
    const source = {source_name:'DISARM',url:'https://raw.githubusercontent.com/DISARMFoundation/DISARMframeworks-17/216a8828c7d0f6a67ad2a8867c716bf961914776/generated_files/DISARM_database.sqlite',hashes:{'SHA-256':'753eef8df1ce9678c41e16f7f45ccc59fce095c7be00f81f832be689bf43ad38'}};
    const marking = id('marking-definition',1);
    const common = {spec_version:'2.1',created:now,modified:now,object_marking_refs:[marking]};
    const tactics = data.tactics.map((t,i)=>({...common,type:'x-mitre-tactic',id:id('x-mitre-tactic',i+1),name:t.name,description:t.summary||'',x_mitre_shortname:t.disarm_id.toLowerCase(),external_references:[{...source,external_id:t.disarm_id}]}));
    const techniques = data.techniques.map((t,i)=>({...common,type:'attack-pattern',id:id('attack-pattern',i+1),name:t.name,description:t.summary||'',x_mitre_platforms:['DISARM'],external_references:[{...source,external_id:t.disarm_id}],kill_chain_phases:[{kill_chain_name:'disarm',phase_name:t.tactic_id.toLowerCase()}]}));
    return {type:'bundle',id:id('bundle',1),objects:[{type:'marking-definition',spec_version:'2.1',id:marking,created:now,definition_type:'statement',definition:{statement:'DISARM Foundation: CC-BY-SA-4.0. SQLite 1.7 projection for Navigator; source revision 216a8828c7d0f6a67ad2a8867c716bf961914776. https://www.disarm.foundation/terms-of-service https://creativecommons.org/licenses/by-sa/4.0/'}},...tactics,...techniques,{...common,type:'x-mitre-matrix',id:id('x-mitre-matrix',1),name:'DISARM 1.7.0 — official SQLite projection',description:'Source-bound adaptation of the official SQLite corpus.',external_references:[{...source,external_id:'DISARM-1.7-SQLite'}],tactic_refs:tactics.map(t=>t.id)}]};
  }
  const api = { schema, digest, validate, validateText, readCache, normalizeSelection, navigatorBundle };
  root.DisarmData = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
