import { useEffect, useState } from 'react';
import { animate, motion } from 'motion/react';
import { at, Show, Replay, Code, Label, Model, Kicker, Tick, Verdict, IssueIcon, PrIcon, MergeIcon, later } from './kit.jsx';
import { Orbits } from './intro.jsx';

const box = 'rounded-2xl border border-hairline bg-surface';

/** A number that counts up to `to` as it appears. */
function Count({ to, prefix = '', decimals = 0, delay = 0 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const c = animate(0, to, { duration: 1.4, delay: delay / 1000, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [to, delay]);
  return <span className="tabular-nums">{prefix}{v.toFixed(decimals)}</span>;
}

/* ------------------------------------------------------------------ *
 * When it will not converge — needs-human.
 * ------------------------------------------------------------------ */

/* The reply and the relabel land a few seconds into the hand-back beat. */
const RELABEL_AT = 2600;

function NeedsHumanScene({ step }) {
  return (
    <>
      {/* the loop that will not close */}
      <Show on={step === 0} from="scale" style={at(80, 80, 1440, 520)} className="grid grid-cols-[520px_1fr] gap-10">
        <div className="relative">
          <svg viewBox="0 0 520 480" className="absolute inset-0 size-full" aria-hidden="true">
            <circle cx="260" cy="240" r="170" fill="none" stroke="#333950" strokeWidth="3" />
            <circle cx="260" cy="240" r="170" pathLength="1" className="pz-flow" fill="none" stroke="#f59e0b" strokeWidth="3" />
          </svg>
          {[['🛠️ Fix', 190, 30], ['🚦 Gate', 360, 300], ['🧐 Audit', 20, 300]].map(([l, x, y]) => (
            <div key={l} className={`${box} absolute grid h-[86px] w-[140px] place-items-center text-[20px] font-semibold text-ink`} style={{ left: x, top: y }}>{l}</div>
          ))}
          <motion.div
            className="absolute left-[178px] top-[196px] grid h-[88px] w-[164px] place-items-center rounded-2xl border-2 border-rose-400/70 bg-rose-500/15 text-center font-display text-[28px] text-rose-200"
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 260, damping: 12, delay: 2.4 }}
          >
            STOP
          </motion.div>
        </div>
        <div className="flex flex-col justify-center gap-3">
          {[1, 2, 3].map((round, i) => (
            <div key={round} className="pz-appear flex items-center gap-5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-5 py-4" style={later(300 + i * 650)}>
              <span className="font-mono text-[15px] text-faint">Round {round}</span>
              <span className="text-[19px] text-ink">The grid still hides the first card on a 360 px phone</span>
              {i > 0 && <span className="pz-pop ml-auto shrink-0 rounded-full bg-rose-500/20 px-3 py-0.5 font-mono text-[13px] text-rose-200" style={later(300 + i * 650 + 500)}>same finding</span>}
            </div>
          ))}
          {/* the round that is not run */}
          <div className="pz-appear flex items-center gap-5 rounded-xl border border-dashed border-hairline px-5 py-4" style={later(2500)}>
            <span className="font-mono text-[15px] text-faint">Round 4</span>
            <span className="text-[19px] text-faint line-through decoration-rose-400/70">The grid still hides the first card on a 360 px phone</span>
            <span className="ml-auto shrink-0 font-mono text-[13px] text-rose-300">not run</span>
          </div>
          <div className="pz-appear text-[19px] text-muted" style={later(2800)}>The fixer has tried twice. A fourth round would only spend money.</div>
        </div>
      </Show>

      {/* what it leaves behind */}
      <Show on={step >= 1} from="up" style={at(80, 70, 840)} className={`${box} overflow-hidden pb-6`}>
        <div className="flex items-center gap-3 border-b border-hairline px-6 py-4">
          <IssueIcon className="size-6 text-emerald-400" />
          <span className="font-display text-[24px] text-ink">#140 Keep sessions in view on mobile</span>
        </div>
        <div className="flex items-center gap-2 px-6 pt-4">
          <span className="text-[15px] text-faint">labels</span>
          <span className="pz-strike text-amber-300" style={later(RELABEL_AT)}><Label name="needs-human" /></span>
          <span className="pz-pop" style={later(RELABEL_AT)}><Label name="ready-for-ai" /></span>
        </div>
        <div className="m-6 mb-4 rounded-xl border border-hairline bg-raised p-5">
          <div className="flex items-center gap-2 text-[15px] text-faint"><span className="grid size-7 place-items-center rounded-full bg-violet-500/30 text-[14px]">🤖</span> ship · stopped at Code audit</div>
          <div className="mt-3 text-[18px] text-ink">I could not get the first card into view on a 360 px phone without hiding the day tabs. <b>Still open:</b></div>
          <ul className="mt-2 space-y-1 text-[17px] text-muted">
            <li>• keep the day tabs visible, or collapse them behind Filters?</li>
            <li>• draft PR #142 has everything else, green</li>
          </ul>
        </div>
        <Show on={step >= 1} from="left" delay={RELABEL_AT - 900} className="mx-6 rounded-xl border border-sky-400/40 bg-sky-500/10 p-5">
          <div className="flex items-center gap-2 text-[15px] text-faint"><span className="grid size-7 place-items-center rounded-full bg-sky-500/30 text-[14px]">🙋</span> you</div>
          <div className="mt-2 text-[18px] text-ink">Collapse them behind Filters — the day is in the heading anyway.</div>
        </Show>
      </Show>

      <Show on={step >= 1} from="right" delay={400} style={at(960, 70, 560, 250)} className={`${box} p-6`}>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-overlay px-3 py-1 text-[14px] font-semibold text-muted"><PrIcon /> Draft</span>
          <span className="font-display text-[22px] text-ink">#142</span>
        </div>
        <div className="mt-3 text-[18px] text-muted"><Code>Refs #140</Code> — not <i>Closes</i>. The branch, the spec, every round so far, and what is still open.</div>
      </Show>

      <Show on={step >= 1} from="right" delay={700} style={at(960, 350, 560, 260)} className="flex flex-col justify-center gap-3">
        <div className="pz-appear rounded-2xl border border-violet-400/50 bg-raised p-6" style={later(RELABEL_AT + 400)}>
            <div className="font-display text-[26px] text-ink">🔁 Back into ship</div>
            <div className="mt-2 text-[18px] text-muted">Relabel <Label name="ready-for-ai" className="mx-1 text-[12px]" /> and a fresh run picks up the answer, the branch and the spec.</div>
          </div>
      </Show>
    </>
  );
}

