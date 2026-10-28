import { afterEach, describe, expect, it, vi } from "vitest";
import { finalize, startSession, submitAnswer, MIN_TOTAL_MS } from "@/lib/captcha/engine.server";

afterEach(() => vi.useRealTimers());

function wrong(task: any) {
  return task.kind === "grid" ? [] : -1;
}

describe("captcha engine", () => {
  it("never returns a result before 16 seconds", () => {
    vi.useFakeTimers();
    expect(MIN_TOTAL_MS).toBe(16000);
    const s = startSession();
    let task: any = s.task;
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(1500);
      const r: any = submitAnswer(s.sessionId, task.key, wrong(task));
      if (r.status === "next") task = r.task;
    }
    expect(finalize(s.sessionId).status).toBe("pending");
    vi.advanceTimersByTime(16000);
    expect(finalize(s.sessionId).status).toBe("failed");
  });

  it("rejects resubmitting the same task", () => {
    vi.useFakeTimers();
    const s = startSession();
    vi.advanceTimersByTime(1500);
    expect(submitAnswer(s.sessionId, s.task.key, wrong(s.task)).status).toBe("next");
    expect(submitAnswer(s.sessionId, s.task.key, wrong(s.task)).status).toBe("invalid");
  });
});
