import 'fake-indexeddb/auto';

// Polyfill window, localStorage, navigator for Node testing environment
const store = new Map<string, string>();
const mockStorage: Storage = {
  getItem: (key: string) => store.get(key) || null,
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
  key: (index: number) => Array.from(store.keys())[index] || null,
  get length() {
    return store.size;
  },
};

(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = globalThis;
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true,
  });
} catch {
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    configurable: true,
    writable: true,
  });
}
if (typeof (globalThis as any).addEventListener === 'undefined') {
  (globalThis as any).addEventListener = () => {};
  (globalThis as any).removeEventListener = () => {};
}
