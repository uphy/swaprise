import Phaser from "phaser";

/**
 * canvas に描く Fredoka の文字でカーニングを切る。
 * 同梱の Fredoka は I と V の組を詰めすぎ、大文字の「IV」が「M」に見える（ACTIVE CHAIN が ACTME CHAIN に読める）。
 * 合字を切っても直らず、カーニングを切ると直る。HTML の結果画面などは score-dialog.css / online.css の font-kerning: none で同じことをしている。
 * Phaser の Text は canvas の大きさを変えるたびに文脈がリセットされ、そのあと必ず syncFont を呼び直すので、そこで毎回切る
 */
export function installNoKerningText(): void {
  const style = Phaser.GameObjects.TextStyle.prototype as unknown as {
    syncFont: (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => void;
    _font: string;
  };
  const original = style.syncFont;
  style.syncFont = function (this: typeof style, canvas, context) {
    original.call(this, canvas, context);
    if (this._font.includes("Fredoka") && "fontKerning" in context) context.fontKerning = "none";
  };
}
