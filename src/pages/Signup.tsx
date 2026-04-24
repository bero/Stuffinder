import { useState } from 'preact/hooks';
import { route } from 'preact-router';
import { signUp, resendConfirmation } from '../lib/auth';
import { useT } from '../lib/i18n';
import { LanguagePicker } from '../components/LanguagePicker';
import { IntroButton } from '../components/IntroButton';

export function Signup() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [resending, setResending] = useState(false);

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
      setAwaitingConfirmation(false);
      const data = await signUp(email, password);
      if (data.session) {
        route('/', true);
      } else {
        setMessage(t('auth.signup.checkEmail'));
        setAwaitingConfirmation(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signup.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!email || resending) return;
    try {
      setResending(true);
      setError(null);
      await resendConfirmation(email);
      setMessage(t('auth.signup.resendSent'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.signup.failed'));
    } finally {
      setResending(false);
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-6">
      <LanguagePicker />
      <div class="w-full max-w-sm space-y-6">
        <header class="text-center">
          <div class="flex items-center justify-center gap-2">
            <h1 class="text-3xl font-bold text-slate-100">{t('auth.signup.title')}</h1>
            <IntroButton />
          </div>
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

          {awaitingConfirmation && (
            <div class="text-center text-sm text-slate-400">
              <span>{t('auth.signup.resendPrompt')}</span>{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                class="text-primary-400 hover:text-primary-300 underline disabled:opacity-50"
              >
                {resending ? t('auth.signup.creating') : t('auth.signup.resend')}
              </button>
            </div>
          )}
        </form>

        <p class="text-center text-slate-400 text-sm">
          {t('auth.signup.haveAccount')}{' '}
          <a href="/login" class="text-primary-400 hover:text-primary-300">{t('auth.signIn')}</a>
        </p>
      </div>
    </div>
  );
}