const NEEDS_HUMAN_BEATS = [
  {
    kicker: '4.8 · When it will not converge',
    title: 'The same finding, surviving two fixes',
    body: 'Some tickets cannot be finished by an agent — the ticket contradicts itself, or the fix needs a decision only a person can make. Ship notices it is going round in circles and stops.',
  },
  {
    kicker: '4.8 · needs-human, then you',
    title: 'It hands back everything it knows; you answer and relabel',
    body: 'A draft pull request with the work so far, a comment saying exactly what is still open, and the needs-human label for the board. You make the call it could not; relabel ready-for-ai and a fresh run starts from your answer.',
  },
];

/* ------------------------------------------------------------------ *
 * Code review and QA — two runners, a confidence each.
 * ------------------------------------------------------------------ */

function Runner({ icon, name, file, lines, step, glow }) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-[#0d0f15] transition-all duration-700 ${glow ? 'border-violet-400/50' : 'border-hairline'}`}>
      <div className="flex items-center gap-3 border-b border-hairline bg-surface px-5 py-3">
        <span className="text-[24px]">{icon}</span>
        <span className="font-display text-[22px] text-ink">{name}</span>
        <span className="ml-auto font-mono text-[13px] text-faint">{file}</span>
      </div>
      <div className="space-y-1.5 px-5 py-4 font-mono text-[15px] text-muted">
        {lines.map((l, i) => <div key={i} className="pz-appear" style={later(step + i * 350)}>{l}</div>)}
      </div>
      <div className="relative h-1 overflow-hidden bg-overlay"><div className="pz-scan absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-300 to-transparent" /></div>
    </div>
  );
}

