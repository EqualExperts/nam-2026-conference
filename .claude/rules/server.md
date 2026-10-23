---
paths:
  - "server/**"
---

# Server rules

Loaded when you read a file under `server/`. The decisions every change must
respect are in `CLAUDE.md`; these are the ones only server work needs.

**Routes stay thin; rules live in `server/lib/`** beside `seats.js`,
`attendance.js` and `agenda.js`, where they can be tested without HTTP. A
handler reads the request, calls one function, and sends the result.

**Prepare statements once, at module scope.** `db.prepare(...)` compiles SQL, so
preparing in a handler recompiles on every request. The exception is a filter
whose SQL genuinely varies with the query string (`/sessions`, `/speakers`,
`/vendors`) — and those still pass every value as a bound `?`.
