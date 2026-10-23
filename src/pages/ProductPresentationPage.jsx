import { Deck } from '../components/presentation/Deck.jsx';
import { PRODUCT_CHAPTERS } from '../components/presentation/product/chapters.js';

/** /product-presentation — the product harness: a conversation → a ticket. Hands over to the engineering talk. */
export function ProductPresentationPage() {
  return <Deck chapters={PRODUCT_CHAPTERS} title="The product harness" next={{ to: '/engineering-presentation', label: 'The engineering harness', delay: 900 }} />;
}
