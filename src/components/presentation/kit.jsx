import { useRef } from 'react';
import { motion } from 'motion/react';

/**
 * Building blocks for /presentation. Everything is placed on a fixed
 * 1600×900 stage in stage pixels, so a scene is laid out once and the page
 * scales the whole stage to the screen.
 */

export const at = (left, top, width, height) => ({ position: 'absolute', left, top, width, height });

const FROM = {
  up: { y: 28 },
  down: { y: -28 },
  left: { x: -48 },
  right: { x: 48 },
  scale: { scale: 0.86 },
  pop: { scale: 0.5 },
  none: {},
};

const SHOWN_RESET = { x: 0, y: 0, scale: 1 };
const SHOWN = { opacity: 1, ...SHOWN_RESET, filter: 'blur(0px)' };

/**
 * Shown or hidden by the beat, on a spring. Hidden pieces stay mounted so they
 * can leave; everything also springs in when its chapter is entered.
 */
export function Show({ on = true, from = 'up', delay = 0, className = '', style, as = 'div', children, ...rest }) {
  const M = motion[as] ?? motion.div;
  const hidden = { opacity: 0, filter: 'blur(8px)', ...SHOWN_RESET, ...FROM[from] };
  const wait = on ? delay / 1000 : 0;
  return (
    <M
      initial={hidden}
      animate={on ? SHOWN : hidden}
      transition={{ type: 'spring', stiffness: 160, damping: 20, mass: 0.9, delay: wait, opacity: { duration: 0.45, delay: wait }, filter: { duration: 0.45, delay: wait } }}
      aria-hidden={on ? undefined : true}
      className={className}
      style={{ pointerEvents: on ? undefined : 'none', ...style }}
      {...rest}
    >
      {children}
    </M>
  );
}

/**
 * Counts how many times `on` has turned true. Keying content on it replays
 * its entrance animations each time the beat is reached, but not on the way out.
 */
export function useEntries(on) {
  const count = useRef(0);
  const was = useRef(false);
  if (on && !was.current) count.current += 1;
  was.current = on;
  return count.current;
}

/** A Show whose children replay their keyframe animations on every entrance. */
export function Replay({ on, children, ...rest }) {
  const entries = useEntries(on);
  return (
    <Show on={on} {...rest}>
      <div key={entries} className="contents">{children}</div>
    </Show>
  );
}

/** Delay a keyframe-animated child inside one beat. */
export const later = (ms, extra) => ({ animationDelay: `${ms}ms`, ...extra });

export const MODELS = {
  opus:   { name: 'Opus',   chip: 'bg-blue-500/15 text-blue-200 border-blue-400/40', dot: 'bg-blue-400' },
  sonnet: { name: 'Sonnet', chip: 'bg-sky-500/15 text-sky-200 border-sky-400/40',          dot: 'bg-sky-400' },
  haiku:  { name: 'Haiku',  chip: 'bg-teal-500/15 text-teal-200 border-teal-400/40', dot: 'bg-teal-400' },
};

export function Model({ m, className = '', children }) {
  const model = MODELS[m];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[13px] ${model.chip} ${className}`}>
      <span className={`size-1.5 rounded-full ${model.dot}`} />
      {children ?? model.name}
    </span>
  );
}

const LABELS = {
  'ready-for-ai':   'bg-blue-500/20 text-blue-200 border-blue-400/50',
  'ai-working':     'bg-sky-500/20 text-sky-200 border-sky-400/50',
  'needs-human':    'bg-amber-500/20 text-amber-200 border-amber-400/50',
  'ready-for-human':'bg-teal-500/20 text-teal-200 border-teal-400/50',
  'ship:full':      'bg-cyan-500/20 text-cyan-200 border-cyan-400/50',
  'harness-escape': 'bg-rose-500/20 text-rose-200 border-rose-400/50',
};

export function Label({ name, className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[14px] font-semibold ${LABELS[name]} ${className}`}>
      {name}
    </span>
  );
}

/** A keyboard-ish code chip. */
export function Code({ children, className = '' }) {
  return <code className={`rounded-md border border-hairline bg-ground/70 px-2 py-0.5 font-mono text-[0.85em] text-ink ${className}`}>{children}</code>;
}

/** Text that types itself in. Monospace only — width is counted in ch. */
export function Typed({ text, delay = 0, speed = 38, className = '' }) {
  return (
    <span
      className={`inline-block overflow-hidden whitespace-nowrap align-bottom ${className}`}
      style={{ width: `${text.length}ch`, animation: `pz-type ${text.length * speed}ms steps(${text.length}) ${delay}ms both` }}
    >
      {text}
    </span>
  );
}

