import { INTRO } from './intro.jsx';
import { SHIP, SHIP_PR } from './ship.jsx';
import { NEEDS_HUMAN, AFTER } from './after.jsx';

/**
 * The presentation, in order. Each chapter is `{ id, name, accent, beats, Scene }`:
 * one caption per beat (null for none), and a Scene drawn for a `step`.
 * needs-human breaks into ship where it happens — after the loop, before the
 * pull request — so the talk tells each idea once, at its station.
 */
export const CHAPTERS = [...INTRO, ...SHIP, ...NEEDS_HUMAN, ...SHIP_PR, ...AFTER];
