import { motion } from 'motion/react';
import { at, Show, Replay, Code, Label, Terminal, IssueCard, IssueIcon, PrIcon, MergeIcon, Kicker, later } from './kit.jsx';

/* ------------------------------------------------------------------ *
 * Title — where we are, and where this talk starts.
 * ------------------------------------------------------------------ */

function Orbits() {
  const rings = [
    { r: 120, dur: '26s', words: ['spec', 'gate'] },
    { r: 200, dur: '38s', words: ['audit', 'skeptic', 'red-check'] },
    { r: 280, dur: '54s', words: ['review', 'QA', 'learn', 'merge'] },
  ];
  return (
    <svg viewBox="0 0 640 640" style={at(940, 20, 640, 640)} aria-hidden="true">
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

function TitleScene({ step }) {
  return (
    <>
      <Orbits />
      <div
        className="transition-transform duration-700 ease-out"
        style={{ ...at(110, 150, 900, 420), transform: step >= 1 ? 'translateY(-60px) scale(0.86)' : 'none', transformOrigin: 'left top' }}
      >
        <Kicker className="pz-appear">ORBIT &rsquo;26 · AI across the software delivery lifecycle</Kicker>
        <h1 className="pz-appear mt-6 font-display text-[112px] leading-[0.92] text-ink" style={later(120)}>
          The engineering<br />
          <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">harness</span>
        </h1>
        <p className="pz-appear mt-7 max-w-[760px] text-[27px] leading-snug text-muted" style={later(260)}>
          From a GitHub issue to a reviewed pull request — and every agent in between.
        </p>
      </div>

      <Show on={step >= 1} style={at(110, 440, 1300, 150)} className="flex items-center gap-6">
        <div className="flex-1 rounded-2xl border border-hairline bg-surface/70 px-7 py-5 opacity-60">
          <Kicker>Already done</Kicker>
          <div className="mt-2 font-display text-[30px] text-muted">🎙️ Product harness</div>
          <div className="text-[18px] text-faint">a conversation → tickets with a <b>Done when</b></div>
        </div>
        <svg viewBox="0 0 80 40" className="w-20 shrink-0" aria-hidden="true">
          <path d="M2 20 H70 M58 8 L72 20 L58 32" fill="none" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="pz-glow flex-1 rounded-2xl border border-violet-400/50 bg-raised px-7 py-5">
          <Kicker className="text-violet-300">This talk</Kicker>
          <div className="mt-2 font-display text-[30px] text-ink">🚢 Engineering harness</div>
          <div className="text-[18px] text-muted">a ticket → a reviewed pull request, on its own</div>
        </div>
      </Show>
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

function IssueScene({ step }) {
  return (
    <>
      <svg viewBox="0 0 1600 900" className="absolute inset-0" aria-hidden="true">
        {CONTEXT.map((c, i) => {
          const fromX = c.side === 'left' ? c.x + 290 : c.x;
          const toX = c.side === 'left' ? 390 : 1210;
          const d = `M${fromX} ${c.y + 34} C ${(fromX + toX) / 2} ${c.y + 34}, ${(fromX + toX) / 2} 330, ${toX} 330`;
          return (
            <g key={c.name}>
              <path d={d} pathLength="1" data-on={step >= 2} className="pz-draw" fill="none" stroke="#4c3d7a" strokeWidth="2" style={{ transitionDelay: `${300 + i * 120}ms` }} />
              {step >= 2 && <path d={d} pathLength="1" className="pz-flow" fill="none" stroke="#a78bfa" strokeWidth="2" opacity="0.8" />}
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
                <Show key={d} as="li" on={step >= 1} from="left" delay={i * 260} className="flex gap-3">
                  <span className="mt-1 size-[18px] shrink-0 rounded border-2 border-violet-400/70" />
                  <span className="text-ink/90">{d}</span>
                </Show>
              ))}
            </ul>
          </div>
        </IssueCard>
      </div>

      {CONTEXT.map((c, i) => (
        <Show key={c.name} on={step >= 2} from={c.side} delay={i * 120} style={at(c.x, c.y, 290, 68)}
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

function TwoWaysScene({ step }) {
  const focus = (side) => (step === 1 && side === 'right') || (step === 2 && side === 'left') ? 'opacity-35 scale-[0.98]' : '';
  return (
    <>
      <div style={at(80, 70, 680, 450)} className={`card p-7 transition-all duration-700 ${focus('left')}`}>
        <Kicker>🌐 In GitHub — no terminal</Kicker>
        <div className="mt-2 font-display text-[34px] text-ink">Label it</div>
        <div className="mt-5 flex items-center gap-3 rounded-xl border border-hairline bg-raised px-4 py-3">
          <IssueIcon className="size-5 text-emerald-400" />
          <span className="text-[18px] text-ink">#140 Keep sessions in view on mobile</span>
          <span className="ml-auto flex gap-2">
            {step >= 1 && <span className="pz-pop"><Label name="ready-for-ai" /></span>}
          </span>
        </div>
        <Replay on={step >= 1} delay={450} className="mt-5 overflow-hidden rounded-xl border border-hairline bg-[#0d0f15]">
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

      <div style={at(840, 70, 680, 450)} className={`card p-7 transition-all duration-700 ${focus('right')}`}>
        <Kicker>💻 In Claude Code — your terminal</Kicker>
        <div className="mt-2 font-display text-[34px] text-ink">Ship it</div>
        <Terminal
          className="mt-5"
          title="~/nam-2026-conference — claude"
          step={step >= 2 ? 2 : 0}
          bodyClass="min-h-[200px] text-[16px]"
          lines={[
            { t: 'Ready. What should we build?', tone: 'dim' },
            { t: '/ship 140', tone: 'cmd', from: 2 },
            { t: 'setup · reading #140 and the code it touches', from: 2, delay: 900 },
            { t: 'worktree  .claude/worktrees/wt-140', from: 2, delay: 1300 },
            { t: 'lane 3 → api :4306 · web :4307', from: 2, delay: 1700 },
            { t: '#140 → ai-working', tone: 'ok', from: 2, delay: 2100 },
          ]}
        />
      </div>

      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        {['M420 520 C 420 560, 560 576, 640 576', 'M1180 520 C 1180 560, 1040 576, 960 576'].map((d) => (
          <g key={d}>
            <path d={d} pathLength="1" data-on={step >= 3} className="pz-draw" fill="none" stroke="#6d28d9" strokeWidth="3" />
            {step >= 3 && <path d={d} pathLength="1" className="pz-flow" fill="none" stroke="#c4b5fd" strokeWidth="3" />}
          </g>
        ))}
      </svg>
      <Show on={step >= 3} from="pop" delay={700} style={at(640, 548, 320, 58)}
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

function MapScene({ step }) {
  const zoom = step >= 2;
  return (
    // the camera: ship's centre (510, 310) lands at stage (800, 330), 2.3× closer
    <motion.div
      className="absolute inset-0"
      style={{ originX: 0, originY: 0 }}
      animate={zoom ? { x: 800 - 510 * 2.3, y: 330 - 310 * 2.3, scale: 2.3 } : { x: 0, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 45, damping: 16, mass: 1.1 }}
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
          <path d="M510 410 L510 480" pathLength="1" data-on={step >= 1} className="pz-draw" fill="none" stroke="#f59e0b" strokeWidth="3" strokeDasharray="6 8" />
          <path d="M410 525 C 250 525, 170 470, 170 372" pathLength="1" data-on={step >= 1} className="pz-draw" fill="none" stroke="#f59e0b" strokeWidth="3" style={{ transitionDelay: '400ms' }} />
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
          {!(zoom && n.id === 'ship') && <div className="text-[14px] text-faint">{n.sub}</div>}
          {n.id === 'ship' && zoom && (
            <div className="pz-appear mt-2 flex flex-wrap justify-center gap-1 px-4" style={later(900)}>
              {['setup', 'spec', 'audit', 'build', 'gate', 'red-check', 'audit', 'fix', 'learn', 'PR'].map((s, j) => (
                <span key={j} className="rounded-full border border-hairline bg-overlay px-1.5 font-mono text-[7px] text-muted">{s}</span>
              ))}
            </div>
          )}
          <Show on={step === 1} from="pop" delay={i * 90} className="absolute -top-3 right-3 rounded-full border border-sky-400/50 bg-sky-500/20 px-2 font-mono text-[12px] text-sky-200">
            fresh agent
          </Show>
        </div>
      ))}

      <Show on={step >= 1 && !zoom} from="up" delay={300} style={at(410, 480, 200, 90)}
        className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-amber-400/60 bg-amber-500/10">
        <Label name="needs-human" />
        <div className="mt-1 text-[14px] text-amber-200/80">draft PR · back to you</div>
      </Show>

      <Show on={step === 1} delay={600} style={at(720, 520, 820, 80)} className="flex items-center gap-4 rounded-2xl border border-hairline bg-surface/80 px-6">
        <span className="text-[30px]">📜</span>
        <span className="text-[20px] text-muted"><b className="text-ink">Scripts, not prompts.</b> The loops, round limits and who judges what are code in <Code>.claude/workflows/</Code></span>
      </Show>
    </motion.div>
  );
}

export const INTRO = [
  {
    id: 'title', name: 'The engineering harness', accent: 'text-violet-300', tone: 'violet',
    beats: [
      null,
      {
        kicker: 'Where we start',
        title: 'The product harness already did the talking',
        body: 'A meeting or a voice note became a GitHub issue with a Done when list. That is the hand-off. From here on, the engineering harness runs on its own and only comes back when it is stuck — or when the pull request is ready.',
      },
    ],
    Scene: TitleScene,
  },
  {
    id: 'issue', name: 'The ticket', accent: 'text-emerald-300', tone: 'emerald',
    beats: [
      {
        kicker: '1 · The ticket arrives',
        title: 'Everything starts with a GitHub issue',
        body: 'Why it matters and what should change, in plain words. This one came straight from the product harness: the schedule opens on its filters instead of its sessions.',
      },
      {
        kicker: '1 · Done when',
        title: 'Every line is something a test can check',
        body: 'The Done when list is the contract. The spec maps each line to a check, the auditors judge against it, and QA has to exercise every one before it may claim high confidence.',
      },
      {
        kicker: '1 · Context comes with it',
        title: 'The ticket arrives already carrying its context',
        body: 'What the product side agreed is written into the docs the agents read. They read those instead of the source — by the piece, because whatever an agent reads it re-reads on every turn after.',
      },
    ],
    Scene: IssueScene,
  },
  {
    id: 'start', name: 'Two ways in', accent: 'text-sky-300', tone: 'sky',
    beats: [
      {
        kicker: '2 · Starting it',
        title: 'Two ways to start the same run',
        body: 'Hand the ticket to a runner in GitHub, or to Claude Code on your laptop. Same script, same steps, same pull request at the end.',
      },
      {
        kicker: '2 · On GitHub',
        title: 'Label it ready-for-ai and walk away',
        body: 'The label starts agent-ship.yml on a fresh Actions runner. It claims the issue (ai-working) and posts its progress there, so anyone following the board sees where it is. @claude on the issue does the same.',
      },
      {
        kicker: '2 · In your terminal',
        title: '/ship 140 in Claude Code',
        body: 'Locally, every ticket gets its own git worktree and its own lane — a pair of ports — so it can boot the app and run the whole suite without touching your checkout or anything else running.',
      },
      {
        kicker: '2 · One script',
        title: 'Both roads lead into ship',
        body: 'The workflow is a script, not a prompt: .claude/workflows/ship.js. Where it runs changes who pays — the API key on Actions, your subscription locally — not what it does.',
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
        body: 'Ship turns the ticket into a pull request. Two more agents, on their own runners, review it and try to break it. Then a person merges. Nothing merges itself.',
      },
      {
        kicker: '3 · Independence',
        title: 'Every step is a fresh agent',
        body: 'None of them sees the reasoning of the one before. That is what makes an audit an audit. And when a ticket will not come together, ship stops and hands it back as needs-human instead of burning rounds.',
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
