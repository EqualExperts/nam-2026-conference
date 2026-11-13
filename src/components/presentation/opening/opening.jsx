import { motion } from 'motion/react';
import { at, Show, Replay, Kicker, Tick, later } from '../kit.jsx';
import { box, Face } from '../product/kit.jsx';
import { Field } from '../product/intro.jsx';

/**
 * /opening-presentation — the talk that opens the session: the two ideas the
 * day is built on — shared context, and parallel work — and the plan for the
 * day. It ends on the frame the product talk opens with, and hands over to it.
 */

/**
 * This deck's captions sit at the top of the stage (Deck `captions="top"`), so
 * every captioned scene is drawn this far down, under its caption.
 */
const DROP = 210;
function Below({ children }) {
  return <div className="absolute inset-0" style={{ transform: `translateY(${DROP}px)` }}>{children}</div>;
}

/* ------------------------------------------------------------------ *
 * Title — the same stage as the other two talks.
 * ------------------------------------------------------------------ */

function Rings({ style = at(940, 20, 640, 640) }) {
  const rings = [
    { r: 120, dur: '26s', words: ['context', 'markdown'] },
    { r: 200, dur: '38s', words: ['product', 'engineering', 'QA'] },
    { r: 262, dur: '54s', words: ['harness', 'git', 'parallel', 'review'] },
  ];
  return (
    <svg viewBox="0 0 640 640" style={{ overflow: 'visible', ...style }} aria-hidden="true">
      <defs>
        <radialGradient id="pz-opening" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#2095d3" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2095d3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="320" cy="320" r="70" fill="url(#pz-opening)" />
      <text x="320" y="331" textAnchor="middle" fontSize="34">🛰️</text>
      {rings.map((ring, i) => (
        <g key={ring.r}>
          <circle cx="320" cy="320" r={ring.r} fill="none" stroke="#1f5c80" strokeDasharray={i === 1 ? '4 8' : undefined} />
          <g className="pz-spin" style={{ transformOrigin: '320px 320px', animationDuration: ring.dur, animationDirection: i % 2 ? 'reverse' : 'normal' }}>
            {ring.words.map((w, j) => {
              const a = (j / ring.words.length) * Math.PI * 2 + i + 0.3;
              const x = 320 + Math.cos(a) * ring.r;
              const y = 320 + Math.sin(a) * ring.r;
              const out = Math.cos(a) >= 0;
              return (
                <g key={w}>
                  <circle cx={x} cy={y} r="6" fill={['#6ee7b7', '#67e8f9', '#60a5fa'][i]} />
                  <text x={x + (out ? 12 : -12)} y={y + 5} textAnchor={out ? 'start' : 'end'} fill="#94a3b8" fontSize="15" fontFamily="Lexend, sans-serif">{w}</text>
                </g>
              );
            })}
          </g>
        </g>
      ))}
    </svg>
  );
}

/** The day, in order — this talk first, then the two labs, lunch, and the teams. */
const DAY = [
  ['🛰️', 'Why: the core concepts'],
  ['🎙️', 'Lab 1 · the product harness'],
  ['🚢', 'Lab 2 · the engineering harness'],
  ['🍽️', 'Lunch'],
  ['👥', 'Teams evolve the app together'],
  ['🎤', 'Teams present'],
];

