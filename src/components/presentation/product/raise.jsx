import { motion } from 'motion/react';
import { at, Show, Replay, Code, Kicker, Terminal, Tick, IssueCard, IssueIcon, Token, later } from '../kit.jsx';
import { box } from './kit.jsx';
import { Field } from './intro.jsx';
import { ISSUE_140 } from '../issue.js';

/* ------------------------------------------------------------------ *
 * Remember — update-context places the knowledge by the doc map, and
 * rewrites the passage it belongs in rather than appending to it.
 * ------------------------------------------------------------------ */

const DOC_MAP = [
  { doc: 'CLAUDE.md', what: 'decisions, and why' },
  { doc: 'docs/context/testing.md', what: 'how a change is proved — the viewports the specs run at', hit: true },
  { doc: 'docs/context/ui.md', what: 'UI conventions' },
  { doc: 'docs/context/schedule.md', what: 'where the schedule lives' },
];

/* The Browser paragraph of testing.md, with the new sentence set into it. */
const BEFORE = 'projects desktop (1440×900) and mobile (a Chromium Pixel 7';
const NEW = 'at an iPhone 15’s 393×659 viewport — the Pixel’s own 839px is ~180px taller than a current iPhone, so “fits on a phone” passed there and failed on attendees’ phones';
const AFTER = '), baseURL from WEB_PORT, outputDir from PW_OUTPUT_DIR, traces kept on failure.';
const WRITE_AT = 1600;

/** The new text, with the space that separates it from what was there. */
function Inserted({ written }) {
  return (
    <>
      {' '}
      <span className="rounded bg-emerald-500/15 px-1 text-emerald-100">
        {written
          ? NEW.split(' ').map((w, i) => <span key={i} className="pz-appear" style={later(WRITE_AT + i * 55)}>{w}{i < NEW.split(' ').length - 1 ? ' ' : ''}</span>)
          : NEW}
      </span>
    </>
  );
}

function RememberScene() {
  return (
    <>
      <Show from="left" style={at(80, 70, 460, 540)} className={`${box} flex flex-col p-6`}>
        <Kicker>The doc map says where it goes</Kicker>
        <div className="mt-4 space-y-2.5">
          {DOC_MAP.map((d, i) => (
            <div key={d.doc} className={`pz-appear rounded-xl border px-4 py-3 transition-all duration-500 ${d.hit ? 'pz-glow border-emerald-400/60 bg-raised' : 'border-hairline'}`} style={later(300 + i * 160)}>
              <div className={`font-mono text-[15px] ${d.hit ? 'text-emerald-200' : 'text-ink'}`}>{d.doc}</div>
              <div className="text-[14px] text-faint">{d.what}</div>
            </div>
          ))}
        </div>
        <div className="pz-appear mt-auto space-y-1.5 text-[15px] text-muted" style={later(1400)}>
          <div><Tick className="size-5 text-[11px]" /> integrate, never append</div>
          <div><Tick className="size-5 text-[11px]" /> present state only — no “as of today”</div>
          <div><Tick className="size-5 text-[11px]" /> keep why the other option was rejected</div>
        </div>
      </Show>

      <Show from="right" delay={600} style={at(580, 70, 940, 400)} className="overflow-hidden rounded-2xl border border-hairline bg-[#0d0f15]">
        <div className="flex border-b border-hairline bg-surface font-mono text-[13px]">
          <span className="border-r border-hairline bg-[#0d0f15] px-4 py-2 text-ink">docs/context/testing.md</span>
          <span className="px-4 py-2 text-faint">Browser</span>
        </div>
        <div className="px-6 py-5 font-mono text-[16px] leading-relaxed text-muted">
          <span className="text-faint">`playwright.config.js`: `testMatch`, `fullyParallel`, </span>
          {BEFORE}
          {/* written in, a word at a time */}
          <Inserted written />
          {AFTER}
        </div>
        <div className="pz-appear border-t border-hairline px-6 py-3 text-[15px] text-muted" style={later(WRITE_AT + 1700)}>
          Set into the sentence that already described the viewport — not a bullet on the end. The <b className="text-ink">reason the Pixel’s own height was rejected</b> stays, so nobody puts it back.
        </div>
      </Show>

      <Show from="up" delay={3400} style={at(580, 500, 940, 110)} className={`${box} flex items-center gap-5 px-6`}>
        <Code className="shrink-0 whitespace-nowrap">git status</Code>
        <span className="shrink-0 whitespace-nowrap font-mono text-[16px] text-amber-300">M docs/context/testing.md</span>
        <span className="ml-auto text-[17px] text-muted">the edit shows up in git status — <b className="text-ink">the diff is yours to review</b> before it becomes the team’s memory</span>
      </Show>
    </>
  );
}

