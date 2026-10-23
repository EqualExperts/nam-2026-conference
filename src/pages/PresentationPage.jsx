import { Deck } from '../components/presentation/Deck.jsx';
import { CHAPTERS } from '../components/presentation/chapters.js';

/** /engineering-presentation — the engineering harness: the ticket → a reviewed pull request. */
export function PresentationPage() {
  return <Deck chapters={CHAPTERS} title="The engineering harness" />;
}
