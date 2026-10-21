import { Typed, later } from '../kit.jsx';

/**
 * Building blocks for /product-presentation, on top of the shared kit: the
 * three hosts in the meeting, a transcript line as the listener sees it, the
 * waveform, chunk files, a flag, and the five-step rail the talk keeps returning to.
 */

export const box = 'rounded-2xl border border-hairline bg-surface';

/* The hosts — attendees in the app too, so their portraits are its own. Abraham's
 * machine listens: his mic is the Me channel, the call's audio is Others. */
export const HOSTS = {
  abraham: { name: 'Abraham', avatar: '/avatars/speaker-002.jpg', lane: 'me' },
  andy:    { name: 'Andy',    avatar: '/avatars/speaker-001.jpg', lane: 'others' },
  jonas:   { name: 'Jonas',   avatar: '/avatars/attendee-001.jpg', lane: 'others' },
};

export function Face({ who, size = 40, className = '' }) {
  const h = HOSTS[who];
  return <img src={h.avatar} alt={h.name} width={size} height={size} className={`shrink-0 rounded-full object-cover ring-2 ring-hairline ${className}`} style={{ width: size, height: size }} />;
}

export function LaneTag({ lane, className = '' }) {
  const me = lane === 'me';
  return (
    <span className={`rounded-full border px-2 font-mono text-[15px] ${me ? 'border-emerald-400/50 text-emerald-300' : 'border-sky-400/50 text-sky-300'} ${className}`}>
      {me ? 'Me' : 'Others'}
    </span>
  );
}

const TYPE_MS = 10;

/** How long a Line takes to finish typing, so the next can start after it. */
export const typedFor = (t) => (Array.isArray(t) ? t : [t]).reduce((ms, l) => ms + l.length * TYPE_MS + 120, 200);

/** One utterance. The face and the muted name are what the room sees; the
 * lane is all the listener knows. Each string is one short line (no wrapping —
 * `Typed` counts in ch) typed after the one before. */
export function Line({ who, time, t, delay = 0 }) {
  const h = HOSTS[who];
  const lines = Array.isArray(t) ? t : [t];
  let start = delay + 200;
  return (
    <div className="pz-appear flex items-start gap-3" style={later(delay)}>
      <Face who={who} size={36} className="opacity-70" />
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-mono text-[15px] text-faint">
          <span>{time}</span>
          <LaneTag lane={h.lane} />
          <span className="text-[13px] text-faint/60">(room: {h.name})</span>
        </div>
        <div className="mt-0.5 font-mono text-[16px] leading-snug text-ink">
          {lines.map((l) => {
            const at = start;
            start += l.length * TYPE_MS + 120;
            return <div key={l}><Typed text={l} delay={at} speed={TYPE_MS} /></div>;
          })}
        </div>
      </div>
    </div>
  );
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

/** chunks/chunk-NNNN.txt — the newest ones drop in; past `max` the oldest fold into one chip. */
export function Chunks({ count, fresh = 0, cols = 8, max = 16 }) {
  const folded = count > max ? count - (max - 1) : 0;
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {folded > 0 && <span className="rounded-md border border-dashed border-hairline px-1.5 text-center font-mono text-[15px] leading-6 text-faint">+{folded}</span>}
      {Array.from({ length: count - folded }, (_, i) => {
        const n = folded + i + 1;
        const isFresh = n > count - fresh;
        return (
          <span
            key={n}
            className={`rounded-md border px-1.5 text-center font-mono text-[15px] leading-6 ${isFresh ? 'pz-drop border-emerald-400/50 bg-emerald-500/15 text-emerald-200' : 'border-hairline bg-raised text-muted'}`}
            style={isFresh ? later((n - (count - fresh) - 1) * 220) : undefined}
          >
            {String(n).padStart(4, '0')}
          </span>
        );
      })}
    </div>
  );
}

/** ⚑ or ❓ — the only two things the listener ever says unprompted. */
export function Flag({ kind, time, lines, check, delay = 0, className = '' }) {
  const conflict = kind === 'conflict';
  return (
    <div
      className={`pz-raise rounded-xl border-l-4 px-5 py-3.5 ${conflict ? 'border-amber-400 bg-amber-500/10' : 'border-cyan-400 bg-cyan-500/10'} ${className}`}
      style={later(delay)}
    >
      <div className={`font-display text-[21px] ${conflict ? 'text-amber-200' : 'text-cyan-200'}`}>
        {conflict ? '⚑ Possible conflict' : '❓ Possible gap'} <span className="font-mono text-[14px] font-normal text-faint">({time})</span>
      </div>
      <div className="mt-2 space-y-1 font-mono text-[15px] leading-snug text-ink/85">
        {lines.map((l) => <div key={l}>{l}</div>)}
      </div>
      <div className="mt-2 text-[15px] text-muted">Suggested check for the room: <span className="text-ink">“{check}”</span></div>
    </div>
  );
}

