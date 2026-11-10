# Online workspace

Read README.md and docs/design.md. This directory is the GitHub Pages source. The parent local site and its production SQLite data remain separate.

Never commit private/, database exports, review content, access tokens, passwords or service-role keys. Public build configuration accepts only a Supabase project URL and publishable key. Every API request requires membership and an expected_user equal to the verified auth.uid(). Keep that identity check alongside transactional version checks.

Tests use synthetic content and isolated PGlite databases. Run npm test and npm run test:browser. Never test mutations against production. Keep recovery drafts scoped by project and user. Same-response edits require version conflict merging.

Generate private SQL imports with scripts/export_workspace.py using a read-only consistent snapshot. Stop local edits before the final cutover snapshot. Import refuses a nonempty destination. After cutover, online content is authoritative.

Deploy only after Supabase schema, memberships and public configuration exist. GitHub Actions builds and deploys dist, never the project root. No paid resources should be created without an explicit user request.
