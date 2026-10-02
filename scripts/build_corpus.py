#!/usr/bin/env python3
"""Rebuild the published 1.7 projection from the pinned, read-only SQLite artifact."""
import argparse, hashlib, json, sqlite3, tempfile, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SHA='753eef8df1ce9678c41e16f7f45ccc59fce095c7be00f81f832be689bf43ad38'
EXCLUDED={('C00010','T0005'),('C00036','T0005')}
DETECTION_EXCLUSIONS={('F00059', 'All'), ('F00045', 'All'), ('F00061', 'All'), ('F00043', 'T00030'), ('F00041', 'T00029'), ('F00044', 'All'), ('F00078', 'All'), ('F00007', 'All'), ('F00032', 'DUPLICATE'), ('F00001', 'All'), ('F00042', 'T00029'), ('F00005', 'All'), ('F00052', 'All')}
SOURCE_URL='https://raw.githubusercontent.com/DISARMFoundation/DISARMframeworks-17/216a8828c7d0f6a67ad2a8867c716bf961914776/generated_files/DISARM_database.sqlite'
def build(path):
 if hashlib.sha256(path.read_bytes()).hexdigest()!=SHA: raise ValueError('SQLite SHA-256 mismatch')
 db=sqlite3.connect(f'file:{path.resolve()}?mode=ro',uri=True);db.row_factory=sqlite3.Row
 rows=lambda table:[dict(row) for row in db.execute(f'SELECT * FROM {table} ORDER BY id')]
 d={'version':'DISARM 1.7.0 (official SQLite, verified 2026-09-30)','source':'https://github.com/DISARMFoundation/DISARMframeworks-17','license':'CC-BY-SA-4.0'}
 for bucket,table in [('phases','phase'),('tactics','tactic'),('techniques','technique'),('counters','counter'),('incidents','incident'),('metatechniques','metatechnique'),('detections','detection'),('tasks','task'),('tools','tool'),('examples','example')]:d[bucket]=rows(table)
 techs={x['disarm_id']:x for x in d['techniques']};counters={x['disarm_id']:x for x in d['counters']};incidents={x['disarm_id']:x for x in d['incidents']}
 for t in techs.values():t.update(counters=[],incidents=[],detections=[])
 for c in counters.values():c['techniques']=[]
 for i in incidents.values():i['techniques']=[]
 excluded=set()
 for r in rows('counter_technique'):
  pair=(r['counter_id'],r['technique_id'])
  if pair in EXCLUDED:excluded.add(pair);continue
  counters[pair[0]]['techniques'].append(pair[1]);techs[pair[1]]['counters'].append(pair[0])
 assert excluded==EXCLUDED,'Pinned source exclusions changed'
 for r in rows('incident_technique'):
  incidents[r['incident_id']]['techniques'].append(r['technique_id']);techs[r['technique_id']]['incidents'].append(r['incident_id'])
 detection_excluded=set()
 for r in rows('detection_technique'):
  # Upstream All is a wildcard, not a technique ID. It is not expanded in the current projection.
  pair=(r['detection_id'],r['technique_id'])
  if pair in DETECTION_EXCLUSIONS:detection_excluded.add(pair);continue
  techs[r['technique_id']]['detections'].append(r['detection_id'])
 assert detection_excluded==DETECTION_EXCLUSIONS,'Pinned detection exclusions changed'
 for bucket in ['techniques','counters','incidents']:
  for x in d[bucket]:
   for key in ['counters','incidents','detections','techniques']:
    if key in x:x[key]=sorted(set(x[key]))
 d['phase_to_tactics']={p['disarm_id']:[t['disarm_id'] for t in d['tactics'] if t['phase_id']==p['disarm_id']] for p in d['phases']}
 d['tactic_to_techniques']={t['disarm_id']:[x['disarm_id'] for x in d['techniques'] if x['tactic_id']==t['disarm_id']] for t in d['tactics']}
 # Preserve the existing earliest/main-tactic projection, not all possible counter-tactic links.
 d['tactic_to_counters']={}
 for c in d['counters']:d['tactic_to_counters'].setdefault(c['tactic_id'],[]).append(c['disarm_id'])
 d['license_status']='resolved_by_current_foundation_terms'
 d['license_sources']=[{'document':'README.md','license':'CC-BY-4.0','url':'https://github.com/DISARMFoundation/DISARMframeworks-17/blob/v1.7.0/README.md'}]
 d['license_sources'].extend([{'document':'LICENSE.md','license':'CC-BY-SA-4.0','url':'https://github.com/DISARMFoundation/DISARMframeworks-17/blob/v1.7.0/LICENSE.md'},{'document':'Foundation Terms of Service','license':'CC-BY-SA-4.0','url':'https://www.disarm.foundation/terms-of-service'}])
 db.close();return d
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--sqlite',type=Path);p.add_argument('--output',type=Path,default=ROOT/'data/disarm.json');p.add_argument('--check',action='store_true');a=p.parse_args()
 if a.sqlite is None:
  a.sqlite=Path(tempfile.gettempdir())/('disarm-source-'+SHA+'.sqlite')
  if not a.sqlite.exists():
   temp=a.sqlite.with_suffix('.download');urllib.request.urlretrieve(SOURCE_URL,temp)
   assert hashlib.sha256(temp.read_bytes()).hexdigest()==SHA,'Downloaded SQLite SHA-256 mismatch'
   temp.replace(a.sqlite)
 d=build(a.sqlite)
 if a.check:
  actual=json.loads(a.output.read_text());assert actual==d,'Corpus differs from reproducible SQLite projection'
 else:a.output.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
 print('CORPUS_REPRODUCIBLE_OK: pinned SQLite; exactly two T0005 links excluded; 13 exact upstream detection exceptions preserved')
