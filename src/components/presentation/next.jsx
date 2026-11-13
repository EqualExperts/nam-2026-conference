import { motion, useReducedMotion } from 'motion/react';
import { at, Show, Replay, Kicker, Code, Terminal, PrIcon, later, ClosingRow } from './kit.jsx';
import { Orbits } from './intro.jsx';

/*
 * Where the harness goes next — the ending for a room of engineers. Evals,
 * then a loop that learns from escaped defects, then the challenge, then
 * lunch. Everything here is a direction, not a feature: what exists today is
 * marked as such, and the numbers are a drawn example, never data.
 */

const box = 'rounded-2xl border border-edge bg-surface';

/** "next · not built yet" — on anything the harness does not do today. */
function NextTag({ className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-dashed border-amber-400/60 px-2.5 py-0.5 font-mono text-[12px] uppercase tracking-wider text-amber-200 ${className}`}>
      next · not built yet
    </span>
  );
}

function TodayTag({ className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-teal-400/50 bg-teal-500/15 px-2.5 py-0.5 font-mono text-[12px] uppercase tracking-wider text-teal-200 ${className}`}>
      today
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * 7 · Who tests the harness? — the same past tickets, two harnesses.
 * ------------------------------------------------------------------ */

// Illustrative: each string is five runs of one past ticket, 1 = passed.
const EVAL_RUNS = [
  [64, '11111', '11111'],
  [65, '11011', '11111'],
  [66, '11111', '11111'],
  [67, '10101', '11101'],
  [68, '11111', '11111'],
  [69, '01110', '11111'],
  [70, '11111', '11111'],
  [71, '00000', '01000'],
];

const passes = (col) => EVAL_RUNS.reduce((n, row) => n + [...row[col]].filter((r) => r === '1').length, 0);
const solid = (col) => EVAL_RUNS.filter((row) => row[col] === '11111').length;
const RUNS = EVAL_RUNS.length * 5;

// Correctness and reliability are read off the grid above; cost and hand-backs
// are drawn. Lower is better for those two, so v2 loses on cost.
const SCORES = [
  { name: 'Correctness', sub: 'runs that pass', v1: passes(1) / RUNS, v2: passes(2) / RUNS, better: 'high' },
  { name: 'Reliability', sub: 'all five runs pass', v1: solid(1) / EVAL_RUNS.length, v2: solid(2) / EVAL_RUNS.length, better: 'high' },
  { name: 'Cost', sub: 'tokens per ticket', v1: 0.42, v2: 0.66, better: 'low' },
  { name: 'Human intervention', sub: 'hand-backs to a person', v1: 0.38, v2: 0.18, better: 'low' },
];

const V1_AT = 300;
const V2_AT = 1700;
const SCORE_AT = 3200;

function Dot({ ok, delay }) {
  return (
    <span
      className={`pz-pop inline-block size-4 rounded-full ${ok ? 'bg-teal-400/90 shadow-[0_0_10px_rgba(93,176,176,0.6)]' : 'bg-rose-400/90 shadow-[0_0_10px_rgba(251,113,133,0.6)]'}`}
      style={later(delay)}
      aria-hidden="true"
    />
  );
}

function EvalScene({ step }) {
  return (
    <Replay on style={at(80, 70, 1440, 540)} className="grid grid-cols-[1fr_470px] gap-6">
      {/* the replay: past tickets × five runs × two harnesses */}
      <div className={`${box} flex flex-col px-7 py-5 transition-opacity duration-700 ${step > 0 ? 'opacity-45' : ''}`}>
        <div className="grid grid-cols-[150px_1fr_1fr] items-end gap-6 border-b border-hairline pb-3">
          <Kicker>Past tickets</Kicker>
          <div>
            <div className="font-display text-[26px] text-blue-200">Ship v1</div>
            <div className="text-[15px] text-muted">today’s harness</div>
          </div>
          <div className="pz-appear" style={later(V2_AT - 300)}>
            <div className="font-display text-[26px] text-sky-200">Ship v2</div>
            <div className="text-[15px] text-muted">new prompts, cheaper gate, one more lens</div>
          </div>
        </div>
        <div className="mt-2 flex-1">
          {EVAL_RUNS.map(([n, a, b], i) => (
            <div key={n} className="grid grid-cols-[150px_1fr_1fr] items-center gap-6 border-b border-hairline/40 py-[9px] last:border-b-0">
              <span className="pz-appear font-mono text-[17px] text-ink" style={later(i * 60)}>#{n}</span>
              <span className="flex gap-2.5">{[...a].map((r, j) => <Dot key={j} ok={r === '1'} delay={V1_AT + i * 110 + j * 35} />)}</span>
              <span className="flex gap-2.5">{[...b].map((r, j) => <Dot key={j} ok={r === '1'} delay={V2_AT + i * 110 + j * 35} />)}</span>
            </div>
          ))}
        </div>
        <div className="pt-2 font-mono text-[14px] text-faint">{EVAL_RUNS.length} past tickets × 5 runs × 2 harnesses · the same inputs, every time</div>
      </div>

      {/* the scorecard */}
      <div className={`pz-appear ${box} flex flex-col px-7 py-5 ${step > 0 ? 'pz-glow border-cyan-400/60' : ''}`} style={later(SCORE_AT)}>
        <div className="flex items-center justify-between">
          <Kicker>Scorecard</Kicker>
          <span className="font-mono text-[12px] uppercase tracking-wider text-faint">illustrative</span>
        </div>
        <div className="mt-4 flex flex-1 flex-col justify-between">
          {SCORES.map((s, i) => {
            const v2wins = s.better === 'high' ? s.v2 > s.v1 : s.v2 < s.v1;
            return (
              <div key={s.name}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[19px] font-semibold text-ink">{s.name}</span>
                  <span className={`font-mono text-[15px] ${v2wins ? 'text-teal-300' : 'text-rose-300'}`}>{v2wins ? '▲ v2' : '▼ v2'}</span>
                </div>
                <div className="text-[13px] text-faint">{s.sub}{s.better === 'low' ? ' · lower is better' : ''}</div>
                <div className="mt-1.5 space-y-1">
                  {[['v1', s.v1, 'bg-blue-400'], ['v2', s.v2, 'bg-sky-400']].map(([who, w, c], k) => (
                    <div key={who} className="flex items-center gap-2">
                      <span className="w-5 font-mono text-[12px] text-faint">{who}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-overlay">
                        <span className={`pz-fill block h-full rounded-full ${c}`} style={{ width: `${w * 100}%`, animationDuration: '0.9s', animationDelay: `${SCORE_AT + 300 + i * 220 + k * 120}ms` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <Show on={step > 0} from="up" className="mt-4 border-t border-hairline pt-3 text-[16px] text-ink">
          v2 is more reliable and costs more. <span className="text-muted">That is now a decision, not a hunch.</span>
        </Show>
      </div>
    </Replay>
  );
}

const EVAL_BEATS = [
  {
    kicker: '7 · Evals · next',
    title: 'Who tests the harness?',
    body: 'We test our code. But who’s testing the AI that writes it? Replay the same past tickets through two versions of ship, five runs each, and compare.',
  },
  {
    kicker: '7 · Evals · next',
    title: 'Stop guessing whether your agents are getting better. Measure it.',
    body: 'A prompt, a model, a gate: every change to the harness is a change to your build system. Benchmark it like one.',
  },
];

/* ------------------------------------------------------------------ *
 * 8 · What happens when AI ships a bug? — the loop that learns.
 * ------------------------------------------------------------------ */

const CX = 800;
const CY = 330;
const RX = 390;
const RY = 215;
const point = (deg) => [CX + RX * Math.cos((deg * Math.PI) / 180), CY + RY * Math.sin((deg * Math.PI) / 180)];

const LOOP = [
  { id: 'ship', deg: -90, icon: '🚢', label: 'Ship', what: 'a ticket becomes a PR', today: 'all of it' },
  { id: 'discover', deg: -18, icon: '🚨', label: 'Discover', what: 'an incident, a missed requirement', today: 'review & QA escapes' },
  { id: 'investigate', deg: 54, icon: '🔎', label: 'Investigate', what: 'trace it to the run that shipped it' },
  { id: 'learn', deg: 126, icon: '📚', label: 'Learn', what: 'a regression case, a harness fix', today: 'a lesson PR per escape' },
  { id: 'prove', deg: 198, icon: '🧪', label: 'Prove', what: 'pass the evals, then a person' },
];

const NODE_W = 310;
const NODE_H = 118;
const LOOP_AT = 200;
const SEG_MS = 380;

/** The ellipse arc from one station to the next, clockwise. */
function arc(from, to) {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M ${x1} ${y1} A ${RX} ${RY} 0 0 1 ${x2} ${y2}`;
}

const RING = `M ${CX} ${CY - RY} A ${RX} ${RY} 0 1 1 ${CX} ${CY + RY} A ${RX} ${RY} 0 1 1 ${CX} ${CY - RY}`;

function LoopScene({ step }) {
  const reduced = useReducedMotion();
  const [lx, ly] = point(126);
  const [px, py] = point(198);
  return (
    <Replay on style={at(0, 0, 1600, 900)}>
      <svg viewBox="0 0 1600 900" style={at(0, 0, 1600, 900)} aria-hidden="true">
        {LOOP.map((s, i) => {
          const next = LOOP[(i + 1) % LOOP.length];
          const d = arc(s.deg, next.deg + (next.deg < s.deg ? 360 : 0));
          const built = s.id === 'ship';
          return (
            <g key={s.id}>
              <path d={d} pathLength="1" className="pz-draw-in" fill="none" stroke={built ? '#1d6fa5' : '#7c5a1e'} strokeWidth="3" style={later(LOOP_AT + i * SEG_MS)} />
              <path d={d} pathLength="1" className="pz-flow" fill="none" stroke={built ? '#93c5fd' : '#fcd34d'} strokeWidth="3" opacity="0.7" />
            </g>
          );
        })}
        {/* into the eval suite, and out of it to Prove */}
        <path d={`M ${lx + 40} ${ly - NODE_H / 2} L ${CX - 60} ${CY + 62}`} pathLength="1" className="pz-draw-in" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="1" style={later(LOOP_AT + 5 * SEG_MS + 400)} />
        <path d={`M ${CX - 125} ${CY + 10} L ${px + NODE_W / 2 + 4} ${py + 8}`} pathLength="1" className="pz-draw-in" fill="none" stroke="#22d3ee" strokeWidth="2" style={later(LOOP_AT + 5 * SEG_MS + 700)} />
        {!reduced && (
          <circle r="8" fill="#fde68a" style={{ filter: 'drop-shadow(0 0 10px rgba(253,230,138,0.9))' }}>
            <animateMotion dur="9s" repeatCount="indefinite" path={RING} />
          </circle>
        )}
      </svg>

      {/* the eval suite from chapter 7, at the centre of the loop */}
      <div
        className="pz-appear absolute flex flex-col items-center justify-center rounded-2xl border border-cyan-400/50 bg-cyan-500/[0.08] text-center shadow-[0_0_60px_-10px_rgba(34,211,238,0.5)]"
        style={{ ...at(CX - 125, CY - 60, 250, 120), ...later(LOOP_AT + 5 * SEG_MS + 200) }}
      >
        <div className="font-display text-[26px] text-ink">🧪 Eval suite</div>
        <div className="text-[14px] text-muted">past tickets + every escape</div>
      </div>

      {LOOP.map((s, i) => {
        const [x, y] = point(s.deg);
        const lit = step > 0 && !s.today;
        return (
          <div
            key={s.id}
            className={`pz-appear absolute rounded-2xl border px-4 py-3 transition-colors duration-500 ${s.today ? 'border-blue-400/50 bg-raised' : 'border-dashed border-amber-400/50 bg-surface'} ${lit ? 'pz-glow' : ''}`}
            style={{ ...at(x - NODE_W / 2, y - NODE_H / 2, NODE_W, NODE_H), ...later(LOOP_AT + i * SEG_MS) }}
          >
            <div className="flex items-center gap-2 text-[21px] font-semibold text-ink">
              <span className="text-[24px]">{s.icon}</span>{i + 1} · {s.label}
            </div>
            <div className="mt-0.5 whitespace-nowrap text-[15px] text-muted">{s.what}</div>
            <Show on={step > 0} from="up" delay={i * 90} className="mt-2">
              {s.today ? <span className="inline-flex items-center gap-2"><TodayTag /><span className="text-[14px] text-teal-200">{s.today}</span></span> : <NextTag />}
            </Show>
          </div>
        );
      })}
    </Replay>
  );
}

const LOOP_BEATS = [
  {
    kicker: '8 · Closed-loop learning · next',
    title: 'What happens when AI ships a bug?',
    body: 'A production failure should make the next run smarter: traced to the run that shipped it, turned into a regression case, and proven on the evals before a person approves the fix.',
  },
  {
    kicker: '8 · Today, and next',
    title: 'Every escaped defect is a chance to improve the system, not just fix the code.',
    body: 'New information changes the context: today a review or QA escape becomes a lesson PR. Production, the trace back and the proof are next.',
  },
];

/* ------------------------------------------------------------------ *
 * 9 · Your move — three ways into the harness.
 * ------------------------------------------------------------------ */

const CHALLENGES = [
  {
    letter: 'A', icon: '🧠', title: 'Make it smarter', ring: 'border-blue-400/50 bg-blue-500/[0.06]', tone: 'text-blue-200',
    ask: 'Find a weakness. Sharpen a gate, change what each agent reads, catch a defect ship misses today.',
    start: ['codeLenses', '.claude/rules/'],
  },
  {
    letter: 'B', icon: '✂️', title: 'Make it leaner', ring: 'border-teal-400/50 bg-teal-500/[0.06]', tone: 'text-teal-200',
    ask: 'Fewer tokens, fewer agent steps, a cheaper model. Same correctness.',
    start: ['TIERS', 'the AI spend comment'],
  },
  {
    letter: 'C', icon: '📊', title: 'Prove it’s better', ring: 'border-cyan-400/50 bg-cyan-500/[0.06]', tone: 'text-cyan-200',
    ask: 'Replay past tickets through the original and your version. Does it hold up across repeated runs?',
    start: ['closed issues', 'their merged PRs'],
  },
];

function ChallengeScene({ step }) {
  return (
    <>
      <Show on={step === 0} style={at(80, 60, 1440, 560)} className="flex flex-col justify-center gap-6">
        <div className="grid grid-cols-3 gap-6">
          {CHALLENGES.map((c, i) => (
            <motion.div
              key={c.letter}
              className={`flex flex-col rounded-2xl border p-7 ${c.ring}`}
              initial={{ opacity: 0, y: 60, rotateX: -25 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 0.2 + i * 0.15, type: 'spring', stiffness: 120, damping: 16 }}
            >
              <div className="flex items-center justify-between">
                <span className={`font-mono text-[15px] uppercase tracking-[0.2em] ${c.tone}`}>Challenge {c.letter}</span>
                <span className="text-[44px]">{c.icon}</span>
              </div>
              <div className="mt-2 font-display text-[38px] leading-tight text-ink">{c.title}</div>
              <div className="mt-3 text-[19px] leading-snug text-muted">{c.ask}</div>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-8 text-[15px] text-faint">
                start at {c.start.map((s) => <Code key={s} className="text-[15px]">{s}</Code>)}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="pz-appear flex items-center gap-3 text-[18px] text-muted" style={later(900)}>
          <Code>.claude/workflows/ship.js</Code> is plain JavaScript — every agent, model, round limit and gate. Read it, then change it.
        </div>
      </Show>

      {/* the question the talk leaves behind */}
      <Show on={step === 1} from="none" delay={300} style={at(0, 0, 1600, 900)} className="pointer-events-none">
        <Orbits style={at(380, 10, 840, 840)} className="opacity-25" />
      </Show>
      <Show on={step === 1} from="scale" style={at(80, 70, 1440, 760)} className="flex flex-col items-center justify-center text-center">
        <Kicker className="mb-6 !text-[22px]">Your move</Kicker>
        <div data-deck-title className="font-display text-[104px] font-bold leading-[0.98] text-ink">
          The harness isn’t finished.<br />
          <span className="pz-shine bg-clip-text text-transparent">What would you change?</span>
        </div>
      </Show>
    </>
  );
}

const CHALLENGE_BEATS = [
  {
    kicker: '9 · Your move',
    title: 'Think you can improve the harness?',
    body: 'Don’t just use AI agents. Engineer the system behind them. Pick one — an invitation, not an assignment.',
  },
  null,
];

/* ------------------------------------------------------------------ *
 * 10 · Plan in waves — slice the work so agents never wait on each other.
 * ------------------------------------------------------------------ */

// Illustrative tickets. One wide change everyone needs, against the same work
// sliced into a small shared piece plus independent tickets. Numbered after
// #140, never #1 — a fresh fork's #1 is the issue the room ships at lunch.
const BLOCKED = ['Schedule', 'Speakers', 'Sessions', 'Search', 'Expo', 'Export'];

const WAVE_1 = [
  [151, 'Track filter'],
  [152, 'Speaker bios'],
  [153, 'Sponsor tiers'],
  [154, 'Session reminders'],
  [155, 'Empty states'],
];
const WAVE_2 = [
  [156, 'Filter the schedule'],
  [157, 'Filter the speakers'],
  [158, 'Filter the expo'],
];

const WAVE_AT = 900;

function WaveRow({ n, title, at: delay, dur, depends, shared }) {
  return (
    <div className="pz-appear grid grid-cols-[230px_1fr] items-center gap-4" style={later(delay)}>
      <div className="min-w-0">
        <div className="truncate text-[18px] text-ink"><span className="font-mono text-faint">#{n}</span> {title}</div>
        {depends && <div className="font-mono text-[13px] text-sky-300">Depends on #151</div>}
        {shared && <div className="font-mono text-[13px] text-teal-300">shared · small · first</div>}
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-overlay">
        <span className="pz-fill block h-full w-full rounded-full bg-gradient-to-r from-blue-500 to-teal-300" style={{ animationDuration: `${dur}ms`, animationDelay: `${delay + 200}ms` }} />
      </div>
    </div>
  );
}

function WavesScene() {
  return (
    <Replay on style={at(80, 90, 1440, 500)} className="grid grid-cols-[520px_1fr] gap-6">
      {/* sliced badly: one wide change, everyone waits */}
      <div className="flex flex-col rounded-2xl border border-rose-400/40 bg-rose-500/[0.05] px-7 py-6">
        <Kicker className="text-rose-300">One wide change</Kicker>
        <div className="pz-appear mt-4 rounded-xl border border-rose-400/50 bg-raised px-4 py-3 text-[19px] text-ink" style={later(150)}>
          <span className="font-mono text-faint">#150</span> Filter everything by track
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-overlay">
            <span className="pz-fill block h-full w-[35%] rounded-full bg-rose-400" style={{ animationDuration: '2600ms', animationDelay: '400ms' }} />
          </div>
        </div>
        <div className="mx-auto h-6 w-px bg-rose-400/40" />
        <div className="grid grid-cols-2 gap-2.5">
          {BLOCKED.map((t, i) => (
            <div key={t} className="pz-appear flex items-center justify-between rounded-lg border border-dashed border-amber-400/50 px-3 py-3.5 text-[16px] text-muted" style={later(500 + i * 90)}>
              {t}<span className="font-mono text-[12px] text-amber-300">⏳ waits on #150</span>
            </div>
          ))}
        </div>
        <div className="mt-auto pt-4 text-[17px] text-muted">Six agents idle until one big pull request lands — and then they all conflict with it.</div>
      </div>

      {/* sliced in waves: a small shared piece, everything else in parallel */}
      <div className="flex flex-col rounded-2xl border border-teal-400/40 bg-teal-500/[0.05] px-7 py-6">
        <Kicker className="text-teal-300">Sliced into waves</Kicker>
        <div className="mt-4 grid flex-1 grid-cols-2 gap-8">
          <div className="flex flex-col gap-5">
            <div className="font-display text-[24px] text-ink">☕ Wave 1 · while you’re away</div>
            {WAVE_1.map(([n, t], i) => <WaveRow key={n} n={n} title={t} shared={i === 0} at={WAVE_AT + i * 120} dur={1800 + ((i * 7) % 4) * 350} />)}
          </div>
          <div className="flex flex-col gap-5">
            <div className="pz-appear font-display text-[24px] text-ink" style={later(WAVE_AT + 2600)}>🌙 Wave 2 · overnight</div>
            {WAVE_2.map(([n, t], i) => <WaveRow key={n} n={n} title={t} depends at={WAVE_AT + 2800 + i * 120} dur={1600 + i * 300} />)}
          </div>
        </div>
        <div className="pz-appear pt-4 text-[17px] text-muted" style={later(WAVE_AT + 4200)}>
          The shared piece is small and goes first. What truly depends on it says <Code>Depends on</Code>, and ship stacks it.
        </div>
      </div>
    </Replay>
  );
}

const WAVES_BEATS = [
  {
    kicker: '10 · The unlock · ship in waves',
    title: 'Your agents work while you are away from the laptop',
    body: 'Do the thinking up front: tickets ready, sliced so nothing waits on one global change. Then let them run in parallel, wave after wave — through a meeting, over lunch, overnight.',
  },
];

/* ------------------------------------------------------------------ *
 * 11 · Before lunch — start a ship, come back to a pull request.
 * ------------------------------------------------------------------ */

const LUNCH_LINES = [
  { t: 'ship the issue in my fork', tone: 'cmd' },
  { t: 'Which run?', tone: 'out', delay: 1500 },
  { t: '› Fast — for the workshop', tone: 'hi', delay: 1800 },
  { t: '\u00a0\u00a0Sized — let ship decide', tone: 'dim', delay: 1950 },
  { t: '\u00a0\u00a0Small', tone: 'dim', delay: 2100 },
  { t: '\u00a0\u00a0Full — best quality, the slowest', tone: 'dim', delay: 2250 },
  { t: '🚢 the plan is ready · the tests are running', tone: 'ok', delay: 3300 },
  { t: 'running in the background — go eat', tone: 'dim', delay: 4100 },
];

const LUNCH_TIMELINE = [
  { icon: '✓', title: 'Now: it’s running', sub: 'see the plan land before you get up', tone: 'border-teal-400/60 text-teal-300' },
  { icon: '🍽️', title: 'Lunch', sub: 'nothing to watch', tone: 'border-hairline text-ink' },
  { icon: <PrIcon className="size-5" />, title: 'After: a pull request', sub: 'read it, then Squash and merge', tone: 'border-blue-400/60 text-blue-300' },
];

function LunchScene() {
  return (
    <>
      <Show on from="up" style={at(80, 60, 1440, 190)}>
        <Kicker className="text-teal-300">11 · Before lunch</Kicker>
        <div data-deck-title className="mt-3 font-display text-[60px] font-bold leading-[1] text-ink">
          Start a ship. <span className="pz-shine bg-clip-text text-transparent">Come back to a pull request.</span>
        </div>
      </Show>

      <Show on from="left" delay={200} style={at(80, 235, 820, 380)} className="flex flex-col gap-3">
        <div className="text-[18px] text-muted">
          Just one today: the issue in your fork. In <b className="text-ink">Claude Code</b>, or the <b className="text-ink">Code</b> tab of Claude Desktop:
        </div>
        <Terminal title="claude — nam-2026-conference" lines={LUNCH_LINES} className="flex-1" />
      </Show>

      <Show on from="up" delay={900} style={at(0, 0, 1600, 900)} className="pointer-events-none">
        <ClosingRow y={635} width={1440} cards={LUNCH_TIMELINE} />
      </Show>

      <Show on from="up" delay={700} style={at(80, 765, 1440, 100)} className="flex flex-col gap-2 border-t border-hairline pt-3">
        <div className="text-[18px] text-muted">
          Not set up yet? Paste the setup prompt from the README into Claude. Then, after lunch, pick a challenge.
        </div>
        <div className="flex items-baseline justify-between gap-6">
          <span className="font-mono text-[18px] text-ink">github.com/EqualExperts/nam-2026-conference</span>
          <span className="text-[15px] text-faint">The ship loop is Andy Vays’s design · built by Jonas Claesson and Abraham Marín Pérez at Equal Experts</span>
        </div>
      </Show>
    </>
  );
}

export const NEXT = [
  { id: 'evals', name: 'Who tests the harness?', accent: 'text-cyan-300', tone: 'cyan', beats: EVAL_BEATS, Scene: EvalScene },
  { id: 'learning', name: 'Learning from escapes', accent: 'text-amber-300', tone: 'amber', beats: LOOP_BEATS, Scene: LoopScene },
  { id: 'challenge', name: 'Your move', accent: 'text-cyan-300', tone: 'fuchsia', beats: CHALLENGE_BEATS, Scene: ChallengeScene },
  { id: 'waves', name: 'Ship in waves', accent: 'text-sky-300', tone: 'sky', beats: WAVES_BEATS, Scene: WavesScene },
  { id: 'lunch', name: 'Before lunch', accent: 'text-teal-300', tone: 'emerald', beats: [null], Scene: LunchScene },
];
