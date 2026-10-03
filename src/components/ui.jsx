import { Link } from 'react-router-dom';
import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { accent } from '../lib/accents.js';
import { seatAction } from '../lib/format.js';
import { Icon } from './Icon.jsx';
import { GeneratedAvatar } from './GeneratedAvatar.jsx';
import { CountUp } from './CountUp.jsx';

const cx = (...parts) => parts.filter(Boolean).join(' ');
export { cx };

/* --------------------------------- Tooltip -------------------------------- */
// Only one tooltip is ever open — opening another closes it, module-wide
// rather than through the store, since this is purely a display concern.
let closeOpenTooltip = null;

function TooltipBubble({ id, label, rect }) {
  const elRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Two-pass placement: render once to measure the bubble's own size, then
  // place it from the trigger's rect, clamped 8px inside the viewport, and
  // flipped below when there is no room above. Runs before paint, so there is
  // nothing to see at the wrong spot first.
  useLayoutEffect(() => {
    const box = elRef.current?.getBoundingClientRect();
    if (!box) return;
    const margin = 8;
    let top = rect.top - box.height - 8;
    if (top < margin) top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - box.width / 2;
    left = Math.min(Math.max(left, margin), window.innerWidth - box.width - margin);
    setPos({ top, left });
  }, [rect]);

  return (
    <span
      ref={elRef}
      id={id}
      role="tooltip"
      data-testid="seat-tooltip"
      className="animate-rise fixed z-50 max-w-[14rem] rounded-lg border border-hairline bg-overlay px-2.5 py-1.5 text-xs font-medium text-ink shadow-lg shadow-black/30"
      style={{ top: pos?.top ?? rect.top, left: pos?.left ?? rect.left, visibility: pos ? 'visible' : 'hidden' }}
    >
      {label}
    </span>
  );
}

/**
 * Names what a trigger's click will do, after a hover or a keyboard focus.
 * Wraps its child (a plain `<button>`, never touch-activated) in a `span`
 * that tracks pointer enter/leave — so a `disabled` button, which cannot
 * fire its own pointer events reliably, still shows it — and adds focus,
 * blur and Escape handling, plus `aria-describedby`, to the child itself.
 */
export function Tooltip({ children, label }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const nodeRef = useRef(null);
  const timerRef = useRef(null);

  const close = () => {
    clearTimeout(timerRef.current);
    setOpen(false);
  };

  const open_ = () => {
    if (closeOpenTooltip && closeOpenTooltip !== close) closeOpenTooltip();
    closeOpenTooltip = close;
    const box = nodeRef.current?.getBoundingClientRect();
    if (box) setRect(box);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => () => {
    clearTimeout(timerRef.current);
    if (closeOpenTooltip === close) closeOpenTooltip = null;
  }, []);

  if (!isValidElement(children)) return children;

  const child = cloneElement(children, {
    ref: (node) => {
      nodeRef.current = node;
      const ref = children.ref;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    onFocus: (e) => {
      children.props.onFocus?.(e);
      if (e.target.matches?.(':focus-visible')) open_();
    },
    onBlur: (e) => {
      children.props.onBlur?.(e);
      close();
    },
    'aria-describedby': open ? id : children.props['aria-describedby'],
  });

  return (
    <span
      className="contents"
      onPointerEnter={(e) => {
        if (e.pointerType === 'touch') return;
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(open_, 300);
      }}
      onPointerLeave={() => {
        clearTimeout(timerRef.current);
        close();
      }}
    >
      {child}
      {open && rect && createPortal(<TooltipBubble id={id} label={label} rect={rect} />, document.body)}
    </span>
  );
}

/* --------------------------------- Avatar -------------------------------- */
const AVATAR_SIZES = {
  xs: 'size-6 text-[9px]',
  sm: 'size-8 text-[11px]',
  md: 'size-11 text-xs',
  lg: 'size-16 text-base',
  xl: 'size-24 text-2xl',
};

/**
 * People get a generated portrait (or their real photo, when `imageUrl` is set).
 * Pass `mono` for non-people — sponsors and the like — to fall back to initials
 * on a flat accent gradient.
 */
export function Avatar({ name, initials, accent: accentName = 'violet', size = 'md', imageUrl, className, ring = true, mono = false }) {
  const a = accent(accentName);
  const base = cx(
    'relative shrink-0 overflow-hidden rounded-full',
    AVATAR_SIZES[size],
    ring && 'ring-1 ring-white/10',
    className,
  );

  if (imageUrl) {
    return (
      <div className={base}>
        <img src={imageUrl} alt="" className="size-full object-cover" loading="lazy" />
      </div>
    );
  }

  if (mono || !name) {
    return (
      <div className={cx(base, 'grid place-items-center bg-gradient-to-br font-bold tracking-wide text-white/95', a.grad)}>
        <span className="select-none">{initials}</span>
      </div>
    );
  }

  return (
    <div className={base}>
      <GeneratedAvatar name={name} className="size-full" />
    </div>
  );
}

/* ---------------------------------- Chip --------------------------------- */
export function Chip({ children, accent: accentName, className, as: As = 'span', ...rest }) {
  const a = accentName ? accent(accentName) : null;
  return (
    <As
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
        a ? a.chip : 'border-hairline bg-overlay/70 text-muted',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

/* -------------------------------- TrackPill ------------------------------ */
export function TrackPill({ track, className }) {
  const a = accent(track.color);
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-[11px] font-semibold', a.text, className)}>
      <span className={cx('size-1.5 rounded-full', a.dot)} />
      {track.name}
    </span>
  );
}

/* --------------------------------- Button -------------------------------- */
const BUTTON_VARIANTS = {
  primary: 'bg-gradient-to-r from-violet-600 to-violet-500 text-white hover:from-violet-500 hover:to-violet-400 shadow-lg shadow-violet-900/40',
  ghost: 'border border-hairline bg-raised text-ink hover:bg-overlay hover:border-white/20',
  subtle: 'text-muted hover:text-ink hover:bg-raised',
  danger: 'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
};
const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-sm gap-2',
};

export function Button({ variant = 'ghost', size = 'md', className, as, to, href, ...rest }) {
  const As = as ?? (to ? Link : href ? 'a' : 'button');
  return (
    <As
      to={to}
      href={href}
      className={cx(
        'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
        'disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]',
        BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className,
      )}
      {...rest}
    />
  );
}

/* -------------------------------- SeatButton ------------------------------ */
/**
 * The one action: add this session to my agenda, which takes a seat.
 * `status` is null | 'confirmed' | 'waitlisted'. A tooltip on hover or focus
 * names what the next click will do — the same text as `aria-label`.
 */
export function SeatButton({ status, onClick, size = 'md', className, ended = false, full = false }) {
  const dims = size === 'sm' ? 'size-8' : 'size-10';
  const on = Boolean(status);
  const waiting = status === 'waitlisted';
  // An ended session offers no seat; a seat already held can still be released.
  const closed = ended && !on;
  const label = seatAction(status, { ended, full });

  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!closed) onClick(); }}
        disabled={closed}
        aria-pressed={on}
        aria-label={label}
        className={cx(
          // `relative z-10` keeps the button above the card's stretched link overlay,
          // which otherwise covers the whole card and swallows the click.
          'relative z-10 grid shrink-0 place-items-center rounded-lg border transition-all duration-150 active:scale-90',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
          dims,
          waiting
            ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
            : on
              ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
              : closed
                ? 'cursor-not-allowed border-hairline bg-overlay/30 text-faint/60 active:scale-100'
                : 'border-hairline bg-overlay/60 text-faint hover:border-emerald-400/40 hover:text-emerald-300',
          className,
        )}
      >
        <Icon name={waiting ? 'clock' : on ? 'check' : 'ticket'} className={size === 'sm' ? 'size-4' : 'size-[18px]'} />
      </button>
    </Tooltip>
  );
}

