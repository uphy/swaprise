import { BgmPlayer, type SongName, makePulseWave } from "./bgm";

/** 1音の指定。f から f2 へスライドできる。curve は "exp" が減衰、"hold" が dur の間保ってから短く切る。 */
interface VoiceSpec {
  wave?: OscillatorType | "pulse25" | "pulse12";
  f: number;
  f2?: number;
  /** スライドにかける秒数。省略時は dur */
  slide?: number;
  dur?: number;
  gain?: number;
  /** アタック秒 */
  a?: number;
  /** 何秒後に鳴らすか */
  t?: number;
  /** エコーへ送る量 */
  echo?: number;
  detune?: number;
  cutoff?: number;
  curve?: "exp" | "hold";
}

interface NoiseSpec {
  type?: BiquadFilterType;
  freq?: number;
  freq2?: number;
  q?: number;
  dur?: number;
  gain?: number;
  t?: number;
  echo?: number;
}

interface ArpSpec {
  step?: number;
  dur?: number;
  wave?: VoiceSpec["wave"];
  gain?: number;
  t?: number;
  echo?: number;
  detune?: number;
}

const NOTE_IDX: Record<string, number> = {
  c: 0, "c#": 1, d: 2, "d#": 3, e: 4, f: 5, "f#": 6, g: 7, "g#": 8, a: 9, "a#": 10, bb: 10, b: 11,
};

/** "c5" のような音名を Hz にする。 */
function n(name: string): number {
  const m = /^([a-g])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`音名が不正: ${name}`);
  return 440 * Math.pow(2, ((Number(m[3]) + 1) * 12 + NOTE_IDX[m[1] + m[2]] - 69) / 12);
}
/** f を semis 半音ぶん上げる。 */
const st = (f: number, semis: number): number => f * Math.pow(2, semis / 12);

/**
 * Web Audio だけで鳴らす効果音とBGM。音声ファイルは使わない。
 * AudioContext はユーザー操作のあとに resume する必要があるので、start() を入力時に呼ぶ。
 * BGM は AudioContext ができる前に startBgm() されても覚えておき、start() 時に鳴らし始める。
 * 効果音の設計は tools/sfx-candidates.html で選んだ案を移したもの。
 */
