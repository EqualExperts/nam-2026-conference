import { at, Show, Replay, Code, Kicker, Tick, Typed, later } from '../kit.jsx';
import { box, Face, HOSTS, StepRail, STEP_CX, Wave, TYPING_MS } from './kit.jsx';

/* ------------------------------------------------------------------ *
 * Title — the same stage as the engineering talk, with a microphone at
 * the centre of the orbits instead of a ship. Drawn at the same spot as
 * its `Orbits`, so the hand-off warps straight onto them.
 * ------------------------------------------------------------------ */

export function Field({ style = at(940, 20, 640, 640), className = '' }) {
  // short words on the inner rings, so a label never reaches the next ring
  const rings = [
    { r: 120, dur: '26s', words: ['meeting', 'notes'] },
    { r: 200, dur: '38s', words: ['noise', 'signal', 'distil'] },
    { r: 262, dur: '54s', words: ['raise', 'remember', 'Done when', '#140'] },
  ];
  return (
    <svg viewBox="0 0 640 640" style={{ overflow: 'visible', ...style }} className={className} aria-hidden="true">
      <defs>
        <radialGradient id="pz-mic" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-cloud)" stopOpacity="0.9" />
          <stop offset="60%" stopColor="var(--color-techblue)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-techblue)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="320" cy="320" r="70" fill="url(#pz-mic)" />
      <text x="320" y="331" textAnchor="middle" fontSize="34">🎙️</text>
      {rings.map((ring, i) => (
        <g key={ring.r}>
          <circle cx="320" cy="320" r={ring.r} fill="none" stroke="var(--color-techblue)" strokeDasharray={i === 1 ? '4 8' : undefined} />
          <g className="pz-spin" style={{ transformOrigin: '320px 320px', animationDuration: ring.dur, animationDirection: i % 2 ? 'reverse' : 'normal' }}>
            {ring.words.map((w, j) => {
              const a = (j / ring.words.length) * Math.PI * 2 + i + 0.6;
              const x = 320 + Math.cos(a) * ring.r;
              const y = 320 + Math.sin(a) * ring.r;
              // the label sits on the outer side of its dot, away from the core and the ring inside
              const out = Math.cos(a) >= 0;
              return (
                <g key={w}>
                  <circle cx={x} cy={y} r="6" fill={['var(--color-brand-ink)', 'var(--color-brand)', 'var(--color-teal-ink)'][i]} />
                  <text x={x + (out ? 12 : -12)} y={y + 5} textAnchor={out ? 'start' : 'end'} fill="var(--color-muted)" fontSize="15" fontFamily="var(--font-mono)">{w}</text>
                </g>
              );
            })}
          </g>
        </g>
      ))}
    </svg>
  );
}

