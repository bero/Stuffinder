import { useState, useEffect } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';
import { useT } from '../lib/i18n';

export function UpdatePrompt() {
  const t = useT();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updater, setUpdater] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
    });
    setUpdater(() => updateSW);
  }, []);

  if (!needRefresh) return null;

  async function handleUpdate() {
    if (!updater) return;
    await updater(true);
  }

  return (
    <div class="fixed bottom-20 left-4 right-4 z-50 bg-slate-800 border border-primary-500 rounded-xl shadow-xl p-4 max-w-md mx-auto">
      <h3 class="font-semibold text-slate-100">{t('pwa.updateTitle')}</h3>
      <p class="text-sm text-slate-400 mt-1">{t('pwa.updateBody')}</p>
      <div class="flex gap-2 mt-3">
        <button
          onClick={() => setNeedRefresh(false)}
          class="btn-secondary flex-1 py-2 text-sm"
        >
          {t('pwa.updateDismiss')}
        </button>
        <button
          onClick={handleUpdate}
          class="btn-primary flex-1 py-2 text-sm"
        >
          {t('pwa.updateAction')}
        </button>
      </div>
    </div>
  );
}