const REMEMBER_BEATS = [
  {
    kicker: '8 · Remember',
    title: 'What the team now knows goes where agents read it',
    body: 'update-context finds the doc the map says owns this knowledge and rewrites the passage so it reads as one sitting’s work. Present state only, rejected reason kept — the edit shows up in git status for you to review.',
  },
];

/* ------------------------------------------------------------------ *
 * Raise — create-tasks searches first, then writes the ticket.
 * ------------------------------------------------------------------ */

/* gh issue create runs on the right while the ticket assembles on the left, field by field, in step */
const FIELD_AT = { title: 500, why: 900, what: 1300, done: 1800, scope: 2800, created: 3200 };

function RaiseScene({ step }) {
  return (
    <>
      {/* beat 0: the search */}
      <Replay on={step === 0} from="left" style={at(80, 70, 880, 540)}>
        <Terminal
          title="claude — create-tasks"
          className="h-full"
          bodyClass="text-[16px]"
          lines={[
            { t: 'gh issue list --state all --search "schedule mobile filters"', tone: 'cmd' },
            { t: '#131  Grid view scrolls sideways on narrow screens      closed · 12 days ago', tone: 'dim', delay: 2200 },
            { t: '#98   Filters live in the URL                            closed', tone: 'dim', delay: 2500 },
            { t: '#117  Speaker socials show the handle, never a link     closed', tone: 'dim', delay: 2800 },
            { t: 'read all three — different goals. No near-duplicate.', tone: 'ok', delay: 3600 },
            { t: 'target: origin — your fork, never upstream', delay: 4300 },
            { t: 'gh issue create --title "Keep sessions in view on mobile: …"', tone: 'cmd', delay: 5000 },
          ]}
        />
      </Replay>
      <Show on={step === 0} from="right" delay={800} style={at(1000, 70, 520, 350)} className={`${box} p-6`}>
        <Kicker>Had one been close</Kicker>
        <div className="mt-3 space-y-2">
          {[
            ['Fold it in', 'update the existing ticket — recommended, nothing new is thrown away', true],
            ['Drop it', 'leave the existing ticket as it is'],
            ['Create anyway', 'a separate ticket, on purpose'],
          ].map(([h, s, rec], i) => (
            <div key={h} className={`pz-appear rounded-lg border px-4 py-2.5 ${rec ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-hairline'}`} style={later(300 + i * 200)}>
              <div className={`text-[17px] font-semibold ${rec ? 'text-emerald-200' : 'text-ink'}`}>{h}</div>
              <div className="text-[14px] text-muted">{s}</div>
            </div>
          ))}
        </div>
      </Show>
      <Show on={step === 0} from="right" delay={1200} style={at(1000, 450, 520, 160)} className={`${box} p-6`}>
        <Kicker>One goal per ticket</Kicker>
        <div className="mt-2 text-[16px] text-muted">A candidate carrying two goals is split — the split confirmed with you first. Present tense, no history of how the ticket got here.</div>
      </Show>

      {/* beat 1: the ticket */}
      <Replay on={step === 1}>
        <div className="pz-arrive" style={at(80, 70, 980, 540)}>
          <IssueCard number={ISSUE_140.number} title={<span className="pz-appear inline" style={later(FIELD_AT.title)}>{ISSUE_140.title}</span>} className="h-full">
            <div className="px-7 py-4 text-[16px] leading-relaxed text-muted">
              <p className="pz-appear" style={later(FIELD_AT.why)}><b className="text-ink">Why:</b> {ISSUE_140.why}</p>
              <p className="pz-appear mt-2" style={later(FIELD_AT.what)}><b className="text-ink">What:</b> {ISSUE_140.what}</p>
              <div className="mt-3 font-display text-[21px] text-ink">Done when</div>
              <ul className="mt-1.5 space-y-2">
                {ISSUE_140.doneWhen.map((d, i) => (
                  <Show key={d} as="li" from="left" delay={FIELD_AT.done + i * 300} className="flex gap-3">
                    <span className="mt-1 size-[18px] shrink-0 rounded border-2 border-violet-400/70" />
                    <span className="text-ink/90">{d}</span>
                  </Show>
                ))}
              </ul>
              <p className="pz-appear mt-3 text-[15px]" style={later(FIELD_AT.scope)}><b className="text-ink">Out of scope:</b> {ISSUE_140.outOfScope}</p>
            </div>
          </IssueCard>
        </div>
      </Replay>
      <Replay on={step === 1} from="right" style={at(1100, 70, 420, 320)}>
        <Terminal
          title="claude — create-tasks"
          className="h-full"
          bodyClass="text-[14px]"
          lines={[
            { t: 'gh issue create', tone: 'cmd' },
            { t: '# gh default → your fork (origin)', tone: 'dim', delay: 300 },
            { t: 'title      ✓ outcome, one goal', tone: 'dim', delay: FIELD_AT.title },
            { t: 'Why        ✓ from 00:06:20, Me', tone: 'dim', delay: FIELD_AT.why },
            { t: 'What       ✓ present tense', tone: 'dim', delay: FIELD_AT.what },
            { t: 'Done when  ✓ ✓ ✓ one outcome per line', tone: 'dim', delay: FIELD_AT.done + 600 },
            { t: 'Out of scope ✓ the unowned call', tone: 'dim', delay: FIELD_AT.scope },
            { t: 'created · issues/140', tone: 'ok', delay: FIELD_AT.created },
          ]}
        />
      </Replay>
      <Show on={step === 1} from="pop" delay={FIELD_AT.created} style={at(1100, 410, 420, 200)} className={`${box} flex flex-col items-center justify-center gap-3 p-6 text-center`}>
        <div className="font-mono text-[15px] text-emerald-300">#140 — on origin, never upstream</div>
        <Token className="relative" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: (FIELD_AT.created + 400) / 1000 }} />
        <div className="text-[15px] text-muted">The character the rest of the day follows.</div>
      </Show>
    </>
  );
}

