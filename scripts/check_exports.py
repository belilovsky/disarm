#!/usr/bin/env python3
"""Required publication proof: actual exporter, structural references and STIX 2.1 profile."""
import argparse, hashlib, json, subprocess
from pathlib import Path
from stix2validator import validate_file, ValidationOptions
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
fingerprint=hashlib.sha256(b''.join((ROOT/path).read_bytes() for path in ['assets/app.js','assets/analysis-core.js','assets/data-core.js','assets/ui-locales.js','assets/i18n-runtime.js','data/disarm.json','scripts/check_exports.cjs','scripts/check_exports.py'])).hexdigest()
receipt_path=a.output/'exports-receipt.json'
if receipt_path.exists():
 receipt=json.loads(receipt_path.read_text())
 if receipt.get('input_sha256')==fingerprint and receipt.get('stix_profile')=='passed':
  assert all(hashlib.sha256(Path(item['path']).read_bytes()).hexdigest()==item['sha256'] for item in receipt['artifacts'])
  print('EXPORT_CONTRACTS_REUSED: current source/input fingerprint; 9 artifacts');raise SystemExit(0)
subprocess.run(['node',str(ROOT/'scripts/check_exports.cjs'),str(a.output)],check=True)
receipt=json.loads(receipt_path.read_text());results=[]
for path in sorted(a.output.glob('*-disarm-stix-*.json')):
 result=validate_file(str(path),ValidationOptions(version='2.1',strict=True))
 assert result.is_valid, f'{path.name}: '+str([str(error) for item in result.object_results for error in item.errors])
 results.append({'file':path.name,'valid':result.is_valid,'warnings':[str(warning) for item in result.object_results for warning in item.warnings]})
assert len(results)==3
receipt.update(input_sha256=fingerprint,stix_profile='passed',stix_validator='stix2-validator 3.2.0, strict=True, version=2.1',stix_results=results,artifacts=[{'path':str(path.resolve()),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()} for path in sorted(a.output.glob('*-disarm-*'))])
receipt_path.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n');print('EXPORT_CONTRACTS_OK: 9 artifacts; STIX 2.1 strict profile; IDs/references/source/licence')
