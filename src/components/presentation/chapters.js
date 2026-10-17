import { INTRO } from './intro.jsx';
import { SHIP } from './ship.jsx';
import { AFTER } from './after.jsx';

/**
 * The presentation, in order. Each chapter is `{ id, name, accent, beats, Scene }`:
 * one caption per beat (null for none), and a Scene drawn for a `step`.
 */
export const CHAPTERS = [...INTRO, ...SHIP, ...AFTER];
