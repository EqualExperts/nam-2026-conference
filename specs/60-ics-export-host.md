# 60 — Calendar export links point at localhost, not the address the attendee used

## What this changes

Adding a session, or a whole agenda, to a real calendar app puts a link on the
event: "View this session". Today that link is always
`http://localhost:5173/sessions/…`, wherever the app is actually reached from
— so it only ever works on the machine that seeded the database. Nothing an
attendee sees moves; the `URL:` line inside the exported `.ics` file (from
"Export calendar" on My Agenda, and a single session's own export) becomes the
address they actually used to reach ORBIT, or an operator-configured public
address when one is set.

## Where

- `server/lib/ical.js` — `event(s, baseUrl)` builds the link from a `baseUrl`
  argument instead of the hard-coded string. New export `baseUrlFor(req)`:
  an env var `ORBIT_PUBLIC_URL` (trailing slash stripped) if set, else
  `${protocol}://${host}` read off the request — preferring
  `X-Forwarded-Proto`/`X-Forwarded-Host` when present (the same signal a
  reverse proxy in front of the app would set) and falling back to
  `req.protocol`/`req.get('host')` for a direct connection. `sessionCalendar`
  and `agendaCalendar` both gain a `baseUrl` parameter and thread it into
  `event()`.
- `server/routes/sessions.js` — `/:id.ics` calls `sessionCalendar(id,
  baseUrlFor(req))`.
- `server/routes/users.js` — `/:id/agenda.ics` calls `agendaCalendar(id,
  baseUrlFor(req))`.
- `tests/api/harness.js` — `client().get` gains an optional third `headers`
  argument (currently only `put`/`post` bodies set headers) so a test can send
  `X-Forwarded-Host`/`X-Forwarded-Proto` on a plain GET.
- `tests/api/calendar.test.js` — new assertions, see below.
- `docs/context/agenda.md` — the gotcha line "hard-codes
  `URL:http://localhost:5173/...`" is stale once this lands; replaced with a
  line naming `baseUrlFor` and `ORBIT_PUBLIC_URL`.

`ORBIT_PUBLIC_URL` follows the existing `ORBIT_DB` / `ORBIT_START_DATE`
naming. No new dependency, no change to `escape`/`fold`/`stamp`/`local`, and
no route becomes anything but a one-line handler.

## How it will be proved

API layer, `tests/api/calendar.test.js`, against the real request path via
`startApi()` (no unit-level fake — the value under test is what Express hands
the route):

- **Built from the request.** A plain `GET /sessions/:id.ics` and `GET
  /users/:id/agenda.ics`, with nothing configured, asserts the `URL:` line
  matches `http://127.0.0.1:<port>/sessions/<id>` — the address the test
  client actually used — replacing today's implicit `localhost:5173`.
- **Non-default host, from the request** (the ticket's named check). A `GET
  /sessions/:id.ics` sent with `X-Forwarded-Host: attendee.example` and
  `X-Forwarded-Proto: https` asserts `URL:https://attendee.example/sessions/…`
  — a host the request carries but the server was never told about up front.
- **Configured base URL wins.** The same request, plus `ORBIT_PUBLIC_URL` set
  to a third address, asserts the `URL:` line uses *that* address rather than
  the forwarded one — proving precedence, not just presence.

No unit test is added: `baseUrlFor` reads `req`/`process.env` directly, so
exercising it needs a request, which is what the API layer already gives for
free; `tests/unit/ical.test.js` stays scoped to `escape`/`fold`, which did not
change.

## Decisions

- **Read `X-Forwarded-*` directly rather than wiring Express's `trust proxy`
  setting.** `trust proxy` also changes `req.ip` and `req.hostname` (which
  strips the port), and nothing else in this app makes a trust decision based
  on client IP. Reading the forwarded headers when present, and the direct
  connection's own protocol/host otherwise, gets the same result with a
  smaller blast radius, and keeps any port the request was actually made on.
- **Env var name**: the ticket left this open. `ORBIT_PUBLIC_URL` matches the
  existing `ORBIT_*` convention (`ORBIT_DB`, `ORBIT_START_DATE`).

## Out of scope

- The web app's own address (Vite's dev proxy, `WEB_PORT`) is unchanged; this
  is only the link text inside exported `.ics` files.
- No change to `DTSTAMP`, folding, or escaping.

## Audit

- spec round 1: 1 raised, 0 confirmed — nothing needed fixing.
- build round 1: unit 314 passed, browser 169 passed; 0 raised, 0 confirmed.