function ReviewScene({ step }) {
  return (
    <>
      <Show on={step === 0} style={at(80, 80, 380, 260)} className={`${box} p-6`}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[14px] font-semibold text-white"><PrIcon /> Open</span>
        <div className="mt-3 font-display text-[24px] leading-tight text-ink">#142 Keep sessions in view on mobile</div>
        <div className="mt-2 text-[16px] text-muted">opened → two workflows start, side by side</div>
      </Show>
      <Show on={step === 0} delay={200} style={at(80, 370, 380, 230)} className={`${box} p-6`}>
        <Kicker>Sized from facts, not an agent’s word</Kicker>
        <div className="mt-2 font-mono text-[15px] text-ink">scripts/qa-facts.mjs</div>
        <div className="mt-3 space-y-1 text-[16px] text-muted">
          <div>tiny ≤30 lines · <b className="text-ink">small</b> ≤300 · large</div>
          <div>risky paths are never tiny</div>
          <div>the team’s dial: <Code>REVIEW_DEPTH</Code></div>
        </div>
      </Show>
      <Replay on={step === 0} from="right" delay={300} style={at(500, 80, 1020, 520)} className="grid grid-rows-2 gap-5">
        <Runner icon="🔍" name="Code review" file="agent-code-review.yml" step={400}
          lines={['size: small → one reviewer · Sonnet', 'reads the ticket first, then the diff', 'every blocker → a skeptic']} />
        <Runner icon="🧪" name="QA" file="agent-qa.yml" step={600}
          lines={['size: small → ≤3 probes · Sonnet', 'triage: are the PR’s own tests enough?', 'drives the app · desktop + mobile']} />
      </Replay>

      {/* QA in detail */}
      <Replay on={step === 1} style={at(80, 80, 1440, 520)} className="grid grid-cols-[1.25fr_1fr] gap-8">
        <div className="relative">
          <div className={`${box} absolute left-0 top-0 h-[330px] w-[560px] overflow-hidden`}>
            <div className="flex gap-1.5 border-b border-hairline px-4 py-2"><span className="size-2.5 rounded-full bg-overlay" /><span className="size-2.5 rounded-full bg-overlay" /><span className="size-2.5 rounded-full bg-overlay" /><span className="ml-3 font-mono text-[12px] text-faint">desktop · 1440 × 900 · /schedule</span></div>
            <div className="grid grid-cols-[150px_1fr] gap-3 p-4">
              <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-6 rounded bg-raised" />)}</div>
              <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[72px] rounded-lg bg-raised" />)}</div>
            </div>
          </div>
          <div className={`${box} absolute left-[600px] top-0 h-[460px] w-[230px] overflow-hidden rounded-[28px] border-2`}>
            <div className="mx-auto mt-2 h-1.5 w-16 rounded-full bg-overlay" />
            <div className="p-3 font-mono text-[11px] text-faint">Pixel 7 · /schedule</div>
            <div className="space-y-2 px-3">
              <div className="flex gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-5 flex-1 rounded bg-violet-500/30" />)}</div>
              <div className="grid grid-cols-2 gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-5 rounded bg-raised" />)}</div>
              {[0, 1, 2, 3].map((i) => <div key={i} className={`h-[60px] rounded-lg ${i === 0 ? 'bg-emerald-500/20 ring-1 ring-emerald-400/60' : 'bg-raised'}`} />)}
            </div>
          </div>
          {[[120, 70, 400], [330, 210, 900], [700, 230, 1400], [690, 120, 1900]].map(([x, y, d], i) => (
            <motion.span
              key={i}
              className="absolute grid size-9 place-items-center rounded-full bg-cyan-400/90 font-mono text-[14px] font-bold text-ground shadow-lg shadow-cyan-500/40"
              style={{ left: x, top: y }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.3, 1], opacity: 1 }}
              transition={{ delay: d / 1000, duration: 0.5 }}
            >
              {i + 1}
            </motion.span>
          ))}
          <div className="pz-appear absolute left-0 top-[360px] w-[560px] text-[17px] text-muted" style={later(2200)}>
            Every failure is reproduced on the branch <b className="text-ink">and on main</b> — so a bug that was already there is called pre-existing, not pinned on this change.
          </div>
        </div>
        <div className="flex flex-col justify-center gap-4">
          <Kicker>Probes, in a real browser</Kicker>
          {['Filters open on a phone: first card in view', 'every filter reachable at 360 px', 'search, then clear filters', 'grid untouched on desktop'].map((p, i) => (
            <div key={p} className="pz-appear flex items-center gap-3 text-[18px] text-ink" style={later(500 + i * 500)}><Tick /> {p}</div>
          ))}
          <div className="pz-appear mt-2" style={later(2600)}>
            <Verdict pass level="high" title="QA">Both viewports, empty and full agendas.</Verdict>
          </div>
        </div>
      </Replay>

      {/* confidence decides who reads it */}
      <Replay on={step === 2} style={at(80, 80, 1440, 520)} className="grid grid-cols-2 gap-8">
        <div className="pz-appear flex flex-col gap-4 rounded-3xl border border-emerald-400/40 bg-emerald-500/[0.06] p-7" style={later(100)}>
          <Kicker className="text-emerald-300">Both high</Kicker>
          <Verdict pass level="high" title="Code review">Every criterion traced.</Verdict>
          <Verdict pass level="high" title="QA">Every criterion exercised, both viewports.</Verdict>
          <div className="mt-auto flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-full bg-emerald-500/20 text-[30px]">⚡</span>
            <div><div className="font-display text-[28px] text-emerald-200">Merge on sight</div><div className="text-[16px] text-muted">the agents could judge all of it, and found nothing</div></div>
          </div>
        </div>
        <div className="pz-appear flex flex-col gap-4 rounded-3xl border border-amber-400/40 bg-amber-500/[0.06] p-7" style={later(700)}>
          <Kicker className="text-amber-300">One low</Kicker>
          <Verdict pass level="high" title="Code review">Every criterion traced.</Verdict>
          <Verdict pass level="low" title="QA">The change is in the seed — none of it is reachable from the UI.</Verdict>
          <div className="mt-auto flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-full bg-amber-500/20 text-[30px]">👀</span>
            <div><div className="font-display text-[28px] text-amber-200">Unproven — read it yourself</div><div className="text-[16px] text-muted">a pass nobody could earn does not read like one</div></div>
          </div>
        </div>
      </Replay>

    </>
  );
}

const REVIEW_BEATS = [
  {
    kicker: '5 · After the pull request opens',
    title: 'Two more agents, on their own runners, in parallel',
    body: 'Code review and QA start when the pull request opens, sized from facts about the diff. The reviewer reads the ticket before the code and forms its own view; every blocker must name a real path to harm and survive a skeptic.',
  },
  {
    kicker: '5 · QA',
    title: 'It tries to break the change in a real browser',
    body: 'Not the tests again — it reads the tests the pull request added and probes the gaps they leave, on desktop and mobile. Every failure is reproduced on the branch and on main, so a bug that was already there is called pre-existing, not pinned on this change.',
  },
  {
    kicker: '5 · Confidence means coverage',
    title: 'The confidence tells you how to review it',
    body: 'High on both means the agents could judge all of it and found nothing — merge it. Low publishes as unproven, not green: that is the one a person should actually read. Machines gate, agents advise, people merge.',
  },
];

