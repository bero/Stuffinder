import { Component, ComponentChildren } from 'preact';
import { t } from '../lib/i18n';

interface Props {
  children: ComponentChildren;
}

interface State {
  err: Error | null;
}

// Preact (like React) calls componentDidCatch when a descendant throws during
// render. We capture the error, render a friendly fallback, and let the user
// reload. Without this, any render-phase throw white-screens the whole app.
//
// What this does NOT catch:
//   - Errors thrown inside event handlers (they bubble to window.onerror).
//   - Errors inside async code (unhandled promise rejections).
//   - Errors inside this boundary itself — the fallback is deliberately
//     minimal and only uses the translation layer (no DB / no network).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  componentDidCatch(err: Error) {
    console.error('ErrorBoundary caught:', err);
    this.setState({ err });
  }

  render() {
    const err = this.state.err;
    if (!err) return this.props.children;

    return (
      <div class="min-h-screen flex items-center justify-center p-6 safe-top safe-bottom">
        <div class="max-w-sm w-full space-y-4 text-center">
          <div class="text-6xl">⚠️</div>
          <h1 class="text-xl font-bold text-slate-100">{t('common.errorTitle')}</h1>
          <p class="text-slate-400">{t('common.errorBody')}</p>

          <details class="text-left bg-slate-800 border border-slate-700 rounded-lg p-3">
            <summary class="cursor-pointer text-sm text-slate-300">
              {t('common.errorDetails')}
            </summary>
            <pre class="mt-2 text-xs text-slate-400 whitespace-pre-wrap break-words overflow-auto max-h-60">
              {err.name}: {err.message}
              {err.stack ? '\n\n' + err.stack : ''}
            </pre>
          </details>

          <button
            onClick={() => window.location.reload()}
            class="btn-primary w-full py-3"
          >
            {t('common.errorReload')}
          </button>
        </div>
      </div>
    );
  }
}
