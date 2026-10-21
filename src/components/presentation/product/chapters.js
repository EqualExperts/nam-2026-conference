import { PRODUCT_INTRO } from './intro.jsx';
import { LISTEN } from './listen.jsx';
import { WINNOW } from './winnow.jsx';
import { RAISE } from './raise.jsx';

/**
 * The product talk, in order — the same chapter shape as the engineering
 * deck's: `{ id, name, accent, tone, beats, Scene, enter? }`. It ends on the
 * frame the engineering talk opens with, and Deck's `next` carries the ticket over.
 */
export const PRODUCT_CHAPTERS = [...PRODUCT_INTRO, ...LISTEN, ...WINNOW, ...RAISE];
