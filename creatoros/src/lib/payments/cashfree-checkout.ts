"use client";

/**
 * Opens a Cashfree one-time checkout in the browser.
 *
 * Cashfree retired `order_token`/`payment_link`: create-order only returns a
 * `payment_session_id`, and the docs state that "you cannot redirect the
 * customer to the checkout page just by using the API — you'll need to use our
 * JS SDK for starting checkout". Hand-assembled
 * `payments.cashfree.com/checkout?payment_session_id=...` URLs return 404, so
 * the session must go through `cashfree.checkout()`.
 *
 * The domain that opens checkout must be whitelisted in the Cashfree
 * dashboard, otherwise the SDK refuses to start.
 */
const SDK_SRC = "https://sdk.cashfree.com/js/v3/cashfree.js";

type CashfreeInstance = {
  checkout: (opts: { paymentSessionId: string; redirectTarget?: "_self" | "_blank" | "_top" }) => Promise<unknown> | void;
  subscriptionsCheckout?: (opts: {
    subsSessionId: string;
    redirectTarget?: "_self" | "_blank";
  }) => Promise<{ error?: { message?: string } } | void>;
};

declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => CashfreeInstance;
  }
}

export function loadCashfree(mode: "sandbox" | "production"): Promise<CashfreeInstance> {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) {
      resolve(window.Cashfree({ mode }));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    const script = existing || document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => {
      if (!window.Cashfree) {
        reject(new Error("Cashfree checkout could not start. Please try again."));
        return;
      }
      resolve(window.Cashfree({ mode }));
    };
    script.onerror = () => reject(new Error("Could not reach Cashfree. Check your connection and try again."));
    if (!existing) document.head.appendChild(script);
  });
}

export async function openCashfreeCheckout(paymentSessionId: string, mode: "sandbox" | "production"): Promise<void> {
  const cashfree = await loadCashfree(mode);
  await cashfree.checkout({ paymentSessionId, redirectTarget: "_self" });
}