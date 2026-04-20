import { render } from 'preact';
import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DevCrashTrigger } from './components/DevCrashTrigger';
import { t } from './lib/i18n';
import './index.css';

// Load a small font so flag emojis render correctly on Windows too.
polyfillCountryFlagEmojis();

// Translate the browser's native form-validation messages. The invalid event
// doesn't bubble, so we listen in the capture phase at document level to catch
// every form in the app with one listener.
type ValidatableEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function isValidatable(el: EventTarget | null): el is ValidatableEl {
  return (
    !!el &&
    typeof (el as any).setCustomValidity === 'function' &&
    'validity' in (el as any)
  );
}

document.addEventListener(
  'invalid',
  (e) => {
    const el = e.target;
    if (!isValidatable(el)) return;
    if (el.validity.valueMissing) {
      el.setCustomValidity(t('common.requiredField'));
    } else if (el.validity.typeMismatch && (el as HTMLInputElement).type === 'email') {
      el.setCustomValidity(t('common.invalidEmail'));
    }
  },
  true, // capture phase — invalid doesn't bubble
);

// Clear the custom message the moment the user fixes the input so browsers
// don't keep showing the old tooltip.
document.addEventListener(
  'input',
  (e) => {
    const el = e.target;
    if (isValidatable(el)) el.setCustomValidity('');
  },
  true,
);

render(
  <ErrorBoundary>
    {import.meta.env.DEV && <DevCrashTrigger />}
    <App />
  </ErrorBoundary>,
  document.getElementById('app')!,
);
