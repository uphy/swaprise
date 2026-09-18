#!/bin/sh
# バランス調整用のシミュレーションを走らせる。ブラウザも Phaser も使わず、src/core だけを Node で回す。
#   pnpm sim duel      CPU 同士・無操作 vs CPU の対戦。試合時間と攻撃量
#   pnpm sim endless   遅い CPU（人の代わり）と、なぞるだけの swiper にエンドレスを遊ばせる。生存時間・レベルの進み・入れ替えあたりの揃い
#   pnpm sim levels    無操作・遅い CPU を相手にした各難易度の強さ
set -eu
name="${1:-}"
dir="$(cd "$(dirname "$0")" && pwd)"
if [ -z "$name" ] || [ ! -f "$dir/$name.ts" ]; then
  echo "usage: pnpm sim <duel|endless|levels>" >&2
  ls "$dir"/*.ts | sed "s|.*/||; s|\.ts$||" | grep -v "^proxy$" | grep -v "^swiper$" | sed "s/^/  /" >&2
  exit 1
fi
shift
pnpm exec esbuild "$dir/$name.ts" --bundle --platform=node --format=esm --log-level=warning | node --input-type=module - "$@"
