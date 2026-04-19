import { useState, useEffect, useRef } from 'preact/hooks';

// Curated set covering common inventory categories and rooms.
const EMOJIS = [
  '🔧', '🔨', '🪛', '🧰', '🔑', '💡', '🔌', '🪜',
  '💻', '📱', '⌚', '🎮', '📸', '📺', '🎧', '🔋',
  '📄', '📚', '📝', '✏️', '📎', '📐', '📁', '🗞️',
  '👕', '👔', '👖', '👟', '👜', '🎒', '🧢', '🧤',
  '🍳', '🍽️', '☕', '🧊', '🥤', '🥫', '🧂', '🪴',
  '⚽', '🎾', '🏀', '🎵', '🎸', '🎨', '🎯', '🧸',
  '🏠', '🛏️', '🛋️', '🚿', '🛁', '🪑', '🏚️', '🗄️',
  '📦', '📍', '🎁', '⭐', '💊', '🧴', '🚗', '❤️',
];

interface Props {
  value: string;
  onChange: (emoji: string) => void;
  placeholder?: string;
}

export function EmojiPicker({ value, onChange, placeholder = '📦' }: Props) {
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

  return (
    <div ref={ref} class="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        class="input w-16 h-12 text-center text-2xl leading-none p-0"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {value || placeholder}
      </button>

      {open && (
        <div
          class="absolute z-50 top-full mt-1 left-0 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 grid grid-cols-8 gap-1 w-80 max-w-[90vw]"
          role="listbox"
        >
          {EMOJIS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => { onChange(e); setOpen(false); }}
              class={`w-9 h-9 text-xl rounded flex items-center justify-center hover:bg-slate-700 ${
                e === value ? 'bg-slate-700 ring-1 ring-primary-500' : ''
              }`}
              role="option"
              aria-selected={e === value}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
