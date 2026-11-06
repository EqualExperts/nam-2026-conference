import { cx } from './ui.jsx';

/** The pulsing red dot + "LIVE" used wherever something is in progress. */
export function LiveBadge({ className, label = 'Live' }) {
  return (
    <span className={cx(
      'inline-flex items-center gap-1.5 rounded-full bg-ember/15 px-2 py-0.5',
      'text-[10px] font-medium uppercase tracking-wider text-ember-ink',
      className,
    )}>
      <span className="size-1.5 animate-pulse-dot rounded-full bg-ember-ink" />
      {label}
    </span>
  );
}
