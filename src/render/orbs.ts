/** 漂う光の玉の数。多いと盤面の邪魔になる */
const ORB_COUNT = 10;

interface Orb {
  el: HTMLDivElement;
  /** 画面（viewport）の px。玉の中心 */
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
  scale: number;
}

/**
 * 背景の空に浮かぶ光の玉。canvas ではなく body 直下の固定要素（#orbs）に置く。
 * canvas は画面の比率に合わせて縮むので、その外の余白（PC の横長の窓、縦長のスマホの上下）には
 * canvas の絵が届かず、玉が canvas の縁で切れて見えていた。空と同じく画面全体を覆う DOM に置けば、余白にも続く。
 * 位置の更新は Background.update から毎フレーム行う（ポーズ中は止まる）。10 個の transform の更新は軽い。
 */
class OrbField {
  private root: HTMLDivElement | null = null;
  private readonly orbs: Orb[] = [];
  private t = 0;

  private ensure(): void {
    if (this.root || typeof document === "undefined") return;
    this.root = document.createElement("div");
    this.root.id = "orbs";
    document.body.prepend(this.root);
    const W = window.innerWidth;
    const H = window.innerHeight;
    // 論理 300px の縦持ちで決めた大きさを、画面の短辺に合わせて拡大する（PC の大きな窓でも 2 倍まで）
    const k = Math.min(2, Math.max(1, Math.min(W, H) / 300));
    // 玉の初期位置は決め打ちの擬似乱数で散らす（毎回同じ配置なら、e2e のスクリーンショットが揺れない）
    let seed = 7;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < ORB_COUNT; i++) {
      const size = (24 + rnd() * 70) * k;
      const el = document.createElement("div");
      el.className = "orb";
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.opacity = String(0.25 + rnd() * 0.3);
      this.root.append(el);
      this.orbs.push({ el, x: rnd() * W, y: rnd() * H, size, speed: (4 + rnd() * 10) * k, phase: rnd() * Math.PI * 2, scale: 1 });
    }
    this.place();
  }

  private place(): void {
    for (const o of this.orbs) {
      o.el.style.transform = `translate3d(${(o.x - o.size / 2).toFixed(1)}px, ${(o.y - o.size / 2).toFixed(1)}px, 0) scale(${o.scale.toFixed(3)})`;
    }
  }

  /** 毎フレーム呼ぶ。delta は ms、swell は拍で膨らむ量（0〜1） */
  update(delta: number, swell: number): void {
    this.ensure();
    if (!this.root || delta <= 0) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    this.t += delta / 1000;
    for (const o of this.orbs) {
      o.y -= (o.speed * delta) / 1000;
      o.x += Math.sin(this.t * 0.6 + o.phase) * 0.009 * delta;
      if (o.y < -o.size) {
        o.y = H + o.size;
        o.x = Math.random() * W;
      }
      o.scale = 1 + swell * 0.18;
    }
    this.place();
  }

  /** e2e 用。位置と大きさ */
  get list(): readonly { x: number; y: number; scale: number }[] {
    this.ensure();
    return this.orbs;
  }
}

export const orbField = new OrbField();
