import { useEffect, useState } from 'react';
import { animate, motion } from 'motion/react';
import { at, Show, Replay, Code, Label, Model, Kicker, Tick, Verdict, Meter, Terminal, IssueIcon, PrIcon, MergeIcon, later } from './kit.jsx';

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
        <div className="flex flex-col justify-center gap-4">
          {[1, 2, 3].map((round, i) => (
            <div key={round} className="pz-appear flex items-center gap-5 rounded-xl border border-amber-400/40 bg-amber-500/10 px-5 py-4" style={later(300 + i * 650)}>
              <span className="font-mono text-[15px] text-faint">Round {round}</span>
              <span className="text-[19px] text-ink">The grid still hides the first card on a 360 px phone</span>
              {i > 0 && <span className="ml-auto rounded-full bg-rose-500/20 px-3 py-0.5 font-mono text-[13px] text-rose-200">same finding</span>}
            </div>
          ))}
          <div className="pz-appear text-[19px] text-muted" style={later(2400)}>The fixer has tried twice. A fourth round would only spend money.</div>
        </div>
      </Show>

      {/* what it leaves behind */}
      <Show on={step >= 1} from="up" style={at(80, 70, 840, 540)} className={`${box} overflow-hidden`}>
        <div className="flex items-center gap-3 border-b border-hairline px-6 py-4">
          <IssueIcon className="size-6 text-emerald-400" />
          <span className="font-display text-[24px] text-ink">#140 Keep sessions in view on mobile</span>
        </div>
        <div className="flex items-center gap-2 px-6 pt-4">
          <span className="text-[15px] text-faint">labels</span>
          <span className={`transition-opacity duration-500 ${step >= 2 ? 'opacity-30 line-through' : ''}`}><Label name="needs-human" /></span>
          {step >= 2 && <span className="pz-pop" style={later(1500)}><Label name="ready-for-ai" /></span>}
        </div>
        <div className="m-6 rounded-xl border border-hairline bg-raised p-5">
          <div className="flex items-center gap-2 text-[15px] text-faint"><span className="grid size-7 place-items-center rounded-full bg-violet-500/30 text-[14px]">🤖</span> ship · stopped at Code audit</div>
          <div className="mt-3 text-[18px] text-ink">I could not get the first card into view on a 360 px phone without hiding the day tabs. <b>Still open:</b></div>
          <ul className="mt-2 space-y-1 text-[17px] text-muted">
            <li>• keep the day tabs visible, or collapse them behind Filters?</li>
            <li>• draft PR #142 has everything else, green</li>
          </ul>
        </div>
        <Show on={step >= 2} from="left" delay={300} className="mx-6 rounded-xl border border-sky-400/40 bg-sky-500/10 p-5">
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
        {step >= 2 ? (
          <div className="pz-appear rounded-2xl border border-violet-400/50 bg-raised p-6" style={later(1800)}>
            <div className="font-display text-[26px] text-ink">🔁 Back into ship</div>
            <div className="mt-2 text-[18px] text-muted">Relabel <Label name="ready-for-ai" className="mx-1 text-[12px]" /> and a fresh run picks up the answer, the branch and the spec.</div>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-6 text-[19px] text-amber-100">
            It never burns rounds on a problem it cannot solve. It writes down what it knows and asks.
          </div>
        )}
      </Show>
    </>
  );
}

