import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce' },
});

// Photos are in a private bucket; we serve them via time-limited signed URLs.
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const urlCache = new Map<string, { url: string; expiresAt: number }>();

export async function getPhotoUrl(photoPath: string | null): Promise<string | null> {
  if (!photoPath) return null;

  const cached = urlCache.get(photoPath);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(photoPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.error('Failed to sign photo URL', error);
    return null;
  }

  urlCache.set(photoPath, {
    url: data.signedUrl,
    expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

// Sign many paths in a single request. Returns a map of path → url.
// Cached entries are returned without a network call.
export async function prefetchPhotoUrls(
  paths: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const toFetch: string[] = [];

  for (const p of paths) {
    if (!p) continue;
    const cached = urlCache.get(p);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      result.set(p, cached.url);
    } else if (!toFetch.includes(p)) {
      toFetch.push(p);
    }
  }

  if (toFetch.length === 0) return result;

  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrls(toFetch, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.error('Batch sign failed', error);
    return result;
  }

  const now = Date.now();
  for (const item of data) {
    if (item.signedUrl && item.path) {
      urlCache.set(item.path, {
        url: item.signedUrl,
        expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
      });
      result.set(item.path, item.signedUrl);
    }
  }

  return result;
}

export function clearPhotoUrlCache() {
  urlCache.clear();
}
