import { motion } from 'motion/react';
import { at, Show, Replay, Code, Label, Model, Kicker, Tick, PrIcon, later } from './kit.jsx';

/* ------------------------------------------------------------------ *
 * Inside ship — ten stations along a rail, and the ticket moving down it.
 * ------------------------------------------------------------------ */

const STATIONS = [
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

const SX = (i) => 80 + i * 146;
const STATION_W = 128;
const center = (i) => SX(i) + STATION_W / 2;

function Rail({ active }) {
  const x = active < 0 ? 40 : center(active);
  return (
    <>
      <div style={at(80, 166, 1440, 2)} className="rounded-full bg-hairline" />
      <div style={{ ...at(80, 166, Math.max(0, x - 80), 2) }} className="rounded-full bg-gradient-to-r from-violet-500 to-cyan-300 transition-[width] duration-1000 ease-out" />
      <motion.div
        className="pz-glow absolute size-4 rounded-full bg-violet-300"
        style={{ top: 159 }}
        initial={{ left: 32, opacity: 0 }}
        animate={{ left: x - 8, opacity: active < 0 ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 90, damping: 13 }}
        aria-hidden="true"
      />
    </>
  );
}

function Stations({ active }) {
  return STATIONS.map((s, i) => {
    const state = active < 0 ? 'idle' : i < active ? 'done' : i === active ? 'active' : 'next';
    return (
      <div
        key={s.id}
        style={{ ...at(SX(i), 70, STATION_W, 84), animationDelay: `${i * 70}ms` }}
        className={`pz-appear flex flex-col items-center justify-center rounded-xl border text-center transition-all duration-500
          ${state === 'active' ? 'pz-glow -translate-y-1 border-violet-400/70 bg-raised' : 'border-hairline bg-surface'}
          ${state === 'next' ? 'opacity-45' : ''}`}
      >
        <span className="text-[24px] leading-none">{s.icon}</span>
        <span className={`mt-1.5 text-[15px] font-semibold ${state === 'active' ? 'text-ink' : 'text-muted'}`}>{s.label}</span>
        {state === 'done' && <span className="pz-pop absolute -right-2 -top-2"><Tick className="size-6 text-[12px]" /></span>}
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
        <Row icon="⚖️" title="Size it" sub="reads the ticket and the code it would change" delay={1700} />
      </div>
      <div className={`${box} flex flex-col justify-center p-6`}>
        <Model m="opus" className="self-start text-[16px]">Setup runs on Opus</Model>
        <div className="mt-4 font-display text-[28px] leading-tight text-ink">The strongest model makes the first call</div>
        <div className="mt-3 text-[17px] text-muted">Every later step is sized by it — so this is where frontier reasoning pays for itself.</div>
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

function Auditor({ name, delay, finding, ok }) {
  return (
    <div className="pz-appear flex flex-col gap-3" style={later(delay)}>
      <div className={`${box} p-4`}>
        <div className="flex items-center gap-2 text-[18px] font-semibold text-ink">🔎 {name}</div>
        <div className="mt-1 text-[14px] text-faint">fresh context · has only the ticket and the spec</div>
      </div>
      <div className={`pz-appear rounded-xl border px-4 py-3 text-[16px] ${ok ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200' : 'border-amber-400/40 bg-amber-500/10 text-amber-200'}`} style={later(delay + 700)}>
        {finding}
      </div>
    </div>
  );
}

function SpecAuditDetail() {
  return (
    <div className="grid h-full grid-cols-[1fr_1fr_1fr] gap-6">
      <Auditor name="Plan auditor A" delay={150} finding={<>“Every filter reachable” has no check of its own.<div className="pz-appear mt-1 text-emerald-300" style={later(2200)}>→ revised: one assertion per filter</div></>} />
      <div className={`${box} flex flex-col items-center justify-center p-6 text-center`}>
        <div className="text-[44px]">📄</div>
        <div className="mt-2 font-mono text-[15px] text-ink">specs/140-…md</div>
        <div className="pz-appear mt-5 text-[17px] text-muted" style={later(1700)}>
          A finding that changes <b className="text-ink">what gets built</b> sends the plan back. A gap in its detail goes to the builder as a note.
        </div>
      </div>
      <Auditor name="Plan auditor B" delay={450} ok finding="Reads the ticket the same way. Nothing to add." />
      <div className="pz-appear col-span-3 flex items-center gap-4 rounded-xl border border-hairline bg-raised px-5 py-3 text-[17px] text-muted" style={later(2600)}>
        <Label name="ship:full" />
        <span><b className="text-ink">Full tickets:</b> their own plan writer and two plan auditors, up to three rounds. <b className="text-ink">Small:</b> skipped — the code auditor checks the reading later. Two agents fewer.</span>
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

function Cells({ n, delay, label, sub }) {
  return (
    <div className={`${box} p-5`}>
      <div className="flex items-baseline justify-between">
        <div className="text-[19px] font-semibold text-ink">{label}</div>
        <div className="font-mono text-[13px] text-faint">{sub}</div>
      </div>
      <div className="mt-4 grid grid-cols-12 gap-1.5">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className="pz-pop h-5 rounded bg-emerald-400/70" style={later(delay + i * 22)} />
        ))}
      </div>
    </div>
  );
}

function GateDetail() {
  return (
    <div className="grid h-full grid-cols-3 gap-6">
      <Cells n={36} delay={100} label="npm test" sub="unit + API · under a second" />
      <Cells n={60} delay={700} label="Playwright · desktop" sub="1440 × 900" />
      <Cells n={60} delay={1100} label="Playwright · mobile" sub="Pixel 7" />
      <div className="pz-appear col-span-3 flex items-center gap-5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-6 py-4" style={later(2600)}>
        <Code className="text-[16px]">scripts/gate.mjs</Code>
        <span className="font-mono text-[18px] text-emerald-300">{'{ "ok": true }'}</span>
        <span className="ml-auto text-[17px] text-muted">Red if any test fails — <b className="text-ink">or if a test the branch added skipped everywhere</b> and so never ran.</span>
      </div>
    </div>
  );
}

function RedCheckDetail() {
  return (
    <div className="grid h-full grid-cols-2 gap-6">
      <div className={`${box} flex flex-col p-6`}>
        <Kicker>With the change</Kicker>
        <div className="mt-3 font-mono text-[16px] text-muted">SchedulePage.jsx <span className="text-emerald-300">(new)</span></div>
        <div className="pz-appear mt-6 flex items-center gap-3 text-[22px] text-emerald-300" style={later(300)}><Tick /> new test passes</div>
      </div>
      <div className={`${box} flex flex-col p-6`}>
        <Kicker>The old code put back</Kicker>
        <div className="pz-appear mt-3 font-mono text-[16px] text-muted" style={later(900)}>SchedulePage.jsx <span className="text-amber-300">(origin/main)</span></div>
        <div className="pz-appear mt-6 flex items-center gap-3 text-[22px] text-rose-300" style={later(1500)}><Tick ok={false} /> new test fails</div>
        <div className="pz-appear mt-3 text-[18px] text-emerald-300" style={later(1900)}>… which is the point: the test can tell.</div>
      </div>
      <div className="pz-appear col-span-2 rounded-xl border border-hairline bg-raised px-6 py-4 text-[19px] text-muted" style={later(2400)}>
        <Code>scripts/red-check.mjs</Code> runs inside the gate step. <b className="text-ink">A test that still passes without the fix proves nothing</b> — and the run says so instead of shipping it.
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
      {FINDINGS.map((f, i) => (
        <div key={f.text} className="grid grid-cols-[1.4fr_auto_1fr] items-center gap-5">
          <div className="pz-appear rounded-xl border border-amber-400/30 bg-amber-500/5 px-5 py-3 text-[17px] text-ink" style={later(700 + i * 300)}>
            <span className="mr-2 font-mono text-[13px] text-amber-300">{f.lens}</span>
            <span className={f.ok ? '' : 'transition-all'}>{f.text}</span>
          </div>
          <div className="pz-appear rounded-full border border-hairline bg-overlay px-4 py-1.5 text-[15px] text-muted" style={later(1700 + i * 350)}>🧐 skeptic</div>
          <div className={`pz-appear rounded-xl px-4 py-3 text-[17px] ${f.ok ? 'border border-rose-400/50 bg-rose-500/10 text-rose-200' : 'text-faint line-through decoration-faint/60'}`} style={later(2200 + i * 350)}>
            {f.verdict}
          </div>
        </div>
      ))}
    </div>
  );
}

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

function LearnDetail() {
  return (
    <div className="grid h-full grid-cols-[1fr_auto_1.2fr] items-center gap-6">
      <div className={`${box} p-6`}>
        <Kicker>The audit caught</Kicker>
        <div className="mt-3 text-[21px] text-ink">The browser auditor found the search field off-screen at 360 px — the spec only checked the Pixel 7.</div>
      </div>
      <div className="text-[34px] text-violet-300">→</div>
      <div className="overflow-hidden rounded-2xl border border-hairline bg-[#0d0f15]">
        <div className="border-b border-hairline bg-surface px-4 py-2 font-mono text-[13px] text-ink">docs/context/schedule.md</div>
        <div className="space-y-2 px-6 py-4 font-mono text-[15px]">
          <div className="text-violet-300">## Gotchas</div>
          <div className="text-faint">- The grid needs five stable rooms a day…</div>
          <div className="text-faint">- A content filter falls back to the list…</div>
          <div className="pz-appear rounded bg-emerald-500/10 text-emerald-300" style={later(900)}>+ A phone-width check needs the narrowest phone too — the Pixel 7 is 412 px wide.</div>
        </div>
      </div>
      <div className="pz-appear col-span-3 rounded-xl border border-hairline bg-raised px-6 py-4 text-[19px] text-muted" style={later(1600)}>
        On the branch, <b className="text-ink">before the pull request opens</b>, so a reviewer sees it — and the next ticket that touches the schedule reads it before it writes a line.
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

const DETAILS = [SetupDetail, SpecDetail, SpecAuditDetail, ImplementDetail, GateDetail, RedCheckDetail, AuditDetail, LoopDetail, LearnDetail, PrDetail];

function ShipScene({ step }) {
  const active = step - 1;
  return (
    <>
      <Stations active={active} />
      <Rail active={active} />
      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        <path d={`M${center(7)} 158 C ${center(7)} 196, ${center(3)} 196, ${center(3)} 158`} pathLength="1" data-on={active >= 7} className="pz-draw" fill="none" stroke="#b45309" strokeWidth="2.5" />
        {active === 7 && <path d={`M${center(7)} 158 C ${center(7)} 196, ${center(3)} 196, ${center(3)} 158`} pathLength="1" className="pz-flow" fill="none" stroke="#fbbf24" strokeWidth="2.5" />}
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

      {DETAILS.map((Detail, i) => (
        <Replay key={i} on={active === i} from="up" style={at(80, 210, 1440, 400)}>
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
    title: 'Read it, gate it, claim it, give it a workspace — and size it',
    body: 'Setup checks the ticket can be built at all, claims it so no second run picks it up, and makes an isolated worktree on its own ports. Then it reads the code the ticket would change and reports the facts every later step is sized by.',
  },
  {
    kicker: '4.2 · Spec',
    title: 'A plan before any code',
    body: 'specs/<n>-<slug>.md, pushed as the first commit. Each Done when line is mapped to the check that will prove it. The spec stays after merge — together they record why the code is the way it is.',
  },
  {
    kicker: '4.3 · Spec audit',
    title: 'Fresh eyes on the plan, while a mistake is still cheap',
    body: 'Agents that never saw the spec being written judge it against the ticket. A misreading caught here costs one revision; caught in review, it costs a rebuild.',
  },
  {
    kicker: '4.4 · Implement',
    title: 'The failing test first — then the change',
    body: 'The check is committed while it still fails, so the history proves it failed. Every state the change adds gets its own assertion, including the moment just before a time-dependent rule applies.',
  },
  {
    kicker: '4.5 · The gate',
    title: 'A gate agents cannot argue with',
    body: 'Every unit, API and browser test, on desktop and on mobile. It is a script with an exit code — an agent cannot talk its way past it.',
  },
  {
    kicker: '4.6 · Red-check',
    title: 'Prove the test can fail',
    body: 'The old code goes back and the new tests run again. If they still pass, they never tested the change — and that is a red gate, not a green one.',
  },
  {
    kicker: '4.7 · Code audit',
    title: 'Independent auditors, and a skeptic for every blocker',
    body: 'Each auditor has one lens: the ticket’s criteria, the repo’s rules, or a real browser. Every blocker they raise must survive a skeptic that tries to refute it before it costs a fix.',
  },
  {
    kicker: '4.8 · Fix and loop',
    title: 'Fix, gate, audit — until a round comes back clean',
    body: 'Round limits are code. When the same finding survives two fixes, more rounds will not help: ship stops and hands the ticket to a person, with everything still open written down.',
  },
  {
    kicker: '4.9 · Learn',
    title: 'What the audits caught becomes context',
    body: 'If an auditor caught something the builder should have known, the lesson goes into the docs the next agent reads. The harness gets better at this repo with every ticket.',
  },
  {
    kicker: '4.10 · Pull request',
    title: 'A pull request you can actually review',
    body: 'The spec, the proof, a table of every audit round, the decisions it made for you to confirm, and what the run cost. It opens ready for review — never before the gate is green.',
  },
];

/* ------------------------------------------------------------------ *
 * The right model for the job.
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

const RISKS = [
  ['changes a business rule, stored data or the harness — or is labelled ship:full', 'the full loop: Opus, plan writer + two plan auditors, criteria + rules + browser auditors, up to 4 rounds'],
  ['changes the API, or is broad (3+ areas, ~7+ app files)', 'criteria and rules auditors, 3 rounds — still Sonnet'],
  ['leaves 2+ design questions open', 'one plan audit'],
  ['adds interaction — focus, hover, touch, positioning', 'a browser audit with four probes'],
  ['none of these', 'small: Sonnet, setup writes the plan, one combined auditor, 2 rounds'],
];

function ModelsScene({ step }) {
  return (
    <>
      <div style={at(80, 70, 420, 540)} className={`${box} p-6`}>
        <Model m="opus" className="text-[16px]">Setup · Opus</Model>
        <div className="mt-3 font-display text-[26px] leading-tight text-ink">Reports facts, not a verdict</div>
        <div className="mt-4 space-y-1.5">
          {FACTS.map(([k, v], i) => (
            <div key={k} className="pz-appear flex justify-between border-b border-hairline/60 pb-1.5 text-[16px]" style={later(300 + i * 110)}>
              <span className="text-muted">{k}</span><span className="font-mono text-ink">{v}</span>
            </div>
          ))}
        </div>
        <div className="pz-appear mt-4 text-[15px] text-faint" style={later(1400)}>The script composes the run from these. An agent never picks its own budget.</div>
      </div>

      <svg viewBox="0 0 1600 900" className="pointer-events-none absolute inset-0" aria-hidden="true">
        {['M500 340 C 540 340, 530 200, 570 200', 'M500 340 C 540 340, 530 470, 570 470'].map((d, i) => (
          <g key={d}>
            <path d={d} pathLength="1" data-on={step >= 1} className="pz-draw" fill="none" stroke={i ? '#701a75' : '#047857'} strokeWidth="3" />
            {step === 1 && i === 0 && <path d={d} pathLength="1" className="pz-flow" fill="none" stroke="#6ee7b7" strokeWidth="3" />}
          </g>
        ))}
      </svg>

      <Replay on={step === 1} from="right" style={at(570, 70, 950, 540)} className="flex flex-col gap-5">
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
        <div className="pz-appear rounded-xl border border-hairline bg-raised px-5 py-3 text-[17px] text-muted" style={later(1400)}>
          The gate and the PR are rote, so they run on <Model m="haiku">ship-rote · Haiku</Model> with no CLAUDE.md — about a quarter less context.
        </div>
      </Replay>

      <Replay on={step === 2} from="right" style={at(570, 70, 950, 540)} className={`${box} overflow-hidden`}>
        <div className="grid grid-cols-[1fr_1fr] border-b border-hairline bg-raised px-6 py-3 font-mono text-[14px] uppercase tracking-wider text-faint">
          <span>The ticket…</span><span>adds</span>
        </div>
        {RISKS.map(([when, adds], i) => (
          <div key={when} className="pz-appear grid grid-cols-[1fr_1fr] gap-6 border-b border-hairline/60 px-6 py-3.5 text-[17px]" style={later(200 + i * 220)}>
            <span className="text-ink">{when}</span><span className="text-muted">{adds}</span>
          </div>
        ))}
        <div className="pz-appear px-6 py-3.5 text-[17px] text-emerald-300" style={later(1500)}>Small drops redundancy, not rigour: the gate, the red-check, an audit and a skeptic stay.</div>
      </Replay>

      <Replay on={step === 3} from="right" style={at(570, 70, 950, 540)} className="flex flex-col gap-4">
        <div className={`${box} p-6`}>
          <Kicker>After a green gate, the script measures the real diff</Kicker>
          <div className="mt-3 flex items-center gap-4 text-[19px] text-ink">
            <span>reached <Code>server/lib</Code>, the schema or the harness — or grew past 300 app lines</span>
          </div>
          <div className="mt-4 flex items-center gap-3 text-[17px] text-muted">
            auditors
            <span className="opacity-50"><Model m="sonnet" /></span>
            <span className="text-violet-300">→</span>
            <span className="pz-pop" style={later(1200)}><Model m="opus">Opus — the full auditors</Model></span>
          </div>
        </div>
        <div className={`${box} pz-appear p-6`} style={later(1800)}>
          <Kicker>A gate red twice running</Kicker>
          <div className="mt-3 flex items-center gap-3 text-[19px] text-ink">the fixer moves to <Model m="opus" /></div>
        </div>
        <div className={`${box} pz-appear p-6`} style={later(2400)}>
          <Kicker>And you can always say so</Kicker>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[18px]">
            <Code>/ship 42 --full</Code><Code>/ship 42 --small</Code><Label name="ship:full" />
          </div>
        </div>
      </Replay>
    </>
  );
}

const MODEL_BEATS = [
  {
    kicker: '5 · The right model for the job',
    title: 'Spend the frontier model where the decision is',
    body: 'Setup runs on Opus because every later step is sized by its call. It reads the ticket and the code, and reports facts — which areas, how many files, whether it touches a business rule, stored data, the API or the harness.',
  },
  {
    kicker: '5 · Small or full',
    title: 'Mechanical work goes to Sonnet and Haiku',
    body: 'Most tickets are small: Sonnet builds and audits, Haiku runs the gate and opens the PR. The hard ones stay on Opus at nearly every step. A one-line fix should not cost what a new feature does.',
  },
  {
    kicker: '5 · Risk buys checks',
    title: 'Small is the base, and each risk adds the check that catches it',
    body: 'Not a dial from cheap to thorough — a list of what can go wrong and the check that would catch it. A ticket pays only for the risks it actually has.',
  },
  {
    kicker: '5 · Then the evidence decides',
    title: 'A small run that turns out risky is escalated',
    body: 'Setup’s guess is checked against the real diff. Reach a risky path or grow too big and the full auditors come in on Opus; a gate that stays red moves the fixer up. You can always force it either way.',
  },
];

export const SHIP = [
  { id: 'ship', name: 'Inside ship', accent: 'text-violet-300', tone: 'violet', beats: SHIP_BEATS, Scene: ShipScene },
  { id: 'models', name: 'The right model', accent: 'text-fuchsia-300', tone: 'fuchsia', beats: MODEL_BEATS, Scene: ModelsScene },
];
