import { useState } from 'preact/hooks';
import { createHousehold, acceptInvite } from '../lib/api';

function errMsg(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as any).message === 'string') {
    return (e as any).message;
  }
  return fallback;
}

interface Props {
  onDone: () => void;
}

type Mode = 'choose' | 'create' | 'join';

export function Onboarding({ onDone }: Props) {
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
      setError(errMsg(err, 'Failed to create household'));
      console.error('createHousehold error', err);
    } finally {
      setSubmitting(false);
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
      setError(errMsg(err, 'Failed to join household'));
      console.error('acceptInvite error', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="min-h-screen flex items-center justify-center p-6">
      <div class="w-full max-w-sm space-y-6">
        <header class="text-center">
          <h1 class="text-3xl font-bold text-slate-100">Welcome</h1>
          <p class="text-slate-400 mt-1">Get started with a household</p>
        </header>

        {mode === 'choose' && (
          <div class="space-y-3">
            <button onClick={() => setMode('create')} class="btn-primary w-full py-4">
              Create a household
            </button>
            <button onClick={() => setMode('join')} class="btn-secondary w-full py-4">
              Join with an invite code
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} class="space-y-4">
            <div>
              <label class="input-label" for="name">Household name</label>
              <input
                id="name"
                type="text"
                value={name}
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                placeholder="e.g. Home"
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
                Back
              </button>
              <button type="submit" disabled={submitting || !name.trim()} class="btn-primary flex-1">
                {submitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} class="space-y-4">
            <div>
              <label class="input-label" for="code">Invite code</label>
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
                Back
              </button>
              <button type="submit" disabled={submitting || !code.trim()} class="btn-primary flex-1">
                {submitting ? 'Joining…' : 'Join'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
