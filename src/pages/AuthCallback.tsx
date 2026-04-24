import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { supabase } from '../lib/supabase';

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errDesc = params.get('error_description');

    if (errDesc) {
      setError(errDesc);
      return;
    }
    if (!code) {
      route('/', true);
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message);
      } else {
        route('/', true);
      }
    });
  }, []);

  return (
    <div class="min-h-screen flex items-center justify-center p-6">
      {error ? (
        <div class="max-w-sm text-center space-y-4">
          <p class="text-red-300">{error}</p>
          <a href="/login" class="text-primary-400 hover:text-primary-300 underline">
            Back to sign in
          </a>
        </div>
      ) : (
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      )}
    </div>
  );
}
