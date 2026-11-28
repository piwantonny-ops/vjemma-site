import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { setSwRegistration } from './cacheSync.ts';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected application error.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#050507] p-6 text-center text-white">
          <div className="max-w-md rounded-2xl border-2 border-[#d4af37] bg-[#111018] p-6 shadow-2xl">
            <h1 className="font-display text-lg font-extrabold text-[#f0cf65]">
              VJ EMMA — Unable to Display Page
            </h1>
            <p className="mt-2 text-xs text-white/80">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 min-h-[42px] w-full rounded-lg bg-gradient-to-br from-[#d4af37] to-[#b58d1e] px-4 py-2 text-xs font-extrabold text-black"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if (typeof window !== 'undefined') {
  if (import.meta.env.PROD) {
    try {
      registerSW({
        immediate: true,
        onRegisteredSW(_swUrl, reg) {
          setSwRegistration(reg);
        },
      });
    } catch {
      // Non-fatal
    }
  } else if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => undefined);
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
