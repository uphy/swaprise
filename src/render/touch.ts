import Phaser from "phaser";
import { Board, COLS, ROWS, isEmptyCell, type Input } from "../core";
import { BOARD_H, BOARD_W, CELL } from "./theme";

/** 横ドラッグを「入れ替え」と判定する移動量（マスの幅に対する割合）。 */
const SWIPE_RATIO = 0.65;
/** これ以下の移動ならタップ扱い。 */
const TAP_SLOP = 8;

type DragMode = "pending" | "swipe";

interface Drag {
  startX: number;
  startY: number;
  originX: number;
  released: boolean;
  /** ドラッグ中のパネルが今いるマス。入れ替えるたびに追従する。 */
  cellX: number;
  cellY: number;
  /** 掴んだのがパネルか（空マスを掴んで隣を引き寄せる操作もある）。 */
  panel: boolean;
  mode: DragMode;
  /** 指が越えたマスのうち、まだ入れ替えを出していない数。右向きが正。 */
  pending: number;
}

/**
 * 盤面へのタッチ・マウス操作を Input に変える。
 *
 * - 2枚の境目をタップ: その2枚を入れ替える（1回で入れ替わる）
 * - パネルを横にドラッグ: その方向の隣と入れ替える。指を離さず引き続ければ連続で入れ替わる。
 *   入れ替えは1つずつ出し、前の入れ替えが終わってパネルが静止してから次を出す。静止した瞬間に揃い判定が
 *   入るので、途中で揃えばそこで消える（原作どおり。指を離すまで運び続けることはできない）。
 *   入れ替え先の下が空なら、原作どおりそこで落ちる（ドラッグはそこで終わり、谷を越えては運べない）
 *   指を離しても認識済みの移動先まで進む。次に触れたら残りの予約は取り消す。
 * - 盤面を2本の指で押している間: 手動せり上げ
 * - 盤面の下の「▲ ▲ ▲」を押している間: 手動せり上げ（GameScene が holdRaise() で知らせる）。
 *   盤面の外の余白ならどこでもせり上がる操作は誤タップが多かったので外し、ボタンの範囲だけにした
 *
 * 操作はキューに積み、poll() が1フレームに1つずつ取り出す。
 */
export class TouchInput {
  private queue: Input[] = [];
  private readonly drags = new Map<number, Drag>();

  /** 選択中のマスと、現在の指の移動量で予約している移動先。 */
  get feedback(): { x: number; y: number; targetX: number } | null {
    const d = this.drags.values().next().value as Drag | undefined;
    return d ? { x: d.cellX, y: d.cellY, targetX: d.cellX + d.pending } : null;
  }
  /** せり上げている指（盤面を2本以上で押しているとき、または「▲ ▲ ▲」を押しているとき）。 */
  private readonly raisePointers = new Set<number>();

