import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { Backdrop } from '../components/presentation/Backdrop.jsx';
import { CHAPTERS } from '../components/presentation/chapters.js';
import { useEntries } from '../components/presentation/kit.jsx';
import { beatAfter, clampBeat, keyAction, locateBeat, parseBeat } from '../lib/presentation.js';
import { useDocumentTitle } from '../lib/useDocumentTitle.js';

/**
 * /engineering-presentation — the engineering harness, end to end, as one scene the
 * presenter steps through. Full screen, outside <Layout>: no header, no footer.
 * Each chapter is a layer on a fixed 1600×900 stage; a beat is one press.
 */

const STAGE_W = 1600;
const STAGE_H = 900;
const COUNTS = CHAPTERS.map((c) => c.beats.length);
const TOTAL = COUNTS.reduce((a, b) => a + b, 0);

function useStageScale() {
  const fit = () => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const [scale, setScale] = useState(fit);
  useEffect(() => {
    const onResize = () => setScale(fit());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return scale;
}

// Moving forward flies through the camera: the old chapter swells and blurs
// past you, the next one rises out of the distance.
const LAYER = {
  past:    { opacity: 0, scale: 1.45, filter: 'blur(14px)', pointerEvents: 'none' },
  current: { opacity: 1, scale: 1, filter: 'blur(0px)', pointerEvents: 'auto' },
  future:  { opacity: 0, scale: 0.7, filter: 'blur(14px)', pointerEvents: 'none' },
};

// A chapter with `enter: 'cut'` is reached by a plain crossfade instead, so a
// scene that already drew the next chapter's opening frame lands on it exactly.
const CUT = {
  past:    { opacity: 0, scale: 1, filter: 'blur(0px)', pointerEvents: 'none' },
  current: LAYER.current,
  future:  { opacity: 0, scale: 1, filter: 'blur(0px)', pointerEvents: 'none' },
};

function Layer({ chapter, state, step, cut }) {
  // Re-mount the scene each time it becomes current, so its entrance plays.
  const entries = useEntries(state === 'current');
  const Scene = chapter.Scene;
  return (
    <motion.div
      initial={state === 'current' ? 'future' : state}
      animate={state}
      variants={cut ? CUT : LAYER}
      transition={cut
        ? { duration: 0.5, opacity: { duration: 0.5 } }
        : { type: 'spring', stiffness: 70, damping: 18, mass: 1, opacity: { duration: 0.7 }, filter: { duration: 0.7 } }}
      aria-hidden={state === 'current' ? undefined : true}
      className="absolute inset-0"
    >
      <div key={entries} className="absolute inset-0">
        <Scene step={step} />
      </div>
    </motion.div>
  );
}

const WORD = {
  hidden: { opacity: 0, y: 34, filter: 'blur(10px)' },
  shown: { opacity: 1, y: 0, filter: 'blur(0px)' },
};

function Caption({ beat, accent, index }) {
  return (
    <AnimatePresence mode="wait">
      {beat && (
        <motion.div
          key={index}
          data-testid="presentation-caption"
          className="absolute"
          style={{ left: 80, top: 650, width: 1440 }}
          initial="hidden"
          animate="shown"
          exit={{ opacity: 0, y: -14, filter: 'blur(6px)', transition: { duration: 0.18 } }}
          transition={{ staggerChildren: 0.035 }}
        >
          <motion.div variants={WORD} className={`font-mono text-[15px] uppercase tracking-[0.2em] ${accent}`}>{beat.kicker}</motion.div>
          <h2 className="mt-2 font-display text-[46px] leading-tight text-ink">
            {beat.title.split(' ').map((w, i) => (
              <motion.span key={i} variants={WORD} transition={{ type: 'spring', stiffness: 220, damping: 22 }} className="mr-[0.25em] inline-block">{w}</motion.span>
            ))}
          </h2>
          <motion.p variants={WORD} transition={{ duration: 0.6, delay: 0.25 }} className="mt-3 max-w-[1180px] text-[22px] leading-relaxed text-muted">
            {beat.body}
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The stage leans a degree or two toward the pointer — enough to feel like depth. */
function useParallax() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-1, 1], [-2.2, 2.2]), { stiffness: 60, damping: 20 });
  const rotateX = useSpring(useTransform(my, [-1, 1], [1.8, -1.8]), { stiffness: 60, damping: 20 });
  const onPointerMove = (e) => {
    mx.set((e.clientX / window.innerWidth) * 2 - 1);
    my.set((e.clientY / window.innerHeight) * 2 - 1);
  };
  return { rotateX, rotateY, onPointerMove };
}

export function PresentationPage() {
  useDocumentTitle('The engineering harness');
  const [params, setParams] = useSearchParams();
  const beat = parseBeat(params.get('beat'), TOTAL);
  const { chapter, step } = locateBeat(beat, COUNTS);
  const scale = useStageScale();
  const parallax = useParallax();

  const go = useCallback((next) => {
    const target = clampBeat(next, TOTAL);
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (target === 0) p.delete('beat');
      else p.set('beat', String(target + 1));
      return p;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // a button reached with Tab keeps Enter and Space as its own click; a
      // clicked one never takes focus (keepFocusOnStage), so they still advance
      if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a')) return;
      if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); return; }
      const action = keyAction(e.key);
      if (action == null) return;
      e.preventDefault();
      go(beatAfter(beat, action, TOTAL));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [beat, go]);

  const chapterStarts = useMemo(() => COUNTS.map((_, i) => COUNTS.slice(0, i).reduce((a, b) => a + b, 0)), []);
  const current = CHAPTERS[chapter];

  return (
    <MotionConfig reducedMotion="user">
    <div className="fixed inset-0 select-none overflow-hidden bg-ground text-ink" data-testid="presentation" onPointerMove={parallax.onPointerMove}>
      <Backdrop tone={current.tone} warpKey={chapter} />

      {/* The stage. Clicking anywhere on it moves on, as a clicker would. */}
      <div
        className="absolute left-1/2 top-1/2 cursor-pointer"
        style={{ width: STAGE_W, height: STAGE_H, transform: `translate(-50%, -50%) scale(${scale})`, perspective: 1800 }}
        onClick={() => go(beat + 1)}
      >
        <motion.div className="absolute inset-0" style={{ rotateX: parallax.rotateX, rotateY: parallax.rotateY, transformStyle: 'preserve-3d' }}>
          {CHAPTERS.map((c, i) => {
            if (Math.abs(i - chapter) > 1) return null;
            const state = i < chapter ? 'past' : i > chapter ? 'future' : 'current';
            const s = state === 'current' ? step : state === 'past' ? c.beats.length - 1 : 0;
            // the boundary this layer crosses is the one into the later of the two chapters
            const cut = CHAPTERS[Math.max(i, chapter)].enter === 'cut';
            return <Layer key={c.id} chapter={c} state={state} step={s} cut={cut} />;
          })}
          <Caption beat={current.beats[step]} accent={current.accent} index={beat} />
        </motion.div>
      </div>

      {/* Chrome — outside the stage so it stays crisp at any scale. */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-4 px-5 py-3 text-[13px]" onMouseDown={keepFocusOnStage}>
        <Link to="/" className="font-display text-[15px] text-muted hover:text-ink" aria-label="Back to ORBIT '26">ORBIT &rsquo;26</Link>
        <span className="text-faint">/</span>
        <span className="text-muted" data-testid="presentation-chapter">{current.name}</span>
        <span className="ml-auto font-mono text-faint" data-testid="presentation-counter">{beat + 1} / {TOTAL}</span>
        <button type="button" onClick={toggleFullscreen} className="rounded-md border border-hairline px-2 py-1 text-muted hover:bg-overlay hover:text-ink" aria-label="Toggle full screen (F)">
          ⛶
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-5 pb-3" onMouseDown={keepFocusOnStage}>
        <nav aria-label="Chapters" className="flex flex-1 gap-1.5">
          {CHAPTERS.map((c, i) => {
            const done = i < chapter ? 1 : i > chapter ? 0 : (step + 1) / c.beats.length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => go(chapterStarts[i])}
                className="group relative h-6 flex-1"
                style={{ flexGrow: c.beats.length }}
                aria-label={`Chapter ${i + 1}: ${c.name}`}
                aria-current={i === chapter ? 'step' : undefined}
              >
                <span className="absolute inset-x-0 bottom-1.5 h-1 overflow-hidden rounded-full bg-overlay group-hover:h-1.5">
                  <span className="block h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-300 transition-[width] duration-500" style={{ width: `${done * 100}%` }} />
                </span>
              </button>
            );
          })}
        </nav>
        <button type="button" data-testid="presentation-prev" onClick={() => go(beat - 1)} disabled={beat === 0}
          className="rounded-lg border border-hairline bg-surface/80 px-3 py-1.5 text-[13px] text-muted hover:text-ink disabled:opacity-30" aria-label="Previous">←</button>
        <button type="button" data-testid="presentation-next" onClick={() => go(beat + 1)} disabled={beat === TOTAL - 1}
          className="rounded-lg border border-hairline bg-surface/80 px-3 py-1.5 text-[13px] text-muted hover:text-ink disabled:opacity-30" aria-label="Next">→</button>
      </div>
      <span className="sr-only" aria-live="polite">{`Beat ${beat + 1} of ${TOTAL}: ${current.beats[step]?.title ?? current.name}`}</span>
    </div>
    </MotionConfig>
  );
}

/**
 * A mouse click on the chrome must not leave a button focused: Space and Enter
 * would then re-fire it — toggling full screen, or jumping back to a chapter's
 * start — instead of moving the talk on. Keyboard focus via Tab still works.
 */
function keepFocusOnStage(e) {
  if (e.target.closest('button')) e.preventDefault();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
