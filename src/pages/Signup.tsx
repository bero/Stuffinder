import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { signUp, signIn } from '../lib/auth';
import { useT } from '../lib/i18n';

export function Signup() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!email || !password) return;
    if (password.length < 8) {
      setError(t('auth.signup.passwordTooShort'));
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      setMessage(null);
      await signUp(email, password);
      try {
        await signIn(email, password);
        route('/', true);
      } catch {
        setMessage(t('auth.signup.checkEmail'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signup.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="w-full max-w-sm space-y-6">
        <header class="text-center">
          <h1 class="text-3xl font-bold text-slate-100">{t('auth.signup.title')}</h1>
          <p class="text-slate-400 mt-1">{t('auth.signup.subtitle')}</p>
        </header>

        <form onSubmit={handleSubmit} class="space-y-4">
          <div>
            <label class="input-label" for="email">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              class="input"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label class="input-label" for="password">{t('auth.password')}</label>
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
          {message && (
            <div class="bg-slate-800 border border-slate-700 text-slate-200 px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !email || !password}
            class="btn-primary w-full py-3"
          >
            {submitting ? t('auth.signup.creating') : t('auth.signup.create')}
          </button>
        </form>

        <p class="text-center text-slate-400 text-sm">
          {t('auth.signup.haveAccount')}{' '}
          <a href="/login" class="text-primary-400 hover:text-primary-300">{t('auth.signIn')}</a>
        </p>
      </div>
    </div>
  );
}
