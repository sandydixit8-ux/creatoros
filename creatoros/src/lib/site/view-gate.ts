/**
 * When a marketing page view is allowed to count.
 *
 * The beacon used to fire on load, which counted headless browsers as visitors:
 * on 2026-10-30 a monitoring service on nine Azure addresses walked `/`,
 * `/pricing` and `/blog` and produced 36 of the day's 68 page views. Filtering
 * by user agent cannot catch it, because it sends a normal macOS Chrome agent.
 *
 * What it cannot fake is staying. So a view counts once either the visitor has
 * been on the page for `dwellMs`, or they interact (scroll, tap, key, click).
 * A load-and-leave never counts. The page still loads and renders identically;
 * only the counter changes.
 *
 * The first version used 10 s. After the deploy the same monitor came back and
 * sat 12 s on one page, so that page still counted (one view out of five loads
 * instead of five). The window is 30 s because the observed pauses are 8-12 s
 * while a person who never scrolls, taps or types for 30 s is rare on a
 * marketing page.
 *
 * Kept as a plain factory with injected `setTimeout`/`clearTimeout` so the
 * timing can be tested without a DOM or a browser.
 */

export const VIEW_MIN_DWELL_MS = 30_000;

export interface ViewGate {
  /** A real interaction happened: send now, at most once. */
  trigger: () => void;
  /** The page is going away: cancel anything still pending. */
  dispose: () => void;
}

export interface ViewGateOptions {
  dwellMs?: number;
  setTimeoutFn?: (fn: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
}

export function createViewGate(send: () => void, options: ViewGateOptions = {}): ViewGate {
  const dwellMs = options.dwellMs ?? VIEW_MIN_DWELL_MS;
  const setTimer = options.setTimeoutFn ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimeoutFn ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  let settled = false;
  const timer = setTimer(() => fire(), dwellMs);

  function fire() {
    if (settled) return;
    settled = true;
    clearTimer(timer);
    send();
  }

  return {
    trigger: fire,
    dispose() {
      settled = true;
      clearTimer(timer);
    },
  };
}