/* --------------------------------- Rating -------------------------------- */
export function Rating({ value, count, className, showValue = true }) {
  if (!count) return <span className={cx('text-[11px] text-faint', className)}>Not yet rated</span>;
  return (
    <span className={cx('inline-flex items-center gap-1 text-[11px] text-muted', className)}>
      <Icon name="star" filled className="size-3 text-amber-400" />
      {showValue && <span className="font-semibold text-ink">{value.toFixed(1)}</span>}
      <span className="text-faint">({count})</span>
    </span>
  );
}

/* ------------------------------ SectionHeader ---------------------------- */
export function SectionHeader({ eyebrow, title, description, action, className }) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-400">{eyebrow}</div>
        )}
        <h2 className="font-display text-2xl leading-tight sm:text-3xl">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------- Feedback ------------------------------- */
export function Spinner({ className }) {
  return (
    <div className={cx('flex items-center justify-center py-16', className)} role="status" aria-label="Loading">
      <span className="size-6 animate-spin rounded-full border-2 border-hairline border-t-violet-400" />
    </div>
  );
}

export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-lg bg-surface', className)} />;
}

export function EmptyState({ icon = 'search', title, description, action }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-raised text-faint">
        <Icon name={icon} />
      </div>
      <h3 className="font-display text-xl">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState
      icon="alert"
      title="That did not load"
      description={error?.message ?? 'Something went wrong talking to the API.'}
      action={onRetry && <Button onClick={onRetry} variant="ghost" size="sm">Try again</Button>}
    />
  );
}

/** For a 404 that can never succeed on retry — a link back, not a "Try again". */
export function NotFoundState({ title, backTo, backLabel }) {
  return (
    <EmptyState
      icon="search"
      title={title}
      action={<Button to={backTo} variant="primary" size="sm">{backLabel}</Button>}
    />
  );
}

/* ---------------------------------- Stat --------------------------------- */
/** `note` is a second, quieter line under the label — a caveat on the number. */
export function Stat({ value, label, accent: accentName = 'violet', testId, note = null }) {
  const a = accent(accentName);
  return (
    <div className="card px-4 py-3.5">
      <div className={cx('font-display text-2xl leading-none sm:text-3xl', a.text)} data-testid={testId}>
        {typeof value === 'number' ? <CountUp value={value} /> : value}
      </div>
      <div className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">{label}</div>
      {note && <div className="mt-1 text-[11px] font-medium text-amber-300">{note}</div>}
    </div>
  );
}
