"""PWA 用のアイコンを tools/icon-source.png から書き出す。

実行: python3 tools/make-icons.py  → public/icons/ に PNG を書き出す（Pillow が要る: pip install pillow）

通常のアイコンと apple-touch-icon は元絵をそのまま縮める。
maskable は Android が中央 80% の円で切り抜くので、絵を 80% に縮めて外側を空の色で埋める。
空の色は元絵の左端の列を横に伸ばして作り、縮めた絵の縁をぼかして継ぎ目を隠す。
"""

from PIL import Image, ImageFilter

SRC = "tools/icon-source.png"
OUT = "public/icons"
SAFE = 0.8
FEATHER = 0.05


def plain(src: Image.Image, size: int) -> Image.Image:
    return src.resize((size, size), Image.LANCZOS)


def maskable(src: Image.Image, size: int) -> Image.Image:
    w, h = src.size
    strip = src.crop((0, 0, 8, h)).resize((1, h), Image.LANCZOS)
    sky = strip.resize((size, size), Image.LANCZOS)
    inner = round(size * SAFE)
    art = plain(src, inner)
    mask = Image.new("L", (inner, inner), 0)
    edge = round(inner * FEATHER)
    mask.paste(255, (edge, edge, inner - edge, inner - edge))
    mask = mask.filter(ImageFilter.GaussianBlur(edge / 2))
    off = (size - inner) // 2
    sky.paste(art, (off, off), mask)
    return sky


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    for name, size, fn in [
        ("icon-192.png", 192, plain),
        ("icon-512.png", 512, plain),
        ("icon-maskable-512.png", 512, maskable),
        ("apple-touch-icon.png", 180, plain),
    ]:
        fn(src, size).save(f"{OUT}/{name}", optimize=True)
        print(f"{OUT}/{name}")


if __name__ == "__main__":
    main()