/** ●●○ — how much of the change an agent could actually judge. */
export function Meter({ level }) {
  const n = { high: 3, medium: 2, low: 1 }[level];
  return (
    <span className="font-mono tracking-[0.2em]" aria-label={`${level} confidence`}>
      {'●'.repeat(n)}<span className="opacity-35">{'○'.repeat(3 - n)}</span>
    </span>
  );
}

const TONES = {
  cmd:  'text-ink',
  out:  'text-muted',
  ok:   'text-teal-300',
  warn: 'text-amber-300',
  bad:  'text-rose-300',
  dim:  'text-faint',
  hi:   'text-blue-300',
};

/**
 * A terminal or runner log. Each line is `{ t, tone, from }` — it appears once
 * `step >= from`, and `cmd` lines type themselves.
 */
export function Terminal({ title, lines, step = 0, className = '', style, bodyClass = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-hairline bg-[#071322] shadow-2xl shadow-black/50 ${className}`} style={style}>
      <div className="flex items-center gap-2 border-b border-edge bg-surface px-4 py-2.5">
        <span className="size-3 rounded-full bg-rose-400/80" />
        <span className="size-3 rounded-full bg-amber-400/80" />
        <span className="size-3 rounded-full bg-teal-400/80" />
        <span className="ml-3 font-mono text-[13px] text-faint">{title}</span>
      </div>
      <div className={`space-y-1.5 px-5 py-4 font-mono text-[17px] leading-relaxed ${bodyClass}`}>
        {lines.filter((l) => step >= (l.from ?? 0)).map((l, i) => (
          <div key={`${l.from ?? 0}-${i}`} className={`pz-appear ${TONES[l.tone ?? 'out']}`} style={later(l.delay ?? 0)}>
            {l.tone === 'cmd' ? (
              <><span className="text-blue-400">❯ </span><Typed text={l.t} delay={(l.delay ?? 0) + 150} /></>
            ) : l.t}
          </div>
        ))}
        <div><span className="pz-caret inline-block h-5 w-2.5 translate-y-1 bg-ink/70" /></div>
      </div>
    </div>
  );
}

/** A GitHub-ish issue card. */
export function IssueCard({ number, title, state = 'Open', labels = [], children, className = '', style }) {
  return (
    <div className={`rounded-2xl border border-edge bg-surface shadow-2xl shadow-black/40 ${className}`} style={style}>
      <div className="border-b border-hairline px-7 pb-5 pt-6">
        <div className="font-display text-[30px] leading-tight text-ink">
          {title} <span className="font-sans font-normal text-faint">#{number}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1 text-[14px] font-semibold text-white">
            <IssueIcon /> {state}
          </span>
          {labels.map((l) => <Label key={l} name={l} className="pz-pop" />)}
        </div>
      </div>
      {children}
    </div>
  );
}

export function IssueIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
    </svg>
  );
}

export function PrIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
    </svg>
  );
}

export function MergeIcon({ className = 'size-4' }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z" />
    </svg>
  );
}

/**
 * The ticket itself — the one character that travels the whole talk. A Motion
 * element, so a scene can slide it along a rail or fly it in.
 */
export function Token({ n = 140, className = '', ...rest }) {
  return (
    <motion.div
      className={`pointer-events-none inline-flex h-7 items-center gap-1.5 rounded-full border border-blue-300/70 bg-blue-500/30 px-3 font-mono text-[15px] font-semibold text-blue-50 shadow-[0_0_28px_-2px_rgba(96,165,250,0.9),inset_0_0_12px_rgba(147,197,253,0.25)] backdrop-blur ${className}`}
      aria-hidden="true"
      {...rest}
    >
      <IssueIcon className="size-3.5 text-teal-300" />#{n}
    </motion.div>
  );
}

/** A card that turns over once, after `delay` ms — the back face is what stays. */
export function Flip({ delay = 0, front, back, className = '' }) {
  return (
    <div className={`relative ${className}`} style={{ perspective: 900 }}>
      <motion.div
        className="relative size-full"
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateX: 0 }}
        animate={{ rotateX: 180 }}
        transition={{ delay: delay / 1000, duration: 0.75, ease: [0.65, 0, 0.35, 1] }}
      >
        <div className="size-full" style={{ backfaceVisibility: 'hidden' }}>{front}</div>
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}>{back}</div>
      </motion.div>
    </div>
  );
}

/** A tick or a cross that pops in. */
export function Tick({ ok = true, className = '', style }) {
  return (
    <span
      className={`inline-grid size-7 shrink-0 place-items-center rounded-full text-[15px] font-bold ${ok ? 'bg-teal-500/20 text-teal-300 ring-1 ring-teal-400/40' : 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/40'} ${className}`}
      style={style}
      aria-label={ok ? 'passes' : 'fails'}
    >
      {ok ? '✓' : '✕'}
    </span>
  );
}

