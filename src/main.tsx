import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { setSwRegistration } from './cacheSync.ts';
import './index.css';

if (typeof window !== 'undefined') {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      setSwRegistration(reg);
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
