# Add the opening talk at /opening-presentation, handing over to the product talk

## What this changes
A third deck, given first: Andy's ten-minute welcome to the NAM 2026 conference exercise on why the day is shaped as
it is. Where everyone is today (an uneven AI journey, work run serially and
babysat, no connected way of working), the familiar pattern any transformation
follows, the two lessons — shared context as markdown in version control, and
parallel workflows as the leap in engineering — the takeaway, and the day's plan
(two labs, lunch, teams). It ends on the frame the product talk opens with and
hands over to it, as the product talk does to the engineering one.

## Where
- `src/components/presentation/opening/` — `opening.jsx` (scenes and chapters),
  `chapters.js`; built from the shared kit and the product kit.
- `src/pages/OpeningPresentationPage.jsx`, a route in `src/App.jsx`.
- `src/components/UserSwitcher.jsx` — first in `TALKS`; `README.md` *Watch* list.
- `context/engineering-context/ui.md`, `architecture.md` — three talks, not two.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| the deck opens full screen on its title, with no app chrome | `presentation.spec.js` | spec |
| every beat between the title and the hand-off has a caption, without page errors | `presentation.spec.js` | spec |
| the hand-off button and → go to `/product-presentation` | `presentation.spec.js` | spec |
| the attendee menu links to all three talks | `presentation.spec.js` | spec |
| every beat fits the 1600×900 stage | screenshots of all 12 beats | visual |

## Decisions
- The words are Andy's script; the deck states nothing about the harness that
  it does not do. Confluence and Glean are named only as Andy's own aside.
- The product and engineering decks are unchanged: the opening is optional, and
  either of them can still be given on its own.
