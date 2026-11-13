import { at, Show, Code, Kicker, Tick, later } from '../kit.jsx';
import { box } from './kit.jsx';

/* ------------------------------------------------------------------ *
 * The workflow, before any skill: a project context made of indexed
 * files, two moves that keep it useful, and why the task tracker is a
 * different thing. The skills come after, as one way to do it.
 * ------------------------------------------------------------------ */

/* ---- The project context: indexed files, read by the piece ---- */

const DOCS = [
  { f: 'CLAUDE.md', what: 'what was decided, and why' },
  { f: 'context/index', what: 'one line per doc: when to read it', key: true },
  { f: 'context/engineering-context/seats.md', what: 'the reservation rules' },
  { f: 'context/engineering-context/schedule.md', what: 'where the schedule lives' },
  { f: 'context/engineering-context/testing.md', what: 'how a change is proved', pick: true },
  { f: 'context/engineering-context/ui.md', what: 'UI conventions' },
  { f: '…', what: 'one doc per area' },
];

const CHIPS = ['CLAUDE.md', 'context/index', 'context/engineering-context/testing.md', 'context/engineering-context/ui.md'];

function ContextScene({ step }) {
  const asking = step === 2;
  return (
    <>
      {/* the title slide: its heading is the caption, set large; this is the picture beside it */}
      <Show on={step === 0} from="right" delay={200} style={at(1120, 150, 400, 420)} className="flex flex-col items-center justify-center gap-5">
        <div className="pz-glow grid size-[220px] place-items-center rounded-full border border-blue-400/60 bg-surface text-[120px]">📚</div>
        {CHIPS.map((c, i) => (
          <span key={c} className="pz-appear rounded-lg border border-hairline bg-raised px-4 py-1.5 font-mono text-[15px] text-muted" style={later(700 + i * 150)}>{c}</span>
        ))}
      </Show>

      <Show on={step >= 1} from="left" style={at(80, 70, 700, 540)} className={`${box} flex flex-col p-6`}>
        <Kicker>The project’s AI context</Kicker>
        <div className="mt-4 space-y-2">
          {DOCS.map((d, i) => {
            const on = !asking || d.key || d.pick;
            const tone = asking && d.pick ? 'pz-glow border-teal-400/60 bg-raised' : asking && d.key ? 'border-blue-400/60 bg-raised' : 'border-hairline';
            return (
              <div key={d.f} className={`pz-appear rounded-xl border px-4 py-2 transition-all duration-500 ${tone} ${on ? '' : 'opacity-35'}`} style={later(200 + i * 120)}>
                <div className="font-mono text-[15px] text-ink">{d.f}</div>
                <div className="text-[14px] text-faint">{d.what}</div>
              </div>
            );
          })}
        </div>
      </Show>

      <Show on={step === 1} from="right" delay={300} style={at(820, 70, 700, 540)} className={`${box} flex flex-col gap-4 p-7`}>
        <Kicker>The advanced README</Kicker>
        <div className="font-display text-[32px] leading-tight text-ink">Everything a newcomer — person or AI — needs to work here correctly.</div>
        <div className="mt-2 space-y-3 text-[19px] text-muted">
          {[
            'what was decided, and why the other option lost',
            'where things live and how they work',
            'the conventions you would otherwise learn the hard way',
          ].map((t, i) => (
            <div key={t} className="pz-appear flex items-start gap-3" style={later(900 + i * 300)}><Tick className="mt-0.5 size-6 text-[12px]" /> {t}</div>
          ))}
        </div>
        <div className="pz-appear mt-auto text-[17px] text-faint" style={later(2100)}>Plain files in the repository — versioned, reviewed and diffed like code.</div>
      </Show>

      <Show on={step === 2} from="right" delay={300} style={at(820, 70, 700, 540)} className="flex flex-col gap-4">
        <div className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-5 py-3.5 text-[18px] text-ink">
          <div className="text-[14px] text-faint">you</div>
          How are the mobile specs run?
        </div>
        <div className="pz-appear rounded-xl border border-hairline bg-raised px-5 py-3.5" style={later(1000)}>
          <div className="font-mono text-[15px] text-blue-200">read context/index → context/engineering-context/testing.md</div>
          <div className="mt-1 text-[17px] text-ink">Playwright runs a desktop project and a mobile one — testing.md has the viewports.</div>
        </div>
        <div className={`${box} pz-appear mt-auto p-6`} style={later(1900)}>
          <Kicker>Why an index</Kicker>
          <div className="mt-2 text-[19px] leading-snug text-muted">An agent that reads everything re-reads everything, on every turn. With an index it reads <b className="text-ink">the one line that says which doc to open</b> — and only that doc.</div>
        </div>
      </Show>
    </>
  );
}

