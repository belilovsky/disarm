# DISARM monitoring adapter

The existing Platform Monitor worker runs this checker only for project `disarm`.
It uses the current notification channel and scheduler; no new timer is installed.
The checker requires fresh dynamic evidence from both PIN services, release/corpus/source parity,
a protected-page redirect and a meaningful login page. Failure details contain no credentials.
The operator home is the DISARM entry on the existing Monitor dashboard and Platform catalog.

Installation preserves the monitor's existing source and runtime changes. Add
`check_disarm` to the functional checker list only when `pid == "disarm"`, and add
the DISARM definition to the existing project configuration. Keep unrelated rows unchanged.
Release evidence must record activation and a successful test notification.

## Active installation — 3 October 2026

Home: https://monitor.qdev.run/project/disarm. The existing four scheduler jobs
are retained. `project.yaml` is the exact DISARM configuration row; its command
runs the actual asynchronous checker and exits unsuccessfully on an error.

On the existing monitor host, the checker is installed as
`app/checkers/disarm_check.py`. Both app and worker add `check_disarm` only for
`pid == "disarm"`. Their latest-result queries include `disarm_runtime`; the
project template labels this result “DISARM: оба хоста, PIN и корпус”.

The app and worker have separate, read-only mounts for the checker and their
own amended runtime `monitor.py`. The app additionally mounts the amended
project template. Original source, compose/config and per-container preimages
are retained in `/opt/platform-monitor/output/disarm-activation-20261003/`.
This preserves pre-existing owner changes and differences between the two
running containers. Recreate only app and worker without rebuilding or restarting
database/Redis. Do not replace the monitor repository with this project's files.

Origin port 18080 admits the existing monitor's source address `62.72.32.112`
through one explicit firewall rule, alongside the existing edge allowance.
PIN protection remains enforced. No credentials are read by the checker.

The deployed release `content-b8030ccea94ca608d4409f34` passed this checker on
both hosts. The existing Telegram channel accepted the test notification;
the native alert record is marked notified. This proves channel delivery
acceptance, not that a recipient read the message. Native activation and runtime
receipts are retained outside the served product.