const NEEDS_HUMAN_BEATS = [
  {
    kicker: '6 · When it will not converge',
    title: 'The same finding, surviving two fixes',
    body: 'Some tickets cannot be finished by an agent — the ticket contradicts itself, or the fix needs a decision only a person can make. Ship notices it is going round in circles and stops.',
  },
  {
    kicker: '6 · needs-human',
    title: 'It hands back everything it knows',
    body: 'A draft pull request with the work so far, a comment on the issue saying exactly what is still open, and the needs-human label so it shows up on the board.',
  },
  {
    kicker: '6 · You step in',
    title: 'Answer in a comment, relabel, and it carries on',
    body: 'You make the call it could not. Relabel ready-for-ai and a fresh run starts from the answer — or, on the pull request, @claude makes the change you asked for, runs the gate and replies.',
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

      {/* code review in detail */}
      <Replay on={step === 1} style={at(80, 80, 1440, 520)} className="grid grid-cols-[1fr_1fr] gap-8">
        <div className="flex flex-col gap-3">
          {[
            ['🎫', 'The ticket first', 'forms its own view of what should be true before it reads a line of the diff'],
            ['🔬', 'Then the diff', 'only what a reviewer should flag: defects with a real path to harm'],
            ['🧐', 'A skeptic per blocker', 'who reaches it, and what do they lose? Anything less becomes a follow-up issue'],
            ['🔁', 'Reviews converge', 'a re-review checks the old blockers and only what changed since'],
          ].map(([icon, t, d], i) => (
            <div key={t} className={`${box} pz-appear flex items-start gap-4 px-5 py-3.5`} style={later(i * 260)}>
              <span className="text-[26px]">{icon}</span>
              <div><div className="text-[19px] font-semibold text-ink">{t}</div><div className="text-[16px] text-muted">{d}</div></div>
            </div>
          ))}
        </div>
        <div className="flex flex-col justify-center gap-4">
          <Kicker>What lands on the pull request</Kicker>
          <div className="pz-appear" style={later(1300)}>
            <Verdict pass level="high" title="Code review">Every criterion traced to what satisfies it. 40 lines, one file.</Verdict>
          </div>
          <div className="pz-appear text-[17px] text-muted" style={later(1800)}>
            Confidence is <b className="text-ink">how much of the change it could judge</b> — not how sure it feels. It never approves, never requests changes, never merges.
          </div>
        </div>
      </Replay>

      {/* QA in detail */}
      <Replay on={step === 2} style={at(80, 80, 1440, 520)} className="grid grid-cols-[1.25fr_1fr] gap-8">
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
      <Replay on={step === 3} style={at(80, 80, 1440, 520)} className="grid grid-cols-2 gap-8">
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

      {/* machines gate, agents advise */}
      <Replay on={step === 4} style={at(80, 80, 1440, 520)} className="grid grid-cols-3 gap-6">
        {[
          ['🚦', 'Machines gate', 'verify runs the whole suite on the pull request. A red gate is a fact, not an opinion.', 'border-emerald-400/40'],
          ['🧠', 'Agents advise', 'Review and QA post a verdict and a confidence. A FAIL turns the check red — and still stops nobody merging.', 'border-sky-400/40'],
          ['🙋', 'People decide', 'Nothing is a required check and nothing merges itself. @claude on the pull request asks for a change.', 'border-violet-400/40'],
        ].map(([icon, t, d, border], i) => (
          <div key={t} className={`pz-appear flex flex-col rounded-3xl border ${border} bg-surface p-8`} style={later(i * 300)}>
            <span className="text-[48px]">{icon}</span>
            <div className="mt-4 font-display text-[34px] text-ink">{t}</div>
            <div className="mt-3 text-[19px] text-muted">{d}</div>
          </div>
        ))}
        <div className="pz-appear col-span-3 flex items-center gap-4 rounded-xl border border-hairline bg-raised px-6 py-4 text-[18px] text-muted" style={later(1200)}>
          <Label name="harness-escape" />
          When review or QA catches a blocker ship’s own loop missed, an agent proposes the lesson for the docs. That count is how the harness gets tuned.
        </div>
      </Replay>
    </>
  );
}

const REVIEW_BEATS = [
  {
    kicker: '7 · After the pull request opens',
    title: 'Two more agents, on their own runners, in parallel',
    body: 'Code review and QA start when the pull request opens — not on every push, so a fourteen-commit branch does not pay fourteen times. They size themselves from facts about the diff, the same way ship did.',
  },
  {
    kicker: '7 · Code review',
    title: 'It reads the ticket before it reads the code',
    body: 'A reviewer that never saw how the change was written forms its own view first, then checks the diff against it. A blocker has to name a realistic path to harm and survive a skeptic.',
  },
  {
    kicker: '7 · QA',
    title: 'It tries to break the change in a real browser',
    body: 'Probes on desktop and mobile, one per gap the pull request’s own tests leave. If the tests already pin every Done when line, QA can skip itself — checked against the diff, never taken on trust.',
  },
  {
    kicker: '7 · Confidence means coverage',
    title: 'The confidence tells you how to review it',
    body: 'High on both means the agents could judge all of it and found nothing — merge it. A low confidence publishes as unproven, not green: that is the pull request a person should actually read.',
  },
  {
    kicker: '7 · Who decides',
    title: 'Machines gate, agents advise, people merge',
    body: 'The test suite is the only hard gate. Agents publish what they found and how much they could see. The decision stays with you.',
  },
];

/* ------------------------------------------------------------------ *
 * Merge, deploy, and what it cost.
 * ------------------------------------------------------------------ */