/* ---- Two moves: frame decisions on it, keep it current; then the one-way flow ---- */

/* Each move has its own colour, so the two beats differ at a glance, not just in their words. */
const MOVE = [
  { ring: 'border-sky-400 bg-sky-500/10 shadow-[0_0_44px_rgba(56,189,248,0.4)]', arrow: 'text-sky-300', band: 'border-sky-400/60 bg-sky-500/10' },
  { ring: 'border-teal-400 bg-teal-500/10 shadow-[0_0_44px_rgba(93,176,176,0.4)]', arrow: 'text-teal-300', band: 'border-teal-400/60 bg-teal-500/10' },
];

/** A thick arrow: big and bright when it is the one in play, a faint stub when it is not. */
function BigArrow({ on, label, tone, className = '', style, flip }) {
  return (
    <div className={`absolute flex flex-col items-center transition-all duration-500 ${on ? tone : 'text-faint opacity-20'} ${className}`} style={style}>
      <svg viewBox="0 0 150 90" className={`transition-all duration-500 ${on ? 'w-[140px]' : 'w-[80px]'}`} style={{ transform: flip ? 'scaleX(-1)' : undefined, filter: on ? 'drop-shadow(0 0 14px currentColor)' : undefined }} aria-hidden="true">
        <path d="M70 4 L6 45 L70 86 L70 62 H146 V28 H70 Z" fill="currentColor" />
      </svg>
      <div className={`mt-2 font-mono transition-all duration-500 ${on ? 'text-[22px] font-bold text-ink' : 'text-[14px] text-muted'}`}>{label}</div>
    </div>
  );
}

function LoopScene({ step }) {
  const move = MOVE[Math.min(step, 1)];
  return (
    <>
      <Show from="left" style={at(80, 190, 380, 230)} className={`rounded-2xl border p-6 transition-all duration-500 ${step === 0 ? move.ring : 'border-edge bg-surface opacity-30'}`}>
        <Kicker>Decide and act</Kicker>
        <div className="mt-3 space-y-1.5 text-[18px] text-muted">
          <div>build a feature</div><div>review a change</div><div>pick the next task</div>
        </div>
      </Show>
      <Show from="up" delay={150} style={at(610, 170, 380, 270)} className={`${box} flex flex-col items-center justify-center border-blue-400/60 p-6 text-center`}>
        <div className="text-[44px]">📚</div>
        <div className="font-display text-[30px] text-ink">Project context</div>
        <div className="mt-1 text-[16px] text-muted">indexed files — the project as it is today</div>
      </Show>
      <Show from="right" delay={300} style={at(1140, 190, 380, 230)} className={`rounded-2xl border p-6 transition-all duration-500 ${step === 1 ? move.ring : 'border-edge bg-surface opacity-30'}`}>
        <Kicker>New information</Kicker>
        <div className="mt-3 space-y-1.5 text-[18px] text-muted">
          <div>a meeting</div><div>a decision</div><div>something you learned</div>
        </div>
      </Show>

      <BigArrow on={step === 0} tone={MOVE[0].arrow} label="read first" style={at(465, 240, 140, 140)} />
      <BigArrow on={step === 1} tone={MOVE[1].arrow} label="written in" style={at(995, 240, 140, 140)} />

      <Show on={step === 0} from="up" style={at(80, 480, 1440, 130)} className={`flex items-center gap-6 rounded-2xl border px-8 ${MOVE[0].band}`}>
        <span className="text-[40px]">①</span>
        <div>
          <div className="font-display text-[28px] text-ink">Frame every decision on the context</div>
          <div className="mt-1 text-[18px] text-muted">Before an agent — or a person — builds, reviews or plans, it reads what the project already knows. Decisions land on the project’s real names and rules, not on guesses.</div>
        </div>
      </Show>
      <Show on={step === 1} from="up" style={at(80, 480, 1440, 130)} className={`flex items-center gap-6 rounded-2xl border px-8 ${MOVE[1].band}`}>
        <span className="text-[40px]">②</span>
        <div>
          <div className="font-display text-[28px] text-ink">Keep it up to date as information comes in</div>
          <div className="mt-1 text-[18px] text-muted">A context nobody updates quietly turns into fiction. Each time something durable is learned, it is folded into the doc that owns it — so the next decision starts from the truth.</div>
        </div>
      </Show>
    </>
  );
}

