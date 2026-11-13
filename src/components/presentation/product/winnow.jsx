import { motion } from 'motion/react';
import { at, Show, Replay, Code, Kicker, later } from '../kit.jsx';
import { box } from './kit.jsx';

/* ------------------------------------------------------------------ *
 * Any input in, the two skills out: winnow reads a whole transcript, in
 * whatever form it arrives, and hands what you agree to the two above.
 * ------------------------------------------------------------------ */

const INPUTS = [
  ['📸', 'A screenshot', 'a whiteboard, a chat thread'],
  ['📄', 'A text file or pasted notes', 'a transcript from any meeting tool'],
  ['🎙️', 'A voice note', 'an audio file, turned into text for you'],
  ['🔗', 'A link', 'a notes or doc link, if a tool can open it'],
];
const IN_CY = (i) => 127 + i * 135;
const OUTS = [
  { cy: 225, icon: '🧠', skill: 'update-context', what: 'the knowledge, into the docs that own it' },
  { cy: 415, icon: '🎫', skill: 'create-tasks', what: 'the work, into the tracker' },
];

function InputScene({ step }) {
  return (
    <>
      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        {INPUTS.map((_, i) => (
          <path key={i} d={`M520 ${IN_CY(i)} C 590 ${IN_CY(i)}, 590 320, 660 320`} pathLength="1" data-on className="pz-draw" fill="none" stroke="#1d6fa5" strokeWidth="3" style={{ transitionDelay: `${500 + i * 150}ms` }} />
        ))}
        {OUTS.map((o) => (
          <path key={o.skill} d={`M1000 320 C 1070 320, 1070 ${o.cy}, 1140 ${o.cy}`} pathLength="1" data-on={step === 1} className="pz-draw" fill="none" stroke="#1d6fa5" strokeWidth="3" style={{ transitionDelay: '300ms' }} />
        ))}
      </svg>
      {INPUTS.map(([icon, h, s], i) => (
        <Show key={h} from="left" delay={i * 150} style={at(80, 70 + i * 135, 440, 115)} className={`${box} flex items-center gap-4 px-5`}>
          <span className="text-[34px]">{icon}</span>
          <div>
            <div className="text-[19px] font-semibold text-ink">{h}</div>
            <div className="text-[14px] text-faint">{s}</div>
          </div>
        </Show>
      ))}
      <Show from="pop" delay={700} style={at(660, 170, 340, 300)} className={`${box} pz-glow flex flex-col justify-center border-cyan-400/60 p-6`}>
        <div className="font-display text-[34px] text-cyan-200">🌾 winnow</div>
        <div className="mt-3 space-y-1.5 text-[16px] text-muted">
          <div>reads the whole transcript</div>
          <div>grounds itself in the context</div>
          <div>sorts noise, knowledge, work</div>
          <div>asks what is unclear</div>
        </div>
      </Show>
      {OUTS.map((o, i) => (
        <Show key={o.skill} on={step === 1} from="right" delay={500 + i * 250} style={at(1140, o.cy - 75, 380, 150)} className={`${box} flex flex-col justify-center p-6`}>
          <div className="text-[28px]">{o.icon}</div>
          <Code className="mt-1 self-start text-[19px]">{o.skill}</Code>
          <div className="mt-2 text-[16px] text-muted">{o.what}</div>
        </Show>
      ))}
      <Show on={step === 1} from="up" delay={1400} style={at(660, 520, 860, 90)} className={`${box} flex items-center px-6 text-[18px] leading-snug text-muted`}>
        <span>winnow itself calls them, once you agree — <b className="text-ink">it never writes to the docs or the tracker on its own</b>.</span>
      </Show>
    </>
  );
}

const INPUT_BEATS = [
  {
    kicker: 'winnow',
    title: 'One skill for a whole transcript, in any format',
    body: 'A screenshot, a text file, pasted notes, an audio file or a link: winnow turns whatever it is given into text, then works through all of it, grounded in the project’s context.',
  },
  {
    kicker: 'winnow calls the other two',
    title: 'It decides; update-context and create-tasks do',
    body: 'You do not run the two skills you just met by hand: winnow hands them what you agreed, knowledge to one and work to the other. The same skills still work on their own.',
  },
];

/* ------------------------------------------------------------------ *
 * Distil — winnowing. The transcript's lines are tossed into the air; the
 * chaff blows off to the right, the grain falls into one of four buckets.
 * ------------------------------------------------------------------ */

const BUCKETS = [
  { id: 'noise', label: 'Noise', icon: '🌬️', tone: 'border-hairline', text: 'text-faint', sub: 'set aside — never written anywhere' },
  { id: 'know',  label: 'Durable knowledge', icon: '🧠', tone: 'border-teal-400/50', text: 'text-teal-200', sub: '→ a context update' },
  { id: 'work',  label: 'Actionable work', icon: '🎫', tone: 'border-blue-400/60', text: 'text-blue-200', sub: '→ a candidate task' },
  { id: 'both',  label: 'Both', icon: '🧠🎫', tone: 'border-cyan-400/50', text: 'text-cyan-200', sub: '→ a rule and a Done when line' },
];

/* Every line of the transcript that said anything, and the one bucket it
 * lands in. A `held` line is work winnow will not write until it has asked:
 * the conflict the room left open, and the decision nobody owned. */
