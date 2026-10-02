import type { Book, Bookmark } from '../types';

// Versioned backup envelope. `app` accepts the legacy 'audiolook' brand so
// backups exported before the Lyra rebrand still restore.
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupSettings {
  playbackSpeed: number;
  audioSoundEnabled: boolean;
}

export interface LyraBackup {
  app: 'lyra' | 'audiolook';
  schema: number;
  exportedAt: string;
  books: Book[];
  bookmarks: Bookmark[];
  settings: BackupSettings;
}

export interface ParsedBackup {
  backup: LyraBackup;
  booksSkipped: number;
  bookmarksSkipped: number;
}

export type ImportMode = 'merge' | 'replace';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function sanitizeBook(raw: unknown): Book | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (typeof raw.title !== 'string') return null;
  return raw as unknown as Book;
}

function sanitizeBookmark(raw: unknown): Bookmark | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (typeof raw.bookId !== 'string' || raw.bookId.length === 0) return null;
  if (typeof raw.timestampSeconds !== 'number' || Number.isNaN(raw.timestampSeconds)) return null;
  return raw as unknown as Bookmark;
}

export function buildBackup(args: {
  books: Book[];
  bookmarks: Bookmark[];
  settings: BackupSettings;
}): LyraBackup {
  return {
    app: 'lyra',
    schema: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    books: args.books,
    bookmarks: args.bookmarks,
    settings: args.settings,
  };
}

export function downloadBackup(backup: LyraBackup): void {
  const day = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `lyra-backup-${day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke on a tick so Android Chrome finishes the download first.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Parse + validate raw file text. Never throws — returns a Hebrew error. */
export function parseBackupText(text: string): { ok: true; parsed: ParsedBackup } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'קובץ הגיבוי פגום או אינו קובץ JSON תקין' };
  }
  if (!isRecord(raw)) {
    return { ok: false, error: 'קובץ הגיבוי אינו תקין' };
  }
  if (raw.app !== 'lyra' && raw.app !== 'audiolook') {
    return { ok: false, error: 'זה אינו קובץ גיבוי של Lyra' };
  }
  if (raw.schema !== BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: 'גרסת הגיבוי אינה נתמכת בגרסה זו של האפליקציה' };
  }
  if (!Array.isArray(raw.books) || !Array.isArray(raw.bookmarks)) {
    return { ok: false, error: 'קובץ הגיבוי חסר נתוני ספרייה' };
  }

  const books: Book[] = [];
  let booksSkipped = 0;
  for (const b of raw.books) {
    const clean = sanitizeBook(b);
    if (clean) books.push(clean);
    else booksSkipped += 1;
  }
  const bookmarks: Bookmark[] = [];
  let bookmarksSkipped = 0;
  for (const bm of raw.bookmarks) {
    const clean = sanitizeBookmark(bm);
    if (clean) bookmarks.push(clean);
    else bookmarksSkipped += 1;
  }

  let settings: BackupSettings = { playbackSpeed: 1, audioSoundEnabled: true };
  if (isRecord(raw.settings)) {
    const speed = typeof raw.settings.playbackSpeed === 'number' ? raw.settings.playbackSpeed : 1;
    settings = {
      playbackSpeed: [0.75, 1, 1.25, 1.5, 1.75, 2].includes(speed) ? speed : 1,
      audioSoundEnabled: raw.settings.audioSoundEnabled !== false,
    };
  }

  const exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date(0).toISOString();
  return {
    ok: true,
    parsed: { backup: { app: 'lyra', schema: BACKUP_SCHEMA_VERSION, exportedAt, books, bookmarks, settings }, booksSkipped, bookmarksSkipped },
  };
}

/** Newer progress wins: latest listen first, then furthest position. */
function isNewerProgress(a: Book, b: Book): boolean {
  const aHeard = a.lastListenedAt ?? '';
  const bHeard = b.lastListenedAt ?? '';
  if (aHeard !== bHeard) return aHeard > bHeard;
  return (a.currentTimeSeconds ?? 0) > (b.currentTimeSeconds ?? 0);
}

/** Merge: upsert by id (newest progress wins), brand-new ids appended. */
export function mergeBooks(current: Book[], incoming: Book[]): Book[] {
  const merged = new Map<string, Book>(current.map((b) => [b.id, b]));
  for (const inBook of incoming) {
    const existing = merged.get(inBook.id);
    if (!existing || isNewerProgress(inBook, existing)) merged.set(inBook.id, inBook);
  }
  return [...merged.values()];
}

/** Union by id — current first, then genuinely new bookmarks. */
export function mergeBookmarks(current: Bookmark[], incoming: Bookmark[]): Bookmark[] {
  const ids = new Set(current.map((bm) => bm.id));
  const extra = incoming.filter((bm) => !ids.has(bm.id));
  return extra.length === 0 ? current : [...current, ...extra];
}