/* ---- The bare diagram: information goes one way ---- */

function DiagramScene() {
  return (
    <>
      <Show from="left" style={at(80, 190, 330, 230)} className={`${box} flex flex-col justify-center p-6`}>
        <div className="text-[44px]">💬</div>
        <div className="font-display text-[30px] text-ink">New information</div>
        <div className="mt-1 text-[16px] text-muted">a meeting, notes, a voice note</div>
      </Show>
      <Show from="left" delay={300} style={at(500, 190, 330, 230)} className={`${box} pz-glow flex flex-col justify-center border-cyan-400/60 p-6`}>
        <div className="text-[44px]">🌾</div>
        <div className="font-display text-[30px] text-ink">Distil</div>
        <div className="mt-1 text-[16px] text-muted">noise out; knowledge and work sorted</div>
      </Show>
      <Show from="none" delay={150} style={at(410, 260, 90, 90)} className="grid place-items-center text-[64px] leading-none text-blue-300">→</Show>
      <Show from="none" delay={450} style={at(830, 150, 90, 90)} className="grid place-items-center text-[64px] leading-none text-blue-300">↗</Show>
      <Show from="none" delay={450} style={at(830, 370, 90, 90)} className="grid place-items-center text-[64px] leading-none text-blue-300">↘</Show>
      <Show from="right" delay={700} style={at(930, 90, 590, 190)} className="flex flex-col justify-center rounded-2xl border border-teal-400/50 bg-teal-500/10 p-6">
        <div className="font-display text-[32px] text-ink">🧠 Remember</div>
        <div className="mt-2 text-[20px] text-muted">knowledge goes into the project context</div>
      </Show>
      <Show from="right" delay={950} style={at(930, 330, 590, 190)} className="flex flex-col justify-center rounded-2xl border border-blue-400/50 bg-blue-500/10 p-6">
        <div className="font-display text-[32px] text-ink">🎫 Raise</div>
        <div className="mt-2 text-[20px] text-muted">work goes into the task tracker</div>
      </Show>
    </>
  );
}

/* ---- Context and tracker: two things, not one ---- */

function TrackingScene({ step }) {
  return (
    <>
      <Show from="left" style={at(80, 70, 620, 370)} className={`${box} flex flex-col p-7`}>
        <div className="flex items-center gap-3"><span className="text-[32px]">📚</span><span className="font-display text-[30px] text-ink">Project context</span></div>
        <div className="mt-1 text-[17px] text-faint">the project as it is today</div>
        <div className="mt-5 space-y-2.5 text-[18px] text-muted">
          <div className="flex gap-3"><Tick className="size-6 text-[12px]" /> how it works, where it lives, what was decided</div>
          <div className="flex gap-3"><Tick className="size-6 text-[12px]" /> present state only — not how it got here</div>
        </div>
        <div className="mt-auto rounded-lg border border-teal-400/40 bg-teal-500/10 px-4 py-2.5 text-[17px] text-teal-100">Goal: the right knowledge to decide and act</div>
      </Show>
      <Show from="right" style={at(900, 70, 620, 370)} className={`${box} flex flex-col p-7`}>
        <div className="flex items-center gap-3"><span className="text-[32px]">🎫</span><span className="font-display text-[30px] text-ink">Task tracker</span></div>
        <div className="mt-1 text-[17px] text-faint">the past, and the future</div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-[16px]">
          <div className="rounded-lg border border-hairline bg-raised px-4 py-2.5"><b className="text-ink">Done</b><div className="text-[14px] text-faint">the record of the past</div></div>
          <div className="rounded-lg border border-hairline bg-raised px-4 py-2.5"><b className="text-ink">Roadmap</b><div className="text-[14px] text-faint">the future, in order</div></div>
        </div>
        <div className="mt-auto rounded-lg border border-blue-400/40 bg-blue-500/10 px-4 py-2.5 text-[17px] text-blue-100">Goal: planning</div>
      </Show>

      <Show on={step === 1} from="none" style={at(700, 130, 200, 260)} className="flex flex-col justify-center gap-10 text-center">
        <div>
          <div className="text-[34px] text-blue-300">→</div>
          <div className="text-[14px] leading-snug text-muted">pick the next task from where the project is today</div>
        </div>
        <div>
          <div className="text-[34px] text-blue-300">←</div>
          <div className="text-[14px] leading-snug text-muted">finishing a task changes where it is</div>
        </div>
      </Show>

      <Show on={step === 0} from="up" delay={400} style={at(80, 480, 1440, 130)} className={`${box} flex items-center gap-6 px-8`}>
        <div className="text-[19px] leading-snug text-muted">
          Tasks <b className="text-ink">can</b> live in the context too. Keeping them outside is usually cheaper: the context stays a picture of <b className="text-ink">today</b>, while the tracker also carries what is done and what is coming.
        </div>
      </Show>
      <Show on={step === 1} from="up" style={at(80, 480, 1440, 130)} className={`${box} flex items-center gap-6 px-8`}>
        <div className="text-[19px] leading-snug text-muted">
          Each shapes the other — but they are <b className="text-ink">not the same thing</b>, and a harness needs both: one to know, one to plan.
        </div>
      </Show>
    </>
  );
}

