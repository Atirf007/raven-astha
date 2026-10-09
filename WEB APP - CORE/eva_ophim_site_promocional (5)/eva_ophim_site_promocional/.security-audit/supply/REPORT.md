# Supply chain, SCA, SBOM and infrastructure review

Recorded: 2026-09-14 (exact SCA/SBOM execution times in runs.json). Skills read: dependency-supply-chain, secrets-hygiene, surgical-code-search. No dependencies installed, upgraded or manifests modified by this track.

## Results

| Scope | npm audit exit | C/H/M/L | Lock entries | CycloneDX |
| --- | --- | --- | --- | --- |
| root | 0 | 0/0/0/0 | 416 | generated |
| api | 0 | 0/0/0/0 | 242 | generated |
| js | 0 | 0/0/0/0 | 40 | BLOCKED: EINVALIDPURLTYPE, root manifest lacks name/version |

npm 11.17.0, Node v24.19.0. Consulted npm audit --help and npm sbom --help before executions. Audits are lockfile-aware, include development dependencies, and report no known advisories in the queried npm registry data. This is NOT assurance about embedded Chromium/Node binaries, actual installed trees, vendored scripts, runtime reachability or unknown vulnerabilities. No compatible dependency upgrade was indicated by these audit results.

Lockfile v3 in all scopes. Every resolved package uses registry.npmjs.org and has integrity recorded. Install hooks: root electron 30.5.1; API fsevents 2.3.3 and puppeteer 25.9.0. Electron/Puppeteer download browser runtimes; lifecycle scripts were not executed in this track. md-to-pdf is an API production dependency but no active JavaScript reference was found in api source. Its removal requires checking documentation tooling usage.

## Confirmed issues and residual observations

### Package contains environment configuration (HIGH; coordinate ID with root audit)
Source: package.json build.files includes api/**/* AND explicit api/.env (line 35 at discovery); asar false. Sink: distributable desktop resources. Independent existing-artifact evidence: dist/builder-debug.yml lines 14 and 34 include api/.env, and Test-Path dist/win-unpacked/resources/app/api/.env returned True at 2026-09-14T20:11:43Z. Contents were NOT read. Exposure of actual credential values remains UNKNOWN; packaging the configuration is confirmed. Existing binaries require withdrawal/rebuild and potential external credential rotation after owner review. A new exclusion must cover all environment files and generated evidence, not only remove the explicit positive glob. Configure runtime secrets outside distributables. Fixing future build configuration does not sanitize old artifacts.

### Electron runtime out of support (MEDIUM residual)
Root lock resolves electron 30.5.1. Official release page explicitly marks Electron 30 end-of-support: https://releases.electronjs.org/release/v30.5.1 (consulted 2026-09-14). No CVE, CVSS or exploitable browser flaw is claimed. This devDependency is the shipped runtime. A supported-major migration and Windows package/E2E compatibility review is required; not performed automatically. npm audit's zero advisories does not resolve EOL.

### Nginx deployment template (review only)
PARA_ENVIAR_VPS/etc/nginx/sites-available/nr12-viewer listens on HTTP 80 only; real upstream TLS deployment UNKNOWN. Root static content uses try_files and denies dot paths. Regex locations for obj and css/js/fonts appear BEFORE hidden-file denial; Nginx first matching regex can bypass the latter for e.g. /.hidden.js if such a file exists in deployed webroot. Existence of such deployed file and running Nginx version UNKNOWN; no production test performed. Move dotfile deny regex before extension regexes. Header rules only apply in location /; sibling regex locations do not inherit those headers. Public OBJ CORS wildcard is not independently a credential disclosure (no credentials rule).

## Tools and infrastructure

| Tool | Version | Status | Limitation |
| --- | --- | --- | --- |
| npm audit | 11.17.0 | PASS | registry advisories, lockfiles only |
| npm sbom | 11.17.0 | PARTIAL | js EINVALIDPURLTYPE |
| Docker CLI | 29.7.2 a7dcaa6 | installed | daemon pipe unavailable, docker version exit 1 |
| semgrep/trivy/gitleaks/codeql/syft/grype/snyk/osv-scanner | NOT_AVAILABLE | absent from PATH | not installed by audit |
| Security MCP | NOT_AVAILABLE | no tool metadata match | plugin not installed |
| IAST | NOT_AVAILABLE | none identified | no instrumentation enabled |

Docker --version and --help consulted; daemon was not started. No Dockerfile, compose, Kubernetes, Terraform or CI workflow surfaced in directed source-file inventory excluding generated artifacts/dependencies/Git. Container/IaC scanning NOT_APPLICABLE for absent definitions; live cloud, branch protection, deploy credentials and signing configuration UNKNOWN. Nginx template reviewed separately. Git executable absent from default PATH; repository baseline and HEAD owned by root audit.

## Gates proposed

Run npm audit --package-lock-only --ignore-scripts --json for all three lockfiles; require triage for high/critical reachable advisories. Generate lockfile CycloneDX after fixing js package metadata. Fail packaging when any .env except placeholders, keys or audit evidence appear; test generated file listing. Add controlled Windows Electron smoke/E2E before supported-major migration. Pin/verify downloaded runtimes and retain SBOM hashes. No remote operations performed.

## Evidence index

- runs.json: timestamps, cwd, sanitized command, exit, durations.
- root-audit.json, api-audit.json, js-audit.json: npm registry advisory results.
- root-sbom.cdx.json, api-sbom.cdx.json: successful CycloneDX outputs.
- js-sbom.cdx.json: error output, NOT a valid SBOM.
- lock-inventory.json: lock entries, install hooks, registry/integrity analysis.
- hashes.json: SHA-256 digests of generated evidence.

Outputs contain package metadata and dependency relationships. No environment contents, tokens, Authorization headers, cookies or secret values were read or written by this track. SBOM package source URL review uses official public registry paths only.
