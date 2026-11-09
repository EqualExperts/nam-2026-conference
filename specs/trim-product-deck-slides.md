# Trim two slides from the product talk

The product presentation (`/product-presentation`) loses two slides that the
presenters do not need. Slides are counted as the page counts them, 1-based, as
`?beat=` does.

| Slide | Title | Where it lived |
|---|---|---|
| 20 | Noise, knowledge, actionable work — or both | second beat of the Distil chapter (`winnow.jsx`) |
| 22 | From a transcript, or from one line | second beat of the whole-flow chapter (`intro.jsx`) |

The talk goes from 24 slides to 22. Distil now ends on the slide where the
transcript's lines are tossed into the buckets, and the whole-flow chapter ends
on "Distil → Remember · Raise", which leads straight into the live demo.

## What goes with them

The code that only those two slides drew: the full-size bucket layout, the two
doors diagram, and the `STEP_CX` export the doors used.

## Out of scope

No change to any other slide, to the engineering talk, or to the deck's
behaviour. Later slides move up by one or two numbers, so any `?beat=` link past
slide 19 points at a different slide.
