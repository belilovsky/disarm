"""Bounded source amendment for DISARM in the existing Platform Monitor."""
import ast


def amend_monitor(source: str) -> str:
    """Preserve unrelated code; run DISARM in the existing frequent health job."""
    import_line = 'from app.checkers.disarm_check import check_disarm'
    if import_line not in source:
        anchor = 'from app.projects import ProjectDef, load_projects'
        assert source.count(anchor) == 1
        source = source.replace(anchor, anchor + '\n' + import_line)
    # Move our earlier full-job integration into the quick job. Other functional
    # checkers retain their original order and behavior.
    source = source.replace(
        '(check_content, check_uptime) + ((check_disarm,) if pid == "disarm" else ())',
        '(check_content, check_uptime)',
    )
    for anchor in ('["content", "uptime"]',):
        source = source.replace(anchor, '["content", "uptime", "disarm_runtime"]')
    marker = '# DISARM quick-cycle integration'
    if marker not in source:
        start = source.index('async def run_health_checks_only()')
        prefix, quick = source[:start], source[start:]
        anchor = '    checker = HealthChecker()\n'
        assert quick.count(anchor) == 1
        quick = quick.replace(anchor, '''    # DISARM quick-cycle integration: use the existing job and alert channel.
    disarm_result = None
    if "disarm" in projects:
        disarm_result = await check_disarm(projects["disarm"])
        async with async_session() as session:
            session.add(disarm_result)
            await session.commit()
            await session.refresh(disarm_result)
    checker = HealthChecker()
''', 1)
        anchor = '        alert_input = {pid: {"health": r} for pid, r in results.items()}\n'
        assert quick.count(anchor) == 1
        quick = quick.replace(anchor, anchor + '''        if disarm_result is not None:
            alert_input["disarm"]["disarm_runtime"] = disarm_result
''', 1)
        source = prefix + quick
    ast.parse(source)
    return source
