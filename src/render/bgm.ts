/**
 * BGM の再生。メニュー・ゲーム中・危険状態（ピンチ）の曲は音声ファイル（public/audio/*.mp3）を区間で繰り返す（SAMPLED）。
 * Web Audio だけで鳴らすシーケンサの曲（曲データは tools/bgm-candidates.html から移植したもの）は、音声ファイルを読み込めないときの予備:
 * メニュー「1. ポップ・フェアリー」、ゲーム中「5. チル・幻想」、ピンチ「2. スピード・テクノ」。
 *
 * 音符列は "c4:2 e4+g4:4 r:2" の形式。長さの単位は16分音符で、省略時は 1。
 * "+" で和音、"r" で休符。ドラムは "x...x..." の形式で、x がヒット、o がオープンハイハット。
 */

import { bakeLoopCrossfade, loopPosition } from "./loopBuffer";

type Wave = OscillatorType | "pulse25" | "pulse12";

interface Instrument {
  wave: Wave;
  wave2?: Wave;
  /** wave2 の混ぜる量 */
  mix2?: number;
  /** wave2 のデチューン (cents) */
  detune2?: number;
  gain: number;
  /** ADSR。単位は秒、sustain は比率 */
  a: number;
  d: number;
  s: number;
  r: number;
  /** ローパスのカットオフ (Hz) */
  cutoff: number;
  /** 発音時にカットオフを何倍から下げ始めるか */
  fenv?: number;
  vib?: { rate: number; depth: number; delay: number };
  /** 音符長のうち鳴らす割合 */
  gate: number;
  /** エコーへ送る量 */
  echo: number;
}

type DrumKind = "kick" | "snare" | "hat";

interface NoteEvent {
  freqs: number[];
  len: number;
}
interface DrumEvent {
  drum: DrumKind;
  open: boolean;
}

interface Track {
  events: Map<number, NoteEvent | DrumEvent>;
  total: number;
  inst?: Instrument;
}

interface Song {
  tempo: number;
  /** 1小節の16分音符の数 */
  beat: number;
  /** エコーの遅れ (16分音符の数) */
  echoSteps: number;
  echoFeedback: number;
  drumGain: number;
  tracks: Track[];
}

// ------------------------------------------------------------- 音符

const NOTE_IDX: Record<string, number> = {
  c: 0, "c#": 1, db: 1, d: 2, "d#": 3, eb: 3, e: 4, f: 5, "f#": 6, gb: 6, g: 7, "g#": 8, ab: 8, a: 9, "a#": 10, bb: 10, b: 11,
};

function noteFreq(name: string): number {
  const m = /^([a-g])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`音名が不正: ${name}`);
  const midi = (Number(m[3]) + 1) * 12 + NOTE_IDX[m[1] + m[2]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function parseSeq(seq: string, inst: Instrument): Track {
  const events = new Map<number, NoteEvent>();
  let step = 0;
  for (const tok of seq.trim().split(/\s+/)) {
    const [body, lenStr] = tok.split(":");
    const len = lenStr === undefined ? 1 : Number(lenStr);
    if (!(len > 0)) throw new Error(`長さが不正: ${tok}`);
    if (body !== "r") events.set(step, { freqs: body.split("+").map(noteFreq), len });
    step += len;
  }
  return { events, total: step, inst };
}

function parseDrum(pat: string, kind: DrumKind): Track {
  const s = pat.replace(/\s+/g, "");
  const events = new Map<number, DrumEvent>();
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "x" || s[i] === "o") events.set(i, { drum: kind, open: s[i] === "o" });
  }
  return { events, total: s.length };
}

function arpSeq(chords: string[][], pattern: number[], perChord: number, len: number): string {
  const out: string[] = [];
  for (const c of chords) {
    for (let i = 0; i < perChord; i++) out.push(`${c[pattern[i % pattern.length] % c.length]}:${len}`);
  }
  return out.join(" ");
}

// ------------------------------------------------------------- 楽器と曲

export type SongName = "menu" | "game";
/** 実際に鳴らす曲。game は危険状態のとき danger に置き換わる。 */
export type TuneName = SongName | "danger";