const LINES = [
  { t: 'Can everyone see my screen?', b: 'noise' },
  { t: "Coffee's at 10:30, by the way.", b: 'noise' },
  { t: 'The day tabs are fine as they are', b: 'work', held: '❓' },
  { t: 'A phone shows filters, not sessions', b: 'work' },
  { t: 'The day tabs are the worst of it', b: 'work', held: '❓' },
  { t: 'Modern phones — iPhone 15 size', b: 'know' },
  { t: 'Every filter reachable on a phone', b: 'both' },
  { t: 'My agenda card: someone decide later', b: 'work', held: '❓' },
  { t: "Let's pick this up after the keynote", b: 'noise' },
];

/* The stage, top to bottom: the grounding strip, then a clear corridor the
 * lines fly along (the sheaf sits to its left), then the buckets. */
const SHEAF = { x: 80, y: 165, w: 520, h: 240, row: 22 };
const CHIP_W = 310;
const CORRIDOR_Y = 200;
const BUCKET_Y = 410;
const BUCKET_W = 340;
const BX = (i) => 80 + i * 367;

/* Where a line lands: its slot in its bucket — noise included, which is a bucket like the rest. */
function landing(i) {
  const l = LINES[i];
  const b = BUCKETS.findIndex((k) => k.id === l.b);
  const slot = LINES.slice(0, i).filter((k) => k.b === l.b).length;
  // below the small bucket's one-line subtitle; four lines is the most any bucket holds
  return { x: BX(b) + 14, y: BUCKET_Y + 82 + slot * 28, noise: l.b === 'noise' };
}

/* winnow reads the sheaf top to bottom first — a scan line, each line lighting as it passes — then tosses. */
const READ_AT = 400;
const READ_EVERY = 140;
const TOSS_AT = 2.0;

/* Up out of the sheaf into the corridor, along it, then straight down into its bucket. */
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
        className={`pz-lit absolute rounded-md border px-2.5 py-0.5 font-mono text-[13px] leading-tight ${to.noise ? 'border-hairline bg-raised text-faint' : l.held ? 'border-amber-400/50 bg-raised text-ink' : 'border-blue-400/40 bg-raised text-ink'}`}
        style={{ left: from.x, top: from.y, whiteSpace: 'nowrap', ...later(READ_AT + i * READ_EVERY) }}
        initial={{ x: 0, y: 0, rotate: 0, opacity: 1, width: SHEAF.w - 36 }}
        animate={{
          x: [0, dx * 0.3, dx, dx],
          y: [0, cy, cy + 30, dy],
          rotate: [0, -5, -2, 0],
          width: [SHEAF.w - 36, CHIP_W + 40, CHIP_W, CHIP_W],
        }}
        transition={{ delay: d, duration: 1.3, ease: 'easeInOut', times: [0, 0.3, 0.7, 1] }}
      >
        {l.held && <span className="mr-1.5 text-amber-300">{l.held}</span>}{l.t}
      </motion.div>
    );
  });
}

function Bucket({ b, i, lines }) {
  return (
    <div className={`${box} flex flex-col overflow-hidden ${b.tone}`} style={at(BX(i), BUCKET_Y, BUCKET_W, 200)}>
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
        <span className="text-[20px]">{b.icon}</span>
        <span className={`font-display text-[20px] ${b.text}`}>{b.label}</span>
        <span className="ml-auto font-mono text-[14px] text-faint">{lines.length}</span>
      </div>
      <div className="flex-1 p-3 text-[13px] text-faint">{b.sub}</div>
    </div>
  );
}

const GROUND = ['CLAUDE.md', 'context/engineering-context/schedule.md', 'context/engineering-context/testing.md', '.claude/rules/ui.md'];

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
        <div className="border-b border-hairline px-4 py-2 font-mono text-[13px] text-faint">transcript · {LINES.length} lines that said anything</div>
        <div className="pz-scan-down pointer-events-none absolute inset-x-0 top-10 h-7 bg-gradient-to-b from-transparent via-cyan-300/20 to-transparent" style={{ '--scan': `${SHEAF.h - 70}px`, ...later(READ_AT - 100) }} aria-hidden="true" />
      </Show>
      {BUCKETS.map((b, i) => (
        <Show key={b.id} on={step === 0} from="up" delay={1500 + i * 120}>
          <Bucket b={b} i={i} lines={by(b.id)} />
        </Show>
      ))}
      {/* after the buckets, so a landing line paints on top of its bucket */}
      {step === 0 && <Toss />}
    </>
  );
}

const WINNOW_BEATS = [
  {
    kicker: 'Distil',
    title: 'Winnow: toss it all up and sort every line',
    body: 'It reads the AI context first, so the words land on the project’s real names. Then every line goes into exactly one bucket. Noise is set aside and never written anywhere.',
  },
];

export const WINNOW = [
  { id: 'input', name: 'winnow', accent: 'text-cyan-300', tone: 'fuchsia', rail: { lit: ['distil'], commands: true }, beats: INPUT_BEATS, Scene: InputScene },
  { id: 'winnow', name: 'Distil', accent: 'text-cyan-300', tone: 'fuchsia', rail: { lit: ['distil'], commands: true }, beats: WINNOW_BEATS, Scene: WinnowScene },
];
