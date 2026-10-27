import { motion } from 'motion/react';
import { at, Show, Replay, Code, Label, Model, Kicker, Tick, Token, Flip, PrIcon, later } from './kit.jsx';

/* ------------------------------------------------------------------ *
 * Inside ship — ten stations along a rail, and the ticket moving down it.
 * The station geometry is exported: the map chapter unpacks the stations
 * into these exact positions, so the cut into this chapter lands on them.
 * ------------------------------------------------------------------ */

export const STATIONS = [
  { id: 'setup', label: 'Setup', icon: '🧭' },
  { id: 'spec', label: 'Spec', icon: '📄' },
  { id: 'spec-audit', label: 'Spec audit', icon: '🔎' },
  { id: 'implement', label: 'Implement', icon: '🛠️' },
  { id: 'gate', label: 'Gate', icon: '🚦' },
  { id: 'red-check', label: 'Red-check', icon: '🔴' },
  { id: 'audit', label: 'Code audit', icon: '🧐' },
  { id: 'loop', label: 'Fix & loop', icon: '🔁' },
  { id: 'learn', label: 'Learn', icon: '📚' },
  { id: 'pr', label: 'Pull request', icon: '🚀' },
];

export const SX = (i) => 80 + i * 146;
export const STATION_W = 128;
export const STATION_Y = 70;
export const RAIL_Y = 170;
const center = (i) => SX(i) + STATION_W / 2;
const TOKEN_W = 82;
/** Where the ticket waits before it enters the first station. */
export const TOKEN_PARK = { left: 80 - TOKEN_W / 2, top: RAIL_Y - 14 };

/** The rail under the stations, and the ticket riding it. */
function Rail({ active }) {
  const x = active < 0 ? 80 : center(active);
  return (
    <>
      <div style={at(80, RAIL_Y, 1440, 2)} className="rounded-full bg-hairline" />
      <div style={{ ...at(80, RAIL_Y, Math.max(0, x - 80), 2) }} className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-300 transition-[width] duration-1000 ease-out" />
      <Token
        className="absolute"
        initial={{ left: TOKEN_PARK.left, top: TOKEN_PARK.top, scale: 0.9 }}
        animate={{ left: x - TOKEN_W / 2, top: RAIL_Y - 14, scale: 1 }}
        transition={{ type: 'spring', stiffness: 80, damping: 14 }}
      />
    </>
  );
}

/** One station's face — shared with the map chapter, which flies these into place. */
export function Station({ s, state = 'idle' }) {
  return (
    <div
      className={`flex size-full flex-col items-center justify-center rounded-xl border text-center transition-all duration-500
        ${state === 'active' ? 'pz-glow -translate-y-1 border-violet-400/70 bg-raised' : 'border-hairline bg-surface'}
        ${state === 'next' ? 'opacity-45' : ''}`}
    >
      <span className="text-[24px] leading-none">{s.icon}</span>
      <span className={`mt-1.5 text-[15px] font-semibold ${state === 'active' ? 'text-ink' : 'text-muted'}`}>{s.label}</span>
      {state === 'done' && <span className="pz-pop absolute -right-2 -top-2"><Tick className="size-6 text-[12px]" /></span>}
    </div>
  );
}

function Stations({ active }) {
  return STATIONS.map((s, i) => {
    const state = active < 0 ? 'idle' : i < active ? 'done' : i === active ? 'active' : 'next';
    return (
      <div key={s.id} style={at(SX(i), STATION_Y, STATION_W, 84)} className="relative">
        <Station s={s} state={state} />
        {/* the stamp: a ring leaves the station the moment the ticket arrives */}
        {state === 'active' && <span key={active} className="pz-ping pointer-events-none absolute inset-0 rounded-xl border-2 border-violet-300" aria-hidden="true" />}
      </div>
    );
  });
}

const box = 'rounded-2xl border border-hairline bg-surface';

function Row({ icon, title, sub, delay }) {
  return (
    <div className="pz-appear flex items-center gap-4 rounded-xl border border-hairline bg-raised px-4 py-2.5" style={later(delay)}>
      <span className="w-8 text-center text-[22px]">{icon}</span>
      <div>
        <div className="text-[18px] font-semibold text-ink">{title}</div>
        <div className="text-[15px] text-muted">{sub}</div>
      </div>
    </div>
  );
}