/**
 * 音声ファイルの曲。頭から鳴らし、loopEnd に達したら loopStart へ戻って繰り返す（イントロは 1 回）。
 * 継ぎ目は loopEnd の手前 60 ms を loopStart の直前の音と溶かしてある（bakeLoopCrossfade）。
 * 位置はすべて、無音を落とした素材の秒数。区間は小節ごとの似ている度合いで候補を出し、聞き比べて決めた。
 */
export interface SampledSong {
  /** index.html からの相対パス */
  url: string;
  tempo: number;
  /** 1 小節の長さ（秒）。ピンチから戻るときに小節の頭へ揃えるのに使う */
  bar: number;
  /** 最初の拍（1 小節目の頭）の位置（秒）。オープニングの閃光にこの拍を合わせる */
  downbeat: number;
  /** 鳴らし始める位置（秒）。省略で頭から。ピンチの曲は導入を飛ばしてドロップから */
  start?: number;
  loopStart: number;
  loopEnd: number;
  /** 合成の曲との音量合わせ */
  gain: number;
}

/**
 * メニュー曲「The Last Block Standing」（Gemini で生成。G major、120.5 BPM、32 小節 63.8 秒。頭は C の和音）。
 * 1〜8 小節（イントロと薄い主部）を 1 回鳴らしたあと、9〜30 小節（主部 → 別の部分 → 主部）を繰り返す。
 * 30 小節目の末尾は 8 小節目の末尾と似ているので、30 → 9 の飛びが元の 8 → 9 と同じ入り方になる。
 */
export const MENU_SONG: SampledSong = {
  url: "audio/menu.mp3",
  tempo: 120.53,
  bar: 1.9912,
  downbeat: 0.0416,
  loopStart: 15.9711,
  loopEnd: 59.7774,
  gain: 1.4,
};

/**
 * ゲーム曲「Triple Tile Cascade」（Gemini で生成。3 連のノリ（12/8 相当）106 BPM、28 小節 63.7 秒）。
 * 1 小節目（薄い導入）を 1 回鳴らしたあと、2〜25 小節（本体すべて）を繰り返す。26 小節目から終わりに向かうので、そこへは行かない。
 * 継ぎ目（25 → 2）は元の曲にない遷移だが、25 は 2〜9 の再現部の中にあり、聞いて違和感がなかったので長さを優先した。
 */
export const GAME_SONG: SampledSong = {
  url: "audio/game.mp3",
  tempo: 106.0,
  bar: 2.2642,
  downbeat: 0.0231,
  loopStart: 2.2873,
  loopEnd: 56.6289,
  gain: 1.7,
};

/**
 * ピンチの曲「Crisis Mode」（Gemini で生成。4/4 150 BPM、40 小節 64.0 秒）。
 * 1〜8 小節の導入（12.8 秒）は飛ばし、9 小節目のドロップから鳴らして 9〜24 小節（16 小節・25.6 秒）を繰り返す。
 * 9 小節目は 25 小節目とほぼ同じ音なので、24 → 9 の飛びが元の 24 → 25 と同じ入り方になる。
 */
export const DANGER_SONG: SampledSong = {
  url: "audio/danger.mp3",
  tempo: 150.0,
  bar: 1.59997,
  downbeat: 0.0454,
  start: 12.8452,
  loopStart: 12.8452,
  loopEnd: 38.4447,
  gain: 1.6,
};

/** 音声ファイルの曲。 */
export const SAMPLED: Record<TuneName, SampledSong> = { menu: MENU_SONG, game: GAME_SONG, danger: DANGER_SONG };

