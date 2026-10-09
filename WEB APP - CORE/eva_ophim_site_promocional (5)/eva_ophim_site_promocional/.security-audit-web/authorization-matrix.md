# Authorization matrix

| Surface | Anonymous | Viewer | Operator | Manager | Admin | Superadmin | Tenant control |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login/register/OAuth | limited | N/A | N/A | N/A | N/A | N/A | identity binding |
| Materials read | deny | allow | allow | allow | allow | allow | `org_id` |
| Materials create | deny | deny | allow | allow | allow | allow | `org_id` |
| Materials edit/delete | deny | deny | deny | allow | allow | allow | `org_id` |
| Stock movements | deny | deny | allow | allow | allow | allow | locked tenant rows |
| Files read | deny | allow | allow | allow | allow | allow | material + `org_id` |
| Files mutate | deny | deny | deny | allow | allow | allow | resource + `org_id` |
| Org users/roles | deny | read | read | read | bounded admin | full | target `org_id` |
| Org chart/positions | deny | read | read | read | mutate | mutate | referenced rows checked |
| Events | deny | read | read | mutate | mutate | mutate | `org_id` |

Server-side middleware and SQL predicates are authoritative; browser role checks only alter presentation.
