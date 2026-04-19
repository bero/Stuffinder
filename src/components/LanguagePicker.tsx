import { useState, useEffect, useRef } from 'preact/hooks';
import { LOCALES, useLocale, setLocale, useT } from '../lib/i18n';

// The polyfill installs a font family "Twemoji Country Flags" — applying it
// here guarantees flag emojis render as flags on every OS (Windows included).
const FLAG_FONT_STYLE = { fontFamily: '"Twemoji Country Flags", sans-serif' };

export function LanguagePicker() {
  const locale = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = LOCALES.find(l => l.code === locale) || LOCALES[0];

  return (
    <div ref={ref} class="fixed top-2 right-2 z-50 safe-top">
      <button
        onClick={() => setOpen(v => !v)}
        class="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-800/80 backdrop-blur border border-slate-700 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
        aria-label={t('lang.picker')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span class="text-2xl leading-none" style={FLAG_FONT_STYLE}>{current.flag}</span>
        <span class="text-base font-medium text-slate-100">{current.name}</span>
        <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          class="absolute right-0 mt-1 min-w-[12rem] bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1"
          role="listbox"
        >
          {LOCALES.map(l => (
            <li key={l.code}>
              <button
                onClick={() => { setLocale(l.code); setOpen(false); }}
                class={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700 ${
                  l.code === locale ? 'text-primary-300' : 'text-slate-200'
                }`}
                role="option"
                aria-selected={l.code === locale}
              >
                <span class="text-2xl leading-none" style={FLAG_FONT_STYLE}>{l.flag}</span>
                <span class="text-base font-medium">{l.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
