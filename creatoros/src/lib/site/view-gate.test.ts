import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VIEW_MIN_DWELL_MS, createViewGate } from "./view-gate";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createViewGate", () => {
  it("does not count a load-and-leave", () => {
    const send = vi.fn();
    const gate = createViewGate(send);

    vi.advanceTimersByTime(VIEW_MIN_DWELL_MS - 1);
    expect(send).not.toHaveBeenCalled();

    gate.dispose();
    vi.advanceTimersByTime(60_000);
    expect(send).not.toHaveBeenCalled();
  });

  it("counts once the visitor has actually stayed", () => {
    const send = vi.fn();
    createViewGate(send);

    vi.advanceTimersByTime(VIEW_MIN_DWELL_MS);
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("counts immediately on interaction, without a second send later", () => {
    const send = vi.fn();
    const gate = createViewGate(send);

    gate.trigger();
    expect(send).toHaveBeenCalledTimes(1);

    gate.trigger();
    vi.advanceTimersByTime(VIEW_MIN_DWELL_MS * 2);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("honours a custom dwell window", () => {
    const send = vi.fn();
    createViewGate(send, { dwellMs: 1_500 });

    vi.advanceTimersByTime(1_499);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
