/**
 * Ticket #140 — the one character both talks follow. The product talk shows
 * it being written; the engineering talk shows it being built. One source, so
 * the two decks never drift apart by a word.
 */
export const ISSUE_140 = {
  number: 140,
  title: 'Keep sessions in view on mobile: stop the stacked filters filling the screen',
  why: 'on a phone the day tabs, track pills and venue filter stack at full width, so an attendee scrolls past the whole filter block before seeing a single session.',
  what: 'below the desktop breakpoint, compact the filter block on /schedule so sessions start in view — every filter still reachable.',
  doneWhen: [
    'At a phone-width viewport on /schedule, the first session card is visible without scrolling past the full filter block.',
    'Every filter (day, track, venue, level, format, topic, search) is still reachable on mobile.',
    'Existing mobile specs still pass.',
  ],
  outOfScope: 'whether the My agenda card hides on phones — a layout call for whoever builds this.',
};
