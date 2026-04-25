import { useState } from 'preact/hooks';
import { createHousehold, acceptInvite } from '../lib/api';
import { signOut } from '../lib/auth';
import { useT } from '../lib/i18n';
import { LanguagePicker } from '../components/LanguagePicker';
import { IntroButton } from '../components/IntroButton';

function errMsg(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
    return (e as any).message;
  }
  return fallback;
}

interface Props {
  onDone: () => void;
  session: import('@supabase/supabase-js').Session;
}

type Mode = 'choose' | 'create' | 'join';

export function Onboarding({ onDone, session }: Props) {
  const email = session.user.email;
  const t = useT();
  const [mode, setMode] = useState<Mode>('choose');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      await createHousehold(name.trim());
      onDone();
    } catch (err) {
      setError(errMsg(err, t('onboarding.createFailed')));
      console.error('createHousehold error', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  }

  async function handleJoin(e: Event) {
    e.preventDefault();
    if (!code.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      await acceptInvite(code.trim().toUpperCase());
      onDone();
    } catch (err) {
      setError(errMsg(err, t('onboarding.joinFailed')));
      console.error('acceptInvite error', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-6">
      <LanguagePicker />
      <div class="w-full max-w-sm space-y-6">
        <header class="text-center">
          <div class="flex items-center justify-center gap-2">
            <h1 class="text-3xl font-bold text-slate-100">{t('onboarding.welcome')}</h1>
            <IntroButton />
          </div>
          <p class="text-slate-400 mt-1">{t('onboarding.subtitle')}</p>
        </header>

        {mode === 'choose' && (
          <div class="space-y-3">
            <button onClick={() => setMode('create')} class="btn-primary w-full py-4">
              {t('onboarding.createOption')}
            </button>
            <button onClick={() => setMode('join')} class="btn-secondary w-full py-4">
              {t('onboarding.joinOption')}
            </button>
            <div class="text-center pt-4 space-y-2">
              <button
                type="button"
                onClick={handleSignOut}
                class="text-sm text-slate-400 hover:text-slate-200 underline"
              >
                {t('settings.signOut')}
              </button>
              {email && (
                <p class="text-base text-slate-200 font-medium break-all">{email}</p>
              )}
            </div>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} class="space-y-4">
            <div>
              <label class="input-label" for="name">{t('onboarding.householdName')}</label>
              <input
                id="name"
                type="text"
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder={t('onboarding.householdPlaceholder')}
                class="input"
                required
              />
            </div>
            {error && (
              <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div class="flex gap-3">
              <button type="button" onClick={() => { setMode('choose'); setError(null); }} class="btn-secondary flex-1" disabled={submitting}>
                {t('common.back')}
              </button>
              <button type="submit" disabled={submitting || !name.trim()} class="btn-primary flex-1">
                {submitting ? t('onboarding.creating') : t('onboarding.create')}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} class="space-y-4">
            <div>
              <label class="input-label" for="code">{t('onboarding.inviteCode')}</label>
              <input
                id="code"
                type="text"
                value={code}
                onInput={(e) => setCode((e.target as HTMLInputElement).value.toUpperCase())}
                placeholder="ABCDEFGH"
                class="input tracking-widest text-center font-mono uppercase"
                maxLength={8}
                required
              />
            </div>
            {error && (
              <div class="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div class="flex gap-3">
              <button type="button" onClick={() => { setMode('choose'); setError(null); }} class="btn-secondary flex-1" disabled={submitting}>
                {t('common.back')}
              </button>
              <button type="submit" disabled={submitting || !code.trim()} class="btn-primary flex-1">
                {submitting ? t('onboarding.joining') : t('onboarding.join')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
