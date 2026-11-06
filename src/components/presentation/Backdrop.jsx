import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * Behind the stage: a field of stars drifting toward the viewer, which streaks
 * into warp for a moment whenever the chapter changes, and an aurora whose
 * colours follow the chapter. With reduced motion the stars hold still.
 */

// a translucent wash of one brand token
const wash = (token, pct) => `color-mix(in srgb, var(--color-${token}) ${pct}%, transparent)`;

const AURORA = {
  blue:  [wash('brand', 28), wash('techblue', 18), wash('teal', 10)],
  teal:  [wash('teal', 26), wash('techblue', 18), wash('brand', 10)],
  ember: [wash('ember', 22), wash('techblue', 18), wash('brand', 10)],
};

function Stars({ warpKey }) {
  const canvas = useRef(null);
  const warp = useRef(0);
  const still = useReducedMotion();

  useEffect(() => { warp.current = 1; }, [warpKey]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el.getContext('2d');
    // a fixed pattern, so every run of the talk looks the same
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stars = Array.from({ length: 260 }, () => ({ x: rand() * 2 - 1, y: rand() * 2 - 1, z: rand() }));
    // canvas cannot read var(), so take the star colour from the token once
    const starColour = getComputedStyle(document.documentElement).getPropertyValue('--color-brand-ink').trim() || 'white';
    let frame = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const boost = warp.current;
      const speed = still ? 0 : 0.0009 + boost * 0.022;
      for (const s of stars) {
        const pz = s.z;
        s.z -= speed;
        if (s.z <= 0.02) { s.x = rand() * 2 - 1; s.y = rand() * 2 - 1; s.z = 1; continue; }
        const k = 0.55 / s.z;
        const x = w / 2 + s.x * w * k * 0.5;
        const y = h / 2 + s.y * h * k * 0.5;
        if (x < 0 || x > w || y < 0 || y > h) continue;
        const alpha = Math.min(1, (1 - s.z) * 1.4) * 0.8;
        const kp = 0.55 / pz;
        const px = w / 2 + s.x * w * kp * 0.5;
        const py = h / 2 + s.y * h * kp * 0.5;
        ctx.strokeStyle = starColour;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.max(0.6, (1 - s.z) * 2.2);
        ctx.beginPath();
        ctx.moveTo(boost > 0.05 ? px : x - 0.01, boost > 0.05 ? py : y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      warp.current *= 0.94;
      if (!still) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, [still]);

  return <canvas ref={canvas} className="absolute inset-0 size-full opacity-70" aria-hidden="true" />;
}

const BLOBS = [
  { left: '58%', top: '-22%', size: '70vmax', drift: { x: [0, -60, 30, 0], y: [0, 40, -20, 0] }, dur: 22 },
  { left: '-18%', top: '42%', size: '60vmax', drift: { x: [0, 50, -30, 0], y: [0, -40, 30, 0] }, dur: 28 },
  { left: '30%', top: '70%', size: '50vmax', drift: { x: [0, 40, -50, 0], y: [0, -30, 10, 0] }, dur: 34 },
];

export function Backdrop({ tone, warpKey }) {
  const colours = AURORA[tone] ?? AURORA.blue;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl"
          style={{ left: b.left, top: b.top, width: b.size, height: b.size }}
          animate={{ ...b.drift, background: `radial-gradient(circle, ${colours[i]}, transparent 65%)` }}
          transition={{ x: { duration: b.dur, repeat: Infinity, ease: 'easeInOut' }, y: { duration: b.dur, repeat: Infinity, ease: 'easeInOut' }, background: { duration: 1.6 } }}
        />
      ))}
      <Stars warpKey={warpKey} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,color-mix(in srgb, var(--color-ground) 75%, transparent)_100%)]" />
    </div>
  );
}
