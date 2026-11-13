/* Orbit's real context layout, as the product talk's context slide lists it.
 * Plain data (no JSX) so a unit test can check every path against the repo. */

export const ORBIT_CONTEXT = [
  { path: 'CLAUDE.md', what: 'what was decided, and why' },
  { path: 'context/index.md', what: 'one line per folder: when to read it', key: true },
  { path: 'context/product-context/', what: 'who the app is for, and why' },
  { path: 'context/product-context/prd.md', what: 'the product requirements' },
  { path: 'context/engineering-context/', what: 'how it is built' },
  { path: 'context/engineering-context/seats.md', what: 'the reservation rules' },
  { path: 'context/engineering-context/testing.md', what: 'how a change is proved', pick: true },
  { path: 'context/engineering-context/ui.md', what: 'UI conventions' },
  { path: 'context/engineering-context/harness/', what: 'how tickets become pull requests' },
  { path: 'context/winnow-transcripts/', what: 'the conversations requirements come from' },
  { path: 'context/winnow-transcripts/demo-transcript.txt', what: 'a sample meeting' },
  { path: '…', what: 'one doc per area' },
];

export const CONTEXT_CHIPS = ['CLAUDE.md', 'context/index.md', 'context/engineering-context/testing.md', 'context/engineering-context/ui.md'];
