import {
  COLS,
  DANGER_ROW,
  DEFAULT_KINDS,
  FRAMES_PER_LEVEL,
  PANELS_PER_LEVEL,
  ROWS,
  SHOCK_KIND,
  TIMING,
  TOTAL_ROWS,
  clearTiming,
  riseFramesPerRow,
} from "./constants";
import { garbageFromChain, garbageFromCombo, garbageFromShock, type GarbageSpec, type IncomingGarbage } from "./garbage";
import { Rng } from "./rng";
import { capScore, matchScore } from "./scoring";
import {
  EMPTY,
  NO_INPUT,
  type BoardEvent,
  type BoardOptions,
  type Cell,
  type GarbageBlock,
  type Input,
  type Kind,
} from "./types";

export function emptyCell(): Cell {
  return {
    kind: EMPTY,
    garbage: -1,
    state: "idle",
    timer: 0,
    fallTimer: 0,
    chain: false,
    chainGrace: 0,
    swapFrom: 0,
    flashTimer: 0,
    popAt: 0,
    removeAt: 0,
    revealKind: EMPTY,
    revealAt: 0,
  };
}

function panelCell(kind: Kind): Cell {
  const c = emptyCell();
  c.kind = kind;
  return c;
}

export function isPanel(c: Cell): boolean {
  return c.kind !== EMPTY && c.garbage < 0;
}

export function isEmptyCell(c: Cell): boolean {
  return c.kind === EMPTY && c.garbage < 0;
}

/**
 * 1人分の盤面。描画やDOMに依存しない純粋なシミュレーション。
 * `tick(input)` を60fpsで呼ぶと1フレーム進む。
 */
export class Board {
  /** cells[row][col]。row 0 が最下段。 */
  readonly cells: Cell[][];
  /** 盤面の下に見えている「次にせり上がる行」。 */
  nextRow: Kind[] = [];
  readonly cursor = { x: 2, y: 5 };

  riseProgress = 0;
  stopTimer = 0;
  shakeTimer = 0;
  deathTimer = 0;
  /** 現在の連鎖数。1は連鎖していない状態。 */
  chain = 1;
  maxChain = 1;
  score = 0;
  panelsCleared = 0;
  level: number;
  frame = 0;
  gameOver = false;
  danger = false;
  panic = false;
  /** 相手から送られて予告に出ていて、まだ降っていないおじゃま。 */
  pendingGarbage: IncomingGarbage[] = [];
  /** このフレームで相手に送る攻撃。Game が回収して相手に渡す。 */
  attacksOut: GarbageSpec[] = [];
  /** 同時消し・ビックリパネルの板で、送るまでの待ち（garbageSendDelay）の途中のもの。 */
  private outbox: GarbageSpec[] = [];
  private outboxAt = 0;
  /** 待ちが明けたが自分の連鎖中だったので、連鎖の終わりまで持っている板。 */
  private heldForChain: GarbageSpec[] = [];
  /** 盤面が静止している（動いている・消えている・連鎖フラグ付きのパネルがない）連続フレーム数。 */
  private quietFrames = 0;
  /** このフレームで起きた出来事。描画・音の層が読む。 */
  events: BoardEvent[] = [];
  readonly garbage = new Map<number, GarbageBlock>();
  readonly stats = { combos: 0, chains: 0, manualRows: 0, shockSpawned: 0, shockCleared: 0 };
  /** せり上がって行が追加された回数。追加のたびに全パネルの段（y）が1つ増える。 */
  risenRows = 0;

  private nextGarbageId = 1;
  private readonly rng: Rng;
  readonly kinds: number;
  private readonly startLevel: number;
  private readonly speedUp: boolean;
  private readonly noRise: boolean;
  /** パズルモードの残り手数。他のモードは null。 */
  movesLeft: number | null = null;
  private readonly shockMax: number;
  private readonly shockEvery: number;
  /** 次のせり上がり行にビックリパネルを入れる予約。 */
  private shockDue = false;
  private stopRaiseFree = false;
  private dropSide = 0;

  /** 予測の巻き戻し用。乱数のprototypeと盤面オブジェクトの参照は維持する。 */
  copyFrom(source: Board): void {
    const { rng, ...state } = source;
    Object.assign(this, structuredClone(state));
    this.rng.copyFrom(rng);
  }

  /** 同期検査用。将来のtickへ影響する状態をすべて含める。 */
  syncState(): unknown {
    return [this.cells, this.nextRow, this.cursor, this.riseProgress, this.stopTimer, this.shakeTimer,
      this.deathTimer, this.chain, this.maxChain, this.score, this.panelsCleared, this.level, this.frame,
      this.gameOver, this.danger, this.panic, this.pendingGarbage, this.attacksOut, this.outbox,
      this.outboxAt, this.heldForChain, this.quietFrames, [...this.garbage], this.stats, this.risenRows,
      this.nextGarbageId, this.rng.state(), this.kinds, this.startLevel, this.speedUp, this.noRise,
      this.movesLeft, this.shockMax, this.shockEvery, this.shockDue, this.stopRaiseFree, this.dropSide];
  }

