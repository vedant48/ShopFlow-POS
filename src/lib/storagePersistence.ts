/**
 * Storage Persistence Helper for ShopFlow PWA
 * Requests persistent storage to prevent Android/Chrome from evicting local IndexedDB data.
 */

export interface StorageStatus {
  isSupported: boolean;
  isPersisted: boolean;
  quota?: number;
  usage?: number;
}

export async function checkStoragePersistence(): Promise<StorageStatus> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persisted) {
    return { isSupported: false, isPersisted: false };
  }

  try {
    const isPersisted = await navigator.storage.persisted();
    let quota: number | undefined;
    let usage: number | undefined;

    if (navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      quota = estimate.quota;
      usage = estimate.usage;
    }

    return {
      isSupported: true,
      isPersisted,
      quota,
      usage,
    };
  } catch (err) {
    console.warn('Storage persistence check error:', err);
    return { isSupported: false, isPersisted: false };
  }
}

export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return false;
  }

  try {
    const persisted = await navigator.storage.persist();
    if (persisted) {
      console.log('ShopFlow IndexedDB granted persistent storage.');
    } else {
      console.log('ShopFlow storage is managed under default browser quota.');
    }
    return persisted;
  } catch (err) {
    console.warn('Could not request persistent storage:', err);
    return false;
  }
}