/* ---- The skills: one way to do it ---- */

const MAP = [
  ['Keep the context up to date', 'update-context'],
  ['Raise the work', 'create-tasks'],
  ['Distil a meeting or notes into both', 'winnow'],
];

const FREEDOM = [
  ['🧰', 'Use them', 'Take them as they are — open source, at github.com/quiram/winnow.'],
  ['🔧', 'Adapt them', 'Change the ticket shape, the doc map or the checkpoints to fit your project and your tracker.'],
  ['🏗️', 'Build your own', 'The workflow is the point. Any skills, any agent — as long as decisions are framed on the context and the context stays current.'],
];

function SkillsScene({ step }) {
  return (
    <>
      <Show on={step === 0} from="up" style={at(80, 70, 1440, 50)}>
        <Kicker>The workflow, as skills</Kicker>
      </Show>
      {MAP.map(([what, skill], i) => (
        <Show key={skill} on={step === 0} from="left" delay={200 + i * 200} style={at(80, 150 + i * 110, 1440, 90)} className={`${box} flex items-center gap-6 px-7`}>
          <span className="w-[640px] text-[22px] text-muted">{what}</span>
          <span className="text-[26px] text-blue-300">→</span>
          <Code className="text-[22px]">{skill}</Code>
        </Show>
      ))}
      <Show on={step === 0} from="up" delay={1300} style={at(80, 530, 1440, 60)} className="flex items-center justify-center">
        <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-6 py-2 text-[20px] text-amber-200">One possibility — not the only way to implement the workflow</span>
      </Show>

      {FREEDOM.map(([icon, h, s], i) => (
        <Show key={h} on={step === 1} from="up" delay={i * 200} style={at(80 + i * 497, 110, 446, 330)} className={`${box} flex flex-col p-7`}>
          <span className="text-[44px]">{icon}</span>
          <div className="mt-3 font-display text-[30px] text-ink">{h}</div>
          <div className="mt-3 text-[18px] leading-snug text-muted">{s}</div>
        </Show>
      ))}
      <Show on={step === 1} from="up" delay={900} style={at(80, 490, 1440, 110)} className={`${box} flex items-center px-8`}>
        <div className="text-[21px] leading-snug text-muted">Pick them up, bend them to your project, or ignore them and write your own. Whatever you choose, <b className="text-ink">the loop is the same</b>.</div>
      </Show>
    </>
  );
}

/* ---- A chapter slide: from the workflow to one way of running it ---- */

function ImplementationScene() {
  return (
    <>
      <Show from="right" delay={200} style={at(1120, 190, 400, 150)} className={`${box} flex items-center gap-4 px-6 opacity-60`}>
        <Tick className="size-8 shrink-0 text-[14px]" />
        <div><div className="text-[14px] text-faint">so far</div><div className="font-display text-[26px] leading-tight text-ink">The workflow</div></div>
      </Show>
      <Show from="none" delay={500} style={at(1120, 345, 400, 60)} className="text-center text-[44px] leading-none text-blue-300">↓</Show>
      <Show from="right" delay={700} style={at(1120, 410, 400, 170)} className={`${box} pz-glow flex items-center gap-4 border-teal-400/60 px-6`}>
        <span className="text-[44px]">🧰</span>
        <div><div className="text-[14px] text-teal-300">next</div><div className="font-display text-[28px] leading-tight text-ink">A sample implementation</div></div>
      </Show>
    </>
  );
}

