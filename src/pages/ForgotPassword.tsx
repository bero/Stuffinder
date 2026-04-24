import { useState } from 'preact/hooks';
import { requestPasswordReset } from '../lib/auth';
import { useT } from '../lib/i18n';
import { LanguagePicker } from '../components/LanguagePicker';

export function ForgotPassword() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!email) return;
    try {
      setSubmitting(true);
      setError(null);
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.forgot.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-6">
      <LanguagePicker />
      <div class="w-full max-w-sm space-y-6">
        <header class="text-center">
          <h1 class="text-3xl font-bold text-slate-100">{t('auth.forgot.title')}</h1>
          <p class="text-slate-400 mt-1">{t('auth.forgot.subtitle')}</p>
        </header>

        {sent ? (
          <div class="bg-slate-800 border border-slate-700 text-slate-200 px-4 py-3 rounded-lg text-sm text-center">
            {t('auth.forgot.sent')}
          </div>
        ) : (
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

            {error && (
              <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !email}
              class="btn-primary w-full py-3"
            >
              {submitting ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
            </button>
          </form>
        )}

        <p class="text-center text-slate-400 text-sm">
          <a href="/login" class="text-primary-400 hover:text-primary-300">{t('auth.forgot.back')}</a>
        </p>
      </div>
    </div>
  );
}
