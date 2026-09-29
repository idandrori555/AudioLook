export function parsePlaylistHtml(html, playlistId) {
  const match =
    html.match(/ytInitialData\s*=\s*({.+?});\s*<\/script>/s) ||
    html.match(/ytInitialData\s*=\s*({.+?});/);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    const meta = data.metadata?.playlistMetadataRenderer;
    const header = data.header?.playlistHeaderRenderer;
    const playlistTitle = meta?.title || header?.title?.simpleText || 'פלייליסט יוטיוב';
    const author = header?.ownerText?.runs?.[0]?.text || 'יוטיוב';

    const videos = [];
    const seen = new Set();

    function scan(obj) {
      if (!obj || typeof obj !== 'object') return;

      if (obj.lockupViewModel?.contentId) {
        const vm = obj.lockupViewModel;
        const videoId = vm.contentId;
        const title = vm.metadata?.lockupMetadataViewModel?.title?.content || '';
        let durationFormatted = '';
        try {
          const overlays = vm.contentImage?.thumbnailViewModel?.overlays || [];
          for (const ov of overlays) {
            const badges = ov.thumbnailBottomOverlayViewModel?.badges || [];
            for (const b of badges) {
              if (b.thumbnailBadgeViewModel?.text) {
                durationFormatted = b.thumbnailBadgeViewModel.text;
                break;
              }
            }
          }
        } catch {}
        if (videoId && title && !seen.has(videoId)) {
          seen.add(videoId);
          videos.push({ videoId, title, durationFormatted });
        }
      }

      if (obj.playlistVideoRenderer?.videoId) {
        const pvr = obj.playlistVideoRenderer;
        const videoId = pvr.videoId;
        const title =
          pvr.title?.runs?.map((r) => r.text).join('') || pvr.title?.simpleText || '';
        const durationFormatted =
          pvr.lengthText?.simpleText || pvr.lengthText?.runs?.[0]?.text || '';
        if (videoId && title && !seen.has(videoId)) {
          seen.add(videoId);
          videos.push({ videoId, title, durationFormatted });
        }
      }

      for (const k of Object.keys(obj)) scan(obj[k]);
    }

    scan(data);

    if (videos.length > 0) {
      const firstVideoId = videos[0]?.videoId;
      const thumbnailUrl = firstVideoId
        ? `https://img.youtube.com/vi/${firstVideoId}/hqdefault.jpg`
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop';
      return { playlistId, title: playlistTitle, author, thumbnailUrl, videos };
    }
  } catch (e) {
    console.error('Error parsing ytInitialData:', e);
  }
  return null;
}
