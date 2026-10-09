# Scope and assumptions

Timestamp: 2026-09-14T21:21:23-03:00

Included: canonical browser application in `app/`, Express API in `api/`, MySQL queries/schema, authentication, authorization, tenant isolation, upload/download, dependencies, HTTP controls and local tests.

Excluded: Electron, installers, desktop/mobile clients, `old/`, `evah/`, and root legacy `js/`/`css/`, because the current Express static allowlist does not serve them.

UNKNOWN: production proxy/TLS/CDN policy, branch protection, deployment topology, real identity-provider configuration.

NOT_AVAILABLE: disposable MySQL, Semgrep, CodeQL, Gitleaks, Trivy and IAST. Docker CLI exists but no validated audit container/daemon was available. Git executable is absent from PATH, so branch, HEAD and machine-generated diff are BLOCKED.

NOT_EXECUTED: production/staging DAST, destructive testing, external OAuth login, TLS probe, deployment and remote changes.