  /** 盤面の左上の論理座標と拡大率。BoardView.place() と同じ値を渡す。 */
  ox = 0;
  oy = 0;
  scale = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly board: Board,
  ) {
    scene.input.on("pointerdown", this.onDown, this);
    scene.input.on("pointermove", this.onMove, this);
    scene.input.on("pointerup", this.onUp, this);
    scene.input.on("pointerupoutside", this.onUp, this);
  }

  /** 溜まっている操作を捨てる。ポーズ解除のタップを入れ替えとして扱わないために使う。 */
  clear(): void {
    this.queue = [];
    this.drags.clear();
    this.raisePointers.clear();
    this.onBoard.clear();
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onDown, this);
    this.scene.input.off("pointermove", this.onMove, this);
    this.scene.input.off("pointerup", this.onUp, this);
    this.scene.input.off("pointerupoutside", this.onUp, this);
    this.drags.clear();
    this.raisePointers.clear();
    this.onBoard.clear();
  }

  place(ox: number, oy: number, scale = 1): void {
    this.ox = ox;
    this.oy = oy;
    this.scale = scale;
  }

  /** 画面上のマスの大きさ（論理 px）。 */
  private get cell(): number {
    return CELL * this.scale;
  }

  /** 論理座標（Pointer の worldX / worldY）を盤面のマスに変換する。盤面の外なら null。 */
  cellAt(px: number, py: number): { x: number; y: number } | null {
    const cell = this.cell;
    if (px < this.ox || px >= this.ox + BOARD_W * this.scale || py < this.oy || py >= this.oy + BOARD_H * this.scale) return null;
    const x = Math.floor((px - this.ox) / cell);
    const rise = this.board.riseProgress * cell;
    const y = ROWS - 1 - Math.floor((py - this.oy + rise) / cell);
    return { x: Math.max(0, Math.min(COLS - 1, x)), y: Math.max(0, Math.min(ROWS - 1, y)) };
  }

  /** せり上げ中の指があるか。 */
  get raising(): boolean {
    return this.raisePointers.size > 0;
  }

  /** 盤面の外のせり上げボタンを押した指。離す（onUp）まで せり上げる。 */
  holdRaise(pointerId: number): void {
    this.raisePointers.add(pointerId);
  }

  /** 盤面の上に置かれている指。2本以上になったらせり上げに切り替える。 */
  private readonly onBoard = new Set<number>();

  private enabled = true;
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.enabled) return;
    const cell = this.cellAt(p.worldX, p.worldY);
    if (!cell) return;
    // 新しい操作は、前の指を離した後の予約より優先する。
    for (const [id, d] of this.drags) if (d.released) this.drags.delete(id);
    this.onBoard.add(p.id);
    if (this.onBoard.size >= 2) {
      // 2本目の指。入れ替えの途中でもやめて、離すまでせり上げにする
      this.drags.clear();
      for (const id of this.onBoard) this.raisePointers.add(id);
      return;
    }
    const panel = !isEmptyCell(this.board.cell(cell.x, cell.y));
    this.drags.set(p.id, { startX: p.worldX, startY: p.worldY, originX: cell.x, released: false, cellX: cell.x, cellY: cell.y, panel, mode: "pending", pending: 0 });
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const d = this.drags.get(p.id);
    if (!d || d.released) return;
    const position = d.originX + (p.worldX - d.startX) / this.cell;
    let target = d.cellX + d.pending;
    // 基準は押した位置から固定。往復の閾値を重ねず、微振動で逆交換しない。
    // イベント間隔が粗くても、通過した全列を一度に認識する。
    while (target < COLS - 1 && position - target >= SWIPE_RATIO) target++;
    while (target > 0 && position - target <= -SWIPE_RATIO) target--;
    if (target !== d.cellX + d.pending) d.mode = "swipe";
    d.pending = target - d.cellX;
  }

  /** 最後に見たせり上がりの行数。ドラッグ中のパネルの段を追従させる。 */
  private lastRisen = 0;
  private appliedAfter = 0;
  /** オンラインで予約した交換が盤面へ反映されるまで次の交換を待つ。 */
  deferUntil(frame: number): void { this.appliedAfter = frame; }

  /**
   * ドラッグの溜まった移動を入れ替えにする。毎 tick の poll() から呼ぶ。
   * 掴んでいるパネルが入れ替えの途中なら待ち、静止していれば次の1マスを出す。
   * 揃って消え始めた・落ち始めた・いなくなったパネルはそこでドラッグを終える。
   */
  private advanceDrags(): void {
    if (this.board.frame < this.appliedAfter) return;
    const risen = this.board.risenRows;
    if (risen !== this.lastRisen) {
      for (const d of this.drags.values()) d.cellY = Math.min(ROWS - 1, d.cellY + risen - this.lastRisen);
      this.lastRisen = risen;
    }
    for (const [id, d] of this.drags) {
      const here = this.board.cell(d.cellX, d.cellY);
      if (d.panel) {
        if (isEmptyCell(here) || here.state === "matched" || here.state === "popped" || here.state === "falling") {
          this.drags.delete(id);
          continue;
        }
        if (here.state === "swapping") continue;
      }
      if (d.pending === 0) {
        if (d.released) this.drags.delete(id);
        continue;
      }
      const dir = d.pending > 0 ? 1 : -1;
      const target = d.cellX + dir;
      const there = this.board.cell(target, d.cellY);
      if (!d.panel && !isEmptyCell(there) && there.state === "swapping") continue;
      const left = dir > 0 ? d.cellX : target;
      // 掴んでいるパネルの現在の位置で入れ替える
      this.queue.push({ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: { x: left, y: d.cellY } });
      d.cellX = target;
      d.pending -= dir;
      // 入れ替え先の下が空なら、パネルはそこで落ちる。ドラッグはここで終える
      if (d.panel && d.cellY > 0 && isEmptyCell(this.board.cell(target, d.cellY - 1))) this.drags.delete(id);
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.onBoard.delete(p.id);
    this.raisePointers.delete(p.id);
    const d = this.drags.get(p.id);
    if (!d) return;
    this.onMove(p);
    if (d.mode === "swipe") {
      d.released = true;
      return;
    }
    this.drags.delete(p.id);
    if (Math.abs(p.worldX - d.startX) > TAP_SLOP || Math.abs(p.worldY - d.startY) > TAP_SLOP) return;
    // タップ1回で入れ替える。タップ位置に最も近いマスの境目を挟む2枚が対象。
    // マスの中央を叩いたときは、左右のうち近い側の隣と入れ替える。
    const boundary = Math.round((d.startX - this.ox) / this.cell);
    const left = Math.max(0, Math.min(COLS - 2, boundary - 1));
    this.queue.push({ moveX: 0, moveY: 0, swap: true, raise: false, cursorTo: { x: left, y: d.cellY } });
  }

  /** キューの先頭を1つ取り出す。何もなければ null。せり上げの状態は毎回返す。 */
  poll(): { action: Input | null; raise: boolean } {
    this.advanceDrags();
    return { action: this.queue.shift() ?? null, raise: this.raising };
  }
}
