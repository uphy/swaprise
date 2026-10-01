import Phaser from "phaser";

/**
 * canvas に描く Fredoka の大文字だけの行（見出し・ラベル）で、カーニングを切る。
 * 同梱の Fredoka は I と V の組を詰めすぎ、大文字の「IV」が「M」に見える（ACTIVE CHAIN が ACTME CHAIN に読める）。
 * 合字を切っても直らず、カーニングを切ると直る。HTML の結果画面などは score-dialog.css / online.css の font-kerning: none で同じことをしている。
 * 小文字の説明文まで切ると字間が広がって行数が増え、背の低い縦持ちでレッスンの説明の最後の行が画面の下に切れたので、
 * 小文字を含む行（「IV」の組を含むものを除く）は通常のカーニングで描く。
 * Phaser の Text は 1 行ずつ measureText / fillText / strokeText を呼ぶので、その文脈の関数を包んで行ごとに切り替える。
 * 大文字だけの行は、あわせて字間を CAPS_TRACKING だけ広げる
 */
export function noKerningFor(text: string): boolean {
  return text.includes("IV") || (/[A-Z]/.test(text) && !/[a-z]/.test(text));
}

/**
 * 大文字だけの行に足す字間（文字の大きさに対する割合）。同梱の Fredoka の太字は字幅が詰まっていて、
 * 名前の札の「1P」は 1 と P が、札の「SPEED」は E と E がくっついて見えた。小文字を含む行は今の字間のまま。
 * 詰まって見えるのは小さい文字（札・ボタン・見出し）なので、CAPS_TRACKING_MAX_PX 以上の大きな文字（連鎖の締めの「10 CHAIN」、
 * メニューのカードの名前）は広げない。締めは盤面の幅に収まるよう縮めているので、広げると 10 連鎖の見出しが 8 連鎖より小さくなった
 */
export const CAPS_TRACKING = 0.08;
export const CAPS_TRACKING_MAX_PX = 24;

export function trackingFor(text: string): boolean {
  return /[A-Z]/.test(text) && !/[a-z]/.test(text);
}

const WRAPPED = Symbol("swaprise.kerning");

function wrapContext(context: CanvasRenderingContext2D): void {
  const c = context as CanvasRenderingContext2D & { [WRAPPED]?: true };
  if (c[WRAPPED] || !("fontKerning" in c)) return;
  c[WRAPPED] = true;
  const fredoka = () => c.font.includes("Fredoka");
  const set = (text: string) => {
    c.fontKerning = fredoka() && noKerningFor(text) ? "none" : "normal";
  };
  /** 大文字だけの Fredoka の行なら 1 字ごとに足す幅（px）。そうでなければ 0 */
  const tracking = (text: string): number => {
    if (!fredoka() || text.length < 2 || !trackingFor(text)) return 0;
    const px = Number(/(\d+(?:\.\d+)?)px/.exec(c.font)?.[1] ?? 0);
    return px >= CAPS_TRACKING_MAX_PX ? 0 : px * CAPS_TRACKING;
  };
  const measure = c.measureText.bind(c);
  const fill = c.fillText.bind(c);
  const stroke = c.strokeText.bind(c);
  /**
   * 字間を足して 1 字ずつ描く。canvas の letterSpacing は iOS の Safari で効かない版があり、Phaser の letterSpacing は
   * 1 字ごとに縁取りと塗りを交互に描くので太い縁取りが前の字の塗りに重なる。Phaser は行ごとに縁取りを全部描いてから塗るので、
   * ここで行の中を 1 字ずつ描けば縁取りの重なり方は変わらない
   */
  const spaced = (draw: (t: string, x: number, y: number) => void, text: string, x: number, y: number, extra: number) => {
    const chars = [...text];
    const width = chars.reduce((w, ch) => w + measure(ch).width, 0) + extra * (chars.length - 1);
    const align = c.textAlign;
    let cx = align === "center" ? x - width / 2 : align === "right" || align === "end" ? x - width : x;
    c.textAlign = "left";
    for (const ch of chars) {
      draw(ch, cx, y);
      cx += measure(ch).width + extra;
    }
    c.textAlign = align;
  };
  c.measureText = (text: string) => {
    set(text);
    const m = measure(text);
    const extra = tracking(text);
    if (extra === 0) return m;
    const width = [...text].reduce((w, ch) => w + measure(ch).width, 0) + extra * ([...text].length - 1);
    return new Proxy(m, { get: (t, k) => (k === "width" ? width : Reflect.get(t, k, t)) });
  };
  c.fillText = (text: string, x: number, y: number, maxWidth?: number) => {
    set(text);
    const extra = tracking(text);
    if (extra !== 0 && maxWidth === undefined) return spaced(fill, text, x, y, extra);
    return maxWidth === undefined ? fill(text, x, y) : fill(text, x, y, maxWidth);
  };
  c.strokeText = (text: string, x: number, y: number, maxWidth?: number) => {
    set(text);
    const extra = tracking(text);
    if (extra !== 0 && maxWidth === undefined) return spaced(stroke, text, x, y, extra);
    return maxWidth === undefined ? stroke(text, x, y) : stroke(text, x, y, maxWidth);
  };
}

export function installNoKerningText(): void {
  const style = Phaser.GameObjects.TextStyle.prototype as unknown as {
    syncFont: (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => void;
  };
  const original = style.syncFont;
  style.syncFont = function (this: typeof style, canvas, context) {
    original.call(this, canvas, context);
    wrapContext(context);
  };
}
