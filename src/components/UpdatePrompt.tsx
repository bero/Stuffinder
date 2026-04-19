import { useState, useEffect } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { useT } from '../lib/i18n';

export function UpdatePrompt() {
  const t = useT();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updater, setUpdater] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });
    setUpdater(() => updateSW);

    // Reload as soon as the new service worker takes control. This is more
    // reliable on iOS Safari than the library's built-in reload, which can
    // race with the SW activation and land the page on a half-swapped cache.
    if ('serviceWorker' in navigator) {
      let reloaded = false;
      const onControllerChange = () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      };
    }
  }, []);

  if (!needRefresh) return null;

  async function handleUpdate() {
    if (!updater || updating) return;
    setUpdating(true);
    try {
      // Tell the waiting SW to skip; the controllerchange listener above
      // reloads the page once the new worker actually takes over.
      await updater(false);
    } catch (err) {
      console.error('SW update failed', err);
    }
    // Safety net: if controllerchange never fires (SW bug / no SW), force a
    // hard reload after a short delay so the user isn't stuck.
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  }

  return (
    <div class="fixed bottom-20 left-4 right-4 z-50 bg-slate-800 border border-primary-500 rounded-xl shadow-xl p-4 max-w-md mx-auto">
      <h3 class="font-semibold text-slate-100">{t('pwa.updateTitle')}</h3>
      <p class="text-sm text-slate-400 mt-1">{t('pwa.updateBody')}</p>
      <div class="flex gap-2 mt-3">
        <button
          onClick={() => setNeedRefresh(false)}
          class="btn-secondary flex-1 py-2 text-sm"
          disabled={updating}
        >
          {t('pwa.updateDismiss')}
        </button>
        <button
          onClick={handleUpdate}
          class="btn-primary flex-1 py-2 text-sm"
          disabled={updating}
        >
          {updating ? '…' : t('pwa.updateAction')}
        </button>
      </div>
    </div>
  );
}