  constructor(opts: BoardOptions) {
    this.rng = new Rng(opts.seed);
    this.kinds = opts.kinds ?? DEFAULT_KINDS;
    this.startLevel = opts.speedLevel ?? 1;
    this.level = this.startLevel;
    this.speedUp = opts.speedUp ?? false;
    this.noRise = (opts.noRise ?? false) || opts.moveLimit !== undefined;
    this.movesLeft = opts.moveLimit ?? null;
    this.shockMax = opts.shockMax ?? 0;
    this.shockEvery = Math.max(1, opts.shockEvery ?? 12);
    this.cells = [];
    for (let r = 0; r < TOTAL_ROWS; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < COLS; c++) row.push(emptyCell());
      this.cells.push(row);
    }
    const h = opts.initialHeight ?? 5;
    if (h > 0) this.fillInitial(h);
    // パズルはせり上がりがないので、次の行は用意しない（描画もしない）
    if (this.movesLeft === null) this.nextRow = this.generateRow();
  }

  // ---------------------------------------------------------------- helpers

  cell(x: number, y: number): Cell {
    return this.cells[y][x];
  }

  /** テスト・パズル用。列ごとに下から並べた柄で盤面を置き換える。 */
  setColumns(columns: Kind[][]): void {
    for (let r = 0; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) this.cells[r][c] = emptyCell();
    }
    columns.forEach((col, x) => {
      col.forEach((kind, y) => {
        this.cells[y][x] = panelCell(kind);
      });
    });
    this.garbage.clear();
  }

  /** テスト・デバッグ用。上から下へ1行ずつ、柄を数字で表す。 */
  toString(): string {
    const lines: string[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      let line = "";
      for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r][c];
        if (cell.garbage >= 0) line += "#";
        else if (cell.kind === EMPTY) line += ".";
        else line += String(cell.kind);
      }
      lines.push(line);
    }
    return lines.join("\n");
  }

  /** 盤面が静止しているか。入れ替え・浮遊・落下・消去中のパネルとおじゃまがない。 */
  isSettled(): boolean {
    for (let r = 0; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r][c];
        if (isPanel(cell) && cell.state !== "idle") return false;
      }
    }
    for (const g of this.garbage.values()) if (g.state !== "idle") return false;
    return true;
  }

  /** 盤面に残っている通常パネルの枚数。 */
  panelCount(): number {
    let n = 0;
    for (let r = 0; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) if (isPanel(this.cells[r][c])) n++;
    }
    return n;
  }

  private emit(e: BoardEvent): void {
    this.events.push(e);
  }

  private randomKind(): Kind {
    return this.rng.int(this.kinds);
  }

  private fillInitial(height: number): void {
    for (let c = 0; c < COLS; c++) {
      const h = Math.max(1, Math.min(ROWS - 4, height + this.rng.int(3) - 1));
      for (let r = 0; r < h; r++) {
        this.cells[r][c] = panelCell(this.pickKind(c, r));
      }
    }
  }

  /** 縦横に3つ揃わない柄を選ぶ。 */
  private pickKind(x: number, y: number, row?: Kind[]): Kind {
    const banned = new Set<Kind>();
    const kindAt = (cx: number, cy: number): Kind => {
      if (row && cy === y) return cx >= 0 ? row[cx] ?? EMPTY : EMPTY;
      if (cx < 0 || cy < 0 || cy >= TOTAL_ROWS) return EMPTY;
      const cell = this.cells[cy][cx];
      return isPanel(cell) ? cell.kind : EMPTY;
    };
    const left1 = kindAt(x - 1, y);
    const left2 = kindAt(x - 2, y);
    if (left1 !== EMPTY && left1 === left2) banned.add(left1);
    const below1 = kindAt(x, y - 1);
    const below2 = kindAt(x, y - 2);
    if (below1 !== EMPTY && below1 === below2) banned.add(below1);
    let k = this.randomKind();
    let guard = 0;
    while (banned.has(k) && guard++ < 32) k = this.randomKind();
    return k;
  }

  /** 次にせり上がる行。直上の柄と同じにならないようにする。 */
  private generateRow(): Kind[] {
    const row: Kind[] = [];
    for (let c = 0; c < COLS; c++) {
      const above = this.cells[0][c];
      const banned = new Set<Kind>();
      if (isPanel(above)) banned.add(above.kind);
      if (c >= 2 && row[c - 1] === row[c - 2]) banned.add(row[c - 1]);
      let k = this.randomKind();
      let guard = 0;
      while (banned.has(k) && guard++ < 32) k = this.randomKind();
      row.push(k);
    }
    if (this.shockDue && this.stats.shockSpawned < this.shockMax) this.insertShock(row);
    return row;
  }

  /** 行の1マスをビックリパネルにする。真上2段や左右がビックリパネルで揃ってしまう列は避ける。 */
  private insertShock(row: Kind[]): void {
    const start = this.rng.int(COLS);
    for (let i = 0; i < COLS; i++) {
      const c = (start + i) % COLS;
      const a0 = this.cells[0][c];
      const a1 = this.cells[1][c];
      if (isPanel(a0) && a0.kind === SHOCK_KIND && isPanel(a1) && a1.kind === SHOCK_KIND) continue;
      if (c >= 1 && row[c - 1] === SHOCK_KIND) continue;
      if (c + 1 < COLS && row[c + 1] === SHOCK_KIND) continue;
      row[c] = SHOCK_KIND;
      this.stats.shockSpawned++;
      this.shockDue = false;
      return;
    }
  }

  private hasMatched(): boolean {
    for (let r = 0; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const s = this.cells[r][c].state;
        if (s === "matched" || s === "popped") return true;
      }
    }
    return false;
  }

  private hasTransforming(): boolean {
    for (const g of this.garbage.values()) if (g.state === "transforming") return true;
    return false;
  }

  private topTouching(): boolean {
    for (let c = 0; c < COLS; c++) {
      if (!isEmptyCell(this.cells[ROWS - 1][c])) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ tick

  tick(input: Input = NO_INPUT, resolving = false): void {
    this.events = [];
    this.attacksOut = [];
    if (this.gameOver) return;
    this.frame++;

    if (!resolving) this.handleInput(input);
    this.updateCells();
    this.updateGarbageTimers();
    this.applyGravity();
    this.applyGarbageGravity();
    this.findMatches();
    this.clearStaleChainFlags();
    this.dropPendingGarbage();
    this.updateLevel();
    if (!resolving) this.updateRise(input);
    else {
      if (this.stopTimer > 0) this.stopTimer--;
      if (this.shakeTimer > 0) this.shakeTimer--;
    }
    this.updateChainEnd();
    this.updateOutbox();
    if (!resolving) this.updateStatus();
  }

  /** 相手が送った板を受け取る。予告に出て、garbageTransit のあと盤面が静止したときに降る。 */
  receiveGarbage(specs: GarbageSpec[]): void {
    const readyAt = this.frame + TIMING.garbageTransit;
    for (const spec of specs) this.pendingGarbage.push({ ...spec, readyAt });
    this.emit({ type: "garbageIncoming", rows: specs.reduce((sum, spec) => sum + spec.height, 0) });
  }

  // ----------------------------------------------------------------- input

  private handleInput(input: Input): void {
    const { cursor } = this;
    const baseX = input.cursorTo ? input.cursorTo.x : cursor.x + input.moveX;
    const baseY = input.cursorTo ? input.cursorTo.y : cursor.y + input.moveY;
    const nx = Math.max(0, Math.min(COLS - 2, baseX));
    const ny = Math.max(0, Math.min(ROWS - 1, baseY));
    if (nx !== cursor.x || ny !== cursor.y) {
      cursor.x = nx;
      cursor.y = ny;
      this.emit({ type: "move" });
    }
    if (!input.swap) return;
    if (this.movesLeft === null) {
      this.trySwap();
      return;
    }
    // パズル: 静止した盤面でだけ入れ替えを受け付け、成功した入れ替えを1手と数える
    if (this.movesLeft > 0 && this.isSettled() && this.trySwap()) this.movesLeft--;
  }

  /** カーソル位置の2枚を入れ替える。成功したら true。 */
  trySwap(): boolean {
    const { x, y } = this.cursor;
    const a = this.cells[y][x];
    const b = this.cells[y][x + 1];
    if (a.garbage >= 0 || b.garbage >= 0) return false;
    if (a.kind === EMPTY && b.kind === EMPTY) return false;
    // 浮いている（落下前の猶予中の）パネルも入れ替えられる。原作どおり、動かした直後なら戻せる。
    const swappable = (c: Cell): boolean =>
      c.kind === EMPTY || c.state === "idle" || c.state === "swapping" || c.state === "hover";
    if (!swappable(a) || !swappable(b)) return false;
    // 空白側に、上から落ちてくる最中のパネルが着地する寸前でも入れ替えは通す（割り込ませ）。
    this.cells[y][x] = b;
    this.cells[y][x + 1] = a;
    for (const [c, from] of [
      [b, 1],
      [a, -1],
    ] as const) {
      c.chain = false;
      if (c.kind === EMPTY) continue;
      c.state = "swapping";
      c.timer = TIMING.swap;
      c.swapFrom = from;
    }
    this.emit({ type: "swap" });
    return true;
  }

  // ----------------------------------------------------------------- cells

  private updateCells(): void {
    for (let r = 0; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r][c];
        if (!isPanel(cell)) continue;
        switch (cell.state) {
          case "swapping":
            if (--cell.timer <= 0) {
              cell.state = "idle";
              cell.swapFrom = 0;
            }
            break;
          case "hover":
            if (--cell.timer <= 0) {
              cell.state = "falling";
              cell.fallTimer = 0;
            }
            break;
          case "matched":
          case "popped":
            if (cell.flashTimer > 0) cell.flashTimer--;
            cell.popAt--;
            cell.removeAt--;
            if (cell.state === "matched" && cell.popAt <= 0) {
              cell.state = "popped";
              this.emit({ type: "pop", x: c, y: r, index: 0 });
            }
            if (cell.removeAt <= 0) {
              this.cells[r][c] = emptyCell();
              this.flagChainAbove(c, r + 1);
            }
            break;
          default:
            break;
        }
      }
    }
  }

  /** 消えたパネルの上に乗っていたパネル群に連鎖フラグを付ける。 */
  private flagChainAbove(x: number, fromRow: number): void {
    for (let r = fromRow; r < TOTAL_ROWS; r++) {
      const cell = this.cells[r][x];
      if (isEmptyCell(cell)) break;
      if (cell.garbage >= 0) break;
      if (cell.state === "matched" || cell.state === "popped") break;
      cell.chain = true;
    }
  }

  // ---------------------------------------------------------------- gravity

  private applyGravity(): void {
    for (let r = 1; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r][c];
        if (!isPanel(cell)) continue;
        const below = this.cells[r - 1][c];
        if (cell.state === "idle") {
          if (isEmptyCell(below)) {
            const ct = clearTiming(this.level);
            this.startHover(c, r, cell.chain ? ct.hoverClear : ct.hoverSwap);
          } else if (below.garbage >= 0) {
            // おじゃまに乗っているパネルは、おじゃまと一緒に落ちる（おじゃまの猶予・落下に合わせる）
            const g = this.garbage.get(below.garbage);
            if (g?.state === "hover") this.startHover(c, r, Math.max(0, g.timer - 1));
            else if (g?.state === "falling") this.startHover(c, r, 0);
          }
          continue;
        }
        if (cell.state === "falling") {
          if (this.blocksFall(below)) {
            this.land(c, r);
            continue;
          }
          cell.fallTimer++;
          if (cell.fallTimer >= TIMING.fallPerRow && isEmptyCell(below)) {
            cell.fallTimer = 0;
            this.cells[r - 1][c] = cell;
            this.cells[r][c] = emptyCell();
            if (r - 1 === 0 || this.blocksFall(this.cells[r - 2][c])) this.land(c, r - 1);
          }
        }
      }
    }
  }

  /** 落下中のパネルがこのセルの上で止まるか。空、または同じく落下・浮遊中なら止まらない。 */
  private blocksFall(cell: Cell): boolean {
    if (isEmptyCell(cell)) return false;
    if (isPanel(cell)) return cell.state !== "falling" && cell.state !== "hover";
    const g = this.garbage.get(cell.garbage);
    return !g || (g.state !== "falling" && g.state !== "hover");
  }

  /** 空中に出たパネルと、その上に積まれたパネル群をまとめて浮遊状態にする。 */
  private startHover(x: number, y: number, frames: number): void {
    for (let r = y; r < TOTAL_ROWS; r++) {
      const cell = this.cells[r][x];
      if (!isPanel(cell) || cell.state !== "idle") break;
      if (frames <= 0) {
        cell.state = "falling";
        cell.fallTimer = 0;
      } else {
        cell.state = "hover";
        cell.timer = frames;
      }
    }
  }

  private land(x: number, y: number): void {
    const cell = this.cells[y][x];
    cell.state = "idle";
    cell.fallTimer = 0;
    if (cell.chain) cell.chainGrace = TIMING.chainGrace;
    if (y < ROWS) this.emit({ type: "land", x, y });
  }

  // ---------------------------------------------------------------- garbage

  /** 真下に何かある（空でない）か。落下中のパネルがいる間は、その上に重ならないよう動けない。 */
  private garbageBlocked(g: GarbageBlock): boolean {
    if (g.y === 0) return true;
    for (let c = g.x; c < g.x + g.width; c++) {
      if (!isEmptyCell(this.cells[g.y - 1][c])) return true;
    }
    return false;
  }

  /** 真下に支え（着地済みのパネルやおじゃま）があるか。浮遊中・落下中のものは支えにならない。 */
  private garbageResting(g: GarbageBlock): boolean {
    if (g.y === 0) return true;
    for (let c = g.x; c < g.x + g.width; c++) {
      if (this.blocksFall(this.cells[g.y - 1][c])) return true;
    }
    return false;
  }

  /**
   * 真下で浮遊・落下しているものの状態。おじゃまはこれに合わせて動き出し、下のパネルと同じフレームに着地する。
   * 原作ではおじゃまは下に積まれたパネルと一緒に落ちるので、着地の瞬間に揃ったパネルへ隣接していれば変身する。
   */
  private belowGarbage(g: GarbageBlock): { hover: number | null; falling: number | null } {
    let hover: number | null = null;
    let falling: number | null = null;
    if (g.y === 0) return { hover, falling };
    for (let c = g.x; c < g.x + g.width; c++) {
      const cell = this.cells[g.y - 1][c];
      if (isPanel(cell)) {
        if (cell.state === "hover") hover = Math.max(hover ?? 0, cell.timer);
        else if (cell.state === "falling") falling = Math.max(falling ?? 0, cell.fallTimer);
      } else if (cell.garbage >= 0) {
        const other = this.garbage.get(cell.garbage);
        if (other?.state === "hover") hover = Math.max(hover ?? 0, other.timer);
        else if (other?.state === "falling") falling = Math.max(falling ?? 0, other.fallTimer);
      }
    }
    return { hover, falling };
  }

  private moveGarbageDown(g: GarbageBlock): void {
    for (let c = g.x; c < g.x + g.width; c++) {
      for (let r = g.y; r < g.y + g.height; r++) {
        this.cells[r - 1][c] = this.cells[r][c];
      }
      this.cells[g.y + g.height - 1][c] = emptyCell();
    }
    g.y--;
  }

  private applyGarbageGravity(): void {
    const blocks = [...this.garbage.values()].sort((a, b) => a.y - b.y);
    for (const g of blocks) {
      if (g.state === "transforming") continue;
      if (g.state === "idle") {
        if (this.garbageResting(g)) continue;
        // 支えが消えた。真下のパネルが浮遊中ならその残り時間に合わせ、落下中なら同じ落下カウントで続く
        const below = this.belowGarbage(g);
        if (below.hover !== null) {
          g.state = "hover";
          g.timer = below.hover;
        } else if (below.falling !== null) {
          g.state = "falling";
          g.fallTimer = below.falling;
        } else {
          g.state = "hover";
          g.timer = TIMING.hoverGarbage;
        }
        continue;
      }
      if (g.state === "hover") {
        if (this.garbageResting(g)) {
          g.state = "idle";
          continue;
        }
        if (--g.timer > 0) continue;
        // 猶予が切れた。このフレームから落下のカウントを始める（下のパネルは updateCells → applyGravity で同じことをしている）
        g.state = "falling";
        g.fallTimer = 0;
      }
      // falling
      if (this.garbageResting(g)) {
        this.landGarbage(g);
        continue;
      }
      if (g.fallTimer < TIMING.fallPerRow) g.fallTimer++;
      if (g.fallTimer >= TIMING.fallPerRow && !this.garbageBlocked(g)) {
        g.fallTimer = 0;
        this.moveGarbageDown(g);
        if (this.garbageResting(g)) this.landGarbage(g);
      }
    }
  }

  private landGarbage(g: GarbageBlock): void {
    g.state = "idle";
    g.fallTimer = 0;
    this.shakeTimer = Math.max(this.shakeTimer, g.height * TIMING.shakePerRow);
    this.emit({ type: "garbageLand", height: g.height });
  }

  private updateGarbageTimers(): void {
    for (const g of [...this.garbage.values()]) {
      if (g.state !== "transforming") continue;
      for (let c = g.x; c < g.x + g.width; c++) {
        for (let r = g.y; r < g.y + g.height; r++) this.cells[r][c].revealAt--;
      }
      if (--g.transformEnd > 0) continue;
      // 変身完了。最下段だけ通常パネルになり、残りはおじゃまのまま。
      for (let c = g.x; c < g.x + g.width; c++) {
        const cell = this.cells[g.y][c];
        const p = panelCell(cell.revealKind);
        p.chain = true;
        p.chainGrace = TIMING.chainGrace;
        this.cells[g.y][c] = p;
        for (let r = g.y + 1; r < g.y + g.height; r++) {
          const rest = this.cells[r][c];
          rest.revealKind = EMPTY;
          rest.revealAt = 0;
        }
      }
      g.y++;
      g.height--;
      if (g.height <= 0) this.garbage.delete(g.id);
      else g.state = "idle";
    }
  }

  /** 揃ったパネルに隣接するおじゃまを変身させる。くっついた同種のおじゃまも巻き込む。 */
  private triggerGarbageTransform(matched: { x: number; y: number }[]): void {
    const ids = new Set<number>();
    for (const { x, y } of matched) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= TOTAL_ROWS) continue;
        const id = this.cells[ny][nx].garbage;
        if (id >= 0) ids.add(id);
      }
    }
    // 接している同種ブロックへ伝播
    let grew = true;
    while (grew) {
      grew = false;
      for (const id of [...ids]) {
        const g = this.garbage.get(id);
        if (!g) continue;
        for (const other of this.garbage.values()) {
          if (ids.has(other.id) || other.type !== g.type) continue;
          if (this.blocksTouch(g, other)) {
            ids.add(other.id);
            grew = true;
          }
        }
      }
    }
    // 今回パネルになるのは各板の最下段。原作どおり、そのパネル同士だけで3つ並ぶ柄は選ばない
    // （既存のパネルと合わさって揃うのはよい）。下の板から順に決め、左と下の決まった柄を見て避ける
    const blocks = [...ids]
      .map((id) => this.garbage.get(id))
      .filter((g): g is GarbageBlock => !!g && g.state === "idle")
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const converting = new Set<number>();
    for (const g of blocks) for (let c = g.x; c < g.x + g.width; c++) converting.add(g.y * COLS + c);
    const convertingKind = (x: number, y: number): Kind =>
      x >= 0 && y >= 0 && converting.has(y * COLS + x) ? this.cells[y][x].revealKind : EMPTY;
    for (const g of blocks) {
      g.state = "transforming";
      // 色の抽選順は保ち、見せる時刻だけ下→上・右→左にする。
      for (let r = g.y + g.height - 1; r >= g.y; r--) {
        for (let c = g.x; c < g.x + g.width; c++) {
          const cell = this.cells[r][c];
          if (r === g.y) {
            const banned = new Set<Kind>();
            const left = convertingKind(c - 1, r);
            if (left !== EMPTY && left === convertingKind(c - 2, r)) banned.add(left);
            const below = convertingKind(c, r - 1);
            if (below !== EMPTY && below === convertingKind(c, r - 2)) banned.add(below);
            let k = this.randomKind();
            let guard = 0;
            while (banned.has(k) && guard++ < 32) k = this.randomKind();
            cell.revealKind = k;
          } else {
            cell.revealKind = this.randomKind();
          }
          const revealIndex = (r - g.y) * g.width + (g.x + g.width - 1 - c);
          cell.revealAt = TIMING.transformFlash + revealIndex * TIMING.transformInterval;
        }
      }
      g.transformEnd = TIMING.transformFlash + g.width * g.height * TIMING.transformInterval + clearTiming(this.level).transformHover;
      this.emit({ type: "garbageTransform", id: g.id });
    }
  }

  private blocksTouch(a: GarbageBlock, b: GarbageBlock): boolean {
    const xOverlap = a.x < b.x + b.width && b.x < a.x + a.width;
    const yOverlap = a.y < b.y + b.height && b.y < a.y + a.height;
    const xTouch = a.x + a.width === b.x || b.x + b.width === a.x;
    const yTouch = a.y + a.height === b.y || b.y + b.height === a.y;
    return (xOverlap && yTouch) || (yOverlap && xTouch);
  }

  /**
   * 相手から届いたおじゃまを盤面上部へ投下する。
   * 原作どおり、入れ替え・浮遊・落下・消去・変身のどれかが進んでいる間と、連鎖フラグの付いたパネルが残っている間は降らない。
   * 静止が garbageQuietFrames 続いてから、到着済み（readyAt を過ぎた）の板だけを落とす。
   * 消し続けている限り降らないので、連鎖や同時消しを繋いで粘れる。
   */
  private dropPendingGarbage(): void {
    if (!this.isSettled() || this.hasChainFlag()) {
      this.quietFrames = 0;
      return;
    }
    this.quietFrames++;
    if (this.pendingGarbage.length === 0) return;
    if (this.quietFrames < TIMING.garbageQuietFrames) return;
    const ready = this.pendingGarbage.filter((g) => g.readyAt === undefined || g.readyAt <= this.frame);
    if (ready.length === 0) return;
    const remaining: IncomingGarbage[] = this.pendingGarbage.filter((g) => !ready.includes(g));
    let top = 0;
    for (let r = TOTAL_ROWS - 1; r >= 0; r--) {
      if (this.cells[r].some((c) => !isEmptyCell(c))) {
        top = r + 1;
        break;
      }
    }
    const base = Math.max(ROWS, top);
    const specs = [...ready].sort((a, b) => a.height - b.height || a.width - b.width);
    for (const spec of specs) {
      const width = Math.min(COLS, spec.width);
      let x = 0;
      if (width < COLS) {
        x = this.dropSide === 0 ? 0 : COLS - width;
        this.dropSide ^= 1;
      }
      let y = base;
      while (y + spec.height <= TOTAL_ROWS && this.rectOccupied(x, y, width, spec.height)) y++;
      if (y + spec.height > TOTAL_ROWS) {
        remaining.push(spec);
        continue;
      }
      this.placeGarbage(x, y, width, spec.height, spec.type);
    }
    this.pendingGarbage = remaining;
  }

  private rectOccupied(x: number, y: number, w: number, h: number): boolean {
    for (let r = y; r < y + h; r++) {
      for (let c = x; c < x + w; c++) {
        if (!isEmptyCell(this.cells[r][c])) return true;
      }
    }
    return false;
  }

  /** おじゃまブロックを置く。テストからも呼ぶ。 */
  placeGarbage(x: number, y: number, width: number, height: number, type: GarbageSpec["type"] = "normal"): GarbageBlock {
    const id = this.nextGarbageId++;
    const g: GarbageBlock = {
      id,
      type,
      x,
      y,
      width,
      height,
      state: "falling",
      timer: 0,
      fallTimer: 0,
      transformEnd: 0,
    };
    for (let r = y; r < y + height; r++) {
      for (let c = x; c < x + width; c++) {
        const cell = emptyCell();
        cell.garbage = id;
        this.cells[r][c] = cell;
      }
    }
    this.garbage.set(id, g);
    if (this.garbageResting(g)) g.state = "idle";
    return g;
  }

  // ---------------------------------------------------------------- matches

  private findMatches(): void {
    const matchable = (c: Cell): boolean => isPanel(c) && c.state === "idle";
    const set = new Set<number>();
    const key = (x: number, y: number): number => y * COLS + x;
    for (let y = 0; y < ROWS; y++) {
      let x = 0;
      while (x < COLS) {
        const cell = this.cells[y][x];
        if (!matchable(cell)) {
          x++;
          continue;
        }
        let end = x + 1;
        while (end < COLS && matchable(this.cells[y][end]) && this.cells[y][end].kind === cell.kind) end++;
        if (end - x >= 3) for (let i = x; i < end; i++) set.add(key(i, y));
        x = end;
      }
    }
    for (let x = 0; x < COLS; x++) {
      let y = 0;
      while (y < ROWS) {
        const cell = this.cells[y][x];
        if (!matchable(cell)) {
          y++;
          continue;
        }
        let end = y + 1;
        while (end < ROWS && matchable(this.cells[end][x]) && this.cells[end][x].kind === cell.kind) end++;
        if (end - y >= 3) for (let i = y; i < end; i++) set.add(key(x, i));
        y = end;
      }
    }
    if (set.size === 0) return;

    const list = [...set]
      .map((k) => ({ x: k % COLS, y: Math.floor(k / COLS) }))
      .sort((a, b) => b.y - a.y || a.x - b.x);
    const n = list.length;
    const chaining = list.some(({ x, y }) => this.cells[y][x].chain);
    let chainNow = 1;
    if (chaining) {
      this.chain++;
      chainNow = this.chain;
      this.maxChain = Math.max(this.maxChain, chainNow);
      this.stats.chains++;
    }
    if (n >= 4) this.stats.combos++;

    const gained = matchScore(n, chainNow);
    this.score = capScore(this.score + gained);
    const beforeCleared = this.panelsCleared;
    this.panelsCleared += n;
    // 消した枚数が shockEvery の倍数を跨ぐたびに、次のせり上がり行へビックリパネルを1枚予約する
    if (
      this.shockMax > this.stats.shockSpawned &&
      Math.floor(this.panelsCleared / this.shockEvery) > Math.floor(beforeCleared / this.shockEvery)
    ) {
      this.shockDue = true;
    }

    let stop = 0;
    if (n >= 4) stop += TIMING.stopComboBase + (n - 4) * TIMING.stopComboPerExtra;
    if (chainNow >= 2) stop += TIMING.stopChainBase + (chainNow - 2) * TIMING.stopChainPerExtra;
    if (this.panic) stop *= TIMING.stopDangerMultiplier;
    stop = Math.min(TIMING.stopMax, stop);
    if (stop > 0) {
      this.stopTimer = Math.max(this.stopTimer, stop);
      this.stopRaiseFree = true;
    }

    // ビックリパネル同士の消去は灰色の板を送る（3個消しでも送れる）。通常パネルの同時消しは幅 n-1 の板。
    // 連鎖の板はここでは送らない。原作どおり1つの連鎖につき1枚で、連鎖が終わったときに最終連鎖数で送る（updateChainEnd）
    const shockCount = list.filter(({ x, y }) => this.cells[y][x].kind === SHOCK_KIND).length;
    const normalCount = n - shockCount;
    this.stats.shockCleared += shockCount;
    // 同時消しの板はすぐには送らず、garbageSendDelay 待つ。待っている間の同時消しは合流して待ち直す（原作どおり）
    const attack = [...garbageFromCombo(normalCount), ...garbageFromShock(shockCount)];
    if (attack.length > 0) {
      this.outbox.push(...attack);
      this.outboxAt = this.frame + TIMING.garbageSendDelay;
    }

    const ct = clearTiming(this.level);
    list.forEach(({ x, y }, i) => {
      const cell = this.cells[y][x];
      cell.state = "matched";
      cell.chain = false;
      cell.flashTimer = ct.flash;
      cell.popAt = ct.flash + ct.face + i * ct.popInterval;
      cell.removeAt = ct.flash + ct.face + n * ct.popInterval + TIMING.popTail;
    });
    this.emit({ type: "match", panels: n, chain: chainNow, x: list[0].x, y: list[0].y, score: gained });
    this.triggerGarbageTransform(list);
    this.updateLevel();
  }

  /**
   * スピードレベル。消した枚数（PANELS_PER_LEVEL 枚ごと）と経過時間（FRAMES_PER_LEVEL ごと）の高い方で決まり、下がらない。
   * パズル以外（speedUp）。対戦では Game が2つの盤面を高い方に揃える。
   */
  private updateLevel(): void {
    if (!this.speedUp) return;
    const byPanels = this.startLevel + Math.floor(this.panelsCleared / PANELS_PER_LEVEL);
    const byTime = this.startLevel + Math.floor(this.frame / FRAMES_PER_LEVEL);
    this.raiseLevel(Math.max(byPanels, byTime));
  }

  /** スピードレベルを lv まで上げる。今より低ければ何もしない。対戦で相手の盤面に揃えるのにも使う。 */
  raiseLevel(lv: number): void {
    const next = Math.min(99, Math.max(this.level, lv));
    if (next === this.level) return;
    this.level = next;
    this.emit({ type: "levelUp", level: next });
  }

  /** 着地して揃わなかったパネルの連鎖フラグを落とす。真下が入れ替え中なら判定を待つ。 */
  private clearStaleChainFlags(): void {
    for (let r = 0; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r][c];
        if (!isPanel(cell) || !cell.chain || cell.state !== "idle") continue;
        const below = r > 0 ? this.cells[r - 1][c] : null;
        if (below && isPanel(below) && below.state === "swapping") continue;
        if (cell.chainGrace > 0) {
          cell.chainGrace--;
          continue;
        }
        cell.chain = false;
      }
    }
  }

  private updateChainEnd(): void {
    if (this.chain <= 1) return;
    if (this.hasMatched() || this.hasTransforming() || this.hasChainFlag()) return;
    // 連鎖の板は連鎖が終わってから1枚だけ送る。段階ごとに送ると 7連鎖で 1+2+…+6=21段になり、相手が一瞬で負ける。
    // 連鎖中に待ちが明けていた同時消しの板も、このとき一緒に送る
    this.send([...this.heldForChain, ...garbageFromChain(this.chain)]);
    this.heldForChain = [];
    this.emit({ type: "chainEnd", chain: this.chain });
    this.chain = 1;
  }

  /** 待ちが明けた同時消しの板を送る。自分の連鎖中なら連鎖の終わりまで持つ。 */
  private updateOutbox(): void {
    if (this.outbox.length === 0 || this.frame < this.outboxAt) return;
    const specs = this.outbox;
    this.outbox = [];
    if (this.chain > 1) this.heldForChain.push(...specs);
    else this.send(specs);
  }

  private send(specs: GarbageSpec[]): void {
    if (specs.length === 0) return;
    this.attacksOut.push(...specs);
    this.emit({ type: "attack", garbage: specs });
  }

  private hasChainFlag(): boolean {
    for (let r = 0; r < TOTAL_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.cells[r][c];
        if (isPanel(cell) && cell.chain) return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------------- rise

  private updateRise(input: Input): void {
    if (this.stopTimer > 0) this.stopTimer--;
    if (this.shakeTimer > 0) this.shakeTimer--;
    const busy = this.hasMatched() || this.hasTransforming();
    const touching = this.topTouching();
    let manual = false;
    // Clearing pauses automatic rise only; the player can still choose to raise.
    if (input.raise && this.movesLeft === null && this.shakeTimer === 0 && !touching) {
      this.riseProgress += 1 / TIMING.manualRisePerRow;
      manual = true;
    } else if (!this.noRise && !busy && this.shakeTimer === 0 && !touching && this.stopTimer === 0) {
      this.riseProgress += 1 / riseFramesPerRow(this.level);
    }
    if (this.riseProgress >= 1) {
      this.riseProgress -= 1;
      this.shiftUp();
      if (manual) {
        this.stats.manualRows++;
        if (this.stopTimer > 0 && this.stopRaiseFree) this.stopRaiseFree = false;
        else this.score = capScore(this.score + 1);
      }
    }
  }

  private shiftUp(): void {
    for (let r = TOTAL_ROWS - 1; r >= 1; r--) this.cells[r] = this.cells[r - 1];
    this.cells[0] = this.nextRow.map((k) => panelCell(k));
    for (const g of this.garbage.values()) g.y++;
    this.cursor.y = Math.min(ROWS - 1, this.cursor.y + 1);
    this.risenRows++;
    this.nextRow = this.generateRow();
  }

  // ----------------------------------------------------------------- status

  private updateStatus(): void {
    const touching = this.topTouching();
    const busy = this.hasMatched() || this.hasTransforming();
    if (touching && !busy) {
      this.deathTimer++;
      if (this.deathTimer > TIMING.deathGrace) {
        this.gameOver = true;
        this.emit({ type: "gameOver" });
      }
    } else if (!touching) {
      this.deathTimer = 0;
    }
    if (touching !== this.panic) {
      this.panic = touching;
      this.emit({ type: "panic", on: touching });
    }
    let danger = false;
    for (let r = DANGER_ROW; r < ROWS && !danger; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!isEmptyCell(this.cells[r][c])) {
          danger = true;
          break;
        }
      }
    }
    if (danger !== this.danger) {
      this.danger = danger;
      this.emit({ type: "danger", on: danger });
    }
  }
}
