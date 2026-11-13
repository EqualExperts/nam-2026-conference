/* Orbit's own context layout, as the product talk's context slide lists it.
 * Plain data so a unit test can check every path against the repository:
 * a trailing `/` is a folder, anything else a file, and `…` stands for the rest. */

export const DOCS = [
  { f: 'CLAUDE.md', what: 'what was decided, and why' },
  { f: 'context/index.md', what: 'one line per folder: when to read it', key: true },
  { f: 'context/product-context/', what: 'who the app is for, and why' },
  { f: 'context/product-context/prd.md', what: 'what the app is' },
  { f: 'context/product-context/user-personas.md', what: 'who uses it' },
  { f: 'context/engineering-context/', what: 'how it is built' },
  { f: 'context/engineering-context/seats.md', what: 'the reservation rules' },
  { f: 'context/engineering-context/testing.md', what: 'how a change is proved', pick: true },
  { f: 'context/engineering-context/ui.md', what: 'UI conventions' },
  { f: 'context/engineering-context/harness/', what: 'how tickets ship' },
  { f: 'context/winnow-transcripts/', what: 'the conversations requirements come from' },
  { f: 'context/winnow-transcripts/demo-transcript.txt', what: 'a meeting, as text' },
  { f: '…', what: 'one doc per area' },
];

export const CHIPS = ['CLAUDE.md', 'context/index.md', 'context/engineering-context/testing.md', 'context/engineering-context/ui.md'];
