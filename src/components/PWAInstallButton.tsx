import React, { useState } from 'react';
import { Download, Monitor, Share, Smartphone, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'card' | 'compact';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'card' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#d4af37] bg-gradient-to-r from-[#6a0dad] to-[#4a077a] px-4 py-2 text-xs font-extrabold text-[#f0cf65] shadow transition-transform active:scale-95"
        >
          <Download className="h-4 w-4" />
          <span>{isIOS ? 'Install on iPhone' : 'Install App'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#d4af37] via-[#f0cf65] to-[#d4af37] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-black shadow transition-transform active:scale-[0.98]"
        >
          <Download className="h-4 w-4" />
          <span>
            {isInstallable
              ? 'Install App Now'
              : isIOS
              ? 'Install on iPhone / iPad'
              : 'Install App (Phone / PC / iPhone)'}
          </span>
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border-2 border-[#d4af37] bg-[#110e1a] p-5 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-[#6a0dad]/60 pb-2.5">
              <h3 className="font-display text-base font-extrabold text-[#f0cf65]">
                Install VJ EMMA App
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white hover:border-[#d4af37]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-white/90">
              <div className="rounded-xl border border-[#6a0dad]/60 bg-[#09070f] p-3">
                <div className="mb-1 flex items-center gap-2 font-extrabold text-[#d4af37]">
                  <Share className="h-4 w-4" />
                  <span>iPhone / iPad (Safari)</span>
                </div>
                <p>
                  1. Open this site in <strong>Safari</strong>.<br />
                  2. Tap the <strong>Share</strong> icon at the bottom or top bar.<br />
                  3. Scroll down and tap <strong>Add to Home Screen</strong>, then tap{' '}
                  <strong>Add</strong>.
                </p>
              </div>

              <div className="rounded-xl border border-[#6a0dad]/60 bg-[#09070f] p-3">
                <div className="mb-1 flex items-center gap-2 font-extrabold text-[#d4af37]">
                  <Smartphone className="h-4 w-4" />
                  <span>Android Smartphones (Chrome / Edge)</span>
                </div>
                <p>
                  1. Tap the <strong>3-dot menu (⋮)</strong> in your browser.<br />
                  2. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                </p>
              </div>

              <div className="rounded-xl border border-[#6a0dad]/60 bg-[#09070f] p-3">
                <div className="mb-1 flex items-center gap-2 font-extrabold text-[#d4af37]">
                  <Monitor className="h-4 w-4" />
                  <span>Computers (Windows / Mac Chrome or Edge)</span>
                </div>
                <p>
                  Click the <strong>Install icon</strong> on the right side of the browser address bar
                  (or open Menu → <strong>Install VJ EMMA</strong>).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 min-h-[42px] w-full rounded-lg bg-gradient-to-r from-[#6a0dad] to-[#4a077a] border border-[#d4af37] py-2 text-xs font-extrabold text-white"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-[72px] left-4 z-[1300] flex items-center gap-2 rounded-lg border border-[#d4af37] bg-[#6a0dad] px-3 py-1.5 text-xs font-bold text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-[#f0cf65] animate-pulse" />
      <span>Offline Mode — Cached app data active</span>
    </div>
  );
};
