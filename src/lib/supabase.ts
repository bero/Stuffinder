import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

export function clearPhotoUrlCache() {
  urlCache.clear();
}
