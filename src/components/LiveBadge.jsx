import { cx } from './ui.jsx';

/** The pulsing red dot + "LIVE" used wherever something is in progress. */
export function LiveBadge({ className, label = 'Live' }) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5',
      'text-[10px] font-bold uppercase tracking-wider text-rose-300',
      className,
    )}>
      <span className="size-1.5 animate-pulse-dot rounded-full bg-rose-400" />
      {label}
    </span>
  );
}
