export function extractYouTubeId(url: string): string | null {
  const match = url.match(/[?&]v=([^&#]+)/);
  return match?.[1] ?? null;
}

export const YOUTUBE_ERROR_CODES = {
  VIDEO_NOT_FOUND: 100,
  EMBED_NOT_ALLOWED: 101,
  EMBED_NOT_ALLOWED_ALT: 150,
} as const;