const MUTE_KEY = "swaprise.mute.v1";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private echoIn: GainNode | null = null;
  private waves: Record<string, PeriodicWave> = {};
  private noiseBuf: AudioBuffer | null = null;
  private bgmGain: GainNode | null = null;
  private bgm: BgmPlayer | null = null;
  private pendingBgm: SongName | null = null;
  private danger = false;
  muted = false;
  /** false のとき startBgm() を無視する。e2e で ?bgm=0 を付けるときに使う。 */
  bgmEnabled = true;

  /**
   * 今すぐ音を鳴らせるか。AudioContext は操作の前には動かせないが、Chrome はインストール済みの PWA や
   * よく音を鳴らしているサイトでは操作なしで動かす。start() のあとに見れば、その環境で鳴らせるかが分かる。
   */
  get unlocked(): boolean {
    return this.ctx?.state === "running";
  }

  constructor() {
    // ミュートは localStorage に覚えておく。スマホでは画面のボタンで切り替えるので、次回も同じ状態で始める
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === "on";
    } catch {
      this.muted = false;
    }
  }

  start(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    let ctx: AudioContext;
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.35;
    this.master.connect(ctx.destination);

    // 効果音。SFC の丸い音にするため高域を削り、短いエコーを付ける
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 9000;
    tone.Q.value = 0.5;
    this.sfxGain.connect(tone);
    tone.connect(this.master);
    this.echoIn = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.13;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const fbFilter = ctx.createBiquadFilter();
    fbFilter.type = "lowpass";
    fbFilter.frequency.value = 3000;
    this.echoIn.connect(delay);
    delay.connect(fbFilter);
    fbFilter.connect(fb);
    fb.connect(delay);
    delay.connect(this.sfxGain);
    this.waves = { pulse25: makePulseWave(ctx, 0.25), pulse12: makePulseWave(ctx, 0.125) };
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.value = 0.5;
    this.bgmGain.connect(this.master);
    this.bgm = new BgmPlayer(ctx, this.bgmGain);
    this.bgm.setDanger(this.danger);
    if (this.pendingBgm) {
      this.bgm.start(this.pendingBgm);
      this.pendingBgm = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.35;
    try {
      localStorage.setItem(MUTE_KEY, m ? "on" : "off");
    } catch {
      // 保存できなくても動作には影響しない
    }
  }

  // ------------------------------------------------------------- 合成の部品

  private out(node: AudioNode, echo: number): void {
    if (!this.sfxGain || !this.echoIn) return;
    node.connect(this.sfxGain);
    if (echo > 0 && this.ctx) {
      const send = this.ctx.createGain();
      send.gain.value = echo;
      node.connect(send);
      send.connect(this.echoIn);
    }
  }

  private voice({ wave = "square", f, f2, slide, dur = 0.1, gain = 0.2, a = 0.002, t = 0, echo = 0, detune = 0, cutoff = 0, curve = "exp" }: VoiceSpec): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + t;
    const o = ctx.createOscillator();
    const pw = this.waves[wave];
    if (pw) o.setPeriodicWave(pw);
    else o.type = wave as OscillatorType;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + (slide ?? dur));
    if (detune) o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + a);
    if (curve === "hold") {
      g.gain.setValueAtTime(gain, t0 + dur - 0.01);
      g.gain.linearRampToValueAtTime(0, t0 + dur);
    } else {
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    }
    if (cutoff) {
      const fl = ctx.createBiquadFilter();
      fl.type = "lowpass";
      fl.frequency.value = cutoff;
      o.connect(fl);
      fl.connect(g);
    } else {
      o.connect(g);
    }
    this.out(g, echo);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise({ type = "lowpass", freq = 1000, freq2, q = 1, dur = 0.1, gain = 0.2, t = 0, echo = 0 }: NoiseSpec): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const t0 = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(freq, t0);
    fl.Q.value = q;
    if (freq2) fl.frequency.exponentialRampToValueAtTime(freq2, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(fl);
    fl.connect(g);
    this.out(g, echo);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** 分散和音。notes は Hz。 */
  private arp(notes: number[], { step = 0.05, dur = 0.12, wave = "pulse25", gain = 0.14, t = 0, echo = 0.3, detune = 0 }: ArpSpec): void {
    notes.forEach((f, i) => {
      this.voice({ wave, f, dur, gain, t: t + i * step, echo });
      if (detune) this.voice({ wave, f, dur, gain: gain * 0.6, t: t + i * step, echo, detune });
    });
  }

  private chord(notes: number[], spec: ArpSpec): void {
    this.arp(notes, { ...spec, step: 0 });
  }

  private kick(t = 0, level = 1): void {
    this.voice({ wave: "sine", f: 160, f2: 45, slide: 0.14, dur: 0.28, gain: 0.9 * level, t });
    this.noise({ type: "lowpass", freq: 2500, dur: 0.015, gain: 0.3 * level, t });
  }

  // ------------------------------------------------------------- 効果音

  /** パネルの入れ替え。短い上昇の「キュッ」。 */
  swap(): void {
    this.voice({ wave: "pulse25", f: n("e6"), f2: n("a6"), dur: 0.05, gain: 0.14, echo: 0.15 });
  }

  /** カーソル移動。極短のティック。 */
  move(): void {
    this.voice({ wave: "triangle", f: n("g6"), dur: 0.03, gain: 0.15 });
  }

  /** 揃った瞬間。メジャーの分散和音。連鎖で全体が上がり、2連鎖以上できらめきが足され、4枚以上で1音増える。 */
  match(panels: number, chain: number): void {
    const base = st(n("c5"), Math.min(12, (chain - 1) * 2));
    const notes = [0, 4, 7, 12].concat(panels >= 4 ? [16] : []).map((s) => st(base, s));
    this.arp(notes, { step: 0.04, dur: 0.15, gain: 0.16, echo: 0.3 });
    if (chain >= 2) this.voice({ wave: "sine", f: base * 4, dur: 0.3, gain: 0.08, t: 0.16, echo: 0.4 });
  }

  /** 1枚ずつ消える音。同じ消去内で index が増えるほど音が高くなる。 */
  pop(index: number): void {
    const f = 520 * Math.pow(1.06, index);
    this.voice({ wave: "pulse25", f, f2: f * 1.6, dur: 0.09, gain: 0.14, echo: 0.25 });
    this.voice({ wave: "pulse25", f, f2: f * 1.6, dur: 0.09, gain: 0.08, echo: 0.25, detune: 8 });
  }

  /** 連鎖の終わり。連鎖数ぶん上昇する音階をエコーで残す。 */
  chainEnd(chain: number): void {
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    const notes = scale.slice(0, Math.min(chain, 8)).map((s) => st(n("c5"), s));
    this.arp(notes, { step: 0.05, dur: 0.18, gain: 0.14, echo: 0.45 });
  }

  /** パネルの着地。「コッ」。 */
  land(): void {
    this.voice({ wave: "triangle", f: 180, f2: 140, dur: 0.05, gain: 0.12 });
    this.noise({ type: "lowpass", freq: 1500, dur: 0.02, gain: 0.1 });
  }

  /** おじゃまの着地。低音・ノイズ・衝撃の3層。高さで長くなる。 */
  garbageLand(height: number): void {
    this.voice({ wave: "sine", f: 90, f2: 32, slide: 0.15, dur: 0.35 + height * 0.05, gain: 0.5 });
    this.noise({ type: "lowpass", freq: 300, dur: 0.2 + height * 0.05, gain: 0.4 });
    this.voice({ wave: "square", f: 55, dur: 0.1, gain: 0.15, cutoff: 200 });
    this.noise({ type: "highpass", freq: 3000, dur: 0.06, gain: 0.12 });
  }

  /** おじゃまがパネルに変わる。きらきら上昇する6音。 */
  garbageTransform(): void {
    this.arp([0, 4, 7, 12, 16, 19].map((s) => st(n("e5"), s)), { step: 0.04, dur: 0.1, wave: "pulse12", gain: 0.1, echo: 0.4 });
  }

  /** 攻撃を送る。レーザー風の下降。 */
  attack(): void {
    this.voice({ wave: "square", f: 1400, f2: 250, dur: 0.25, gain: 0.12, echo: 0.3 });
    this.voice({ wave: "square", f: 1400, f2: 250, dur: 0.25, gain: 0.08, echo: 0.3, detune: -15 });
  }

  /** 負け。半音で下がる短調フレーズのあと短調の和音。 */
  lose(): void {
    this.stopBgm();
    this.arp(["e5", "d#5", "d5", "c#5", "c5", "b4"].map(n), { step: 0.13, dur: 0.15, gain: 0.14, echo: 0.3 });
    this.chord(["a3", "c4", "e4"].map(n), { dur: 0.9, gain: 0.12, t: 0.8, wave: "triangle", echo: 0.4 });
  }

  /** 勝ち。ハープの上昇と高い和音のきらめき。 */
  win(): void {
    this.stopBgm();
    this.arp(["c5", "d5", "e5", "g5", "a5", "c6", "d6", "e6"].map(n), { step: 0.045, dur: 0.25, wave: "triangle", gain: 0.14, echo: 0.4 });
    this.chord(["c6", "e6", "g6"].map(n), { dur: 0.8, gain: 0.1, t: 0.4, wave: "sine", echo: 0.5 });
    this.voice({ wave: "sine", f: n("c7"), dur: 0.5, gain: 0.05, t: 0.5, echo: 0.5 });
  }

  /** メニュー決定。「ピロッ」の速い3音。 */
  select(): void {
    this.arp(["c6", "e6", "g6"].map(n), { step: 0.025, dur: 0.07, wave: "pulse12", gain: 0.12, echo: 0.3 });
  }

  /** カウントダウンの 3・2・1。鈴のような短い1音。 */
  count(): void {
    this.voice({ wave: "sine", f: n("e6"), dur: 0.14, gain: 0.18, echo: 0.3 });
    this.voice({ wave: "triangle", f: n("e5"), dur: 0.08, gain: 0.06 });
  }

  /** ゲーム開始。キックと「ピッ、ポーン」。 */
  gameStart(): void {
    this.kick(0);
    this.voice({ wave: "pulse25", f: n("g5"), dur: 0.08, gain: 0.14, echo: 0.3 });
    this.voice({ wave: "pulse25", f: n("c6"), dur: 0.25, gain: 0.14, t: 0.12, echo: 0.3 });
  }

  /**
   * オープニングで題字の柄が左から右へ灯る間のライザー。dur 秒かけてノイズの帯域と音程が上がり、終わりで6音が弾ける。
   * 灯り終わりでカーソルが現れるので、そこへ向けて張る音にする。
   */
  riser(dur: number): void {
    this.noise({ type: "bandpass", freq: 300, freq2: 5000, q: 1.2, dur, gain: 0.22, echo: 0.2 });
    this.voice({ wave: "pulse25", f: n("c5"), f2: n("c6"), slide: dur, dur, gain: 0.09, echo: 0.3, curve: "hold" });
    this.arp([0, 4, 7, 12, 16, 19].map((s) => st(n("e5"), s)), { step: 0.04, dur: 0.1, wave: "pulse12", gain: 0.1, echo: 0.4, t: dur });
  }

  /**
   * オープニングで題字が現れる瞬間。キックと C のハープの駆け上がり、高い和音。
   * メニューの曲（C major）の 1 拍目と同時に鳴らすので、曲は止めない（win() は止める）。
   */
  titleSting(): void {
    this.kick(0);
    this.arp(["c5", "e5", "g5", "c6", "e6", "g6"].map(n), { step: 0.04, dur: 0.25, wave: "triangle", gain: 0.14, echo: 0.4 });
    this.chord(["c6", "e6", "g6"].map(n), { dur: 0.8, gain: 0.1, t: 0.24, wave: "sine", echo: 0.5 });
  }

  /** 一時停止は下降、解除は上昇の2音。 */
  pause(on: boolean): void {
    const [a, b] = on ? ["c6", "g5"] : ["g5", "c6"];
    this.voice({ wave: "triangle", f: n(a), dur: 0.06, gain: 0.18 });
    this.voice({ wave: "triangle", f: n(b), dur: 0.12, gain: 0.18, t: 0.06 });
  }

  /** スピードレベル上昇。4音の上昇分散和音と高い残響。 */
  levelUp(): void {
    const notes = [0, 4, 7, 12].map((s) => st(n("g5"), s));
    this.arp(notes, { step: 0.05, dur: 0.12, gain: 0.13, echo: 0.3 });
    this.voice({ wave: "sine", f: notes[3] * 2, dur: 0.3, gain: 0.08, t: 0.2, echo: 0.4 });
  }

  /** 危険状態に入った。高いパルスの速い下降モチーフ。 */
  dangerWarn(): void {
    this.arp(["a6", "g6", "e6", "d6"].map(n), { step: 0.045, dur: 0.1, wave: "pulse12", gain: 0.09, echo: 0.45 });
  }

  /** 天井に触れた。鈴の速い連打。 */
  panicWarn(): void {
    for (let i = 0; i < 4; i++) {
      this.voice({ wave: "sine", f: n("c7"), dur: 0.12, gain: 0.12, t: i * 0.08, echo: 0.4 });
      this.voice({ wave: "sine", f: n("g7"), dur: 0.08, gain: 0.04, t: i * 0.08, echo: 0.4 });
    }
  }

  // ---------------------------------------------------------------- BGM

  startBgm(name: SongName): void {
    if (!this.bgmEnabled) return;
    if (this.bgm) this.bgm.start(name);
    else this.pendingBgm = name;
  }

  stopBgm(): void {
    this.pendingBgm = null;
    this.bgm?.stop();
  }

  private bgmBeforeSuspend: SongName | null = null;
  private suspendTimer: number | null = null;

  /**
   * 画面が隠れたときや一時停止で呼ぶ。BGM のスケジューラを止め、AudioContext も止めて音を出さない。
   * 直前に鳴らした効果音（一時停止の音）が切れないよう、AudioContext は少し遅れて止める。
   */
  suspend(): void {
    this.bgmBeforeSuspend = this.bgm?.playing ?? this.pendingBgm;
    this.stopBgm();
    if (this.suspendTimer !== null) window.clearTimeout(this.suspendTimer);
    this.suspendTimer = window.setTimeout(() => {
      this.suspendTimer = null;
      if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
    }, 250);
  }

  /** 画面に戻って再開するときに呼ぶ。止める前に BGM が鳴っていたら同じ曲を鳴らし直す。 */
  resume(): void {
    if (this.suspendTimer !== null) {
      window.clearTimeout(this.suspendTimer);
      this.suspendTimer = null;
    }
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
    if (this.bgmBeforeSuspend) this.startBgm(this.bgmBeforeSuspend);
    this.bgmBeforeSuspend = null;
  }

  /** 危険状態ではゲーム曲をピンチの曲に切り替える。 */
  setDanger(on: boolean): void {
    this.danger = on;
    this.bgm?.setDanger(on);
  }
}
