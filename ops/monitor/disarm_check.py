"""Only DISARM: fresh PIN/runtime evidence, two-host parity and protected-page boundary."""
from datetime import datetime, timezone
from urllib.parse import urlparse
import httpx
from app.database import CheckResult

async def check_disarm(project):
    if project.id != "disarm":
        raise ValueError("DISARM checker is project-scoped")
    details = {"hosts": {}, "project_id": "disarm"}
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            release_response = await client.get("https://disarm.qdev.run/release.json")
            release_response.raise_for_status()
            release = release_response.json()
            for role, base in [("edge", "https://disarm.qdev.run"), ("origin", "http://187.55.228.239:18080")]:
                response = await client.get(base + "/runtime-health.json")
                response.raise_for_status()
                runtime = response.json()
                assert runtime["status"] == "ok" and runtime["pin_service"] == "ok"
                assert runtime["release_id"] == release["release_id"]
                assert runtime["auth_source_sha256"] == release["deployment_contract"]["auth_source_sha256"]
                assert runtime["corpus_sha256"] == next(a["sha256"] for a in release["manifest"]["artifacts"] if a["path"] == "data/disarm.json")
                assert runtime["counts"] == {"phases":4,"tactics":13,"techniques":71,"counters":140,"incidents":63}
                age = (datetime.now(timezone.utc) - datetime.fromisoformat(runtime["checked_at"])).total_seconds()
                assert -10 <= age < 60
                page = await client.get(base + "/?tab=about&locale=en")
                assert page.status_code == 302 and urlparse(page.headers["location"]).path == "/login"
                login = await client.get(base + "/login?locale=en")
                assert login.status_code == 200 and 'name="pin"' in login.text and '/auth/login' in login.text
                details["hosts"][role] = {"release_id":runtime["release_id"],"pin_service":"ok","corpus":"verified","redirect":"302 /login","login":"meaningful","checked_at":runtime["checked_at"]}
        return CheckResult(project_id="disarm", checker="disarm_runtime", status="ok", message="DISARM: оба PIN-сервиса, корпус, релиз и вход подтверждены", details=details)
    except Exception as error:
        details["error_type"] = type(error).__name__
        return CheckResult(project_id="disarm", checker="disarm_runtime", status="error", message="DISARM: проверка runtime не пройдена", details=details)
