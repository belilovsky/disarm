#!/usr/bin/env python3
"""Project-native, serialized DISARM two-host release with an explicit operation journal."""
import argparse, hashlib, json, selectors, shlex, subprocess, sys, tarfile, time, urllib.request
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads(p.read_text())
def run(cmd,timeout=120):
 r=subprocess.run(cmd,capture_output=True,text=True,timeout=timeout)
 if r.returncode:raise RuntimeError(f'{cmd[0]} failed: {r.stderr[-700:] or r.stdout[-700:]}')
 return r.stdout.strip()
def live():
 with urllib.request.urlopen('https://disarm.qdev.run/release.json?disarm_release_check='+str(time.time_ns()),timeout=15) as response:return json.load(response)
def main():
 p=argparse.ArgumentParser();p.add_argument('mode',choices=['preflight','publish','verify','rollback']);p.add_argument('--base',required=True);p.add_argument('--operation',required=True);p.add_argument('--journal',type=Path,required=True);p.add_argument('--runtime-base-dir',type=Path,default=ROOT/'ops/runtime-base');a=p.parse_args()
 assert a.operation.replace('-','').isalnum()
 cfg=read(ROOT/'ops/serving-hosts.json');candidate=read(ROOT/'release.json');target=candidate['release_id'];commit=run(['git','-C',str(ROOT),'rev-parse','HEAD'])
 journal=read(a.journal) if a.journal.exists() else {'schema_version':'disarm-release-transaction-v2','operation':a.operation,'base_release':a.base,'target_release':target,'candidate_commit':commit,'steps':[],'provider_ci':'manual-continuity; provider CI must be reported separately'}
 assert journal['operation']==a.operation and journal['base_release']==a.base and journal['target_release']==target
 a.journal.parent.mkdir(parents=True,exist_ok=True)
 locks=[];started=[]
 def store():a.journal.parent.mkdir(parents=True,exist_ok=True);a.journal.write_text(json.dumps(journal,ensure_ascii=False,indent=2)+'\n')
 def remote(role,cmd):return run(['ssh','-T','-o','BatchMode=yes','-o','ConnectTimeout=12',cfg['hosts'][role]['ssh'],cmd])
 def stage(role):return cfg['hosts'][role]['root']+'-staging-'+a.operation
 def phase(role,name):
  cmd=['python3',stage(role)+'/ops/release_host.py',role,name,'--stage',stage(role),'--base',a.base,'--target',target,'--operation',a.operation]
  result=json.loads(remote(role,shlex.join(cmd)));journal['steps'].append(result);store();print(json.dumps(result),flush=True)
 try:
  if a.mode in ['preflight','publish']:
   assert not run(['git','-C',str(ROOT),'status','--porcelain']), 'Candidate must be committed and clean'
   assert run(['git','ls-remote',cfg['repository'],'refs/heads/'+cfg['branch']]).split()[0]==commit,'Remote release base changed'
   assert live()['release_id']==a.base,'Public release changed'
  for role in ['edge','origin']:
   proc=subprocess.Popen(['ssh','-T','-o','BatchMode=yes','-o','ConnectTimeout=12',cfg['hosts'][role]['ssh'],"flock -n "+shlex.quote(cfg['lock'])+" sh -c 'echo LOCKED; cat >/dev/null'"],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
   ready=selectors.DefaultSelector();ready.register(proc.stdout,selectors.EVENT_READ)
   if not ready.select(20) or proc.stdout.readline().strip()!='LOCKED':proc.terminate();raise RuntimeError(role+' publication lock unavailable')
   locks.append(proc);ready.close()
  if a.mode in ['preflight','publish']:
   assert live()['release_id']==a.base,'Public release changed while acquiring locks'
   assert run(['git','ls-remote',cfg['repository'],'refs/heads/'+cfg['branch']]).split()[0]==commit,'Remote changed under publication locks'
   archive=a.journal.parent/(a.operation+'.tar.gz')
   public=[i['path'] for i in candidate['manifest']['artifacts']]+candidate['deployment_contract']['required_publish_files']
   with tarfile.open(archive,'w:gz') as out:
    for path in public:out.add(ROOT/path,arcname='tree/'+path,recursive=False)
    for path in ['ops/release_host.py','ops/auth/disarm_pin_auth.py','ops/auth/disarm-pin-auth.service','ops/nginx/edge.conf','ops/nginx/origin.conf']:out.add(ROOT/path,arcname=path,recursive=False)
   for role in ['edge','origin']:
    dest=stage(role);remote(role,'mkdir -p '+shlex.quote(dest))
    run(['scp','-q','-o','BatchMode=yes',str(archive),cfg['hosts'][role]['ssh']+':'+dest+'/candidate.tar.gz'])
    remote(role,'tar -xzf '+shlex.quote(dest+'/candidate.tar.gz')+' -C '+shlex.quote(dest))
    baseline=a.runtime_base_dir/f'{role}.json'
    run(['scp','-q','-o','BatchMode=yes',str(baseline),cfg['hosts'][role]['ssh']+':'+dest+'/runtime-base.json'])
    phase(role,'preflight')
   if a.mode=='publish':
    for role in ['edge','origin']:phase(role,'snapshot')
    for role in ['origin','edge']:
     started.append(role);phase(role,'publish')
    for role in ['origin','edge']:phase(role,'verify')
    assert live()['release_id']==target,'Public release identity mismatch'
    for script in ['check_runtime_evidence.py']:
     output=run([sys.executable,str(ROOT/'scripts'/script),'--base-url',cfg['public_url']]);journal['steps'].append({'phase':'public-verify','check':script,'result':output})
    output=run([str(ROOT/'scripts/smoke_live.sh'),cfg['public_url']]);journal['steps'].append({'phase':'public-verify','check':'smoke_live','result':output})
    journal['status']='deployed_runtime_verified'
   else:journal['status']='preflight_passed'
  elif a.mode=='verify':
   for role in ['origin','edge']:phase(role,'verify')
   assert live()['release_id']==target;journal['status']='deployed_runtime_verified'
  else:
   for role in ['origin','edge']:phase(role,'rollback')
   assert live()['release_id']==a.base;journal['status']='rolled_back'
 except Exception as error:
  journal['status']='failed';journal['steps'].append({'phase':'error','message':str(error)})
  if started:
   for role in reversed(started):
    try:phase(role,'rollback')
    except Exception as rollback_error:journal['steps'].append({'phase':'rollback-error','role':role,'message':str(rollback_error)})
   journal['restored_public_release']=live()['release_id']
  raise
 finally:
  for proc in reversed(locks):
   proc.stdin.close()
   try:proc.wait(timeout=5)
   except subprocess.TimeoutExpired:proc.terminate();proc.wait(timeout=5)
  store()
if __name__=='__main__':main()
