import {
  BATCH,
  DELAY,
  GAME_VERSION,
  GRACE_MS,
  MAX_FRAMES,
  isInt,
  validInput,
  type ClientMessage,
  type MatchKind,
  type Pair,
  type RoomState,
  type ServerMessage,
} from "../src/net/protocol";
import { initialFrames } from "../src/net/lockstep";
import type { Input } from "../src/core/types";
export interface Member {
  session: string;
  token: string;
  name: string;
}
export class RoomEngine {
  state: RoomState;
  members: (Member | null)[] = [null, null];
  history: Pair[] = [];
  pending: Map<number, Input>[] = [new Map(), new Map()];
  next = [0, 0];
  lastSeen = [0, 0];
  hashes = new Map<number, ({ hash: string; winner?: number } | undefined)[]>();
  sync = [false, false];
  private lastClock = 0;
  private started = 0;
  private deadline = 0;
  constructor(
    kind: MatchKind,
    private send: (player: number, message: ServerMessage) => void,
  ) {
    this.state = {
      phase: "waiting",
      kind,
      revision: 0,
      seats: [null, null],
      match: null,
      startAt: 0,
      frame: 0,
      remaining: 600_000,
      result: null,
    };
  }
  join(member: Member): number {
    if (this.state.phase === "closed")
      throw new Error("This room has closed.");
    const old = this.members.findIndex((m) => m?.session === member.session);
    if (old >= 0) return old;
    const i = this.members.findIndex((m) => !m);
    if (i < 0 || this.state.phase !== "waiting")
      throw new Error("This room is full.");
    this.members[i] = member;
    this.state.seats[i] = {
      name: member.name,
      connected: false,
      visible: false,
      ready: false,
      grace: GRACE_MS,
      rematch: false,
    };
    this.publish();
    return i;
  }
  publish(): void {
    this.state.frame = this.history.length;
    this.state.revision++;
    for (let i = 0; i < 2; i++)
      if (this.members[i])
        this.send(i, {
          type: "state",
          state: structuredClone(this.state),
          player: i,
        });
  }
  connect(i: number, visible: boolean, now: number): void {
    const seat = this.state.seats[i]!;
    if (seat.connected) throw new Error("Already connected in another tab.");
    seat.connected = true;
    seat.visible = visible;
    this.lastSeen[i] = now;
    if (this.state.kind === "random") seat.ready = typeof seat.rtt === "number";
    if (this.state.phase === "playing" || this.state.phase === "suspended") {
      this.suspend(now);
      this.replay(i);
    }
    this.publish();
  }
  disconnect(i: number, now: number): void {
    const seat = this.state.seats[i];
    if (!seat) return;
    seat.connected = false;
    seat.visible = false;
    seat.ready = false;
    if (this.state.phase === "playing" || this.state.phase === "suspended")
      this.suspend(now);
    if (this.state.phase === "countdown") this.state.phase = "waiting";
    this.publish();
  }
  private replay(i: number): void {
    this.send(i, {
      type: "state",
      state: structuredClone(this.state),
      player: i,
    });
    for (let n = 0; n < this.history.length; n += 120)
      this.send(i, {
        type: "frames",
        matchId: this.state.match!.id,
        startFrame: n,
        frames: this.history.slice(n, n + 120),
        replay: true,
      });
    this.send(i, {
      type: "sync",
      matchId: this.state.match!.id,
      frame: this.history.length,
    });
  }
  private suspend(now: number): void {
    if (this.state.phase === "suspended") return;
    this.state.phase = "suspended";
    this.lastClock = now;
    this.pending.forEach((m) => m.clear());
    this.next = [this.history.length, this.history.length];
    this.sync = [false, false];
    for (let i = 0; i < 2; i++)
      if (this.state.seats[i]?.connected && this.state.seats[i]?.visible)
        this.replay(i);
    this.publish();
  }
  canStart(): boolean {
    return (
      (this.state.phase === "waiting" || this.state.phase === "result") &&
      this.state.seats.every((s) => typeof s?.rtt === "number") &&
      this.state.seats.every(
        (s) =>
          s?.connected &&
          s.visible &&
          (this.state.phase === "result" ? s.rematch : s.ready),
      )
    );
  }
  start(id: string, seed: number, now: number): void {
    if (!this.canStart()) return;
    const delay = Math.max(
      DELAY,
      Math.min(
        18,
        Math.ceil(
          Math.max(...this.state.seats.map((s) => s?.rtt ?? 0)) / (1000 / 60),
        ) +
          BATCH +
          1,
      ),
    );
    this.state.match = { id, seed, delay, version: GAME_VERSION };
    this.state.phase = "countdown";
    this.state.startAt = now + 3000;
    this.state.result = null;
    this.state.remaining = 600_000;
    this.history = initialFrames(delay);
    this.next = [delay, delay];
    this.pending.forEach((m) => m.clear());
    this.hashes.clear();
    this.state.seats.forEach((s) => {
      if (s) {
        s.grace = GRACE_MS;
        s.rematch = false;
      }
    });
    this.publish();
    for (let i = 0; i < 2; i++)
      this.send(i, {
        type: "frames",
        matchId: id,
        startFrame: 0,
        frames: this.history,
      });
  }
  message(i: number, m: ClientMessage, now: number): void {
    const seat = this.state.seats[i];
    if (!seat) return;
    if (m.type === "latency") {
      if (!Number.isFinite(m.rtt) || m.rtt < 0 || m.rtt > 2000) return;
      seat.rtt = m.rtt;
      if (this.state.kind === "random" && this.state.phase === "waiting")
        seat.ready = true;
      this.publish();
      return;
    }
    if (m.type === "ping") {
      this.send(i, { type: "pong", at: m.at });
      return;
    }
    if (m.type === "visibility") {
      if (typeof m.visible !== "boolean") return;
      seat.visible = m.visible;
      this.lastSeen[i] = now;
      if (!m.visible && this.state.phase === "playing") this.suspend(now);
      if (!m.visible && this.state.phase === "countdown")
        this.state.phase = "waiting";
      if (m.visible && this.state.phase === "suspended") this.replay(i);
      this.publish();
      return;
    }
    if (m.type === "leave") {
      if (["playing", "suspended"].includes(this.state.phase))
        this.finish(1 - i, "surrender");
      else {
        this.state.phase = "closed";
        this.publish();
      }
      return;
    }
    if (
      m.type === "surrender" &&
      ["playing", "suspended"].includes(this.state.phase)
    ) {
      this.finish(1 - i, "surrender");
      return;
    }
    if (m.type === "ready" && this.state.phase === "waiting") {
      seat.ready = true;
      this.publish();
      return;
    }
    if (m.type === "rematch" && this.state.phase === "result") {
      seat.rematch = true;
      this.publish();
      return;
    }
    if (!("matchId" in m) || m.matchId !== this.state.match?.id) return;
    if (m.type === "resume" && this.state.phase === "suspended") {
      if (m.frame !== this.history.length || !/^[0-9a-f]{8}$/.test(m.hash))
        return;
      const key = -1;
      const values = this.hashes.get(key) ?? [];
      values[i] = { hash: m.hash };
      this.hashes.set(key, values);
      this.sync[i] = true;
      this.lastSeen[i] = now;
      if (
        this.sync.every(Boolean) &&
        this.state.seats.every((s) => s?.connected && s.visible)
      ) {
        if (values[0]?.hash !== values[1]?.hash) {
          this.finish(-1, "desync");
          return;
        }
        this.hashes.delete(key);
        this.state.phase = "playing";
        this.lastClock = now;
        this.lastSeen = [now, now];
        // 再開時も入力を先行させる猶予を用意する。
        const start = this.history.length;
        const frames = initialFrames(this.state.match!.delay);
        this.history.push(...frames);
        this.next = [this.history.length, this.history.length];
        this.publish();
        for (let p = 0; p < 2; p++)
          this.send(p, {
            type: "frames",
            matchId: m.matchId,
            startFrame: start,
            frames,
          });
      }
      return;
    }
    if (
      m.type === "hash" &&
      ["playing", "suspended"].includes(this.state.phase)
    ) {
      if (
        !isInt(m.frame, 1, this.history.length) ||
        !/^[0-9a-f]{8}$/.test(m.hash) ||
        (m.winner !== undefined && !isInt(m.winner, -1, 1))
      )
        return;
      if (m.winner === undefined && m.frame % 120 !== 0) return;
      const pair = this.hashes.get(m.frame) ?? [];
      if (pair[i] && pair[i]!.hash !== m.hash) {
        this.finish(-1, "desync");
        return;
      }
      pair[i] = { hash: m.hash, winner: m.winner };
      this.hashes.set(m.frame, pair);
      if (pair[0] && pair[1]) {
        if (pair[0].hash !== pair[1].hash || pair[0].winner !== pair[1].winner)
          this.finish(-1, "desync");
        else if (pair[0].winner !== undefined)
          this.finish(pair[0].winner, "normal");
        this.hashes.delete(m.frame);
      }
      if (this.hashes.size > 20) this.finish(-1, "desync");
      return;
    }
    if (m.type !== "input" || this.state.phase !== "playing") return;
    if (
      !isInt(m.startFrame, 0, MAX_FRAMES + DELAY) ||
      !Array.isArray(m.inputs) ||
      m.inputs.length !== BATCH ||
      !m.inputs.every(validInput) ||
      !isInt(m.ack, 0, this.history.length)
    )
      throw new Error("Invalid input format.");
    if (m.startFrame < this.next[i]) {
      m.inputs.forEach((input, n) => {
        const f = m.startFrame + n;
        const old = this.history[f]?.[i] ?? this.pending[i].get(f);
        if (!old || JSON.stringify(old) !== JSON.stringify(input))
          throw new Error("Resent input does not match.");
      });
      return;
    }
    if (
      m.startFrame !== this.next[i] ||
      m.startFrame > this.history.length + 12
    )
      throw new Error("Invalid input frame.");
    // 時刻に対する大幅な先行も拒否する。
    if (m.startFrame > Math.floor(((now - this.started) / 1000) * 60) + 120)
      throw new Error("Input sent too quickly.");
    m.inputs.forEach((input, n) =>
      this.pending[i].set(m.startFrame + n, input),
    );
    this.next[i] += m.inputs.length;
    this.lastSeen[i] = now;
    const first = this.history.length;
    while (this.pending.every((p) => p.has(this.history.length))) {
      const f = this.history.length;
      this.history.push([this.pending[0].get(f)!, this.pending[1].get(f)!]);
      this.pending.forEach((p) => p.delete(f));
    }
    if (this.history.length > first)
      for (let p = 0; p < 2; p++)
        this.send(p, {
          type: "frames",
          matchId: m.matchId,
          startFrame: first,
          frames: this.history.slice(first),
        });
    if (this.history.length >= MAX_FRAMES) this.finish(-1, "timeout");
  }
  clock(now: number): void {
    if (this.state.phase === "countdown" && now >= this.state.startAt) {
      this.state.phase = "playing";
      this.started = now;
      this.deadline = now + 630_000;
      this.lastClock = now;
      this.lastSeen = [now, now];
      this.publish();
    }
    if (this.state.phase === "playing") {
      this.state.remaining = Math.max(
        0,
        this.state.remaining - (now - this.lastClock),
      );
      this.lastClock = now;
      if (this.state.remaining === 0 || now >= this.deadline) {
        this.finish(-1, "timeout");
        return;
      }
      if (this.lastSeen.some((t) => now - t > 1000)) this.suspend(now);
    }
    if (this.state.phase === "suspended") {
      const dt = now - this.lastClock;
      this.lastClock = now;
      this.state.seats.forEach((s, i) => {
        if (s && (!s.connected || !s.visible || !this.sync[i]))
          s.grace = Math.max(0, s.grace - dt);
      });
      const failed = this.state.seats.map((s) => s && s.grace <= 0);
      if (
        (failed[0] && failed[1]) ||
        ((failed[0] || failed[1]) &&
          this.state.seats.every((s) => !s?.connected || !s.visible))
      )
        this.finish(-1, "server");
      else if (failed[0] || failed[1])
        this.finish(failed[0] ? 1 : 0, "disconnect");
      else if (now >= this.deadline) this.finish(-1, "timeout");
    }
  }
  finish(
    winner: number,
    reason: NonNullable<RoomState["result"]>["reason"],
  ): void {
    if (this.state.phase === "result" || this.state.phase === "closed") return;
    this.state.phase = "result";
    this.state.result = { winner, reason };
    this.publish();
  }
}
