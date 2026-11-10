# Online rebuttal workspace

GitHub Pages serves application assets. Supabase Auth uses email and password accounts created by the owner. Membership keyed by immutable user UUID grants access. Research content lives only in PostgreSQL.

Authenticated RPCs validate membership, lock records and compare versions. History stores the authenticated author. Direct table access is revoked and RLS is enabled. The UI refreshes every 10 seconds while visible. Dirty drafts require explicit conflict merging. Recovery drafts are isolated by user and project.

The original local application operates during preparation. A consistent SQLite export preserves all responses, history and comments. Cloud import refuses nonempty destinations. After final cutover, the online database is authoritative.

No paid resources are provisioned. Activation requires a free Supabase project, public client configuration and an owner membership. Public code contains no reviews, responses, database exports or private credentials.
