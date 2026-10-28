import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const id = z.string().uuid();

export const captchaStart = createServerFn({ method: "POST" }).handler(async () => {
  const { startSession } = await import("./engine.server");
  return startSession();
});

export const captchaSubmit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: id,
        taskKey: id,
        answer: z.union([z.array(z.number().int()).max(16), z.number().int()]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { submitAnswer } = await import("./engine.server");
    return submitAnswer(data.sessionId, data.taskKey, data.answer);
  });

export const captchaFinalize = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ sessionId: id }).parse(d))
  .handler(async ({ data }) => {
    const { finalize } = await import("./engine.server");
    return finalize(data.sessionId);
  });

export const captchaRedeem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ sessionId: id, token: id }).parse(d))
  .handler(async ({ data }) => {
    const { redeem } = await import("./engine.server");
    return { ok: redeem(data.sessionId, data.token) };
  });