/** メニュー曲の予備（音声ファイルを読み込めないとき）: C major 132 BPM。跳ねるベースと分散和音の明るい曲。 */
function buildMenuSong(): Song {
  const bassTri: Instrument = { wave: "triangle", wave2: "square", mix2: 0.18, gain: 0.45, a: 0.004, d: 0.12, s: 0.75, r: 0.06, cutoff: 900, fenv: 2, gate: 0.85, echo: 0 };
  const arp: Instrument = { wave: "pulse25", gain: 0.11, a: 0.002, d: 0.09, s: 0.35, r: 0.04, cutoff: 4500, fenv: 1.5, gate: 0.7, echo: 0.35 };
  const lead: Instrument = { wave: "square", gain: 0.15, a: 0.01, d: 0.12, s: 0.75, r: 0.08, cutoff: 3800, vib: { rate: 5.5, depth: 10, delay: 0.12 }, gate: 0.9, echo: 0.3 };
  const chords: Record<string, string[]> = {
    C: ["c4", "e4", "g4", "c5"],
    G: ["g3", "b3", "d4", "g4"],
    Am: ["a3", "c4", "e4", "a4"],
    F: ["f3", "a3", "c4", "f4"],
  };
  // 低い根音・高い根音・5度
  const bass: Record<string, [string, string, string]> = {
    C: ["c2", "c3", "g2"],
    G: ["g2", "g3", "d3"],
    Am: ["a2", "a3", "e3"],
    F: ["f2", "f3", "c3"],
  };
  const bounce = ([lo, hi, fi]: [string, string, string]): string => `${lo}:2 r:2 ${lo}:2 ${hi}:2 ${lo}:2 r:2 ${fi}:2 ${hi}:2`;
  const prog = ["C", "G", "Am", "F", "C", "G", "F", "G"];
  const melody = [
    "e5:2 g5:2 e5:2 c5:2 d5:4 e5:4",
    "d5:2 g5:2 d5:2 b4:2 c5:4 d5:4",
    "e5:2 a5:2 e5:2 c5:2 b4:2 c5:2 d5:4",
    "c5:4 a4:2 f4:2 g4:8",
    "e5:2 g5:2 e5:2 c5:2 d5:4 e5:4",
    "d5:2 g5:2 b5:2 g5:2 d5:2 b4:2 d5:4",
    "f5:4 e5:2 d5:2 c5:2 d5:2 e5:4",
    "g5:4 f5:2 d5:2 b4:4 d5:4",
  ].join(" ");
  return {
    tempo: 132,
    beat: 16,
    echoSteps: 3,
    echoFeedback: 0.35,
    drumGain: 1,
    tracks: [
      parseSeq(prog.map((k) => bounce(bass[k])).join(" "), bassTri),
      parseSeq(arpSeq(prog.map((k) => chords[k]), [0, 1, 2, 3, 2, 1], 16, 1), arp),
      parseSeq(melody, lead),
      parseDrum("x.....x.x.....x.", "kick"),
      parseDrum("....x.......x...", "snare"),
      parseDrum("x.x.x.x.x.x.x.xo", "hat"),
    ],
  };
}

/** ゲーム曲の予備（音声ファイルを読み込めないとき）: D major 96 BPM。メジャーセブンスのパッドとエコー多めのリード。 */
function buildGameSong(): Song {
  const pad: Instrument = { wave: "pulse25", wave2: "sawtooth", mix2: 0.5, detune2: 9, gain: 0.055, a: 0.5, d: 0.4, s: 0.85, r: 0.6, cutoff: 1600, gate: 0.98, echo: 0.5 };
  const bassSoft: Instrument = { wave: "triangle", gain: 0.45, a: 0.01, d: 0.2, s: 0.8, r: 0.15, cutoff: 600, gate: 0.95, echo: 0.1 };
  const arp: Instrument = { wave: "pulse25", gain: 0.11, a: 0.002, d: 0.09, s: 0.35, r: 0.04, cutoff: 4500, fenv: 1.5, gate: 0.7, echo: 0.35 };
  const lead: Instrument = { wave: "sine", wave2: "triangle", mix2: 0.35, gain: 0.3, a: 0.03, d: 0.2, s: 0.8, r: 0.3, cutoff: 4000, vib: { rate: 4.5, depth: 12, delay: 0.25 }, gate: 0.95, echo: 0.55 };
  // 2小節ずつ D - Bm - G - A
  const chords: Record<string, string[]> = {
    D: ["d4", "f#4", "a4", "c#5"],
    Bm: ["b3", "d4", "f#4", "a4"],
    G: ["g3", "b3", "d4", "f#4"],
    A: ["a3", "c#4", "e4", "g4"],
  };
  const bass: Record<string, string> = {
    D: "d2:6 r:2 d2:4 r:4 a2:6 r:2 d2:8",
    Bm: "b1:6 r:2 b1:4 r:4 f#2:6 r:2 b1:8",
    G: "g2:6 r:2 g2:4 r:4 d3:6 r:2 g2:8",
    A: "a2:6 r:2 a2:4 r:4 e3:6 r:2 a2:8",
  };
  const prog = ["D", "Bm", "G", "A"];
  const melody = [
    "r:4 f#5:4 a5:4 c#6:8 b5:4 a5:8",
    "r:4 d6:4 c#6:4 b5:8 f#5:4 a5:8",
    "r:4 b5:4 a5:4 g5:8 f#5:4 e5:8",
    "r:4 a5:4 g5:4 e5:8 c#5:4 e5:8",
  ].join(" ");
  return {
    tempo: 96,
    beat: 16,
    echoSteps: 3,
    echoFeedback: 0.45,
    drumGain: 0.6,
    tracks: [
      parseSeq(prog.map((k) => `${chords[k].join("+")}:32`).join(" "), pad),
      parseSeq(prog.map((k) => bass[k]).join(" "), bassSoft),
      parseSeq(arpSeq(prog.map((k) => chords[k]), [0, 1, 2, 3, 2, 1], 16, 2), arp),
      parseSeq(melody, lead),
      parseDrum("x.......x.x.....", "kick"),
      parseDrum("....x.......x...", "snare"),
      parseDrum("..x...x...x...x.", "hat"),
    ],
  };
}

