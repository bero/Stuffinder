import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { supabase } from '../lib/supabase';
import { updatePassword } from '../lib/auth';
import { useT } from '../lib/i18n';
import { LanguagePicker } from '../components/LanguagePicker';

type Phase = 'exchanging' | 'ready' | 'submitting' | 'done' | 'invalid';

export function ResetPassword() {
  const t = useT();
  const [phase, setPhase] = useState<Phase>('exchanging');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errDesc = params.get('error_description');

    if (errDesc) {
      setError(errDesc);
      setPhase('invalid');
      return;
    }

    // If no code, we may already have a session (remount after exchange) — go straight to the form.
    if (!code) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setPhase('ready');
        else setPhase('invalid');
      });
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message);
        setPhase('invalid');
      } else {
        window.history.replaceState({}, '', '/auth/reset');
        setPhase('ready');
      }
    });
  }, []);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (password.length < 8) {
      setError(t('auth.signup.passwordTooShort'));
      return;
    }
    try {
      setPhase('submitting');
      setError(null);
      await updatePassword(password);
      setPhase('done');
      setTimeout(() => route('/', true), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.reset.failed'));
      setPhase('ready');
    }
  }

  if (phase === 'exchanging') {
    return (
      <div class="min-h-screen flex items-center justify-center p-6">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (phase === 'invalid') {
    return (
      <div class="min-h-screen flex items-center justify-center p-6">
        <div class="max-w-sm text-center space-y-4">
          <p class="text-red-300">{error || t('auth.reset.invalidLink')}</p>
          <a href="/forgot-password" class="text-primary-400 hover:text-primary-300 underline">
            {t('auth.forgot.title')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-6">
      <LanguagePicker />
      <div class="w-full max-w-sm space-y-6">
        <header class="text-center">
          <h1 class="text-3xl font-bold text-slate-100">{t('auth.reset.title')}</h1>
          <p class="text-slate-400 mt-1">{t('auth.reset.subtitle')}</p>
        </header>

        {phase === 'done' ? (
          <div class="bg-slate-800 border border-slate-700 text-slate-200 px-4 py-3 rounded-lg text-sm text-center">
            {t('auth.reset.success')}
          </div>
        ) : (
          <form onSubmit={handleSubmit} class="space-y-4">
            <div>
              <label class="input-label" for="password">{t('auth.reset.newPassword')}</label>
              <input
                id="password"
                type="password"
                value={password}
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                class="input"
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p class="text-xs text-slate-500 mt-1">{t('auth.signup.passwordHint')}</p>
            </div>

            {error && (
              <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={phase === 'submitting' || !password}
              class="btn-primary w-full py-3"
            >
              {phase === 'submitting' ? t('auth.reset.submitting') : t('auth.reset.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