/* ------------------------------------------------------------------ *
 * Merge, deploy, and what it cost.
 * ------------------------------------------------------------------ */

/* Sparks thrown from the merge button — a fixed pattern, so every run looks the same. */
const SPARKS = Array.from({ length: 34 }, (_, i) => {
  const a = (i / 34) * Math.PI * 2 + (i % 3) * 0.13;
  const r = 260 + ((i * 37) % 180);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.6, s: 8 + ((i * 5) % 12), c: ['bg-violet-300', 'bg-fuchsia-300', 'bg-cyan-300', 'bg-emerald-300'][i % 4] };
});

function Burst() {
  return SPARKS.map((p, i) => (
    <motion.span
      key={i}
      className={`pointer-events-none absolute rounded-full ${p.c} shadow-[0_0_12px_2px_currentColor]`}
      style={{ left: '50%', top: '78%', width: p.s, height: p.s, marginLeft: -p.s / 2, marginTop: -p.s / 2 }}
      initial={{ x: 0, y: 0, opacity: 1, scale: 0.2 }}
      animate={{ x: p.x, y: p.y, opacity: 0, scale: [0.2, 1.2, 0.6] }}
      transition={{ duration: 1.1 + (i % 4) * 0.14, ease: [0.16, 1, 0.3, 1], opacity: { duration: 1.1 + (i % 4) * 0.14, ease: 'easeIn' } }}
      aria-hidden="true"
    />
  ));
}

