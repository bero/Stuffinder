import { route } from 'preact-router';
import { useT } from '../lib/i18n';

// Simple icon components
function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg class={`w-6 h-6 ${active ? 'text-primary-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function PlusIcon({ active }: { active: boolean }) {
  return (
    <svg class={`w-7 h-7 ${active ? 'text-primary-400' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg class={`w-6 h-6 ${active ? 'text-primary-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function NavBar() {
  const t = useT();
  // Get current path
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  return (
    <nav class="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 safe-bottom">
      <div class="flex items-center justify-around h-16 max-w-lg mx-auto">
        {/* Home */}
        <button 
          onClick={() => route('/')}
          class="flex flex-col items-center justify-center w-16 h-full focus:outline-none"
        >
          <HomeIcon active={currentPath === '/'} />
          <span class={`text-xs mt-1 ${currentPath === '/' ? 'text-primary-400' : 'text-slate-400'}`}>
            {t('nav.home')}
          </span>
        </button>
        
        {/* Add (center, prominent) */}
        <button 
          onClick={() => route('/add')}
          class="flex items-center justify-center w-14 h-14 -mt-4 bg-primary-600 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-slate-800 active:bg-primary-700 transition-colors"
        >
          <PlusIcon active={false} />
        </button>
        
        {/* Settings */}
        <button 
          onClick={() => route('/settings')}
          class="flex flex-col items-center justify-center w-16 h-full focus:outline-none"
        >
          <SettingsIcon active={currentPath === '/settings'} />
          <span class={`text-xs mt-1 ${currentPath === '/settings' ? 'text-primary-400' : 'text-slate-400'}`}>
            {t('nav.settings')}
          </span>
        </button>
      </div>
    </nav>
  );
}