function SetupDetail() {
  return (
    <div className="grid h-full grid-cols-[1fr_1.35fr_1fr] gap-6">
      <div className={`${box} p-6`}>
        <Kicker>The ticket</Kicker>
        <div className="mt-3 font-display text-[24px] leading-tight text-ink">#140 Keep sessions in view on mobile</div>
        <div className="mt-4 space-y-2 text-[15px] text-muted">
          {['first card visible on a phone', 'every filter reachable', 'mobile specs still pass'].map((d, i) => (
            <div key={d} className="pz-appear flex gap-2" style={later(200 + i * 150)}><span className="text-violet-300">☐</span>{d}</div>
          ))}
        </div>
      </div>
      <div className="space-y-2.5">
        <Row icon="✅" title="Can it be built?" sub="a Done when a test can check" delay={300} />
        <Row icon="🏷️" title="Claim it" sub={<>label <Label name="ai-working" className="ml-1 text-[12px]" /></>} delay={650} />
        <Row icon="🌳" title="Its own worktree" sub=".claude/worktrees/wt-140 — from origin/main" delay={1000} />
        <Row icon="🔌" title="Its own lane" sub="api :4306 · web :4307 — boots the app beside yours" delay={1350} />
      </div>
      <div className="pz-appear flex flex-col justify-center rounded-2xl border-2 border-dashed border-amber-400/60 bg-amber-500/10 p-6" style={later(1800)}>
        <Label name="needs-human" className="self-start" />
        <div className="mt-4 font-display text-[28px] leading-tight text-ink">Not enough to build? It stops here</div>
        <div className="mt-3 text-[17px] text-muted">No Done when, or a question only a person can answer — it goes back before a line of code, not after an hour of guessing.</div>
      </div>
    </div>
  );
}

const SPEC_LINES = [
  { t: '# Keep sessions in view on mobile', c: 'text-ink font-semibold' },
  { t: '## What this changes', c: 'text-violet-300' },
  { t: 'Below lg the opened filter rail is compact: days in one row, selects in two columns.', c: 'text-muted' },
  { t: '## Where', c: 'text-violet-300' },
  { t: 'src/pages/SchedulePage.jsx — the rail · tests/schedule.spec.js', c: 'text-muted' },
  { t: '## How it will be proved', c: 'text-violet-300' },
  { t: '| first card in view | phone, Filters open | spec |', c: 'text-emerald-300' },
  { t: '## Decisions', c: 'text-violet-300' },
  { t: 'Hide the My agenda card below lg — OK?', c: 'text-amber-300' },
];

function SpecDetail() {
  return (
    <div className="grid h-full grid-cols-[1.6fr_1fr] gap-6">
      <div className="overflow-hidden rounded-2xl border border-hairline bg-[#0d0f15]">
        <div className="flex border-b border-hairline bg-surface font-mono text-[13px]">
          <span className="border-r border-hairline bg-[#0d0f15] px-4 py-2 text-ink">specs/140-compact-mobile-filters.md</span>
        </div>
        <div className="space-y-1.5 px-6 py-4 font-mono text-[16px]">
          {SPEC_LINES.map((l, i) => <div key={i} className={`pz-appear ${l.c}`} style={later(150 + i * 220)}>{l.t}</div>)}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className={`${box} p-5 font-mono text-[15px]`}>
          <div className="pz-appear text-amber-300" style={later(2100)}>● docs(spec): plan compact mobile filters</div>
          <div className="pz-appear mt-1 text-faint" style={later(2300)}>the first commit on issue-140-…</div>
        </div>
        <div className={`${box} pz-appear flex-1 p-5 text-[18px] text-muted`} style={later(2500)}>
          Its <b className="text-ink">Where</b> names the files, the lines, the test file and the helpers — so the builder searches for nothing.
          <div className="mt-3">A reviewer reads the <b className="text-ink">intent before the diff</b>, and a misread ticket surfaces while it is still cheap.</div>
        </div>
      </div>
    </div>
  );
}

