// 自動生成: pnpm assets。正本は assets/characters/。
window.CHARACTER_CATALOG = [
  {
    "id": "nika",
    "name": "ニカ",
    "role": "修理屋見習い",
    "color": "#bc613c",
    "assets": [
      {
        "id": "nika-icon-pixel-v1",
        "label": "顔アイコン · ドット絵",
        "kind": "image",
        "action": "icon",
        "image": "../../../assets/characters/nika/icon/pixel-v1/nika-icon-pixel-v1.png",
        "prompt": "../../../assets/characters/nika/icon/pixel-v1/nika-icon-pixel-v1.prompt.txt",
        "pixelArt": true,
        "status": "ドット絵版へ差し替え",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "notes": "ドット絵の基準立ち絵から顔を切り出し。"
      },
      {
        "id": "nika-portrait-pixel-v2",
        "label": "基準立ち絵 · ドット絵",
        "kind": "image",
        "action": "portrait",
        "image": "../../../assets/characters/nika/portrait/pixel-v2/nika-portrait-pixel-v2.png",
        "prompt": "../../../assets/characters/nika/portrait/pixel-v2/nika-portrait-pixel-v2.prompt.txt",
        "pixelArt": true,
        "status": "ドット絵版へ差し替え",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "notes": "既存のドット絵基準画像から作成。"
      },
      {
        "id": "nika-defeat-pixel-v4-short",
        "label": "敗北 · ドット絵（落胆・9コマ）",
        "action": "defeat",
        "kind": "animation",
        "image": "../../../assets/characters/nika/defeat/pixel-v4/nika-defeat-pixel-v4.png",
        "prompt": "../../../assets/characters/nika/defeat/pixel-v4/nika-defeat-pixel-v4.prompt.txt",
        "status": "採用版",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "コマ数お任せ13コマ版の先頭9コマを使用。座って顔を伏せたところで終了し、後半の立ち上がる動きを除外しています。元画像と13コマ版は保存。リピートをオフにすると最後の姿勢で停止します。",
        "frames": [
          {
            "x": 39,
            "y": 41,
            "width": 188,
            "height": 471,
            "pivotX": 94,
            "baselineY": 467
          },
          {
            "x": 253,
            "y": 73,
            "width": 208,
            "height": 439,
            "pivotX": 104,
            "baselineY": 435
          },
          {
            "x": 471,
            "y": 100,
            "width": 221,
            "height": 412,
            "pivotX": 110.5,
            "baselineY": 408
          },
          {
            "x": 697,
            "y": 128,
            "width": 225,
            "height": 384,
            "pivotX": 112.5,
            "baselineY": 380
          },
          {
            "x": 934,
            "y": 176,
            "width": 269,
            "height": 331,
            "pivotX": 134.5,
            "baselineY": 327
          },
          {
            "x": 1204,
            "y": 216,
            "width": 286,
            "height": 291,
            "pivotX": 143,
            "baselineY": 287
          },
          {
            "x": 37,
            "y": 691,
            "width": 225,
            "height": 280,
            "pivotX": 112.5,
            "baselineY": 276
          },
          {
            "x": 294,
            "y": 697,
            "width": 173,
            "height": 274,
            "pivotX": 86.5,
            "baselineY": 270
          },
          {
            "x": 485,
            "y": 729,
            "width": 196,
            "height": 252,
            "pivotX": 98,
            "baselineY": 248
          }
        ],
        "frameCount": 9,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 0.7,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/defeat/pixel-v4/nika-defeat-pixel-v4-magenta.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-defeat-pixel-v4",
        "label": "敗北 · ドット絵（コマ数お任せ・13コマ）",
        "action": "defeat",
        "kind": "animation",
        "image": "../../../assets/characters/nika/defeat/pixel-v4/nika-defeat-pixel-v4.png",
        "prompt": "../../../assets/characters/nika/defeat/pixel-v4/nika-defeat-pixel-v4.prompt.txt",
        "status": "比較用試作・単色背景を除去",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "落胆という感情のみを指定し、動作・コマ数・配置を生成側に任せた版。上段6・下段7の計13コマ。座り込み、顔を覆い、最後に立ち上がります。各被写体を個別に切り出し、共通倍率と接地位置で表示。体の輪郭中央でXを合わせているため、姿勢による横移動の見え方は要確認です。",
        "frames": [
          {
            "x": 39,
            "y": 41,
            "width": 188,
            "height": 471,
            "pivotX": 94,
            "baselineY": 467
          },
          {
            "x": 253,
            "y": 73,
            "width": 208,
            "height": 439,
            "pivotX": 104,
            "baselineY": 435
          },
          {
            "x": 471,
            "y": 100,
            "width": 221,
            "height": 412,
            "pivotX": 110.5,
            "baselineY": 408
          },
          {
            "x": 697,
            "y": 128,
            "width": 225,
            "height": 384,
            "pivotX": 112.5,
            "baselineY": 380
          },
          {
            "x": 934,
            "y": 176,
            "width": 269,
            "height": 331,
            "pivotX": 134.5,
            "baselineY": 327
          },
          {
            "x": 1204,
            "y": 216,
            "width": 286,
            "height": 291,
            "pivotX": 143,
            "baselineY": 287
          },
          {
            "x": 37,
            "y": 691,
            "width": 225,
            "height": 280,
            "pivotX": 112.5,
            "baselineY": 276
          },
          {
            "x": 294,
            "y": 697,
            "width": 173,
            "height": 274,
            "pivotX": 86.5,
            "baselineY": 270
          },
          {
            "x": 485,
            "y": 729,
            "width": 196,
            "height": 252,
            "pivotX": 98,
            "baselineY": 248
          },
          {
            "x": 704,
            "y": 697,
            "width": 190,
            "height": 284,
            "pivotX": 95,
            "baselineY": 280
          },
          {
            "x": 927,
            "y": 643,
            "width": 211,
            "height": 336,
            "pivotX": 105.5,
            "baselineY": 332
          },
          {
            "x": 1141,
            "y": 590,
            "width": 196,
            "height": 393,
            "pivotX": 98,
            "baselineY": 389
          },
          {
            "x": 1339,
            "y": 542,
            "width": 179,
            "height": 443,
            "pivotX": 89.5,
            "baselineY": 439
          }
        ],
        "frameCount": 13,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 0.7,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/defeat/pixel-v4/nika-defeat-pixel-v4-magenta.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-defeat-pixel-v3-short",
        "label": "敗北 · ドット絵（落胆・14コマ）",
        "action": "defeat",
        "kind": "animation",
        "image": "../../../assets/characters/nika/defeat/pixel-v3/nika-defeat-pixel-v3.png",
        "prompt": "../../../assets/characters/nika/defeat/pixel-v3/nika-defeat-pixel-v3.prompt.txt",
        "status": "比較用試作・単色背景を除去",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "落胆18コマ版の先頭14コマを使用。膝をついて落ち込んだ姿で終了し、顔を覆う後半4コマを除外しています。元画像と18コマ版は保存。画廊は待ち時間なしの連続ループ。ゲーム組み込み時は最後の姿勢を保持する想定です。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 256,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 512,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 768,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 1024,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 1280,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 0,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 325
          },
          {
            "x": 256,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 325
          },
          {
            "x": 512,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 321
          },
          {
            "x": 768,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 321
          },
          {
            "x": 1024,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 321
          },
          {
            "x": 1280,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 323
          },
          {
            "x": 0,
            "y": 753,
            "width": 256,
            "height": 271,
            "pivotX": 128,
            "baselineY": 238
          },
          {
            "x": 256,
            "y": 753,
            "width": 256,
            "height": 271,
            "pivotX": 128,
            "baselineY": 238
          }
        ],
        "frameCount": 14,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 0.9,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/defeat/pixel-v3/nika-defeat-pixel-v3-magenta.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-defeat-pixel-v3",
        "label": "敗北 · ドット絵（落胆・18コマ）",
        "action": "defeat",
        "kind": "animation",
        "image": "../../../assets/characters/nika/defeat/pixel-v3/nika-defeat-pixel-v3.png",
        "prompt": "../../../assets/characters/nika/defeat/pixel-v3/nika-defeat-pixel-v3.prompt.txt",
        "status": "比較用試作・単色背景を除去",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "動作の段階指定を外し「負けて落胆している様子」で生成。うつむく→膝をつく→顔を伏せる演技。吹き出し・記号なし。各段の実際の配置で切り出し、床位置を合わせています。全コマ共通倍率。末尾から先頭への戻りは確認用ループです。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 256,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 512,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 768,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 1024,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 1280,
            "y": 0,
            "width": 256,
            "height": 402,
            "pivotX": 128,
            "baselineY": 391
          },
          {
            "x": 0,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 325
          },
          {
            "x": 256,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 325
          },
          {
            "x": 512,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 321
          },
          {
            "x": 768,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 321
          },
          {
            "x": 1024,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 321
          },
          {
            "x": 1280,
            "y": 402,
            "width": 256,
            "height": 351,
            "pivotX": 128,
            "baselineY": 323
          },
          {
            "x": 0,
            "y": 753,
            "width": 256,
            "height": 271,
            "pivotX": 128,
            "baselineY": 238
          },
          {
            "x": 256,
            "y": 753,
            "width": 256,
            "height": 271,
            "pivotX": 128,
            "baselineY": 238
          },
          {
            "x": 512,
            "y": 753,
            "width": 256,
            "height": 271,
            "pivotX": 128,
            "baselineY": 234
          },
          {
            "x": 768,
            "y": 753,
            "width": 256,
            "height": 271,
            "pivotX": 128,
            "baselineY": 234
          },
          {
            "x": 1024,
            "y": 753,
            "width": 256,
            "height": 271,
            "pivotX": 128,
            "baselineY": 234
          },
          {
            "x": 1280,
            "y": 753,
            "width": 256,
            "height": 271,
            "pivotX": 128,
            "baselineY": 234
          }
        ],
        "frameCount": 18,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 0.9,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/defeat/pixel-v3/nika-defeat-pixel-v3-magenta.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-defeat-pixel-v2",
        "label": "敗北・失敗 · ドット絵（18コマ）",
        "action": "defeat",
        "kind": "animation",
        "image": "../../../assets/characters/nika/defeat/pixel-v2/nika-defeat-pixel-v2.png",
        "prompt": "../../../assets/characters/nika/defeat/pixel-v2/nika-defeat-pixel-v2.prompt.txt",
        "status": "試作・単色背景を除去",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "同じドット絵立ち絵を参照し、中間姿勢を増やして再生成。マゼンタの色範囲を透明化し、靴底の中心と床位置を合わせています。全コマ共通倍率、12fps、末尾の待ち時間なし。輪郭の色残りや動作の細部は比較用の試作です。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 256,
            "height": 341,
            "pivotX": 130,
            "baselineY": 337
          },
          {
            "x": 256,
            "y": 0,
            "width": 256,
            "height": 341,
            "pivotX": 131,
            "baselineY": 337
          },
          {
            "x": 512,
            "y": 0,
            "width": 256,
            "height": 341,
            "pivotX": 132,
            "baselineY": 337
          },
          {
            "x": 768,
            "y": 0,
            "width": 256,
            "height": 341,
            "pivotX": 134.5,
            "baselineY": 337
          },
          {
            "x": 1024,
            "y": 0,
            "width": 256,
            "height": 341,
            "pivotX": 134.5,
            "baselineY": 337
          },
          {
            "x": 1280,
            "y": 0,
            "width": 256,
            "height": 341,
            "pivotX": 136.5,
            "baselineY": 337
          },
          {
            "x": 0,
            "y": 341,
            "width": 256,
            "height": 342,
            "pivotX": 129.5,
            "baselineY": 330
          },
          {
            "x": 256,
            "y": 341,
            "width": 256,
            "height": 342,
            "pivotX": 130.5,
            "baselineY": 330
          },
          {
            "x": 512,
            "y": 341,
            "width": 256,
            "height": 342,
            "pivotX": 131.5,
            "baselineY": 330
          },
          {
            "x": 768,
            "y": 341,
            "width": 256,
            "height": 342,
            "pivotX": 132,
            "baselineY": 330
          },
          {
            "x": 1024,
            "y": 341,
            "width": 256,
            "height": 342,
            "pivotX": 133.5,
            "baselineY": 330
          },
          {
            "x": 1280,
            "y": 341,
            "width": 256,
            "height": 342,
            "pivotX": 136,
            "baselineY": 330
          },
          {
            "x": 0,
            "y": 683,
            "width": 256,
            "height": 341,
            "pivotX": 128,
            "baselineY": 318
          },
          {
            "x": 256,
            "y": 683,
            "width": 256,
            "height": 341,
            "pivotX": 129.5,
            "baselineY": 318
          },
          {
            "x": 512,
            "y": 683,
            "width": 256,
            "height": 341,
            "pivotX": 133,
            "baselineY": 318
          },
          {
            "x": 768,
            "y": 683,
            "width": 256,
            "height": 341,
            "pivotX": 136.5,
            "baselineY": 318
          },
          {
            "x": 1024,
            "y": 683,
            "width": 256,
            "height": 341,
            "pivotX": 140,
            "baselineY": 318
          },
          {
            "x": 1280,
            "y": 683,
            "width": 256,
            "height": 341,
            "pivotX": 141.5,
            "baselineY": 318
          }
        ],
        "frameCount": 18,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 1.04938,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/defeat/pixel-v2/nika-defeat-pixel-v2-magenta.png"
          },
          {
            "label": "参照ドット絵",
            "url": "../../../assets/characters/nika/portrait/pixel-v1/nika-portrait-pixel-v1.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-finish-pixel-v2",
        "label": "通常終了 · ドット絵（12コマ）",
        "action": "finish",
        "kind": "animation",
        "image": "../../../assets/characters/nika/finish/pixel-v2/nika-finish-pixel-v2.png",
        "prompt": "../../../assets/characters/nika/finish/pixel-v2/nika-finish-pixel-v2.prompt.txt",
        "status": "試作・単色背景を除去",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "同じドット絵立ち絵を参照し、中間姿勢を増やして再生成。マゼンタの色範囲を透明化し、靴底の中心と床位置を合わせています。全コマ共通倍率、12fps、末尾の待ち時間なし。輪郭の色残りや動作の細部は比較用の試作です。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 362,
            "height": 362,
            "pivotX": 189.5,
            "baselineY": 356
          },
          {
            "x": 362,
            "y": 0,
            "width": 362,
            "height": 362,
            "pivotX": 183,
            "baselineY": 356
          },
          {
            "x": 724,
            "y": 0,
            "width": 362,
            "height": 362,
            "pivotX": 176.5,
            "baselineY": 356
          },
          {
            "x": 1086,
            "y": 0,
            "width": 362,
            "height": 362,
            "pivotX": 170.5,
            "baselineY": 356
          },
          {
            "x": 0,
            "y": 362,
            "width": 362,
            "height": 362,
            "pivotX": 187.5,
            "baselineY": 356
          },
          {
            "x": 362,
            "y": 362,
            "width": 362,
            "height": 362,
            "pivotX": 183.5,
            "baselineY": 356
          },
          {
            "x": 724,
            "y": 362,
            "width": 362,
            "height": 362,
            "pivotX": 178.5,
            "baselineY": 356
          },
          {
            "x": 1086,
            "y": 362,
            "width": 362,
            "height": 362,
            "pivotX": 169.5,
            "baselineY": 356
          },
          {
            "x": 0,
            "y": 724,
            "width": 362,
            "height": 362,
            "pivotX": 189,
            "baselineY": 354
          },
          {
            "x": 362,
            "y": 724,
            "width": 362,
            "height": 362,
            "pivotX": 185.5,
            "baselineY": 354
          },
          {
            "x": 724,
            "y": 724,
            "width": 362,
            "height": 362,
            "pivotX": 176.5,
            "baselineY": 354
          },
          {
            "x": 1086,
            "y": 724,
            "width": 362,
            "height": 362,
            "pivotX": 170,
            "baselineY": 354
          }
        ],
        "frameCount": 12,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 0.96317,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/finish/pixel-v2/nika-finish-pixel-v2-magenta.png"
          },
          {
            "label": "参照ドット絵",
            "url": "../../../assets/characters/nika/portrait/pixel-v1/nika-portrait-pixel-v1.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-danger-pixel-v1",
        "label": "ピンチ · ドット絵（6コマ）",
        "action": "danger",
        "kind": "animation",
        "image": "../../../assets/characters/nika/danger/pixel-v1/nika-danger-pixel-v1.png",
        "prompt": "../../../assets/characters/nika/danger/pixel-v1/nika-danger-pixel-v1.prompt.txt",
        "status": "試作・単色背景を除去",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "同じドット絵立ち絵を参照し6コマ生成。マゼンタの色範囲を透明化し、靴底の中心と床位置を合わせています。全コマ共通倍率、12fps、末尾の待ち時間なし。輪郭の色残りや動作の細部は比較用の試作です。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 341,
            "height": 768,
            "pivotX": 182.5,
            "baselineY": 733
          },
          {
            "x": 341,
            "y": 0,
            "width": 342,
            "height": 768,
            "pivotX": 178,
            "baselineY": 733
          },
          {
            "x": 683,
            "y": 0,
            "width": 341,
            "height": 768,
            "pivotX": 171.5,
            "baselineY": 733
          },
          {
            "x": 0,
            "y": 768,
            "width": 341,
            "height": 768,
            "pivotX": 183,
            "baselineY": 731
          },
          {
            "x": 341,
            "y": 768,
            "width": 342,
            "height": 768,
            "pivotX": 178,
            "baselineY": 731
          },
          {
            "x": 683,
            "y": 768,
            "width": 341,
            "height": 768,
            "pivotX": 171.5,
            "baselineY": 731
          }
        ],
        "frameCount": 6,
        "fps": 4,
        "lastHoldMs": 0,
        "scale": 0.47753,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/danger/pixel-v1/nika-danger-pixel-v1-magenta.png"
          },
          {
            "label": "参照ドット絵",
            "url": "../../../assets/characters/nika/portrait/pixel-v1/nika-portrait-pixel-v1.png"
          }
        ],
        "loop": true
      },
      {
        "id": "nika-success-pixel-v1",
        "label": "成功リアクション · ドット絵（6コマ）",
        "action": "success",
        "kind": "animation",
        "image": "../../../assets/characters/nika/success/pixel-v1/nika-success-pixel-v1.png",
        "prompt": "../../../assets/characters/nika/success/pixel-v1/nika-success-pixel-v1.prompt.txt",
        "status": "試作・単色背景を除去",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "同じドット絵立ち絵を参照し6コマ生成。マゼンタの色範囲を透明化し、靴底の中心と床位置を合わせています。全コマ共通倍率、12fps、末尾の待ち時間なし。輪郭の色残りや動作の細部は比較用の試作です。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 280,
            "baselineY": 509
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 254.5,
            "baselineY": 509
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 220.5,
            "baselineY": 509
          },
          {
            "x": 0,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 280,
            "baselineY": 498
          },
          {
            "x": 512,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 254.5,
            "baselineY": 498
          },
          {
            "x": 1024,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 226,
            "baselineY": 498
          }
        ],
        "frameCount": 6,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 0.69246,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/success/pixel-v1/nika-success-pixel-v1-magenta.png"
          },
          {
            "label": "参照ドット絵",
            "url": "../../../assets/characters/nika/portrait/pixel-v1/nika-portrait-pixel-v1.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-garbage-land-pixel-v1",
        "label": "おじゃま着地 · ドット絵（6コマ）",
        "action": "garbage-land",
        "kind": "animation",
        "image": "../../../assets/characters/nika/garbage-land/pixel-v1/nika-garbage-land-pixel-v1.png",
        "prompt": "../../../assets/characters/nika/garbage-land/pixel-v1/nika-garbage-land-pixel-v1.prompt.txt",
        "status": "試作・単色背景を除去",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "同じドット絵立ち絵を参照し6コマ生成。マゼンタの色範囲を透明化し、靴底の中心と床位置を合わせています。全コマ共通倍率、12fps、末尾の待ち時間なし。輪郭の色残りや動作の細部は比較用の試作です。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 268.5,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 254.5,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 241.5,
            "baselineY": 500
          },
          {
            "x": 0,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 283.5,
            "baselineY": 491
          },
          {
            "x": 512,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 491
          },
          {
            "x": 1024,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 236.5,
            "baselineY": 498
          }
        ],
        "frameCount": 6,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 0.70248,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/garbage-land/pixel-v1/nika-garbage-land-pixel-v1-magenta.png"
          },
          {
            "label": "参照ドット絵",
            "url": "../../../assets/characters/nika/portrait/pixel-v1/nika-portrait-pixel-v1.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-defeat-pixel-v1",
        "label": "敗北・失敗 · ドット絵（6コマ）",
        "action": "defeat",
        "kind": "animation",
        "image": "../../../assets/characters/nika/defeat/pixel-v1/nika-defeat-pixel-v1.png",
        "prompt": "../../../assets/characters/nika/defeat/pixel-v1/nika-defeat-pixel-v1.prompt.txt",
        "status": "試作・単色背景を除去",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "同じドット絵立ち絵を参照し6コマ生成。マゼンタの色範囲を透明化し、靴底の中心と床位置を合わせています。全コマ共通倍率、12fps、末尾の待ち時間なし。輪郭の色残りや動作の細部は比較用の試作です。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 301.5,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 248,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 199.5,
            "baselineY": 500
          },
          {
            "x": 0,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 315,
            "baselineY": 479
          },
          {
            "x": 512,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 274.5,
            "baselineY": 479
          },
          {
            "x": 1024,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 233.5,
            "baselineY": 479
          }
        ],
        "frameCount": 6,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 0.6953,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/defeat/pixel-v1/nika-defeat-pixel-v1-magenta.png"
          },
          {
            "label": "参照ドット絵",
            "url": "../../../assets/characters/nika/portrait/pixel-v1/nika-portrait-pixel-v1.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-finish-pixel-v1",
        "label": "通常終了 · ドット絵（6コマ）",
        "action": "finish",
        "kind": "animation",
        "image": "../../../assets/characters/nika/finish/pixel-v1/nika-finish-pixel-v1.png",
        "prompt": "../../../assets/characters/nika/finish/pixel-v1/nika-finish-pixel-v1.prompt.txt",
        "status": "試作・単色背景を除去",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "同じドット絵立ち絵を参照し6コマ生成。マゼンタの色範囲を透明化し、靴底の中心と床位置を合わせています。全コマ共通倍率、12fps、末尾の待ち時間なし。輪郭の色残りや動作の細部は比較用の試作です。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 304,
            "baselineY": 503
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 261,
            "baselineY": 503
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 213,
            "baselineY": 503
          },
          {
            "x": 0,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 303.5,
            "baselineY": 493
          },
          {
            "x": 512,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 258,
            "baselineY": 493
          },
          {
            "x": 1024,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 212.5,
            "baselineY": 493
          }
        ],
        "frameCount": 6,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 0.70103,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/finish/pixel-v1/nika-finish-pixel-v1-magenta.png"
          },
          {
            "label": "参照ドット絵",
            "url": "../../../assets/characters/nika/portrait/pixel-v1/nika-portrait-pixel-v1.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-victory-pixel-v1",
        "label": "勝利 · ドット絵（18コマ）",
        "action": "victory",
        "kind": "animation",
        "image": "../../../assets/characters/nika/victory/pixel-v1/nika-victory-pixel-v1.png",
        "prompt": "../../../assets/characters/nika/victory/pixel-v1/nika-victory-pixel-v1.prompt.txt",
        "status": "暫定採用・演出要調整",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "ドット絵立ち絵を参照して18コマ生成。跳ぶ→工具袋を押さえる→照れ笑いの動作。マゼンタ背景と生成されたコマ境界線を除去。全コマ共通倍率、12fps、末尾の待ち時間なし。姿勢が大きく切り替わる箇所と輪郭の色残りは要確認。 ユーザーは整合性を了承。物が落ちそうになる演出は伝わりにくく、改善点として残す。 ユーザーは整合性を了承。物が落ちそうになる演出は伝わりにくく、改善点として残す。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 256,
            "height": 340,
            "pivotX": 128,
            "baselineY": 326
          },
          {
            "x": 256,
            "y": 0,
            "width": 256,
            "height": 340,
            "pivotX": 128,
            "baselineY": 326
          },
          {
            "x": 512,
            "y": 0,
            "width": 256,
            "height": 340,
            "pivotX": 128,
            "baselineY": 326
          },
          {
            "x": 768,
            "y": 0,
            "width": 256,
            "height": 340,
            "pivotX": 128,
            "baselineY": 326
          },
          {
            "x": 1024,
            "y": 0,
            "width": 256,
            "height": 340,
            "pivotX": 128,
            "baselineY": 326
          },
          {
            "x": 1280,
            "y": 0,
            "width": 256,
            "height": 340,
            "pivotX": 128,
            "baselineY": 326
          },
          {
            "x": 0,
            "y": 340,
            "width": 256,
            "height": 339,
            "pivotX": 128,
            "baselineY": 324
          },
          {
            "x": 256,
            "y": 340,
            "width": 256,
            "height": 339,
            "pivotX": 128,
            "baselineY": 324
          },
          {
            "x": 512,
            "y": 340,
            "width": 256,
            "height": 339,
            "pivotX": 128,
            "baselineY": 324
          },
          {
            "x": 768,
            "y": 340,
            "width": 256,
            "height": 339,
            "pivotX": 128,
            "baselineY": 324
          },
          {
            "x": 1024,
            "y": 340,
            "width": 256,
            "height": 339,
            "pivotX": 128,
            "baselineY": 324
          },
          {
            "x": 1280,
            "y": 340,
            "width": 256,
            "height": 339,
            "pivotX": 128,
            "baselineY": 324
          },
          {
            "x": 0,
            "y": 679,
            "width": 256,
            "height": 345,
            "pivotX": 128,
            "baselineY": 328
          },
          {
            "x": 256,
            "y": 679,
            "width": 256,
            "height": 345,
            "pivotX": 128,
            "baselineY": 328
          },
          {
            "x": 512,
            "y": 679,
            "width": 256,
            "height": 345,
            "pivotX": 128,
            "baselineY": 328
          },
          {
            "x": 768,
            "y": 679,
            "width": 256,
            "height": 345,
            "pivotX": 128,
            "baselineY": 328
          },
          {
            "x": 1024,
            "y": 679,
            "width": 256,
            "height": 345,
            "pivotX": 128,
            "baselineY": 328
          },
          {
            "x": 1280,
            "y": 679,
            "width": 256,
            "height": 345,
            "pivotX": 128,
            "baselineY": 328
          }
        ],
        "frameCount": 18,
        "fps": 12,
        "lastHoldMs": 0,
        "scale": 1,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/victory/pixel-v1/nika-victory-pixel-v1-magenta.png"
          },
          {
            "label": "参照ドット絵",
            "url": "../../../assets/characters/nika/portrait/pixel-v1/nika-portrait-pixel-v1.png"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-idle-pixel-v2",
        "label": "待機 · ドット絵（単色背景から透過）",
        "action": "idle",
        "kind": "animation",
        "image": "../../../assets/characters/nika/idle/pixel-v2/nika-idle-pixel-v2.png",
        "prompt": "../../../assets/characters/nika/idle/pixel-v2/nika-idle-pixel-v2.prompt.txt",
        "status": "採用版",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "3列×2行を512px四方で切り出し。靴底の中心（274.5、255.5、236.5px、両段共通）を揃えて横位置を補正しています。倍率は全コマ共通。輪郭のマゼンタと体形の差は残っています。",
        "columns": 3,
        "rows": 2,
        "frameWidth": 512,
        "frameHeight": 512,
        "frameCount": 6,
        "fps": 4,
        "lastHoldMs": 0,
        "scale": 0.7,
        "baselineY": 505,
        "pixelArt": true,
        "history": [
          {
            "label": "背景除去前",
            "url": "../../../assets/characters/nika/idle/pixel-v2/nika-idle-pixel-v2-magenta.png"
          },
          {
            "label": "参照したドット絵立ち絵",
            "url": "../../../assets/characters/nika/portrait/pixel-v1/nika-portrait-pixel-v1.png"
          }
        ],
        "pivotX": [
          274.5,
          255.5,
          236.5,
          274.5,
          255.5,
          236.5
        ],
        "loop": true
      },
      {
        "id": "nika-idle-v4",
        "label": "待機 · v4（6コマ生成）",
        "action": "idle",
        "kind": "animation",
        "image": "../../../assets/characters/nika/idle/v4/nika-idle-v4.png",
        "prompt": "../../../assets/characters/nika/idle/v4/nika-idle-v4.prompt.txt",
        "status": "比較用試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "基準立ち絵v1と短い指示を使用し、指定を3列×2行の6コマに変更。出力は1024×1536のRGBA、透明画素49.3%。横位置・倍率の自動補正なし。行ごとの床位置を合わせて12fpsで再生。前回と出力の縦横比も変わったため、コマ数だけの厳密な比較ではありません。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 341,
            "height": 773,
            "pivotX": 170.5,
            "baselineY": 770
          },
          {
            "x": 341,
            "y": 0,
            "width": 342,
            "height": 773,
            "pivotX": 171,
            "baselineY": 770
          },
          {
            "x": 683,
            "y": 0,
            "width": 341,
            "height": 773,
            "pivotX": 170.5,
            "baselineY": 770
          },
          {
            "x": 0,
            "y": 773,
            "width": 341,
            "height": 763,
            "pivotX": 170.5,
            "baselineY": 747
          },
          {
            "x": 341,
            "y": 773,
            "width": 342,
            "height": 763,
            "pivotX": 171,
            "baselineY": 747
          },
          {
            "x": 683,
            "y": 773,
            "width": 341,
            "height": 763,
            "pivotX": 170.5,
            "baselineY": 747
          }
        ],
        "frameCount": 6,
        "fps": 4,
        "lastHoldMs": 0,
        "scale": 0.44,
        "reference": "../../../output/imagegen/nika-portrait-v1.png",
        "loop": true
      },
      {
        "id": "nika-idle-v3-short",
        "label": "待機 · v3（12コマ補正）",
        "action": "idle",
        "kind": "animation",
        "image": "../../../assets/characters/nika/idle/v3/nika-idle-v3.png",
        "prompt": "../../../assets/characters/nika/idle/v3/nika-idle-v3.prompt.txt",
        "status": "比較用試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "同じv3画像の1・2段目だけを使用。3段目を除いた12コマで、瞬きは残しています。靴底を基準にXを揃え、2段目だけ約1.6%拡大。12fpsで連続ループ再生します。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 145,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 256,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 141.5,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 512,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 139,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 768,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 136,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 1024,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 133.5,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 1280,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 129.5,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 0,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 145,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 256,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 142,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 512,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 139.5,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 768,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 136.5,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 1024,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 133.5,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 1280,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 130.5,
            "baselineY": 314,
            "scale": 1.0160771704180065
          }
        ],
        "frameCount": 12,
        "fps": 4,
        "lastHoldMs": 0,
        "scale": 1.05,
        "reference": "../../../output/imagegen/nika-portrait-v1.png",
        "loop": true
      },
      {
        "id": "nika-idle-v3-aligned",
        "label": "待機 · v3（18コマ補正）",
        "action": "idle",
        "kind": "animation",
        "image": "../../../assets/characters/nika/idle/v3/nika-idle-v3.png",
        "prompt": "../../../assets/characters/nika/idle/v3/nika-idle-v3.prompt.txt",
        "status": "比較用試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "同じv3画像の表示補正。靴底の左右端の中点でXを揃え、段単位で身長を合わせています（1段目316px、2段目311px、3段目335px）。各コマごとの自動拡大はしません。絵自体の形や色の差は残ります。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 145,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 256,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 141.5,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 512,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 139,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 768,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 136,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 1024,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 133.5,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 1280,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 129.5,
            "baselineY": 323,
            "scale": 1
          },
          {
            "x": 0,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 145,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 256,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 142,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 512,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 139.5,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 768,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 136.5,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 1024,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 133.5,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 1280,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 130.5,
            "baselineY": 314,
            "scale": 1.0160771704180065
          },
          {
            "x": 0,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 144,
            "baselineY": 335,
            "scale": 0.9432835820895522
          },
          {
            "x": 256,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 141.5,
            "baselineY": 335,
            "scale": 0.9432835820895522
          },
          {
            "x": 512,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 138,
            "baselineY": 336,
            "scale": 0.9432835820895522
          },
          {
            "x": 768,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 135.5,
            "baselineY": 335,
            "scale": 0.9432835820895522
          },
          {
            "x": 1024,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 133.5,
            "baselineY": 335,
            "scale": 0.9432835820895522
          },
          {
            "x": 1280,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 129.5,
            "baselineY": 335,
            "scale": 0.9432835820895522
          }
        ],
        "frameCount": 18,
        "fps": 4,
        "lastHoldMs": 0,
        "scale": 1.05,
        "reference": "../../../output/imagegen/nika-portrait-v1.png",
        "loop": true
      },
      {
        "id": "nika-idle-v3",
        "label": "待機 · v3（短い指示）",
        "action": "idle",
        "kind": "animation",
        "image": "../../../assets/characters/nika/idle/v3/nika-idle-v3.png",
        "prompt": "../../../assets/characters/nika/idle/v3/nika-idle-v3.prompt.txt",
        "status": "比較用試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "基準立ち絵v1と短い日本語の指示のみで生成。RGBAで透明画素66.3%を確認。24コマ指定に対し実際は18コマ。行ごとの床位置だけ合わせ、横ずれの自動補正はしていません。",
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 128,
            "baselineY": 322
          },
          {
            "x": 256,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 128,
            "baselineY": 322
          },
          {
            "x": 512,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 128,
            "baselineY": 322
          },
          {
            "x": 768,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 128,
            "baselineY": 322
          },
          {
            "x": 1024,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 128,
            "baselineY": 322
          },
          {
            "x": 1280,
            "y": 0,
            "width": 256,
            "height": 326,
            "pivotX": 128,
            "baselineY": 322
          },
          {
            "x": 0,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 128,
            "baselineY": 314
          },
          {
            "x": 256,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 128,
            "baselineY": 314
          },
          {
            "x": 512,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 128,
            "baselineY": 314
          },
          {
            "x": 768,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 128,
            "baselineY": 314
          },
          {
            "x": 1024,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 128,
            "baselineY": 314
          },
          {
            "x": 1280,
            "y": 326,
            "width": 256,
            "height": 318,
            "pivotX": 128,
            "baselineY": 314
          },
          {
            "x": 0,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 128,
            "baselineY": 336
          },
          {
            "x": 256,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 128,
            "baselineY": 336
          },
          {
            "x": 512,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 128,
            "baselineY": 336
          },
          {
            "x": 768,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 128,
            "baselineY": 336
          },
          {
            "x": 1024,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 128,
            "baselineY": 336
          },
          {
            "x": 1280,
            "y": 644,
            "width": 256,
            "height": 380,
            "pivotX": 128,
            "baselineY": 336
          }
        ],
        "frameCount": 18,
        "fps": 4,
        "lastHoldMs": 0,
        "scale": 1.05,
        "reference": "../../../output/imagegen/nika-portrait-v1.png",
        "loop": true
      },
      {
        "id": "nika-idle-v2",
        "label": "待機 · v2（立ち絵参照）",
        "action": "idle",
        "kind": "animation",
        "image": "../../../assets/characters/nika/idle/v2/nika-idle-v2.png",
        "prompt": "../../../assets/characters/nika/idle/v2/nika-idle-v2.prompt.txt",
        "status": "比較用試作・背景透過未達",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "基準立ち絵v1を参照画像として入力。足・手・腰を固定し、呼吸と短い瞬きを指定。24コマを等分し、横位置の自動補正は使用していません。背景の市松模様は描き込みで、透過ではありません。透過を再指定した別生成でもRGBでした。",
        "columns": 6,
        "rows": 4,
        "frameWidth": 256,
        "frameHeight": 256,
        "frameCount": 24,
        "fps": 4,
        "lastHoldMs": 0,
        "baselineY": 252,
        "scale": 1.35,
        "reference": "../../../output/imagegen/nika-portrait-v1.png",
        "loop": true
      },
      {
        "id": "nika-portrait-v1",
        "label": "基準立ち絵 · v1",
        "action": "portrait",
        "kind": "image",
        "image": "../../../assets/characters/nika/portrait/v1/nika-portrait-v1.png",
        "prompt": "../../../assets/characters/nika/portrait/v1/nika-portrait-v1.prompt.txt",
        "status": "試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "テキストから新規生成。既存の勝利v4とは顔・頭身・髪留めなどに差があります。外見の統一前の試作です。"
      },
      {
        "id": "nika-icon-v1",
        "label": "顔アイコン · v1",
        "action": "icon",
        "kind": "image",
        "image": "../../../assets/characters/nika/icon/v1/nika-icon-v1.png",
        "prompt": "../../../assets/characters/nika/icon/v1/nika-icon-v1.prompt.txt",
        "status": "試作・透過確認済み・輪郭要調整",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "テキストから新規生成。既存の勝利v4とは顔・頭身・髪留めなどに差があります。外見の統一前の試作です。 肩の下端に微小な縁のノイズが残っています。"
      },
      {
        "id": "nika-idle-v1",
        "label": "待機 · v1",
        "action": "idle",
        "kind": "animation",
        "image": "../../../assets/characters/nika/idle/v1/nika-idle-v1.png",
        "prompt": "../../../assets/characters/nika/idle/v1/nika-idle-v1.prompt.txt",
        "status": "試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "テキストから新規生成。既存の勝利v4とは顔・頭身・髪留めなどに差があります。外見の統一前の試作です。",
        "frames": [
          {
            "x": 62,
            "y": 0,
            "width": 116,
            "height": 256,
            "pivotX": 52.25
          },
          {
            "x": 318,
            "y": 0,
            "width": 117,
            "height": 256,
            "pivotX": 53
          },
          {
            "x": 575,
            "y": 0,
            "width": 117,
            "height": 256,
            "pivotX": 53.5
          },
          {
            "x": 833,
            "y": 0,
            "width": 117,
            "height": 256,
            "pivotX": 53.25
          },
          {
            "x": 1089,
            "y": 0,
            "width": 118,
            "height": 256,
            "pivotX": 62.5
          },
          {
            "x": 1345,
            "y": 0,
            "width": 118,
            "height": 256,
            "pivotX": 53.5
          },
          {
            "x": 61,
            "y": 256,
            "width": 117,
            "height": 256,
            "pivotX": 53.5
          },
          {
            "x": 318,
            "y": 256,
            "width": 117,
            "height": 256,
            "pivotX": 53
          },
          {
            "x": 575,
            "y": 256,
            "width": 117,
            "height": 256,
            "pivotX": 53
          },
          {
            "x": 832,
            "y": 256,
            "width": 117,
            "height": 256,
            "pivotX": 53
          },
          {
            "x": 1089,
            "y": 256,
            "width": 116,
            "height": 256,
            "pivotX": 52.5
          },
          {
            "x": 1345,
            "y": 256,
            "width": 117,
            "height": 256,
            "pivotX": 53
          },
          {
            "x": 49,
            "y": 512,
            "width": 115,
            "height": 256,
            "pivotX": 52
          },
          {
            "x": 234,
            "y": 512,
            "width": 115,
            "height": 256,
            "pivotX": 52
          },
          {
            "x": 423,
            "y": 512,
            "width": 116,
            "height": 256,
            "pivotX": 51.75
          },
          {
            "x": 613,
            "y": 512,
            "width": 116,
            "height": 256,
            "pivotX": 52
          },
          {
            "x": 804,
            "y": 512,
            "width": 116,
            "height": 256,
            "pivotX": 52.25
          },
          {
            "x": 995,
            "y": 512,
            "width": 116,
            "height": 256,
            "pivotX": 52.5
          },
          {
            "x": 1185,
            "y": 512,
            "width": 116,
            "height": 256,
            "pivotX": 52
          },
          {
            "x": 1375,
            "y": 512,
            "width": 116,
            "height": 256,
            "pivotX": 52
          },
          {
            "x": 61,
            "y": 768,
            "width": 117,
            "height": 256,
            "pivotX": 53
          },
          {
            "x": 318,
            "y": 768,
            "width": 117,
            "height": 256,
            "pivotX": 52.5
          },
          {
            "x": 575,
            "y": 768,
            "width": 117,
            "height": 256,
            "pivotX": 53
          },
          {
            "x": 832,
            "y": 768,
            "width": 117,
            "height": 256,
            "pivotX": 53.5
          },
          {
            "x": 1089,
            "y": 768,
            "width": 117,
            "height": 256,
            "pivotX": 53.5
          },
          {
            "x": 1345,
            "y": 768,
            "width": 117,
            "height": 256,
            "pivotX": 53
          }
        ],
        "frameCount": 26,
        "fps": 4,
        "lastHoldMs": 0,
        "baselineY": 252,
        "scale": 1.35,
        "loop": true
      },
      {
        "id": "nika-danger-v1",
        "label": "ピンチ · v1",
        "action": "danger",
        "kind": "animation",
        "image": "../../../assets/characters/nika/danger/v1/nika-danger-v1.png",
        "prompt": "../../../assets/characters/nika/danger/v1/nika-danger-v1.prompt.txt",
        "status": "試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "テキストから新規生成。既存の勝利v4とは顔・頭身・髪留めなどに差があります。外見の統一前の試作です。",
        "frames": [
          {
            "x": 67,
            "y": 0,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 323,
            "y": 0,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 579,
            "y": 0,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 835,
            "y": 0,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 1091,
            "y": 0,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 1347,
            "y": 0,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 67,
            "y": 256,
            "width": 123,
            "height": 256,
            "pivotX": 61.5
          },
          {
            "x": 323,
            "y": 256,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 579,
            "y": 256,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 835,
            "y": 256,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 1091,
            "y": 256,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 1347,
            "y": 256,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 67,
            "y": 512,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 323,
            "y": 512,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 579,
            "y": 512,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 835,
            "y": 512,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 1091,
            "y": 512,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 1347,
            "y": 512,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 67,
            "y": 768,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 323,
            "y": 768,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 579,
            "y": 768,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 835,
            "y": 768,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 1091,
            "y": 768,
            "width": 122,
            "height": 256,
            "pivotX": 61
          },
          {
            "x": 1347,
            "y": 768,
            "width": 122,
            "height": 256,
            "pivotX": 61
          }
        ],
        "frameCount": 24,
        "fps": 4,
        "lastHoldMs": 0,
        "baselineY": 252,
        "scale": 1.35,
        "loop": true
      },
      {
        "id": "nika-success-v1",
        "label": "成功リアクション · v1",
        "action": "success",
        "kind": "animation",
        "image": "../../../assets/characters/nika/success/v1/nika-success-v1.png",
        "prompt": "../../../assets/characters/nika/success/v1/nika-success-v1.prompt.txt",
        "status": "試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "テキストから新規生成。既存の勝利v4とは顔・頭身・髪留めなどに差があります。外見の統一前の試作です。",
        "frames": [
          {
            "x": 76,
            "y": 0,
            "width": 108,
            "height": 256,
            "pivotX": 56
          },
          {
            "x": 334,
            "y": 0,
            "width": 109,
            "height": 256,
            "pivotX": 36.75
          },
          {
            "x": 584,
            "y": 0,
            "width": 107,
            "height": 256,
            "pivotX": 53.5
          },
          {
            "x": 842,
            "y": 0,
            "width": 106,
            "height": 256,
            "pivotX": 25.5
          },
          {
            "x": 1102,
            "y": 0,
            "width": 108,
            "height": 256,
            "pivotX": 40.5
          },
          {
            "x": 1358,
            "y": 0,
            "width": 109,
            "height": 256,
            "pivotX": 36.5
          },
          {
            "x": 77,
            "y": 256,
            "width": 109,
            "height": 256,
            "pivotX": 54.5
          },
          {
            "x": 335,
            "y": 256,
            "width": 110,
            "height": 256,
            "pivotX": 82.5
          },
          {
            "x": 589,
            "y": 256,
            "width": 109,
            "height": 256,
            "pivotX": 42.5
          },
          {
            "x": 845,
            "y": 256,
            "width": 111,
            "height": 256,
            "pivotX": 55.5
          },
          {
            "x": 1102,
            "y": 256,
            "width": 111,
            "height": 256,
            "pivotX": 82
          },
          {
            "x": 1357,
            "y": 256,
            "width": 110,
            "height": 256,
            "pivotX": 55
          },
          {
            "x": 76,
            "y": 512,
            "width": 112,
            "height": 256,
            "pivotX": 36.5
          },
          {
            "x": 333,
            "y": 512,
            "width": 111,
            "height": 256,
            "pivotX": 69
          },
          {
            "x": 585,
            "y": 512,
            "width": 113,
            "height": 256,
            "pivotX": 29
          },
          {
            "x": 842,
            "y": 512,
            "width": 106,
            "height": 256,
            "pivotX": 30.5
          },
          {
            "x": 1099,
            "y": 512,
            "width": 107,
            "height": 256,
            "pivotX": 34
          },
          {
            "x": 1357,
            "y": 512,
            "width": 106,
            "height": 256,
            "pivotX": 21.25
          },
          {
            "x": 74,
            "y": 768,
            "width": 106,
            "height": 256,
            "pivotX": 35
          },
          {
            "x": 334,
            "y": 768,
            "width": 107,
            "height": 256,
            "pivotX": 35.5
          },
          {
            "x": 584,
            "y": 768,
            "width": 107,
            "height": 256,
            "pivotX": 59.5
          },
          {
            "x": 844,
            "y": 768,
            "width": 107,
            "height": 256,
            "pivotX": 39
          },
          {
            "x": 1103,
            "y": 768,
            "width": 108,
            "height": 256,
            "pivotX": 38
          },
          {
            "x": 1352,
            "y": 768,
            "width": 108,
            "height": 256,
            "pivotX": 59
          }
        ],
        "frameCount": 24,
        "fps": 12,
        "lastHoldMs": 0,
        "baselineY": 252,
        "scale": 1.35,
        "loop": false
      },
      {
        "id": "nika-garbage-land-v1",
        "label": "おじゃま着地 · v1",
        "action": "garbage-land",
        "kind": "animation",
        "image": "../../../assets/characters/nika/garbage-land/v1/nika-garbage-land-v1.png",
        "prompt": "../../../assets/characters/nika/garbage-land/v1/nika-garbage-land-v1.prompt.txt",
        "status": "試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "テキストから新規生成。既存の勝利v4とは顔・頭身・髪留めなどに差があります。外見の統一前の試作です。",
        "frames": [
          {
            "x": 82,
            "y": 0,
            "width": 112,
            "height": 256,
            "pivotX": 38.5
          },
          {
            "x": 334,
            "y": 0,
            "width": 112,
            "height": 256,
            "pivotX": 37.5
          },
          {
            "x": 587,
            "y": 0,
            "width": 112,
            "height": 256,
            "pivotX": 34.75
          },
          {
            "x": 839,
            "y": 0,
            "width": 111,
            "height": 256,
            "pivotX": 55.5
          },
          {
            "x": 1076,
            "y": 0,
            "width": 141,
            "height": 256,
            "pivotX": 50.5
          },
          {
            "x": 1328,
            "y": 0,
            "width": 142,
            "height": 256,
            "pivotX": 50.25
          },
          {
            "x": 63,
            "y": 256,
            "width": 148,
            "height": 256,
            "pivotX": 52.5
          },
          {
            "x": 313,
            "y": 256,
            "width": 155,
            "height": 256,
            "pivotX": 52.75
          },
          {
            "x": 561,
            "y": 256,
            "width": 141,
            "height": 256,
            "pivotX": 113.75
          },
          {
            "x": 811,
            "y": 256,
            "width": 143,
            "height": 256,
            "pivotX": 53.5
          },
          {
            "x": 1057,
            "y": 256,
            "width": 151,
            "height": 256,
            "pivotX": 65
          },
          {
            "x": 1307,
            "y": 256,
            "width": 153,
            "height": 256,
            "pivotX": 76.5
          },
          {
            "x": 67,
            "y": 512,
            "width": 129,
            "height": 256,
            "pivotX": 47.5
          },
          {
            "x": 325,
            "y": 512,
            "width": 125,
            "height": 256,
            "pivotX": 52.5
          },
          {
            "x": 578,
            "y": 512,
            "width": 123,
            "height": 256,
            "pivotX": 97.25
          },
          {
            "x": 837,
            "y": 512,
            "width": 118,
            "height": 256,
            "pivotX": 38
          },
          {
            "x": 1091,
            "y": 512,
            "width": 117,
            "height": 256,
            "pivotX": 34
          },
          {
            "x": 1343,
            "y": 512,
            "width": 114,
            "height": 256,
            "pivotX": 38
          },
          {
            "x": 82,
            "y": 768,
            "width": 112,
            "height": 256,
            "pivotX": 77
          },
          {
            "x": 334,
            "y": 768,
            "width": 112,
            "height": 256,
            "pivotX": 40
          },
          {
            "x": 587,
            "y": 768,
            "width": 112,
            "height": 256,
            "pivotX": 36.5
          },
          {
            "x": 839,
            "y": 768,
            "width": 111,
            "height": 256,
            "pivotX": 43.5
          },
          {
            "x": 1091,
            "y": 768,
            "width": 112,
            "height": 256,
            "pivotX": 32.25
          },
          {
            "x": 1343,
            "y": 768,
            "width": 113,
            "height": 256,
            "pivotX": 37.25
          }
        ],
        "frameCount": 24,
        "fps": 12,
        "lastHoldMs": 0,
        "baselineY": 252,
        "scale": 1.35,
        "loop": false
      },
      {
        "id": "nika-victory-v4",
        "label": "勝利 · v4",
        "kind": "animation",
        "action": "victory",
        "status": "試作・横ずれ補正済み",
        "image": "../../../assets/characters/nika/victory/v4/nika-victory-v4.png",
        "prompt": "../../../assets/characters/nika/victory/v4/nika-victory-v4.prompt.txt",
        "notes": "喜んで跳ね、工具袋を押さえる24コマ。透過背景。体形や描線には生成由来の揺れが残っています。",
        "model": "未確認（内蔵画像生成ツール）",
        "columns": 6,
        "rows": 4,
        "frameWidth": 256,
        "frameHeight": 256,
        "frameCount": 24,
        "fps": 12,
        "lastHoldMs": 0,
        "pivotX": [
          152,
          140.2,
          134.8,
          116.2,
          101.2,
          86.2,
          143.2,
          146.5,
          129.8,
          116.5,
          109.5,
          100,
          151.5,
          134.8,
          128,
          119.8,
          106.5,
          90.5,
          150,
          138.8,
          129.8,
          116.5,
          106,
          99.5
        ],
        "baselineY": 252,
        "scale": 1.35,
        "history": [
          {
            "label": "v2 · 24コマ／背景に課題",
            "url": "../../../assets/characters/nika/victory/v2/nika-victory-v2.html"
          },
          {
            "label": "v1 · 8コマ",
            "url": "../../../assets/characters/nika/victory/v1/nika-victory-v1.html"
          }
        ],
        "loop": false
      },
      {
        "id": "nika-defeat-v1",
        "label": "敗北・失敗 · v1",
        "action": "defeat",
        "kind": "animation",
        "image": "../../../assets/characters/nika/defeat/v1/nika-defeat-v1.png",
        "prompt": "../../../assets/characters/nika/defeat/v1/nika-defeat-v1.prompt.txt",
        "status": "試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "テキストから新規生成。既存の勝利v4とは顔・頭身・髪留めなどに差があります。外見の統一前の試作です。",
        "frames": [
          {
            "x": 89,
            "y": 0,
            "width": 113,
            "height": 256,
            "pivotX": 47.5
          },
          {
            "x": 339,
            "y": 0,
            "width": 113,
            "height": 256,
            "pivotX": 46.5
          },
          {
            "x": 589,
            "y": 0,
            "width": 113,
            "height": 256,
            "pivotX": 46.25
          },
          {
            "x": 839,
            "y": 0,
            "width": 112,
            "height": 256,
            "pivotX": 46
          },
          {
            "x": 1088,
            "y": 0,
            "width": 112,
            "height": 256,
            "pivotX": 45
          },
          {
            "x": 1337,
            "y": 0,
            "width": 112,
            "height": 256,
            "pivotX": 46.5
          },
          {
            "x": 87,
            "y": 256,
            "width": 116,
            "height": 256,
            "pivotX": 47.5
          },
          {
            "x": 336,
            "y": 256,
            "width": 117,
            "height": 256,
            "pivotX": 47.5
          },
          {
            "x": 587,
            "y": 256,
            "width": 116,
            "height": 256,
            "pivotX": 47
          },
          {
            "x": 836,
            "y": 256,
            "width": 117,
            "height": 256,
            "pivotX": 48.5
          },
          {
            "x": 1085,
            "y": 256,
            "width": 117,
            "height": 256,
            "pivotX": 49.5
          },
          {
            "x": 1334,
            "y": 256,
            "width": 118,
            "height": 256,
            "pivotX": 51
          },
          {
            "x": 84,
            "y": 512,
            "width": 121,
            "height": 256,
            "pivotX": 53.25
          },
          {
            "x": 333,
            "y": 512,
            "width": 122,
            "height": 256,
            "pivotX": 53.75
          },
          {
            "x": 582,
            "y": 512,
            "width": 123,
            "height": 256,
            "pivotX": 55
          },
          {
            "x": 830,
            "y": 512,
            "width": 119,
            "height": 256,
            "pivotX": 38.5
          },
          {
            "x": 1082,
            "y": 512,
            "width": 133,
            "height": 256,
            "pivotX": 16.5
          },
          {
            "x": 1330,
            "y": 512,
            "width": 130,
            "height": 256,
            "pivotX": 16.5
          },
          {
            "x": 82,
            "y": 768,
            "width": 127,
            "height": 256,
            "pivotX": 15.5
          },
          {
            "x": 331,
            "y": 768,
            "width": 133,
            "height": 256,
            "pivotX": 15.75
          },
          {
            "x": 581,
            "y": 768,
            "width": 130,
            "height": 256,
            "pivotX": 15.5
          },
          {
            "x": 831,
            "y": 768,
            "width": 131,
            "height": 256,
            "pivotX": 14.5
          },
          {
            "x": 1081,
            "y": 768,
            "width": 137,
            "height": 256,
            "pivotX": 14.5
          },
          {
            "x": 1334,
            "y": 768,
            "width": 125,
            "height": 256,
            "pivotX": 64
          }
        ],
        "frameCount": 24,
        "fps": 12,
        "lastHoldMs": 0,
        "baselineY": 252,
        "scale": 1.35,
        "loop": false
      },
      {
        "id": "nika-finish-v1",
        "label": "通常終了 · v1",
        "action": "finish",
        "kind": "animation",
        "image": "../../../assets/characters/nika/finish/v1/nika-finish-v1.png",
        "prompt": "../../../assets/characters/nika/finish/v1/nika-finish-v1.prompt.txt",
        "status": "試作・透過確認済み",
        "model": "未確認（内蔵画像生成ツール）",
        "notes": "テキストから新規生成。既存の勝利v4とは顔・頭身・髪留めなどに差があります。外見の統一前の試作です。",
        "frames": [
          {
            "x": 93,
            "y": 0,
            "width": 113,
            "height": 256,
            "pivotX": 41.75
          },
          {
            "x": 341,
            "y": 0,
            "width": 113,
            "height": 256,
            "pivotX": 42.25
          },
          {
            "x": 589,
            "y": 0,
            "width": 113,
            "height": 256,
            "pivotX": 41.75
          },
          {
            "x": 836,
            "y": 0,
            "width": 114,
            "height": 256,
            "pivotX": 41.75
          },
          {
            "x": 1083,
            "y": 0,
            "width": 115,
            "height": 256,
            "pivotX": 40.75
          },
          {
            "x": 1333,
            "y": 0,
            "width": 112,
            "height": 256,
            "pivotX": 41
          },
          {
            "x": 93,
            "y": 256,
            "width": 113,
            "height": 256,
            "pivotX": 40
          },
          {
            "x": 341,
            "y": 256,
            "width": 112,
            "height": 256,
            "pivotX": 41.5
          },
          {
            "x": 589,
            "y": 256,
            "width": 113,
            "height": 256,
            "pivotX": 41.5
          },
          {
            "x": 837,
            "y": 256,
            "width": 113,
            "height": 256,
            "pivotX": 41
          },
          {
            "x": 1085,
            "y": 256,
            "width": 112,
            "height": 256,
            "pivotX": 40.5
          },
          {
            "x": 1333,
            "y": 256,
            "width": 112,
            "height": 256,
            "pivotX": 41.75
          },
          {
            "x": 93,
            "y": 512,
            "width": 113,
            "height": 256,
            "pivotX": 39.5
          },
          {
            "x": 341,
            "y": 512,
            "width": 112,
            "height": 256,
            "pivotX": 39
          },
          {
            "x": 589,
            "y": 512,
            "width": 113,
            "height": 256,
            "pivotX": 39
          },
          {
            "x": 838,
            "y": 512,
            "width": 112,
            "height": 256,
            "pivotX": 42.75
          },
          {
            "x": 1085,
            "y": 512,
            "width": 112,
            "height": 256,
            "pivotX": 42.75
          },
          {
            "x": 1333,
            "y": 512,
            "width": 112,
            "height": 256,
            "pivotX": 43.75
          },
          {
            "x": 93,
            "y": 768,
            "width": 113,
            "height": 256,
            "pivotX": 41.5
          },
          {
            "x": 341,
            "y": 768,
            "width": 112,
            "height": 256,
            "pivotX": 41.75
          },
          {
            "x": 589,
            "y": 768,
            "width": 113,
            "height": 256,
            "pivotX": 42.5
          },
          {
            "x": 837,
            "y": 768,
            "width": 113,
            "height": 256,
            "pivotX": 41.5
          },
          {
            "x": 1085,
            "y": 768,
            "width": 113,
            "height": 256,
            "pivotX": 41.75
          },
          {
            "x": 1333,
            "y": 768,
            "width": 112,
            "height": 256,
            "pivotX": 42.5
          }
        ],
        "frameCount": 24,
        "fps": 12,
        "lastHoldMs": 0,
        "baselineY": 252,
        "scale": 1.35,
        "loop": false
      }
    ],
    "adoptedAssets": {
      "idle": "nika-idle-pixel-v2",
      "victory": "nika-victory-pixel-v1",
      "defeat": "nika-defeat-pixel-v4-short",
      "portrait": "nika-portrait-pixel-v2",
      "icon": "nika-icon-pixel-v1",
      "danger": "nika-danger-pixel-v1",
      "success": "nika-success-pixel-v1",
      "garbage-land": "nika-garbage-land-pixel-v1",
      "finish": "nika-finish-pixel-v2"
    }
  },
  {
    "id": "mito",
    "name": "ミト",
    "role": "配達員",
    "color": "#608c77",
    "assets": [
      {
        "id": "mito-portrait-pixel-v2",
        "label": "基準立ち絵 · ドット絵 v2（透過再生成）",
        "kind": "image",
        "action": "portrait",
        "image": "../../../assets/characters/mito/portrait/pixel-v2/mito-portrait-pixel-v2.png",
        "prompt": "../../../assets/characters/mito/portrait/pixel-v2/mito-portrait-pixel-v2.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "採用版",
        "pixelArt": true,
        "notes": "gpt-imageで再生成した透過PNG。色抜き・画像加工なし。旧版は比較用に保存。"
      },
      {
        "id": "mito-portrait-pixel-v1",
        "label": "基準立ち絵 · ドット絵 v1",
        "kind": "image",
        "action": "portrait",
        "image": "../../../assets/characters/mito/portrait/pixel-v1/mito-portrait-pixel-v1.png",
        "prompt": "../../../assets/characters/mito/portrait/pixel-v1/mito-portrait-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "旧版・比較用",
        "pixelArt": true,
        "notes": "ユーザー確認済みの基準デザイン。透明背景。"
      },
      {
        "id": "mito-icon-pixel-v2",
        "label": "顔アイコン · ドット絵 v2（透過再生成）",
        "kind": "image",
        "action": "icon",
        "image": "../../../assets/characters/mito/icon/pixel-v2/mito-icon-pixel-v2.png",
        "prompt": "../../../assets/characters/mito/icon/pixel-v2/mito-icon-pixel-v2.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "採用版",
        "pixelArt": true,
        "notes": "gpt-imageで再生成した透過PNG。色抜き・画像加工なし。旧版は比較用に保存。"
      },
      {
        "id": "mito-icon-pixel-v1",
        "label": "顔アイコン · ドット絵 v1",
        "kind": "image",
        "action": "icon",
        "image": "../../../assets/characters/mito/icon/pixel-v1/mito-icon-pixel-v1.png",
        "prompt": "../../../assets/characters/mito/icon/pixel-v1/mito-icon-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "旧版・比較用",
        "pixelArt": true,
        "notes": "専用の顔アイコンを256px四方に縮小。透明背景。"
      },
      {
        "id": "mito-idle-pixel-v2",
        "label": "待機 · ドット絵 v2（透過再生成）",
        "kind": "animation",
        "action": "idle",
        "image": "../../../assets/characters/mito/idle/pixel-v2/mito-idle-pixel-v2.png",
        "prompt": "../../../assets/characters/mito/idle/pixel-v2/mito-idle-pixel-v2.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "採用版",
        "pixelArt": true,
        "notes": "gpt-imageで再生成した透過PNG。色抜き・画像加工なし。旧版は比較用に保存。 全コマ共通倍率。アルファ128以上の足元から基準点と床位置を計測。",
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 298.5,
            "baselineY": 503
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 291,
            "baselineY": 503
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 282,
            "baselineY": 503
          },
          {
            "x": 0,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 298.5,
            "baselineY": 493
          },
          {
            "x": 512,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 290.5,
            "baselineY": 493
          },
          {
            "x": 1024,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 282,
            "baselineY": 493
          }
        ],
        "scale": 0.7438,
        "lastHoldMs": 0
      },
      {
        "id": "mito-idle-pixel-v1",
        "label": "待機 · ドット絵 v1",
        "kind": "animation",
        "action": "idle",
        "image": "../../../assets/characters/mito/idle/pixel-v1/mito-idle-pixel-v1.png",
        "prompt": "../../../assets/characters/mito/idle/pixel-v1/mito-idle-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "旧版・比較用",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/mito/idle/pixel-v1/mito-idle-pixel-v1-magenta.png"
          }
        ],
        "columns": 3,
        "rows": 2,
        "frameWidth": 342,
        "frameHeight": 768,
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "baselineY": 748,
        "scale": 0.52,
        "lastHoldMs": 0,
        "notes": "6コマ。均一なマゼンタ背景を透過し、グリッド用に右端へ2pxの透明余白を追加。"
      },
      {
        "id": "mito-danger-pixel-v2",
        "label": "ピンチ · ドット絵 v2（透過再生成）",
        "kind": "animation",
        "action": "danger",
        "image": "../../../assets/characters/mito/danger/pixel-v2/mito-danger-pixel-v2.png",
        "prompt": "../../../assets/characters/mito/danger/pixel-v2/mito-danger-pixel-v2.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "採用版",
        "pixelArt": true,
        "notes": "gpt-imageで再生成した透過PNG。色抜き・画像加工なし。旧版は比較用に保存。 全コマ共通倍率。アルファ128以上の足元から基準点と床位置を計測。",
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 515,
            "pivotX": 293.5,
            "baselineY": 508
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 515,
            "pivotX": 277.5,
            "baselineY": 508
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 515,
            "pivotX": 262.5,
            "baselineY": 508
          },
          {
            "x": 0,
            "y": 515,
            "width": 512,
            "height": 509,
            "pivotX": 293.5,
            "baselineY": 504
          },
          {
            "x": 512,
            "y": 515,
            "width": 512,
            "height": 509,
            "pivotX": 277,
            "baselineY": 504
          },
          {
            "x": 1024,
            "y": 515,
            "width": 512,
            "height": 509,
            "pivotX": 262.5,
            "baselineY": 505
          }
        ],
        "scale": 0.7214,
        "lastHoldMs": 0
      },
      {
        "id": "mito-danger-pixel-v1",
        "label": "ピンチ · ドット絵 v1",
        "kind": "animation",
        "action": "danger",
        "image": "../../../assets/characters/mito/danger/pixel-v1/mito-danger-pixel-v1.png",
        "prompt": "../../../assets/characters/mito/danger/pixel-v1/mito-danger-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "旧版・比較用",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/mito/danger/pixel-v1/mito-danger-pixel-v1-magenta.png"
          }
        ],
        "columns": 3,
        "rows": 2,
        "frameWidth": 409,
        "frameHeight": 642,
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "baselineY": 620,
        "scale": 0.64,
        "lastHoldMs": 0,
        "notes": "6コマ。均一なマゼンタ背景を透過し、グリッド用に右端と下端へ1pxの透明余白を追加。"
      },
      {
        "id": "mito-success-pixel-v2",
        "label": "成功 · ドット絵 v2（透過再生成）",
        "kind": "animation",
        "action": "success",
        "image": "../../../assets/characters/mito/success/pixel-v2/mito-success-pixel-v2.png",
        "prompt": "../../../assets/characters/mito/success/pixel-v2/mito-success-pixel-v2.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "採用版",
        "pixelArt": true,
        "notes": "gpt-imageで再生成した透過PNG。色抜き・画像加工なし。旧版は比較用に保存。 全コマ共通倍率。アルファ128以上の足元から基準点と床位置を計測。",
        "frameCount": 8,
        "fps": 7,
        "loop": false,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 384,
            "height": 515,
            "pivotX": 198.5,
            "baselineY": 509
          },
          {
            "x": 384,
            "y": 0,
            "width": 384,
            "height": 515,
            "pivotX": 191.5,
            "baselineY": 509
          },
          {
            "x": 768,
            "y": 0,
            "width": 384,
            "height": 515,
            "pivotX": 187.5,
            "baselineY": 509
          },
          {
            "x": 1152,
            "y": 0,
            "width": 384,
            "height": 515,
            "pivotX": 192,
            "baselineY": 509
          },
          {
            "x": 0,
            "y": 515,
            "width": 384,
            "height": 509,
            "pivotX": 192,
            "baselineY": 505
          },
          {
            "x": 384,
            "y": 515,
            "width": 384,
            "height": 509,
            "pivotX": 191,
            "baselineY": 505
          },
          {
            "x": 768,
            "y": 515,
            "width": 384,
            "height": 509,
            "pivotX": 198,
            "baselineY": 505
          },
          {
            "x": 1152,
            "y": 515,
            "width": 384,
            "height": 509,
            "pivotX": 198,
            "baselineY": 505
          }
        ],
        "scale": 0.7214,
        "lastHoldMs": 0
      },
      {
        "id": "mito-success-pixel-v1",
        "label": "成功リアクション · ドット絵 v1",
        "kind": "animation",
        "action": "success",
        "image": "../../../assets/characters/mito/success/pixel-v1/mito-success-pixel-v1.png",
        "prompt": "../../../assets/characters/mito/success/pixel-v1/mito-success-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "旧版・比較用",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/mito/success/pixel-v1/mito-success-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 512,
        "frameCount": 8,
        "fps": 8,
        "loop": false,
        "baselineY": 492,
        "scale": 0.8,
        "lastHoldMs": 0,
        "notes": "8コマ。札の輪を素早く掲げて戻す。均一なマゼンタ背景を機械的に透過。"
      },
      {
        "id": "mito-garbage-land-pixel-v2",
        "label": "おじゃま着地 · ドット絵 v2（透過再生成）",
        "kind": "animation",
        "action": "garbage-land",
        "image": "../../../assets/characters/mito/garbage-land/pixel-v2/mito-garbage-land-pixel-v2.png",
        "prompt": "../../../assets/characters/mito/garbage-land/pixel-v2/mito-garbage-land-pixel-v2.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "採用版",
        "pixelArt": true,
        "notes": "gpt-imageで再生成した透過PNG。色抜き・画像加工なし。旧版は比較用に保存。 全コマ共通倍率。アルファ128以上の足元から基準点と床位置を計測。",
        "frameCount": 8,
        "fps": 7,
        "loop": false,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 384,
            "height": 515,
            "pivotX": 219,
            "baselineY": 509
          },
          {
            "x": 384,
            "y": 0,
            "width": 384,
            "height": 515,
            "pivotX": 184,
            "baselineY": 504
          },
          {
            "x": 768,
            "y": 0,
            "width": 384,
            "height": 515,
            "pivotX": 202.5,
            "baselineY": 504
          },
          {
            "x": 1152,
            "y": 0,
            "width": 384,
            "height": 515,
            "pivotX": 194.5,
            "baselineY": 502
          },
          {
            "x": 0,
            "y": 515,
            "width": 384,
            "height": 509,
            "pivotX": 204.5,
            "baselineY": 495
          },
          {
            "x": 384,
            "y": 515,
            "width": 384,
            "height": 509,
            "pivotX": 263.5,
            "baselineY": 500
          },
          {
            "x": 768,
            "y": 515,
            "width": 384,
            "height": 509,
            "pivotX": 225.5,
            "baselineY": 500
          },
          {
            "x": 1152,
            "y": 515,
            "width": 384,
            "height": 509,
            "pivotX": 217.5,
            "baselineY": 505
          }
        ],
        "scale": 0.7214,
        "lastHoldMs": 0
      },
      {
        "id": "mito-garbage-land-pixel-v1",
        "label": "おじゃま着地 · ドット絵 v1",
        "kind": "animation",
        "action": "garbage-land",
        "image": "../../../assets/characters/mito/garbage-land/pixel-v1/mito-garbage-land-pixel-v1.png",
        "prompt": "../../../assets/characters/mito/garbage-land/pixel-v1/mito-garbage-land-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "旧版・比較用",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/mito/garbage-land/pixel-v1/mito-garbage-land-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 512,
        "frameCount": 8,
        "fps": 8,
        "loop": false,
        "baselineY": 492,
        "scale": 0.8,
        "lastHoldMs": 0,
        "notes": "8コマ。着地の衝撃に踏ん張り、鞄と札を押さえて立て直す。"
      },
      {
        "id": "mito-victory-pixel-v2",
        "label": "勝利・クリア · ドット絵 v2（透過再生成）",
        "kind": "animation",
        "action": "victory",
        "image": "../../../assets/characters/mito/victory/pixel-v2/mito-victory-pixel-v2.png",
        "prompt": "../../../assets/characters/mito/victory/pixel-v2/mito-victory-pixel-v2.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "採用版",
        "pixelArt": true,
        "notes": "gpt-imageで再生成した透過PNG。色抜き・画像加工なし。旧版は比較用に保存。 全コマ共通倍率。アルファ128以上の足元から基準点と床位置を計測。",
        "frameCount": 12,
        "fps": 7,
        "loop": false,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 384,
            "height": 346,
            "pivotX": 197.5,
            "baselineY": 340
          },
          {
            "x": 384,
            "y": 0,
            "width": 384,
            "height": 346,
            "pivotX": 196.5,
            "baselineY": 339
          },
          {
            "x": 768,
            "y": 0,
            "width": 384,
            "height": 346,
            "pivotX": 197,
            "baselineY": 340
          },
          {
            "x": 1152,
            "y": 0,
            "width": 384,
            "height": 346,
            "pivotX": 196,
            "baselineY": 339
          },
          {
            "x": 0,
            "y": 346,
            "width": 384,
            "height": 336,
            "pivotX": 196.5,
            "baselineY": 331
          },
          {
            "x": 384,
            "y": 346,
            "width": 384,
            "height": 336,
            "pivotX": 196.5,
            "baselineY": 331
          },
          {
            "x": 768,
            "y": 346,
            "width": 384,
            "height": 336,
            "pivotX": 196.5,
            "baselineY": 331
          },
          {
            "x": 1152,
            "y": 346,
            "width": 384,
            "height": 336,
            "pivotX": 196.5,
            "baselineY": 331
          },
          {
            "x": 0,
            "y": 682,
            "width": 384,
            "height": 342,
            "pivotX": 197,
            "baselineY": 335
          },
          {
            "x": 384,
            "y": 682,
            "width": 384,
            "height": 342,
            "pivotX": 198,
            "baselineY": 335
          },
          {
            "x": 768,
            "y": 682,
            "width": 384,
            "height": 342,
            "pivotX": 197,
            "baselineY": 335
          },
          {
            "x": 1152,
            "y": 682,
            "width": 384,
            "height": 342,
            "pivotX": 199,
            "baselineY": 335
          }
        ],
        "scale": 1.0909,
        "lastHoldMs": 0
      },
      {
        "id": "mito-victory-pixel-v1",
        "label": "勝利・クリア · ドット絵 v1",
        "kind": "animation",
        "action": "victory",
        "image": "../../../assets/characters/mito/victory/pixel-v1/mito-victory-pixel-v1.png",
        "prompt": "../../../assets/characters/mito/victory/pixel-v1/mito-victory-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "旧版・比較用",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/mito/victory/pixel-v1/mito-victory-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 3,
        "frameWidth": 256,
        "frameHeight": 512,
        "frameCount": 12,
        "fps": 8,
        "loop": false,
        "baselineY": 492,
        "scale": 0.8,
        "lastHoldMs": 400,
        "notes": "12コマ。札の輪を一度回し、片側の口角を上げて終える。"
      },
      {
        "id": "mito-defeat-pixel-v2",
        "label": "敗北 · ドット絵 v2（透過再生成）",
        "kind": "animation",
        "action": "defeat",
        "image": "../../../assets/characters/mito/defeat/pixel-v2/mito-defeat-pixel-v2.png",
        "prompt": "../../../assets/characters/mito/defeat/pixel-v2/mito-defeat-pixel-v2.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "採用版",
        "pixelArt": true,
        "notes": "gpt-imageで再生成した透過PNG。色抜き・画像加工なし。旧版は比較用に保存。 全コマ共通倍率。アルファ128以上の足元から基準点と床位置を計測。",
        "frameCount": 12,
        "fps": 7,
        "loop": false,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 384,
            "height": 363,
            "pivotX": 181.5,
            "baselineY": 356
          },
          {
            "x": 384,
            "y": 0,
            "width": 384,
            "height": 363,
            "pivotX": 181.5,
            "baselineY": 356
          },
          {
            "x": 768,
            "y": 0,
            "width": 384,
            "height": 363,
            "pivotX": 196,
            "baselineY": 356
          },
          {
            "x": 1152,
            "y": 0,
            "width": 384,
            "height": 363,
            "pivotX": 214,
            "baselineY": 357
          },
          {
            "x": 0,
            "y": 363,
            "width": 384,
            "height": 336,
            "pivotX": 181.5,
            "baselineY": 331
          },
          {
            "x": 384,
            "y": 363,
            "width": 384,
            "height": 336,
            "pivotX": 185.5,
            "baselineY": 331
          },
          {
            "x": 768,
            "y": 363,
            "width": 384,
            "height": 336,
            "pivotX": 199,
            "baselineY": 331
          },
          {
            "x": 1152,
            "y": 363,
            "width": 384,
            "height": 336,
            "pivotX": 215.5,
            "baselineY": 331
          },
          {
            "x": 0,
            "y": 699,
            "width": 384,
            "height": 325,
            "pivotX": 182,
            "baselineY": 321
          },
          {
            "x": 384,
            "y": 699,
            "width": 384,
            "height": 325,
            "pivotX": 186.5,
            "baselineY": 321
          },
          {
            "x": 768,
            "y": 699,
            "width": 384,
            "height": 325,
            "pivotX": 200.5,
            "baselineY": 321
          },
          {
            "x": 1152,
            "y": 699,
            "width": 384,
            "height": 325,
            "pivotX": 214,
            "baselineY": 321
          }
        ],
        "scale": 1.0286,
        "lastHoldMs": 0
      },
      {
        "id": "mito-defeat-pixel-v1",
        "label": "敗北・失敗 · ドット絵 v1",
        "kind": "animation",
        "action": "defeat",
        "image": "../../../assets/characters/mito/defeat/pixel-v1/mito-defeat-pixel-v1.png",
        "prompt": "../../../assets/characters/mito/defeat/pixel-v1/mito-defeat-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "旧版・比較用",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/mito/defeat/pixel-v1/mito-defeat-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 3,
        "frameWidth": 296,
        "frameHeight": 444,
        "frameCount": 12,
        "fps": 8,
        "loop": false,
        "baselineY": 424,
        "scale": 0.9,
        "lastHoldMs": 400,
        "notes": "12コマ。札の輪を額に当て、負けを受け止めて笑う。グリッド用に右端と下端を透明で補正。"
      },
      {
        "id": "mito-finish-pixel-v2",
        "label": "通常終了 · ドット絵 v2（透過再生成）",
        "kind": "animation",
        "action": "finish",
        "image": "../../../assets/characters/mito/finish/pixel-v2/mito-finish-pixel-v2.png",
        "prompt": "../../../assets/characters/mito/finish/pixel-v2/mito-finish-pixel-v2.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "採用版",
        "pixelArt": true,
        "notes": "gpt-imageで再生成した透過PNG。色抜き・画像加工なし。旧版は比較用に保存。 全コマ共通倍率。アルファ128以上の足元から基準点と床位置を計測。",
        "frameCount": 8,
        "fps": 7,
        "loop": false,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 384,
            "height": 511,
            "pivotX": 218,
            "baselineY": 504
          },
          {
            "x": 384,
            "y": 0,
            "width": 384,
            "height": 511,
            "pivotX": 211.5,
            "baselineY": 504
          },
          {
            "x": 768,
            "y": 0,
            "width": 384,
            "height": 511,
            "pivotX": 207.5,
            "baselineY": 504
          },
          {
            "x": 1152,
            "y": 0,
            "width": 384,
            "height": 511,
            "pivotX": 210,
            "baselineY": 504
          },
          {
            "x": 0,
            "y": 511,
            "width": 384,
            "height": 513,
            "pivotX": 192,
            "baselineY": 501
          },
          {
            "x": 384,
            "y": 511,
            "width": 384,
            "height": 513,
            "pivotX": 189,
            "baselineY": 501
          },
          {
            "x": 768,
            "y": 511,
            "width": 384,
            "height": 513,
            "pivotX": 184,
            "baselineY": 501
          },
          {
            "x": 1152,
            "y": 511,
            "width": 384,
            "height": 513,
            "pivotX": 192,
            "baselineY": 501
          }
        ],
        "scale": 0.7302,
        "lastHoldMs": 0
      },
      {
        "id": "mito-finish-pixel-v1",
        "label": "通常終了 · ドット絵 v1",
        "kind": "animation",
        "action": "finish",
        "image": "../../../assets/characters/mito/finish/pixel-v1/mito-finish-pixel-v1.png",
        "prompt": "../../../assets/characters/mito/finish/pixel-v1/mito-finish-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "旧版・比較用",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/mito/finish/pixel-v1/mito-finish-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 512,
        "frameCount": 8,
        "fps": 8,
        "loop": false,
        "baselineY": 492,
        "scale": 0.8,
        "lastHoldMs": 300,
        "notes": "8コマ。一息つき、札を確認して鞄のベルトを整える。"
      }
    ],
    "adoptedAssets": {
      "portrait": "mito-portrait-pixel-v2",
      "icon": "mito-icon-pixel-v2",
      "idle": "mito-idle-pixel-v2",
      "danger": "mito-danger-pixel-v2",
      "success": "mito-success-pixel-v2",
      "garbage-land": "mito-garbage-land-pixel-v2",
      "victory": "mito-victory-pixel-v2",
      "defeat": "mito-defeat-pixel-v2",
      "finish": "mito-finish-pixel-v2"
    }
  },
  {
    "id": "sena",
    "name": "セナ",
    "role": "調整士候補",
    "color": "#667b9d",
    "assets": [
      {
        "id": "sena-idle-spritegen-v2",
        "label": "待機 · sprite-gen v2（512px・6コマ）",
        "kind": "animation",
        "action": "idle",
        "image": "../../../assets/characters/sena/notes/spritegen-v2/run/sprite-sheet-alpha.png",
        "prompt": "../../../assets/characters/sena/notes/spritegen-v2/run/prompts/idle.txt",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "512×512px・6コマで再生成。128pxへの格子整形と減色を外し、背景除去・分割・位置合わせを適用。",
        "frameCount": 6,
        "fps": 6,
        "loop": true,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "sena-victory-spritegen-v2",
        "label": "勝利 · sprite-gen v2（512px・6コマ）",
        "kind": "animation",
        "action": "victory",
        "image": "../../../assets/characters/sena/notes/spritegen-v2/run/sprite-sheet-alpha.png",
        "prompt": "../../../assets/characters/sena/notes/spritegen-v2/run/prompts/victory.txt",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "512×512px・6コマで再生成。128pxへの格子整形と減色を外し、背景除去・分割・位置合わせを適用。",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 512,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "sena-idle-spritegen-v1",
        "label": "待機 · sprite-gen v1",
        "kind": "animation",
        "action": "idle",
        "image": "../../../assets/characters/sena/notes/spritegen-v1/run/sprite-sheet-alpha.png",
        "prompt": "../../../assets/characters/sena/notes/spritegen-v1/run/prompts/idle.txt",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "比較試作・未採用",
        "pixelArt": true,
        "notes": "sprite-gen v2.0.3。背景除去・コマ抽出・24色パレット・2倍ピクセル整形済み。生成原画の格子検出に警告あり。動作はbest-effort。",
        "frameCount": 4,
        "fps": 4,
        "loop": true,
        "lastHoldMs": 0,
        "scale": 1.5,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 192,
            "height": 256,
            "pivotX": 96,
            "baselineY": 244
          },
          {
            "x": 192,
            "y": 0,
            "width": 192,
            "height": 256,
            "pivotX": 96,
            "baselineY": 244
          },
          {
            "x": 384,
            "y": 0,
            "width": 192,
            "height": 256,
            "pivotX": 96,
            "baselineY": 244
          },
          {
            "x": 576,
            "y": 0,
            "width": 192,
            "height": 256,
            "pivotX": 96,
            "baselineY": 244
          }
        ]
      },
      {
        "id": "sena-victory-spritegen-v1",
        "label": "勝利 · sprite-gen v1",
        "kind": "animation",
        "action": "victory",
        "image": "../../../assets/characters/sena/notes/spritegen-v1/run/sprite-sheet-alpha.png",
        "prompt": "../../../assets/characters/sena/notes/spritegen-v1/run/prompts/victory.txt",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "比較試作・未採用",
        "pixelArt": true,
        "notes": "sprite-gen v2.0.3。背景除去・コマ抽出・24色パレット・2倍ピクセル整形済み。生成原画の格子検出に警告あり。動作はbest-effort。",
        "frameCount": 4,
        "fps": 5,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 1.5,
        "frames": [
          {
            "x": 0,
            "y": 256,
            "width": 192,
            "height": 256,
            "pivotX": 96,
            "baselineY": 244
          },
          {
            "x": 192,
            "y": 256,
            "width": 192,
            "height": 256,
            "pivotX": 96,
            "baselineY": 244
          },
          {
            "x": 384,
            "y": 256,
            "width": 192,
            "height": 256,
            "pivotX": 96,
            "baselineY": 244
          },
          {
            "x": 576,
            "y": 256,
            "width": 192,
            "height": 256,
            "pivotX": 96,
            "baselineY": 244
          }
        ]
      },
      {
        "id": "sena-portrait-pixel-v1",
        "label": "基準立ち絵 · ドット絵 v1",
        "kind": "image",
        "action": "portrait",
        "image": "../../../assets/characters/sena/portrait/pixel-v1/sena-portrait-pixel-v1.png",
        "prompt": "../../../assets/characters/sena/portrait/pixel-v1/sena-portrait-pixel-v1.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "試作・確認用",
        "pixelArt": true,
        "notes": "セナの人物設定と基準立ち絵から生成。生成PNGのアルファを保持し、色抜き・画像加工なし。"
      },
      {
        "id": "sena-icon-pixel-v1",
        "label": "顔アイコン · ドット絵 v1",
        "kind": "image",
        "action": "icon",
        "image": "../../../assets/characters/sena/icon/pixel-v1/sena-icon-pixel-v1.png",
        "prompt": "../../../assets/characters/sena/icon/pixel-v1/sena-icon-pixel-v1.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "試作・確認用",
        "pixelArt": true,
        "notes": "セナの人物設定と基準立ち絵から生成。生成PNGのアルファを保持し、色抜き・画像加工なし。"
      },
      {
        "id": "sena-idle-pixel-v1",
        "label": "待機 · ドット絵 v1",
        "kind": "animation",
        "action": "idle",
        "image": "../../../assets/characters/sena/idle/pixel-v1/sena-idle-pixel-v1.png",
        "prompt": "../../../assets/characters/sena/idle/pixel-v1/sena-idle-pixel-v1.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "試作・確認用",
        "pixelArt": true,
        "notes": "セナの人物設定と基準立ち絵から生成。生成PNGのアルファを保持し、色抜き・画像加工なし。 全コマ共通倍率。足元から基準点と床位置を計測。",
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 516,
            "pivotX": 284.5,
            "baselineY": 510
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 516,
            "pivotX": 264,
            "baselineY": 510
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 516,
            "pivotX": 248.5,
            "baselineY": 510
          },
          {
            "x": 0,
            "y": 516,
            "width": 512,
            "height": 508,
            "pivotX": 285,
            "baselineY": 506
          },
          {
            "x": 512,
            "y": 516,
            "width": 512,
            "height": 508,
            "pivotX": 262.5,
            "baselineY": 505
          },
          {
            "x": 1024,
            "y": 516,
            "width": 512,
            "height": 508,
            "pivotX": 248,
            "baselineY": 506
          }
        ],
        "scale": 0.72,
        "lastHoldMs": 0
      },
      {
        "id": "sena-danger-pixel-v1",
        "label": "ピンチ · ドット絵 v1",
        "kind": "animation",
        "action": "danger",
        "image": "../../../assets/characters/sena/danger/pixel-v1/sena-danger-pixel-v1.png",
        "prompt": "../../../assets/characters/sena/danger/pixel-v1/sena-danger-pixel-v1.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "試作・確認用",
        "pixelArt": true,
        "notes": "セナの人物設定と基準立ち絵から生成。生成PNGのアルファを保持し、色抜き・画像加工なし。 全コマ共通倍率。足元から基準点と床位置を計測。",
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 513,
            "pivotX": 372.5,
            "baselineY": 508
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 513,
            "pivotX": 264.5,
            "baselineY": 508
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 513,
            "pivotX": 147.5,
            "baselineY": 508
          },
          {
            "x": 0,
            "y": 513,
            "width": 512,
            "height": 511,
            "pivotX": 369.5,
            "baselineY": 505
          },
          {
            "x": 512,
            "y": 513,
            "width": 512,
            "height": 511,
            "pivotX": 265,
            "baselineY": 505
          },
          {
            "x": 1024,
            "y": 513,
            "width": 512,
            "height": 511,
            "pivotX": 150,
            "baselineY": 505
          }
        ],
        "scale": 0.72,
        "lastHoldMs": 0
      },
      {
        "id": "sena-success-pixel-v1",
        "label": "成功 · ドット絵 v1",
        "kind": "animation",
        "action": "success",
        "image": "../../../assets/characters/sena/success/pixel-v1/sena-success-pixel-v1.png",
        "prompt": "../../../assets/characters/sena/success/pixel-v1/sena-success-pixel-v1.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "試作・確認用",
        "pixelArt": true,
        "notes": "セナの人物設定と基準立ち絵から生成。生成PNGのアルファを保持し、色抜き・画像加工なし。 全コマ共通倍率。足元から基準点と床位置を計測。",
        "frameCount": 8,
        "fps": 7,
        "loop": false,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 384,
            "height": 516,
            "pivotX": 227.5,
            "baselineY": 510
          },
          {
            "x": 384,
            "y": 0,
            "width": 384,
            "height": 516,
            "pivotX": 206.5,
            "baselineY": 511
          },
          {
            "x": 768,
            "y": 0,
            "width": 384,
            "height": 516,
            "pivotX": 187.5,
            "baselineY": 511
          },
          {
            "x": 1152,
            "y": 0,
            "width": 384,
            "height": 516,
            "pivotX": 170,
            "baselineY": 510
          },
          {
            "x": 0,
            "y": 516,
            "width": 384,
            "height": 508,
            "pivotX": 226.5,
            "baselineY": 503
          },
          {
            "x": 384,
            "y": 516,
            "width": 384,
            "height": 508,
            "pivotX": 206,
            "baselineY": 503
          },
          {
            "x": 768,
            "y": 516,
            "width": 384,
            "height": 508,
            "pivotX": 187.5,
            "baselineY": 503
          },
          {
            "x": 1152,
            "y": 516,
            "width": 384,
            "height": 508,
            "pivotX": 170,
            "baselineY": 503
          }
        ],
        "scale": 0.7229,
        "lastHoldMs": 0
      },
      {
        "id": "sena-garbage-land-pixel-v1",
        "label": "おじゃま着地 · ドット絵 v1",
        "kind": "animation",
        "action": "garbage-land",
        "image": "../../../assets/characters/sena/garbage-land/pixel-v1/sena-garbage-land-pixel-v1.png",
        "prompt": "../../../assets/characters/sena/garbage-land/pixel-v1/sena-garbage-land-pixel-v1.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "試作・確認用",
        "pixelArt": true,
        "notes": "セナの人物設定と基準立ち絵から生成。生成PNGのアルファを保持し、色抜き・画像加工なし。 全コマ共通倍率。足元から基準点と床位置を計測。",
        "frameCount": 8,
        "fps": 7,
        "loop": false,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 384,
            "height": 511,
            "pivotX": 192.5,
            "baselineY": 505
          },
          {
            "x": 384,
            "y": 0,
            "width": 384,
            "height": 511,
            "pivotX": 192.5,
            "baselineY": 504
          },
          {
            "x": 768,
            "y": 0,
            "width": 384,
            "height": 511,
            "pivotX": 181,
            "baselineY": 505
          },
          {
            "x": 1152,
            "y": 0,
            "width": 384,
            "height": 511,
            "pivotX": 191,
            "baselineY": 505
          },
          {
            "x": 0,
            "y": 511,
            "width": 384,
            "height": 513,
            "pivotX": 212.5,
            "baselineY": 499
          },
          {
            "x": 384,
            "y": 511,
            "width": 384,
            "height": 513,
            "pivotX": 208,
            "baselineY": 499
          },
          {
            "x": 768,
            "y": 511,
            "width": 384,
            "height": 513,
            "pivotX": 193.5,
            "baselineY": 499
          },
          {
            "x": 1152,
            "y": 511,
            "width": 384,
            "height": 513,
            "pivotX": 193,
            "baselineY": 499
          }
        ],
        "scale": 0.7287,
        "lastHoldMs": 0
      },
      {
        "id": "sena-victory-pixel-v1",
        "label": "勝利・クリア · ドット絵 v1",
        "kind": "animation",
        "action": "victory",
        "image": "../../../assets/characters/sena/victory/pixel-v1/sena-victory-pixel-v1.png",
        "prompt": "../../../assets/characters/sena/victory/pixel-v1/sena-victory-pixel-v1.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "試作・確認用",
        "pixelArt": true,
        "notes": "セナの人物設定と基準立ち絵から生成。生成PNGのアルファを保持し、色抜き・画像加工なし。 全コマ共通倍率。足元から基準点と床位置を計測。",
        "frameCount": 12,
        "fps": 7,
        "loop": false,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 384,
            "height": 343,
            "pivotX": 287,
            "baselineY": 336
          },
          {
            "x": 384,
            "y": 0,
            "width": 384,
            "height": 343,
            "pivotX": 225,
            "baselineY": 336
          },
          {
            "x": 768,
            "y": 0,
            "width": 384,
            "height": 343,
            "pivotX": 166,
            "baselineY": 336
          },
          {
            "x": 1152,
            "y": 0,
            "width": 384,
            "height": 343,
            "pivotX": 106.5,
            "baselineY": 336
          },
          {
            "x": 0,
            "y": 343,
            "width": 384,
            "height": 338,
            "pivotX": 286,
            "baselineY": 332
          },
          {
            "x": 384,
            "y": 343,
            "width": 384,
            "height": 338,
            "pivotX": 225,
            "baselineY": 332
          },
          {
            "x": 768,
            "y": 343,
            "width": 384,
            "height": 338,
            "pivotX": 168.5,
            "baselineY": 332
          },
          {
            "x": 1152,
            "y": 343,
            "width": 384,
            "height": 338,
            "pivotX": 108,
            "baselineY": 332
          },
          {
            "x": 0,
            "y": 681,
            "width": 384,
            "height": 343,
            "pivotX": 287.5,
            "baselineY": 332
          },
          {
            "x": 384,
            "y": 681,
            "width": 384,
            "height": 343,
            "pivotX": 227.5,
            "baselineY": 332
          },
          {
            "x": 768,
            "y": 681,
            "width": 384,
            "height": 343,
            "pivotX": 169,
            "baselineY": 332
          },
          {
            "x": 1152,
            "y": 681,
            "width": 384,
            "height": 343,
            "pivotX": 109,
            "baselineY": 332
          }
        ],
        "scale": 1.1077,
        "lastHoldMs": 0
      },
      {
        "id": "sena-defeat-pixel-v1",
        "label": "敗北 · ドット絵 v1",
        "kind": "animation",
        "action": "defeat",
        "image": "../../../assets/characters/sena/defeat/pixel-v1/sena-defeat-pixel-v1.png",
        "prompt": "../../../assets/characters/sena/defeat/pixel-v1/sena-defeat-pixel-v1.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "試作・確認用",
        "pixelArt": true,
        "notes": "セナの人物設定と基準立ち絵から生成。生成PNGのアルファを保持し、色抜き・画像加工なし。 全コマ共通倍率。足元から基準点と床位置を計測。",
        "frameCount": 12,
        "fps": 7,
        "loop": false,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 384,
            "height": 345,
            "pivotX": 218.5,
            "baselineY": 339
          },
          {
            "x": 384,
            "y": 0,
            "width": 384,
            "height": 345,
            "pivotX": 185.5,
            "baselineY": 339
          },
          {
            "x": 768,
            "y": 0,
            "width": 384,
            "height": 345,
            "pivotX": 185.5,
            "baselineY": 339
          },
          {
            "x": 1152,
            "y": 0,
            "width": 384,
            "height": 345,
            "pivotX": 184.5,
            "baselineY": 340
          },
          {
            "x": 0,
            "y": 345,
            "width": 384,
            "height": 339,
            "pivotX": 218,
            "baselineY": 331
          },
          {
            "x": 384,
            "y": 345,
            "width": 384,
            "height": 339,
            "pivotX": 185.5,
            "baselineY": 331
          },
          {
            "x": 768,
            "y": 345,
            "width": 384,
            "height": 339,
            "pivotX": 186,
            "baselineY": 330
          },
          {
            "x": 1152,
            "y": 345,
            "width": 384,
            "height": 339,
            "pivotX": 184.5,
            "baselineY": 331
          },
          {
            "x": 0,
            "y": 684,
            "width": 384,
            "height": 340,
            "pivotX": 218,
            "baselineY": 329
          },
          {
            "x": 384,
            "y": 684,
            "width": 384,
            "height": 340,
            "pivotX": 186.5,
            "baselineY": 329
          },
          {
            "x": 768,
            "y": 684,
            "width": 384,
            "height": 340,
            "pivotX": 186,
            "baselineY": 329
          },
          {
            "x": 1152,
            "y": 684,
            "width": 384,
            "height": 340,
            "pivotX": 185,
            "baselineY": 329
          }
        ],
        "scale": 1.0876,
        "lastHoldMs": 0
      },
      {
        "id": "sena-finish-pixel-v1",
        "label": "通常終了 · ドット絵 v1",
        "kind": "animation",
        "action": "finish",
        "image": "../../../assets/characters/sena/finish/pixel-v1/sena-finish-pixel-v1.png",
        "prompt": "../../../assets/characters/sena/finish/pixel-v1/sena-finish-pixel-v1.prompt.txt",
        "model": "gpt-image（内蔵画像生成ツール、モデル版指定なし）",
        "status": "試作・確認用",
        "pixelArt": true,
        "notes": "セナの人物設定と基準立ち絵から生成。生成PNGのアルファを保持し、色抜き・画像加工なし。 全コマ共通倍率。足元から基準点と床位置を計測。",
        "frameCount": 8,
        "fps": 7,
        "loop": false,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 384,
            "height": 514,
            "pivotX": 224,
            "baselineY": 508
          },
          {
            "x": 384,
            "y": 0,
            "width": 384,
            "height": 514,
            "pivotX": 202,
            "baselineY": 508
          },
          {
            "x": 768,
            "y": 0,
            "width": 384,
            "height": 514,
            "pivotX": 189.5,
            "baselineY": 508
          },
          {
            "x": 1152,
            "y": 0,
            "width": 384,
            "height": 514,
            "pivotX": 173.5,
            "baselineY": 508
          },
          {
            "x": 0,
            "y": 514,
            "width": 384,
            "height": 510,
            "pivotX": 223,
            "baselineY": 498
          },
          {
            "x": 384,
            "y": 514,
            "width": 384,
            "height": 510,
            "pivotX": 202.5,
            "baselineY": 498
          },
          {
            "x": 768,
            "y": 514,
            "width": 384,
            "height": 510,
            "pivotX": 192,
            "baselineY": 498
          },
          {
            "x": 1152,
            "y": 514,
            "width": 384,
            "height": 510,
            "pivotX": 176.5,
            "baselineY": 498
          }
        ],
        "scale": 0.7273,
        "lastHoldMs": 0
      }
    ],
    "adoptedAssets": {
      "idle": "sena-idle-spritegen-v2",
      "victory": "sena-victory-spritegen-v2",
      "portrait": "sena-portrait-pixel-v1",
      "icon": "sena-icon-pixel-v1",
      "danger": "sena-danger-pixel-v1",
      "success": "sena-success-pixel-v1",
      "garbage-land": "sena-garbage-land-pixel-v1",
      "defeat": "sena-defeat-pixel-v1",
      "finish": "sena-finish-pixel-v1"
    }
  },
  {
    "id": "rocca",
    "name": "ロッカ",
    "role": "昇降機の整備士",
    "color": "#a97449",
    "assets": [
      {
        "id": "rocca-portrait-spritegen-v1",
        "label": "立ち絵 · sprite-gen v1",
        "action": "portrait",
        "kind": "image",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/rocca/portrait/spritegen-v1/rocca-portrait-spritegen-v1.png",
        "prompt": "../../../assets/characters/rocca/notes/spritegen-v1/base.prompt.txt"
      },
      {
        "id": "rocca-icon-spritegen-v1",
        "label": "アイコン · sprite-gen v1",
        "action": "icon",
        "kind": "image",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/rocca/icon/spritegen-v1/rocca-icon-spritegen-v1.png",
        "prompt": "../../../assets/characters/rocca/notes/spritegen-v1/base.prompt.txt"
      },
      {
        "id": "rocca-idle-spritegen-v1",
        "label": "待機 · sprite-gen v1",
        "action": "idle",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/rocca/idle/spritegen-v1/rocca-idle-spritegen-v1.png",
        "prompt": "../../../assets/characters/rocca/notes/spritegen-v1/run/prompts/idle.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": true,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "rocca-danger-spritegen-v1",
        "label": "ピンチ · sprite-gen v1",
        "action": "danger",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/rocca/danger/spritegen-v1/rocca-danger-spritegen-v1.png",
        "prompt": "../../../assets/characters/rocca/notes/spritegen-v1/run/prompts/danger.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": true,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "rocca-success-spritegen-v1",
        "label": "成功 · sprite-gen v1",
        "action": "success",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/rocca/success/spritegen-v1/rocca-success-spritegen-v1.png",
        "prompt": "../../../assets/characters/rocca/notes/spritegen-v1/run/prompts/success.txt",
        "frameCount": 6,
        "fps": 8,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "rocca-garbage-land-spritegen-v1",
        "label": "おじゃま着地 · sprite-gen v1",
        "action": "garbage-land",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/rocca/garbage-land/spritegen-v1/rocca-garbage-land-spritegen-v1.png",
        "prompt": "../../../assets/characters/rocca/notes/spritegen-v1/run/prompts/garbage-land.txt",
        "frameCount": 6,
        "fps": 8,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "rocca-victory-spritegen-v1",
        "label": "勝利 · sprite-gen v1",
        "action": "victory",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/rocca/victory/spritegen-v1/rocca-victory-spritegen-v1.png",
        "prompt": "../../../assets/characters/rocca/notes/spritegen-v1/run/prompts/victory.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "rocca-defeat-spritegen-v1",
        "label": "敗北 · sprite-gen v1",
        "action": "defeat",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/rocca/defeat/spritegen-v1/rocca-defeat-spritegen-v1.png",
        "prompt": "../../../assets/characters/rocca/notes/spritegen-v1/run/prompts/defeat.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "rocca-finish-spritegen-v1",
        "label": "通常終了 · sprite-gen v1",
        "action": "finish",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/rocca/finish/spritegen-v1/rocca-finish-spritegen-v1.png",
        "prompt": "../../../assets/characters/rocca/notes/spritegen-v1/run/prompts/finish.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      }
    ],
    "adoptedAssets": {
      "portrait": "rocca-portrait-spritegen-v1",
      "icon": "rocca-icon-spritegen-v1",
      "idle": "rocca-idle-spritegen-v1",
      "danger": "rocca-danger-spritegen-v1",
      "success": "rocca-success-spritegen-v1",
      "garbage-land": "rocca-garbage-land-spritegen-v1",
      "victory": "rocca-victory-spritegen-v1",
      "defeat": "rocca-defeat-spritegen-v1",
      "finish": "rocca-finish-spritegen-v1"
    }
  },
  {
    "id": "yuno",
    "name": "ユノ",
    "role": "地図職人",
    "color": "#7d7996",
    "assets": [
      {
        "id": "yuno-portrait-spritegen-v1",
        "label": "立ち絵 · sprite-gen v1",
        "action": "portrait",
        "kind": "image",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/yuno/portrait/spritegen-v1/yuno-portrait-spritegen-v1.png",
        "prompt": "../../../assets/characters/yuno/notes/spritegen-v1/base.prompt.txt"
      },
      {
        "id": "yuno-icon-spritegen-v1",
        "label": "アイコン · sprite-gen v1",
        "action": "icon",
        "kind": "image",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/yuno/icon/spritegen-v1/yuno-icon-spritegen-v1.png",
        "prompt": "../../../assets/characters/yuno/notes/spritegen-v1/base.prompt.txt"
      },
      {
        "id": "yuno-idle-spritegen-v1",
        "label": "待機 · sprite-gen v1",
        "action": "idle",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/yuno/idle/spritegen-v1/yuno-idle-spritegen-v1.png",
        "prompt": "../../../assets/characters/yuno/notes/spritegen-v1/run/prompts/idle.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": true,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "yuno-danger-spritegen-v1",
        "label": "ピンチ · sprite-gen v1",
        "action": "danger",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/yuno/danger/spritegen-v1/yuno-danger-spritegen-v1.png",
        "prompt": "../../../assets/characters/yuno/notes/spritegen-v1/run/prompts/danger.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": true,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "yuno-success-spritegen-v1",
        "label": "成功 · sprite-gen v1",
        "action": "success",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/yuno/success/spritegen-v1/yuno-success-spritegen-v1.png",
        "prompt": "../../../assets/characters/yuno/notes/spritegen-v1/run/prompts/success.txt",
        "frameCount": 6,
        "fps": 8,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "yuno-garbage-land-spritegen-v1",
        "label": "おじゃま着地 · sprite-gen v1",
        "action": "garbage-land",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/yuno/garbage-land/spritegen-v1/yuno-garbage-land-spritegen-v1.png",
        "prompt": "../../../assets/characters/yuno/notes/spritegen-v1/run/prompts/garbage-land.txt",
        "frameCount": 6,
        "fps": 8,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "yuno-victory-spritegen-v1",
        "label": "勝利 · sprite-gen v1",
        "action": "victory",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/yuno/victory/spritegen-v1/yuno-victory-spritegen-v1.png",
        "prompt": "../../../assets/characters/yuno/notes/spritegen-v1/run/prompts/victory.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "yuno-defeat-spritegen-v1",
        "label": "敗北 · sprite-gen v1",
        "action": "defeat",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/yuno/defeat/spritegen-v1/yuno-defeat-spritegen-v1.png",
        "prompt": "../../../assets/characters/yuno/notes/spritegen-v1/run/prompts/defeat.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "yuno-finish-spritegen-v1",
        "label": "通常終了 · sprite-gen v1",
        "action": "finish",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/yuno/finish/spritegen-v1/yuno-finish-spritegen-v1.png",
        "prompt": "../../../assets/characters/yuno/notes/spritegen-v1/run/prompts/finish.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      }
    ],
    "adoptedAssets": {
      "portrait": "yuno-portrait-spritegen-v1",
      "icon": "yuno-icon-spritegen-v1",
      "idle": "yuno-idle-spritegen-v1",
      "danger": "yuno-danger-spritegen-v1",
      "success": "yuno-success-spritegen-v1",
      "garbage-land": "yuno-garbage-land-spritegen-v1",
      "victory": "yuno-victory-spritegen-v1",
      "defeat": "yuno-defeat-spritegen-v1",
      "finish": "yuno-finish-spritegen-v1"
    }
  },
  {
    "id": "baro",
    "name": "バロ",
    "role": "アナグマの古道具屋",
    "color": "#897359",
    "assets": [
      {
        "id": "baro-portrait-spritegen-v1",
        "label": "立ち絵 · sprite-gen v1",
        "action": "portrait",
        "kind": "image",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/baro/portrait/spritegen-v1/baro-portrait-spritegen-v1.png",
        "prompt": "../../../assets/characters/baro/notes/spritegen-v1/base.prompt.txt"
      },
      {
        "id": "baro-icon-spritegen-v1",
        "label": "アイコン · sprite-gen v1",
        "action": "icon",
        "kind": "image",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/baro/icon/spritegen-v1/baro-icon-spritegen-v1.png",
        "prompt": "../../../assets/characters/baro/notes/spritegen-v1/base.prompt.txt"
      },
      {
        "id": "baro-idle-spritegen-v1",
        "label": "待機 · sprite-gen v1",
        "action": "idle",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/baro/idle/spritegen-v1/baro-idle-spritegen-v1.png",
        "prompt": "../../../assets/characters/baro/notes/spritegen-v1/run/prompts/idle.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": true,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "baro-danger-spritegen-v1",
        "label": "ピンチ · sprite-gen v1",
        "action": "danger",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/baro/danger/spritegen-v1/baro-danger-spritegen-v1.png",
        "prompt": "../../../assets/characters/baro/notes/spritegen-v1/run/prompts/danger.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": true,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "baro-success-spritegen-v1",
        "label": "成功 · sprite-gen v1",
        "action": "success",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/baro/success/spritegen-v1/baro-success-spritegen-v1.png",
        "prompt": "../../../assets/characters/baro/notes/spritegen-v1/run/prompts/success.txt",
        "frameCount": 6,
        "fps": 8,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "baro-garbage-land-spritegen-v1",
        "label": "おじゃま着地 · sprite-gen v1",
        "action": "garbage-land",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/baro/garbage-land/spritegen-v1/baro-garbage-land-spritegen-v1.png",
        "prompt": "../../../assets/characters/baro/notes/spritegen-v1/run/prompts/garbage-land.txt",
        "frameCount": 6,
        "fps": 8,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "baro-victory-spritegen-v1",
        "label": "勝利 · sprite-gen v1",
        "action": "victory",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/baro/victory/spritegen-v1/baro-victory-spritegen-v1.png",
        "prompt": "../../../assets/characters/baro/notes/spritegen-v1/run/prompts/victory.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "baro-defeat-spritegen-v1",
        "label": "敗北 · sprite-gen v1",
        "action": "defeat",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/baro/defeat/spritegen-v1/baro-defeat-spritegen-v1.png",
        "prompt": "../../../assets/characters/baro/notes/spritegen-v1/run/prompts/defeat.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "baro-finish-spritegen-v1",
        "label": "通常終了 · sprite-gen v1",
        "action": "finish",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/baro/finish/spritegen-v1/baro-finish-spritegen-v1.png",
        "prompt": "../../../assets/characters/baro/notes/spritegen-v1/run/prompts/finish.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      }
    ],
    "adoptedAssets": {
      "portrait": "baro-portrait-spritegen-v1",
      "icon": "baro-icon-spritegen-v1",
      "idle": "baro-idle-spritegen-v1",
      "danger": "baro-danger-spritegen-v1",
      "success": "baro-success-spritegen-v1",
      "garbage-land": "baro-garbage-land-spritegen-v1",
      "victory": "baro-victory-spritegen-v1",
      "defeat": "baro-defeat-spritegen-v1",
      "finish": "baro-finish-spritegen-v1"
    }
  },
  {
    "id": "pirika",
    "name": "ピリカ",
    "role": "トビネズミの案内業者",
    "color": "#c09748",
    "assets": [
      {
        "id": "pirika-icon-pixel-v2",
        "label": "顔アイコン · ドット絵 v2（右下の点を除去）",
        "kind": "image",
        "action": "icon",
        "image": "../../../assets/characters/pirika/icon/pixel-v2/pirika-icon-pixel-v2.png",
        "prompt": "../../../assets/characters/pirika/icon/pixel-v2/pirika-icon-pixel-v2.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "採用版の修正",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/pirika/portrait/pixel-v1/pirika-portrait-pixel-v1-magenta.png"
          }
        ],
        "notes": "右下に入り込んだ鉛筆の先端を画像編集ツールで除去。256pxに縮小。"
      },
      {
        "id": "pirika-portrait-pixel-v1",
        "label": "基準立ち絵 · ドット絵 v1",
        "kind": "image",
        "action": "portrait",
        "image": "../../../assets/characters/pirika/portrait/pixel-v1/pirika-portrait-pixel-v1.png",
        "prompt": "../../../assets/characters/pirika/portrait/pixel-v1/pirika-portrait-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "採用版",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/pirika/portrait/pixel-v1/pirika-portrait-pixel-v1-magenta.png"
          }
        ]
      },
      {
        "id": "pirika-icon-pixel-v1",
        "label": "顔アイコン · ドット絵 v1",
        "kind": "image",
        "action": "icon",
        "image": "../../../assets/characters/pirika/icon/pixel-v1/pirika-icon-pixel-v1.png",
        "prompt": "../../../assets/characters/pirika/icon/pixel-v1/pirika-icon-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/pirika/portrait/pixel-v1/pirika-portrait-pixel-v1-magenta.png"
          }
        ],
        "notes": "基準立ち絵の顔と耳を切り出しています。"
      },
      {
        "id": "pirika-idle-pixel-v1",
        "label": "待機 · ドット絵 v1",
        "kind": "animation",
        "action": "idle",
        "image": "../../../assets/characters/pirika/idle/pixel-v1/pirika-idle-pixel-v1.png",
        "prompt": "../../../assets/characters/pirika/idle/pixel-v1/pirika-idle-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "採用版",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/pirika/idle/pixel-v1/pirika-idle-pixel-v1-magenta.png"
          }
        ],
        "columns": 3,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "6コマ。透過と位置合わせを画像に適用済み。"
      },
      {
        "id": "pirika-danger-pixel-v1",
        "label": "ピンチ · ドット絵 v1",
        "kind": "animation",
        "action": "danger",
        "image": "../../../assets/characters/pirika/danger/pixel-v1/pirika-danger-pixel-v1.png",
        "prompt": "../../../assets/characters/pirika/danger/pixel-v1/pirika-danger-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "採用版",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/pirika/danger/pixel-v1/pirika-danger-pixel-v1-magenta.png"
          }
        ],
        "columns": 3,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "6コマ。透過と位置合わせを画像に適用済み。"
      },
      {
        "id": "pirika-success-pixel-v1",
        "label": "成功リアクション · ドット絵 v1",
        "kind": "animation",
        "action": "success",
        "image": "../../../assets/characters/pirika/success/pixel-v1/pirika-success-pixel-v1.png",
        "prompt": "../../../assets/characters/pirika/success/pixel-v1/pirika-success-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "採用版",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/pirika/success/pixel-v1/pirika-success-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 8,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "8コマ。透過と位置合わせを画像に適用済み。"
      },
      {
        "id": "pirika-garbage-land-pixel-v1",
        "label": "おじゃま着地 · ドット絵 v1",
        "kind": "animation",
        "action": "garbage-land",
        "image": "../../../assets/characters/pirika/garbage-land/pixel-v1/pirika-garbage-land-pixel-v1.png",
        "prompt": "../../../assets/characters/pirika/garbage-land/pixel-v1/pirika-garbage-land-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "採用版",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/pirika/garbage-land/pixel-v1/pirika-garbage-land-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 8,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "8コマ。透過と位置合わせを画像に適用済み。動作中に鉛筆が見えなくなる箇所は今後の調整候補。"
      },
      {
        "id": "pirika-victory-pixel-v1",
        "label": "勝利・クリア · ドット絵 v1",
        "kind": "animation",
        "action": "victory",
        "image": "../../../assets/characters/pirika/victory/pixel-v1/pirika-victory-pixel-v1.png",
        "prompt": "../../../assets/characters/pirika/victory/pixel-v1/pirika-victory-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "採用版",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/pirika/victory/pixel-v1/pirika-victory-pixel-v1-magenta.png"
          }
        ],
        "columns": 5,
        "rows": 3,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 15,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "15コマ。透過と位置合わせを画像に適用済み。ジャンプの上下動を保持。動作中に鉛筆が見えなくなる箇所は今後の調整候補。"
      },
      {
        "id": "pirika-defeat-pixel-v1",
        "label": "敗北・失敗 · ドット絵 v1",
        "kind": "animation",
        "action": "defeat",
        "image": "../../../assets/characters/pirika/defeat/pixel-v1/pirika-defeat-pixel-v1.png",
        "prompt": "../../../assets/characters/pirika/defeat/pixel-v1/pirika-defeat-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "採用版",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/pirika/defeat/pixel-v1/pirika-defeat-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 3,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 12,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "12コマ。透過と位置合わせを画像に適用済み。"
      },
      {
        "id": "pirika-finish-pixel-v1",
        "label": "通常終了 · ドット絵 v1",
        "kind": "animation",
        "action": "finish",
        "image": "../../../assets/characters/pirika/finish/pixel-v1/pirika-finish-pixel-v1.png",
        "prompt": "../../../assets/characters/pirika/finish/pixel-v1/pirika-finish-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "採用版",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/pirika/finish/pixel-v1/pirika-finish-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 8,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "8コマ。透過と位置合わせを画像に適用済み。吐息の白い表現が一瞬出ます。"
      }
    ],
    "adoptedAssets": {
      "portrait": "pirika-portrait-pixel-v1",
      "idle": "pirika-idle-pixel-v1",
      "danger": "pirika-danger-pixel-v1",
      "success": "pirika-success-pixel-v1",
      "garbage-land": "pirika-garbage-land-pixel-v1",
      "victory": "pirika-victory-pixel-v1",
      "defeat": "pirika-defeat-pixel-v1",
      "finish": "pirika-finish-pixel-v1",
      "icon": "pirika-icon-pixel-v2"
    }
  },
  {
    "id": "nui",
    "name": "ヌイ",
    "role": "包み布の精霊",
    "color": "#6e9490",
    "assets": [
      {
        "id": "nui-portrait-pixel-v1",
        "label": "基準立ち絵 · ドット絵 v1",
        "kind": "image",
        "action": "portrait",
        "image": "../../../assets/characters/nui/portrait/pixel-v1/nui-portrait-pixel-v1.png",
        "prompt": "../../../assets/characters/nui/portrait/pixel-v1/nui-portrait-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/nui/portrait/pixel-v1/nui-portrait-pixel-v1-magenta.png"
          }
        ]
      },
      {
        "id": "nui-icon-pixel-v1",
        "label": "顔アイコン · ドット絵 v1",
        "kind": "image",
        "action": "icon",
        "image": "../../../assets/characters/nui/icon/pixel-v1/nui-icon-pixel-v1.png",
        "prompt": "../../../assets/characters/nui/icon/pixel-v1/nui-icon-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/nui/portrait/pixel-v1/nui-portrait-pixel-v1-magenta.png"
          }
        ],
        "notes": "結び目・縫い目・継ぎ布を含む全体を縮小。"
      },
      {
        "id": "nui-idle-pixel-v1",
        "label": "待機 · ドット絵 v1",
        "kind": "animation",
        "action": "idle",
        "image": "../../../assets/characters/nui/idle/pixel-v1/nui-idle-pixel-v1.png",
        "prompt": "../../../assets/characters/nui/idle/pixel-v1/nui-idle-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/nui/idle/pixel-v1/nui-idle-pixel-v1-magenta.png"
          }
        ],
        "columns": 3,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "6コマ。透過と位置合わせを画像に適用済み。布のふくらみ・平たくなる変形は保持。"
      },
      {
        "id": "nui-danger-pixel-v1",
        "label": "ピンチ · ドット絵 v1",
        "kind": "animation",
        "action": "danger",
        "image": "../../../assets/characters/nui/danger/pixel-v1/nui-danger-pixel-v1.png",
        "prompt": "../../../assets/characters/nui/danger/pixel-v1/nui-danger-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/nui/danger/pixel-v1/nui-danger-pixel-v1-magenta.png"
          }
        ],
        "columns": 3,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "6コマ。透過と位置合わせを画像に適用済み。布のふくらみ・平たくなる変形は保持。"
      },
      {
        "id": "nui-success-pixel-v1",
        "label": "成功リアクション · ドット絵 v1",
        "kind": "animation",
        "action": "success",
        "image": "../../../assets/characters/nui/success/pixel-v1/nui-success-pixel-v1.png",
        "prompt": "../../../assets/characters/nui/success/pixel-v1/nui-success-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/nui/success/pixel-v1/nui-success-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 3,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 12,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "12コマ。透過と位置合わせを画像に適用済み。布のふくらみ・平たくなる変形は保持。"
      },
      {
        "id": "nui-garbage-land-pixel-v1",
        "label": "おじゃま着地 · ドット絵 v1",
        "kind": "animation",
        "action": "garbage-land",
        "image": "../../../assets/characters/nui/garbage-land/pixel-v1/nui-garbage-land-pixel-v1.png",
        "prompt": "../../../assets/characters/nui/garbage-land/pixel-v1/nui-garbage-land-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/nui/garbage-land/pixel-v1/nui-garbage-land-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 3,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 12,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "12コマ。透過と位置合わせを画像に適用済み。布のふくらみ・平たくなる変形は保持。"
      },
      {
        "id": "nui-victory-pixel-v1",
        "label": "勝利・クリア · ドット絵 v1",
        "kind": "animation",
        "action": "victory",
        "image": "../../../assets/characters/nui/victory/pixel-v1/nui-victory-pixel-v1.png",
        "prompt": "../../../assets/characters/nui/victory/pixel-v1/nui-victory-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/nui/victory/pixel-v1/nui-victory-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 4,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 16,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "16コマ。透過と位置合わせを画像に適用済み。布のふくらみ・平たくなる変形は保持。"
      },
      {
        "id": "nui-defeat-pixel-v1",
        "label": "敗北・失敗 · ドット絵 v1",
        "kind": "animation",
        "action": "defeat",
        "image": "../../../assets/characters/nui/defeat/pixel-v1/nui-defeat-pixel-v1.png",
        "prompt": "../../../assets/characters/nui/defeat/pixel-v1/nui-defeat-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/nui/defeat/pixel-v1/nui-defeat-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 4,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 16,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "16コマ。透過と位置合わせを画像に適用済み。布のふくらみ・平たくなる変形は保持。"
      },
      {
        "id": "nui-finish-pixel-v1",
        "label": "通常終了 · ドット絵 v1",
        "kind": "animation",
        "action": "finish",
        "image": "../../../assets/characters/nui/finish/pixel-v1/nui-finish-pixel-v1.png",
        "prompt": "../../../assets/characters/nui/finish/pixel-v1/nui-finish-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/nui/finish/pixel-v1/nui-finish-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 3,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 12,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "12コマ。透過と位置合わせを画像に適用済み。布のふくらみ・平たくなる変形は保持。"
      }
    ],
    "adoptedAssets": {
      "portrait": "nui-portrait-pixel-v1",
      "icon": "nui-icon-pixel-v1",
      "idle": "nui-idle-pixel-v1",
      "danger": "nui-danger-pixel-v1",
      "success": "nui-success-pixel-v1",
      "garbage-land": "nui-garbage-land-pixel-v1",
      "victory": "nui-victory-pixel-v1",
      "defeat": "nui-defeat-pixel-v1",
      "finish": "nui-finish-pixel-v1"
    }
  },
  {
    "id": "ordo",
    "name": "オルド",
    "role": "門の精霊",
    "color": "#7c858c",
    "assets": [
      {
        "id": "ordo-portrait-spritegen-v1",
        "label": "立ち絵 · sprite-gen v1",
        "action": "portrait",
        "kind": "image",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/ordo/portrait/spritegen-v1/ordo-portrait-spritegen-v1.png",
        "prompt": "../../../assets/characters/ordo/notes/spritegen-v1/base.prompt.txt"
      },
      {
        "id": "ordo-icon-spritegen-v1",
        "label": "アイコン · sprite-gen v1",
        "action": "icon",
        "kind": "image",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/ordo/icon/spritegen-v1/ordo-icon-spritegen-v1.png",
        "prompt": "../../../assets/characters/ordo/notes/spritegen-v1/base.prompt.txt"
      },
      {
        "id": "ordo-idle-spritegen-v1",
        "label": "待機 · sprite-gen v1",
        "action": "idle",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/ordo/idle/spritegen-v1/ordo-idle-spritegen-v1.png",
        "prompt": "../../../assets/characters/ordo/notes/spritegen-v1/run/prompts/idle.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": true,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "ordo-danger-spritegen-v1",
        "label": "ピンチ · sprite-gen v1",
        "action": "danger",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/ordo/danger/spritegen-v1/ordo-danger-spritegen-v1.png",
        "prompt": "../../../assets/characters/ordo/notes/spritegen-v1/run/prompts/danger.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": true,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "ordo-success-spritegen-v1",
        "label": "成功 · sprite-gen v1",
        "action": "success",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/ordo/success/spritegen-v1/ordo-success-spritegen-v1.png",
        "prompt": "../../../assets/characters/ordo/notes/spritegen-v1/run/prompts/success.txt",
        "frameCount": 6,
        "fps": 8,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "ordo-garbage-land-spritegen-v1",
        "label": "おじゃま着地 · sprite-gen v1",
        "action": "garbage-land",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/ordo/garbage-land/spritegen-v1/ordo-garbage-land-spritegen-v1.png",
        "prompt": "../../../assets/characters/ordo/notes/spritegen-v1/run/prompts/garbage-land.txt",
        "frameCount": 6,
        "fps": 8,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "ordo-victory-spritegen-v1",
        "label": "勝利 · sprite-gen v1",
        "action": "victory",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/ordo/victory/spritegen-v1/ordo-victory-spritegen-v1.png",
        "prompt": "../../../assets/characters/ordo/notes/spritegen-v1/run/prompts/victory.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "ordo-defeat-spritegen-v1",
        "label": "敗北 · sprite-gen v1",
        "action": "defeat",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/ordo/defeat/spritegen-v1/ordo-defeat-spritegen-v1.png",
        "prompt": "../../../assets/characters/ordo/notes/spritegen-v1/run/prompts/defeat.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      },
      {
        "id": "ordo-finish-spritegen-v1",
        "label": "通常終了 · sprite-gen v1",
        "action": "finish",
        "kind": "animation",
        "model": "gpt-image（sprite-gen / Codex CLI、モデル版指定なし）",
        "status": "採用",
        "pixelArt": true,
        "notes": "基準画像からsprite-genで生成・透過・分割。512px、低解像度格子への縮小なし。生成記録はnotes/spritegen-v1。",
        "image": "../../../assets/characters/ordo/finish/spritegen-v1/ordo-finish-spritegen-v1.png",
        "prompt": "../../../assets/characters/ordo/notes/spritegen-v1/run/prompts/finish.txt",
        "frameCount": 6,
        "fps": 6,
        "loop": false,
        "lastHoldMs": 0,
        "scale": 0.75,
        "frames": [
          {
            "x": 0,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 512,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1024,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 1536,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2048,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          },
          {
            "x": 2560,
            "y": 0,
            "width": 512,
            "height": 512,
            "pivotX": 256,
            "baselineY": 500
          }
        ]
      }
    ],
    "adoptedAssets": {
      "portrait": "ordo-portrait-spritegen-v1",
      "icon": "ordo-icon-spritegen-v1",
      "idle": "ordo-idle-spritegen-v1",
      "danger": "ordo-danger-spritegen-v1",
      "success": "ordo-success-spritegen-v1",
      "garbage-land": "ordo-garbage-land-spritegen-v1",
      "victory": "ordo-victory-spritegen-v1",
      "defeat": "ordo-defeat-spritegen-v1",
      "finish": "ordo-finish-spritegen-v1"
    }
  },
  {
    "id": "izel",
    "name": "イゼル",
    "role": "運行責任者",
    "color": "#9c6570",
    "assets": [
      {
        "id": "izel-portrait-pixel-v1",
        "label": "基準立ち絵 · ドット絵 v1",
        "kind": "image",
        "action": "portrait",
        "image": "../../../assets/characters/izel/portrait/pixel-v1/izel-portrait-pixel-v1.png",
        "prompt": "../../../assets/characters/izel/portrait/pixel-v1/izel-portrait-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/izel/portrait/pixel-v1/izel-portrait-pixel-v1-magenta.png"
          }
        ]
      },
      {
        "id": "izel-icon-pixel-v1",
        "label": "顔アイコン · ドット絵 v1",
        "kind": "image",
        "action": "icon",
        "image": "../../../assets/characters/izel/icon/pixel-v1/izel-icon-pixel-v1.png",
        "prompt": "../../../assets/characters/izel/icon/pixel-v1/izel-icon-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/izel/portrait/pixel-v1/izel-portrait-pixel-v1-magenta.png"
          }
        ],
        "notes": "基準立ち絵の顔と低いまとめ髪を切り出し。"
      },
      {
        "id": "izel-idle-pixel-v1",
        "label": "待機 · ドット絵 v1",
        "kind": "animation",
        "action": "idle",
        "image": "../../../assets/characters/izel/idle/pixel-v1/izel-idle-pixel-v1.png",
        "prompt": "../../../assets/characters/izel/idle/pixel-v1/izel-idle-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/izel/idle/pixel-v1/izel-idle-pixel-v1-magenta.png"
          }
        ],
        "columns": 3,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "6コマ。透過と位置合わせを画像に適用済み。素材内の倍率は一定。"
      },
      {
        "id": "izel-danger-pixel-v1",
        "label": "ピンチ · ドット絵 v1",
        "kind": "animation",
        "action": "danger",
        "image": "../../../assets/characters/izel/danger/pixel-v1/izel-danger-pixel-v1.png",
        "prompt": "../../../assets/characters/izel/danger/pixel-v1/izel-danger-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/izel/danger/pixel-v1/izel-danger-pixel-v1-magenta.png"
          }
        ],
        "columns": 3,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 6,
        "fps": 4,
        "loop": true,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "6コマ。透過と位置合わせを画像に適用済み。素材内の倍率は一定。"
      },
      {
        "id": "izel-success-pixel-v1",
        "label": "成功リアクション · ドット絵 v1",
        "kind": "animation",
        "action": "success",
        "image": "../../../assets/characters/izel/success/pixel-v1/izel-success-pixel-v1.png",
        "prompt": "../../../assets/characters/izel/success/pixel-v1/izel-success-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/izel/success/pixel-v1/izel-success-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 8,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "8コマ。透過と位置合わせを画像に適用済み。素材内の倍率は一定。"
      },
      {
        "id": "izel-garbage-land-pixel-v1",
        "label": "おじゃま着地 · ドット絵 v1",
        "kind": "animation",
        "action": "garbage-land",
        "image": "../../../assets/characters/izel/garbage-land/pixel-v1/izel-garbage-land-pixel-v1.png",
        "prompt": "../../../assets/characters/izel/garbage-land/pixel-v1/izel-garbage-land-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/izel/garbage-land/pixel-v1/izel-garbage-land-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 8,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "8コマ。透過と位置合わせを画像に適用済み。素材内の倍率は一定。"
      },
      {
        "id": "izel-victory-pixel-v1",
        "label": "勝利・クリア · ドット絵 v1",
        "kind": "animation",
        "action": "victory",
        "image": "../../../assets/characters/izel/victory/pixel-v1/izel-victory-pixel-v1.png",
        "prompt": "../../../assets/characters/izel/victory/pixel-v1/izel-victory-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/izel/victory/pixel-v1/izel-victory-pixel-v1-magenta.png"
          }
        ],
        "columns": 6,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 12,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "12コマ。透過と位置合わせを画像に適用済み。素材内の倍率は一定。"
      },
      {
        "id": "izel-defeat-pixel-v1",
        "label": "敗北・失敗 · ドット絵 v1",
        "kind": "animation",
        "action": "defeat",
        "image": "../../../assets/characters/izel/defeat/pixel-v1/izel-defeat-pixel-v1.png",
        "prompt": "../../../assets/characters/izel/defeat/pixel-v1/izel-defeat-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/izel/defeat/pixel-v1/izel-defeat-pixel-v1-magenta.png"
          }
        ],
        "columns": 5,
        "rows": 3,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 15,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "15コマ。透過と位置合わせを画像に適用済み。素材内の倍率は一定。"
      },
      {
        "id": "izel-finish-pixel-v1",
        "label": "通常終了 · ドット絵 v1",
        "kind": "animation",
        "action": "finish",
        "image": "../../../assets/characters/izel/finish/pixel-v1/izel-finish-pixel-v1.png",
        "prompt": "../../../assets/characters/izel/finish/pixel-v1/izel-finish-pixel-v1.prompt.txt",
        "model": "内蔵画像生成ツール（モデル名未確認）",
        "status": "試作・採用未定",
        "pixelArt": true,
        "history": [
          {
            "label": "背景処理前のシート",
            "url": "../../../assets/characters/izel/finish/pixel-v1/izel-finish-pixel-v1-magenta.png"
          }
        ],
        "columns": 4,
        "rows": 2,
        "frameWidth": 384,
        "frameHeight": 432,
        "frameCount": 8,
        "fps": 8,
        "loop": false,
        "baselineY": 408,
        "scale": 1,
        "lastHoldMs": 0,
        "notes": "8コマ。透過と位置合わせを画像に適用済み。素材内の倍率は一定。"
      }
    ],
    "adoptedAssets": {
      "portrait": "izel-portrait-pixel-v1",
      "icon": "izel-icon-pixel-v1",
      "idle": "izel-idle-pixel-v1",
      "danger": "izel-danger-pixel-v1",
      "success": "izel-success-pixel-v1",
      "garbage-land": "izel-garbage-land-pixel-v1",
      "victory": "izel-victory-pixel-v1",
      "defeat": "izel-defeat-pixel-v1",
      "finish": "izel-finish-pixel-v1"
    }
  }
];
