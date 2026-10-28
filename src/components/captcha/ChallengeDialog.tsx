import { useEffect, useState } from "react";
import { Check, Loader2, RotateCw, X } from "lucide-react";
import type { CountTask, GridTask, PublicTask, TaskAnswer } from "@/lib/captcha/types";
import { COLOR_NAMES, SHAPE_NAMES } from "@/lib/captcha/types";

type Props = {
  task: PublicTask | null;
  hint: string | null;
  busy: boolean;
  waiting: boolean;
  startedAt: number | null;
  minMs: number;
  onSubmit: (a: TaskAnswer) => void;
  onClose: () => void;
};

export function ChallengeDialog({ task, hint, busy, waiting, startedAt, minMs, onSubmit, onClose }: Props) {
  const [sel, setSel] = useState<number[]>([]);
  const [pick, setPick] = useState<number | null>(null);
  useEffect(() => {
    setSel([]);
    setPick(null);
  }, [task?.key]);

  const ready = task?.kind === "grid" ? sel.length > 0 : pick !== null;
  const prompt =
    task?.kind === "grid" ? (
      <>选择所有包含 <strong className="text-lg">{task.target}</strong> 的图片</>
    ) : task ? (
      <>图中共有几个 <strong className="text-lg">{COLOR_NAMES[task.targetColor]}{SHAPE_NAMES[task.targetShape]}</strong>？</>
    ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 animate-in fade-in-0" role="dialog" aria-modal="true" aria-label="安全验证">
      <div className="w-full max-w-[380px] overflow-hidden rounded-xl border bg-card shadow-panel">
        <div className="bg-primary px-5 py-4 text-primary-foreground">
          {waiting ? (
            <p className="font-medium">正在核验您的操作</p>
          ) : (
            <p className="leading-relaxed">{prompt}</p>
          )}
          <p className="mt-1 h-5 text-xs opacity-85">{waiting ? "请稍候，马上就好" : hint ?? "完成后点击“提交”"}</p>
        </div>

        <div className="relative h-[372px] p-3">
          {waiting ? (
            <WaitPanel startedAt={startedAt} minMs={minMs} />
          ) : task ? (
            <div key={task.key} className="task-in h-full">
              {task.kind === "grid" ? (
                <Grid task={task} sel={sel} toggle={(id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))} />
              ) : (
                <Count task={task} pick={pick} setPick={setPick} />
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="size-6 animate-spin" /></div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <button onClick={onClose} disabled={waiting || busy} className="rounded-full p-2 text-muted-foreground transition hover:bg-muted disabled:opacity-40" aria-label="取消验证">
            <X className="size-5" />
          </button>
          <button
            onClick={() => task && onSubmit(task.kind === "grid" ? sel : pick!)}
            disabled={!ready || busy || waiting}
            className="inline-flex min-w-24 items-center justify-center gap-2 rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            提交
          </button>
        </div>
      </div>
    </div>
  );
}

function Grid({ task, sel, toggle }: { task: GridTask; sel: number[]; toggle: (id: number) => void }) {
  return (
    <div className="grid h-full gap-1.5" style={{ gridTemplateColumns: `repeat(${task.cols}, 1fr)` }}>
      {task.tiles.map((t) => {
        const on = sel.includes(t.id);
        return (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            aria-pressed={on}
            aria-label={t.label}
            className={`relative flex items-center justify-center rounded-md bg-tile transition-all duration-150 ${on ? "scale-90 ring-2 ring-primary" : "hover:brightness-95"} ${task.cols > 3 ? "text-3xl" : "text-5xl"}`}
          >
            <span aria-hidden>{t.emoji}</span>
            {on && (
              <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3.5" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Count({ task, pick, setPick }: { task: CountTask; pick: number | null; setPick: (n: number) => void }) {
  return (
    <div className="flex h-full flex-col gap-3">
      <svg viewBox="0 0 300 240" className="w-full flex-1 rounded-md bg-tile" role="img" aria-label="图形识别">
        {task.shapes.map((s, i) => {
          const fill = `var(--shape-${s.color})`;
          const r = s.size / 2;
          if (s.shape === "circle") return <circle key={i} cx={s.x} cy={s.y} r={r} fill={fill} />;
          if (s.shape === "square") return <rect key={i} x={s.x - r * 0.88} y={s.y - r * 0.88} width={r * 1.76} height={r * 1.76} rx={3} fill={fill} />;
          return <polygon key={i} points={`${s.x},${s.y - r} ${s.x + r},${s.y + r * 0.8} ${s.x - r},${s.y + r * 0.8}`} fill={fill} />;
        })}
      </svg>
      <div className="grid grid-cols-4 gap-2">
        {task.options.map((n) => (
          <button
            key={n}
            onClick={() => setPick(n)}
            aria-pressed={pick === n}
            className={`h-11 rounded-md border text-base font-medium transition ${pick === n ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function WaitPanel({ startedAt, minMs }: { startedAt: number | null; minMs: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const p = startedAt ? Math.min(0.98, (now - startedAt) / minMs) : 0;
  return (
    <div className="task-in flex h-full flex-col items-center justify-center gap-5 text-center">
      <RotateCw className="size-10 animate-spin text-primary [animation-duration:1.6s]" />
      <p className="text-sm text-muted-foreground">正在分析您的操作，请勿关闭页面</p>
      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
    </div>
  );
}