function ImplementDetail() {
  return (
    <div className="grid h-full grid-cols-[1fr_auto_1fr] items-stretch gap-5">
      <div className={`${box} flex flex-col p-5`}>
        <Kicker>1 · the check first</Kicker>
        <div className="mt-3 rounded-xl bg-[#0d0f15] p-4 font-mono text-[15px] leading-relaxed">
          <div className="text-violet-300">test(<span className="text-emerald-300">'on a phone the open filter</span></div>
          <div className="text-emerald-300 pl-4">rail leaves the first session in view'</div>
          <div className="text-muted pl-4">await page.getByRole('button', {'{'} name: 'Filters' {'}'}).click()</div>
          <div className="text-muted pl-4">await expect(firstCard).toBeInViewport()</div>
        </div>
        <div className="pz-appear mt-4 flex items-center gap-3 text-[18px] text-rose-300" style={later(600)}><Tick ok={false} /> fails — the filters fill the screen</div>
        <div className="pz-appear mt-2 font-mono text-[14px] text-amber-300" style={later(900)}>● test(schedule): first session stays in view</div>
      </div>
      <div className="flex items-center text-[34px] text-violet-300">→</div>
      <div className={`${box} flex flex-col p-5`}>
        <Kicker>2 · then the change</Kicker>
        <div className="pz-appear mt-3 rounded-xl bg-[#0d0f15] p-4 font-mono text-[15px] leading-relaxed" style={later(1300)}>
          <div className="text-faint">src/pages/SchedulePage.jsx</div>
          <div className="bg-rose-500/10 text-rose-300">- &lt;div className="space-y-6"&gt;</div>
          <div className="bg-emerald-500/10 text-emerald-300">+ &lt;div className="grid grid-cols-2 gap-2</div>
          <div className="bg-emerald-500/10 pl-4 text-emerald-300">+   lg:block lg:space-y-6"&gt;</div>
        </div>
        <div className="pz-appear mt-4 flex items-center gap-3 text-[18px] text-emerald-300" style={later(2100)}><Tick /> passes</div>
        <div className="pz-appear mt-2 text-[16px] text-muted" style={later(2400)}>The docs that describe what changed are updated in the same push.</div>
      </div>
    </div>
  );
}

/* The gate, then the same test run twice: with the change, then with the old
 * code put back. The code card turns over to origin/main and the green result
 * flips red. */
function Run({ file, tone, children }) {
  return (
    <div className={`flex h-full flex-col justify-center rounded-xl border px-5 py-4 ${tone}`}>
      <div className="font-mono text-[14px] text-faint">src/pages/</div>
      <div className="font-mono text-[18px] text-ink">{file}</div>
      <div className="mt-1 font-mono text-[14px]">{children}</div>
    </div>
  );
}

function Result({ ok, label }) {
  return (
    <div className={`flex h-full items-center gap-3 rounded-xl px-5 text-[22px] ${ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
      <Tick ok={ok} /> {label}
    </div>
  );
}

function RedCheckDetail() {
  const FLIP = 1300;
  return (
    <div className="grid h-full grid-cols-[1fr_1fr] gap-6">
      <div className={`${box} flex flex-col p-6`}>
        <Kicker>1 · With the change</Kicker>
        <div className="mt-3 h-[96px]"><Run file="SchedulePage.jsx" tone="border-emerald-400/40 bg-emerald-500/[0.06]"><span className="text-emerald-300">+ grid grid-cols-2 gap-2 lg:block</span></Run></div>
        <div className="pz-appear mt-4 h-[64px]" style={later(300)}><Result ok label="first session stays in view — passes" /></div>
        <div className="pz-appear mt-3 text-[18px] text-muted" style={later(700)}>Green, across the whole gate. Green alone proves little.</div>
      </div>
      <div className={`${box} flex flex-col p-6`}>
        <Kicker>2 · The old code put back</Kicker>
        <Flip
          className="mt-3 h-[96px]"
          delay={FLIP}
          front={<Run file="SchedulePage.jsx" tone="border-emerald-400/40 bg-emerald-500/[0.06]"><span className="text-emerald-300">+ grid grid-cols-2 gap-2 lg:block</span></Run>}
          back={<Run file="SchedulePage.jsx" tone="border-amber-400/50 bg-amber-500/[0.08]"><span className="text-amber-300">origin/main — the fix reverted, the test kept</span></Run>}
        />
        <Flip
          className="mt-4 h-[64px]"
          delay={FLIP + 350}
          front={<Result ok label="first session stays in view — passes" />}
          back={<Result ok={false} label="first session stays in view — fails" />}
        />
        <div className="pz-appear mt-3 text-[18px] text-emerald-300" style={later(FLIP + 1200)}>… which is the point: the test can tell the two apart.</div>
      </div>
      <div className="pz-appear col-span-2 rounded-xl border border-hairline bg-raised px-6 py-4 text-[19px] text-muted" style={later(FLIP + 1700)}>
        <Code>scripts/gate.mjs</Code> runs every unit, API and browser test, desktop and mobile — an exit code no agent can argue with. Then <Code>scripts/red-check.mjs</Code>: <b className="text-ink">a test that still passes without the fix proves nothing</b>.
      </div>
    </div>
  );
}

const LENSES = [
  { icon: '🎯', name: 'Criteria', reads: 'the ticket’s Done when, line by line' },
  { icon: '📏', name: 'Rules', reads: 'CLAUDE.md and the area rules' },
  { icon: '🖥️', name: 'Browser', reads: 'drives the app, desktop and mobile' },
];

const FINDINGS = [
  { lens: 'Criteria', text: 'The My agenda count is hidden on phones', verdict: 'refuted — the count is in the mobile nav', ok: false },
  { lens: 'Rules', text: 'The rail’s gap is not the other panels’ gap', verdict: 'refuted — style, not a defect', ok: false },
  { lens: 'Browser', text: 'At 360 px the search field is off-screen', verdict: 'confirmed — a blocker', ok: true },
];

function AuditDetail() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid grid-cols-3 gap-5">
        {LENSES.map((l, i) => (
          <div key={l.name} className={`${box} pz-appear flex items-center gap-4 px-5 py-3.5`} style={later(i * 150)}>
            <span className="text-[30px]">{l.icon}</span>
            <div>
              <div className="text-[19px] font-semibold text-ink">{l.name} auditor</div>
              <div className="text-[15px] text-muted">{l.reads}</div>
            </div>
          </div>
        ))}
      </div>
      {FINDINGS.map((f, i) => {
        const verdictAt = 2200 + i * 350;
        return (
          <div key={f.text} className="grid grid-cols-[1.4fr_auto_1fr] items-center gap-5">
            <div className="pz-appear relative rounded-xl border border-amber-400/30 bg-amber-500/5 px-5 py-3 text-[17px] text-ink" style={later(700 + i * 300)}>
              <span className="mr-2 font-mono text-[13px] text-amber-300">{f.lens}</span>
              {/* the skeptic's pen: refuted findings are struck through as the verdict lands */}
              <span className={f.ok ? '' : 'pz-strike text-rose-300'} style={f.ok ? undefined : later(verdictAt)}><span className="text-ink">{f.text}</span></span>
              {f.ok && (
                <span className="pz-stamp absolute right-5 -top-3.5 rounded-md border-2 border-rose-400 bg-ground/80 px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-[0.2em] text-rose-300" style={later(verdictAt + 100)}>blocker</span>
              )}
            </div>
            <div className="pz-appear rounded-full border border-hairline bg-overlay px-4 py-1.5 text-[15px] text-muted" style={later(1700 + i * 350)}>🧐 skeptic</div>
            <div className={`pz-appear rounded-xl px-4 py-3 text-[17px] ${f.ok ? 'border border-rose-400/50 bg-rose-500/10 text-rose-200' : 'text-faint'}`} style={later(verdictAt)}>
              {f.verdict}
            </div>
          </div>
        );
      })}
      {/* the Swiss cheese: every layer has holes, but they do not line up */}
      <div className="pz-appear mt-auto flex items-center gap-3 rounded-xl border border-hairline bg-raised px-5 py-3" style={later(3400)}>
        <span className="text-[26px]">🧀</span>
        {SLICES.map(([name, ai, holes]) => (
          <span key={name} className={`relative flex h-11 flex-1 items-center justify-center overflow-hidden rounded-lg text-[14px] font-semibold ${ai ? 'bg-amber-400/20 text-amber-100' : 'bg-emerald-400/20 text-emerald-100'}`}>
            {holes.map(([x, y]) => <span key={`${x}-${y}`} className="absolute size-3 rounded-full bg-ground/70" style={{ left: `${x}%`, top: `${y}%` }} />)}
            <span className="relative">{name}</span>
          </span>
        ))}
        <span className="ml-2 text-[15px] text-muted">no hole goes all the way through</span>
      </div>
    </div>
  );
}

// [layer, is it an agent, where its holes are] — the gate and red-check are scripts
const SLICES = [
  ['criteria', true, [[8, 15], [70, 55]]],
  ['rules', true, [[30, 60], [85, 10]]],
  ['browser', true, [[55, 20], [12, 62]]],
  ['skeptic', true, [[78, 58], [40, 8]]],
  ['gate', false, [[20, 30]]],
  ['red-check', false, [[88, 40]]],
];

function LoopDetail() {
  const nodes = [
    { label: '🛠️ Fix', x: 190, y: 40 },
    { label: '🚦 Gate', x: 330, y: 250 },
    { label: '🧐 Audit', x: 50, y: 250 },
  ];
  return (
    <div className="grid h-full grid-cols-[520px_1fr] gap-8">
      <div className="relative">
        <svg viewBox="0 0 520 400" className="absolute inset-0 size-full" aria-hidden="true">
          <circle cx="260" cy="200" r="150" fill="none" stroke="#333950" strokeWidth="3" />
          <circle cx="260" cy="200" r="150" pathLength="1" className="pz-flow" fill="none" stroke="#fbbf24" strokeWidth="3" />
        </svg>
        {nodes.map((n, i) => (
          <div key={n.label} className={`${box} pz-appear absolute grid h-[86px] w-[140px] place-items-center text-[20px] font-semibold text-ink`} style={{ left: n.x, top: n.y, ...later(i * 200) }}>
            {n.label}
          </div>
        ))}
        <div className="pz-appear absolute left-[205px] top-[170px] text-center font-mono text-[14px] text-amber-300" style={later(700)}>until a round<br />comes back clean</div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="pz-appear flex items-center gap-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-5 py-3 text-[19px] text-rose-200" style={later(400)}>
          <span className="font-mono text-[15px] text-faint">Round 1</span> 1 blocker — the search field at 360 px
        </div>
        <div className="pz-appear flex items-center gap-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-5 py-3 text-[19px] text-emerald-200" style={later(1500)}>
          <span className="font-mono text-[15px] text-faint">Round 2</span> clean <Tick className="ml-auto" />
        </div>
        <div className="pz-appear mt-2 space-y-2 text-[18px] text-muted" style={later(2100)}>
          <div>• A <b className="text-ink">red gate does not use up</b> an audit round.</div>
          <div>• <b className="text-ink">Small</b> gets up to 2 rounds, <b className="text-ink">full</b> up to 4.</div>
          <div>• The same finding surviving two fixes means the fixer cannot fix it — <b className="text-amber-300">hand it back</b>.</div>
        </div>
      </div>
    </div>
  );
}

const PR_SECTIONS = [
  ['What changes', 'the rail is compact below lg'],
  ['🧪 Try it', 'open /schedule at phone width, tap Filters'],
  ['✅ Done when', 'each criterion → the test that proves it'],
  ['🤔 Decisions for you', 'hide the My agenda card on phones — OK?'],
  ['👀 Where to look', 'src/pages/SchedulePage.jsx'],
  ['🛡️ Checks', 'every audit round, gate and red-check'],
  ['🧾 AI spend', 'tokens and dollars, by model'],
];

function PrDetail() {
  return (
    <div className="grid h-full grid-cols-[1.5fr_1fr] gap-6">
      <div className={`${box} overflow-hidden`}>
        <div className="border-b border-hairline px-6 py-4">
          <div className="font-display text-[24px] leading-tight text-ink">Keep sessions in view on mobile <span className="font-sans font-normal text-faint">#142</span></div>
          <div className="mt-2 flex items-center gap-2 text-[14px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 font-semibold text-white"><PrIcon /> Open</span>
            <span className="text-muted">ready for review · Closes #140 · 📄 Spec</span>
          </div>
        </div>
        <div className="space-y-1.5 px-6 py-4">
          {PR_SECTIONS.map(([h, t], i) => (
            <div key={h} className="pz-appear flex gap-4 text-[16px]" style={later(150 + i * 160)}>
              <span className="w-48 shrink-0 font-semibold text-ink">{h}</span>
              <span className="text-muted">{t}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className={`${box} pz-appear p-5`} style={later(1300)}>
          <Kicker>Opens only when</Kicker>
          <div className="mt-2 text-[19px] text-ink">the gate is green and no auditor blocker survives a skeptic.</div>
        </div>
        <div className={`${box} pz-appear flex-1 p-5 text-[18px] text-muted`} style={later(1700)}>
          Labelled <Label name="ship:full" className="mx-1 text-[12px]" /> when it ran the full loop — so code review and QA scale up with it.
        </div>
      </div>
    </div>
  );
}

// One entry per beat: the station the ticket stops at, and what it shows there.
// Setup takes two beats — the claim, then the sizing. Spec audit, Gate and Learn
// have no stop of their own: the ticket ticks them off on its way past, and
// their story rides in the neighbouring captions.
const STOPS = [
  { at: -1 },
  { at: 0, Detail: SetupDetail },
  { at: 0, Detail: SizeDetail },
  { at: 1, Detail: SpecDetail },
  { at: 3, Detail: ImplementDetail },
  { at: 5, Detail: RedCheckDetail },
  { at: 6, Detail: AuditDetail },
  { at: 7, Detail: LoopDetail },
  { at: 9, Detail: PrDetail },
];
/** Where the needs-human chapter breaks in: after the loop, before the pull request. */
const PR_BEAT = 8;

const LOOP_BACK = `M${center(7)} 160 C ${center(7)} 204, ${center(3)} 204, ${center(3)} 160`;

function ShipScene({ step }) {
  const active = STOPS[step]?.at ?? -1;
  return (
    <>
      <Stations active={active} />
      <Rail active={active} />
      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        <path d={LOOP_BACK} pathLength="1" data-on={active >= 7} className="pz-draw" fill="none" stroke="#b45309" strokeWidth="2.5" />
        {active === 7 && <path d={LOOP_BACK} pathLength="1" className="pz-flow" fill="none" stroke="#fbbf24" strokeWidth="2.5" />}
      </svg>

      <Show on={active < 0} delay={800} style={at(80, 220, 1440, 380)} className="grid grid-cols-3 gap-6">
        {[
          ['🧠', 'Every step a fresh agent', 'It never sees the reasoning of the step before. That is what makes an audit an audit.'],
          ['📜', 'A script decides the flow', 'Round limits, who judges what, when to stop — code in ship.js, not a prompt’s good intentions.'],
          ['🧾', 'Every step leaves a trail', 'A spec, a failing test, every audit round and the cost — all in the pull request.'],
        ].map(([icon, title, body]) => (
          <div key={title} className={`${box} p-7`}>
            <div className="text-[40px]">{icon}</div>
            <div className="mt-3 font-display text-[28px] text-ink">{title}</div>
            <div className="mt-2 text-[18px] text-muted">{body}</div>
          </div>
        ))}
      </Show>

      {STOPS.map(({ Detail }, i) => Detail && (
        <Replay key={i} on={step === i} from="up" style={at(80, 210, 1440, 400)}>
          <Detail />
        </Replay>
      ))}
    </>
  );
}

const SHIP_BEATS = [
  {
    kicker: '4 · Inside ship',
    title: 'Ten steps, and a loop that does not stop until it is clean',
    body: 'Ticket in, pull request out. Each step is its own agent with a narrow job, and the script — not the agent — decides what happens next.',
  },
  {
    kicker: '4.1 · Setup',
    title: 'Read it, gate it, claim it, give it a workspace',
    body: 'Setup checks the ticket can be built at all and hands it straight back if not. Then it claims it so no second run picks it up, and makes an isolated worktree on its own ports — which is what lets ten run side by side.',
  },
  {
    kicker: '4.2 · Size it',
    title: 'Spend the frontier model where the decision is',
    body: 'Setup runs on Opus because every later step is sized by its call: Sonnet and Haiku for mechanical work, Opus for the hard tickets. A diff that grows risky escalates itself — or force it with /ship 42 --full.',
  },
  {
    kicker: '4.3 · Spec, then a spec audit',
    title: 'A plan before any code, judged while a mistake is still cheap',
    body: 'specs/<n>-<slug>.md is the first commit and maps each Done when line to its check. On full tickets, auditors that never saw it written judge it against the ticket — a misreading caught here costs a revision, not a rebuild.',
  },
  {
    kicker: '4.4 · Implement',
    title: 'The failing test first — then the change',
    body: 'The check is committed while it still fails, so the history proves it failed. Every state the change adds gets its own assertion, including the moment just before a time-dependent rule applies.',
  },
  {
    kicker: '4.5 · The gate and the red-check',
    title: 'A gate agents cannot argue with — and proof the test can fail',
    body: 'Every unit, API and browser test, on desktop and on mobile: a script with an exit code. Then the old code goes back and the new tests run again — if they still pass, they never tested the change.',
  },
  {
    kicker: '4.6 · Code audit',
    title: 'Independent auditors, and a skeptic for every blocker',
    body: 'One lens each: the ticket’s criteria, the repo’s rules, a real browser. No layer is trusted alone — like slices of Swiss cheese, each has holes, but not in the same places, and the gate and red-check are not AI at all.',
  },
  {
    kicker: '4.7 · Fix and loop',
    title: 'Fix, gate, audit — until a round comes back clean',
    body: 'Round limits are code, not a prompt’s good intentions: two rounds for a small ticket, four for a full one. Nothing spins all night on your token bill.',
  },
  {
    kicker: '4.9 · Learn, then the pull request',
    title: 'A pull request you can actually review',
    body: 'What the audits caught becomes context the next agent reads. Then the pull request opens — spec, proof, every audit round, the decisions for you to confirm, and the cost. Never before the gate is green.',
  },
];

/* ------------------------------------------------------------------ *
 * Sizing — the second beat at Setup.

 * ------------------------------------------------------------------ */

const FACTS = [
  ['areas', 'ui · tests'],
  ['app files', '1'],
  ['business rule', 'no'],
  ['stored data', 'no'],
  ['API', 'no'],
  ['harness', 'no'],
  ['open design questions', '1'],
  ['new interaction', 'no'],
];

function Lane({ title, tone, steps, foot, glow }) {
  return (
    <div className={`rounded-2xl border p-5 transition-all duration-700 ${glow ? 'pz-glow border-emerald-400/50 bg-raised' : 'border-hairline bg-surface'}`}>
      <div className="flex items-baseline justify-between">
        <div className={`font-display text-[26px] ${tone}`}>{title}</div>
        <div className="font-mono text-[15px] text-muted">{foot}</div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {steps.map(([label, m, n], i) => (
          <span key={label} className="pz-appear flex items-center gap-2 rounded-xl border border-hairline bg-overlay/60 px-3 py-2 text-[15px] text-ink" style={later(300 + i * 120)}>
            {label}<Model m={m}>{n ? `${MODEL_NAME[m]} ×${n}` : undefined}</Model>
          </span>
        ))}
      </div>
    </div>
  );
}

const MODEL_NAME = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };

function SizeDetail() {
  return (
    <div className="grid h-full grid-cols-[400px_1fr] gap-6">
      <div className={`${box} p-5`}>
        <Model m="opus" className="text-[15px]">Setup · Opus</Model>
        <div className="mt-2 font-display text-[22px] leading-tight text-ink">Reports facts, not a verdict</div>
        <div className="mt-3 space-y-1">
          {FACTS.slice(0, 6).map(([k, v], i) => (
            <div key={k} className="pz-appear flex justify-between border-b border-hairline/60 pb-1 text-[15px]" style={later(200 + i * 90)}>
              <span className="text-muted">{k}</span><span className="font-mono text-ink">{v}</span>
            </div>
          ))}
        </div>
        <div className="pz-appear mt-3 text-[15px] text-faint" style={later(900)}>
          The <b className="text-ink">script</b> composes the run from these — an agent never picks its own budget.
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Lane
          glow
          title="🟢 Small — most tickets"
          tone="text-emerald-300"
          foot="2 rounds · ~$0.70–1.50"
          steps={[['setup + plan', 'opus'], ['implement', 'sonnet'], ['gate', 'haiku'], ['one auditor', 'sonnet'], ['fix', 'sonnet'], ['PR', 'haiku']]}
        />
        <Lane
          title="🔵 Full — rules, APIs, bigger changes"
          tone="text-fuchsia-300"
          foot="4 rounds · ~$6.50"
          steps={[['setup', 'opus'], ['plan writer', 'opus'], ['plan audit', 'opus', 2], ['implement', 'opus'], ['gate', 'haiku'], ['auditors', 'opus', 3], ['fix', 'opus'], ['PR', 'haiku']]}
        />
      </div>
    </div>
  );
}

/** Ship's last stop, reached again after the needs-human chapter breaks in. */
function PrScene({ step }) {
  return <ShipScene step={PR_BEAT + step} />;
}

export const SHIP = [
  // `enter: 'cut'` — the map chapter has already unpacked the stations into place, so this one lands on them
  { id: 'ship', name: 'Inside ship', accent: 'text-violet-300', tone: 'violet', enter: 'cut', beats: SHIP_BEATS.slice(0, PR_BEAT), Scene: ShipScene },
];

export const SHIP_PR = [
  { id: 'pr', name: 'The pull request', accent: 'text-violet-300', tone: 'violet', beats: SHIP_BEATS.slice(PR_BEAT), Scene: PrScene },
];