function MergeScene({ step }) {
  const [merged, setMerged] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMerged(true), 1300);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <Show on={step === 0} from="scale" style={at(330, 90, 940, 500)} className={`${box} flex flex-col items-center justify-center p-10 text-center`}>
        {merged && <Burst />}
        <motion.div
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[20px] font-semibold text-white ${merged ? 'bg-violet-600' : 'bg-emerald-600'}`}
          animate={{ scale: merged ? [1, 1.25, 1] : 1 }}
          transition={{ duration: 0.5 }}
        >
          {merged ? <MergeIcon className="size-5" /> : <PrIcon className="size-5" />} {merged ? 'Merged' : 'Open'}
        </motion.div>
        <div className="mt-6 font-display text-[40px] leading-tight text-ink">Keep sessions in view on mobile <span className="font-sans font-normal text-faint">#142</span></div>
        <div className="mt-4 flex gap-3">
          <Verdict pass level="high" title="Code review" className="text-left" />
          <Verdict pass level="high" title="QA" className="text-left" />
        </div>
        <motion.button
          type="button"
          tabIndex={-1}
          className={`relative mt-8 rounded-xl px-8 py-4 font-display text-[24px] text-white ${merged ? 'bg-violet-700/50' : 'bg-emerald-600'}`}
          animate={merged ? { scale: [1, 0.92, 1.06, 1] } : {}}
          transition={{ duration: 0.5 }}
        >
          {merged ? '✓ Pull request merged' : 'Merge pull request'}
          {!merged && <span className="pz-ping absolute inset-0 rounded-xl border-2 border-emerald-300" style={{ animationDelay: '700ms' }} aria-hidden="true" />}
        </motion.button>
        {merged && <motion.div className="pointer-events-none absolute inset-0 rounded-2xl" initial={{ boxShadow: '0 0 0 0 rgba(139,92,246,0.7)', backgroundColor: 'rgba(196,181,253,0.16)' }} animate={{ boxShadow: '0 0 0 90px rgba(139,92,246,0)', backgroundColor: 'rgba(196,181,253,0)' }} transition={{ duration: 1.1 }} />}
      </Show>

    </>
  );
}

const MERGE_BEATS = [
  {
    kicker: '6 · A person merges',
    title: 'The last step is always yours',
    body: 'Two high-confidence passes and a green gate: read the description, check the decisions it made for you, press the button. Main is verified again, deployed only if green, and counted only once the new commit answers its health check.',
  },
];

/* ------------------------------------------------------------------ *
 * Many at once.
 * ------------------------------------------------------------------ */

const TICKETS = [64, 65, 66, 67, 68, 69, 70, 71, 72, 73];
const STAGES = ['setup', 'spec', 'build', 'gate', 'audit', 'PR'];

function ScaleScene({ step }) {
  return (
    <>
      <Replay on={step === 0} style={at(80, 70, 1440, 540)} className={`${box} overflow-hidden`}>
        <div className="grid grid-cols-[110px_250px_1fr_150px] border-b border-hairline bg-raised px-6 py-2.5 font-mono text-[13px] uppercase tracking-wider text-faint">
          <span>ticket</span><span>worktree · lane</span><span>{STAGES.join(' → ')}</span><span className="text-right">result</span>
        </div>
        {TICKETS.map((n, i) => {
          const human = n === 70;
          const dur = 3.2 + ((i * 7) % 5) * 0.55;
          return (
            <div key={n} className="pz-appear grid grid-cols-[110px_250px_1fr_150px] items-center border-b border-hairline/50 px-6 py-[9px]" style={later(i * 90)}>
              <span className="font-mono text-[17px] text-ink">#{n}</span>
              <span className="font-mono text-[14px] text-muted">wt-{n} · :{4300 + 2 * (i + 1)}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-overlay">
                <motion.div
                  className={`h-full rounded-full ${human ? 'bg-gradient-to-r from-violet-500 to-amber-400' : 'bg-gradient-to-r from-violet-500 to-cyan-300'}`}
                  initial={{ width: '0%' }}
                  animate={{ width: human ? '78%' : '100%' }}
                  transition={{ duration: dur, delay: 0.4 + i * 0.12, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
              <motion.span
                className="text-right"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.12 + dur, type: 'spring', stiffness: 300, damping: 15 }}
              >
                {human ? <Label name="needs-human" className="text-[12px]" /> : <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-emerald-300"><PrIcon /> PR</span>}
              </motion.span>
            </div>
          );
        })}
        {/* the tally, once the last lane is home */}
        <div className="pz-appear flex items-center gap-6 px-6 py-3 text-[16px] text-muted" style={later(7000)}>
          <span className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300"><PrIcon /> 9</span> pull requests, ready for review</span>
          <span className="flex items-center gap-2"><Label name="needs-human" className="text-[12px]" /> 1 question, back to you</span>
          <span className="ml-auto font-mono text-[14px] text-faint">nobody watched any of them</span>
        </div>
      </Replay>

    </>
  );
}

const SCALE_BEATS = [
  {
    kicker: '7 · Don’t babysit one ticket — hand it ten',
    title: '/ship 64 65 66 67 68 69 70 71 72 73',
    body: 'Nothing about ship needs you watching, so start the next nine. Each ticket gets its own worktree and ports — or label ten issues and get ten runners. Most come back as pull requests, one as a question. The limit is not the worktrees — it is how many you can review well.',
  },
];

/* ------------------------------------------------------------------ *
 * Your role — what the harness leaves to you, then the bookend.
 * ------------------------------------------------------------------ */

/** Every ticket's AI spend — the dial you tune the harness by. */
function CostPanel({ on }) {
  return (
    <Replay on={on} style={at(80, 80, 1440, 520)} className="grid grid-cols-[1fr_1fr_1fr] gap-6">
      <div className={`${box} col-span-1 p-6`}>
        <Kicker>On every issue</Kicker>
        <div className="mt-2 font-display text-[28px] text-ink">🧾 AI spend</div>
        <div className="mt-1 text-[16px] text-muted">one comment, updated after every run</div>
        <div className="mt-5 space-y-3">
          {[['ship', 0.82], ['code review', 0.36], ['QA', 0.58], ['respond', 0.18]].map(([run, w], i) => (
            <div key={run}>
              <div className="flex justify-between text-[15px] text-muted"><span>{run}</span></div>
              <div className="mt-1 flex h-3 overflow-hidden rounded-full bg-overlay">
                <span className="pz-fill block h-full bg-violet-400" style={{ width: `${w * 60}%`, animationDuration: '0.9s', animationDelay: `${300 + i * 200}ms` }} />
                <span className="pz-fill block h-full bg-sky-400" style={{ width: `${w * 30}%`, animationDuration: '0.9s', animationDelay: `${500 + i * 200}ms` }} />
                <span className="pz-fill block h-full bg-emerald-400" style={{ width: `${w * 10}%`, animationDuration: '0.9s', animationDelay: `${700 + i * 200}ms` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex gap-2"><Model m="opus" /><Model m="sonnet" /><Model m="haiku" /></div>
      </div>
      {[
        { tone: 'emerald', pr: 96, title: 'Name the search when nothing matches', size: '🟢 A small ticket', ship: '12 min · Sonnet · one audit round', qa: 'QA skipped in 16 s — covered by its own tests', cost: 0.91 },
        { tone: 'sky', pr: 97, title: 'Fix Undo after removing an ended seat', size: '🔵 A bigger ticket', ship: '22 min · Opus · plan audit, three lenses', qa: 'QA high confidence — 3 browser probes', cost: 7.99 },
      ].map((t, i) => (
        <div key={t.pr} className={`pz-appear flex flex-col rounded-2xl border p-6 ${t.tone === 'emerald' ? 'border-emerald-400/40 bg-emerald-500/[0.05]' : 'border-sky-400/40 bg-sky-500/[0.05]'}`} style={later(400 + i * 400)}>
          <Kicker>{t.size}</Kicker>
          <div className="mt-2 font-display text-[24px] leading-tight text-ink">PR #{t.pr} — {t.title}</div>
          <div className="mt-4 space-y-2 text-[16px] text-muted">
            <div>🚢 {t.ship}</div>
            <div>🔍 code review: high confidence, about a minute</div>
            <div>🧪 {t.qa}</div>
          </div>
          <div className="mt-auto pt-4 font-display text-[64px] leading-none text-ink">
            <Count to={t.cost} prefix="$" decimals={2} delay={700 + i * 400} />
          </div>
          <div className="text-[15px] text-faint">label to merged, nobody at a terminal</div>
        </div>
      ))}
    </Replay>
  );
}

function RoleScene({ step }) {
  return (
    <>
      <CostPanel on={step === 0} />

      <Show on={step === 1} style={at(80, 90, 1440, 500)} className="grid grid-cols-4 gap-6">
        {[
          ['✍️', 'You write the ticket', 'Its Done when is the contract every agent is judged against. The thinking moved up front — it did not go away.'],
          ['🔧', 'You tune the harness', 'Which model, how many rounds, which checks. Shaping it to your codebase is engineering work, and it is yours.'],
          ['🚦', 'You keep the gate', 'Nothing merges itself. The confidence tells you where your attention goes; the artifacts let you check in a minute.'],
          ['🧠', 'You pace the work', 'You lead a team of agents now. Run as many as you can review well — that is the real limit.'],
        ].map(([icon, t, d], i) => (
          <motion.div
            key={t}
            className={`${box} flex flex-col p-7`}
            initial={{ opacity: 0, y: 60, rotateX: -25 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay: 0.2 + i * 0.15, type: 'spring', stiffness: 120, damping: 16 }}
          >
            <span className="text-[52px]">{icon}</span>
            <div className="mt-5 font-display text-[30px] leading-tight text-ink">{t}</div>
            <div className="mt-3 text-[18px] text-muted">{d}</div>
          </motion.div>
        ))}
      </Show>

      {/* the bookend: the title's orbits, back behind the last words */}
      <Show on={step === 2} from="none" delay={400} style={at(0, 0, 1600, 900)} className="pointer-events-none">
        <Orbits style={at(380, 10, 840, 840)} className="opacity-30" />
      </Show>
      <Show on={step === 2} from="scale" style={at(80, 70, 1440, 760)} className="flex flex-col items-center justify-center text-center">
        <div className="font-display text-[88px] leading-[0.98] text-ink">
          Have the conversation.<br />
          Review the pull request.<br />
          <span className="pz-shine bg-clip-text text-transparent">The harness does the rest.</span>
        </div>
        <div className="mt-10 font-mono text-[20px] text-muted">github.com/EqualExperts/nam-2026-conference</div>
        <div className="mt-3 text-[17px] text-faint">The ship loop is Andy Vays’s design · built by Jonas Claesson and Abraham Marín Pérez at Equal Experts</div>
      </Show>
    </>
  );
}

const ROLE_BEATS = [
  {
    kicker: '8 · Tuning it is your job',
    title: 'Every ticket says what it cost — so you can tune it',
    body: 'One AI spend comment per issue, split by run and by model: under a dollar for a small fix, eight for a bigger one. When a small ticket costs like a big one, this is how you notice — and the sizing rules are yours to change.',
  },
  {
    kicker: '8 · Your role',
    title: 'You are the tech lead of a team of agents',
    body: 'None of this replaces engineering judgement; it moves it to where it counts. And trust comes from what you can check — a spec, a failing test, every audit round, a confidence on every review — not from the model.',
  },
  null,
];

/* ------------------------------------------------------------------ *
 * Now you — the lab: ship a ticket of your own, in your fork. Drawn as
 * the room will see it: GitHub in a browser and the Code tab of Claude
 * Desktop — no terminal, which is not where most of the room works.
 * ------------------------------------------------------------------ */

const LAB_STEPS = [
  ['🎫', 'Pick a ticket', 'on GitHub, in your fork’s Issues'],
  ['🚢', 'Ship it', 'ask Claude Desktop, in the Code tab'],
  ['👀', 'Review what comes back', 'the pull request — or the question'],
];

/** A browser window, as on the attendee's own laptop. */
function Browser({ url, children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl shadow-black/40 ${className}`}>
      <div className="flex items-center gap-2 border-b border-hairline bg-raised px-4 py-2.5">
        <span className="size-3 rounded-full bg-overlay" /><span className="size-3 rounded-full bg-overlay" /><span className="size-3 rounded-full bg-overlay" />
        <span className="ml-3 flex-1 rounded-md bg-ground/60 px-3 py-1 font-mono text-[13px] text-faint">{url}</span>
      </div>
      {children}
    </div>
  );
}