/** Three dots while someone types, for `TYPING_MS`; then the message. */
export const TYPING_MS = 700;
export function Dots({ delay = 0, className = '' }) {
  return (
    <span className={`pz-dots pointer-events-none inline-flex gap-1 ${className}`} style={later(delay)} aria-hidden="true">
      {[0, 1, 2].map((i) => <span key={i} className="size-1.5 rounded-full bg-current animate-pulse-dot" style={{ animationDelay: `${i * 180}ms` }} />)}
    </span>
  );
}

/** A chat turn: the agent, or you — typed for a moment, then said. */
export function Turn({ who = 'agent', delay = 0, className = '', children }) {
  const me = who === 'you';
  return (
    <div className={`pz-appear relative rounded-xl border px-5 py-3.5 ${me ? 'border-sky-400/40 bg-sky-500/10' : 'border-hairline bg-raised'} ${className}`} style={later(delay)}>
      <div className="flex items-center gap-2 text-[14px] text-faint">
        <span className={`grid size-6 place-items-center rounded-full text-[12px] ${me ? 'bg-sky-500/30' : 'bg-violet-500/30'}`}>{me ? '🙋' : '🤖'}</span>
        {me ? 'you' : 'winnow'}
        <Dots delay={delay} className="ml-2 text-muted" />
      </div>
      <div className="pz-appear mt-1.5 text-[17px] leading-snug text-ink" style={later(delay + TYPING_MS)}>{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The five steps, as a rail across the top of the stage. Exported so the
 * doors chapter can draw its paths onto the exact stations.
 * ------------------------------------------------------------------ */

/* Remember and Raise are peers — winnow hands to both, in any order. The talk
 * ends on the ticket, so Raise comes last here. */
export const STEPS = [
  { id: 'listen',     icon: '🎙️', label: 'Listen',     cmd: '/listen-to-meeting' },
  { id: 'transcribe', icon: '📝', label: 'Transcribe', cmd: 'transcribe-audio' },
  { id: 'distil',     icon: '🌾', label: 'Distil',     cmd: '/winnow' },
  { id: 'remember',   icon: '🧠', label: 'Remember',   cmd: 'update-context' },
  { id: 'raise',      icon: '🎫', label: 'Raise',      cmd: 'create-tasks' },
];
const PEERS_FROM = 3;

export const STEP_W = 250;
export const STEP_X = (i) => 80 + i * 297;
export const STEP_CX = (i) => STEP_X(i) + STEP_W / 2;

export function StepRail({ y = 80, active = -1, delay = 0 }) {
  return (
    <>
      {STEPS.map((s, i) => {
        const on = i === active;
        return (
          <div
            key={s.id}
            className={`pz-appear absolute flex flex-col items-center justify-center rounded-xl border text-center transition-all duration-500 ${on ? 'pz-glow border-violet-400/70 bg-raised' : 'border-hairline bg-surface'}`}
            style={{ left: STEP_X(i), top: y, width: STEP_W, height: 96, ...later(delay + i * 140) }}
          >
            <span className="text-[26px] leading-none">{s.icon}</span>
            <span className={`mt-1 text-[18px] font-semibold ${on ? 'text-ink' : 'text-muted'}`}>{s.label}</span>
            <span className="font-mono text-[13px] text-faint">{s.cmd}</span>
          </div>
        );
      })}
      {STEPS.slice(1).map((s, i) => (
        i === PEERS_FROM
          ? <span key={s.id} className="pz-appear absolute w-[47px] text-center font-mono text-[11px] uppercase leading-tight tracking-wider text-violet-300" style={{ left: STEP_X(i) + STEP_W, top: y + 32, ...later(delay + 500 + i * 140) }}>·<br />peers</span>
          : <span key={s.id} className="pz-appear absolute text-[24px] text-violet-300" style={{ left: STEP_X(i) + STEP_W + 12, top: y + 30, ...later(delay + 500 + i * 140) }}>→</span>
      ))}
    </>
  );
}
