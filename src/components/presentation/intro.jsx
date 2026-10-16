import { motion } from 'motion/react';
import { at, Show, Replay, Code, Label, Terminal, IssueCard, IssueIcon, PrIcon, MergeIcon, Kicker, Token, later } from './kit.jsx';
import { STATIONS, Station, SX, STATION_W, STATION_Y, RAIL_Y, TOKEN_PARK } from './ship.jsx';

/* ------------------------------------------------------------------ *
 * Title — where we are, and where this talk starts.
 * ------------------------------------------------------------------ */

export function Orbits({ style = at(940, 20, 640, 640), className = '' }) {
  const rings = [
    { r: 120, dur: '26s', words: ['spec', 'gate'] },
    { r: 200, dur: '38s', words: ['audit', 'skeptic', 'red-check'] },
    { r: 280, dur: '54s', words: ['review', 'QA', 'learn', 'merge'] },
  ];
  return (
    <svg viewBox="0 0 640 640" style={style} className={className} aria-hidden="true">
      <defs>
        <radialGradient id="pz-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#8b5cf6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="320" cy="320" r="70" fill="url(#pz-core)" />
      <text x="320" y="331" textAnchor="middle" fontSize="34">🚢</text>
      {rings.map((ring, i) => (
        <g key={ring.r}>
          <circle cx="320" cy="320" r={ring.r} fill="none" stroke="#333950" strokeDasharray={i === 1 ? '4 8' : undefined} />
          <g className="pz-spin" style={{ transformOrigin: '320px 320px', animationDuration: ring.dur, animationDirection: i % 2 ? 'reverse' : 'normal' }}>
            {ring.words.map((w, j) => {
              const a = (j / ring.words.length) * Math.PI * 2 + i;
              const x = 320 + Math.cos(a) * ring.r;
              const y = 320 + Math.sin(a) * ring.r;
              return (
                <g key={w}>
                  <circle cx={x} cy={y} r="6" fill={['#a78bfa', '#67e8f9', '#6ee7b7'][i]} />
                  <text x={x + 12} y={y + 5} fill="#9aa2b8" fontSize="15" fontFamily="JetBrains Mono, monospace">{w}</text>
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
      <Orbits />
      <div style={at(110, 150, 900, 420)}>
        <Kicker className="pz-appear">ORBIT &rsquo;26 · AI across the software delivery lifecycle</Kicker>
        <h1 className="pz-appear mt-6 font-display text-[112px] leading-[0.92] text-ink" style={later(120)}>
          The engineering<br />
          <span className="pz-shine bg-clip-text text-transparent">harness</span>
        </h1>
        <p className="pz-appear mt-7 max-w-[760px] text-[27px] leading-snug text-muted" style={later(260)}>
          From a GitHub issue to a reviewed pull request — and every agent in between.
        </p>
        <div className="pz-appear mt-10 flex items-center gap-4 text-[19px] text-faint" style={later(900)}>
          <span>🎙️ Product harness: a conversation → a ticket</span>
          <span className="text-violet-300">→</span>
          <span className="text-muted">🚢 <b className="text-ink">Engineering harness</b>: the ticket → a reviewed pull request</span>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The issue arrives.
 * ------------------------------------------------------------------ */

const DONE_WHEN = [
  'At a phone-width viewport on /schedule, the first session card is visible without scrolling past the full filter block.',
  'Every filter (day, track, venue, level, format, topic, search) is still reachable on mobile.',
  'Existing mobile specs still pass.',
];

const CONTEXT = [
  { name: 'CLAUDE.md', what: 'decisions and why', x: 70, y: 110, side: 'left' },
  { name: 'docs/context/schedule.md', what: 'where it lives', x: 70, y: 260, side: 'left' },
  { name: '.claude/rules/ui.md', what: 'UI conventions', x: 70, y: 410, side: 'left' },
  { name: 'docs/context/testing.md', what: 'how to prove it', x: 1240, y: 150, side: 'right' },
  { name: 'specs/', what: 'every past plan', x: 1240, y: 330, side: 'right' },
];

/* One beat: the card lands, the Done when lines draw in, then the context it
 * carries flies in around it. */
const DOCS_AT = 2200;

function IssueScene() {
  return (
    <>
      <svg viewBox="0 0 1600 900" className="absolute inset-0" aria-hidden="true">
        {CONTEXT.map((c, i) => {
          const fromX = c.side === 'left' ? c.x + 290 : c.x;
          const toX = c.side === 'left' ? 390 : 1210;
          const d = `M${fromX} ${c.y + 34} C ${(fromX + toX) / 2} ${c.y + 34}, ${(fromX + toX) / 2} 330, ${toX} 330`;
          return (
            <g key={c.name}>
              <path d={d} pathLength="1" className="pz-draw-in" fill="none" stroke="#4c3d7a" strokeWidth="2" style={later(DOCS_AT + 300 + i * 120)} />
              <g className="pz-appear" style={later(DOCS_AT + 1200 + i * 120)}>
                <path d={d} pathLength="1" className="pz-flow" fill="none" stroke="#a78bfa" strokeWidth="2" opacity="0.8" />
              </g>
            </g>
          );
        })}
      </svg>

      <div className="pz-arrive" style={at(400, 70, 800, 540)}>
        <IssueCard number={140} title="Keep sessions in view on mobile: stop the stacked filters filling the screen" className="h-full">
          <div className="px-7 py-5 text-[17px] leading-relaxed text-muted">
            <p><b className="text-ink">Why:</b> on a phone the day tabs, track pills and venue filter stack at full width, so an attendee scrolls past the whole filter block before seeing a single session.</p>
            <div className="mt-4 font-display text-[22px] text-ink">Done when</div>
            <ul className="mt-2 space-y-2.5">
              {DONE_WHEN.map((d, i) => (
                <Show key={d} as="li" from="left" delay={900 + i * 300} className="flex gap-3">
                  <span className="mt-1 size-[18px] shrink-0 rounded border-2 border-violet-400/70" />
                  <span className="text-ink/90">{d}</span>
                </Show>
              ))}
            </ul>
          </div>
        </IssueCard>
      </div>

      {CONTEXT.map((c, i) => (
        <Show key={c.name} from={c.side} delay={DOCS_AT + i * 120} style={at(c.x, c.y, 290, 68)}
          className="rounded-xl border border-hairline bg-raised px-4 py-2.5">
          <div className="font-mono text-[15px] text-ink">{c.name}</div>
          <div className="text-[14px] text-faint">{c.what}</div>
        </Show>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Two ways in.
 * ------------------------------------------------------------------ */

const DOORS = ['M800 58 C 800 96, 420 72, 420 112', 'M800 58 C 800 96, 1180 72, 1180 112'];

/* One beat, both doors at once: the label lands on the left and the Actions
 * runner picks it up; /ship types on the right; both roads join at ship.js. */
const JOIN_AT = 3200;

function TwoWaysScene() {
  return (
    <>
      {/* the same ticket, above both doors */}
      <Token className="absolute" initial={{ left: 759, top: 22, opacity: 0, scale: 0.6 }} animate={{ left: 759, top: 22, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 0.2 }} />
      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        {DOORS.map((d, i) => (
          <g key={d}>
            <path d={d} pathLength="1" className="pz-draw-in" fill="none" stroke="#6d28d9" strokeWidth="2.5" style={later(500 + i * 150)} />
            <g className="pz-appear" style={later(1300)}>
              <path d={d} pathLength="1" className="pz-flow" fill="none" stroke="#c4b5fd" strokeWidth="2.5" />
            </g>
          </g>
        ))}
      </svg>

      <div style={at(80, 112, 680, 408)} className="card relative p-7">
        <Kicker>🌐 In GitHub — no terminal</Kicker>
        <div className="mt-2 font-display text-[34px] text-ink">Label it</div>
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-hairline bg-raised px-4 py-3">
          <IssueIcon className="size-5 text-emerald-400" />
          <span className="text-[18px] text-ink">#140 Keep sessions in view on mobile</span>
          <span className="ml-auto flex gap-2">
            <span className="pz-pop" style={later(700)}><Label name="ready-for-ai" /></span>
          </span>
        </div>
        <Replay delay={1100} className="mt-5 overflow-hidden rounded-xl border border-hairline bg-[#0d0f15]">
          <div className="flex items-center gap-2 border-b border-hairline px-4 py-2 font-mono text-[13px] text-faint">
            <span className="size-2 rounded-full bg-amber-400 animate-pulse-dot" /> Actions · agent-ship.yml
          </div>
          <div className="space-y-1 px-4 py-3 font-mono text-[15px] text-muted">
            <div className="pz-appear" style={later(500)}>on: issues · labeled <span className="text-violet-300">ready-for-ai</span></div>
            <div className="pz-appear" style={later(800)}>runs-on: ubuntu-latest · a fresh machine</div>
            <div className="pz-appear text-ink" style={later(1100)}>claude › /ship 140</div>
            <div className="pz-appear text-sky-300" style={later(1500)}>#140 → ai-working · progress posted on the issue</div>
          </div>
          <div className="relative h-1 overflow-hidden bg-overlay"><div className="pz-scan absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-violet-400 to-transparent" /></div>
        </Replay>
      </div>

      <div style={at(840, 112, 680, 408)} className="card p-7">
        <Kicker>💻 In Claude Code — your terminal</Kicker>
        <div className="mt-2 font-display text-[34px] text-ink">Ship it</div>
        <Terminal
          className="mt-5"
          title="~/nam-2026-conference — claude"
          bodyClass="min-h-[228px] text-[16px]"
          lines={[
            { t: 'Ready. What should we build?', tone: 'dim' },
            { t: '/ship 140', tone: 'cmd', delay: 700 },
            { t: 'setup · reading #140 and the code it touches', delay: 1600 },
            { t: 'worktree  .claude/worktrees/wt-140', delay: 2000 },
            { t: 'lane 3 → api :4306 · web :4307', delay: 2400 },
            { t: '#140 → ai-working', tone: 'ok', delay: 2800 },
          ]}
        />
      </div>

      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        {['M420 520 C 420 560, 560 576, 640 576', 'M1180 520 C 1180 560, 1040 576, 960 576'].map((d) => (
          <g key={d}>
            <path d={d} pathLength="1" className="pz-draw-in" fill="none" stroke="#6d28d9" strokeWidth="3" style={later(JOIN_AT)} />
            <g className="pz-appear" style={later(JOIN_AT + 1000)}>
              <path d={d} pathLength="1" className="pz-flow" fill="none" stroke="#c4b5fd" strokeWidth="3" />
            </g>
          </g>
        ))}
      </svg>
      <Show from="pop" delay={JOIN_AT + 600} style={at(640, 548, 320, 58)}
        className="pz-glow grid place-items-center rounded-full border border-violet-400/60 bg-raised font-display text-[22px] text-ink">
        <span>🚢 ship.js <span className="text-muted">— one script</span></span>
      </Show>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The whole flow, then a zoom into ship.
 * ------------------------------------------------------------------ */

const NODES = [
  { id: 'issue',  x: 70,   y: 250, w: 200, h: 120, icon: <IssueIcon className="size-7 text-emerald-400" />, label: 'Issue', sub: 'Done when…' },
  { id: 'ship',   x: 360,  y: 210, w: 300, h: 200, icon: <span className="text-[34px]">🚢</span>, label: 'Ship', sub: 'spec · build · gate · audit · loop' },
  { id: 'pr',     x: 760,  y: 250, w: 200, h: 120, icon: <PrIcon className="size-7 text-emerald-400" />, label: 'Pull request', sub: 'ready for review' },
  { id: 'review', x: 1060, y: 140, w: 220, h: 110, icon: <span className="text-[26px]">🔍</span>, label: 'Code review', sub: 'a runner' },
  { id: 'qa',     x: 1060, y: 370, w: 220, h: 110, icon: <span className="text-[26px]">🧪</span>, label: 'QA', sub: 'a runner, a browser' },
  { id: 'merge',  x: 1360, y: 250, w: 190, h: 120, icon: <MergeIcon className="size-7 text-violet-300" />, label: 'A person merges', sub: 'always' },
];

const EDGES = [
  'M270 310 L360 310',
  'M660 310 L760 310',
  'M960 310 C 1010 310, 1010 195, 1060 195',
  'M960 310 C 1010 310, 1010 425, 1060 425',
  'M1280 195 C 1320 195, 1320 310, 1360 310',
  'M1280 425 C 1320 425, 1320 310, 1360 310',
];

/**
 * The zoom's landing: the ten steps fly out of the Ship node into the exact
 * places the next chapter draws its stations, the rail and the parked ticket
 * fade in under them, and the chapter that follows cuts straight onto them.
 */
function Unpack() {
  return (
    <>
      {STATIONS.map((s, i) => (
        <motion.div
          key={s.id}
          className="absolute"
          style={{ width: STATION_W, height: 84 }}
          initial={{ left: 800 - STATION_W / 2, top: 330 - 42, opacity: 0, scale: 0.25 }}
          animate={{ left: SX(i), top: STATION_Y, opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 110, damping: 17, delay: 0.55 + i * 0.07, opacity: { duration: 0.3, delay: 0.55 + i * 0.07 } }}
        >
          <Station s={s} />
        </motion.div>
      ))}
      <motion.div style={at(80, RAIL_Y, 1440, 2)} className="rounded-full bg-hairline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.2 }} />
      <Token className="absolute" initial={{ ...TOKEN_PARK, opacity: 0, scale: 0.5 }} animate={{ ...TOKEN_PARK, opacity: 1, scale: 0.9 }} transition={{ type: 'spring', stiffness: 140, damping: 14, delay: 1.45 }} />
    </>
  );
}

/* Two beats: the whole flow (with its fresh-agent badges and the needs-human
 * way back arriving after a pause), then the zoom into ship. */
const AGENTS_AT = 2200;

function MapScene({ step }) {
  const zoom = step >= 1;
  return (
    <>
    {/* the camera: ship's centre (510, 310) lands at stage (800, 330), 2.3× closer — then recedes behind the stations */}
    <motion.div
      className="absolute inset-0"
      style={{ originX: 0, originY: 0 }}
      animate={zoom ? { x: 800 - 510 * 2.3, y: 330 - 310 * 2.3, scale: 2.3, opacity: 0.16 } : { x: 0, y: 0, scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 45, damping: 16, mass: 1.1, opacity: { duration: 0.9, delay: zoom ? 0.8 : 0 } }}
    >
      <svg viewBox="0 0 1600 900" className="absolute inset-0" aria-hidden="true">
        {EDGES.map((d, i) => (
          <g key={d} className={`transition-opacity duration-700 ${zoom ? 'opacity-10' : ''}`}>
            <path d={d} pathLength="1" className="pz-draw-in" fill="none" stroke="#4c3d7a" strokeWidth="3" style={later(200 + i * 160)} />
            <g className="pz-appear" style={later(1200 + i * 160)}>
              <path d={d} pathLength="1" className="pz-flow" fill="none" stroke="#a78bfa" strokeWidth="3" />
            </g>
          </g>
        ))}
        <g className={`transition-opacity duration-700 ${zoom ? 'opacity-10' : ''}`}>
          <path d="M510 410 L510 480" pathLength="1" className="pz-draw-in" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 8" style={later(AGENTS_AT + 900)} />
          <path d="M410 525 C 250 525, 170 470, 170 372" pathLength="1" className="pz-draw-in" fill="none" stroke="#f59e0b" strokeWidth="3" style={later(AGENTS_AT + 1300)} />
        </g>
      </svg>

      {NODES.map((n, i) => (
        <div
          key={n.id}
          style={{ ...at(n.x, n.y, n.w, n.h), animationDelay: `${i * 140}ms` }}
          className={`pz-appear flex flex-col items-center justify-center rounded-2xl border text-center transition-opacity duration-700
            ${n.id === 'ship' ? 'pz-glow border-violet-400/60 bg-raised' : 'border-hairline bg-surface'}
            ${zoom && n.id !== 'ship' ? 'opacity-10' : ''}`}
        >
          {n.icon}
          <div className={`mt-1.5 font-display ${n.id === 'ship' ? 'text-[34px]' : 'text-[22px]'} text-ink`}>{n.label}</div>
          <div className="text-[14px] text-faint">{n.sub}</div>
          <Show on={!zoom} from="pop" delay={AGENTS_AT + i * 90} className="absolute -top-3 right-3 rounded-full border border-sky-400/50 bg-sky-500/20 px-2 font-mono text-[12px] text-sky-200">
            fresh agent
          </Show>
        </div>
      ))}

      {/* the ticket, on its way in: out of the issue and up to ship's door */}
      <Token
        className="absolute"
        initial={{ left: 170 - 41, top: 296, opacity: 0, scale: 0.6 }}
        animate={{ left: 300 - 41, top: 296, opacity: zoom ? 0 : 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 60, damping: 14, delay: 1.4, opacity: { duration: 0.4, delay: zoom ? 0 : 1.4 } }}
      />

      <Show on={!zoom} from="up" delay={AGENTS_AT + 1100} style={at(410, 480, 200, 90)}
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-400/60 bg-amber-500/10">
        <Label name="needs-human" />
        <div className="mt-1 text-[14px] text-amber-200/80">draft PR · back to you</div>
      </Show>

      <Show on={!zoom} delay={AGENTS_AT + 1500} style={at(720, 520, 820, 80)} className="flex items-center gap-4 rounded-2xl border border-hairline bg-surface/80 px-6">
        <span className="text-[30px]">📜</span>
        <span className="text-[20px] text-muted"><b className="text-ink">Scripts, not prompts.</b> The loops, round limits and who judges what are code in <Code>.claude/workflows/</Code></span>
      </Show>
    </motion.div>
    {zoom && <Unpack />}
    </>
  );
}

export const INTRO = [
  {
    id: 'title', name: 'The engineering harness', accent: 'text-violet-300', tone: 'violet',
    beats: [null],
    Scene: TitleScene,
  },
  {
    id: 'issue', name: 'The ticket', accent: 'text-emerald-300', tone: 'emerald',
    beats: [
      {
        kicker: '1 · The ticket',
        title: 'A GitHub issue, with a Done when a test can check',
        body: 'The product harness turned a conversation into this: why, what should change, and the Done when list every later agent is judged against. It arrives carrying its context — the docs the agents read instead of the source.',
      },
    ],
    Scene: IssueScene,
  },
  {
    id: 'start', name: 'Two ways in', accent: 'text-sky-300', tone: 'sky',
    beats: [
      {
        kicker: '2 · Starting it',
        title: 'Label it on GitHub, or /ship it in Claude Code — same script',
        body: 'ready-for-ai starts a fresh Actions runner that claims the issue and posts progress there; /ship 140 gives it its own worktree and ports locally. Either way it is ship.js — where it runs only changes who pays.',
      },
    ],
    Scene: TwoWaysScene,
  },
  {
    id: 'map', name: 'The whole flow', accent: 'text-violet-300', tone: 'violet',
    beats: [
      {
        kicker: '3 · The whole flow',
        title: 'Issue → ship → pull request → review and QA → you',
        body: 'Ship turns the ticket into a pull request; two more agents review it and try to break it; a person merges. Every step is a fresh agent — and a ticket that will not come together comes back as needs-human.',
      },
      {
        kicker: '3 · Zooming in',
        title: 'Inside ship',
        body: 'Ten steps, one loop. Let’s walk through them with ticket #140.',
      },
    ],
    Scene: MapScene,
  },
];
