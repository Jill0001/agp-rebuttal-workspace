# Implementation plan

- [x] Test and implement the authenticated database RPC with transactional version checks, response history, comment validation and conditional deletion.
- [x] Add login and Supabase adapter, isolate drafts per user and refresh visible windows every 10 seconds.
- [x] Export a consistent SQLite snapshot read-only, generate an import that refuses nonempty targets, and test preservation.
- [x] Bundle relative-path Pages assets, add deployment automation and test the public artifact for private data.
- [ ] Publish sanitized source and activate after the owner creates Supabase. Owner requested preparation only until then.

Review cases include anonymous access, authenticated nonmembers, conflicting writes, expired sessions, unsaved drafts at logout and secret exposure.
