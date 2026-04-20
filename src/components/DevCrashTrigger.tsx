import { useEffect, useState } from 'preact/hooks';

// Dev-only helper. Two ways to trigger a render-phase throw:
//   - Press Ctrl+Shift+E (or Cmd+Shift+E on macOS).
//   - Visit any URL with ?crash=1
// Use it to verify the ErrorBoundary fallback. Tree-shaken out of production
// builds via the import.meta.env.DEV guard at the call site.
export function DevCrashTrigger() {
  const [crash, setCrash] = useState<string | null>(null);

  // URL trigger: works on any device, including phones.
  useEffect(() => {
    if (typeof location !== 'undefined' && new URL(location.href).searchParams.has('crash')) {
      setCrash('Test crash via ?crash=1');
    }
  }, []);

  // Keyboard trigger: convenient on desktop.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        setCrash('Test crash via Ctrl+Shift+E');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (crash) {
    throw new Error(crash);
  }
  return null;
}
