import { motion } from 'motion/react';
import { at, Show, Tick, Token, later } from '../kit.jsx';
import { Versus, SkillHead } from './kit.jsx';
import { Field } from './intro.jsx';

/* ------------------------------------------------------------------ *
 * Remember — update-context, by hand and with the skill.
 * ------------------------------------------------------------------ */

const UPDATE_ROWS = [
  ['Append a sentence to the end of whichever doc is open', 'The doc map says which doc owns it; if that is unclear, it asks'],
  ['The old statement stays beside the new one', 'The passage is rewritten as present state — superseded text goes'],
  ['A new fact quietly contradicts a doc', 'A conflict with what the doc says is flagged, not guessed'],
  ['“We dropped X” — and nobody remembers why', 'The reason an option was rejected is kept, as a present-tense fact'],
];

function RememberAll() {
  return (
    <>
      <Show from="up" style={at(80, 60, 1440, 100)}><SkillHead icon="🧠" cmd="update-context" line="Keeps the project context up to date" /></Show>
      <Show from="up" delay={200} style={at(80, 190, 1440, 420)}><Versus rows={UPDATE_ROWS} delay={500} /></Show>
    </>
  );
}

const REMEMBER_BEATS = [
  {
    kicker: 'update-context',
    title: 'Why not just edit the docs yourself?',
    body: 'You can — and a small edit by hand is fine. Repeated by hand, it is how a context rots into a pile of bolted-on sentences. The skill does the part people skip: place, integrate, supersede.',
  },
];

/* ------------------------------------------------------------------ *
 * Raise — create-tasks, by hand and with the skill.
 * ------------------------------------------------------------------ */

const RAISE_ROWS = [
  ['A title and “make it work”, written from memory', 'Why first, then what, then a Done when a test could check'],
  ['A near-duplicate found when someone stumbles on it', 'Searches open and recently closed tickets first — then fold in, drop, or create anyway'],
  ['Two goals in one ticket', 'One goal per ticket — a split is confirmed with you first'],
  ['The ticket narrates its own history', 'Present requirement only; what was weighed goes in a comment'],
];

function RaiseAll() {
  return (
    <>
      <Show from="up" style={at(80, 60, 1440, 100)}><SkillHead icon="🎫" cmd="create-tasks" line="Raises the work as a ticket an agent can build" /></Show>
      <Show from="up" delay={200} style={at(80, 190, 1440, 420)}><Versus rows={RAISE_ROWS} delay={500} /></Show>
    </>
  );
}

const RAISE_BEATS = [
  {
    kicker: 'create-tasks',
    title: 'Why not just write the ticket yourself?',
    body: 'You can. But a ticket from memory skips the why, misses the duplicate and bundles two goals. The skill is the checklist you would follow on a good day, followed on every day.',
  },
];

/* ------------------------------------------------------------------ *
 * Hand-off — the frame the engineering talk opens on: its title's layout,
 * with the orbits where its own sit.
 * ------------------------------------------------------------------ */

function HandoffScene({ leaving, advance }) {
  return (
    <>
      {/* over to the engineering harness — laid out like its title, orbits in the same place, so the warp lands on them */}
      <Show from="none" delay={200} style={at(0, 0, 1600, 900)} className="pointer-events-none">
        <Field />
      </Show>
      <Show from="scale" style={at(0, 0, 1600, 900)}>
        <motion.div
          className="absolute inset-0"
          animate={leaving ? { scale: 2.6, opacity: 0, filter: 'blur(14px)' } : { scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.85, ease: [0.65, 0, 0.35, 1] }}
          style={{ transformOrigin: '50% 45%' }}
        >
          <div style={at(110, 130, 820, 480)} className="flex flex-col items-start">
            <div data-eyebrow className="mb-4 text-[18px] font-semibold uppercase tracking-[0.2em] text-edge">Handing over</div>
            <div className="space-y-1.5 whitespace-nowrap text-[22px]">
              <div className="flex items-center gap-3 text-muted"><Tick /> 🎙️ Product harness: a conversation → a ticket</div>
              <div className="pz-appear text-ink" style={later(500)}><span className="mr-3 text-blue-300">↳</span>🚢 <b>Engineering harness</b>: the ticket → a reviewed pull request</div>
            </div>
            <div className="mt-12 pl-2">
              <Token className="relative" initial={{ scale: 0.5, opacity: 0, y: 40 }} animate={{ scale: 2.4, opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 140, damping: 13, delay: 0.5 }} style={{ transformOrigin: '0 50%' }} />
            </div>
            <div data-deck-title className="pz-appear mt-10 font-display text-[64px] font-bold leading-none text-ink" style={later(700)}>
              Over to <span className="pz-shine bg-clip-text text-transparent">Jonas</span>.
            </div>
            <button
              type="button"
              data-testid="presentation-handoff"
              aria-label="Continue to the engineering harness"
              onClick={(e) => { e.stopPropagation(); advance(); }}
              className="pz-launch pz-pop mt-9 inline-flex items-center gap-3 rounded-full border border-cyan-300/60 bg-gradient-to-r from-blue-600 to-cyan-500 px-10 py-4 font-display text-[28px] text-white hover:from-blue-500 hover:to-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
              style={later(900)}
            >
              Continue to the engineering harness <span aria-hidden="true">→</span>
            </button>
            <div className="pz-appear mt-3 text-[15px] text-faint" style={later(1500)}>or press → as usual — the ticket carries over</div>
          </div>
        </motion.div>
      </Show>
    </>
  );
}

const HANDOFF_BEATS = [null];

export const CREATE_TASKS = [
  { id: 'raise', name: 'create-tasks', accent: 'text-blue-300', tone: 'violet', rail: { lit: ['raise'], commands: true }, beats: RAISE_BEATS, Scene: RaiseAll },
];

export const UPDATE_CONTEXT = [
  { id: 'remember', name: 'update-context', accent: 'text-teal-300', tone: 'emerald', rail: { lit: ['remember'], commands: true }, beats: REMEMBER_BEATS, Scene: RememberAll },
];

export const HANDOFF = [
  { id: 'handoff', name: 'Over to the engineering harness', accent: 'text-blue-300', tone: 'violet', beats: HANDOFF_BEATS, Scene: HandoffScene },
];
