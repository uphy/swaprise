import Phaser from "phaser";
import { FONT_UI, STOP_COLORS } from "./theme";

/** 文字の縁取りの色（HUD の文字の影と同じ夜空の紺） */
const INK = "#1c1238";

/**
 * 盤面の下に置く、押している間だけ手動でせり上げるバー。
 * HUD の札と同じ濃紺の半透明の角丸で塗り、中央に上向きの山形を 1 つ描く。
 * せり上げ中（このバー・2本指・キー・ゲームパッドのどれでも）は黄色に点灯し、山形が上へ流れ続ける。
 * 当たり判定は描いた高さより上下に広げ、指の大きさ（44dp 以上）を確保する。
 *
 * せり上がりが止まっている間（連鎖・同時消しの見返り）は、バーを「STOP 7.3s」と残りのゲージに切り替える。
 * ゲージは与えた停止の長さのうちの残りで、左から右へ縮む。危険な状態で消して 2 倍になったときは赤くし、「PINCH ×2」を添える。
 * 止まっている間もバーは押せて、押している間はせり上げの点灯を優先する。押せることが分かるよう、ゲージの右端に小さな山形を残し、文字はその左に収める
 */
export class RaiseBar extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly glyph: Phaser.GameObjects.Graphics;
  private barW = 0;
  private barH = 0;
  private raising = false;
  /** 山形の流れの位相（0〜1）。 */
  private phase = 0;
  /** 停止の残りと、与えた長さ（フレーム）。危険な状態で消して 2 倍になったか */
  private stopLeft = 0;
  private stopTotal = 0;
  private stopPinch = false;
  /** 停止を新たに得た瞬間の白い閃き（1→0） */
  private stopFlash = 0;
  /** 停止の文字。e2e が読む */
  readonly stopText: Phaser.GameObjects.Text;
  /** 停止中にゲージの右端へ残す山形の範囲（バーの中心基準の x と半幅）。出していなければ null。e2e が読む */
  stopGlyph: { x: number; half: number } | null = null;

  constructor(scene: Phaser.Scene, onPress: (pointer: Phaser.Input.Pointer) => void) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.glyph = scene.add.graphics();
    this.stopText = scene.add
      .text(0, 0, "", { fontFamily: FONT_UI, fontSize: "14px", fontStyle: "700", color: "#ffffff", stroke: INK, strokeThickness: 4, align: "center" })
      .setOrigin(0.5)
      .setVisible(false);
    this.add([this.bg, this.glyph, this.stopText]);
    this.on("pointerdown", (p: Phaser.Input.Pointer) => onPress(p));
    scene.add.existing(this);
  }

  /** 大きさを決めて描き直す。hitH は当たり判定の高さで、描く高さより大きくてよい。 */
  resize(w: number, h: number, hitH = h): this {
    this.barW = w;
    this.barH = h;
    const hit = Math.max(h, hitH);
    this.setSize(w, hit);
    // 形を渡さずに setInteractive すると、Phaser が setSize の大きさを Container の中心基準で当たり判定にする
    // （形を自分で渡すと中心へのずらしが二重にかかり、左へずれた）。大きさが変わるたびに作り直す
    if (this.input) this.removeInteractive();
    this.setInteractive({ useHandCursor: true });
    this.paint();
    return this;
  }

  /** せり上げ中かどうかを毎フレーム知らせる。delta はミリ秒。 */
  setRaising(on: boolean, delta: number): void {
    if (on) this.phase = (this.phase + delta / 420) % 1;
    else if (this.phase !== 0) this.phase = 0;
    if (on !== this.raising) {
      this.raising = on;
      this.paint();
    }
    this.drawGlyph();
  }

  /**
   * 停止の残りを毎フレーム知らせる（フレーム数）。left が 0 なら元のせり上げバーに戻す。
   * total は与えた停止の長さ、pinch は危険な状態で消して 2 倍になったか
   */
  setStop(left: number, total: number, pinch: boolean, delta: number): void {
    const was = this.stopLeft;
    // 新しく得た（残りが増えた）瞬間だけ閃かせる
    if (left > was + 1) this.stopFlash = 1;
    else if (this.stopFlash > 0) this.stopFlash = Math.max(0, this.stopFlash - delta / 350);
    this.stopLeft = left;
    this.stopTotal = Math.max(left, total);
    this.stopPinch = pinch;
    if (left > 0 || was > 0) this.paint();
  }

  /** 停止のゲージを出しているか。e2e が読む */
  get stopping(): boolean {
    return this.stopLeft > 0 && !this.raising;
  }

  private paint(): void {
    const g = this.bg;
    const w = this.barW;
    const h = this.barH;
    const r = Math.min(12, h / 2);
    g.clear();
    this.stopText.setVisible(this.stopping);
    if (this.stopping) {
      this.paintStop(r);
      this.drawGlyph();
      return;
    }
    if (this.raising) {
      // 点灯。黄色の板に、下の濃い厚みと上の光
      g.fillStyle(0xc99a1c, 1);
      g.fillRoundedRect(-w / 2, -h / 2 + 2, w, h, r);
      g.fillStyle(0xffe066, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.fillStyle(0xffffff, 0.4);
      g.fillRoundedRect(-w / 2 + 4, -h / 2 + 2, w - 8, h * 0.35, { tl: r - 2, tr: r - 2, bl: 2, br: 2 });
      g.lineStyle(1.5, 0xfff4bf, 1);
    } else {
      // 待機。HUD の札と同じ濃紺の半透明
      g.fillStyle(0x120c2c, 0.55);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.fillStyle(0xffffff, 0.06);
      g.fillRoundedRect(-w / 2 + 3, -h / 2 + 2, w - 6, h * 0.4, { tl: r - 2, tr: r - 2, bl: 2, br: 2 });
      g.lineStyle(1, 0xffffff, 0.3);
    }
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    this.drawGlyph();
  }

  /** 停止のゲージ。濃紺の地に、残りの割合だけ水色（2 倍なら赤）の板を左から塗り、中央に STOP と残りの秒数 */
  private paintStop(r: number): void {
    const g = this.bg;
    const w = this.barW;
    const h = this.barH;
    const c = this.stopPinch ? STOP_COLORS.pinch : STOP_COLORS.normal;
    g.fillStyle(0x120c2c, 0.7);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    const fw = Math.max(0, Math.min(1, this.stopLeft / Math.max(1, this.stopTotal))) * (w - 4);
    if (fw > 1) {
      const fr = Math.min(r - 2, fw / 2, (h - 4) / 2);
      g.fillStyle(c.fill, 0.85);
      g.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, fw, h - 4, fr);
      g.fillStyle(0xffffff, 0.28);
      g.fillRoundedRect(-w / 2 + 4, -h / 2 + 3, Math.max(0, fw - 4), (h - 4) * 0.35, { tl: Math.max(0, fr - 1), tr: Math.max(0, fr - 1), bl: 1, br: 1 });
    }
    if (this.stopFlash > 0) {
      g.fillStyle(0xffffff, 0.55 * this.stopFlash);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    }
    g.lineStyle(1.5, c.light, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    // 秒は 0.1 秒刻みで切り上げる（0 になる前に「0.0s」を見せない）
    const secs = (Math.ceil((this.stopLeft / 60) * 10) / 10).toFixed(1);
    const stop = `STOP ${secs}s`;
    const size = Math.max(11, Math.min(15, Math.round(h * 0.5)));
    const t = this.stopText;
    // 2 倍のときは「PINCH ×2」を添える。1 行に収まらなければ、背の高いバーは 2 行に、低いバーは STOP の見出しを省く。
    // 並べ方はバーの大きさで決まるので、大きさが変わったときだけ測り直す（毎フレーム文字を描き直さない）
    let text = stop;
    let fontSize = size;
    if (this.stopPinch) {
      const key = `${w}x${h}`;
      if (this.pinchFitKey !== key) {
        this.pinchFitKey = key;
        t.setFontSize(size).setText("PINCH ×2   STOP 12.0s");
        this.pinchFit = t.width <= w - 12 - this.stopGlyphSpace() ? "line" : h >= 36 ? "stack" : "short";
      }
      if (this.pinchFit === "line") text = `PINCH ×2   ${stop}`;
      else if (this.pinchFit === "stack") {
        text = `PINCH ×2\n${stop}`;
        fontSize = Math.min(size, Math.floor(h / 2.6));
      } else text = `PINCH ×2  ${secs}s`;
    }
    if (t.style.fontSize !== `${fontSize}px`) t.setFontSize(fontSize);
    if (t.text !== text) t.setText(text);
    // 文字は右端の山形の左の幅に収める。収まらなければ縮め、閃きで大きくするときも山形に重ねない
    const room = w - this.stopGlyphSpace() - 8;
    t.setX(-this.stopGlyphSpace() / 2);
    t.setScale(Math.min(1 + this.stopFlash * 0.25, room / Math.max(1, t.width)));
  }

  /** 停止中の山形の半幅。待機中より小さく、バーの右端に置く */
  private stopGlyphHalf(): number {
    return Math.min(6, this.barH * 0.22);
  }

  /** 停止中に右端の山形が占める幅（山形と左右の余白） */
  private stopGlyphSpace(): number {
    return this.stopGlyphHalf() * 2 + 12;
  }
  private pinchFitKey = "";
  private pinchFit: "line" | "stack" | "short" = "line";

  /**
   * 山形を描く。待機中は中央に 1 つ。せり上げ中は等間隔に並べて上へ流し、バーの上下の縁で薄くなる。
   */
  private drawGlyph(): void {
    const g = this.glyph;
    const h = this.barH;
    const half = Math.min(9, h * 0.3);
    const rise = half * 0.55;
    g.clear();
    if (this.stopping) {
      // 止まっている間もせり上げられることを、ゲージの右端の小さな山形で見せる。濃い縁を敷いて、水色・赤のゲージの上でも白い山形が読めるようにする
      const sh = this.stopGlyphHalf();
      const sr = sh * 0.6;
      const x = this.barW / 2 - 6 - sh;
      this.stopGlyph = { x, half: sh };
      for (const [width, color, alpha] of [[4.5, 0x120c2c, 0.6], [2.2, 0xffffff, 0.9]] as const) {
        g.lineStyle(width, color, alpha);
        g.beginPath();
        g.moveTo(x - sh, sr / 2);
        g.lineTo(x, -sr / 2);
        g.lineTo(x + sh, sr / 2);
        g.strokePath();
      }
      return;
    }
    this.stopGlyph = null;
    const chevron = (cy: number, alpha: number): void => {
      g.lineStyle(2.5, this.raising ? 0x2a2050 : 0xffffff, alpha);
      g.beginPath();
      g.moveTo(-half, cy + rise / 2);
      g.lineTo(0, cy - rise / 2);
      g.lineTo(half, cy + rise / 2);
      g.strokePath();
    };
    if (!this.raising) {
      chevron(0, 0.85);
      return;
    }
    const spacing = rise + 5;
    const count = Math.ceil(h / spacing) + 2;
    const edge = h / 2 - 3;
    for (let k = -count; k <= count; k++) {
      const cy = k * spacing - this.phase * spacing;
      if (Math.abs(cy) > edge) continue;
      const fade = Math.min(1, (edge - Math.abs(cy)) / (spacing * 1.2));
      chevron(cy, 0.95 * fade);
    }
  }
}
