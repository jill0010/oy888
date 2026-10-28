import type {
  CountTask,
  FinalizeResult,
  GridTask,
  PublicTask,
  ShapeColor,
  ShapeKind,
  StartResult,
  SubmitResult,
  TaskAnswer,
} from "./types";

export const MIN_TOTAL_MS = 16_000;
export const MIN_TASK_MS = 1_200;
const SESSION_TTL_MS = 10 * 60_000;

type Item = [string, string];
const POOLS: Record<string, { name: string; items: Item[] }> = {
  animal: { name: "动物", items: [["🐶", "小狗"], ["🐱", "小猫"], ["🐰", "兔子"], ["🦊", "狐狸"], ["🐼", "熊猫"], ["🐯", "老虎"], ["🐸", "青蛙"], ["🦁", "狮子"], ["🐧", "企鹅"]] },
  fruit: { name: "水果", items: [["🍎", "苹果"], ["🍌", "香蕉"], ["🍇", "葡萄"], ["🍓", "草莓"], ["🍊", "橘子"], ["🍉", "西瓜"], ["🍑", "桃子"], ["🍍", "菠萝"], ["🍒", "樱桃"]] },
  vehicle: { name: "交通工具", items: [["🚗", "汽车"], ["🚌", "公交车"], ["🚲", "自行车"], ["✈️", "飞机"], ["🚂", "火车"], ["🚢", "轮船"], ["🚁", "直升机"], ["🛵", "摩托车"], ["🚜", "拖拉机"]] },
  object: { name: "日常用品", items: [["☂️", "雨伞"], ["⏰", "闹钟"], ["📚", "书本"], ["🔑", "钥匙"], ["💡", "灯泡"], ["✂️", "剪刀"], ["🎒", "书包"], ["🧲", "磁铁"], ["🪑", "椅子"]] },
};

type Stored = { task: PublicTask; answer: TaskAnswer };
type Session = {
  id: string;
  startedAt: number;
  tasks: Stored[];
  round: number; // index of task currently shown
  shownAt: number;
  correct: boolean[];
  busy: boolean;
  result: null | { passed: boolean; token: string | null };
};

const sessions = new Map<string, Session>();

const rand = (n: number) => Math.floor(Math.random() * n);
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function gridTask(cat: string, total: number, minC: number, maxC: number, cols: number): Stored {
  const n = minC + rand(maxC - minC + 1);
  const correct = shuffle(POOLS[cat]!.items).slice(0, n);
  const others = shuffle(Object.keys(POOLS).filter((k) => k !== cat).flatMap((k) => POOLS[k]!.items)).slice(0, total - n);
  const tiles = shuffle([...correct.map((i) => ({ i, ok: true })), ...others.map((i) => ({ i, ok: false }))]);
  const task: GridTask = {
    kind: "grid",
    key: crypto.randomUUID(),
    target: POOLS[cat]!.name,
    cols,
    tiles: tiles.map((t, id) => ({ id, emoji: t.i[0], label: t.i[1] })),
  };
  return { task, answer: tiles.flatMap((t, id) => (t.ok ? [id] : [])) };
}

function countTask(): Stored {
  const shapesK: ShapeKind[] = ["circle", "square", "triangle"];
  const colors: ShapeColor[] = ["red", "blue", "green", "amber"];
  for (;;) {
    const cells = shuffle(Array.from({ length: 20 }, (_, i) => i)).slice(0, 14);
    const shapes = cells.map((c) => ({
      shape: shapesK[rand(3)]!,
      color: colors[rand(4)]!,
      x: (c % 5) * 60 + 30 + rand(14) - 7,
      y: Math.floor(c / 5) * 60 + 30 + rand(14) - 7,
      size: 30 + rand(10),
    }));
    const t = shapes[rand(shapes.length)]!;
    const count = shapes.filter((s) => s.shape === t.shape && s.color === t.color).length;
    if (count < 2 || count > 5) continue;
    const opts = new Set([count]);
    while (opts.size < 4) opts.add(Math.max(1, count + rand(7) - 3));
    const task: CountTask = {
      kind: "count",
      key: crypto.randomUUID(),
      targetColor: t.color,
      targetShape: t.shape,
      shapes,
      options: [...opts].sort((a, b) => a - b),
    };
    return { task, answer: count };
  }
}

function isCorrect(stored: Stored, answer: unknown): boolean {
  if (stored.task.kind === "grid") {
    if (!Array.isArray(answer)) return false;
    const want = [...(stored.answer as number[])].sort((a, b) => a - b);
    const got = [...new Set(answer.filter((n) => Number.isInteger(n)))].sort((a, b) => a - b);
    return want.length === got.length && want.every((v, i) => v === got[i]!);
  }
  return answer === stored.answer;
}

function cleanup(now: number) {
  for (const [id, s] of sessions) if (now - s.startedAt > SESSION_TTL_MS) sessions.delete(id);
}

export function startSession(): StartResult {
  const now = Date.now();
  cleanup(now);
  const cats = shuffle(Object.keys(POOLS));
  const s: Session = {
    id: crypto.randomUUID(),
    startedAt: now,
    tasks: [gridTask(cats[0]!, 9, 3, 4, 3), gridTask(cats[1]!, 16, 5, 7, 4), countTask()],
    round: 0,
    shownAt: now,
    correct: [],
    busy: false,
    result: null,
  };
  sessions.set(s.id, s);
  return { sessionId: s.id, task: s.tasks[0]!.task, minDurationMs: MIN_TOTAL_MS };
}

export function submitAnswer(sessionId: string, taskKey: string, answer: unknown): SubmitResult {
  const s = sessions.get(sessionId);
  const now = Date.now();
  if (!s || s.busy || s.round >= s.tasks.length) return { status: "invalid" };
  if (s.tasks[s.round]!.task.key !== taskKey) return { status: "invalid" };
  if (now - s.shownAt < MIN_TASK_MS) return { status: "too_fast" };
  s.busy = true;
  try {
    s.correct.push(isCorrect(s.tasks[s.round]!, answer));
    s.round += 1;
    s.shownAt = now;
    if (s.round < s.tasks.length) return { status: "next", task: s.tasks[s.round]!.task };
    return { status: "wait", remainingMs: Math.max(0, MIN_TOTAL_MS - (now - s.startedAt)) };
  } finally {
    s.busy = false;
  }
}

export function finalize(sessionId: string): FinalizeResult {
  const s = sessions.get(sessionId);
  const now = Date.now();
  if (!s || s.round < s.tasks.length) return { status: "invalid" };
  const remaining = MIN_TOTAL_MS - (now - s.startedAt);
  if (remaining > 0) return { status: "pending", remainingMs: remaining };
  if (!s.result) {
    const passed = s.correct.length === s.tasks.length && s.correct.every(Boolean);
    s.result = { passed, token: passed ? crypto.randomUUID() : null };
  }
  return s.result.passed ? { status: "passed", token: s.result.token! } : { status: "failed" };
}

export function redeem(sessionId: string, token: string): boolean {
  const s = sessions.get(sessionId);
  return !!s?.result?.passed && s.result.token === token && Date.now() - s.startedAt >= MIN_TOTAL_MS;
}
