import { Deck } from '../components/presentation/Deck.jsx';
import { OPENING_CHAPTERS } from '../components/presentation/opening/chapters.js';

/** /opening-presentation — the welcome, and why the day is shaped as it is: shared context and parallel work. Hands over to the product talk. */
export function OpeningPresentationPage() {
  return <Deck chapters={OPENING_CHAPTERS} title="Welcome to NAM 2026" captions="top" next={{ to: '/product-presentation', label: 'The product harness', delay: 900 }} />;
}
