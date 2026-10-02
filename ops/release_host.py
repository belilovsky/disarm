#!/usr/bin/env python3
"""DISARM host phases. Caller holds the standard two-host publication locks."""
import argparse, ctypes, hashlib, json, os, shutil, subprocess, time, urllib.request, urllib.error
from pathlib import Path
ROOTS={'edge':Path('/var/www/disarm.qdev.run'),'origin':Path('/srv/www/disarm.qdev.run')}
def load(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def auth_ready():
 for attempt in range(25):
  try:
   urllib.request.urlopen('http://127.0.0.1:18081/auth/check',timeout=1)
  except urllib.error.HTTPError as error:
   if error.code==401:return
  except OSError:pass
  time.sleep(.2)
 raise RuntimeError('PIN service did not become ready')
def manifest(root,release):
 for item in release['manifest']['artifacts']:
  rel=Path(item['path']);assert not rel.is_absolute() and '..' not in rel.parts
  assert (root/rel).is_file() and sha(root/rel)==item['sha256'],str(rel)
 assert load(root/'health.json')['release_id']==release['release_id']
def switch(root,target,retained):
 link=root.parent/('.disarm-pointer-'+retained.name)
 assert not link.exists() and not link.is_symlink()
 os.symlink(str(target),link)
 if root.is_symlink():os.replace(link,root)
 else:
  # Linux renameat2 exchanges a directory and symlink in one atomic operation.
  libc=ctypes.CDLL(None,use_errno=True)
  result=libc.renameat2(-100,os.fsencode(root),-100,os.fsencode(link),2)
  if result:raise OSError(ctypes.get_errno(),'Atomic directory exchange failed')
  os.rename(link,retained)
def main():
 p=argparse.ArgumentParser();p.add_argument('role',choices=ROOTS);p.add_argument('phase',choices=['preflight','snapshot','publish','verify','rollback']);p.add_argument('--stage',type=Path,required=True);p.add_argument('--base',required=True);p.add_argument('--target',required=True);p.add_argument('--operation',required=True);a=p.parse_args()
 assert a.operation.replace('-','').isalnum() and a.target.startswith('content-') and a.base.startswith('content-')
 root=ROOTS[a.role];stage=a.stage;candidate=load(stage/'tree/release.json');assert candidate['release_id']==a.target;manifest(stage/'tree',candidate)
 for relative, expected in candidate['manifest']['runtime'].items():
  assert sha(stage/relative)==expected, 'Runtime package drift: '+relative
 backup=root.parent/(root.name+'-backups')/a.operation
 releases=root.parent/(root.name+'-releases');target=releases/a.target
 journal=stage/'host-transaction.json';entry=load(journal) if journal.exists() else {'role':a.role,'base':a.base,'target':a.target,'steps':[]}
 assert entry['role']==a.role and entry['base']==a.base and entry['target']==a.target, 'Operation identity changed'
 emit={'phase':a.phase,'role':a.role,'base':a.base,'target':a.target}
 auth=Path('/opt/disarm-pin-auth/disarm_pin_auth.py');unit=Path('/etc/systemd/system/disarm-pin-auth.service')
 nginx=Path('/etc/nginx/sites-enabled/disarm.qdev.run.conf' if a.role=='edge' else '/etc/nginx/sites-enabled/disarm.qdev.run')
 if a.phase=='preflight':
  active=load(root/'release.json');assert active['release_id']==a.base;manifest(root,active)
  # Bind current active service/config to the captured baseline; refuse unrelated runtime drift.
  for name,path in [('auth',auth),('unit',unit),('nginx',nginx)]:assert sha(path)==load(stage/'runtime-base.json')[name]
  subprocess.run(['nginx','-t'],check=True,capture_output=True)
  subprocess.run(['systemctl','is-active','--quiet','nginx','disarm-pin-auth.service'],check=True)
  size=sum(p.stat().st_size for p in root.rglob('*') if p.is_file())+sum(i['bytes'] for i in candidate['manifest']['artifacts'])
  required=size*3+16*1024*1024;free=shutil.disk_usage(root.parent).free
  assert free>required and os.statvfs(root.parent).f_favail>400
  assert not backup.exists() and not target.exists()
  emit.update(free_bytes=free,required_peak_bytes=required,free_inodes=os.statvfs(root.parent).f_favail)
 elif a.phase=='snapshot':
  assert load(root/'release.json')['release_id']==a.base and not backup.exists()
  backup.mkdir(parents=True);shutil.copytree(root.resolve(),backup/'tree',symlinks=True);manifest(backup/'tree',load(backup/'tree/release.json'))
  for name,path in [('auth.py',auth),('auth.service',unit),('nginx.conf',nginx)]:shutil.copy2(path,backup/name)
  entry['previous_pointer']=str(root.resolve()) if root.is_symlink() else str(backup/'retained-active')
  entry['backup']=str(backup);emit['backup']=str(backup)
 elif a.phase=='publish':
  assert backup.exists() and load(root/'release.json')['release_id']==a.base
  releases.mkdir(exist_ok=True);shutil.copytree(stage/'tree',target)
  manifest(target,candidate)
  for path in [target,*target.rglob('*')]:
   os.chown(path,33,33);os.chmod(path,0o755 if path.is_dir() else 0o644)
  entry['activation_started']=True;journal.write_text(json.dumps(entry,indent=2)+'\n')
  # Activate code/config within this locked release, retaining secrets on the hosts.
  shutil.copy2(stage/'ops/auth/disarm_pin_auth.py',auth)
  unit.write_text((stage/'ops/auth/disarm-pin-auth.service').read_text().replace('@SERVING_ROOT@',str(root)))
  shutil.copy2(stage/f'ops/nginx/{a.role}.conf',nginx)
  subprocess.run(['nginx','-t'],check=True,capture_output=True)
  subprocess.run(['systemctl','daemon-reload'],check=True)
  subprocess.run(['systemctl','restart','disarm-pin-auth.service'],check=True)
  subprocess.run(['systemctl','is-active','--quiet','disarm-pin-auth.service'],check=True)
  auth_ready()
  switch(root,target,backup/'retained-active')
  subprocess.run(['systemctl','reload','nginx'],check=True)
  emit.update(pointer=str(root.resolve()),backup=str(backup))
 elif a.phase=='verify':
  assert root.is_symlink() and root.resolve()==target and load(root/'release.json')['release_id']==a.target;manifest(root,candidate)
  assert unit.read_text()==(stage/'ops/auth/disarm-pin-auth.service').read_text().replace('@SERVING_ROOT@',str(root))
  assert sha(auth)==sha(stage/'ops/auth/disarm_pin_auth.py') and sha(nginx)==sha(stage/f'ops/nginx/{a.role}.conf')
  subprocess.run(['systemctl','is-active','--quiet','nginx','disarm-pin-auth.service'],check=True)
  auth_ready()
  with urllib.request.urlopen('http://127.0.0.1:18081/auth/health',timeout=10) as response:runtime=json.load(response)
  assert runtime['status']=='ok' and runtime['release_id']==a.target and runtime['pin_service']=='ok'
  emit.update(pointer=str(root.resolve()),manifest_sha256=candidate['artifact_manifest_sha256'],auth_sha256=sha(auth),backup=str(backup))
 elif a.phase=='rollback':
  assert backup.exists();old=load(backup/'tree/release.json');assert old['release_id']==a.base;manifest(backup/'tree',old)
  assert load(root/'release.json')['release_id'] in [a.base,a.target], 'Refuse rollback over a newer release'
  if root.is_symlink() and load(root/'release.json')['release_id']!=a.base:
   previous=Path(entry['previous_pointer'])
   if not previous.exists():previous=backup/'tree'
   manifest(previous,old);switch(root,previous,backup/'unused-after-rollback')
  for name,path in [('auth.py',auth),('auth.service',unit),('nginx.conf',nginx)]:shutil.copy2(backup/name,path)
  subprocess.run(['nginx','-t'],check=True,capture_output=True);subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart','disarm-pin-auth.service'],check=True);subprocess.run(['systemctl','reload','nginx'],check=True)
  assert load(root/'release.json')['release_id']==a.base;manifest(root,old);emit['restored_release']=a.base
  auth_ready()
 entry['steps'].append(emit);journal.write_text(json.dumps(entry,indent=2)+'\n');print(json.dumps(emit))
if __name__=='__main__':main()
