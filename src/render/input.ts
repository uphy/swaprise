import Phaser from "phaser";
import type { Input } from "../core";
import type { TouchInput } from "./touch";

export interface KeyMap {
  up: string;
  down: string;
  left: string;
  right: string;
  swap: string[];
  raise: string[];
}

export const P1_KEYS: KeyMap = {
  up: "UP",
  down: "DOWN",
  left: "LEFT",
  right: "RIGHT",
  swap: ["Z", "SPACE", "ENTER"],
  raise: ["X", "SHIFT"],
};

export const P2_KEYS: KeyMap = {
  up: "W",
  down: "S",
  left: "A",
  right: "D",
  swap: ["F", "G"],
  raise: ["H", "R"],
};

const DAS_DELAY = 10;
const DAS_REPEAT = 3;

/**
 * キーボードとゲームパッドを1人分の Input に変換する。
 * 移動は押した瞬間に1回、押し続けると一定間隔で繰り返す。入れ替えは押した瞬間だけ。
 */
export class PlayerInput {
  private subscriptions: [Phaser.Input.Keyboard.Key, () => void][] = [];
  private keys: Record<string, Phaser.Input.Keyboard.Key[]> = {};
  private held: Record<string, number> = { up: 0, down: 0, left: 0, right: 0 };
  /** 前回の poll 以降に押された（tick より短いタップも拾う）。 */
  private pressed: Record<string, boolean> = {};
  private swapWasDown = false;
  padIndex: number;
  /** タッチ操作。あればキーボード・パッドと合成する。 */
  touch: TouchInput | null = null;
  /** 直前の poll でせり上げが押されていたか（描画のヒント用）。 */
  lastRaise = false;

  constructor(
    private scene: Phaser.Scene,
    map: KeyMap,
    padIndex: number,
  ) {
    this.padIndex = padIndex;
    const kb = scene.input.keyboard!;
    const add = (codes: string[]): Phaser.Input.Keyboard.Key[] =>
      codes.map((c) => kb.addKey(Phaser.Input.Keyboard.KeyCodes[c as keyof typeof Phaser.Input.Keyboard.KeyCodes]));
    this.keys = {
      up: add([map.up]),
      down: add([map.down]),
      left: add([map.left]),
      right: add([map.right]),
      swap: add(map.swap),
      raise: add(map.raise),
    };
    for (const [name, keys] of Object.entries(this.keys)) {
      for (const k of keys) {
        const handler = () => { this.pressed[name] = true; };
        k.on("down", handler);
        this.subscriptions.push([k, handler]);
      }
    }
  }

  destroy(): void {
    for (const [key, handler] of this.subscriptions) key.off("down", handler);
    this.subscriptions = [];
  }

  reset(): void {
    this.pressed = {};
    this.held = { up: 0, down: 0, left: 0, right: 0 };
    this.swapWasDown = this.isDown("swap");
    this.touch?.clear();
  }

  private pad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const gp = this.scene.input.gamepad;
    if (!gp || gp.total <= this.padIndex) return undefined;
    return gp.getPad(this.padIndex) ?? undefined;
  }

  private isDown(name: string): boolean {
    if (this.keys[name].some((k) => k.isDown)) return true;
    const pad = this.pad();
    if (!pad) return false;
    const axisX = pad.axes.length > 0 ? pad.axes[0].getValue() : 0;
    const axisY = pad.axes.length > 1 ? pad.axes[1].getValue() : 0;
    switch (name) {
      case "up":
        return pad.up || axisY < -0.5;
      case "down":
        return pad.down || axisY > 0.5;
      case "left":
        return pad.left || axisX < -0.5;
      case "right":
        return pad.right || axisX > 0.5;
      case "swap":
        return Boolean(pad.A) || Boolean(pad.B);
      case "raise":
        return Boolean(pad.L1) || Boolean(pad.R1) || pad.L2 > 0.5 || pad.R2 > 0.5;
    }
    return false;
  }

  /** 1フレーム分の入力を取り出す。60fpsの固定tickごとに1回呼ぶ。 */
  poll(): Input {
    const dir = (name: string): boolean => {
      const tapped = this.pressed[name];
      this.pressed[name] = false;
      if (!this.isDown(name)) {
        this.held[name] = 0;
        return tapped;
      }
      const t = this.held[name]++;
      return t === 0 || (t >= DAS_DELAY && (t - DAS_DELAY) % DAS_REPEAT === 0);
    };
    const left = dir("left");
    const right = dir("right");
    const up = dir("up");
    const down = dir("down");
    const swapDown = this.isDown("swap");
    const swap = (swapDown && !this.swapWasDown) || this.pressed.swap === true;
    this.pressed.swap = false;
    this.swapWasDown = swapDown;
    const input: Input = {
      moveX: left && !right ? -1 : right && !left ? 1 : 0,
      moveY: up && !down ? 1 : down && !up ? -1 : 0,
      swap,
      raise: this.isDown("raise"),
    };
    if (this.touch) {
      const t = this.touch.poll();
      input.raise = input.raise || t.raise;
      if (t.action) {
        input.cursorTo = t.action.cursorTo;
        input.swap = input.swap || t.action.swap;
        if (t.action.cursorTo) {
          input.moveX = 0;
          input.moveY = 0;
        }
      }
    }
    this.lastRaise = input.raise;
    return input;
  }
}
