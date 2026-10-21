import { motion } from 'motion/react';
import { at, Show, Replay, Code, Kicker, Tick, Terminal, Typed, later } from '../kit.jsx';
import { box, Turn, TYPING_MS } from './kit.jsx';
import { ISSUE_140 } from '../issue.js';

/* ------------------------------------------------------------------ *
 * Distil — winnowing. The transcript's lines are tossed into the air; the
 * chaff blows off to the right, the grain falls into one of four buckets.
 * ------------------------------------------------------------------ */

const BUCKETS = [
  { id: 'noise', label: 'Noise', icon: '🌬️', tone: 'border-hairline', text: 'text-faint', sub: 'listed in the chat, one line each — then dropped' },
  { id: 'know',  label: 'Durable knowledge', icon: '🧠', tone: 'border-emerald-400/50', text: 'text-emerald-200', sub: '→ a context update' },
  { id: 'work',  label: 'Actionable work', icon: '🎫', tone: 'border-violet-400/60', text: 'text-violet-200', sub: '→ a candidate task' },
  { id: 'both',  label: 'Both', icon: '🧠🎫', tone: 'border-cyan-400/50', text: 'text-cyan-200', sub: '→ a rule and a Done when line' },
];

/* Every line of the transcript that said anything, and the one bucket it
 * lands in. A `held` line is work winnow will not write until it has asked:
 * the conflict the room left open, and the decision nobody owned. */
const LINES = [
  { t: 'Can everyone see my screen?', b: 'noise' },
  { t: "Coffee's at 10:30, by the way.", b: 'noise' },
  { t: 'The day tabs are fine as they are', b: 'work', held: '⚑' },
  { t: 'A phone shows filters, not sessions', b: 'work' },
  { t: 'The day tabs are the worst of it', b: 'work', held: '⚑' },
  { t: 'Modern phones — iPhone 15 size', b: 'know' },
  { t: 'Every filter reachable on a phone', b: 'both' },
  { t: 'My agenda card: someone decide later', b: 'work', held: '❓' },
  { t: "Let's pick this up after the keynote", b: 'noise' },
];

/* The stage, top to bottom: the grounding strip, then a clear corridor the
 * lines fly along (the sheaf sits to its left), then the buckets. */
const SHEAF = { x: 80, y: 165, w: 520, h: 260, row: 24 };
const CHIP_W = 310;
const CORRIDOR_Y = 200;
const BUCKET_Y = 430;
const BUCKET_W = 340;
const BX = (i) => 80 + i * 367;

/* Where a line lands: its slot in its bucket — or, for chaff, off the stage. */
function landing(i) {
  const l = LINES[i];
  const b = BUCKETS.findIndex((k) => k.id === l.b);
  const slot = LINES.slice(0, i).filter((k) => k.b === l.b).length;
  if (l.b === 'noise') return { x: 1700 + slot * 40, y: CORRIDOR_Y + slot * 24, noise: true };
  // below the small bucket's one-line subtitle
  return { x: BX(b) + 14, y: BUCKET_Y + 92 + slot * 30, noise: false };
}

/* winnow reads the sheaf top to bottom first — a scan line, each line lighting as it passes — then tosses. */
const READ_AT = 400;
const READ_EVERY = 140;
const TOSS_AT = 2.0;

