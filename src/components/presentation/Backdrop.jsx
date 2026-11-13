/**
 * Behind the stage: the NAM 2026 deck's flat charcoal. The starfield and the
 * aurora of the earlier look are gone — the ground is a token
 * (`--color-ground`, set by `.deck`). The deck's textured charcoal image has the
 * bridge baked into one corner, so it is not laid over every slide.
 */
export function Backdrop() {
  return <div data-testid="deck-ground" className="pointer-events-none absolute inset-0 bg-ground" aria-hidden="true" />;
}