const WORKFLOW_ALL = ['distil', 'remember', 'raise'];

/* In order: the bare diagram, the two-fold trick, context versus tasks — the general flow — then the sample implementation: its chapter slide, the project context, the skills. */
export const WORKFLOW = [
  {
    id: 'diagram', name: 'One way in', accent: 'text-cyan-300', tone: 'cyan',
    beats: [
      {
        kicker: 'One way in',
        title: 'New information → Distil → Remember or Raise',
        body: 'Information only flows one way: what was said is distilled, the noise is dropped, durable knowledge is folded into the context and work is raised as tasks. Everything after this is one way to run it.',
      },
    ],
    Scene: DiagramScene,
  },
  {
    id: 'loop', name: 'The two-fold trick', accent: 'text-cyan-300', tone: 'cyan', rail: { lit: ['remember'] },
    beats: [
      {
        kicker: 'Frame decisions on it',
        title: 'Every decision starts from the context',
        body: 'Building, reviewing, planning: before any of it, read what the project already knows. That is what turns an agent’s output from plausible into right for this project.',
      },
      {
        kicker: 'Keep it current',
        title: 'When new information comes in, the context changes',
        body: 'The other half. A context that is only read goes stale; one that is updated whenever something durable is learned stays worth reading.',
      },
    ],
    Scene: LoopScene,
  },
  {
    id: 'tracking', name: 'Context and tasks', accent: 'text-amber-300', tone: 'amber', rail: { lit: (step) => (step === 0 ? ['raise'] : ['remember', 'raise']) },
    beats: [
      {
        kicker: 'Two different goals',
        title: 'The context is today; the tracker is past and future',
        body: 'Tasks can be kept inside the context, but it is usually more efficient to keep them outside. The context should show the project as it is now; the tracker also keeps what is done and what is planned.',
      },
      {
        kicker: 'They shape each other',
        title: 'Pick tasks from the state; the state moves with the tasks',
        body: 'What the project is today decides which task to pick next, and finishing a task changes what the project is. Complementary, influencing each other — and not the same thing.',
      },
    ],
    Scene: TrackingScene,
  },
  {
    id: 'implementation', name: 'A sample implementation', accent: 'text-teal-300', tone: 'emerald', rail: { lit: WORKFLOW_ALL, commands: true },
    beats: [
      {
        hero: true,
        kicker: 'From the workflow to a way of running it',
        title: 'A sample implementation',
        body: 'So far, the workflow: a context, kept current as information comes in. Next, one way to run it — three skills you can use today.',
      },
    ],
    Scene: ImplementationScene,
  },
  {
    id: 'context', name: 'The project context', accent: 'text-blue-300', tone: 'violet', rail: { lit: ['remember'], commands: true },
    beats: [
      {
        hero: true,
        kicker: 'Part of the workflow',
        title: 'The project context',
        body: 'The project’s memory, written for people and AI.',
      },
      {
        kicker: 'The project context',
        title: 'A context is the project’s memory, written for people and AI',
        body: 'What was decided and why, where things live, how they work — in plain files in the repository, so a newcomer, or an agent starting cold, can work here correctly after reading them.',
      },
      {
        kicker: 'Indexed files',
        title: 'Many small files, and an index that says which to read',
        body: 'A single giant file is re-read in full on every turn. An index of small docs lets an agent read one line, open the one doc that matters, and leave the rest alone.',
      },
    ],
    Scene: ContextScene,
  },
  {
    id: 'skills', name: 'One way to do it', accent: 'text-teal-300', tone: 'emerald', rail: { lit: WORKFLOW_ALL, commands: true },
    beats: [
      {
        kicker: 'The skills',
        title: 'Three skills that run that workflow',
        body: 'Abraham’s open-source winnow skills are one implementation of it: update the context, raise the work, or distil a whole meeting into both. They are one possibility, not the only one.',
      },
      {
        kicker: 'Yours to take',
        title: 'Use them, adapt them, or build your own',
        body: 'Nobody has to use these. Take them as they are, change them to fit your project, or start from scratch — the workflow is what matters, not the skills.',
      },
    ],
    Scene: SkillsScene,
  },
];