/** ピンチの予備（音声ファイルを読み込めないとき）: A minor 150 BPM。16分刻みのオクターブベースで疾走感を出し、危険状態に気づかせる。 */
function buildDangerSong(): Song {
  const bassSaw: Instrument = { wave: "sawtooth", wave2: "square", mix2: 0.3, gain: 0.28, a: 0.003, d: 0.1, s: 0.6, r: 0.05, cutoff: 700, fenv: 3, gate: 0.7, echo: 0 };
  const arpThin: Instrument = { wave: "pulse12", gain: 0.11, a: 0.002, d: 0.06, s: 0.3, r: 0.03, cutoff: 6000, gate: 0.6, echo: 0.4 };
  const leadPulse: Instrument = { wave: "pulse25", wave2: "pulse25", detune2: 7, mix2: 0.6, gain: 0.13, a: 0.01, d: 0.1, s: 0.8, r: 0.08, cutoff: 4200, vib: { rate: 6, depth: 12, delay: 0.1 }, gate: 0.9, echo: 0.3 };
  const chords: Record<string, string[]> = {
    Am: ["a3", "c4", "e4", "a4"],
    F: ["f3", "a3", "c4", "f4"],
    C: ["c4", "e4", "g4", "c5"],
    G: ["g3", "b3", "d4", "g4"],
    E: ["e4", "g#4", "b4", "e5"],
  };
  const root: Record<string, string> = { Am: "a", F: "f", C: "c", G: "g", E: "e" };
  const prog = ["Am", "F", "C", "G", "Am", "F", "G", "E"];
  const octBass = (r: string): string => {
    const bar = `${r}2 ${r}2 ${r}3 ${r}2 ${r}2 ${r}3 ${r}2 ${r}3`;
    return `${bar} ${bar}`;
  };
  const melody = [
    "a4:2 c5:2 e5:2 a5:4 g5:2 e5:4",
    "f5:2 e5:2 c5:2 a4:4 c5:2 d5:4",
    "e5:2 g5:2 c6:4 b5:2 g5:2 e5:4",
    "d5:2 g5:2 b5:2 d6:4 b5:2 g5:4",
    "a5:4 e5:2 c5:2 a4:2 c5:2 e5:4",
    "f5:4 a5:2 c6:2 a5:2 f5:2 e5:4",
    "d5:2 e5:2 g5:2 b5:2 d6:2 b5:2 g5:4",
    "g#5:4 e5:2 b4:2 g#4:2 b4:2 e5:4",
  ].join(" ");
  return {
    tempo: 150,
    beat: 16,
    echoSteps: 3,
    echoFeedback: 0.35,
    drumGain: 1,
    tracks: [
      parseSeq(prog.map((k) => octBass(root[k])).join(" "), bassSaw),
      parseSeq(arpSeq(prog.map((k) => chords[k]), [0, 1, 2, 3], 16, 1), arpThin),
      parseSeq(melody, leadPulse),
      parseDrum("x...x...x...x...", "kick"),
      parseDrum("....x.......x...", "snare"),
      parseDrum("x.o.x.o.x.o.x.o.", "hat"),
    ],
  };
}

