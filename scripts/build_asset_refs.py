#!/usr/bin/env python3
"""Bind public asset URLs and the AVDS connected-file ledger to exact bytes."""
from pathlib import Path
import hashlib, json, re
ROOT=Path(__file__).resolve().parents[1]
def digest(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
for filename in ['index.html','login.html']:
 p=ROOT/filename;s=p.read_text()
 for asset in ['assets/app.js','assets/ui-locales.js','assets/disarm-login.js','assets/i18n-runtime.js','assets/data-core.js']:
  s=re.sub(re.escape(asset)+r'\?[^" ]+',asset+'?v=1.7.0&sha='+digest(asset)[:12],s)
 s=re.sub(r'assets/avds-disarm-adapter.css\?[^" ]+','assets/avds-disarm-adapter.css?v=1.4.0&sha='+digest('assets/avds-disarm-adapter.css')[:12],s);p.write_text(s)
p=ROOT/'data/avds-adapter.json';d=json.loads(p.read_text());d['asset']='/assets/avds-disarm-adapter.css?v=1.4.0&sha='+digest('assets/avds-disarm-adapter.css')[:12];p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
p=ROOT/'data/avds-system-contract.json';d=json.loads(p.read_text())
for item in d['connected_files']:
 if 'path' in item and (ROOT/item['path']).is_file():item['sha256']=digest(item['path'])
for asset in ['assets/data-core.js','assets/i18n-runtime.js','assets/ui-locales.js','data/ui-locales.json','login.html','assets/disarm-login.js','assets/disarm-login.css']:
 if not any(x.get('path')==asset for x in d['connected_files']):d['connected_files'].append({'path':asset,'sha256':digest(asset)})
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('ASSET_REFERENCES_BUILT')
