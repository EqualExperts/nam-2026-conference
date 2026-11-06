import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * The Equal Experts brand, proved without a browser: the tokens, the
 * absence of hard-coded colour, WCAG AA on the text pairs, and Lexend.
 */

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}
const sources = walk(join(ROOT, 'src')).map((p) => ({ file: relative(ROOT, p), text: readFileSync(p, 'utf8') }));

const css = read('src/index.css');
const theme = css.match(/@theme\s*\{([\s\S]*?)\n\}/)[1];
const token = (name) => {
  const m = theme.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `--color-${name} is not defined as a hex in @theme`);
  return m[1].toLowerCase();
};

// A hex colour (3-digit ones only if they contain a letter, so "#142" is an issue number).
const HEX = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#(?=[0-9a-f]*[a-f])[0-9a-f]{3}\b/gi;
const FUNC = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/gi;

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('the page ground is Dark Data', () => {
  assert.equal(token('ground'), '#212526');
});

test('no violet or cyan accent, gradient or glow remains', () => {
  const banned = /\b(violet|cyan|fuchsia|indigo|purple)\b|#(8b5cf6|a78bfa|c4b5fd|6d28d9|22d3ee|67e8f9)\b/i;
  const hits = [];
  for (const { file, text } of sources) {
    // accents.js keeps the stored names as object keys; its values are checked below.
    const body = file.endsWith('accents.js') ? text.replace(/^\s*(violet|cyan|fuchsia):/gm, '') : text;
    body.split('\n').forEach((line, i) => { if (banned.test(line)) hits.push(`${file}:${i + 1}`); });
  }
  if (/violet|cyan|fuchsia|#8b5cf6/i.test(read('index.html'))) hits.push('index.html');
  assert.deepEqual(hits, []);
});

test('no raw Tailwind palette colour is used: everything goes through the brand tokens', () => {
  const raw = /\b(?:text|bg|border|ring|from|to|via|shadow|fill|stroke|divide|outline|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
  const hits = [];
  for (const { file, text } of sources) text.split('\n').forEach((l, i) => { if (raw.test(l)) hits.push(`${file}:${i + 1}`); });
  assert.deepEqual(hits, []);
});

test('no hard-coded colour sits outside the brand tokens', () => {
  const hits = [];
  for (const { file, text } of sources) {
    let body = text;
    if (file === 'src/index.css') body = body.replace(/@theme\s*\{[\s\S]*?\n\}/, '');
    body.split('\n').forEach((line, i) => {
      const hexes = line.match(HEX) ?? [];
      const bad = file === 'src/lib/accents.js' ? hexes.filter((h) => !BRAND_TINTS.has(h.toLowerCase())) : hexes;
      if (bad.length || FUNC.test(line)) hits.push(`${file}:${i + 1} ${line.trim().slice(0, 60)}`);
      FUNC.lastIndex = 0;
    });
  }
  assert.deepEqual(hits, []);
});

// accents.js feeds SVG artwork, so it holds hexes: only the brand colours and their ink tints.
const BRAND_TINTS = new Set(['#1795d4', '#269c9e', '#f07c00', '#22567c', '#f5f5f5', '#ffffff', '#212526']);

test('text and meaningful colour meet WCAG AA on every elevation', () => {
  const grounds = ['ground', 'surface', 'raised', 'overlay'].map(token);
  for (const name of ['ink', 'muted', 'faint', 'brand-ink', 'teal-ink', 'ember', 'cloud']) {
    for (const g of grounds) {
      const r = contrast(token(name), g);
      assert.ok(r >= 4.5, `${name} on ${g} is ${r.toFixed(2)}:1, under 4.5:1`);
    }
  }
  // Tech Blue is the fill that carries white text; brand blue is for focus and borders (3:1 non-text).
  assert.ok(contrast('#ffffff', token('techblue')) >= 4.5);
  for (const g of grounds) assert.ok(contrast(token('brand'), g) >= 3, `brand blue on ${g} under 3:1`);
});

test('the accent names the database stores all map onto a small brand set', () => {
  const text = read('src/lib/accents.js');
  const names = ['violet', 'cyan', 'emerald', 'amber', 'orange', 'rose', 'fuchsia', 'sky', 'lime', 'teal'];
  for (const n of names) assert.match(text, new RegExp(`^\\s*${n}:`, 'm'), `${n} key is gone`);
  const dots = new Set([...text.matchAll(/dot:\s*'([^']+)'/g)].map((m) => m[1]));
  assert.ok(dots.size > 0 && dots.size <= 5, `${dots.size} distinct accent colours, want at most five`);
});

test('Lexend is the only text font', () => {
  const html = read('index.html');
  assert.match(html, /family=Lexend:wght@300;400;500;700/);
  assert.doesNotMatch(html, /Inter|Space\+Grotesk|JetBrains/);
  for (const v of ['sans', 'display', 'mono']) {
    const m = theme.match(new RegExp(`--font-${v}:\\s*([^;]+);`));
    assert.ok(m, `--font-${v} missing`);
    assert.match(m[1], /^"Lexend"/);
    assert.doesNotMatch(m[1], /Inter|Grotesk|JetBrains/);
  }
  const hits = sources.filter(({ text }) => /Inter\b.*sans|Space Grotesk|JetBrains/.test(text)).map((s) => s.file);
  assert.deepEqual(hits, []);
});

test('the brand files are in public/ and the tab icon is the blue mark', () => {
  for (const f of ['Equal_Experts_Logo_Monochrome_White.svg', 'Equal_Experts_Brand_Mark_RGB_Blue_Circle.svg']) {
    assert.ok(existsSync(join(ROOT, 'public/brand', f)), `${f} missing`);
  }
  assert.match(read('index.html'), /<link rel="icon"[^>]*\/brand\/Equal_Experts_Brand_Mark_RGB_Blue_Circle\.svg/);
  assert.match(read('src/components/Layout.jsx'), /Equal_Experts_Logo_Monochrome_White\.svg/);
});