// ------------------------------------------------------------- 再生

/** デューティ比 duty のパルス波。SFC 風の細い音に使う。 */
export function makePulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const n = 48;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

/** 音を予約しておく先読みの長さ（秒）。 */
const LOOKAHEAD = 0.12;
/** 曲を切り替えるとき、前の曲の予約済みの音が終わるまで出力を絞っておく長さ（秒）。LOOKAHEAD より長くする。 */
export const SWITCH_GAP = 0.15;
/** 危険状態を抜けてからゲーム曲に戻すまでの待ち（ミリ秒）。 */
export const DANGER_RELEASE_MS = 2500;

/** 音声ファイルの曲の position（秒）を、その小節の頭に揃える。繰り返し区間の中なら区間の頭からの小節割り。 */
export function barStart(song: SampledSong, position: number): number {
  if (position < song.downbeat) return 0;
  const base = position >= song.loopStart ? song.loopStart : song.downbeat;
  return base + Math.floor((position - base) / song.bar) * song.bar;
}

export class BgmPlayer {
  private readonly songs: Record<TuneName, Song> = { menu: buildMenuSong(), game: buildGameSong(), danger: buildDangerSong() };
  private song: Song = this.songs.game;
  /** 求められている曲。 */
  private current: SongName | null = null;
  /** 実際に鳴っている曲。 */
  private tune_: TuneName | null = null;
  private danger = false;
  /** ゲーム曲からピンチの曲へ切り替えたときの位置。戻るときはこの小節から続ける（合成の予備は 16 分音符の数、音声ファイルは秒） */
  private gameStep = 0;
  private gamePosition = 0;
  private readonly out: GainNode;
  private readonly echoIn: GainNode;
  private readonly delay: DelayNode;
  private readonly feedback: GainNode;
  private readonly waves: Record<string, PeriodicWave>;
  private readonly noiseBuf: AudioBuffer;
  private timer: number | null = null;
  /** 危険状態を抜けてからゲーム曲に戻すまでの待ち。戻す前に危険状態へ戻れば取り消す。 */
  private releaseTimer: number | null = null;
  /** 合成の曲の位置（16 分音符の数） */
  private seqStep = 0;
  private nextTime = 0;
  /** 音声ファイルの曲の出力。合成の曲とは別で、9 kHz のローパスを通さない */
  private readonly sampleOut: GainNode;
  private readonly sampleLoad: Record<TuneName, "loading" | "ready" | "failed"> = { menu: "failed", game: "failed", danger: "failed" };
  private readonly sampleBuffer: Partial<Record<TuneName, AudioBuffer>> = {};
  private sampleSource: AudioBufferSourceNode | null = null;
  /** 鳴っている音声ファイルの曲 */
  private sampleTune: TuneName | null = null;
  /** 音声ファイルの曲を鳴らし始めた（予約した）時刻と、そのときの素材の位置 */
  private sampleStartedAt = 0;
  private sampleOffset = 0;
  /** 読み込みが終わる前に求められた曲。終わったら samplePosition から鳴らす */
  private samplePending: TuneName | null = null;
  private samplePosition = 0;

  constructor(
    private readonly ctx: AudioContext,
    dest: AudioNode,
    /** 曲の音声ファイル。ない曲は合成の予備を鳴らす */
    samples?: Partial<Record<TuneName, Promise<ArrayBuffer>>>,
  ) {
    // SFC の音の丸さを出すために高域を削る
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 9000;
    tone.Q.value = 0.5;
    tone.connect(dest);
    this.out = ctx.createGain();
    this.out.connect(tone);

    // SPC700 風のフィードバックエコー
    this.echoIn = ctx.createGain();
    this.delay = ctx.createDelay(2);
    const fb = ctx.createGain();
    this.feedback = fb;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = "lowpass";
    fbFilter.frequency.value = 3000;
    this.echoIn.connect(this.delay);
    this.delay.connect(fbFilter);
    fbFilter.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.out);

