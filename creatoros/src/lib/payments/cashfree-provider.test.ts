import { describe, it, expect } from "vitest";
import { cashfreeCustomerId } from "./cashfree-provider";

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