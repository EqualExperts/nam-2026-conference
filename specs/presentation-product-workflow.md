# The product presentation teaches the workflow first, then the skills

## What this changes
`/product-presentation` used to open on the five winnow steps. It now explains the
workflow those steps implement before it shows any skill:

1. **The project context** — a title slide, then indexed files an agent reads by the piece.
2. **The two-fold trick** — frame every decision on the context; keep the context
   current as information comes in. Information then flows one way: new information →
   distil → remember (the context) or raise (the tracker). It is not a loop.
3. **Context and tasks** — the context is the project today; the tracker also holds
   the past and the roadmap. Different goals, each shaping the other.
4. **A chapter slide** — from the workflow to one sample implementation of it.
5. **The skills as one possibility** — three skills; use them, adapt them or build your own.

The skills are then built from the bottom: `create-tasks`, `update-context` (each with
a *by hand / with the skill* comparison), `winnow` over a transcript in any format
calling both, the whole flow, a demo cue, and the unchanged hand-off to the
engineering talk.

## Second pass: a lighter talk
The audience will use the skills, not write them, so the talk drops mechanics:

- **`listen-to-meeting` is gone** from the talk — its two chapters, the live "door",
  the flag/gap slides and every mention. Whisper, chunks and channels go with it.
- `create-tasks` keeps only its comparison slide (the search and the ticket are gone),
  and `winnow` loses the question-by-question and agree-before-writing chapters.
- `update-context` keeps only its comparison slide too (the doc-edit slide is gone).
- The hand-off's recap beat is gone; the talk ends on "Over to Jonas".
- Noise lines in the Distil scene fall into the *Noise* bucket, as in the next slide,
  instead of leaving the stage.
- The two-fold trick's two beats differ by colour, a large arrow and a lit box, not
  just by text.
- A beat can be a `hero`: its caption is the slide, set large in the middle. Used
  for the context title and the chapter slide. The skill comparison slides carry the
  skill's name large inside the scene.

## Where
`src/components/presentation/product/` — `workflow.jsx` (context, trick, tracking,
chapter slide, skills), `chapters.js` (order), `raise.jsx` (`CREATE_TASKS`,
`UPDATE_CONTEXT`, `HANDOFF`), `winnow.jsx`, `intro.jsx` (`PRODUCT_FLOW`), `kit.jsx`
(`Versus`, `SkillHead`, `StepRail`); `Deck.jsx` for the `hero` caption. `listen.jsx` is deleted.

## Done when
- The talk is 24 beats and every beat between the title and the hand-off is captioned.
- Nothing in the talk mentions `listen-to-meeting`, live listening, or Me/Others channels.
- Every line of the Distil scene ends inside a bucket, noise included.
- `tests/presentation.spec.js` passes.

## Decisions
- **The by-hand comparisons restate what the skills' own instructions do** (duplicate
  search, one goal per ticket, integrate-never-append, doc-map placement).
- The Versus slides lose their footers, which described how the skills find the
  template and the doc map: detail for people who build skills.
- No issue for this change; the spec is named by slug, as the engineering talk's is.
