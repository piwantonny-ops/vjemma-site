let swRegistrationRef: ServiceWorkerRegistration | undefined;

export function setSwRegistration(reg: ServiceWorkerRegistration | undefined): void {
  swRegistrationRef = reg;
}

export async function clearOldCachesAndCheckUpdates(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheKeys = await window.caches.keys();
      await Promise.all(
        cacheKeys.map((key) => {
          if (!key.startsWith('workbox-precache-v2')) {
            return window.caches.delete(key);
          }
          return Promise.resolve(false);
        })
      );
    }
  } catch {
    // Ignore Cache Storage restrictions
  }

  try {
    if (swRegistrationRef) {
      await swRegistrationRef.update();
    } else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        swRegistrationRef = reg;
        await reg.update();
      }
    }
  } catch {
    // Ignore offline SW check errors
  }
}
