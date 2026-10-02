#!/usr/bin/env python3
"""Required isolated restore and atomic switch-back rehearsal; live roots are read-only."""
import argparse, functools, json, shutil, sys, threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from release_host import manifest, switch, ROOTS, load
p=argparse.ArgumentParser()
p.add_argument("--role", choices=ROOTS, required=True)
p.add_argument("--snapshot", type=Path, required=True)
p.add_argument("--workspace", type=Path, required=True)
p.add_argument("--port", type=int, default=18880)
p.add_argument("--interactive", action="store_true")
a=p.parse_args()
assert a.workspace.parent == Path("/var/tmp") and a.workspace.name.startswith("disarm-restore-")
assert not a.workspace.exists()
live=ROOTS[a.role]
current=load(live/"release.json")
old=load(a.snapshot/"release.json")
manifest(a.snapshot,old);manifest(live,current)
size=sum(path.stat().st_size for root in [live,a.snapshot] for path in root.rglob("*") if path.is_file())
assert shutil.disk_usage(a.workspace.parent).free > size*3+16*1024*1024
a.workspace.mkdir()
restored=a.workspace/"restored";active=a.workspace/"serving";retained=a.workspace/"retained-current"
shutil.copytree(a.snapshot,restored,symlinks=True)
shutil.copytree(live.resolve(),active,symlinks=True)
manifest(restored,old)
switch(active,restored,retained)
manifest(active,old)
receipt={"schema_version":"disarm-restore-rehearsal-v1","role":a.role,"live_release":current["release_id"],"snapshot_release":old["release_id"],"restore_integrity":"passed","atomic_switch":"passed","live_root_unchanged":True}
server=None
if a.interactive:
 handler=functools.partial(SimpleHTTPRequestHandler,directory=str(active))
 server=ThreadingHTTPServer(("127.0.0.1",a.port),handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 print(json.dumps({**receipt,"state":"restored-awaiting-render"}),flush=True)
 assert sys.stdin.readline().strip()=="ROLLBACK"
switch(active,retained,a.workspace/"unused-after-rollback")
manifest(active,current);manifest(live,current)
receipt["switch_back"]="passed"
(a.workspace/"restore-receipt.json").write_text(json.dumps(receipt,indent=2)+"\n")
print(json.dumps({**receipt,"state":"restored-current-awaiting-render"}),flush=True)
if server:
 assert sys.stdin.readline().strip()=="STOP"
 server.shutdown();server.server_close()
