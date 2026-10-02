#!/usr/bin/env python3
"""Isolated publication browser fixture; never added to the public allowlist."""
import argparse, http.server, json, time, urllib.parse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--port',type=int,default=18979);a=p.parse_args()
MODE=Path('/var/tmp/disarm-browser-fixture-mode-20261002.json')
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(a.root),**kw)
 def do_GET(self):
  url=urllib.parse.urlsplit(self.path); query=urllib.parse.parse_qs(url.query)
  if 'qa-mode' in query:
   mode=query['qa-mode'][0]; assert mode in ['valid','cached','incompatible','corrupt','error','loading']
   MODE.write_text(json.dumps({'mode':mode}))
  mode=json.loads(MODE.read_text())['mode'] if MODE.exists() else 'valid'
  if url.path=='/fixture-seed.js':
   seed="/* explicit nonsecret publication fixture */\nconst fixtureUrl=new URL(location.href);fixtureUrl.searchParams.delete('qa-mode');history.replaceState(null,'',fixtureUrl.pathname+fixtureUrl.search);\n"
   if mode in ['error','loading']:seed+="localStorage.removeItem('disarm-framework-data-v2');"
   elif mode in ['incompatible','corrupt']:
    value={'schema':'old' if mode=='incompatible' else 'disarm-corpus-cache-v2','digest':'old' if mode=='incompatible' else '474aba30cea415e47ee256143f5f17562406294747d40f6e03bb3898d261c2b2','savedAt':'2026-10-02T00:00:00Z','text':(a.root/'data/disarm.json').read_text()+' '}
    seed+="localStorage.setItem('disarm-framework-data-v2',"+json.dumps(json.dumps(value))+");"
   data=seed.encode();self.send_response(200);self.send_header('Content-Type','application/javascript');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(data);return
  if url.path=='/data/disarm.json':
   if mode=='loading':time.sleep(8)
   elif mode!='valid':self.send_error(503,'Isolated QA network-unavailable fixture');return
  if url.path=='/':
   html=(a.root/'index.html').read_text().replace('<head>','<head><script src="/fixture-seed.js"></script>',1)
   self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(html.encode());return
  return super().do_GET()
 def log_message(self,*args):pass
http.server.ThreadingHTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