/** One message in the Claude Desktop chat. */
function Bubble({ me, delay, children }) {
  return (
    <div className={`pz-appear flex gap-3 ${me ? 'justify-end' : ''}`} style={later(delay)}>
      {!me && <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#d97757]/25 text-[15px]">✳️</span>}
      <div className={`max-w-[560px] rounded-2xl px-4 py-3 text-[17px] ${me ? 'bg-violet-500/25 text-ink' : 'bg-raised text-muted'}`}>{children}</div>
    </div>
  );
}

/** The turn from talk to lab: the room's cue to open their laptops. */
function YourTurn() {
  return (
    <div className="flex size-full flex-col items-center justify-center text-center">
      <Kicker className="pz-appear">That was the theory</Kicker>
      <div className="pz-appear mt-5 font-display text-[110px] leading-none text-ink" style={later(200)}>
        Now it’s <span className="pz-shine bg-clip-text text-transparent">your turn</span>
      </div>
      <div className="pz-appear mt-6 max-w-[980px] text-[26px] leading-snug text-muted" style={later(600)}>
        One ticket from your fork, all the way to a pull request — in GitHub and Claude Desktop. About twenty minutes, and we are here to help.
      </div>
      <div className="mt-12 flex gap-5">
        {LAB_STEPS.map(([icon, title, sub], i) => (
          <div key={title} className="pz-appear w-[370px] rounded-2xl border border-hairline bg-surface px-6 py-5 text-left" style={later(1100 + i * 250)}>
            <div className="font-mono text-[14px] text-emerald-300">step {i + 1}</div>
            <div className="mt-1 text-[22px] font-semibold text-ink">{icon} {title}</div>
            <div className="text-[16px] text-muted">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabScene({ step: beat }) {
  // beat 0 is the turn to the room; the three steps follow it
  const step = beat - 1;
  return (
    <>
      <Show on={beat === 0} from="scale" style={at(80, 60, 1440, 780)}><YourTurn /></Show>

      <Show on={beat > 0} from="left" style={at(80, 80, 440, 520)} className="flex flex-col gap-4">
        {LAB_STEPS.map(([icon, title, sub], i) => (
          <div key={title} className={`flex items-center gap-4 rounded-2xl border px-5 py-5 transition-all duration-500
            ${i === step ? 'pz-glow border-emerald-400/60 bg-raised' : 'border-hairline bg-surface'} ${i > step ? 'opacity-45' : ''}`}>
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-overlay font-display text-[24px] text-ink">{i < step ? '✓' : i + 1}</span>
            <div>
              <div className="text-[22px] font-semibold text-ink">{icon} {title}</div>
              <div className="text-[16px] text-muted">{sub}</div>
            </div>
          </div>
        ))}
      </Show>

      {/* 1 · the fork's Issues tab, then the ticket itself */}
      <Replay on={step === 0} from="right" style={at(570, 80, 950, 520)}>
        <Browser url="github.com/you/nam-2026-conference/issues" className="h-full">
          <div className="flex gap-6 border-b border-hairline px-6 pt-3 text-[15px] text-muted">
            <span>Code</span><span className="border-b-2 border-[#fd8c73] pb-2 font-semibold text-ink">Issues 2</span><span>Pull requests</span><span>Actions</span>
          </div>
          <div className="px-6 py-3">
            {[
              ['Pick more than one track on the schedule', true],
              ['Name the search when nothing matches', false],
            ].map(([t, pick], i) => (
              <div key={t} className={`pz-appear flex items-center gap-3 rounded-lg px-3 py-2.5 text-[18px] ${pick ? 'bg-emerald-500/10 ring-1 ring-emerald-400/50' : ''}`} style={later(200 + i * 150)}>
                <IssueIcon className="size-5 text-emerald-400" />
                <span className="text-ink">{t}</span>
                <span className="text-faint">#{42 + i}</span>
                {pick && <span className="pz-pop ml-auto rounded-full bg-emerald-500/20 px-3 py-0.5 text-[13px] font-semibold text-emerald-200" style={later(900)}>👈 this one</span>}
              </div>
            ))}
          </div>
          <div className="pz-appear mx-6 rounded-xl border border-hairline bg-raised px-5 py-4" style={later(1300)}>
            <div className="font-display text-[22px] text-ink">Pick more than one track on the schedule <span className="font-sans text-faint">#42</span></div>
            <div className="mt-3 font-display text-[18px] text-ink">Done when</div>
            <ul className="mt-1 space-y-1 text-[16px] text-muted">
              {['the schedule’s track filter takes more than one track', 'it shows sessions in any of the tracks picked'].map((d, i) => (
                <li key={d} className="pz-appear flex gap-2" style={later(1700 + i * 200)}><span className="text-violet-300">☐</span>{d}</li>
              ))}
            </ul>
            <div className="pz-appear mt-2 text-[15px] text-faint" style={later(2200)}><b className="text-muted">Out of scope:</b> the speakers page</div>
          </div>
        </Browser>
      </Replay>

      {/* 2 · Claude Desktop, Code tab, opened on the fork's folder */}
      <Replay on={step === 1} from="right" style={at(570, 80, 950, 520)} className="flex flex-col gap-4">
        <div className="flex h-[370px] overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl shadow-black/40">
          <div className="w-[190px] shrink-0 border-r border-hairline bg-raised p-4">
            <div className="flex rounded-lg bg-ground/60 p-1 text-[14px]">
              <span className="flex-1 rounded-md py-1 text-center text-faint">Chat</span>
              <span className="flex-1 rounded-md bg-overlay py-1 text-center font-semibold text-ink">Code</span>
            </div>
            <div className="mt-4 text-[12px] uppercase tracking-wider text-faint">Folder</div>
            <div className="mt-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[14px] text-ink">📁 nam-2026-conference</div>
          </div>
          <div className="flex flex-1 flex-col">
            <div className="flex-1 space-y-3 p-5">
              <Bubble me delay={300}>Hey, can you ship GitHub issue #42?</Bubble>
              <Bubble delay={1200}>
                On it. I’ll post every step on issue #42, so you can follow it there.
                <div className="mt-2 space-y-1 text-[15px]">
                  {['Read the ticket — it can be built', 'A small one: about 15 minutes', 'Writing the plan…'].map((l, i) => (
                    <div key={l} className="pz-appear flex gap-2" style={later(1700 + i * 450)}><span className={i < 2 ? 'text-emerald-300' : 'text-amber-300'}>{i < 2 ? '✓' : '●'}</span>{l}</div>
                  ))}
                </div>
              </Bubble>
            </div>
            <div className="m-4 mt-0 rounded-xl border border-hairline bg-ground/50 px-4 py-2.5 text-[15px] text-faint">Reply to Claude…</div>
          </div>
        </div>
        <div className="pz-appear grid grid-cols-2 gap-4" style={later(3000)}>
          <div className={`${box} px-5 py-3`}>
            <Kicker>While it runs</Kicker>
            <div className="mt-1 text-[17px] text-muted">Watch the issue on GitHub. The plan lands first — read it.</div>
          </div>
          <div className={`${box} px-5 py-3`}>
            <Kicker>Another ticket?</Kicker>
            <div className="mt-1 text-[17px] text-muted">Ask in the same chat: “ship #43 too”.</div>
          </div>
        </div>
      </Replay>

      {/* 3 · the pull request on GitHub, or the question */}
      <Replay on={step === 2} from="right" style={at(570, 80, 950, 520)} className="flex flex-col gap-4">
        <Browser url="github.com/you/nam-2026-conference/pull/44">
          <div className="px-6 py-4">
            <div className="font-display text-[24px] text-ink">Pick more than one track on the schedule <span className="font-sans text-faint">#44</span></div>
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-[14px] font-semibold text-white"><PrIcon /> Open</span>
            <div className="mt-3 flex gap-3">
              <Verdict pass level="high" title="Code review" className="text-left" />
              <Verdict pass level="high" title="QA" className="text-left" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-[15px]">
              {['🤔 Decisions for you', '🧪 Try it', '📄 Files changed — the code'].map((t, i) => (
                <div key={t} className="pz-appear rounded-lg border border-hairline bg-raised px-3 py-2 text-ink" style={later(500 + i * 200)}>{t}</div>
              ))}
            </div>
          </div>
        </Browser>
        <div className="pz-appear grid grid-cols-[1fr_1fr] gap-4" style={later(1200)}>
          <div className="rounded-2xl border-2 border-dashed border-amber-400/60 bg-amber-500/10 px-5 py-3">
            <Label name="needs-human" />
            <div className="mt-1 text-[16px] text-muted">Read its question, answer it on the issue, then ask Claude to ship it again.</div>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-violet-400/40 bg-raised px-5">
            <span className="text-[34px]">🙋</span>
            <span className="text-[18px] text-ink">Stuck? Put your hand up — we are walking the room.</span>
          </div>
        </div>
      </Replay>
    </>
  );
}

const LAB_BEATS = [
  null,
  {
    kicker: '9 · Now you · step 1',
    title: 'Pick a ticket from your fork',
    body: 'On GitHub, open your fork’s Issues tab. Use the one the product harness just raised, or any issue with a Done when list — and read it first: what it asks for, and what it leaves out.',
  },
  {
    kicker: '9 · Now you · step 2',
    title: 'Ask Claude to ship it — then let it run',
    body: 'In Claude Desktop, open the Code tab on your nam-2026-conference folder and ask in plain words: “can you ship issue #42?” Then follow the issue on GitHub, not the chat.',
  },
  {
    kicker: '9 · Now you · step 3',
    title: 'Review what comes back — and read the code',
    body: 'A pull request: check its confidence and its decisions, open Files changed and read the code, then merge it. A needs-human: answer the question and ship it again. Either way, you decide.',
  },
];

export const NEEDS_HUMAN = [
  { id: 'needs-human', name: 'When it gets stuck', accent: 'text-amber-300', tone: 'amber', beats: NEEDS_HUMAN_BEATS, Scene: NeedsHumanScene },
];

export const AFTER = [
  { id: 'review', name: 'Review and QA', accent: 'text-cyan-300', tone: 'cyan', beats: REVIEW_BEATS, Scene: ReviewScene },
  { id: 'merge', name: 'Merge', accent: 'text-violet-300', tone: 'violet', beats: MERGE_BEATS, Scene: MergeScene },
  { id: 'scale', name: 'Many at once', accent: 'text-sky-300', tone: 'sky', beats: SCALE_BEATS, Scene: ScaleScene },
  { id: 'role', name: 'Your role', accent: 'text-violet-300', tone: 'violet', beats: ROLE_BEATS, Scene: RoleScene },
  { id: 'lab', name: 'Now you', accent: 'text-emerald-300', tone: 'emerald', beats: LAB_BEATS, Scene: LabScene },
];