/* Up out of the sheaf into the corridor, along it, then straight down into the bucket. */
function Toss() {
  return LINES.map((l, i) => {
    const from = { x: SHEAF.x + 18, y: SHEAF.y + 40 + i * SHEAF.row };
    const to = landing(i);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const cy = CORRIDOR_Y - from.y;
    const d = TOSS_AT + i * 0.3;
    return (
      <motion.div
        key={l.t}
        className={`pz-lit absolute rounded-md border px-2.5 py-0.5 font-mono text-[13px] leading-tight ${to.noise ? 'border-hairline bg-raised text-faint' : l.held ? 'border-amber-400/50 bg-raised text-ink' : 'border-violet-400/40 bg-raised text-ink'}`}
        style={{ left: from.x, top: from.y, whiteSpace: 'nowrap', ...later(READ_AT + i * READ_EVERY) }}
        initial={{ x: 0, y: 0, rotate: 0, opacity: 1, width: SHEAF.w - 36 }}
        animate={{
          x: [0, dx * 0.3, dx, dx],
          y: [0, cy, to.noise ? cy : cy + 30, dy],
          rotate: [0, to.noise ? 10 : -5, to.noise ? 22 : -2, to.noise ? 24 : 0],
          opacity: to.noise ? [1, 0.9, 0.3, 0.1] : 1,
          width: [SHEAF.w - 36, CHIP_W + 40, CHIP_W, CHIP_W],
        }}
        transition={{ delay: d, duration: to.noise ? 1.5 : 1.3, ease: 'easeInOut', times: [0, 0.3, 0.7, 1] }}
      >
        {l.held && <span className="mr-1.5 text-amber-300">{l.held}</span>}{l.t}
      </motion.div>
    );
  });
}

