#!/usr/bin/env python3
"""Native publication check of adopted PIN service without production secrets."""
import importlib.util, sys, secrets, threading, http.client, urllib.parse, tempfile, json, hashlib, shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('disarm_pin_auth',root/'ops/auth/disarm_pin_auth.py');auth=importlib.util.module_from_spec(spec);sys.modules[spec.name]=auth;spec.loader.exec_module(auth)
secret=secrets.token_bytes(32);now=1234567;token=auth.issue_session(secret,now,60)
assert auth.session_is_valid(token,secret,now)
assert not auth.session_is_valid(token,secret,now+60)
assert not auth.session_is_valid(token+'invalid',secret,now)
assert auth.safe_return_path('https://outside.invalid/login?next=/about','https://disarm.qdev.run')=='/'
assert auth.safe_return_path('https://disarm.qdev.run/login?next=//outside.invalid','https://disarm.qdev.run')=='/'
server=auth.ThreadingHTTPServer(('127.0.0.1',0),auth.PinAuthHandler)
server.settings=auth.Settings(pin='test-only-pin',secret=secret,allowed_origin='https://disarm.qdev.run',session_seconds=60)
server.attempts=auth.LoginAttempts();thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
def call(method,path,body=None,headers=None):
 c=http.client.HTTPConnection(*server.server_address,timeout=3);c.request(method,path,body,headers or {});r=c.getresponse();result=(r.status,dict(r.getheaders()));r.read();c.close();return result
try:
 assert call('GET','/auth/check')[0]==401
 ref='https://disarm.qdev.run/login?locale=kk&next='+urllib.parse.quote('/?tab=playbook&locale=kk',safe='')
 headers={'Content-Type':'application/x-www-form-urlencoded','Origin':'https://disarm.qdev.run','Referer':ref}
 status,head=call('POST','/auth/login','pin=test-only-pin',headers);assert status==303 and head['Location']=='/?tab=playbook&locale=kk'
 cookie=head['Set-Cookie'];assert 'Secure' in cookie and 'HttpOnly' in cookie and 'SameSite=Lax' in cookie
 assert call('GET','/auth/check',headers={'Cookie':cookie.split(';')[0]})[0]==204
 status,head=call('GET','/auth/logout');assert status==303 and 'Max-Age=0' in head['Set-Cookie']
 assert call('POST','/auth/login','pin=test-only-pin',{**headers,'Origin':'https://outside.invalid'})[0]==403
 for i in range(auth.MAX_FAILURES):
  status,head=call('POST','/auth/login','pin=wrong-test-value',headers);assert status==303 and 'error=invalid' in head['Location'] and 'locale=kk' in head['Location']
 assert 'error=limited' in call('POST','/auth/login','pin=wrong-test-value',headers)[1]['Location']
 assert call('GET','/service-source')[0]==404
 print('PIN_CONTRACT_OK: login, incorrect PIN, expiry, logout, attempt limits, same-origin redirects, locale preservation; isolated fixture only')
finally:server.shutdown();server.server_close();thread.join()

# Validate truthful health against exact artifacts, including deliberate corruption.
with tempfile.TemporaryDirectory(prefix='disarm-health-contract-') as folder:
 fixture=Path(folder);names=['index.html','assets/app.js','data/disarm.json','login.html']
 artifacts=[]
 for name in names:
  target=fixture/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,target)
  artifacts.append({'path':name,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
 (fixture/'release.json').write_text(json.dumps({'release_id':'fixture-only','manifest':{'artifacts':artifacts}}))
 (fixture/'health.json').write_text(json.dumps({'release_id':'fixture-only'}))
 assert auth.runtime_health(fixture)['status']=='ok'
 (fixture/'index.html').write_text('corrupted fixture')
 try:auth.runtime_health(fixture);raise RuntimeError('corruption was accepted')
 except AssertionError:pass
 print('PIN_RUNTIME_HEALTH_OK: valid artifacts accepted; corruption rejected')
