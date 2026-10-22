import { useDocumentTitle } from '../lib/useDocumentTitle.js';
import { Button, SectionHeader } from '../components/ui.jsx';
import { Icon } from '../components/Icon.jsx';

/**
 * Deliberately empty. Workshop teams design this page from scratch, so it
 * holds no opinion about what an agenda should be. The rules and data are all
 * still there: adding a session takes a seat, and `/users/:id/schedule`,
 * `/users/:id/today` and the `.ics` exports are wired up in `lib/api.js`.
 */
export function MyAgendaPage() {
  useDocumentTitle('My Agenda');

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Your conference" title="My Agenda" />
      <section
        className="grid place-items-center rounded-2xl border border-dashed border-hairline bg-surface px-6 py-20 text-center"
        data-testid="agenda-coming-soon"
      >
        <span className="grid size-12 place-items-center rounded-xl bg-violet-500/12 text-violet-300">
          <Icon name="ticket" className="size-5" />
        </span>
        <h2 className="mt-4 font-display text-2xl">Coming soon</h2>
        <p className="mt-2 max-w-sm text-sm text-muted">
          A new way to plan your time at the conference is on its way.
        </p>
        <Button to="/schedule" size="sm" className="mt-6">Browse the schedule</Button>
      </section>
    </div>
  );
}
