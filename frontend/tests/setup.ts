import { Window } from 'happy-dom';

declare const afterEach: (fn: () => void) => void;
declare const require: (id: string) => unknown;

const window = new Window();
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement,
  customElements: window.customElements,
  localStorage: window.localStorage,
  sessionStorage: window.sessionStorage,
  location: window.location,
  navigator: window.navigator,
  fetch: window.fetch,
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number,
  cancelAnimationFrame: (id: number) => clearTimeout(id),
  matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
});

// Dynamic require AFTER globals are set — @testing-library/dom caches document at import time
const { cleanup } = require('@testing-library/react') as { cleanup: () => void };

afterEach(() => {
  cleanup();
});
