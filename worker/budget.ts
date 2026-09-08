import type { MatchKind } from "../src/net/protocol";
export interface Budget {
  requests: number;
  duration: number;
  writes: number;
  starts: string[];
  rooms: number;
}
export const emptyBudget = (): Budget => ({
  requests: 0,
  duration: 0,
  writes: 0,
  starts: [],
  rooms: 0,
});
export function reserve(b: Budget, id: string, kind: MatchKind): boolean {
  if (b.starts.includes(id)) return true;
  const scale = kind === "random" ? 0.75 : 1;
  if (
    b.requests + 1500 > 60000 * scale ||
    b.duration + 90 > 8000 * scale ||
    b.writes + 3000 > 60000 * scale
  )
    return false;
  b.requests += 1500;
  b.duration += 90;
  b.writes += 3000;
  b.starts.push(id);
  return true;
}
export const dayKey = (now: number): string =>
  new Date(now).toISOString().slice(0, 10);
