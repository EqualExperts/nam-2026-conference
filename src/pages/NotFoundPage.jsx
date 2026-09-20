import { EmptyState, Button } from '../components/ui.jsx';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

export function NotFoundPage() {
  useDocumentTitle('Not found');
  return (
    <div className="py-20">
      <EmptyState
        icon="search"
        title="Nothing scheduled here"
        description="That page is not on the programme. Try the schedule instead."
        action={
          <div className="flex flex-wrap justify-center gap-2" data-testid="not-found-actions">
            <Button to="/" variant="ghost" size="sm">Go to the home page</Button>
            <Button to="/schedule" variant="primary" size="sm">Browse the schedule</Button>
          </div>
        }
      />
    </div>
  );
}