/** A small kicker above a panel. */
export function Kicker({ children, className = '' }) {
  return <div data-eyebrow className={`text-[13px] font-semibold uppercase tracking-[0.18em] text-edge ${className}`}>{children}</div>;
}

/** A GitHub-style verdict callout as the review and QA agents post it. */
export function Verdict({ pass, level, title, children, className = '' }) {
  const tone = !pass ? 'border-rose-400/60 bg-rose-500/10 text-rose-200'
    : level === 'high' ? 'border-teal-400/60 bg-teal-500/10 text-teal-200'
    : level === 'medium' ? 'border-sky-400/60 bg-sky-500/10 text-sky-200'
    : 'border-amber-400/60 bg-amber-500/10 text-amber-200';
  return (
    <div className={`rounded-xl border-l-4 px-5 py-3.5 ${tone} ${className}`}>
      <div className="flex items-center gap-3 font-display text-[21px]">
        <span>{title}{pass ? ` · ${level} confidence` : ' · blocker'}</span>
        {pass && <Meter level={level} />}
      </div>
      {children && <div className="mt-1 text-[16px] text-ink/80">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * The NAM 2026 card shapes (#293). Colours are the `.deck` tokens.
 * ------------------------------------------------------------------ */

/** The card: #071322 fill, thin #38bdf8 outline. */
export const CARD = 'rounded-2xl border border-edge bg-surface';

/** An outlined card with a circled numeral top left and a coloured heading. */
export function Card({ n, title, tone = 'text-edge', children, className = '', style, ...rest }) {
  return (
    <div className={`${CARD} p-6 ${className}`} style={style} {...rest}>
      <div className="flex items-center gap-4">
        {n != null && <span className={`grid size-11 shrink-0 place-items-center rounded-full border-2 border-current text-[18px] font-bold ${tone}`}>{n}</span>}
        {title && <div className={`text-[24px] font-bold leading-tight ${tone}`}>{title}</div>}
      </div>
      {children && <div className="mt-3 text-[18px] leading-snug text-ink">{children}</div>}
    </div>
  );
}

/** A coloured bar down the left edge and a big numeral beside the text. */
export function AccentCard({ n, title, color = 'edge', compact = false, children, className = '', style, ...rest }) {
  const c = { edge: ['bg-edge', 'text-edge'], orange: ['bg-orange', 'text-orange'], teal: ['bg-teal', 'text-teal'], cyan: ['bg-cyan', 'text-cyan'] }[color];
  return (
    <div className={`relative flex items-center ${compact ? '' : 'gap-6'} overflow-hidden ${CARD} ${compact ? 'gap-4 py-4 pl-8 pr-4' : 'py-5 pl-9 pr-6'} ${className}`} style={style} {...rest}>
      <span className={`absolute inset-y-0 left-0 w-3 ${c[0]}`} aria-hidden="true" />
      <span className={`${compact ? 'text-[44px]' : 'text-[72px]'} font-bold leading-none ${c[1]}`}>{n}</span>
      <div>
        <div className={`${compact ? 'text-[20px]' : 'text-[26px]'} font-bold leading-tight text-ink`}>{title}</div>
        {children && <div className={`mt-1 ${compact ? 'text-[15px]' : 'text-[18px]'} leading-snug text-muted`}>{children}</div>}
      </div>
    </div>
  );
}

/** A small outlined pill, for a key objective. */
export function Pill({ children, className = '' }) {
  return <span className={`inline-block rounded-full border border-edge px-4 py-1 text-[16px] font-semibold text-edge ${className}`}>{children}</span>;
}

/** Two side-by-side panels, each with an uppercase coloured header and a thin divider. */
export function TwoPanel({ left, right, className = '', style }) {
  return (
    <div className={`grid grid-cols-2 gap-6 ${className}`} style={style}>
      {[left, right].map((p) => (
        <div key={p.title} className={`${CARD} p-6`}>
          <div className={`text-[16px] font-bold uppercase tracking-[0.16em] ${p.tone ?? 'text-edge'}`}>{p.title}</div>
          <div className="my-3 h-px bg-hairline" />
          {p.children}
        </div>
      ))}
    </div>
  );
}

/** Closing slides: a row of three numbered cards over the charcoal. */
export function ClosingRow({ cards, y = 640, width = 1000 }) {
  const colors = ['edge', 'orange', 'cyan'];
  return (
    <>
      <div className="pointer-events-none absolute grid grid-cols-3 gap-5" style={{ left: 80, top: y, width }}>
        {cards.map((c, i) => (
          <AccentCard key={c.title} n={`0${i + 1}`} title={c.title} color={colors[i]} data-testid="closing-card" compact>{c.sub}</AccentCard>
        ))}
      </div>
    </>
  );
}
