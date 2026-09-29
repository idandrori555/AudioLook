import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { parsePlaylistHtml } from './playlistParser.js';

function youtubePlaylistPlugin(): Plugin {
  return {
    name: 'youtube-playlist-proxy',
    configureServer(server) {
      server.middlewares.use('/api/youtube-playlist', async (req, res) => {
        try {
          const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
          const playlistId = url.searchParams.get('list');
          if (!playlistId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: 'Missing list query parameter' }));
          }

          // 1. Fetch full YouTube playlist HTML page to get ALL videos (no 15-item RSS limit)
          try {
            const pageRes = await fetch(
              `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
              {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept-Language': 'en-US,en;q=0.9',
                },
              }
            );

            if (pageRes.ok) {
              const html = await pageRes.text();
              const parsed = parsePlaylistHtml(html, playlistId);
              if (parsed && parsed.videos.length > 0) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Access-Control-Allow-Origin', '*');
                return res.end(JSON.stringify(parsed));
              }
            }
          } catch (pageErr) {
            console.warn('HTML page extraction failed, trying fallback RSS feed:', pageErr);
          }

          // 2. Fallback to RSS feed if HTML extraction was blocked
          const targetUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
          const ytRes = await fetch(targetUrl);
          if (!ytRes.ok) {
            res.statusCode = ytRes.status;
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ error: `YouTube responded with status ${ytRes.status}` }));
          }

          const xml = await ytRes.text();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.end(xml);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: err.message || 'Internal proxy error' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      youtubePlaylistPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        // App shell is precached; images/fonts cached at runtime (see below).
        // /api/* is deliberately NetworkOnly — playlist data must stay fresh.
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              // Google Fonts stylesheets
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-css',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Google Fonts files
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-files',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Cover art / thumbnails (YouTube, Unsplash, Google user content)
              urlPattern: /^https:\/\/(img\.youtube\.com|i\.ytimg\.com|images\.unsplash\.com|lh3\.googleusercontent\.com)\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'cover-images',
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: 'AudioLook — אודיולוק',
          short_name: 'AudioLook',
          description:
            'אפליקציית ספרי שמע מעוצבת בהשראת Apple Books עם ספרייה אישית, נגן מתקדם, ייבוא תכנים, סימניות וטיימר שינה',
          lang: 'he',
          dir: 'rtl',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#121316',
          theme_color: '#121316',
          categories: ['music', 'entertainment', 'books'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