function Bucket({ b, i, lines, full }) {
  const held = lines.filter((l) => l.held);
  const plain = lines.filter((l) => !l.held);
  return (
    <div className={`${box} flex flex-col overflow-hidden ${b.tone}`} style={full ? at(BX(i), 70, BUCKET_W, 540) : at(BX(i), BUCKET_Y, BUCKET_W, 180)}>
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
        <span className="text-[20px]">{b.icon}</span>
        <span className={`font-display text-[20px] ${b.text}`}>{b.label}</span>
        <span className="ml-auto font-mono text-[14px] text-faint">{lines.length}</span>
      </div>
      {full ? (
        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div className="text-[14px] text-faint">{b.sub}</div>
          {plain.map((l, j) => (
            <div key={l.t} className={`pz-appear rounded-lg border border-hairline bg-raised px-3 py-2 text-[15px] leading-snug ${b.id === 'noise' ? 'text-faint' : 'text-ink'}`} style={later(300 + i * 150 + j * 200)}>
              {l.t}
            </div>
          ))}
          {held.length > 0 && (
            <div className="pz-appear rounded-lg border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-[15px] leading-snug" style={later(900 + i * 150)}>
              <div className="font-mono text-[13px] text-amber-300">held — asked before anything is written</div>
              {held.map((l) => <div key={l.t} className="mt-1 text-ink"><span className="mr-1.5 text-amber-300">{l.held}</span>{l.t}</div>)}
            </div>
          )}
          {b.id === 'know' && (
            <div className="pz-appear mt-auto rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[14px] text-emerald-100" style={later(1600)}>
              → <Code className="text-[12px]">docs/context/testing.md</Code> — the viewport the mobile specs run at
            </div>
          )}
          {b.id === 'work' && (
            <div className="pz-appear mt-auto rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-[14px] text-violet-100" style={later(1800)}>
              <div className="font-semibold">Keep sessions in view on mobile</div>
              <div className="mt-1 flex items-center gap-2"><Tick className="size-5 text-[11px]" /> has a why</div>
              <div className="mt-1 flex items-center gap-2"><Tick className="size-5 text-[11px]" /> has a done-state</div>
            </div>
          )}
          {b.id === 'both' && (
            <div className="pz-appear mt-auto rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-[14px] text-cyan-100" style={later(2000)}>
              a Done when line on the task <i>and</i> a rule in the context
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 p-3 text-[13px] text-faint">{b.sub}</div>
      )}
    </div>
  );
}

const GROUND = ['CLAUDE.md', 'docs/context/schedule.md', 'docs/context/testing.md', '.claude/rules/ui.md'];

function WinnowScene({ step }) {
  const by = (id) => LINES.filter((l) => l.b === id);
  return (
    <>
      {/* beat 0: ground, then toss */}
      <Replay on={step === 0} from="down" style={at(80, 70, 1440, 80)} className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Kicker>First, it grounds itself in the AI context</Kicker>
          {GROUND.map((g, i) => (
            <span key={g} className="pz-appear rounded-lg border border-hairline bg-raised px-3 py-1 font-mono text-[14px] text-ink" style={later(300 + i * 200)}>{g}</span>
          ))}
        </div>
        <div className="pz-appear text-[15px] text-muted" style={later(1300)}>so “the schedule page” means <Code className="text-[13px]">/schedule</Code>, and it knows what the mobile specs already check.</div>
      </Replay>
      <Show on={step === 0} from="left" style={at(SHEAF.x, SHEAF.y, SHEAF.w, SHEAF.h)} className={`${box} overflow-hidden`}>
        <div className="border-b border-hairline px-4 py-2 font-mono text-[13px] text-faint">transcript.md · 41 chunks · {LINES.length} lines that said anything</div>
        <div className="pz-scan-down pointer-events-none absolute inset-x-0 top-10 h-7 bg-gradient-to-b from-transparent via-fuchsia-300/20 to-transparent" style={{ '--scan': `${SHEAF.h - 70}px`, ...later(READ_AT - 100) }} aria-hidden="true" />
      </Show>
      {/* the fan, at the sheaf's end of the corridor, blowing the chaff away to the right */}
      <Show on={step === 0} from="pop" delay={TOSS_AT * 1000 - 400} style={at(610, 150, 90, 90)} className="grid place-items-center">
        <span className="pz-float inline-block text-[64px]" style={{ transform: 'scaleX(-1)' }}>🌬️</span>
      </Show>
      {BUCKETS.map((b, i) => (
        <Show key={b.id} on={step === 0} from="up" delay={1500 + i * 120}>
          <Bucket b={b} i={i} lines={by(b.id)} full={false} />
        </Show>
      ))}
      {/* after the buckets, so a landing line paints on top of its bucket */}
      {step === 0 && <Toss />}

      {/* beat 1: the buckets, in full */}
      {BUCKETS.map((b, i) => (
        <Replay key={`${b.id}-full`} on={step === 1} from="up" delay={i * 120}>
          <Bucket b={b} i={i} lines={by(b.id)} full />
        </Replay>
      ))}
    </>
  );
}

const WINNOW_BEATS = [
  {
    kicker: '5 · Distil',
    title: 'Winnow: toss it up, let the noise blow away',
    body: 'It grounds itself in the AI context first, so the words land on the project’s real names. Then every line goes into exactly one bucket. Noise is listed in the chat, one line each, then dropped.',
  },
  {
    kicker: '5 · Four buckets',
    title: 'Noise, knowledge, actionable work — or both',
    body: 'A candidate task needs a why and a done-state, or it is not one yet. Knowledge goes to the doc that owns it. A line can be both. Work the room left open — a conflict, an unowned call — is held until winnow asks.',
  },
];

/* ------------------------------------------------------------------ *
 * Gaps — one question at a time, each with a best guess attached.
 * ------------------------------------------------------------------ */

const HUNTS = ['gaps', 'conflicts', 'undefined terms', 'unowned decisions'];

const QUEUE = [
  { q: 'Which stands on the day tabs — fine, or the worst of it?', from: '⚑ the flag the room never answered' },
  { q: 'What is the done-state, exactly?', from: '❓ no one said what done looks like' },
  { q: 'Who owns the call on the My agenda card?', from: '❓ 00:24:30 — “someone decide later”' },
];

function Queue({ step }) {
  return (
    <div className={`${box} p-5`}>
      <Kicker>Questions, one at a time</Kicker>
      <div className="mt-3 space-y-2">
        {/* the second beat asks two questions, so its open one is the third */}
        {QUEUE.map((item, i) => {
          const current = step === 0 ? 0 : 2;
          const asked = i <= current;
          const done = i < current;
          return (
            <div key={item.q} className={`flex items-start gap-3 rounded-lg border px-4 py-2.5 text-[15px] transition-all duration-500 ${i === current ? 'border-violet-400/60 bg-raised text-ink' : asked ? 'border-hairline text-muted' : 'border-dashed border-hairline text-faint'}`}>
              <span className="mt-0.5 shrink-0">{done ? <Tick className="size-5 text-[11px]" /> : i === current ? <span className="inline-block size-5 rounded-full bg-violet-400 animate-pulse-dot" /> : <span className="inline-block size-5 rounded-full border border-hairline" />}</span>
              <span>
                {asked ? item.q : '— held until the one above is answered —'}
                {asked && <div className="mt-0.5 font-mono text-[12px] text-faint">{item.from}</div>}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-[14px] text-faint">It hunts: {HUNTS.join(' · ')}</div>
    </div>
  );
}

function GapsScene({ step }) {
  return (
    <>
      {/* each beat's turns are laid over the column, so a hidden beat takes no room */}
      <div style={at(80, 70, 880, 540)}>
        <Replay on={step === 0} className="absolute inset-0 flex flex-col gap-3">
          <Turn delay={200}>
            One thing before I write anything down. At 00:03:10 the day tabs were “fine as they are”; at 00:14:30 “the worst of it”. The room never came back to it. Which stands?
            <div className="pz-appear mt-2 text-[15px] text-muted" style={later(1600)}>My best guess: <b className="text-ink">the later one</b> — the tabs get compacted with the rest of the filter block.</div>
          </Turn>
          <Turn who="you" delay={2400}>The later one. Nobody was defending the tabs.</Turn>
          <div className="pz-appear self-center font-mono text-[14px] text-faint" style={later(3500)}>one question · one answer · next</div>
        </Replay>
        <Replay on={step === 1} className="absolute inset-0 flex flex-col gap-3">
          <Turn delay={200}>
            What does done look like? My best guess, from what was said and what the mobile specs already check:
            <ul className="mt-2 space-y-1 text-[15px] text-muted">
              {[
                'the first session card is in view without scrolling past the full filter block',
                'every filter — day, track, venue, level, format, topic, search — still reachable',
                'the existing mobile specs still pass',
              ].map((l, i) => <li key={l} className="pz-appear" style={later(1500 + i * 350)}>• {l}</li>)}
            </ul>
          </Turn>
          <Turn who="you" delay={3000}>Yes — all three.</Turn>
          <Turn delay={4200}>
            Last one. At 00:24:30 Andy said the My agenda card on phones is for “someone” to decide later. Who? Best guess: whoever builds it — the ticket says so, under Out of scope.
          </Turn>
          <Turn who="you" delay={5600}>Agreed — leave it to whoever builds it.</Turn>
        </Replay>
      </div>
      <div style={at(1000, 70, 520, 540)} className="flex flex-col gap-4">
        <Queue step={step} />
        <Show on={step === 0} from="up" delay={1800} className={`${box} p-5 text-[16px] text-muted`}>
          <Kicker>Why a best guess</Kicker>
          <div className="mt-2">Saying “yes” costs you one word. Composing the answer costs the meeting you just had. And a guess shows you how the transcript read — so a misreading surfaces here, not in the ticket.</div>
        </Show>
      </div>
    </>
  );
}

const GAPS_BEATS = [
  {
    kicker: '6 · One question at a time',
    title: 'One at a time where it can, each with a best guess',
    body: 'The conflict the room never resolved is the first thing winnow raises — with the answer it would assume, so you can say “yes” rather than compose one. In plain chat, related questions share one message.',
  },
  {
    kicker: '6 · The done-state',
    title: 'The Done when is agreed before any ticket exists',
    body: 'Each line is an outcome a test could check, and each came from something said in the room or already in the context. The decision nobody owned is named on the ticket as out of scope — not silently decided.',
  },
];

/* ------------------------------------------------------------------ *
 * Agree before writing — the proposal lives outside the repo.
 * ------------------------------------------------------------------ */

/* Only approved items: the noise was listed in the chat and goes no further. */
const PROPOSAL = [
  { t: '# mobile filters — proposal', c: 'text-ink font-semibold' },
  { t: '## Knowledge (1) → docs/context/testing.md', c: 'text-emerald-300' },
  { t: 'Modern phones are the bar: an iPhone 15-size viewport.', c: 'text-muted' },
  { t: '## Tasks (1)', c: 'text-violet-300' },
  { t: `${ISSUE_140.title.split(':')[0]} — why, what, Done when ×3, out of scope`, c: 'text-muted' },
];

function AgreeScene() {
  return (
    <>
      <div style={at(80, 70, 700, 540)} className="flex flex-col gap-3">
        <Turn delay={200}>
          Here is what I would write: <b>1</b> knowledge update and <b>1</b> task. The <b>3</b> noise lines above go no further. Nothing has been written anywhere yet. Agree?
        </Turn>
        <Turn who="you" delay={1800}><span className="font-mono"><Typed text="Agree." delay={1800 + TYPING_MS + 100} speed={110} /></span></Turn>
        <Terminal
          className="mt-2"
          title="claude — winnow"
          bodyClass="text-[15px]"
          lines={[
            { t: 'writing proposal — outside the repo', tone: 'dim', delay: 2600 },
            { t: '<scratchpad>/winnow/proposals/mobile-filters.md', tone: 'ok', delay: 3000 },
            { t: 'handing to update-context (1 item) and create-tasks (1 item) — peers, in any order', tone: 'hi', delay: 3800 },
          ]}
        />
      </div>
      <Show from="right" delay={2800} style={at(820, 70, 700, 300)} className="overflow-hidden rounded-2xl border border-hairline bg-[#0d0f15]">
        <div className="flex border-b border-hairline bg-surface font-mono text-[13px]">
          <span className="whitespace-nowrap border-r border-hairline bg-[#0d0f15] px-4 py-2 text-ink">proposals/mobile-filters.md</span>
          <span className="whitespace-nowrap px-4 py-2 text-faint">approved items only · short-lived</span>
        </div>
        <div className="space-y-1.5 px-6 py-4 font-mono text-[15px]">
          {PROPOSAL.map((l, i) => <div key={l.t} className={`pz-appear ${l.c}`} style={later(3000 + i * 180)}>{l.t}</div>)}
        </div>
      </Show>
      <Show from="right" delay={4200} style={at(820, 400, 700, 210)} className={`${box} relative p-6`}>
        <div className="flex items-center gap-3">
          <Code>git status</Code>
          <span className="font-mono text-[15px] text-emerald-300">nothing to commit, working tree clean</span>
        </div>
        <div className="mt-3 text-[18px] text-muted">The repo has not been touched. Winnow never edits docs and never reaches the tracker — the next two skills do, acting on what you approved, and stop only for a duplicate, a split or an unclear placement.</div>
        <span className="pz-stamp absolute -top-4 right-6 rounded-md border-2 border-emerald-400 bg-ground/80 px-3 py-1 font-mono text-[14px] font-bold uppercase tracking-[0.2em] text-emerald-300" style={later(4800)}>no footprint</span>
      </Show>
    </>
  );
}

const AGREE_BEATS = [
  {
    kicker: '7 · Agree before writing',
    title: 'Nothing is written until you say so',
    body: 'The findings are agreed in the chat. Only then does winnow write its proposal — in the agent’s scratchpad, not the project — and hand it to update-context and create-tasks, which act on what you approved.',
  },
];

export const WINNOW = [
  { id: 'winnow', name: 'Distil', accent: 'text-fuchsia-300', tone: 'fuchsia', beats: WINNOW_BEATS, Scene: WinnowScene },
  { id: 'gaps', name: 'One question at a time', accent: 'text-cyan-300', tone: 'cyan', beats: GAPS_BEATS, Scene: GapsScene },
  { id: 'agree', name: 'Agree before writing', accent: 'text-sky-300', tone: 'sky', beats: AGREE_BEATS, Scene: AgreeScene },
];
