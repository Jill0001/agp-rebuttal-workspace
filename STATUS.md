# Online deployment status

2026-11-10, America/Chicago

Code and deployment preparation are implemented. There is no deployed online workspace yet. The owner has not created a Supabase account and asked to finish code and preparation first.

Completed components include email/password login, membership enforcement, database-side user identity checks, optimistic version saving, immutable response history through the browser API, comment persistence and conditional deletion, per-user draft recovery, and visible-page synchronization every 10 seconds.

GitHub Actions configuration tests the application and deploys only bundled public assets after public Supabase configuration is supplied. The SQL schema and owner-run initial import are ready. A preliminary private export contains 17 response records, 248 history rows and 1 annotation. Generate a fresh export when actually switching to online editing.

Remaining setup is a free Supabase project, running the schema and final import, creating member Auth accounts and authorizing their UUIDs, then publishing the standalone source repository and configuring Pages variables. Live Supabase authentication, project settings and hosted network access must be verified after setup.

## Verification

9 local tests passed for database authorization, identity binding, version/history behavior, comments, import preservation, draft isolation and public bundling. 4 Chrome browser tests passed for login, save/merge/reload, mobile layout, nonmember denial, comment creation/recovery/supplements/deletion and cross-tab identity changes. Browser network responses were synthetic; live Supabase remains untested until a project exists.

Independent code review found and verified fixes for annotation storage-key shadowing and cross-tab account changes. Production dependency audit reported zero vulnerabilities. Public source scan found no paper title or full review paragraphs. Final build without account configuration shows the setup screen.
