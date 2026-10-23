# 24 — Show how full a session is on its card in the schedule

## What this changes

An attendee scanning `/schedule?view=list` can see, without opening anything,
how much room is left in each session. Every standard session card now carries
a seat count in its footer: `142 seats left` normally, the same in amber once it
is down to the last ten, and a filled rose **Full** pill — with the queue length
beside it, as today — when there is nothing left to take. Today the card is
silent above ten seats, so "plenty of room" and "I have not loaded yet" look the
same, and the only way to find out is to spend a click.

The keynote `feature` cards keep their existing hero strip (`3,200 seats`) and
show nothing extra — that treatment is already theirs.

## Where

- `src/components/SessionCard.jsx` — the footer's seat indicator. It already
  reads live counts from the store (`seatsFor`) and falls back to the payload,
  so this is the rendering rule only: always show the number, promote *full* to
  a pill, hide the whole thing on `feature` cards. Gets `data-testid="card-seats"`.
- `tests/schedule.spec.js` — the proof, plus a `schedule.seats` lane in
  `tests/helpers.js`.

## How it will be proved

Playwright, `tests/schedule.spec.js` — this is a rendering rule with no pure
function under it, and "visibly distinct" only exists in a browser. One test
opens the list view and asserts both halves of the ticket on real cards: a
session with room shows `N seats left` and no *Full*, and a seeded sold-out
session shows *Full* on its own card. It reads which sessions those are from
`/api/sessions` and books nothing, so it needs no cleanup.

It asserts the *shape* of the count rather than a specific number: seat counts
are global, so a test running in another lane can legitimately move the number
between the fetch and the render.

## Decisions

- **No capacity limit.** `sessions.capacity` is `INTEGER NOT NULL` and is always
  copied from the room, so no such session exists in this data. The card guards
  for it anyway — a falsy capacity renders no indicator rather than the "Full"
  that `seatsLeft === 0` would otherwise produce.
- **Full is a pill, not a colour.** "Visibly distinct, not just a different
  number" has to survive a colour-blind reader, so *full* changes the word, the
  weight and the shape, not only the hue.

## Out of scope

The session detail page, the grid view, the compact `row` variant, and anything
touching how seats are reserved or what the API returns.
