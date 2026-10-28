import { useCallback, useEffect, useRef, useState } from "react";
import { captchaFinalize, captchaStart, captchaSubmit } from "./captcha.functions";
import type { PublicTask, TaskAnswer } from "./types";

export type Phase = "idle" | "starting" | "task" | "submitting" | "waiting" | "passed" | "failed" | "error";

export function useCaptcha() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [task, setTask] = useState<PublicTask | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [minMs, setMinMs] = useState(16000);
  const [pass, setPass] = useState<{ sessionId: string; token: string } | null>(null);
  const session = useRef<string | null>(null);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gen = useRef(0);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const reset = useCallback(() => {
    gen.current++;
    clearTimer();
    lock.current = false;
    session.current = null;
    setTask(null);
    setHint(null);
    setStartedAt(null);
    setPass(null);
    setPhase("idle");
  }, []);

  const start = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    const g = ++gen.current;
    setPass(null);
    setPhase("starting");
    try {
      const r = await captchaStart();
      if (g !== gen.current) return;
      session.current = r.sessionId;
      setStartedAt(Date.now());
      setMinMs(r.minDurationMs);
      setTask(r.task);
      setHint(null);
      setPhase("task");
    } catch {
      if (g === gen.current) setPhase("error");
    } finally {
      if (g === gen.current) lock.current = false;
    }
  }, []);

  const poll = useCallback((delay: number, g: number) => {
    clearTimer();
    timer.current = setTimeout(async () => {
      try {
        const r = await captchaFinalize({ data: { sessionId: session.current! } });
        if (g !== gen.current) return;
        if (r.status === "pending") return poll(r.remainingMs + 100, g);
        if (r.status === "passed") {
          setPass({ sessionId: session.current!, token: r.token });
          setPhase("passed");
        } else if (r.status === "failed") setPhase("failed");
        else setPhase("error");
      } catch {
        if (g === gen.current) setPhase("error");
      }
    }, delay);
  }, []);

  const submit = useCallback(
    async (answer: TaskAnswer) => {
      if (lock.current || !task || !session.current || phase !== "task") return;
      lock.current = true;
      const g = gen.current;
      setPhase("submitting");
      try {
        const r = await captchaSubmit({ data: { sessionId: session.current, taskKey: task.key, answer } });
        if (g !== gen.current) return;
        if (r.status === "next") {
          setTask(r.task);
          setHint("请继续完成验证");
          setPhase("task");
        } else if (r.status === "too_fast") {
          setHint("请仔细查看后再提交");
          setPhase("task");
        } else if (r.status === "wait") {
          setPhase("waiting");
          poll(r.remainingMs + 100, g);
        } else setPhase("error");
      } catch {
        if (g === gen.current) setPhase("error");
      } finally {
        if (g === gen.current) lock.current = false;
      }
    },
    [task, phase, poll],
  );

  return { phase, task, hint, startedAt, minMs, pass, start, submit, reset };
}
