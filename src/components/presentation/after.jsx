import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { at, Show, Replay, Code, Label, Kicker, Tick, Verdict, IssueIcon, PrIcon, MergeIcon, later } from './kit.jsx';

const box = 'rounded-2xl border border-edge bg-surface';

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
            <circle cx="260" cy="240" r="170" fill="none" stroke="#1f5c80" strokeWidth="3" />
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
          <IssueIcon className="size-6 text-teal-400" />
          <span className="font-display text-[24px] text-ink">#140 Keep sessions in view on mobile</span>
        </div>
        <div className="flex items-center gap-2 px-6 pt-4">
          <span className="text-[15px] text-faint">labels</span>
          <span className="pz-strike text-amber-300" style={later(RELABEL_AT)}><Label name="needs-human" /></span>
          <span className="pz-pop" style={later(RELABEL_AT)}><Label name="ready-for-ai" /></span>
        </div>
        <div className="m-6 mb-4 rounded-xl border border-hairline bg-raised p-5">
          <div className="flex items-center gap-2 text-[15px] text-faint"><span className="grid size-7 place-items-center rounded-full bg-blue-500/30 text-[14px]">🤖</span> ship · stopped at Code audit</div>
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
        <div className="pz-appear rounded-2xl border border-blue-400/50 bg-raised p-6" style={later(RELABEL_AT + 400)}>
            <div className="font-display text-[26px] text-ink">🔁 Back into ship</div>
            <div className="mt-2 text-[18px] text-muted">Relabel <Label name="ready-for-ai" className="mx-1 text-[12px]" /> and a fresh run picks up the answer, the branch and the spec.</div>
          </div>
      </Show>
    </>
  );
}

const NEEDS_HUMAN_BEATS = [
  {
    kicker: '4.9 · When it will not converge',
    title: 'The same finding, surviving two fixes',
    body: 'Some tickets cannot be finished by an agent — the ticket contradicts itself, or the fix needs a decision only a person can make. Ship notices it is going round in circles and stops.',
  },
  {
    kicker: '4.9 · needs-human, then you',
    title: 'It hands back everything it knows; you answer and ship it again',
    body: 'A draft pull request with the work so far, a comment saying exactly what is still open, and the needs-human label for the board. You make the call it could not, then ship it again — a fresh run starts from your answer.',
  },
];

/* ------------------------------------------------------------------ *
 * Code review and QA — two runners, a confidence each.
 * ------------------------------------------------------------------ */

function Runner({ icon, name, file, lines, step, glow }) {
  return (
    <div className={`overflow-hidden rounded-2xl border bg-[#071322] transition-all duration-700 ${glow ? 'border-blue-400/50' : 'border-hairline'}`}>
      <div className="flex items-center gap-3 border-b border-edge bg-surface px-5 py-3">
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1 text-[14px] font-semibold text-white"><PrIcon /> Open</span>
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
              <div className="flex gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-5 flex-1 rounded bg-blue-500/30" />)}</div>
              <div className="grid grid-cols-2 gap-1">{[0, 1, 2, 3].map((i) => <div key={i} className="h-5 rounded bg-raised" />)}</div>
              {[0, 1, 2, 3].map((i) => <div key={i} className={`h-[60px] rounded-lg ${i === 0 ? 'bg-teal-500/20 ring-1 ring-teal-400/60' : 'bg-raised'}`} />)}
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
        <div className="pz-appear flex flex-col gap-4 rounded-3xl border border-teal-400/40 bg-teal-500/[0.06] p-7" style={later(100)}>
          <Kicker className="text-teal-300">Both high</Kicker>
          <Verdict pass level="high" title="Code review">Every criterion traced.</Verdict>
          <Verdict pass level="high" title="QA">Every criterion exercised, both viewports.</Verdict>
          <div className="mt-auto flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-full bg-teal-500/20 text-[30px]">⚡</span>
            <div><div className="font-display text-[28px] text-teal-200">Merge on sight</div><div className="text-[16px] text-muted">the agents could judge all of it, and found nothing</div></div>
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
    body: 'Code review and QA start when the pull request opens — in a fork, when you ask Claude; a fast run skips QA. Each is sized from the diff, and every blocker must name a real path to harm and survive a skeptic.',
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
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.6, s: 8 + ((i * 5) % 12), c: ['bg-blue-300', 'bg-cyan-300', 'bg-cyan-300', 'bg-teal-300'][i % 4] };
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
          className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-[20px] font-semibold text-white ${merged ? 'bg-blue-600' : 'bg-teal-600'}`}
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
          className={`relative mt-8 rounded-xl px-8 py-4 font-display text-[24px] text-white ${merged ? 'bg-blue-700/50' : 'bg-teal-600'}`}
          animate={merged ? { scale: [1, 0.92, 1.06, 1] } : {}}
          transition={{ duration: 0.5 }}
        >
          {merged ? '✓ Pull request merged' : 'Merge pull request'}
          {!merged && <span className="pz-ping absolute inset-0 rounded-xl border-2 border-teal-300" style={{ animationDelay: '700ms' }} aria-hidden="true" />}
        </motion.button>
        {merged && <motion.div className="pointer-events-none absolute inset-0 rounded-2xl" initial={{ boxShadow: '0 0 0 0 rgba(32,149,211,0.7)', backgroundColor: 'rgba(147,197,253,0.16)' }} animate={{ boxShadow: '0 0 0 90px rgba(32,149,211,0)', backgroundColor: 'rgba(147,197,253,0)' }} transition={{ duration: 1.1 }} />}
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

export const NEEDS_HUMAN = [
  { id: 'needs-human', name: 'When it gets stuck', accent: 'text-amber-300', tone: 'amber', beats: NEEDS_HUMAN_BEATS, Scene: NeedsHumanScene },
];

export const AFTER = [
  { id: 'review', name: 'Review and QA', accent: 'text-cyan-300', tone: 'cyan', beats: REVIEW_BEATS, Scene: ReviewScene },
  { id: 'merge', name: 'Merge', accent: 'text-blue-300', tone: 'violet', beats: MERGE_BEATS, Scene: MergeScene },
];
