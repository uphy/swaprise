/**
 * 全画面（Fullscreen API）。Android Chrome の URL バーとメニューバーを消して、画面全体をゲームに使う。
 *
 * - 要求はユーザー操作（タップ・クリック）の中でしか通らない。Phaser のポインタ処理は DOM イベントと同期なので、
 *   Button の押下から呼べば通る（キー入力は次のフレームに回されるので通らないことがある）
 * - 戻る操作や回転で解除されるので、希望（localStorage）を覚えておき、メニューのタップ・ゲーム開始・再開のたびに sync() で取り直す
 * - 希望の既定はタッチ端末で ON、PC で OFF。SETTINGS で切り替えると保存される
 * - ホーム画面に追加した PWA（standalone）は最初から全画面なので何もしない
 * - iPhone の Safari は動画以外に Fullscreen API を使えないので supported が false。案内文でホーム画面への追加を勧める
 */
import { isTouchDevice } from "./theme";

const KEY = "swaprise.fullscreen.v1";

interface LegacyDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface LegacyElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export class Fullscreen {
  private wanted_: boolean;

  constructor() {
    // 何も選んでいなければ、タッチ端末では全画面を望んでいるものとする（スマホは URL バーのぶん盤面が狭い）。
    // PC は選ばれるまで入らない
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      stored = null;
    }
    this.wanted_ = stored === null ? isTouchDevice() : stored === "1";
  }

  /** ホーム画面に追加した PWA として開いているか。 */
  get standalone(): boolean {
    if (typeof window === "undefined") return false;
    const nav = navigator as Navigator & { standalone?: boolean };
    return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
  }

  /** この環境で全画面にできるか。standalone なら不要なので false。 */
  get supported(): boolean {
    if (typeof document === "undefined" || this.standalone) return false;
    const doc = document as LegacyDocument;
    const el = document.documentElement as LegacyElement;
    const enabled = doc.fullscreenEnabled || doc.webkitFullscreenEnabled === true;
    return enabled && (typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function");
  }

  /** iPhone / iPad の Safari か。Fullscreen API の代わりにホーム画面への追加を案内する。 */
  get isIOS(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  }

  get active(): boolean {
    if (typeof document === "undefined") return false;
    const doc = document as LegacyDocument;
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
  }

  /** 望んでいるのにまだ入っていないか。オープニングはこのとき最初のタップを待ち、そのタップで入る。 */
  get pending(): boolean {
    return this.wanted_ && this.supported && !this.active;
  }

  /** ユーザーが全画面を望んでいるか（localStorage に保存）。 */
  get wanted(): boolean {
    return this.wanted_;
  }

  /** 希望を切り替え、その場で入る・出る。ユーザー操作の中で呼ぶ。 */
  toggle(): void {
    this.setWanted(!this.wanted_);
  }

  setWanted(on: boolean): void {
    this.wanted_ = on;
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      // プライベートモードなどで保存できなくても動作は続ける
    }
    if (on) void this.enter();
    else void this.exit();
  }

  /**
   * どの画面でも、指が触れた瞬間に望んでいれば入る。Phaser のボタンは pointerdown を stopPropagation するので
   * シーンの入力では拾えず、DOM の capture で受ける。ユーザー操作の中なので要求が通る
   */
  watchGestures(): void {
    if (typeof window === "undefined") return;
    // 指の pointerdown（touchstart）はブラウザの「ユーザー操作」に数えられず、要求が拒否される。指を離した pointerup では通る。
    // マウスは pointerdown で通るので両方で呼ぶ。enter() は入りかけなら何もしない
    window.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") this.sync(); }, { capture: true, passive: true });
    window.addEventListener("pointerup", () => this.sync(), { capture: true, passive: true });
  }

  /** 希望していて今は全画面でなければ取り直す。ゲーム開始・再開など、ユーザー操作の中で呼ぶ。 */
  sync(): void {
    if (this.wanted_ && this.supported && !this.active) void this.enter();
  }

  private entering = false;

  async enter(): Promise<void> {
    if (!this.supported || this.active || this.entering) return;
    this.entering = true;
    const el = document.documentElement as LegacyElement;
    try {
      if (typeof el.requestFullscreen === "function") await el.requestFullscreen({ navigationUI: "hide" });
      else await el.webkitRequestFullscreen?.();
    } catch {
      // ユーザー操作の外から呼ばれたときなどは拒否される。次の操作で取り直す
    } finally {
      this.entering = false;
    }
  }

  async exit(): Promise<void> {
    if (!this.active) return;
    const doc = document as LegacyDocument;
    try {
      if (typeof doc.exitFullscreen === "function") await doc.exitFullscreen();
      else await doc.webkitExitFullscreen?.();
    } catch {
      // 既に解除されている場合など
    }
  }
}

export const fullscreen = new Fullscreen();
