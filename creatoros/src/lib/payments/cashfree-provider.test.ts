import { describe, it, expect, afterEach } from "vitest";
import { cashfreeCustomerId, cashfreeCheckoutUrl } from "./cashfree-provider";

describe("cashfreeCustomerId", () => {
  it("strips the characters Cashfree rejects from an email", () => {
    const id = cashfreeCustomerId("sandydixit8@gmail.com");
    expect(id).toBe("sandydixit8gmailcom");
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("is stable for the same email regardless of case", () => {
    expect(cashfreeCustomerId("Buyer@Example.com")).toBe(cashfreeCustomerId("buyer@example.com"));
  });

  it("falls back to a stable hash when nothing usable is left", () => {
    const id = cashfreeCustomerId("@.");
    expect(id).toMatch(/^cust_[0-9a-f]{16}$/);
    expect(cashfreeCustomerId("@.")).toBe(id);
  });

  it("uses guest when there is no email", () => {
    expect(cashfreeCustomerId()).toBe("guest");
    expect(cashfreeCustomerId("  ")).toBe("guest");
  });
});

describe("cashfreeCheckoutUrl", () => {
  const prev = process.env.CASHFREE_ENV;

  afterEach(() => {
    if (prev === undefined) delete process.env.CASHFREE_ENV;
    else process.env.CASHFREE_ENV = prev;
  });

  it("builds the live hosted checkout link from the payment session id", () => {
    process.env.CASHFREE_ENV = "live";
    const url = cashfreeCheckoutUrl("session_abc-123", "ord_1");
    expect(url).toBe("https://payments.cashfree.com/checkout?payment_session_id=session_abc-123&order_id=ord_1");
  });

  it("uses the test host in sandbox", () => {
    process.env.CASHFREE_ENV = "sandbox";
    expect(cashfreeCheckoutUrl("s_1", "ord_1")).toContain("https://payments-test.cashfree.com/checkout?");
  });

  it("url-encodes ids so a session id cannot break the query string", () => {
    process.env.CASHFREE_ENV = "live";
    expect(cashfreeCheckoutUrl("a b&c=d", "ord_2")).toContain("payment_session_id=a%20b%26c%3Dd");
  });
});