import { Chapter } from '../types';

// YouTube API helper functions

export function extractYouTubePlaylistId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Check URL parameter: ?list=... or &list=...
  const paramMatch = trimmed.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (paramMatch && paramMatch[1]) {
    return paramMatch[1];
  }

  // Check if direct playlist ID (standard IDs start with PL, UU, FL, RD, OLAK5uy_, etc.)
  if (/^(?:PL|UU|FL|RD|OLAK5uy_)[a-zA-Z0-9_-]{10,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // If already an 11 character ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Matches youtu.be, youtube.com/watch?v=, youtube.com/embed/, youtube.com/v/, youtube.com/shorts/
  const patterns = [
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/,
    /^([\w-]{11})$/,
  ];

  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export interface YouTubeMetadata {
  title: string;
  author: string;
  thumbnailUrl: string;
  duration?: number;
}

export interface YouTubePlaylistData {
  playlistId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  chapters: Chapter[];
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function parseDurationToSeconds(str: string): number {
  if (!str) return 0;
  const parts = str.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return 0;
}

export async function fetchYouTubePlaylist(playlistId: string): Promise<YouTubePlaylistData> {
  const fallbackThumbnail =
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop';

  // 1. Try local server proxy which extracts all videos from the full playlist page
  try {
    const res = await fetch(`/api/youtube-playlist?list=${encodeURIComponent(playlistId)}`);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data && Array.isArray(data.videos) && data.videos.length > 0) {
          const chapters: Chapter[] = data.videos.map((v: any, index: number) => {
            const durSec = parseDurationToSeconds(v.durationFormatted);
            return {
              id: `yt-ch-${v.videoId}-${index + 1}`,
              number: index + 1,
              title: v.title,
              duration: durSec || 1800,
              durationFormatted: v.durationFormatted || 'פרק וידאו',
              youtubeId: v.videoId,
            };
          });

          const firstVideoId = chapters[0]?.youtubeId;
          const coverUrl =
            data.thumbnailUrl ||
            (firstVideoId
              ? `https://img.youtube.com/vi/${firstVideoId}/hqdefault.jpg`
              : fallbackThumbnail);

          return {
            playlistId,
            title: data.title || 'פלייליסט יוטיוב',
            author: data.author || 'יוטיוב',
            thumbnailUrl: coverUrl,
            chapters,
          };
        }
      } else {
        // Returned XML
        const xmlText = await res.text();
        if (xmlText && xmlText.includes('<feed')) {
          return parsePlaylistXml(xmlText, playlistId, fallbackThumbnail);
        }
      }
    }
  } catch (err) {
    console.warn('Local playlist proxy error:', err);
  }

  // 2. Fallback to CORS proxy with RSS feed
  try {
    const fallbackUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
      `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`
    )}`;
    const res = await fetch(fallbackUrl);
    if (res.ok) {
      const xmlText = await res.text();
      if (xmlText && xmlText.includes('<feed')) {
        return parsePlaylistXml(xmlText, playlistId, fallbackThumbnail);
      }
    }
  } catch (err) {
    console.warn('Fallback CORS proxy error:', err);
  }

  // Fallback if unable to fetch
  return {
    playlistId,
    title: `פלייליסט יוטיוב (${playlistId.slice(0, 8)}...)`,
    author: 'יוטיוב שמע',
    thumbnailUrl: fallbackThumbnail,
    chapters: [
      {
        id: `yt-pl-${playlistId}-1`,
        number: 1,
        title: 'פרק 1: פלייליסט יוטיוב',
        duration: 0,
        durationFormatted: 'פרק וידאו',
      },
    ],
  };
}

function parsePlaylistXml(xmlText: string, playlistId: string, fallbackThumbnail: string): YouTubePlaylistData {
  const titleMatch = xmlText.match(/<title>([^<]+)<\/title>/);
  const authorMatch = xmlText.match(/<author>\s*<name>([^<]+)<\/name>/);
  const playlistTitle = titleMatch ? decodeXmlEntities(titleMatch[1]) : `פלייליסט יוטיוב`;
  const playlistAuthor = authorMatch ? decodeXmlEntities(authorMatch[1]) : 'יוטיוב';

  const chapters: Chapter[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  let chapterIndex = 1;

  while ((match = entryRegex.exec(xmlText)) !== null) {
    const entryXml = match[1];
    const videoIdMatch = entryXml.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const videoTitleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
    if (videoIdMatch && videoTitleMatch) {
      const vId = videoIdMatch[1].trim();
      const vTitle = decodeXmlEntities(videoTitleMatch[1]);
      chapters.push({
        id: `yt-ch-${vId}-${chapterIndex}`,
        number: chapterIndex,
        title: vTitle,
        duration: 0,
        durationFormatted: 'פרק וידאו',
        youtubeId: vId,
      });
      chapterIndex++;
    }
  }

  const firstVideoId = chapters[0]?.youtubeId;
  const coverUrl = firstVideoId
    ? `https://img.youtube.com/vi/${firstVideoId}/hqdefault.jpg`
    : fallbackThumbnail;

  return {
    playlistId,
    title: playlistTitle,
    author: playlistAuthor,
    thumbnailUrl: coverUrl,
    chapters,
  };
}

export async function fetchYouTubeMetadata(videoId: string): Promise<YouTubeMetadata> {
  const fallbackThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  try {
    const response = await fetch(
      `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`
    );
    if (response.ok) {
      const data = await response.json();
      if (data && data.title) {
        return {
          title: data.title,
          author: data.author_name || 'יוטיוב',
          thumbnailUrl: data.thumbnail_url || fallbackThumbnail,
        };
      }
    }
  } catch (err) {
    console.warn('Could not fetch oEmbed metadata:', err);
  }

  return {
    title: `סרטון יוטיוב #${videoId}`,
    author: 'יוטיוב שמע',
    thumbnailUrl: fallbackThumbnail,
  };
}
