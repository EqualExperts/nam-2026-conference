import { Fragment } from 'react';
import { later } from '../kit.jsx';

/**
 * Building blocks for /product-presentation, on top of the shared kit: the
 * three hosts in the meeting, the waveform, a by-hand / with-the-skill
 * comparison, a skill's big heading, and the three-step rail the talk returns to.
 */

export const box = 'rounded-2xl border border-edge bg-surface';

/* The hosts — attendees in the app too, so their portraits are its own. */
export const HOSTS = {
  abraham: { name: 'Abraham', avatar: '/avatars/speaker-002.jpg' },
  andy:    { name: 'Andy',    avatar: '/avatars/speaker-001.jpg' },
  jonas:   { name: 'Jonas',   avatar: '/avatars/attendee-001.jpg' },
};

export function Face({ who, size = 40, className = '' }) {
  const h = HOSTS[who];
  return <img src={h.avatar} alt={h.name} width={size} height={size} className={`shrink-0 rounded-full object-cover ring-2 ring-hairline ${className}`} style={{ width: size, height: size }} />;
}

/** Bars breathing at fixed, staggered rates — a waveform that never looks the same twice yet is deterministic. */
export function Wave({ n = 36, live = true, className = '' }) {
  return (
    <div className={`flex h-9 items-center gap-[3px] ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={`w-[4px] rounded-full bg-current ${live ? 'pz-wave' : 'opacity-30'}`}
          style={{ height: 8 + ((i * 7) % 5) * 6, animationDelay: `${(i * 53) % 800}ms`, animationDuration: `${650 + ((i * 37) % 450)}ms` }}
        />
      ))}
    </div>
  );
}

/** The same job by hand and with a skill, row by row — what the skill does that a person forgets. */
export function Versus({ rows, foot, delay = 0, className = '' }) {
  const EVERY = 350;
  return (
    <div className={`flex h-full flex-col gap-3 ${className}`}>
      <div className="grid grid-cols-2 gap-5 px-1">
        <div className="font-display text-[22px] text-rose-200">By hand</div>
        <div className="font-display text-[22px] text-teal-200">With the skill</div>
      </div>
      {rows.map(([hand, skill], i) => (
        <div key={hand} className="pz-appear grid grid-cols-2 gap-5" style={later(delay + i * EVERY)}>
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/5 px-4 py-3 text-[17px] leading-snug text-muted">{hand}</div>
          <div className="rounded-xl border border-teal-400/40 bg-teal-500/10 px-4 py-3 text-[17px] leading-snug text-ink">{skill}</div>
        </div>
      ))}
      {foot && <div className="pz-appear mt-auto text-[17px] text-muted" style={later(delay + rows.length * EVERY + 300)}>{foot}</div>}
    </div>
  );
}

/** A skill's name, large, at the top of its first slide — so it is plain what the slide is about. */
export function SkillHead({ icon, cmd, line, className = '' }) {
  return (
    <div className={`flex items-center gap-6 ${className}`}>
      <span className="text-[68px] leading-none">{icon}</span>
      <div>
        <div className="font-mono text-[60px] leading-none text-blue-200">{cmd}</div>
        <div className="mt-2 text-[24px] text-muted">{line}</div>
      </div>
    </div>
  );
}

/** How long a speaker's wave runs before the words start typing. */
export const TYPING_MS = 700;

/* ------------------------------------------------------------------ *
 * The three steps, as a rail across the top of the stage.
 * ------------------------------------------------------------------ */

/* Remember and Raise are peers — winnow hands to both, in any order. The talk
 * ends on the ticket, so Raise comes last here. */
export const STEPS = [
  { id: 'distil',   icon: '🌾', label: 'Distil',   cmd: '/winnow' },
  { id: 'remember', icon: '🧠', label: 'Remember', cmd: 'update-context' },
  { id: 'raise',    icon: '🎫', label: 'Raise',    cmd: 'create-tasks' },
];
const PEERS_FROM = 1;

export const STEP_W = 360;
export const STEP_X = (i) => 80 + i * 540;

export function StepRail({ y = 80, active = -1, delay = 0 }) {
  return (
    <>
      {STEPS.map((s, i) => {
        const on = i === active;
        return (
          <div
            key={s.id}
            className={`pz-appear absolute flex flex-col items-center justify-center rounded-xl border text-center transition-all duration-500 ${on ? 'pz-glow border-blue-400/70 bg-raised' : 'border-edge bg-surface'}`}
            style={{ left: STEP_X(i), top: y, width: STEP_W, height: 96, ...later(delay + i * 140) }}
          >
            <span className="text-[26px] leading-none">{s.icon}</span>
            <span className={`mt-1 text-[18px] font-semibold ${on ? 'text-ink' : 'text-muted'}`}>{s.label}</span>
            <span className="font-mono text-[13px] text-faint">{s.cmd}</span>
          </div>
        );
      })}
      {STEPS.slice(1).map((s, i) => (
        <span
          key={s.id}
          className={`pz-appear absolute w-[180px] text-center ${i === PEERS_FROM ? 'font-mono text-[12px] uppercase leading-tight tracking-wider text-blue-300' : 'text-[28px] text-blue-300'}`}
          style={{ left: STEP_X(i) + STEP_W, top: y + (i === PEERS_FROM ? 30 : 28), ...later(delay + 500 + i * 140) }}
        >
          {i === PEERS_FROM ? <>·<br />peers</> : '→'}
        </span>
      ))}
    </>
  );
}

/**
 * The rail across the top of the product talk: Information → Distil → Remember · Raise,
 * drawn by Deck over the scenes (so the fly-through leaves it in place) with the
 * chapter's nodes lit and the others ghosted. `commands` puts each skill's
 * command under its name. With nothing lit it is hidden, `data-lit` empty.
 */
const RAIL_NODES = [
  { id: 'information', icon: '💬', label: 'Information' },
  ...['distil', 'remember', 'raise'].map((id) => ({ ...STEPS.find((s) => s.id === id) })),
];

export function WorkflowRail({ lit, commands }) {
  return (
    <div
      data-testid="presentation-rail"
      data-lit={lit.join(' ')}
      role="group"
      aria-label="Workflow"
      className={`pointer-events-none absolute flex items-center justify-center gap-3 transition-opacity duration-500 ${lit.length ? 'visible opacity-100' : 'invisible opacity-0'}`}
      style={{ left: 0, top: 60, right: 0, height: 64 }}
    >
      {RAIL_NODES.map((n, i) => {
        const on = lit.includes(n.id);
        return (
          <Fragment key={n.id}>
            {i > 0 && <span className="text-[26px] text-blue-300" aria-hidden="true">{i === 3 ? '·' : '→'}</span>}
            <div className={`flex h-full w-[250px] flex-col items-center justify-center rounded-xl border text-center transition-all duration-500 ${on ? 'pz-glow border-blue-400/70 bg-raised' : 'border-hairline bg-surface opacity-70'}`}>
              <span className={`text-[20px] font-semibold ${on ? 'text-ink' : 'text-muted'}`}><span aria-hidden="true">{n.icon}</span> {n.label}</span>
              {commands && n.cmd && <span className="font-mono text-[13px] text-faint">{n.cmd}</span>}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
