import type { Input } from "../core/types";
import { COLS, ROWS } from "../core/constants";
export const PROTOCOL = 1;
export const GAME_VERSION = "online-v3";
export const BATCH = 3;
export const DELAY = 6;
export const MAX_FRAMES = 36_000;
export const GRACE_MS = 15_000;
export type MatchKind = "invite" | "random";
export type Phase =
  "waiting" | "countdown" | "playing" | "suspended" | "result" | "closed";
export type Reason =
  "normal" | "surrender" | "disconnect" | "timeout" | "desync" | "server";
export interface Result {
  winner: number;
  reason: Reason;
}
export interface Match {
  id: string;
  seed: number;
  delay: number;
  version: string;
}
export interface Seat {
  rtt?: number;
  name: string;
  connected: boolean;
  visible: boolean;
  ready: boolean;
  grace: number;
  rematch: boolean;
}
export interface RoomState {
  phase: Phase;
  kind: MatchKind;
  revision: number;
  seats: (Seat | null)[];
  match: Match | null;
  startAt: number;
  frame: number;
  remaining: number;
  result: Result | null;
}
export type Pair = [Input, Input];
export type ClientMessage =
  | {
      type: "hello";
      protocol: number;
      version: string;
      token: string;
      visible: boolean;
    }
  | { type: "ready" | "rematch" | "leave" | "surrender" }
  | { type: "visibility"; visible: boolean }
  | { type: "latency"; rtt: number }
  | { type: "ping"; at: number }
  | {
      type: "input";
      matchId: string;
      startFrame: number;
      inputs: Input[];
      ack: number;
    }
  | {
      type: "hash";
      matchId: string;
      frame: number;
      hash: string;
      winner?: number;
    }
  | { type: "resume"; matchId: string; frame: number; hash: string };
export type ServerMessage =
  | { type: "state"; state: RoomState; player: number }
  | {
      type: "frames";
      matchId: string;
      startFrame: number;
      frames: Pair[];
      replay?: boolean;
    }
  | { type: "sync"; matchId: string; frame: number }
  | { type: "pong"; at: number }
  | { type: "error"; message: string }
  | { type: "matched"; roomId: string; token: string }
  | { type: "queued"; since: number }
  | { type: "requeue" }
  | { type: "left" };
export function validInput(value: unknown): value is Input {
  if (!value || typeof value !== "object") return false;
  const i = value as Input;
  return (
    [-1, 0, 1].includes(i.moveX) &&
    [-1, 0, 1].includes(i.moveY) &&
    typeof i.swap === "boolean" &&
    typeof i.raise === "boolean" &&
    (i.cursorTo === undefined ||
      (!!i.cursorTo &&
        Number.isInteger(i.cursorTo.x) &&
        Number.isInteger(i.cursorTo.y) &&
        i.cursorTo.x >= 0 &&
        i.cursorTo.x < COLS - 1 &&
        i.cursorTo.y >= 0 &&
        i.cursorTo.y < ROWS))
  );
}
export function displayName(value: unknown): string {
  return typeof value === "string"
    ? [...value.replace(/[\p{C}\r\n]/gu, "").trim()].slice(0, 20).join("") ||
        "ゲスト"
    : "ゲスト";
}
export function isInt(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
  );
}