const RAISE_BEATS = [
  {
    kicker: '9 · Raise',
    title: 'Search the tracker first: open and recently closed',
    body: 'A near-duplicate is offered three ways — fold in, drop, or create anyway — fold-in recommended, since dropping throws away what the new one learned. Tickets go to the fork’s own issues: origin, never upstream.',
  },
  {
    kicker: '9 · #140',
    title: 'Title, why, what, and a Done when a test can check',
    body: 'One goal. Present tense. Each Done when line is an outcome, one per line, and each traces back to something said in the room or already in the context. This is the ticket the engineering harness picks up next.',
  },
];

/* ------------------------------------------------------------------ *
 * Hand-off — what the meeting produced, then the frame the engineering
 * talk opens on: its title's layout, with the orbits where its own sit.
 * ------------------------------------------------------------------ */

const RECAP_AT = 700;

function HandoffScene({ step, leaving, advance }) {
  return (
    <>
      {/* beat 0: the recap — the issue in one row, the one line of memory, the five steps */}
      <Show on={step === 0} from="up" style={at(80, 70, 1440, 100)} className={`${box} flex items-center gap-5 px-7`}>
        <IssueIcon className="size-7 shrink-0 text-emerald-400" />
        <span className="font-display text-[26px] leading-tight text-ink">{ISSUE_140.title}</span>
        <span className="ml-auto shrink-0 font-mono text-[15px] text-muted">why · what · Done when ×3 · out of scope</span>
        <Token className="relative shrink-0" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1.3, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.4 }} />
      </Show>
      <Show on={step === 0} from="up" delay={RECAP_AT} style={at(80, 200, 1440, 200)} className="overflow-hidden rounded-2xl border border-hairline bg-[#0d0f15]">
        <div className="flex items-center border-b border-hairline bg-surface font-mono text-[13px]">
          <span className="border-r border-hairline bg-[#0d0f15] px-4 py-2 text-ink">docs/context/testing.md</span>
          <span className="px-4 py-2 text-faint">Browser</span>
          <span className="ml-auto px-4 py-2 text-amber-300">M · in git status, for you to review</span>
        </div>
        <div className="px-6 py-4 font-mono text-[16px] leading-relaxed text-muted">
          … {BEFORE}<Inserted />{AFTER}
        </div>
        <div className="px-6 pb-4 text-[15px] text-muted">One line the team now knows — placed where the next agent reads it, by the doc map.</div>
      </Show>
      <Show on={step === 0} from="up" delay={RECAP_AT + 500} style={at(80, 440, 1440, 150)} className="grid grid-cols-5 gap-5">
        {[['🎙️', 'Listen', '41 chunks, 2 flags'], ['📝', 'Transcribe', 'on the laptop'], ['🌾', 'Distil', '9 lines → 4 buckets'], ['🧠', 'Remember', 'testing.md'], ['🎫', 'Raise', '#140']].map(([icon, l, s], i) => (
          <div key={l} className={`${box} pz-appear flex items-center gap-3 px-5 py-3`} style={later(i * 120)}>
            <span className="text-[26px]">{icon}</span>
            <div><div className="text-[17px] font-semibold text-ink">{l}</div><div className="text-[13px] text-faint">{s}</div></div>
            <Tick className="ml-auto size-6 text-[12px]" />
          </div>
        ))}
      </Show>

      {/* beat 1: over to the engineering harness — laid out like its title, orbits in the same place, so the warp lands on them */}
      <Show on={step === 1} from="none" delay={200} style={at(0, 0, 1600, 900)} className="pointer-events-none">
        <Field />
      </Show>
      <Show on={step === 1} from="scale" style={at(0, 0, 1600, 900)}>
        <motion.div
          className="absolute inset-0"
          animate={leaving ? { scale: 2.6, opacity: 0, filter: 'blur(14px)' } : { scale: 1, opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.85, ease: [0.65, 0, 0.35, 1] }}
          style={{ transformOrigin: '50% 45%' }}
        >
          <div style={at(110, 130, 820, 480)} className="flex flex-col items-start">
            <div className="space-y-1.5 whitespace-nowrap text-[22px]">
              <div className="flex items-center gap-3 text-muted"><Tick /> 🎙️ Product harness: a conversation → a ticket</div>
              <div className="pz-appear text-ink" style={later(500)}><span className="mr-3 text-violet-300">↳</span>🚢 <b>Engineering harness</b>: the ticket → a reviewed pull request</div>
            </div>
            <div className="mt-12 pl-2">
              <Token className="relative" initial={{ scale: 0.5, opacity: 0, y: 40 }} animate={{ scale: 2.4, opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 140, damping: 13, delay: 0.5 }} style={{ transformOrigin: '0 50%' }} />
            </div>
            <div className="pz-appear mt-10 font-display text-[64px] leading-none text-ink" style={later(700)}>
              Over to <span className="pz-shine bg-clip-text text-transparent">Jonas</span>.
            </div>
            <button
              type="button"
              data-testid="presentation-handoff"
              aria-label="Continue to the engineering harness"
              onClick={(e) => { e.stopPropagation(); advance(); }}
              className="pz-launch pz-pop mt-9 inline-flex items-center gap-3 rounded-full border border-cyan-300/60 bg-gradient-to-r from-violet-600 to-cyan-500 px-10 py-4 font-display text-[28px] text-white hover:from-violet-500 hover:to-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
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

const HANDOFF_BEATS = [
  {
    kicker: '10 · What the meeting produced',
    title: 'A meeting became a ticket — and one line of memory',
    body: 'Issue #140, with a why and three Done when lines, and one sentence in docs/context/testing.md the next agent will read. Nothing ran without someone saying yes. What happens to #140 next is the engineering harness.',
  },
  null,
];

export const RAISE = [
  { id: 'remember', name: 'Remember', accent: 'text-emerald-300', tone: 'emerald', beats: REMEMBER_BEATS, Scene: RememberScene },
  { id: 'raise', name: 'Raise', accent: 'text-violet-300', tone: 'violet', beats: RAISE_BEATS, Scene: RaiseScene },
  { id: 'handoff', name: 'Over to the engineering harness', accent: 'text-violet-300', tone: 'violet', beats: HANDOFF_BEATS, Scene: HandoffScene },
];
