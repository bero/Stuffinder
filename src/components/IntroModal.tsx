import { useT } from '../lib/i18n';

interface Props {
  onClose: () => void;
}

export function IntroModal({ onClose }: Props) {
  const t = useT();

  return (
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div class="bg-slate-800 rounded-xl p-6 max-w-md w-full space-y-5 my-8">
        <h2 class="text-2xl font-bold text-slate-100">{t('intro.title')}</h2>

        <p class="text-slate-300">{t('intro.pitch')}</p>

        <div>
          <h3 class="text-sm font-semibold text-slate-200 mb-2">{t('intro.conceptsTitle')}</h3>
          <ul class="space-y-2 text-sm text-slate-300">
            <li class="flex gap-2"><span>📦</span><span>{t('intro.concept.item')}</span></li>
            <li class="flex gap-2"><span>📍</span><span>{t('intro.concept.location')}</span></li>
            <li class="flex gap-2"><span>🏷️</span><span>{t('intro.concept.category')}</span></li>
            <li class="flex gap-2"><span>🔖</span><span>{t('intro.concept.tag')}</span></li>
            <li class="flex gap-2"><span>🏠</span><span>{t('intro.concept.household')}</span></li>
          </ul>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-slate-200 mb-2">{t('intro.quickstartTitle')}</h3>
          <ol class="space-y-2 text-sm text-slate-300 list-decimal list-inside">
            <li>{t('intro.quickstart.1')}</li>
            <li>{t('intro.quickstart.2')}</li>
            <li>{t('intro.quickstart.3')}</li>
          </ol>
        </div>

        <button onClick={onClose} class="btn-primary w-full py-3">
          {t('intro.close')}
        </button>
      </div>
    </div>
  );
}
