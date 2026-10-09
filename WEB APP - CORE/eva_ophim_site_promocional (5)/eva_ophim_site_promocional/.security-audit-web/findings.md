# Findings

| ID | Finding | Severity | Score | Status | Regression evidence |
| --- | --- | --- | --- | --- | --- |
| SEC-WEB-001 | Admin could grant/alter `superadmin` through duplicate org route | High | INTERNAL_RISK_SCORE 8.1 | FIXED | tenant test: bounded hierarchy |
| SEC-WEB-002 | Org chart accepted cross-tenant user/parent references | Medium | 6.4 | FIXED | two foreign-reference tests |
| SEC-WEB-003 | Viewer could create/delete organization events | Medium | 5.7 | FIXED | viewer mutation denials |
| SEC-WEB-004 | Bearer JWT embedded in attachment URLs | Medium | 6.2 | FIXED | URL/static and authenticated-fetch tests |
| SEC-WEB-005 | Browser OAuth/WebAuthn paths minted unverified local sessions | Medium | 6.5 | FIXED | fake-token patterns absent; backend exchange required |
| SEC-WEB-006 | Position fields reached onboarding HTML/CSS sinks | Medium | 5.5 | FIXED | contextual encoding regression |
| SEC-WEB-007 | Imported/local MapHub data reached HTML, URL and CSS sinks | Medium | 5.9 | FIXED | text/color/number/URL sanitization assertions |

## Root causes and patches

SEC-WEB-001/002/003 arose from inconsistent authorization and incomplete tenant checks in `api/routes/organizations.js`. The patch enforces the role hierarchy, canonical roles, tenant ownership of position/user/parent references, manager-or-higher event mutation and bounded event validation.

SEC-WEB-004 arose from adapting browser navigation to Bearer authentication with query parameters. Query-token acceptance was removed; downloads/models now use Authorization headers and Blob URLs where navigation needs one.

SEC-WEB-005 arose from trusting decoded or locally-created browser artifacts. Google/Microsoft assertions now go to server verification, Microsoft responses require an initiating nonce, the implicit access-token fallback was removed, and unsupported WebAuthn was disabled until a server ceremony exists.

SEC-WEB-006/007 arose from template strings crossing HTML/CSS/URL contexts. The patches encode text and restrict colors, numbers and image URL schemes.

CVSS vectors and ASVS requirement IDs are UNKNOWN because they were not formally calculated/verified. CWE mappings were intentionally omitted rather than inferred.
