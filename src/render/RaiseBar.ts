import Phaser from "phaser";

/**
 * 盤面の下に置く、押している間だけ手動でせり上げるバー。
 * メニューのボタンと同じ角丸・半透明の白で塗り、中央に上向きの山形を 1 つ描く。
 * せり上げ中（このバー・2本指・キー・ゲームパッドのどれでも）は黄色に点灯し、山形が上へ流れ続ける。
 * 当たり判定は描いた高さより上下に広げ、指の大きさ（44dp 以上）を確保する。
 */
export class RaiseBar extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly glyph: Phaser.GameObjects.Graphics;
  private barW = 0;
  private barH = 0;
  private raising = false;
  /** 山形の流れの位相（0〜1）。 */
  private phase = 0;

  constructor(scene: Phaser.Scene, onPress: (pointer: Phaser.Input.Pointer) => void) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.glyph = scene.add.graphics();
    this.add([this.bg, this.glyph]);
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

  private paint(): void {
    const g = this.bg;
    const w = this.barW;
    const h = this.barH;
    const r = Math.min(12, h / 2);
    g.clear();
    if (this.raising) {
      g.fillStyle(0xffe066, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.lineStyle(2, 0xfff4bf, 1);
    } else {
      g.fillStyle(0xffffff, 0.16);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.lineStyle(2, 0xffffff, 0.5);
    }
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    this.drawGlyph();
  }

  /**
   * 山形を描く。待機中は中央に 1 つ。せり上げ中は等間隔に並べて上へ流し、バーの上下の縁で薄くなる。
   */
  private drawGlyph(): void {
    const g = this.glyph;
    const h = this.barH;
    const half = Math.min(9, h * 0.3);
    const rise = half * 0.55;
    g.clear();
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