function TitleScene() {
  return (
    <>
      <Field />
      <div style={at(110, 150, 900, 420)}>
        <Kicker className="pz-appear">ORBIT &rsquo;26 · AI across the software delivery lifecycle</Kicker>
        <h1 className="pz-appear mt-6 font-display text-[112px] leading-[0.92] text-ink" style={later(120)}>
          The product<br />
          <span className="pz-shine bg-clip-text text-transparent">harness</span>
        </h1>
        <p className="pz-appear mt-7 max-w-[760px] text-[27px] leading-snug text-muted" style={later(260)}>
          From a conversation to a ticket an agent can build — and nothing written down until you agree.
        </p>
        <div className="pz-appear mt-9 space-y-1.5 whitespace-nowrap text-[19px] text-faint" style={later(900)}>
          <div className="text-muted">🎙️ <b className="text-ink">Product harness</b>: a conversation → a ticket</div>
          <div><span className="mr-3 text-brand-ink">↳</span>🚢 Engineering harness: the ticket → a reviewed pull request</div>
        </div>
        <div className="pz-appear mt-6 flex items-center gap-3 text-[16px] text-faint" style={later(1200)}>
          <Face who="abraham" size={30} />
          <span>Abraham Marín Pérez · Equal Experts · <span className="font-mono">winnow</span> — github.com/quiram/winnow</span>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Where tickets come from: a live call, then a ticket written from memory.
 * ------------------------------------------------------------------ */

/* Three tiles on a call. Each speaks in turn — the wave comes alive, the
 * words type in as captions — then the call ends and it all fades to ghosts. */
const SAID = [
  { who: 'andy',    t: ['On a phone the schedule is all', 'filters. You never see a session.'] },
  { who: 'jonas',   t: ['Modern phones only. iPhone 15', 'size; anything smaller is out.'] },
  { who: 'abraham', t: ['And every filter still has to', 'be reachable on a phone.'] },
];
const CAPTION_MS = 16;
const SAY_EVERY = 1300;
const ENDS_AT = 300 + SAID.length * SAY_EVERY + 200;
const TILE_W = 440;

function Tile({ who, t, delay }) {
  const speaking = t.join('').length * CAPTION_MS + TYPING_MS;
  return (
    <div className={`${box} flex flex-col items-center px-6 pb-5 pt-6`}>
      <span className="relative">
        <span className="pz-radar absolute inset-0 rounded-full border-2 border-teal" style={{ animationDelay: `${delay}ms`, animationIterationCount: 2 }} aria-hidden="true" />
        <Face who={who} size={96} />
      </span>
      <div className="mt-3 text-[17px] text-muted">{HOSTS[who].name}</div>
      <div className="pz-speak mt-2 text-brand-ink" style={{ animationDuration: `${speaking}ms`, animationDelay: `${delay}ms` }}>
        <Wave n={28} />
      </div>
      {/* live captions */}
      <div className="mt-4 h-[56px] font-mono text-[18px] leading-snug text-ink">
        {t.map((l, i) => <div key={l}><Typed text={l} delay={delay + 300 + i * (t[0].length * CAPTION_MS + 120)} speed={CAPTION_MS} /></div>)}
      </div>
    </div>
  );
}

function Guess({ q, delay, style }) {
  return (
    <div className="pz-appear flex items-center gap-2 rounded-full border border-ember/50 bg-ember/10 px-4 py-1.5 text-[17px] text-ember-ink" style={{ ...style, ...later(delay) }}>
      <Tick ok={false} className="size-6 text-[12px]" /> {q}
    </div>
  );
}

function WhereScene({ step }) {
  return (
    <>
      {/* the call */}
      <Replay on={step === 0} style={at(0, 0, 1600, 620)}>
        <div className="pz-appear absolute left-[80px] top-[70px] flex items-center gap-2 font-mono text-[14px] text-faint">
          <span className="size-2 rounded-full bg-ember-ink animate-pulse-dot" /> product sync · 3 on the call
        </div>
        {SAID.map((s, i) => (
          <div key={s.who} className="pz-evaporate absolute" style={{ left: 80 + i * 500, top: 100, width: TILE_W, ...later(ENDS_AT + i * 150) }}>
            <Tile who={s.who} t={s.t} delay={300 + i * SAY_EVERY} />
          </div>
        ))}
        <div className="pz-appear absolute left-0 right-0 top-[430px] text-center" style={later(ENDS_AT + 300)}>
          <div className="font-display text-[54px] text-ink">📵 Call ends.</div>
          <div className="mt-2 text-[24px] text-muted">Nobody wrote it down. By Friday, three people remember three different meetings.</div>
        </div>
      </Replay>

      {/* the ticket written from memory */}
      <Replay on={step === 1} from="left" style={at(80, 70, 720, 400)} className={`${box} relative overflow-hidden`}>
        <div className="border-b border-hairline px-7 pb-4 pt-5">
          <div className="font-display text-[30px] leading-tight text-ink">Fix the mobile schedule <span className="font-sans font-normal text-faint">#?</span></div>
          <div className="mt-2 text-[14px] text-faint">opened Friday, from memory</div>
        </div>
        <div className="space-y-3 px-7 py-5 text-[18px] text-muted">
          <div><b className="text-ink">Why:</b> <span className="italic text-faint">—</span></div>
          <div><b className="text-ink">What:</b> make it work on phones</div>
          <div><b className="text-ink">Done when:</b> it looks fine</div>
          <div><b className="text-ink">Out of scope:</b> <span className="italic text-faint">—</span></div>
        </div>
        <div className="pz-sweep pointer-events-none absolute inset-y-0 left-0 w-[200px] bg-gradient-to-r from-transparent via-ember/10 to-transparent" style={later(600)} aria-hidden="true" />
      </Replay>
      <Replay on={step === 1} from="right" style={at(860, 70, 660, 400)} className="flex flex-col justify-center gap-4">
        <Kicker>What an agent reads off that</Kicker>
        <Guess q="Which phones? How small is small?" delay={700} />
        <Guess q="What counts as done — says who?" delay={1100} />
        <Guess q="Why now? What was it for?" delay={1500} />
        <div className="pz-appear mt-3 text-[20px] leading-snug text-muted" style={later(2100)}>
          The agent will build <i>something</i>. The decision that would have made it the <b className="text-ink">right</b> thing was said out loud on the call — and is gone.
        </div>
      </Replay>
      {/* what the ticket should have carried — the shape the talk ends on */}
      <Show on={step === 1} from="up" delay={2600} style={at(80, 500, 1440, 100)} className={`${box} flex items-center gap-6 px-7`}>
        <Kicker>What it should have carried</Kicker>
        {[['Why', 'the goal it serves'], ['What', 'the work, present tense'], ['Done when', 'outcomes a test could check'], ['Out of scope', 'what is deliberately left out']].map(([h, s], i) => (
          <div key={h} className="pz-appear flex items-baseline gap-2" style={later(2800 + i * 150)}>
            <span className="text-[18px] font-medium text-ink">{h}</span>
            <span className="text-[15px] text-faint">{s}</span>
          </div>
        ))}
      </Show>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Three steps, and two doors into them.
 * ------------------------------------------------------------------ */

const DOORS = [
  { x: 80,  icon: '📄', title: 'Afterwards', cmd: '/winnow <transcript | paste | audio>', sub: 'a transcript file, pasted notes or a voice note', to: 0, demo: '/winnow context/winnow-transcripts/demo-transcript.txt' },
  { x: 880, icon: '⚡', title: 'One line', cmd: '/create-tasks <one line>', sub: 'you already know the ticket — just raise it properly', to: 2 },
];
const DOOR_W = 640;
const DOOR_Y = 330;
const DOOR_H = 290;

function doorPath(d) {
  const x0 = d.x + DOOR_W / 2;
  const x1 = STEP_CX(d.to);
  return `M${x0} ${DOOR_Y} C ${x0} ${DOOR_Y - 70}, ${x1} ${DOOR_Y - 60}, ${x1} 180`;
}

const PRINCIPLES = [
  ['📚', 'Grounded in the context', 'No skill works in isolation: each reads the project context before it acts.'],
  ['🙋', 'Nothing without a yes', 'Each step hands to the next only when you say so; winnow writes nothing until you agree.'],
  ['🫥', 'No footprint', 'What lands in the repo is a ticket and a context edit you review.'],
];

function WaysScene({ step }) {
  return (
    <>
      <StepRail y={80} />
      <Show on={step === 0} delay={1300} style={at(80, 220, 1440, 60)} className="flex items-center justify-center gap-4 text-[21px] text-muted">
        <span>Each step is a skill, grounded in the project context. Each hands to the next only when <b className="text-ink">you</b> say so.</span>
        <span className="text-faint">·</span>
        <span className="font-mono text-[17px] text-faint"><Code>/setup-winnow</Code> once per machine and repo</span>
      </Show>
      <Show on={step === 0} delay={1900} style={at(80, 300, 1440, 90)}>
        {[
          'every line into one bucket: noise, durable knowledge, actionable work, or both',
          'knowledge placed in the doc that owns it — integrated, never appended',
          'one goal per ticket, a Done when a test could check, a duplicate search first',
        ].map((t, i) => (
          <div key={t} className="pz-appear absolute text-center text-[17px] leading-snug text-muted" style={{ left: i * 540, width: 360, ...later(i * 120) }}>{t}</div>
        ))}
      </Show>
      <Show on={step === 0} delay={2800} style={at(80, 430, 1440, 170)} className="grid grid-cols-3 gap-4">
        {PRINCIPLES.map(([icon, h, s], i) => (
          <div key={h} className={`${box} pz-appear flex items-center gap-4 px-5 py-4`} style={later(i * 150)}>
            <span className="text-[32px]">{icon}</span>
            <div>
              <div className="font-display text-[22px] text-ink">{h}</div>
              <div className="mt-1 text-[15px] text-muted">{s}</div>
            </div>
          </div>
        ))}
      </Show>

      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        {DOORS.map((d, i) => (
          <g key={d.title}>
            <path d={doorPath(d)} pathLength="1" data-on={step === 1} className="pz-draw" fill="none" stroke="var(--color-techblue)" strokeWidth="3" style={{ transitionDelay: `${300 + i * 200}ms` }} />
            {step === 1 && <g className="pz-appear" style={later(1500 + i * 200)}><path d={doorPath(d)} pathLength="1" className="pz-flow" fill="none" stroke="var(--color-brand-ink)" strokeWidth="3" /></g>}
          </g>
        ))}
      </svg>

      {DOORS.map((d, i) => (
        <Show key={d.title} on={step === 1} from="up" delay={i * 180} style={at(d.x, DOOR_Y, DOOR_W, DOOR_H)} className={`${box} flex flex-col p-6`}>
          <div className="flex items-center gap-3">
            <span className="text-[30px]">{d.icon}</span>
            <span className="font-display text-[28px] text-ink">{d.title}</span>
          </div>
          <code className="mt-4 block rounded-lg border border-hairline bg-ground/70 px-3 py-2 font-mono text-[16px] text-brand-ink">{d.cmd}</code>
          <div className="mt-3 text-[16px] text-muted">{d.sub}</div>
          {d.demo && (
            <div className="pz-appear mt-3 inline-flex items-center gap-2 self-start whitespace-nowrap rounded-full border border-teal/50 bg-teal/10 px-3 py-1 font-mono text-[13px] text-teal-ink" style={later(1800)}>
              <span className="text-teal-ink">▶ try it</span> {d.demo}
            </div>
          )}
          <div className="mt-auto text-[14px] text-faint">joins at <b className="text-muted">{['Distil', 'Remember', 'Raise'][d.to]}</b></div>
        </Show>
      ))}
    </>
  );
}

export const PRODUCT_INTRO = [
  {
    id: 'title', name: 'The product harness', accent: 'text-teal-ink', tone: 'teal',
    beats: [null],
    Scene: TitleScene,
  },
  {
    id: 'where', name: 'Where tickets come from', accent: 'text-ember-ink', tone: 'ember',
    beats: [
      {
        kicker: '1 · Where tickets come from',
        title: 'Decisions are made in meetings — and die there',
        body: 'The answer to “which phones?” was said out loud by the person who knew. Nobody wrote it down, so by the time anyone builds anything it has to be guessed again.',
      },
      {
        kicker: '1 · The ticket written from memory',
        title: 'A ticket without a why or a done-state is a guess',
        body: 'An engineering harness is only as good as its ticket: a Done when a test can check, and the why a reviewer judges it by. The product harness exists to get that out of the room.',
      },
    ],
    Scene: WhereScene,
  },
];

/* ------------------------------------------------------------------ *
 * The whole flow, then the demo — after every skill has been met on its own.
 * ------------------------------------------------------------------ */

const DEMO = ['/winnow', '/update-context', '/create-tasks'];

function DemoScene() {
  return (
    <>
      <Show from="up" style={at(80, 90, 1440, 130)}>
        <Kicker>Now, live</Kicker>
        <div className="mt-3 font-display text-[72px] leading-none text-ink">See it <span className="pz-shine bg-clip-text text-transparent">run</span>.</div>
      </Show>
      <Show from="up" delay={400} style={at(80, 300, 1440, 280)} className="grid grid-cols-3 gap-5">
        {DEMO.map((c, i) => (
          <div key={c} className={`${box} pz-appear flex flex-col justify-between p-6`} style={later(i * 200)}>
            <span className="text-[34px]">{['🌾', '🧠', '🎫'][i]}</span>
            <code className="font-mono text-[19px] text-brand-ink">{c}</code>
          </div>
        ))}
      </Show>
    </>
  );
}

export const PRODUCT_FLOW = [
  {
    id: 'ways', name: 'The whole flow', accent: 'text-brand-ink', tone: 'blue',
    beats: [
      {
        kicker: '9 · The whole flow',
        title: 'Distil → Remember · Raise',
        body: 'The pieces together: distil separates noise from signal, then remember and raise are peers — context and tickets — each after you agree. None of them works in isolation: every step reads the project context.',
      },
      {
        kicker: '9 · Two ways in',
        title: 'From a transcript, or from one line',
        body: 'A transcript, pasted notes or a voice note go straight to winnow, which hands the knowledge and the work on. One line goes straight to create-tasks.',
      },
    ],
    Scene: WaysScene,
  },
  {
    id: 'demo', name: 'Live demo', accent: 'text-teal-ink', tone: 'teal',
    beats: [
      {
        kicker: '10 · Live demo',
        title: 'The flow, running on this project',
        body: 'A meeting on the phone schedule, distilled, remembered and raised — against this repository’s own context. Same skills, nothing staged.',
      },
    ],
    Scene: DemoScene,
  },
];
