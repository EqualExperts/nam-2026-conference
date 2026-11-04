# Agent context

This repository's conventions, commands and architecture are documented in
[CLAUDE.md](./CLAUDE.md). Read that file first — it applies to every agent and
tool working in this repo, not just Claude.

Quick reference:

- `npm run dev` — seed the database and start the API + web app together.
- `npm run verify` — Playwright suite. A change is not done until this passes.
- `npm run shot -- /route` — screenshot a route to `.screenshots/` for a visual check.
- Project context: [context/index.md](./context/index.md) — product, engineering and Winnow transcripts, an index in every folder.
- Schema reference: [context/engineering-context/data-model.md](./context/engineering-context/data-model.md).
