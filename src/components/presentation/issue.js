/**
 * Ticket #140 — the one character both talks follow. The product talk shows
 * it being written; the engineering talk shows it being built. One source, so
 * the two decks never drift apart by a word.
 */
export const ISSUE_140 = {
  number: 140,
  title: 'Keep sessions in view on mobile: stop the stacked filters filling the screen',
  why: 'on a phone the filters fill the whole screen, so you have to scroll before you see a single session.',
  what: 'make the schedule’s filters take up less room on a phone, so the sessions are the first thing you see.',
  doneWhen: [
    'On a phone, I can see the first session on the schedule without scrolling.',
    'On a phone, I can still filter by day, track, venue, level, format and topic, and search.',
    'On a laptop, the schedule looks and works exactly as it does today.',
  ],
  outOfScope: 'whether to hide the My Agenda card on phones. Whoever builds this can decide.',
};
