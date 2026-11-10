# Online deployment status

2026-11-10, America/Chicago

GitHub Pages deployment succeeded at https://jill0001.github.io/agp-rebuttal-workspace/ . The public repository contains application code only. Supabase Free hosts authentication and protected research data.

Schema and the current local workspace snapshot have been imported and counts verified. Anonymous table access and RPC calls were denied in live checks. Public signup is disabled. The deployed login page loads correctly.

Owner login account creation and membership approval are currently pending. No collaborator accounts have been granted access yet. Full signed-in browser verification remains pending.

Implementation includes email/password login, UUID membership enforcement, database-side identity checks, optimistic version saving, response history, conditional comment deletion, user-isolated recovery drafts and visible-page synchronization every 10 seconds. Same-response edits require explicit merging.

9 local tests and 4 Chrome browser tests passed, including cross-tab identity changes and draft recovery. GitHub Actions ran the tests and deployment successfully. Local test content is synthetic and isolated from the production database.

The original local site remains available during activation. Once activation completes, edit through the online URL to keep one shared source of truth. The original SQLite data is retained as a backup.
