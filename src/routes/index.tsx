import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronDown, Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { useCaptcha } from "@/lib/captcha/useCaptcha";
import { captchaRedeem } from "@/lib/captcha/captcha.functions";
import { ChallengeDialog } from "@/components/captcha/ChallengeDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "进行安全验证" },
      { name: "description", content: "请完成人机验证流程，确认您不是自动程序。" },
      { property: "og:title", content: "进行安全验证" },
      { property: "og:description", content: "请完成人机验证流程，确认您不是自动程序。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const c = useCaptcha();
  const [redeeming, setRedeeming] = useState(false);
  const [done, setDone] = useState<null | boolean>(null);
  const dialogOpen = ["task", "submitting", "waiting"].includes(c.phase);
  const passed = c.phase === "passed";

  const onBox = () => {
    if (c.phase === "idle" || c.phase === "failed" || c.phase === "error") {
      setDone(null);
      c.start();
    }
  };
  const restart = () => {
    setDone(null);
    c.reset();
  };
  const next = async () => {
    if (!c.pass || redeeming) return;
    setRedeeming(true);
    try {
      const r = await captchaRedeem({ data: c.pass });
      setDone(r.ok);
      if (!r.ok) restart();
    } catch {
      setDone(false);
    } finally {
      setRedeeming(false);
    }
  };

  const status =
    c.phase === "failed" ? "验证未通过，请重新尝试" : c.phase === "error" ? "验证已失效，请重新验证" : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[1040px]">
          <section className="rounded-[28px] bg-card px-6 py-9 shadow-card sm:px-11 sm:py-11">
            <ShieldCheck className="size-11 text-primary" strokeWidth={1.75} />
            <div className="mt-6 grid gap-10 md:grid-cols-2 md:gap-12">
              <div>
                <h1 className="text-[34px] font-normal leading-tight text-foreground sm:text-[44px]">进行安全验证</h1>
                <p className="mt-5 max-w-md text-base leading-relaxed text-foreground/85">
                  本网站使用安全服务防护恶意自动程序，请完成验证流程，确认您不是自动程序期间，将显示此页面。
                </p>
              </div>

              <div className="md:pt-16">
                <p className="mb-3 text-sm text-foreground/85">证明您不是自动程序</p>
                <div className="flex h-[84px] w-full max-w-[340px] items-center justify-between rounded-md border bg-widget px-3.5 shadow-sm">
                  <button
                    onClick={onBox}
                    disabled={c.phase === "starting" || dialogOpen || passed}
                    className="flex items-center gap-3.5 text-left"
                    aria-label="进行人机身份验证"
                  >
                    <span className={`flex size-8 items-center justify-center rounded-sm border-2 bg-card transition ${passed ? "border-transparent" : status ? "border-destructive" : "border-foreground/30 hover:border-foreground/50"}`}>
                      {c.phase === "starting" || dialogOpen ? (
                        <Loader2 className="size-6 animate-spin text-primary" />
                      ) : passed ? (
                        <Check className="size-8 text-success" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="text-[15px] text-foreground">{passed ? "验证成功" : "进行人机身份验证"}</span>
                  </button>
                  <div className="flex flex-col items-center text-muted-foreground">
                    <RefreshCw className="size-7 text-primary/70" />
                    <span className="mt-1 text-[10px]">安全验证</span>
                    <span className="text-[9px]">隐私权 · 使用条款</span>
                  </div>
                </div>
                <div className="mt-3 min-h-12 max-w-[340px] text-sm">
                  {status && (
                    <p className="flex items-center justify-between text-destructive">
                      {status}
                      <button onClick={onBox} className="font-medium text-primary hover:underline">重试</button>
                    </p>
                  )}
                  {passed && (
                    <p className="task-in rounded-md bg-notice px-3 py-2 font-medium text-notice-foreground">
                      请使用系统默认浏览器打开！
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-4 sm:gap-8">
              <button onClick={restart} className="rounded-full px-3 py-2.5 text-sm font-medium text-primary hover:bg-accent">
                试试其他方式
              </button>
              <button
                onClick={next}
                disabled={!passed || redeeming}
                className="inline-flex min-w-[100px] items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {redeeming && <Loader2 className="size-4 animate-spin" />}下一步
              </button>
            </div>
            {done === true && (
              <p className="task-in mt-4 text-right text-sm text-success">验证已通过服务端核验，请使用系统默认浏览器打开！</p>
            )}
          </section>

          <footer className="mt-4 flex items-center justify-between px-4 text-sm text-foreground/80">
            <span className="flex items-center gap-6">简体中文 <ChevronDown className="size-4" /></span>
            <nav className="flex gap-6 sm:gap-9"><span>帮助</span><span>隐私权</span><span>条款</span></nav>
          </footer>
        </div>
      </main>

      {dialogOpen && (
        <ChallengeDialog
          task={c.task}
          hint={c.hint}
          busy={c.phase === "submitting"}
          waiting={c.phase === "waiting"}
          startedAt={c.startedAt}
          minMs={c.minMs}
          onSubmit={c.submit}
          onClose={restart}
        />
      )}
    </div>
  );
}
