# Endpoint inventory

57 route declarations were enumerated from `api/routes/` at 2026-09-14T21:21:23-03:00.

| Prefix | Operations | Authentication | Primary controls |
| --- | --- | --- | --- |
| `/api/auth` | register, login, logout, profile, invite, user administration, password | mixed by endpoint | rate limits, session DB check, role hierarchy |
| `/api/auth/oauth` | Google, Microsoft | provider assertion | RS256/JWKS, issuer/audience/expiry/subject binding |
| `/api/materials` | CRUD, files/download | bearer session | roles, tenant predicates, attachment validation |
| `/api/movements` | read, entry, exit | bearer session | roles, transaction and row locks, tenant predicates |
| `/api/warehouse` | layouts, shelves, assignments | bearer session | roles, bounds and tenant predicates |
| `/api/components` | read/create | bearer session | roles and referenced-material tenant check |
| `/api/org` | profile, positions, chart, members, invites, events | bearer session | role hierarchy and tenant/reference validation |
| `/api/contact` | submit/read/update | mixed | validation, rate limit/admin read path |

The exact route/verb declarations remain in source and were used as the review index; no undocumented dynamic router registration was found.
