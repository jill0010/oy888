// Shared, browser-safe types for the verification flow. Answers never leave the server.
export type GridTask = {
  kind: "grid";
  key: string;
  target: string;
  cols: number;
  tiles: { id: number; emoji: string; label: string }[];
};

export type ShapeKind = "circle" | "square" | "triangle";
export type ShapeColor = "red" | "blue" | "green" | "amber";

export type CountTask = {
  kind: "count";
  key: string;
  targetColor: ShapeColor;
  targetShape: ShapeKind;
  shapes: { shape: ShapeKind; color: ShapeColor; x: number; y: number; size: number }[];
  options: number[];
};

export type PublicTask = GridTask | CountTask;
export type TaskAnswer = number[] | number;

export type StartResult = { sessionId: string; task: PublicTask; minDurationMs: number };
export type SubmitResult =
  | { status: "next"; task: PublicTask }
  | { status: "too_fast" }
  | { status: "wait"; remainingMs: number }
  | { status: "invalid" };
export type FinalizeResult =
  | { status: "pending"; remainingMs: number }
  | { status: "passed"; token: string }
  | { status: "failed" }
  | { status: "invalid" };

export const COLOR_NAMES: Record<ShapeColor, string> = {
  red: "红色",
  blue: "蓝色",
  green: "绿色",
  amber: "黄色",
};
export const SHAPE_NAMES: Record<ShapeKind, string> = {
  circle: "圆形",
  square: "正方形",
  triangle: "三角形",
};
