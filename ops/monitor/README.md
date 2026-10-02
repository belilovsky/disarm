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