function TitleScene() {
  return (
    <>
      <div style={at(80, 120, 1440, 700)} className="rounded-[36px] border-2 border-edge bg-surface" />
      <div style={at(130, 160, 880, 540)}>
        <Kicker className="pz-appear !text-[20px]">Equal Experts · NAM conference 2026</Kicker>
        <h1 className="pz-appear mt-4 font-display text-[84px] font-bold leading-[0.95] text-ink" style={later(120)}>
          Welcome to<br />
          <span className="text-edge">NAM 2026</span>
        </h1>
        <p className="pz-appear mt-6 max-w-[800px] text-[24px] leading-snug text-ink" style={later(260)}>
          Today’s exercise: AI across the whole software delivery lifecycle — connected by shared context, accelerated by running work in parallel.
        </p>
        <p className="pz-appear mt-3 max-w-[800px] text-[18px] text-muted" style={later(500)}>
          You’ll work on <span className="text-ink">ORBIT &rsquo;26</span>, a conference app built for the day — with My Agenda left for you to build.
        </p>
        <div data-testid="opening-day" className="pz-appear mt-4 whitespace-nowrap text-[17px] leading-[1.4] text-muted" style={later(900)}>
          {DAY.map(([icon, what], i) => (
            <div key={what} className={i === 0 ? 'text-ink' : ''}>
              {i > 0 && <span className="mr-3 text-edge">↳</span>}{icon} {i === 0 ? <b className="text-ink">{what}</b> : what}
            </div>
          ))}
        </div>
      </div>
      <div className="pz-appear absolute flex items-center gap-3 text-[16px] text-muted" style={{ ...at(1010, 690, 480, 40), animationDelay: '1200ms' }}>
        <Face who="andy" size={30} />
        <span>Andy Vays · Technical Principal · Equal Experts</span>
      </div>
      <img data-testid="deck-logo" src="/brand/Equal_Experts_Logo_Monochrome_White.svg" alt="Equal Experts" className="absolute" style={{ left: 130, top: 738, width: 180 }} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Where we are: everyone on a journey, unevenly; no connected way of
 * working; work run one at a time.
 * ------------------------------------------------------------------ */

// everyone is using AI — what differs is how far it has taken them. The tags
// are illustrations of the range, not data.
const JOURNEYS = [
  ['a developer', 0.88, 'agents running whole tickets'],
  ['the developer next to them', 0.3, 'autocomplete'],
  ['another team', 0.62, 'pairing with a chat assistant'],
  ['product', 0.5, 'drafting specs in a chat window'],
  ['design', 0.32, 'generating mock-up ideas'],
  ['QA', 0.38, 'generating test ideas'],
  ['the business', 0.44, 'summarising meetings'],
];

function Uneven({ on }) {
  return (
    <Replay on={on} style={at(80, 50, 1440, 560)}>
      <div className="space-y-3">
        {JOURNEYS.map(([who, how, tag], i) => (
          <div key={who} className="pz-appear flex items-center gap-6" style={later(i * 110)}>
            <span className="w-[330px] shrink-0 text-right text-[21px] text-muted">{who}</span>
            <span className="relative h-10 flex-1 overflow-hidden rounded-full bg-overlay">
              <span className="pz-fill absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-500/70 to-cyan-400/70" style={{ width: `${how * 100}%`, animationDuration: '1.2s', animationDelay: `${300 + i * 110}ms` }} />
              <span className="pz-appear absolute inset-y-0 left-5 flex items-center whitespace-nowrap text-[16px] text-white/90" style={later(1500 + i * 110)}>{tag}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="pz-appear mt-8 text-center font-display text-[34px] text-ink" style={later(2500)}>Everyone’s using it — at very different speeds.</div>
    </Replay>
  );
}

const QUEUE = ['#41', '#42', '#43', '#44', '#45'];

function Serial({ on }) {
  return (
    <Replay on={on} style={at(80, 70, 1440, 540)}>
      <Kicker>How the work still runs</Kicker>
      <div className="mt-10 flex items-center gap-4">
        {QUEUE.map((n, i) => (
          <div key={n} className="flex items-center gap-4">
            <div className={`pz-appear flex h-[120px] w-[220px] flex-col items-center justify-center rounded-xl border ${i === 0 ? 'pz-glow border-blue-400/70 bg-raised' : 'border-edge bg-surface opacity-60'}`} style={later(i * 140)}>
              <span className="font-mono text-[24px] text-ink">{n}</span>
              <span className={`mt-1 text-[15px] ${i === 0 ? 'text-blue-200' : 'text-faint'}`}>{i === 0 ? 'running…' : 'waiting'}</span>
            </div>
            {i < QUEUE.length - 1 && <span className="pz-appear text-[24px] text-faint" style={later(i * 140 + 80)}>→</span>}
          </div>
        ))}
      </div>
      <div className="pz-appear mt-8 flex items-center gap-5 pl-[40px]" style={later(1000)}>
        <Face who="andy" size={64} className="opacity-80" />
        <div className="text-[22px] text-muted">
          <span className="text-[30px]">👀</span> one ticket at a time, with a person watching the agent the whole way
        </div>
      </div>
      <div className="pz-appear mt-10 text-center font-display text-[34px] text-ink" style={later(1700)}>Run serially. And babysat.</div>
    </Replay>
  );
}

const ISLANDS = [
  { who: 'Product', icon: '💡', has: ['a slide deck', 'a meeting'], x: 80, y: 120 },
  { who: 'Design', icon: '🎨', has: ['a design file', 'a chat thread'], x: 440, y: 330 },
  { who: 'Engineering', icon: '⌨️', has: ['a prompt', 'a ticket'], x: 800, y: 120 },
  { who: 'QA', icon: '🧪', has: ['a test plan', 'a spreadsheet'], x: 1160, y: 330 },
];

function Islands({ on }) {
  return (
    <Replay on={on} style={at(0, 0, 1600, 620)}>
      <div className="absolute left-[80px] top-[70px]"><Kicker>Across the lifecycle</Kicker></div>
      {ISLANDS.map((s, i) => (
        <div key={s.who} className={`${box} pz-appear absolute flex flex-col p-6`} style={{ left: s.x, top: s.y, width: 360, height: 190, ...later(i * 160) }}>
          <div className="flex items-center gap-3">
            <span className="text-[30px]">{s.icon}</span>
            <span className="font-display text-[28px] text-ink">{s.who}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {s.has.map((h) => <span key={h} className="rounded-full border border-hairline bg-raised px-3 py-1 text-[15px] text-muted">{h}</span>)}
          </div>
          <div className="mt-auto text-[14px] text-faint">its own tools, its own memory</div>
        </div>
      ))}
      {ISLANDS.slice(1).map((s, i) => {
        const a = ISLANDS[i];
        const x = (a.x + 360 + s.x) / 2;
        const y = (a.y + s.y) / 2 + 95;
        return <span key={s.who} className="pz-pop absolute grid size-10 place-items-center rounded-full border-2 border-dashed border-amber-400/60 bg-amber-500/10 text-[18px] font-bold text-amber-200" style={{ left: x - 20, top: y - 20, ...later(900 + i * 200) }}>?</span>;
      })}
    </Replay>
  );
}

function WhereScene({ step }) {
  return (
    <Below>
      <Uneven on={step === 0} />
      <Islands on={step === 1} />
      <Serial on={step === 2} />
    </Below>
  );
}

/* ------------------------------------------------------------------ *
 * Nobody has a plan — but transformation follows a familiar pattern.
 * ------------------------------------------------------------------ */

const PATTERN = [
  ['🔭', 'Step back', 'stop, and look at the whole'],
  ['📍', 'Where are we today?', 'be honest about the starting point'],
  ['🗺️', 'Where do we want to go?', 'a roadmap, with a goal'],
  ['🔁', 'Execute in an agile way', 'small steps — with the goal in mind'],
];

function PatternScene() {
  return (
    <Below>
      {PATTERN.map(([icon, h, s], i) => (
        <Show key={h} from="up" delay={500 + i * 260} style={at(80 + i * 365, 60, 330, 300)} className={`${box} flex flex-col p-7`}>
          <span className="font-mono text-[15px] text-faint">{i + 1}</span>
          <span className="mt-3 text-[44px] leading-none">{icon}</span>
          <div className="mt-4 font-display text-[28px] leading-tight text-ink">{h}</div>
          <div className="mt-2 text-[18px] text-muted">{s}</div>
          {i === PATTERN.length - 1 && <span className="pz-spin ml-auto mt-auto text-[26px] text-teal-300" style={{ animationDuration: '6s' }} aria-hidden="true">↻</span>}
        </Show>
      ))}
      {[0, 1, 2].map((i) => (
        <Show key={i} from="none" delay={700 + i * 260} style={at(80 + i * 365 + 334, 190, 30, 40)} className="text-center text-[24px] text-blue-300">→</Show>
      ))}
      <Show from="up" delay={1900} style={at(80, 400, 1440, 90)} className="text-center">
        <div className="font-display text-[32px] text-ink">It’s all new, and it changes every day.</div>
        <div className="mt-1 text-[21px] text-muted">Nobody really has a plan — and we don’t have all the answers either.</div>
      </Show>
      <Show from="up" delay={2500} style={at(80, 520, 1440, 50)} className="text-center text-[20px] text-faint">
        Today you’ll do things you may have done before — maybe better. What we want you to keep is <b className="text-ink">two lessons</b>.
      </Show>
    </Below>
  );
}

/* ------------------------------------------------------------------ *
 * Lesson 1 — shared context is what connects the lifecycle.
 * ------------------------------------------------------------------ */

const HUB = { x: 800, y: 240 };
const SPOKES = [
  { label: 'Product', icon: '💡', x: 230, y: 90 },
  { label: 'Design', icon: '🎨', x: 230, y: 240 },
  { label: 'Engineering', icon: '⌨️', x: 230, y: 390 },
  { label: 'any interface', icon: '🖥️', x: 1370, y: 90 },
  { label: 'any model', icon: '🧠', x: 1370, y: 240 },
  { label: 'any workflow', icon: '🔀', x: 1370, y: 390 },
];
/* …and beyond delivery: the same context, read by the rest of the business. */
const BEYOND = [
  { label: 'Marketing', icon: '📣', x: 520 },
  { label: 'Security', icon: '🔒', x: 800 },
  { label: 'Executives', icon: '📊', x: 1080 },
];
const BEYOND_Y = 540;

function ConnectBeat({ on }) {
  return (
    <Replay on={on} from="none" style={at(0, 0, 1600, 620)}>
      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        {SPOKES.map((s, i) => {
          const d = `M${s.x} ${s.y} C ${(s.x + HUB.x) / 2} ${s.y}, ${(s.x + HUB.x) / 2} ${HUB.y}, ${HUB.x} ${HUB.y}`;
          return (
            <g key={s.label}>
              <path d={d} pathLength="1" className="pz-draw-in" fill="none" stroke="#1f5c80" strokeWidth="2.5" style={later(700 + i * 120)} />
              <g className="pz-appear" style={later(1700 + i * 120)}>
                <path d={d} pathLength="1" className="pz-flow" fill="none" stroke="#6ee7b7" strokeWidth="2.5" opacity="0.8" />
              </g>
            </g>
          );
        })}
        {BEYOND.map((b, i) => {
          const d = `M${HUB.x} ${HUB.y} C ${HUB.x} ${(HUB.y + BEYOND_Y) / 2}, ${b.x} ${(HUB.y + BEYOND_Y) / 2}, ${b.x} ${BEYOND_Y}`;
          return (
            <g key={b.label}>
              <path d={d} pathLength="1" className="pz-draw-in" fill="none" stroke="#6b4f1d" strokeWidth="2.5" strokeDasharray="1" style={later(2600 + i * 150)} />
              <g className="pz-appear" style={later(3400 + i * 150)}>
                <path d={d} pathLength="1" className="pz-flow" fill="none" stroke="#fcd34d" strokeWidth="2.5" opacity="0.8" />
              </g>
            </g>
          );
        })}
      </svg>
      <div className="pz-appear absolute flex items-center gap-4" style={{ left: 80, top: BEYOND_Y - 70, width: 1440, ...later(2400) }}>
        <span className="font-mono text-[14px] uppercase tracking-[0.2em] text-amber-300">and beyond the SDLC</span>
        <span className="h-px flex-1 bg-amber-400/25" />
      </div>
      {BEYOND.map((b, i) => (
        <div key={b.label} className="pz-appear absolute flex items-center justify-center gap-3 rounded-2xl border border-amber-400/50 bg-amber-500/10" style={{ left: b.x - 120, top: BEYOND_Y, width: 240, height: 64, ...later(2800 + i * 150) }}>
          <span className="text-[24px]">{b.icon}</span>
          <span className="text-[20px] font-semibold text-amber-100">{b.label}</span>
        </div>
      ))}
      {SPOKES.map((s, i) => (
        <div key={s.label} className={`${box} pz-appear absolute flex items-center gap-3 px-5`} style={{ left: s.x - 130, top: s.y - 34, width: 260, height: 68, ...later(200 + i * 100) }}>
          <span className="text-[26px]">{s.icon}</span>
          <span className="text-[20px] font-semibold text-ink">{s.label}</span>
        </div>
      ))}
      <div className="pz-pop pz-glow absolute flex flex-col items-center justify-center rounded-3xl border border-teal-400/70 bg-raised" style={{ left: HUB.x - 150, top: HUB.y - 95, width: 300, height: 190, ...later(500) }}>
        <span className="text-[38px]">📚</span>
        <span className="mt-1 font-display text-[32px] text-ink">Shared context</span>
        <span className="text-[15px] text-faint">created and curated together</span>
      </div>
    </Replay>
  );
}

const WHY_GIT = [
  ['✍️', 'Plain markdown', 'any person reads it, any agent reads it'],
  ['🌿', 'Next to the code', 'versioned with what it describes'],
  ['🔍', 'Changed by pull request', 'reviewed like code, with a history of why'],
];

/* Context rolls up: each repo keeps its own, in markdown, next to its code; a
 * meta context repo gathers those and everything else that is relevant. */
const REPOS = [
  { name: 'web-app/', x: 80 },
  { name: 'payments-api/', x: 365 },
  { name: 'data-platform/', x: 650 },
];
const REPO_W = 250;
const META = { x: 80, y: 62, w: 820, h: 190 };
const REPO_Y = 327;
const META_HOLDS = [
  ['🔁', 'repos/', 'every repo’s context, rolled up'],
  ['🎙️', 'transcripts/', 'what conversations decided'],
  ['📦', 'artifacts/', 'decks, designs, decisions'],
  ['🏢', 'domain/', 'the business, its language and rules'],
];

function MarkdownBeat({ on }) {
  return (
    <>
      {/* the meta context repo */}
      <Show on={on} from="down" delay={900} style={at(META.x, META.y, META.w, META.h)} className="pz-glow flex flex-col rounded-2xl border border-teal-400/60 bg-[#071322]">
        <div className="flex items-center gap-3 border-b border-edge bg-surface px-5 py-2.5">
          <span className="text-[20px]">🧠</span>
          <span className="font-mono text-[16px] text-teal-200">org-context/</span>
          <span className="text-[15px] text-muted">the meta context repo</span>
          <span className="ml-auto text-[14px] text-faint">everything else that’s relevant goes here too</span>
        </div>
        <div className="grid flex-1 grid-cols-2 content-center gap-x-6 gap-y-4 px-6 py-3">
          {META_HOLDS.map(([icon, f, what], k) => (
            <div key={f} className="pz-appear flex items-baseline gap-3" style={later(1300 + k * 150)}>
              <span className="text-[18px]">{icon}</span>
              <span className="shrink-0 font-mono text-[17px] text-blue-200">{f}</span>
              <span className="text-[15px] text-muted">{what}</span>
            </div>
          ))}
        </div>
      </Show>

      {/* each repo rolls its own context up */}
      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        {REPOS.map((r, k) => {
          const x = r.x + REPO_W / 2;
          const d = `M${x} ${REPO_Y} L${x} ${META.y + META.h}`;
          return (
            <g key={r.name}>
              <path d={d} pathLength="1" data-on={on} className="pz-draw" fill="none" stroke="#1f5c80" strokeWidth="2.5" style={{ transitionDelay: `${500 + k * 120}ms` }} />
              {on && <g className="pz-appear" style={later(1200 + k * 120)}><path d={d} pathLength="1" className="pz-flow" fill="none" stroke="#6ee7b7" strokeWidth="2.5" /></g>}
            </g>
          );
        })}
      </svg>
      {[0, 1].map((k) => (
        <Show key={k} on={on} from="none" delay={800} style={at(REPOS[k].x + REPO_W / 2 + 14, META.y + META.h + 26, 140, 30)} className="font-mono text-[13px] uppercase tracking-[0.2em] text-teal-300">
          ↑ rolls up
        </Show>
      ))}
      {REPOS.map((r, k) => (
        <Show key={r.name} on={on} from="up" delay={k * 150} style={at(r.x, REPO_Y, REPO_W, 110)} className="flex flex-col rounded-xl border border-hairline bg-[#071322] px-4 py-3">
          <span className="font-mono text-[16px] text-ink">{r.name}</span>
          <span className="mt-1.5 font-mono text-[14px] text-blue-200">CLAUDE.md · context/*.md</span>
          <span className="mt-auto text-[13px] text-faint">its own context, next to its code</span>
        </Show>
      ))}

      <Show on={on} from="right" delay={400} style={at(960, 62, 560, 375)} className="flex flex-col justify-center gap-4">
        <Kicker>Context, in this sense, means</Kicker>
        {WHY_GIT.map(([icon, h, s], i) => (
          <div key={h} className={`${box} pz-appear flex items-center gap-5 px-6 py-4`} style={later(700 + i * 200)}>
            <span className="text-[30px]">{icon}</span>
            <div>
              <div className="text-[20px] font-semibold text-ink">{h}</div>
              <div className="text-[16px] text-muted">{s}</div>
            </div>
          </div>
        ))}
      </Show>
      <Show on={on} from="up" delay={1600} style={at(80, 475, 1440, 76)} className="flex items-center justify-center gap-5 rounded-2xl border border-dashed border-hairline px-8 text-[20px] text-muted">
        <span className="text-[28px]">☕</span>
        <span>Why not a wiki like Confluence, or a search tool like Glean? Ten minutes isn’t enough — <b className="text-ink">ask me afterwards.</b></span>
      </Show>
    </>
  );
}

function ContextScene({ step }) {
  return (
    <Below>
      <ConnectBeat on={step === 0} />
      <MarkdownBeat on={step === 1} />
    </Below>
  );
}

/* ------------------------------------------------------------------ *
 * Lesson 2 — parallel work is the leap.
 * ------------------------------------------------------------------ */

const TICKETS = ['#41', '#42', '#43', '#44', '#45'];
const LANE_X = 230;
const LANE_W = 1210;
const SLOT = LANE_W / 5;
// the parallel lanes take a little longer each than one serial slot — a run is a run
const PAR = [1, 1.15, 1.3, 1.05, 1.2].map((k) => SLOT * k - 12);
const PAR_DONE = Math.max(...PAR) + 12;

function ParallelBeat({ on }) {
  return (
    <Replay on={on} style={at(80, 70, 1440, 540)}>
      {/* one at a time */}
      <div className="absolute left-0 top-0 w-[210px] pt-3 text-right text-[20px] text-muted">one at a time</div>
      <div className="absolute h-14 overflow-hidden rounded-xl border border-edge bg-surface" style={{ left: LANE_X, top: 0, width: LANE_W }}>
        {TICKETS.map((n, i) => (
          <span key={n} className="pz-fill absolute inset-y-1.5 flex items-center justify-center rounded-lg bg-blue-500/30 font-mono text-[16px] text-blue-100"
            style={{ left: 6 + i * SLOT, width: SLOT - 12, animationDuration: '0.6s', animationDelay: `${300 + i * 600}ms` }}>{n}</span>
        ))}
      </div>

      {/* in parallel */}
      <div className="absolute left-0 w-[210px] text-right text-[20px] text-ink" style={{ top: 190 }}>in parallel</div>
      {TICKETS.map((n, i) => (
        <div key={n} className="absolute h-11 overflow-hidden rounded-xl border border-edge bg-surface" style={{ left: LANE_X, top: 90 + i * 54, width: LANE_W }}>
          <span className="pz-fill absolute inset-y-1 left-1.5 flex items-center justify-center rounded-lg bg-teal-500/30 font-mono text-[16px] text-teal-100"
            style={{ width: PAR[i], animationDuration: '0.9s', animationDelay: `${300 + i * 60}ms` }}>{n}</span>
        </div>
      ))}

      {/* the time axis, and where each way finishes */}
      <div className="absolute border-t border-hairline" style={{ left: LANE_X, top: 380, width: LANE_W }} />
      <div className="absolute text-[15px] text-faint" style={{ left: LANE_X + LANE_W - 60, top: 388 }}>time →</div>
      <div className="pz-appear absolute border-l-2 border-dashed border-teal-400/70" style={{ left: LANE_X + PAR_DONE, top: 84, height: 300, ...later(1300) }} />
      <div className="pz-appear absolute -translate-x-1/2 whitespace-nowrap rounded-full border border-teal-400/60 bg-teal-500/15 px-4 py-1 text-[17px] font-semibold text-teal-200" style={{ left: LANE_X + PAR_DONE, top: 396, ...later(1400) }}>
        all five ready for review
      </div>
      <div className="pz-appear absolute border-l-2 border-dashed border-blue-400/60" style={{ left: LANE_X + LANE_W - 2, top: -6, height: 390, ...later(3300) }} />
      <div className="pz-appear absolute -translate-x-full whitespace-nowrap pr-3 text-[16px] text-blue-200" style={{ left: LANE_X + LANE_W, top: 64, ...later(3300) }}>
        …all five, one after another
      </div>
      <div className="pz-appear absolute text-[22px] text-muted" style={{ left: LANE_X + PAR_DONE + 40, top: 200, ...later(3600) }}>
        ← the time you get back
      </div>
    </Replay>
  );
}

const LIMITS = [
  ['🔀', 'Context switching', 'keeping several runs in your head at once'],
  ['🧩', 'Complexity', 'how big a change an agent can carry'],
  ['🗂️', 'Triage', 'which issues should run — and which shouldn’t'],
];

function LimitsBeat({ on }) {
  return (
    <>
      {/* the point: parallel work is the unlock */}
      <Show on={on} from="scale" style={at(80, 40, 1440, 190)} className="pz-glow flex flex-col items-center justify-center rounded-3xl border border-teal-400/60 bg-raised text-center">
        <div className="font-mono text-[15px] uppercase tracking-[0.2em] text-teal-300">the real unlock</div>
        <div className="mt-2 font-display text-[60px] leading-tight text-ink">Consistently parallelise the work.</div>
      </Show>

      {/* what actually limits it */}
      <Show on={on} delay={600} style={at(80, 270, 1440, 30)}>
        <Kicker>What actually limits it</Kicker>
      </Show>
      {LIMITS.map(([icon, h, sub], i) => (
        <Show key={h} on={on} from="up" delay={800 + i * 180} style={at(80 + i * 490, 305, 460, 130)} className={`${box} flex items-center gap-5 px-7`}>
          <span className="text-[40px]">{icon}</span>
          <div>
            <div className="font-display text-[28px] text-ink">{h}</div>
            <div className="mt-1 text-[17px] text-muted">{sub}</div>
          </div>
        </Show>
      ))}

      {/* tokens: a footnote, on purpose */}
      <Show on={on} from="none" delay={1800} style={at(80, 480, 1440, 40)} className="flex items-center justify-center gap-3 text-[18px] text-faint">
        <span>🪙</span>
        <span>Worried about tokens — especially at the individual level? <span className="text-muted">You’re worried about the wrong thing.</span></span>
      </Show>
    </>
  );
}

function ParallelScene({ step }) {
  return (
    <Below>
      <ParallelBeat on={step === 0} />
      <LimitsBeat on={step === 1} />
    </Below>
  );
}

/* ------------------------------------------------------------------ *
 * The takeaway, in one line.
 * ------------------------------------------------------------------ */

const SUM = [
  ['📚', 'Shared context', 'baked into how you work'],
  ['🧰', 'Well-built harnesses', 'product and engineering'],
];
const RESULT = [
  ['🔗', 'Connect the stakeholders', 'across the whole SDLC'],
  ['⫴', 'Parallelise the work', 'not one ticket at a time'],
];

function Term({ icon, h, s, delay, tone = 'border-edge bg-surface' }) {
  return (
    <div className={`pz-appear flex h-[150px] w-[300px] flex-col items-center justify-center rounded-2xl border text-center ${tone}`} style={later(delay)}>
      <span className="text-[34px] leading-none">{icon}</span>
      <span className="mt-2 text-[21px] font-semibold text-ink">{h}</span>
      <span className="text-[15px] text-faint">{s}</span>
    </div>
  );
}

function TakeawayScene() {
  return (
    <Below>
    <Show style={at(80, 90, 1440, 480)} className="flex flex-col items-center">
      <div className="mt-10 flex items-center gap-5">
        <Term {...{ icon: SUM[0][0], h: SUM[0][1], s: SUM[0][2] }} delay={200} />
        <span className="pz-appear text-[40px] text-blue-300" style={later(400)}>+</span>
        <Term {...{ icon: SUM[1][0], h: SUM[1][1], s: SUM[1][2] }} delay={500} />
        <span className="pz-appear text-[40px] text-blue-300" style={later(800)}>→</span>
        <div className="flex flex-col gap-3">
          {RESULT.map(([icon, h, s], i) => (
            <div key={h} className="pz-appear flex h-[69px] w-[340px] items-center gap-4 rounded-xl border border-blue-400/50 bg-blue-500/10 px-5" style={later(1000 + i * 200)}>
              <span className="text-[26px]">{icon}</span>
              <div><div className="text-[19px] font-semibold text-ink">{h}</div><div className="text-[14px] text-faint">{s}</div></div>
            </div>
          ))}
        </div>
      </div>
      <div className="pz-appear mt-12 font-display text-[58px] leading-none text-ink" style={later(1700)}>
        → <span className="pz-shine bg-clip-text text-transparent">accelerated delivery</span>
      </div>
    </Show>
    </Below>
  );
}

/* ------------------------------------------------------------------ *
 * Today — two labs, lunch, then teams. Then over to Abraham.
 * ------------------------------------------------------------------ */

const PLAN = [
  { icon: '🎙️', when: 'Lab 1', title: 'The product harness', sub: 'revolves around context: a conversation → a ticket', who: 'abraham' },
  { icon: '🚢', when: 'Lab 2', title: 'The engineering harness', sub: 'uses and curates that same context to run work in parallel', who: 'jonas' },
  { icon: '🍽️', when: 'Then', title: 'Lunch', sub: '', who: null },
  { icon: '👥', when: 'After lunch', title: 'Teams evolve the app', sub: 'complementary disciplines, one shared, planned foundation', who: null },
  { icon: '🎤', when: 'To close', title: 'Teams present', sub: 'what each team built, and how it got there', who: null },
];
const PLAN_W = 268;
const PLAN_X = (i) => 80 + i * (PLAN_W + 25);
const NAMES = { abraham: 'Abraham Marín Pérez', jonas: 'Jonas Claesson' };

function TodayScene({ step, leaving, advance }) {
  return (
    <>
      {/* beat 0: the plan */}
      <Below>
      {PLAN.map((p, i) => (
        <Show key={p.title} on={step === 0} from="up" delay={200 + i * 220} style={at(PLAN_X(i), 50, PLAN_W, 420)} className={`${box} flex flex-col p-6 ${p.title === 'Lunch' ? 'opacity-70' : ''}`}>
          <div className="font-mono text-[15px] uppercase tracking-[0.18em] text-faint">{p.when}</div>
          <span className="mt-4 text-[44px] leading-none">{p.icon}</span>
          <div className="mt-4 font-display text-[27px] leading-tight text-ink">{p.title}</div>
          {p.sub && <div className="mt-2 text-[17px] leading-snug text-muted">{p.sub}</div>}
          {p.who && (
            <div className="mt-auto flex items-center gap-3 text-[16px] text-faint">
              <Face who={p.who} size={34} /> {NAMES[p.who]}
            </div>
          )}
        </Show>
      ))}
      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${PLAN_X(i) + PLAN_W} 260 L${PLAN_X(i + 1)} 260`} pathLength="1" data-on={step === 0} className="pz-draw" fill="none" stroke="#60a5fa" strokeWidth="3" style={{ transitionDelay: `${900 + i * 220}ms` }} />
        ))}
      </svg>
      <Show on={step === 0} from="none" delay={1300} style={at(80, 500, 1460, 50)} className="flex items-center">
        <span className="h-0.5 rounded-full bg-gradient-to-r from-cyan-400/80 to-blue-400/80" style={{ width: 700 }} />
        <span className="ml-4 text-[16px] text-muted">📚 one shared context, under both labs and every team</span>
      </Show>
      </Below>

      {/* beat 1: over to the product harness — laid out like its title, rings in the same place, so the warp lands on them */}
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
          <div style={at(110, 150, 820, 460)} className="flex flex-col items-start">
            <div data-eyebrow className="mb-4 text-[18px] font-semibold uppercase tracking-[0.2em] text-edge">Handing over</div>
            <div className="space-y-1.5 whitespace-nowrap text-[22px]">
              <div className="flex items-center gap-3 text-muted"><Tick /> 🛰️ Why: the core concepts</div>
              <div className="pz-appear text-ink" style={later(500)}><span className="mr-3 text-blue-300">↳</span>🎙️ <b>Lab 1 · the product harness</b></div>
            </div>
            <div data-deck-title className="pz-appear mt-14 font-display text-[64px] font-bold leading-none text-ink" style={later(700)}>
              Over to <span className="pz-shine bg-clip-text text-transparent">Abraham</span>.
            </div>
            <button
              type="button"
              data-testid="presentation-handoff"
              aria-label="Continue to the product harness"
              onClick={(e) => { e.stopPropagation(); advance(); }}
              className="pz-launch pz-pop mt-10 inline-flex items-center gap-3 rounded-full border border-cyan-300/60 bg-gradient-to-r from-blue-600 to-cyan-500 px-10 py-4 font-display text-[28px] text-white hover:from-blue-500 hover:to-cyan-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
              style={later(900)}
            >
              Continue to the product harness <span aria-hidden="true">→</span>
            </button>
            <div className="pz-appear mt-3 text-[15px] text-faint" style={later(1500)}>or press → as usual</div>
          </div>
        </motion.div>
      </Show>
    </>
  );
}

export const OPENING = [
  {
    id: 'title', name: 'Welcome', accent: 'text-teal-300', tone: 'emerald',
    beats: [null],
    Scene: TitleScene,
  },
  {
    id: 'where', name: 'Where we are', accent: 'text-amber-300', tone: 'amber',
    beats: [
      {
        kicker: '1 · Where we are',
        title: 'Everyone here is on their own AI journey',
        body: 'It’s unavoidable: developers, product, design, QA and the business are all using AI. But unevenly — not everyone has felt the same acceleration.',
      },
      {
        kicker: '1 · Where we are',
        title: 'The lifecycle often isn’t connected',
        body: 'Product, design, engineering and QA often work in their own tools — each with its own memory of what was decided.',
      },
      {
        kicker: '1 · Where we are',
        title: 'Work is still run serially — and babysat',
        body: 'One ticket at a time, with someone watching the agent the whole way through.',
      },
    ],
    Scene: WhereScene,
  },
  {
    id: 'pattern', name: 'A familiar pattern', accent: 'text-sky-300', tone: 'sky',
    beats: [
      {
        kicker: '2 · A familiar pattern',
        title: 'Transformation of any kind follows the same shape',
        body: 'Step back. Understand where you are today. Build a roadmap to where you want to go. Then execute it in an agile way — but with a goal in mind.',
      },
    ],
    Scene: PatternScene,
  },
  {
    id: 'context', name: 'Lesson 1 · Shared context', accent: 'text-teal-300', tone: 'emerald',
    beats: [
      {
        lesson: { label: 'Lesson one', n: '1' },
        kicker: 'Shared context',
        title: 'Shared context connects the SDLC — and beyond',
        body: 'Creating and curating a shared context across disciplines and harnesses is the foundation of a connected SDLC, whatever tools you choose. And marketing, security and executives can tap into it too, for their own needs.',
      },
      {
        lesson: { label: 'Lesson one', n: '1' },
        kicker: 'What we mean by context',
        title: 'Markdown, living in version control',
        body: '“Context” is an overloaded word. Here it means markdown files in the repo, next to the code — read by every person and every agent, and changed the way code is: on a branch, reviewed, merged.',
      },
    ],
    Scene: ContextScene,
  },
  {
    id: 'parallel', name: 'Lesson 2 · Parallel work', accent: 'text-blue-300', tone: 'violet',
    beats: [
      {
        lesson: { label: 'Lesson two', n: '2' },
        kicker: 'Parallel work',
        title: 'Parallel workflows are the big leap in engineering',
        body: 'Running engineering work in parallel — not one babysat ticket after another — is what truly accelerates engineering with AI.',
      },
      {
        lesson: { label: 'Lesson two', n: '2' },
        kicker: 'The limits',
        title: 'The limits are real — the unlock is still parallel work',
        body: 'There is a lot to optimise. But what accelerates your work is running it in parallel, consistently.',
      },
    ],
    Scene: ParallelScene,
  },
  {
    id: 'takeaway', name: 'The takeaway', accent: 'text-cyan-300', tone: 'cyan',
    beats: [
      {
        kicker: '5 · What we hope you take away',
        title: 'Connect the lifecycle — then run it in parallel',
        body: 'Shared context, baked into the way you work, plus well-constructed harnesses: that connects the stakeholders across the SDLC, and lets you parallelise work to accelerate delivery.',
      },
    ],
    Scene: TakeawayScene,
  },
  {
    id: 'today', name: 'Today', accent: 'text-cyan-300', tone: 'fuchsia',
    beats: [
      {
        kicker: '6 · Today',
        title: 'Two hands-on labs, lunch, then teams build — and present',
        body: 'Lab one: a product harness that revolves around context. Lab two: an engineering harness that uses and curates it to run work in parallel. After lunch, teams evolve the app, then present what they built.',
      },
      null,
    ],
    Scene: TodayScene,
  },
];
