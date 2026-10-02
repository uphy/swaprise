/**
 * 実機の描画と追従の計測。URL に ?perf=1 を付けたときだけ、画面の左上に DOM の小さな表を出す。
 * canvas に描くと計測そのものが描画の重さに混ざるので、DOM に 0.5 秒ごとに書く。
 *
 * - fps: 描画のフレーム数／秒。端末の画面が 120Hz なら 120 近くが正常
 * - frame p95: 描画の間隔の 95 パーセンタイル（ms）。落ちたフレームがあると跳ねる
 * - tick/s: ゲームの論理の tick 数／秒。60 を下回るとゲームそのものが遅れている
 * - update: GameScene.update の JS の処理時間（ms、平均）
 * - render: Phaser の描画の JS 側の処理時間（ms、平均）。GPU の時間は含まない
 * - lag: 指がマスの境を越えてから、そのマスの入れ替えが出るまで（ms、平均と最大）
 */
import { TIMING } from "../core";

export const PERF_ENABLED = typeof location !== "undefined" && new URLSearchParams(location.search).get("perf") === "1";

/**
 * 追従の遅れが入れ替えの速さから来ているかを実機で確かめる実験。?swap=N で入れ替えにかかるフレーム数（既定 4）を N にする。
 * N=1 なら入れ替えはその tick で終わり、ドラッグは 1 tick に 1 マス進む。オンライン対戦では相手と食い違うので使わない
 */
const swapOverride = typeof location !== "undefined" ? Number(new URLSearchParams(location.search).get("swap")) : 0;
if (Number.isInteger(swapOverride) && swapOverride >= 1) (TIMING as { swap: number }).swap = swapOverride;

const WINDOW_MS = 2000;

class PerfHud {
  private el: HTMLDivElement | null = null;
  private frames: number[] = [];
  private lastFrame = 0;
  private ticks: number[] = [];
  private updates: number[] = [];
  private renders: number[] = [];
  private lags: number[] = [];
  private renderStart = 0;
  private lastPaint = 0;

  private mount(): HTMLDivElement {
    if (this.el) return this.el;
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;left:4px;top:4px;z-index:9999;pointer-events:none;font:11px/1.35 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.6);padding:4px 6px;border-radius:4px;white-space:pre";
    document.body.appendChild(el);
    this.el = el;
    return el;
  }

  frame(now: number): void {
    if (this.lastFrame) this.frames.push(now - this.lastFrame);
    this.lastFrame = now;
    if (now - this.lastPaint >= 500) {
      this.lastPaint = now;
      this.paint();
    }
  }

  tick(): void { this.ticks.push(performance.now()); }
  update(ms: number): void { this.updates.push(ms); }
  renderBegin(): void { this.renderStart = performance.now(); }
  renderEnd(): void { if (this.renderStart) this.renders.push(performance.now() - this.renderStart); }
  lag(ms: number): void { this.lags.push(ms); }

  private paint(): void {
    const now = performance.now();
    this.ticks = this.ticks.filter((t) => now - t < WINDOW_MS);
    const keep = (a: number[], n: number): number[] => a.slice(-n);
    this.frames = keep(this.frames, 240);
    this.updates = keep(this.updates, 240);
    this.renders = keep(this.renders, 240);
    this.lags = keep(this.lags, 40);
    const avg = (a: number[]): string => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(1) : "-");
    const sorted = [...this.frames].sort((a, b) => a - b);
    const p95 = sorted.length ? sorted[Math.floor(sorted.length * 0.95)].toFixed(1) : "-";
    const fps = sorted.length ? (1000 / (sorted.reduce((s, x) => s + x, 0) / sorted.length)).toFixed(0) : "-";
    const lagMax = this.lags.length ? Math.max(...this.lags).toFixed(0) : "-";
    this.mount().textContent =
      `fps ${fps}  frame p95 ${p95}ms\n` +
      `tick/s ${(this.ticks.length / (WINDOW_MS / 1000)).toFixed(0)}  update ${avg(this.updates)}ms  render ${avg(this.renders)}ms\n` +
      `lag ${avg(this.lags)}ms (max ${lagMax})  swap ${TIMING.swap}f  dpr ${devicePixelRatio}`;
  }
}

export const perfHud = new PerfHud();