    this.waves = { pulse25: makePulseWave(ctx, 0.25), pulse12: makePulseWave(ctx, 0.125) };
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    this.sampleOut = ctx.createGain();
    this.sampleOut.connect(dest);
    for (const name of ["menu", "game", "danger"] as const) {
      const bytes = samples?.[name];
      if (bytes) this.loadSample(name, bytes);
    }
  }

  /** 曲の音声ファイルを読み込み、継ぎ目を準備する。失敗したら合成の予備を使う。 */
  private loadSample(name: TuneName, bytes: Promise<ArrayBuffer>): void {
    const song = SAMPLED[name];
    this.sampleLoad[name] = "loading";
    bytes
      .then((b) => this.ctx.decodeAudioData(b))
      .then((buffer) => {
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          bakeLoopCrossfade(buffer.getChannelData(c), buffer.sampleRate, song.loopStart, song.loopEnd);
        }
        this.sampleBuffer[name] = buffer;
        this.sampleLoad[name] = "ready";
        if (this.samplePending === name) {
          this.samplePending = null;
          this.playSample(name, this.samplePosition);
        }
      })
      .catch((e: unknown) => {
        console.warn(`曲の音声ファイルを読み込めないので合成の予備を鳴らす: ${name}`, e);
        this.sampleLoad[name] = "failed";
        if (this.samplePending === name) {
          this.samplePending = null;
          this.play(name, 0);
        }
      });
  }

  /**
   * 音声ファイルの曲を素材の offset 秒から鳴らす（0 なら曲の start、省略時は頭）。
   * 頭から鳴らすときは、最初の拍が SWITCH_GAP 後（オープニングの閃光）に来るよう downbeat ぶん早く始める。
   * 途中からのときはすぐ鳴らす（前の音は stopSample() で絞ってあり、待つ必要がない）。
   */
  private playSample(name: TuneName, offset: number): void {
    const buffer = this.sampleBuffer[name];
    if (!buffer) return;
    const song = SAMPLED[name];
    if (offset === 0 && song.start) offset = song.start;
    this.stopSample();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = song.loopStart;
    src.loopEnd = song.loopEnd;
    src.connect(this.sampleOut);
    src.onended = () => src.disconnect();
    this.sampleOut.gain.cancelScheduledValues(now);
    this.sampleOut.gain.setValueAtTime(song.gain, now);
    const at = offset === 0 ? now + SWITCH_GAP - song.downbeat : now;
    src.start(at, offset);
    this.sampleSource = src;
    this.sampleTune = name;
    this.sampleStartedAt = at;
    this.sampleOffset = offset;
  }

  /** 音声ファイルの曲を素早く絞って止める。 */
  private stopSample(): void {
    this.samplePending = null;
    const src = this.sampleSource;
    if (!src) return;
    this.sampleSource = null;
    this.sampleTune = null;
    const now = this.ctx.currentTime;
    this.sampleOut.gain.cancelScheduledValues(now);
    this.sampleOut.gain.setTargetAtTime(0, now, 0.01);
    src.stop(now + 0.05);
  }

  /** 音声ファイルの曲の読み込み状態。 */
  get samples(): Record<TuneName, "loading" | "ready" | "failed"> {
    return { ...this.sampleLoad };
  }

  /** 鳴っている音声ファイルの曲の繰り返す区間（素材の秒数）。鳴っていなければ null。 */
  get loop(): { start: number; end: number } | null {
    if (!this.sampleTune) return null;
    const song = SAMPLED[this.sampleTune];
    return { start: song.loopStart, end: song.loopEnd };
  }

  /** 鳴っている音声ファイルの曲の、素材の中の今の位置（秒）。鳴っていなければ null。 */
  get position(): number | null {
    if (!this.sampleSource || !this.sampleTune) return null;
    const song = SAMPLED[this.sampleTune];
    return loopPosition(this.ctx.currentTime - this.sampleStartedAt + this.sampleOffset, song.loopStart, song.loopEnd);
  }

  /** 鳴っている音声ファイルの曲を素材の seconds 秒へ飛ばす（e2e で継ぎ目を確かめる用）。 */
  seek(seconds: number): void {
    if (this.sampleTune) this.playSample(this.sampleTune, seconds);
  }

  /** 今の位置（16 分音符の数）。合成の曲はシーケンサの歩数、音声ファイルの曲は位置から換算する。 */
  get step(): number {
    const pos = this.position;
    if (pos === null || !this.sampleTune) return this.seqStep;
    return Math.floor(pos / (60 / SAMPLED[this.sampleTune].tempo / 4));
  }

  /** 求められている曲。止まっていれば null。 */
  get playing(): SongName | null {
    return this.current;
  }

  /** 実際に鳴っている曲。ゲーム中の危険状態では "danger"。止まっていれば null。 */
  get tune(): TuneName | null {
    return this.tune_;
  }

  /**
   * 曲を鳴らし始める。position は音声ファイルの曲（メニュー）を素材の何秒から鳴らすか。
   * 画面が隠れて止めたあと戻るときに、止めた位置から続けるのに使う。省略すると頭から
   */
  start(name: SongName, position = 0): void {
    if (this.current === name) return;
    this.stop();
    this.current = name;
    this.gameStep = 0;
    this.gamePosition = 0;
    this.play(name === "game" && this.danger ? "danger" : name, 0, position);
  }

  /** 止める。予約済みの音も出力ごと素早く絞り、止めた直後に1音だけ漏れないようにする。 */
  stop(): void {
    this.halt();
    this.clearRelease();
    this.current = null;
    this.tune_ = null;
  }

  /**
   * 危険状態ではゲーム曲をピンチの曲に切り替える。抜けたらゲーム曲を、切り替えた小節の頭から続ける。
   * 危険状態は天井付近で数秒おきに出入りするので、抜けてすぐには戻さず DANGER_RELEASE_MS 待つ。その間に戻れば何もしない。
   * 待たずに戻すと、ピンチの曲の冒頭とゲーム曲の同じ小節が交互に何度も鳴る。
   * ゲーム曲以外（メニュー・停止中）は状態だけ覚えておき、次に start("game") したときに反映する。
   */
  setDanger(on: boolean): void {
    this.danger = on;
    if (this.current !== "game") return;
    if (on) {
      this.clearRelease();
      if (this.tune_ === "game") {
        this.gameStep = this.seqStep;
        this.gamePosition = this.position ?? 0;
        this.halt();
        this.play("danger", 0);
      }
    } else if (this.tune_ === "danger" && this.releaseTimer === null) {
      this.releaseTimer = window.setTimeout(() => {
        this.releaseTimer = null;
        if (this.current !== "game" || this.tune_ !== "danger" || this.danger) return;
        this.halt();
        const beat = this.songs.game.beat;
        this.play("game", Math.floor(this.gameStep / beat) * beat, barStart(SAMPLED.game, this.gamePosition));
      }, DANGER_RELEASE_MS);
    }
  }

  private clearRelease(): void {
    if (this.releaseTimer !== null) window.clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
  }

  /** スケジューラを止めて出力を絞る。曲の指定は変えない。 */
  private halt(): void {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    this.stopSample();
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(0, now, 0.01);
  }

  /**
   * 曲を step の位置から鳴らし始める。
   * 直前の曲は LOOKAHEAD ぶん先まで音を予約しているので、出力を絞ったまま SWITCH_GAP 待ってから開ける。
   * すぐ開けると前の曲の予約済みの音が新しい曲に重なる。
   */
  private play(tune: TuneName, step: number, position = 0): void {
    this.tune_ = tune;
    // 音声ファイルの曲。読み込み中なら終わってから鳴らし、読み込めなければ合成の予備を鳴らす
    if (this.sampleLoad[tune] !== "failed") {
      if (this.sampleLoad[tune] === "ready") {
        this.playSample(tune, position);
      } else {
        this.samplePending = tune;
        this.samplePosition = position;
      }
      return;
    }
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(0, now);
    this.out.gain.setValueAtTime(1, now + SWITCH_GAP - 0.01);
    this.song = this.songs[tune];
    this.feedback.gain.value = this.song.echoFeedback;
    this.seqStep = step;
    this.nextTime = now + SWITCH_GAP;
    this.tick();
  }

  private tick(): void {
    const ctx = this.ctx;
    const song = this.song;
    const stepDur = 60 / song.tempo / 4;
    this.delay.delayTime.setTargetAtTime(stepDur * song.echoSteps, ctx.currentTime, 0.05);
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const t = this.nextTime;
      for (const tr of song.tracks) {
        const ev = tr.events.get(this.seqStep % tr.total);
        if (!ev) continue;
        if ("drum" in ev) {
          this.playDrum(ev.drum, ev.open, t, song.drumGain);
        } else if (tr.inst) {
          const dur = ev.len * stepDur * tr.inst.gate;
          for (const f of ev.freqs) this.playNote(tr.inst, f, t, dur);
        }
      }
      this.nextTime += stepDur;
      this.seqStep++;
    }
    this.timer = window.setTimeout(() => this.tick(), 30);
  }

  private makeOsc(wave: Wave, freq: number, t0: number): OscillatorNode {
    const osc = this.ctx.createOscillator();
    const pw = this.waves[wave];
    if (pw) osc.setPeriodicWave(pw);
    else osc.type = wave as OscillatorType;
    osc.frequency.setValueAtTime(freq, t0);
    return osc;
  }

  private playNote(inst: Instrument, freq: number, t0: number, dur: number): void {
    const ctx = this.ctx;
    const env = ctx.createGain();
    const peak = inst.gain;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + inst.a);
    const tDec = t0 + inst.a + inst.d;
    env.gain.linearRampToValueAtTime(peak * inst.s, tDec);
    const tRel = Math.max(t0 + dur, tDec);
    env.gain.setValueAtTime(peak * inst.s, tRel);
    env.gain.linearRampToValueAtTime(0, tRel + inst.r);
    const tEnd = tRel + inst.r;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.8;
    if (inst.fenv) {
      filter.frequency.setValueAtTime(Math.min(18000, inst.cutoff * inst.fenv), t0);
      filter.frequency.exponentialRampToValueAtTime(inst.cutoff, t0 + inst.d);
    } else {
      filter.frequency.value = inst.cutoff;
    }

    const oscs = [this.makeOsc(inst.wave, freq, t0)];
    const mix1 = ctx.createGain();
    mix1.gain.value = inst.wave2 ? 1 - (inst.mix2 ?? 0) * 0.5 : 1;
    oscs[0].connect(mix1);
    mix1.connect(filter);
    if (inst.wave2) {
      const o2 = this.makeOsc(inst.wave2, freq, t0);
      if (inst.detune2) o2.detune.value = inst.detune2;
      const mix2 = ctx.createGain();
      mix2.gain.value = inst.mix2 ?? 0.5;
      o2.connect(mix2);
      mix2.connect(filter);
      oscs.push(o2);
    }
    if (inst.vib) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = inst.vib.rate;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t0);
      lg.gain.linearRampToValueAtTime(inst.vib.depth, t0 + inst.vib.delay + 0.15);
      lfo.connect(lg);
      for (const o of oscs) lg.connect(o.detune);
      lfo.start(t0);
      lfo.stop(tEnd + 0.05);
    }
    filter.connect(env);
    env.connect(this.out);
    if (inst.echo) {
      const send = ctx.createGain();
      send.gain.value = inst.echo;
      env.connect(send);
      send.connect(this.echoIn);
    }
    for (const o of oscs) {
      o.start(t0);
      o.stop(tEnd + 0.05);
    }
  }

  private noiseVoice(t0: number, dur: number, type: BiquadFilterType, freq: number, gain: number, echo = 0): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.out);
    if (echo) {
      const send = ctx.createGain();
      send.gain.value = echo;
      g.connect(send);
      send.connect(this.echoIn);
    }
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  private toneVoice(t0: number, dur: number, type: OscillatorType, f0: number, f1: number, gain: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private playDrum(kind: DrumKind, open: boolean, t0: number, level: number): void {
    switch (kind) {
      case "kick":
        this.toneVoice(t0, 0.28, "sine", 160, 45, 0.9 * level);
        this.noiseVoice(t0, 0.015, "lowpass", 2500, 0.3 * level);
        break;
      case "snare":
        this.noiseVoice(t0, 0.16, "bandpass", 1800, 0.45 * level, 0.3);
        this.toneVoice(t0, 0.08, "triangle", 190, 0, 0.3 * level);
        break;
      case "hat":
        this.noiseVoice(t0, open ? 0.3 : 0.045, "highpass", 7500, 0.22 * level, open ? 0.2 : 0);
        break;
    }
  }
}
