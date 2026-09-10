/** 盤面サイズ。行は下から数える（row 0 が最下段）。 */
export const COLS = 6;
export const ROWS = 12;
/** 可視領域より上に確保する行数。おじゃまパネルの投下に使う。 */
export const EXTRA_ROWS = 14;
export const TOTAL_ROWS = ROWS + EXTRA_ROWS;

/** 種類数。5種が既定、高難度で6種目（ばつ印）が混ざる。 */
export const DEFAULT_KINDS = 5;
export const MAX_KINDS = 6;
/** ビックリパネル（対戦専用の「！」付き灰色パネル）の柄番号。通常の柄とは揃わない。 */
export const SHOCK_KIND = 6;
/** 対戦でビックリパネルが混ざる頻度。この枚数を消すごとに、次のせり上がり行に1枚入る。 */
export const DEFAULT_SHOCK_EVERY = 12;
/** 対戦で1試合に出るビックリパネルの上限。超えると以後一切出ない。 */
export const DEFAULT_SHOCK_MAX = 24;
/** タイムアタックの制限時間（フレーム）。2分。 */
export const TIME_ATTACK_FRAMES = 120 * 60;

/** フレーム数ベースのタイミング（60fps想定）。 */
export const TIMING = {
  /** 入れ替えにかかるフレーム数。原作の4フレームに合わせる。 */
  swap: 4,
  /** 入れ替えで空中に出たパネルが落ち始めるまでの猶予。 */
  hoverSwap: 12,
  /** 消えたパネルの上に乗っていたパネルが落ち始めるまでの猶予。ここでアクティブ連鎖を仕込む。 */
  hoverClear: 18,
  /** おじゃまパネルが落ち始めるまでの猶予。 */
  hoverGarbage: 6,
  /** 1段落ちるのにかかるフレーム数。 */
  fallPerRow: 2,
  /** 消去時の点滅時間。 */
  flash: 44,
  /** 点滅が終わってから1枚目が消えるまで、揃った柄を見せる時間。 */
  face: 20,
  /** 1枚ずつ消えていく間隔。 */
  popInterval: 9,
  /** 最後の1枚が消えてから上のパネルが浮き始めるまで。 */
  popTail: 0,
  /**
   * おじゃま変身の点滅時間。
   * 点滅から落下までの間、板の下を操作して連鎖を仕込めるのが原作の遊び方なので、幅6の板で2.5秒ほどかかる長さにしている。
   */
  transformFlash: 60,
  /** 変身で1マスずつパネル柄が現れる間隔。 */
  transformInterval: 10,
  /** 全マスのめくり演出後、通常パネルへ変換するまでの猶予（難易度で変わる）。 */
  transformHover: 45,
  /** 手動せり上げで1段上がるのにかかるフレーム数。 */
  manualRisePerRow: 4,
  /** 天井に触れてからゲームオーバーになるまでの猶予。 */
  deathGrace: 60,
  /**
   * 連鎖フラグ付きのパネルが着地して揃わなかったあと、フラグを保つフレーム数。
   * この間に隣を入れ替えて揃えれば連鎖として数える。原作にはない緩和で、連鎖を少し作りやすくする。
   */
  chainGrace: 12,
  /** おじゃま着地時の揺れ。厚さ1段あたりのフレーム数。 */
  shakePerRow: 8,
  /**
   * 同時消しの板を相手に送るまでの待ち。原作の100フレーム。
   * 待っている間に別の同時消しがあれば合流して待ち直し、自分の連鎖中に期限が来た板は連鎖が終わるまで持つ。
   */
  garbageSendDelay: 100,
  /** 送った板が相手の予告に入ってから降れるようになるまで。原作の52フレーム。 */
  garbageTransit: 52,
  /** 相手の盤面が静止してから板が降るまでに必要な連続フレーム数。原作は前のフレームと今のフレームの両方で静止を見る。 */
  garbageQuietFrames: 2,
  /** 同時消しによるせり上がり停止。4個で base、以降 1個ごとに perExtra。 */
  stopComboBase: 60,
  stopComboPerExtra: 20,
  /** 連鎖によるせり上がり停止。2連鎖で base、以降 1連鎖ごとに perExtra。 */
  stopChainBase: 120,
  stopChainPerExtra: 60,
  stopMax: 720,
  /** 危険状態（天井接触）で消したときの停止時間の倍率。 */
  stopDangerMultiplier: 2,
} as const;

/** スピードレベルで変わる消去・落下のタイミング。レベル1の値から、レベル50で最短になる。 */
export interface ClearTiming {
  flash: number;
  face: number;
  popInterval: number;
  hoverClear: number;
  hoverSwap: number;
  transformHover: number;
}

export function clearTiming(level: number): ClearTiming {
  const t = Math.max(0, Math.min(1, (level - 1) / 49));
  const lerp = (a: number, b: number): number => Math.round(a + (b - a) * t);
  return {
    flash: lerp(TIMING.flash, 28),
    face: lerp(TIMING.face, 10),
    popInterval: lerp(TIMING.popInterval, 5),
    hoverClear: lerp(TIMING.hoverClear, 8),
    hoverSwap: lerp(TIMING.hoverSwap, 4),
    transformHover: lerp(TIMING.transformHover, 24),
  };
}

/**
 * 危険状態（ピンチ曲・人物のピンチ・盤面の警告）とみなす高さ。この行以上にパネルか着地したおじゃまがあると危険。
 * 12 段のうち高さ 9 以上（上に 3 段の余裕）。天井の 1 段手前（ROWS - 2）では、攻撃を受けるまでほぼ入らず遅かった。
 */
export const DANGER_ROW = ROWS - 4;

/** 得点の上限（SFC版）。 */
export const SCORE_CAP = 99_999;

/** せり上がり速度。スピードレベルから「1段上がるのに要するフレーム数」を返す。 */
export function riseFramesPerRow(level: number): number {
  const lv = Math.min(99, Math.max(1, level));
  // レベル1で1段12.5秒。以前の600Fは速すぎたので、全レベルを8割の速度（1.25倍のフレーム数）にした。
  return Math.max(15, Math.round(750 * Math.pow(0.955, lv - 1)));
}

/**
 * エンドレス・タイムアタックでスピードレベルが1上がるのに必要な消去枚数。
 * 以前は20枚だったが、Lv1 のせり上がりは1段12.5秒で供給が6枚しかなく、1レベルに40秒かかって1回のプレイが14分ほどになっていた。
 * スマホで1回を短く遊べるよう半分にした。
 */
export const PANELS_PER_LEVEL = 10;
/**
 * エンドレス・タイムアタックで、消した枚数に関係なく時間だけでスピードレベルが1上がるフレーム数（8秒）。
 * 消去によるレベルと時間によるレベルの高い方を採る。遅い人でも Lv30（1段3.3秒）に4分、Lv40（2.1秒）に5分強で届くので、
 * 1回のプレイが長くても8分ほどで終わる。上手い人は消去で先にレベルが上がるので影響しない。
 */
export const FRAMES_PER_LEVEL = 8 * 60;