function MergeScene({ step }) {
  const [merged, setMerged] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMerged(true), 1300);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <Show on={step === 0} from="scale" style={at(330, 90, 940, 500)} className={`${box} flex flex-col items-center justify-center p-10 text-center`}>
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
          className={`mt-8 rounded-xl px-8 py-4 font-display text-[24px] text-white ${merged ? 'bg-violet-700/50' : 'bg-emerald-600'}`}
          animate={merged ? { scale: [1, 0.92, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          {merged ? '✓ Pull request merged' : 'Merge pull request'}
        </motion.button>
        {merged && <motion.div className="pointer-events-none absolute inset-0 rounded-2xl" initial={{ boxShadow: '0 0 0 0 rgba(139,92,246,0.7)' }} animate={{ boxShadow: '0 0 0 60px rgba(139,92,246,0)' }} transition={{ duration: 1 }} />}
      </Show>

      <Replay on={step === 1} style={at(80, 150, 1440, 400)} className="flex items-center justify-between">
        {[
          ['🟣', 'Merged', 'to main, by a person'],
          ['🚦', 'verify', 'the whole suite on main'],
          ['🚂', 'Deploy', 'only if verify is green'],
          ['💚', 'Healthy', '/api/health serves the new commit'],
        ].map(([icon, t, d], i) => (
          <div key={t} className="contents">
            {i > 0 && (
              <svg viewBox="0 0 120 20" className="w-[120px] shrink-0" aria-hidden="true">
                <path d="M0 10 H120" pathLength="1" className="pz-draw-in" stroke="#6d28d9" strokeWidth="3" fill="none" style={later(i * 500)} />
              </svg>
            )}
            <div className={`${box} pz-appear flex w-[250px] flex-col items-center p-7 text-center`} style={later(i * 500)}>
              <span className="text-[44px]">{icon}</span>
              <div className="mt-3 font-display text-[28px] text-ink">{t}</div>
              <div className="mt-1 text-[16px] text-muted">{d}</div>
            </div>
          </div>
        ))}
      </Replay>

      <Replay on={step === 2} style={at(80, 80, 1440, 520)} className="grid grid-cols-[1fr_1fr_1fr] gap-6">
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
    </>
  );
}

const MERGE_BEATS = [
  {
    kicker: '8 · A person merges',
    title: 'The last step is always yours',
    body: 'Two high-confidence passes and a green gate: you read the description, check the decisions it made for you, and press the button. Or comment @claude and ask for a change first.',
  },
  {
    kicker: '8 · Into production',
    title: 'Main is verified, then deployed',
    body: 'The suite runs again on main. Only a green run deploys, and the deploy only counts once the new commit answers its health check. A build that does not boot is a red run.',
  },
  {
    kicker: '8 · What it cost',
    title: 'Every ticket says what it cost',
    body: 'Each issue keeps one AI spend comment, split by run and by model. Two real tickets: under a dollar for a small fix, eight for a bigger one — label to merged, with nobody touching a terminal.',
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
      <Show on={step === 0} from="scale" style={at(230, 150, 1140, 360)}>
        <Terminal
          title="~/nam-2026-conference — claude"
          bodyClass="text-[26px] min-h-[260px] leading-loose"
          lines={[
            { t: 'One ticket at a time is the slow way.', tone: 'dim' },
            { t: '/ship 64 65 66 67 68 69 70 71 72 73', tone: 'cmd', delay: 300 },
            { t: 'ten tickets · ten worktrees · ten lanes', tone: 'ok', delay: 2200 },
          ]}
        />
      </Show>

      <Replay on={step === 1} style={at(80, 70, 1440, 540)} className={`${box} overflow-hidden`}>
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
      </Replay>

      <Replay on={step === 2} style={at(80, 70, 1440, 540)} className="grid grid-cols-[1fr_1fr] gap-8">
        <div className={`${box} p-7`}>
          <Kicker>Or on GitHub — label ten issues</Kicker>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {TICKETS.map((n, i) => (
              <div key={n} className="pz-appear flex items-center gap-2 rounded-xl border border-hairline bg-raised px-3 py-2.5" style={later(i * 80)}>
                <IssueIcon className="size-4 text-emerald-400" />
                <span className="font-mono text-[15px] text-ink">#{n}</span>
                <span className="pz-pop ml-auto" style={later(600 + i * 80)}><Label name="ready-for-ai" className="text-[11px]" /></span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className={`${box} p-7`}>
            <Kicker>Ten runners</Kicker>
            <div className="mt-4 grid grid-cols-5 gap-3">
              {TICKETS.map((n, i) => (
                <motion.div
                  key={n}
                  className="grid aspect-square place-items-center rounded-xl border border-violet-400/40 bg-violet-500/10"
                  initial={{ opacity: 0, rotate: -90, scale: 0.4 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  transition={{ delay: 1.2 + i * 0.08, type: 'spring', stiffness: 200, damping: 14 }}
                >
                  <span className="pz-spin-fast inline-block size-7 rounded-full border-[3px] border-violet-300/30 border-t-violet-300" />
                </motion.div>
              ))}
            </div>
          </div>
          <div className="pz-appear rounded-2xl border border-violet-400/40 bg-raised p-7" style={later(2200)}>
            <div className="font-display text-[30px] leading-tight text-ink">Your job is the ends of the pipe</div>
            <div className="mt-2 text-[19px] text-muted">Write tickets a test can check. Review what comes back. Everything in between runs without you.</div>
          </div>
        </div>
      </Replay>
    </>
  );
}

const SCALE_BEATS = [
  {
    kicker: '9 · Don’t babysit one ticket',
    title: 'Hand it ten',
    body: 'Nothing about ship needs you watching. So the way to work is not to sit with one ticket — it is to start the next nine.',
  },
  {
    kicker: '9 · In parallel',
    title: 'Ten worktrees, ten lanes, nobody in anybody’s way',
    body: 'Each ticket builds in its own copy of the repo, boots the app on its own ports and runs the whole suite. Most come back as pull requests; the one that cannot converge comes back as a question.',
  },
  {
    kicker: '9 · Or on GitHub',
    title: 'Label ten issues, get ten runners',
    body: 'The same on Actions: every ready-for-ai label starts its own machine. Each run posts its progress on its issue, so the board is the dashboard.',
  },
];

/* ------------------------------------------------------------------ *
 * Close.
 * ------------------------------------------------------------------ */

function CloseScene({ step }) {
  return (
    <>
      <Show on={step === 0} style={at(80, 90, 1440, 500)} className="grid grid-cols-4 gap-6">
        {[
          ['📄', 'Artifacts you can read', 'A plan before the code, a test that failed before the fix, every audit round, a confidence on every review.'],
          ['🚦', 'A gate it cannot argue with', 'Every test, desktop and mobile, plus proof the new tests fail without the change.'],
          ['👀', 'Independent eyes', 'Reviewers never see the reasoning behind the change. Every blocker survives a skeptic first.'],
          ['🙋', 'You stay in control', 'Nothing merges itself. A ticket that will not come together comes back as needs-human.'],
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

      <Show on={step === 1} from="scale" style={at(80, 70, 1440, 760)} className="flex flex-col items-center justify-center text-center">
        <div className="font-display text-[88px] leading-[0.98] text-ink">
          Write the ticket.<br />
          Review the pull request.<br />
          <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">The harness does the rest.</span>
        </div>
        <div className="mt-10 font-mono text-[20px] text-muted">github.com/EqualExperts/nam-2026-conference</div>
        <div className="mt-3 text-[17px] text-faint">The ship loop is Andy Vays’s design · built by Jonas Claesson and Abraham Marín Pérez at Equal Experts</div>
      </Show>
    </>
  );
}

const CLOSE_BEATS = [
  {
    kicker: '10 · Why you can trust what comes back',
    title: 'Trust comes from what you can check, not from the model',
    body: 'Every claim the harness makes leaves evidence a person can read in a minute. That is what lets you run ten tickets at once and still know what you are merging.',
  },
  null,
];

export const AFTER = [
  { id: 'needs-human', name: 'When it gets stuck', accent: 'text-amber-300', tone: 'amber', beats: NEEDS_HUMAN_BEATS, Scene: NeedsHumanScene },
  { id: 'review', name: 'Review and QA', accent: 'text-cyan-300', tone: 'cyan', beats: REVIEW_BEATS, Scene: ReviewScene },
  { id: 'merge', name: 'Merge', accent: 'text-violet-300', tone: 'violet', beats: MERGE_BEATS, Scene: MergeScene },
  { id: 'scale', name: 'Many at once', accent: 'text-sky-300', tone: 'sky', beats: SCALE_BEATS, Scene: ScaleScene },
  { id: 'close', name: 'Why trust it', accent: 'text-violet-300', tone: 'violet', beats: CLOSE_BEATS, Scene: CloseScene },
];
