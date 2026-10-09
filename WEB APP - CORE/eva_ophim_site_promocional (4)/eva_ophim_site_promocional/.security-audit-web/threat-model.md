# Threat model

Actors: anonymous attacker, authenticated tenant user, manager/admin, compromised browser data, compromised dependency and identity-provider token holder.

Priority threats: forged/revoked sessions; horizontal tenant access; vertical role escalation; SQL/command injection; stored/DOM XSS; unsafe uploads/downloads; OAuth substitution; token leakage through URLs; race conditions in stock/invites; excessive HTTP exposure.

Representative flows:

- Request identifiers/body → schema/type checks → parameterized SQL → row constrained by authenticated `org_id`.
- OIDC token → signature/issuer/audience/time validation → provider subject binding → server session.
- Uploaded base64/name → size/type/content validation → tenant-owned record → forced safe download headers.
- DB/imported text → contextual escaping or DOM text nodes → browser display.

Residual trust assumptions: production MySQL schema matches repository migrations; TLS terminates safely; IdP client IDs and allowed origins are configured; operators protect signing and DB secrets.
