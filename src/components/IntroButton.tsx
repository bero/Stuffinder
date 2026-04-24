import { useState } from 'preact/hooks';
import { useT } from '../lib/i18n';
import { IntroModal } from './IntroModal';

// Small ℹ️ button that opens the intro modal. Drop it anywhere (next to a
// page title) and it handles its own modal state.
export function IntroButton() {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        class="text-2xl leading-none hover:scale-110 active:scale-95 transition-transform"
        aria-label={t('intro.button')}
        title={t('intro.button')}
      >
        ℹ️
      </button>
      {open && <IntroModal onClose={() => setOpen(false)} />}
    </>
  );
}
