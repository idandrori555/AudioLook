import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { parsePlaylistHtml } from './playlistParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST_DIR = path.join(__dirname, 'dist');

const app = express();

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// YouTube playlist proxy — identical to vite.config.ts dev middleware
app.get('/api/youtube-playlist', async (req, res) => {
  const playlistId = req.query.list;
  if (!playlistId || typeof playlistId !== 'string') {
    return res.status(400).json({ error: 'Missing list query parameter' });
  }

  // 1. Fetch full YouTube playlist HTML page (no 15-item RSS limit)
  try {
    const pageRes = await fetch(
      `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    );
    if (pageRes.ok) {
      const html = await pageRes.text();
      const parsed = parsePlaylistHtml(html, playlistId);
      if (parsed && parsed.videos.length > 0) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.json(parsed);
      }
    }
  } catch (err) {
    console.warn('HTML page extraction failed, trying fallback RSS feed:', err);
  }

  // 2. Fallback to RSS feed if HTML extraction was blocked
  try {
    const targetUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
    const ytRes = await fetch(targetUrl);
    if (!ytRes.ok) {
      return res.status(ytRes.status).json({ error: `YouTube responded with status ${ytRes.status}` });
    }
    const xml = await ytRes.text();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(xml);
  } catch (err) {
    console.error('RSS fallback failed:', err);
    return res.status(500).json({ error: err.message || 'Internal proxy error' });
  }
});

// Serve static SPA.
// Service-worker files must never be long-cached, or clients would stop
// picking up new app versions (the browser checks sw.js for updates).
app.use(
  express.static(DIST_DIR, {
    maxAge: '1y',
    index: false,
    setHeaders: (res, filePath) => {
      if (/(sw\.js|registerSW\.js|manifest\.webmanifest)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

// SPA fallback — must be last
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown: finish in-flight requests on SIGTERM/SIGINT
// (docker stop, compose down, host reboot) instead of dropping them.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, closing server...`);
  server.close(() => {
    console.log('Server closed, exiting.');
    process.exit(0);
  });
  // Failsafe: force exit if connections linger
  setTimeout(() => {
    console.warn('Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
