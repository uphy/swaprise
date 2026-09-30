import Phaser from "phaser";

/**
 * canvas に描く Fredoka の大文字だけの行（見出し・ラベル）で、カーニングを切る。
 * 同梱の Fredoka は I と V の組を詰めすぎ、大文字の「IV」が「M」に見える（ACTIVE CHAIN が ACTME CHAIN に読める）。
 * 合字を切っても直らず、カーニングを切ると直る。HTML の結果画面などは score-dialog.css / online.css の font-kerning: none で同じことをしている。
 * 小文字の説明文まで切ると字間が広がって行数が増え、背の低い縦持ちでレッスンの説明の最後の行が画面の下に切れたので、
 * 小文字を含む行（「IV」の組を含むものを除く）は通常のカーニングで描く。
 * Phaser の Text は 1 行ずつ measureText / fillText / strokeText を呼ぶので、その文脈の関数を包んで行ごとに切り替える
 */
export function noKerningFor(text: string): boolean {
  return text.includes("IV") || (/[A-Z]/.test(text) && !/[a-z]/.test(text));
}

const WRAPPED = Symbol("swaprise.kerning");

function wrapContext(context: CanvasRenderingContext2D): void {
  const c = context as CanvasRenderingContext2D & { [WRAPPED]?: true };
  if (c[WRAPPED] || !("fontKerning" in c)) return;
  c[WRAPPED] = true;
  const set = (text: string) => {
    c.fontKerning = c.font.includes("Fredoka") && noKerningFor(text) ? "none" : "normal";
  };
  const measure = c.measureText.bind(c);
  const fill = c.fillText.bind(c);
  const stroke = c.strokeText.bind(c);
  c.measureText = (text: string) => (set(text), measure(text));
  c.fillText = (text: string, x: number, y: number, maxWidth?: number) => (set(text), maxWidth === undefined ? fill(text, x, y) : fill(text, x, y, maxWidth));
  c.strokeText = (text: string, x: number, y: number, maxWidth?: number) => (set(text), maxWidth === undefined ? stroke(text, x, y) : stroke(text, x, y, maxWidth));
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
