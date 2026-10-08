import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { db, DB_PATH } from './db.js';
import { metaRouter } from './routes/meta.js';
import { sessionsRouter } from './routes/sessions.js';
import { speakersRouter } from './routes/speakers.js';
import { usersRouter } from './routes/users.js';

const PORT = process.env.PORT ?? 3001;
// `npm run build` output. Absent under `npm run dev` (Vite serves the web),
// present under `npm start`, where this one process serves both.
const DIST_DIR = process.env.ORBIT_DIST_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const countSessions = db.prepare('SELECT COUNT(*) n FROM sessions');

if (!existsSync(DB_PATH)) {
  console.error('✗ No database found. Run `npm run db:seed` first.');
  process.exit(1);
}

export const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', metaRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/speakers', speakersRouter);
app.use('/api/users', usersRouter);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, sessions: countSessions.get().n });
});

app.use('/api', (req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` }));

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // Client-side routes (/speakers/12) get the shell; a path with an extension
  // that missed is a missing file, and must not come back as 200 HTML.
  app.get('*', (req, res) => {
    if (extname(req.path)) return res.status(404).type('text').send('Not found');
    res.sendFile(join(DIST_DIR, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('✗', err);
  res.status(err.status ?? 500).json({ error: err.message });
});

// Started directly (`node server/index.js`) it listens; imported — by a test
// that wants the app on an ephemeral port — it does not.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  app.listen(PORT, () => {
    console.log(`▸ ORBIT API listening on port ${PORT} (http://localhost:${PORT}/api)`);
  });
}
