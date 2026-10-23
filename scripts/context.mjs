/**
 * Context docs — a map of the app an agent can read instead of the source.
 *
 *   node scripts/context.mjs index                     # every doc's front matter, one line each
 *   node scripts/context.mjs for server/lib/seats.js   # which docs cover these files
 *   node scripts/context.mjs check                     # every path a doc names exists
 *   node scripts/context.mjs show seats                # a doc's outline: its sections and parts, with sizes
 *   node scripts/context.mjs show seats Gotchas Waitlist   # only those parts
 *
 * Each file in `docs/context/` describes one area of the app, with YAML front
 * matter saying what it covers, which files it owns and when to read it. An
 * agent starts from `index` — about a thousand tokens — picks the one or two docs
 * its ticket touches, and opens source only for the lines it will change.
 * Scanning the tree to find out how the app fits together is the expensive
 * thing this replaces.
 *
 * `for` is how the docs stay true: the ship workflow passes it the files a
 * branch changed and updates exactly the docs that come back. `check` runs in
 * `npm test`, so a doc naming a file that has been moved fails the build rather
 * than quietly misleading the next agent — and so does a source file no doc
 * owns, because `for` cannot route a change to a doc that does not list it.
 *
 * `show` exists because a read is paid for on every later turn: an agent that
 * cats two 150-line docs carries them, re-read, for the rest of its life. The
 * outline costs a few lines; then it reads the Gotchas and the parts it needs.
 *
 * The front matter is a deliberate subset of YAML — `key: value` scalars and
 * `- item` lists — so this needs no parser dependency.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
export const DIR = 'docs/context';
const LISTS = ['files', 'tests', 'related'];
/** Every tracked file under these must be owned by some doc. */
export const OWNED = ['server/', 'src/', 'scripts/', 'tests/'];

/** Parse the front matter block at the top of a markdown string. */
export function frontMatter(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const out = {};
  let list = null;
  for (const raw of m[1].split('\n')) {
    const line = raw.replace(/\s+#.*$/, '');
    if (!line.trim()) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && list) { out[list].push(unquote(item[1])); continue; }
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`cannot read front matter line: ${raw}`);
    const [, key, value] = kv;
    if (value === '') { out[key] = []; list = key; continue; }
    list = null;
    out[key] = value.startsWith('[')
      ? value.slice(1, -1).split(',').map(s => unquote(s.trim())).filter(Boolean)
      : unquote(value);
  }
  for (const k of LISTS) if (typeof out[k] === 'string') out[k] = [out[k]];
  return out;
}

const unquote = (s) => s.replace(/^(['"])(.*)\1$/, '$2');

/** Every context doc, with its front matter and path. README is the index's own doc. */
export function load(root = ROOT) {
  const dir = join(root, DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map(f => {
      const path = `${DIR}/${f}`;
      const meta = frontMatter(readFileSync(join(dir, f), 'utf8'));
      if (!meta) throw new Error(`${path} has no front matter`);
      return { path, ...meta, files: meta.files || [], tests: meta.tests || [], related: meta.related || [] };
    });
}

/** Does a doc's `files` entry cover this path? A trailing slash owns a directory. */
export const covers = (entry, file) => (entry.endsWith('/') ? file.startsWith(entry) : file === entry);

/** The docs that own any of these files — what to update when they change. */
export function docsFor(docs, files) {
  return docs.filter(d => files.some(f => [...d.files, ...d.tests].some(e => covers(e, f))));
}

/** Paths a doc names that do not exist, and `related` areas that are not docs. */
export { tracked };
export function problems(docs, root = ROOT) {
  const areas = new Set(docs.map(d => d.area));
  const out = [];
  for (const d of docs) {
    for (const k of ['area', 'summary', 'read_when']) if (!d[k]) out.push(`${d.path}: missing ${k}`);
    for (const p of [...d.files, ...d.tests]) if (!existsSync(join(root, p))) out.push(`${d.path}: ${p} does not exist`);
    for (const r of d.related) if (!areas.has(r)) out.push(`${d.path}: related area "${r}" has no doc`);
  }
  return out;
}

/** Tracked source files no doc lists in `files` or `tests`. */
export function unowned(docs, tracked) {
  const entries = docs.flatMap(d => [...d.files, ...d.tests]);
  return tracked
    .filter(f => OWNED.some(p => f.startsWith(p)))
    .filter(f => !entries.some(e => covers(e, f)));
}

const tracked = (root = ROOT) =>
  execFileSync('git', ['ls-files', ...OWNED], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

/**
 * The parts of a doc body: each `## ` section, and within one each paragraph
 * that opens with a **bold lead** — the docs' natural sub-sections. Every part
 * runs to the start of the next, and a part inside a section never crosses it.
 */
export function parts(text) {
  const lines = text.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n');
  const out = [];
  let section = null;
  lines.forEach((line, i) => {
    const h = /^## (.+)/.exec(line);
    const b = !h && /^\*\*([^*]+?)\*\*/.exec(line) && (i === 0 || lines[i - 1].trim() === '');
    if (h) { section = { level: 2, title: h[1].trim(), start: i }; out.push(section); }
    else if (b) out.push({ level: 3, title: /^\*\*([^*]+?)\*\*/.exec(line)[1].replace(/[.:—]+$/, '').trim(), start: i, section });
  });
  out.forEach((p, k) => {
    const next = out.slice(k + 1).find(q => p.level === 2 ? q.level === 2 : true);
    p.end = next ? next.start : lines.length;
    p.text = lines.slice(p.start, p.end).join('\n').trimEnd();
  });
  return out;
}

export function show(doc, wanted = []) {
  const body = readFileSync(join(ROOT, doc.path), 'utf8');
  const all = parts(body);
  if (!wanted.length) {
    return [`${doc.path} — ${doc.summary}`, ...all.map(p =>
      `${p.level === 2 ? '' : '  '}${p.level === 2 ? '## ' : ''}${p.title}  (${p.end - p.start} lines)`)].join('\n');
  }
  const hits = all.filter(p => wanted.some(w => p.title.toLowerCase().startsWith(w.toLowerCase())));
  return hits.length ? hits.map(p => p.text).join('\n\n') : `no part of ${doc.path} starts with: ${wanted.join(', ')}`;
}

function main([cmd, ...rest]) {
  const docs = load();
  if (cmd === 'index') {
    for (const d of docs) console.log(`${d.path}\n  ${d.summary}\n  read when: ${d.read_when}\n`);
  } else if (cmd === 'for') {
    const files = rest.map(f => relative(ROOT, resolve(f)));
    for (const d of docsFor(docs, files)) console.log(d.path);
  } else if (cmd === 'show') {
    const [name, ...wanted] = rest;
    const doc = docs.find(d => d.path.endsWith(`/${String(name).replace(/\.md$/, '')}.md`));
    if (!doc) { console.error(`no context doc named ${name}`); process.exit(2); }
    console.log(show(doc, wanted));
  } else if (cmd === 'check') {
    const bad = [...problems(docs), ...unowned(docs, tracked()).map(f => `${f}: no context doc owns it`)];
    for (const p of bad) console.error(p);
    if (bad.length) process.exit(1);
    console.log(`${docs.length} context docs, every path resolves`);
  } else {
    console.error('usage: node scripts/context.mjs index | for <file…> | show <doc> [part…] | check');
    process.exit(2);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
