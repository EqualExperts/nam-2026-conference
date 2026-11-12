import { DECK } from './tokens.js';

/**
 * Behind the stage: the NAM 2026 charcoal ground, a flat #212121 with a faint lift
 * at the top and a darker floor. (The ticket's textured `charcoal-background.png`
 * has the bridge baked into it, so it is not used.) `tone` and `warpKey` stay
 * in the signature (a chapter still carries its tone, and a hand-off still
 * changes the key) but the ground is the same for every chapter.
 */
export function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={{ background: DECK.ground }}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,255,255,0.05),transparent_70%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-black/35 to-transparent" />
    </div>
  );
}
