// 曲データの読み書きと旋律の検査。DOM に依存せず Node で動く。
//
// 曲データは tools/bgm-candidates.html と src/render/bgm.ts と同じ「16 分音符単位の音符列」（seq 形式）:
//   "c5:2 e5+g5:4 r:2"  … 音名:長さ。長さは 16 分音符の数（省略時 1）。+ で和音、r で休符
// ABC 記譜（旋律を書くのに向いた標準の文字記譜）との相互変換と、ピアノロールの SVG、旋律の指標を持つ。

export const NOTE_IDX = { c: 0, "c#": 1, db: 1, d: 2, "d#": 3, eb: 3, e: 4, f: 5, "f#": 6, gb: 6, g: 7, "g#": 8, ab: 8, a: 9, "a#": 10, bb: 10, b: 11 };
const SHARP_NAMES = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
const LETTER_PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** "c5" → 72（c4 = 60）。 */
export function noteToMidi(name) {
  const m = /^([a-g][#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`音名が不正: ${name}`);
  return (Number(m[2]) + 1) * 12 + NOTE_IDX[m[1]];
}

/** 72 → "c5"。黒鍵は # で書く。 */
export function midiToNote(midi) {
  return `${SHARP_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

// ------------------------------------------------------------- seq 形式

/** seq 形式を音符の並びにする。休符も残す（midi が空）。 */
export function parseSeq(seq) {
  const events = [];
  let step = 0;
  for (const tok of seq.trim().split(/\s+/)) {
    if (!tok) continue;
    const [body, lenStr] = tok.split(":");
    const len = lenStr === undefined ? 1 : Number(lenStr);
    if (!(len > 0) || !Number.isInteger(len)) throw new Error(`長さが不正: ${tok}`);
    events.push({ step, len, midi: body === "r" ? [] : body.split("+").map(noteToMidi) });
    step += len;
  }
  return events;
}

/** 音符の並びを seq 形式にする。 */
export function formatSeq(events) {
  return events.map((e) => `${e.midi.length ? e.midi.map(midiToNote).join("+") : "r"}:${e.len}`).join(" ");
}

/** 音符の並びを小節（beat 16 分音符ずつ）に分ける。小節をまたぐ音符は分けて、後半に tie を付ける。 */
export function splitBars(events, beat) {
  const bars = [];
  for (const e of events) {
    let start = e.step;
    let left = e.len;
    let tied = false;
    while (left > 0) {
      const bar = Math.floor(start / beat);
      while (bars.length <= bar) bars.push([]);
      const room = beat - (start % beat);
      const len = Math.min(room, left);
      bars[bar].push({ step: start % beat, len, midi: e.midi, tied });
      tied = true;
      start += len;
      left -= len;
    }
  }
  return bars;
}

// ------------------------------------------------------------- 和音記号

const QUALITIES = [
  ["maj7", [0, 4, 7, 11]],
  ["m7", [0, 3, 7, 10]],
  ["dim7", [0, 3, 6, 9]],
  ["dim", [0, 3, 6]],
  ["aug", [0, 4, 8]],
  ["sus4", [0, 5, 7]],
  ["sus2", [0, 2, 7]],
  ["m6", [0, 3, 7, 9]],
  ["6", [0, 4, 7, 9]],
  ["7", [0, 4, 7, 10]],
  ["m", [0, 3, 7]],
  ["", [0, 4, 7]],
];

/** "Am7" → 構成音のピッチクラス [9, 0, 4, 7]。 */
export function chordTones(symbol) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(symbol.trim());
  if (!m) throw new Error(`和音記号が不正: ${symbol}`);
  const root = (LETTER_PC[m[1].toLowerCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  const q = QUALITIES.find(([name]) => name === m[3]);
  if (!q) throw new Error(`知らない和音の種類: ${symbol}`);
  return q[1].map((i) => (root + i) % 12);
}

// ------------------------------------------------------------- ABC 記譜

/** 調号。K:D → { f: 1, c: 1 }（シャープ）、K:F → { b: -1 }。長調と短調だけ。 */
export function keyAccidentals(key) {
  const m = /^([A-G])([#b]?)\s*(m|min|minor|maj|major)?$/.exec(key.trim());
  if (!m) throw new Error(`調が不正（長調・短調だけ）: ${key}`);
  let pc = (LETTER_PC[m[1].toLowerCase()] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  if (m[3] && m[3].startsWith("m") && m[3] !== "maj" && m[3] !== "major") pc = (pc + 3) % 12;
  // 五度圏。C から上に何度目か（シャープの数）、下に何度目か（フラットの数）
  const sharps = ["f", "c", "g", "d", "a", "e", "b"];
  const flats = ["b", "e", "a", "d", "g", "c", "f"];
  const out = {};
  for (let n = 0; n <= 6; n++) {
    if ((n * 7) % 12 === pc) {
      sharps.slice(0, n).forEach((l) => (out[l] = 1));
      return out;
    }
    if ((12 - ((n * 7) % 12)) % 12 === pc && n > 0) {
      flats.slice(0, n).forEach((l) => (out[l] = -1));
      return out;
    }
  }
  return out;
}

function parseLength(src, i) {
  // 音符のあとの長さ: 2, 3/2, /, //, /2 …。分子と分母を返す
  let num = 1;
  let den = 1;
  let digits = "";
  while (i < src.length && /\d/.test(src[i])) digits += src[i++];
  if (digits) num = Number(digits);
  if (src[i] === "/") {
    let slashes = 0;
    while (src[i] === "/") {
      slashes++;
      i++;
    }
    let d = "";
    while (i < src.length && /\d/.test(src[i])) d += src[i++];
    den = d ? Number(d) : 2 ** slashes;
  }
  return { num, den, next: i };
}

/**
 * ABC 記譜を読む。対応する範囲: X/T/M/L/K/V のヘッダ、音符（臨時記号 ^ = _、オクターブ ' ,、長さ）、
 * 休符 z x、和音 [ceg]、タイ -、付点の省略記法 > <、小節線（繰り返し記号は小節線として扱う）、
 * "C" の和音記号、% のコメント。連符は非対応。臨時記号は ABC の規則どおり小節内で同じ音に効く。
 * 戻り値: { meter: {num, den}, beat, key, voices: [{ name, bars: [{ chord, events: [{ step, len, midi }] }] }] }
 */
export function parseAbc(text) {
  const header = { M: "4/4", L: "1/8", K: "C" };
  const voices = [];
  let voice = null;
  const lines = text.split(/\r?\n/);
  let bodyStarted = false;
  const body = [];
  for (const raw of lines) {
    const line = raw.replace(/%.*$/, "");
    const m = /^([A-Za-z]):(.*)$/.exec(line);
    if (m && (!bodyStarted || /^[VKML]$/.test(m[1]))) {
      const field = m[1];
      const value = m[2].trim();
      if (field === "K") {
        header.K = value;
        bodyStarted = true;
        continue;
      }
      if (field === "V") {
        body.push({ voice: value.split(/\s+/)[0] });
        continue;
      }
      if (field === "M" || field === "L") header[field] = value;
      continue;
    }
    if (!bodyStarted) continue;
    if (line.trim()) body.push({ line });
  }
  const meter = header.M === "C" ? { num: 4, den: 4 } : header.M === "C|" ? { num: 2, den: 2 } : (() => {
    const mm = /^(\d+)\/(\d+)$/.exec(header.M);
    if (!mm) throw new Error(`拍子が不正: ${header.M}`);
    return { num: Number(mm[1]), den: Number(mm[2]) };
  })();
  const lm = /^(\d+)\/(\d+)$/.exec(header.L);
  if (!lm) throw new Error(`音符の単位が不正: ${header.L}`);
  const unit16 = (16 * Number(lm[1])) / Number(lm[2]);
  const beat = (16 * meter.num) / meter.den;
  const keyAcc = keyAccidentals(header.K);

  const ensureVoice = (name) => {
    voice = voices.find((v) => v.name === name);
    if (!voice) {
      voice = { name, bars: [], cur: { chord: null, events: [], acc: {} }, tie: null, broken: 0 };
      voices.push(voice);
    }
  };
  const closeBar = (v) => {
    // 小節をまたぐタイは結合しない（seq 形式は小節ごとに扱うので、次の小節の音として別に持つ）
    v.tie = null;
    if (v.cur.events.length === 0) return;
    const total = v.cur.events.reduce((n, e) => n + e.len, 0);
    if (total !== beat) throw new Error(`${v.name}: 小節 ${v.bars.length + 1} の長さが ${total}（${beat} でない）`);
    v.bars.push({ chord: v.cur.chord, events: v.cur.events });
    v.cur = { chord: null, events: [], acc: {} };
  };
  const toLen16 = (num, den, brokenMul) => {
    const len = (unit16 * num * brokenMul) / den;
    if (!Number.isInteger(len) || len <= 0) throw new Error(`16 分音符に収まらない長さ: ${num}/${den}${brokenMul !== 1 ? `（付点 ${brokenMul}）` : ""}`);
    return len;
  };

  for (const item of body) {
    if (item.voice !== undefined) {
      ensureVoice(item.voice);
      continue;
    }
    if (!voice) ensureVoice("1");
    const src = item.line;
    let i = 0;
    const v = voice;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === '"') {
        const end = src.indexOf('"', i + 1);
        if (end < 0) throw new Error(`和音記号が閉じていない: ${src}`);
        const sym = src.slice(i + 1, end);
        if (/^[A-G]/.test(sym) && v.cur.chord === null) v.cur.chord = sym;
        i = end + 1;
        continue;
      }
      if (ch === "[" && src.startsWith("[V:", i)) {
        const end = src.indexOf("]", i);
        closeBar(v);
        ensureVoice(src.slice(i + 3, end).trim());
        i = end + 1;
        continue;
      }
      if (ch === "|" || ch === ":" || (ch === "[" && src[i + 1] === "|")) {
        while (i < src.length && /[|:\][0-9]/.test(src[i])) i++;
        closeBar(v);
        continue;
      }
      if (ch === "(" && /\d/.test(src[i + 1] ?? "")) throw new Error("連符は非対応");
      if (ch === "-") {
        v.tie = v.cur.events[v.cur.events.length - 1] ?? null;
        i++;
        continue;
      }
      if (ch === ">" || ch === "<") {
        // 付点の省略記法。直前の音符と次の音符の長さを 3:1 に分ける
        let n = 0;
        while (src[i] === ch) {
          n++;
          i++;
        }
        const prev = v.cur.events[v.cur.events.length - 1];
        if (!prev) throw new Error(`${ch} の前に音符がない`);
        const factor = 2 - 1 / 2 ** n; // > で 1.5、>> で 1.75
        const shrink = 1 / 2 ** n;
        const [longer, shorter] = ch === ">" ? [factor, shrink] : [shrink, factor];
        const newLen = prev.len * longer;
        if (!Number.isInteger(newLen)) throw new Error(`付点で 16 分音符に収まらない: ${prev.len}`);
        prev.len = newLen;
        v.broken = shorter;
        continue;
      }
      // 休符
      if (ch === "z" || ch === "x") {
        const { num, den, next } = parseLength(src, i + 1);
        const mul = v.broken || 1;
        v.broken = 0;
        v.cur.events.push({ len: toLen16(num, den, mul), midi: [] });
        i = next;
        continue;
      }
      // 和音 [ceg] か単音
      let pitches = [];
      let j = i;
      const readNote = () => {
        let acc = null;
        if (src[j] === "^") {
          acc = 1;
          j++;
          if (src[j] === "^") {
            acc = 2;
            j++;
          }
        } else if (src[j] === "_") {
          acc = -1;
          j++;
          if (src[j] === "_") {
            acc = -2;
            j++;
          }
        } else if (src[j] === "=") {
          acc = 0;
          j++;
        }
        const letter = src[j];
        if (!/[A-Ga-g]/.test(letter ?? "")) throw new Error(`音符として読めない: ${src.slice(i, i + 8)}`);
        j++;
        let octave = letter === letter.toUpperCase() ? 4 : 5;
        while (src[j] === "'" || src[j] === ",") {
          octave += src[j] === "'" ? 1 : -1;
          j++;
        }
        const l = letter.toLowerCase();
        const accKey = `${l}${octave}`;
        if (acc !== null) v.cur.acc[accKey] = acc;
        const alter = v.cur.acc[accKey] ?? keyAcc[l] ?? 0;
        return (octave + 1) * 12 + LETTER_PC[l] + alter;
      };
      let num = 1;
      let den = 1;
      if (ch === "[") {
        j++;
        while (src[j] !== "]") {
          if (j >= src.length) throw new Error("和音が閉じていない");
          pitches.push(readNote());
          const l = parseLength(src, j);
          num = l.num;
          den = l.den;
          j = l.next;
          while (/\s/.test(src[j] ?? "")) j++;
        }
        j++;
        const l = parseLength(src, j);
        if (l.next > j) {
          num = l.num;
          den = l.den;
        }
        j = l.next;
      } else {
        pitches.push(readNote());
        const l = parseLength(src, j);
        num = l.num;
        den = l.den;
        j = l.next;
      }
      const mul = v.broken || 1;
      v.broken = 0;
      const len = toLen16(num, den, mul);
      const tie = v.tie;
      v.tie = null;
      if (tie && tie.midi.length === pitches.length && tie.midi.every((p, k) => p === pitches[k])) {
        tie.len += len;
      } else {
        v.cur.events.push({ len, midi: pitches });
      }
      i = j;
    }
  }
  for (const v of voices) closeBar(v);
  return {
    meter,
    beat,
    key: header.K,
    voices: voices.map((v) => ({
      name: v.name,
      bars: v.bars.map((b) => {
        let step = 0;
        return { chord: b.chord, events: b.events.map((e) => ({ step: (step += e.len) - e.len, len: e.len, midi: e.midi })) };
      }),
    })),
  };
}

/** ABC の声部を seq 形式にする。小節ごとの文字列と和音記号を返す。 */
export function abcToSeq(text) {
  const tune = parseAbc(text);
  return {
    beat: tune.beat,
    voices: tune.voices.map((v) => ({
      name: v.name,
      bars: v.bars.map((b) => formatSeq(b.events)),
      chords: v.bars.map((b) => b.chord),
    })),
  };
}

/** MIDI 番号を ABC の音名にする。調号にない黒鍵は ^ で書く。 */
function abcPitch(midi, keyAcc, barAcc) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const white = Object.entries(LETTER_PC).find(([, p]) => p === pc);
  let letter;
  let alter;
  if (white) {
    letter = white[0];
    alter = 0;
  } else {
    letter = Object.entries(LETTER_PC).find(([, p]) => p === pc - 1)[0];
    alter = 1;
  }
  const key = `${letter}${octave}`;
  const current = barAcc[key] ?? keyAcc[letter] ?? 0;
  let mark = "";
  if (alter !== current) {
    mark = alter === 1 ? "^" : alter === -1 ? "_" : "=";
    barAcc[key] = alter;
  }
  let name = octave >= 5 ? letter : letter.toUpperCase();
  if (octave >= 6) name += "'".repeat(octave - 5);
  if (octave <= 3) name += ",".repeat(4 - octave);
  return mark + name;
}

/**
 * seq 形式（音符の並び）を ABC 記譜にする。L:1/16 で書くので長さはそのまま数字になる。
 * chords があれば小節の頭に和音記号を付ける。声部が複数なら V:1 V:2 … で並べる。
 */
export function seqToAbc(voices, { beat, meter = "4/4", key = "C", title = "", chords = null } = {}) {
  const keyAcc = keyAccidentals(key);
  const out = [`X:1`, `T:${title}`, `M:${meter}`, `L:1/16`, `K:${key}`];
  voices.forEach((v, vi) => {
    if (voices.length > 1) out.push(`V:${v.name ?? vi + 1}`);
    const bars = splitBars(v.events, beat);
    const lines = [];
    bars.forEach((bar, bi) => {
      const barAcc = {};
      const parts = [];
      if (chords && chords[bi]) parts.push(`"${chords[bi]}"`);
      for (const e of bar) {
        let tok;
        if (e.midi.length === 0) tok = `z${e.len}`;
        else if (e.midi.length === 1) tok = `${abcPitch(e.midi[0], keyAcc, barAcc)}${e.len}`;
        else tok = `[${e.midi.map((m) => `${abcPitch(m, keyAcc, barAcc)}${e.len}`).join("")}]`;
        parts.push((e.tied ? "" : "") + tok);
      }
      // 小節をまたぐ音は前の小節の最後にタイを付ける
      const next = bars[bi + 1];
      const tieOut = next && next[0]?.tied;
      lines.push(parts.join(" ") + (tieOut ? "-" : ""));
    });
    for (let i = 0; i < lines.length; i += 4) out.push(lines.slice(i, i + 4).join(" | ") + " |");
  });
  return out.join("\n") + "\n";
}

// ------------------------------------------------------------- 試聴ページの曲

/**
 * tools/bgm-candidates.html の曲を読む。ページの script を Node で評価する（ページ自体が Node での検証を想定している）。
 * 戻り値の各曲は { name, key, tempo, beat, chords?, tracks: [{ inst, events }], drums: [{ drum, pat }] }。
 */
export async function loadCandidates(htmlPath) {
  const { readFile } = await import("node:fs/promises");
  const html = await readFile(htmlPath, "utf8");
  const script = html.slice(html.indexOf("<script>") + 8, html.indexOf("</script>"));
  const log = console.log;
  console.log = () => {};
  let SONGS;
  try {
    SONGS = new Function(`${script}\nreturn SONGS;`)();
  } finally {
    console.log = log;
  }
  return SONGS.map((s) => ({
    name: s.name,
    key: s.key,
    tempo: s.tempo,
    beat: s.beat,
    chords: s.chords ?? null,
    tracks: s.tracks.filter((t) => t.inst).map((t) => ({ inst: t.inst, events: parseSeq(t.seq) })),
    drums: s.tracks.filter((t) => t.drum).map((t) => ({ drum: t.drum, pat: t.pat })),
  }));
}

/** 旋律を担う楽器。検査と楽譜はこれらのトラックを対象にする。 */
export const MELODY_INSTRUMENTS = ["leadSq", "flute", "clav", "leadPulse", "sineLead", "leadPlain"];

/** 曲の旋律トラック。なければ最初の音程トラック。 */
export function melodyTracks(song) {
  const m = song.tracks.filter((t) => MELODY_INSTRUMENTS.includes(t.inst));
  return m.length ? m : song.tracks.slice(0, 1);
}

// ------------------------------------------------------------- 旋律の指標

function entropy(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return 0;
  return -counts.reduce((h, c) => (c ? h + (c / total) * Math.log2(c / total) : h), 0);
}

/**
 * 旋律の指標。Libretto（arXiv 2606.22708）の軸のうち、耳で気づかれた弱点に効くものを選んだ。
 * events は音符の並び（和音は最高音を旋律とみなす）。chords は小節ごとの和音記号（省略可）。
 *
 * - leapRatio: 跳躍（3 半音以上）の割合。高いほど分散和音的
 * - arpeggioRatio: 跳躍のうち、同じ小節の和音の構成音どうしを結ぶものの割合。「いかにもアルペジオ」の直接の指標
 * - intervalEntropy: 音程の種類の散らばり（bit）。低いと同じ動きの繰り返し
 * - stepRatio / ascendingRatio / range: 順次進行の割合、上行の割合、音域（半音）
 * - rhythmDistinct: 8 小節の窓ごとの「リズムの型の種類数 ÷ 小節数」の平均。rhythmMaxRepeat: 同じ型が続く最長
 * - barNovelty: 前に出た小節と音もリズムも同じでない小節の割合
 * - holdRatio: 小節の最後の音が 4 分音符以上（句末の伸ばし）の割合
 * - restRatio: 休符の割合（16 分音符単位）
 * - chordToneRatio / strongNonChordRatio: 構成音の割合、強拍（拍の頭）の音が構成音でない割合
 * - notesPerBar: 1 小節あたりの音符数
 */
export function melodyMetrics(events, { beat, chords = null, strong = null } = {}) {
  const bars = splitBars(events, beat);
  const strongSteps = strong ?? (beat % 4 === 0 && beat !== 12 ? [0, beat / 2] : [0, beat / 2]);
  const notes = [];
  bars.forEach((bar, bi) => {
    for (const e of bar) {
      if (e.midi.length === 0 || e.tied) continue;
      notes.push({ bar: bi, step: e.step, len: e.len, midi: Math.max(...e.midi) });
    }
  });
  const intervals = [];
  for (let i = 1; i < notes.length; i++) intervals.push(notes[i].midi - notes[i - 1].midi);
  const nonzero = intervals.filter((d) => d !== 0);
  const leaps = intervals.filter((d) => Math.abs(d) >= 3);
  const histo = new Map();
  for (const d of intervals) histo.set(Math.abs(d), (histo.get(Math.abs(d)) ?? 0) + 1);
  const rhythm = bars.map((bar) => bar.map((e) => `${e.midi.length ? "n" : "r"}${e.len}`).join(","));
  const full = bars.map((bar) => bar.map((e) => `${e.midi.join("+")}:${e.len}`).join(","));
  let maxRepeat = 0;
  let run = 0;
  for (let i = 0; i < rhythm.length; i++) {
    run = i > 0 && rhythm[i] === rhythm[i - 1] ? run + 1 : 1;
    maxRepeat = Math.max(maxRepeat, run);
  }
  // リズムの型の種類は 8 小節の窓ごとに数えて平均する。A を繰り返す 16 小節の曲が、8 小節の曲より単調に見えないようにする
  const windows = [];
  for (let i = 0; i < rhythm.length; i += 8) {
    const w = rhythm.slice(i, i + 8);
    windows.push(new Set(w).size / w.length);
  }
  const rhythmDistinct = windows.length ? windows.reduce((a, b) => a + b, 0) / windows.length : 0;
  const seenFull = new Set();
  let novel = 0;
  for (const f of full) {
    if (!seenFull.has(f)) novel++;
    seenFull.add(f);
  }
  const holds = bars.filter((bar) => {
    const last = [...bar].reverse().find((e) => e.midi.length);
    return last && last.len >= 4;
  }).length;
  const restSteps = bars.reduce((n, bar) => n + bar.filter((e) => !e.midi.length).reduce((m, e) => m + e.len, 0), 0);
  const m = {
    bars: bars.length,
    notesPerBar: bars.length ? notes.length / bars.length : 0,
    leapRatio: intervals.length ? leaps.length / intervals.length : 0,
    stepRatio: intervals.length ? intervals.filter((d) => d !== 0 && Math.abs(d) <= 2).length / intervals.length : 0,
    intervalEntropy: entropy([...histo.values()]),
    ascendingRatio: nonzero.length ? nonzero.filter((d) => d > 0).length / nonzero.length : 0,
    range: notes.length ? Math.max(...notes.map((n) => n.midi)) - Math.min(...notes.map((n) => n.midi)) : 0,
    rhythmDistinct,
    rhythmMaxRepeat: maxRepeat,
    barNovelty: bars.length ? novel / bars.length : 0,
    holdRatio: bars.length ? holds / bars.length : 0,
    restRatio: bars.length ? restSteps / (bars.length * beat) : 0,
    arpeggioRatio: null,
    chordToneRatio: null,
    strongNonChordRatio: null,
  };
  if (chords && chords.some(Boolean)) {
    const tones = bars.map((_, bi) => (chords[bi] ? new Set(chordTones(chords[bi])) : null));
    const isTone = (n) => tones[n.bar]?.has(((n.midi % 12) + 12) % 12) ?? null;
    const judged = notes.filter((n) => isTone(n) !== null);
    m.chordToneRatio = judged.length ? judged.filter((n) => isTone(n)).length / judged.length : null;
    let arp = 0;
    let leapCount = 0;
    for (let i = 1; i < notes.length; i++) {
      const a = notes[i - 1];
      const b = notes[i];
      if (Math.abs(b.midi - a.midi) < 3 || isTone(a) === null || isTone(b) === null) continue;
      leapCount++;
      if (a.bar === b.bar && isTone(a) && isTone(b)) arp++;
    }
    m.arpeggioRatio = leapCount ? arp / leapCount : 0;
    // 強拍に鳴っている音（その拍にまたがる音も含む）
    let strongTotal = 0;
    let strongNon = 0;
    bars.forEach((bar, bi) => {
      if (!tones[bi]) return;
      for (const s of strongSteps) {
        const e = bar.find((e) => e.midi.length && e.step <= s && s < e.step + e.len);
        if (!e) continue;
        strongTotal++;
        if (!tones[bi].has(((Math.max(...e.midi) % 12) + 12) % 12)) strongNon++;
      }
    });
    m.strongNonChordRatio = strongTotal ? strongNon / strongTotal : null;
  }
  return m;
}

// ------------------------------------------------------------- ピアノロール

const TRACK_COLORS = ["#ffe066", "#7ad33a", "#4cc3e8", "#e0405a", "#a25ad6", "#f2a13b", "#3b62e0", "#d0d0dc"];

/**
 * ピアノロールの SVG。全トラックを色分けし、旋律トラックは太く描く。小節線と拍、C の行、和音記号を添える。
 * tracks は [{ name, events, melody }]。
 */
export function pianoRollSvg(tracks, { beat, bars = null, chords = null, cell = 10, rowH = 8, title = "" } = {}) {
  const all = tracks.flatMap((t) => t.events.filter((e) => e.midi.length).flatMap((e) => e.midi));
  const lo = Math.min(...all) - 2;
  const hi = Math.max(...all) + 2;
  const totalSteps = bars ? bars * beat : Math.max(...tracks.map((t) => t.events.reduce((n, e) => Math.max(n, e.step + e.len), 0)));
  const left = 44;
  const top = 34;
  const w = left + totalSteps * cell + 12;
  const h = top + (hi - lo + 1) * rowH + 40 + tracks.length * 0;
  const y = (midi) => top + (hi - midi) * rowH;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" font-family="Menlo, monospace" font-size="10">`);
  parts.push(`<rect width="${w}" height="${h}" fill="#14141c"/>`);
  if (title) parts.push(`<text x="${left}" y="14" fill="#f4f4f8" font-size="12">${title}</text>`);
  // 行（白鍵は少し明るく、C の行に音名）
  for (let midi = lo; midi <= hi; midi++) {
    const pc = ((midi % 12) + 12) % 12;
    const black = [1, 3, 6, 8, 10].includes(pc);
    parts.push(`<rect x="${left}" y="${y(midi)}" width="${totalSteps * cell}" height="${rowH}" fill="${black ? "#1a1a24" : "#20202c"}"/>`);
    if (pc === 0) parts.push(`<text x="${left - 4}" y="${y(midi) + rowH - 1}" fill="#9a9ab0" text-anchor="end">${midiToNote(midi)}</text>`);
  }
  // 拍と小節線
  for (let s = 0; s <= totalSteps; s += 4) {
    const barLine = s % beat === 0;
    parts.push(`<line x1="${left + s * cell}" y1="${top}" x2="${left + s * cell}" y2="${y(lo) + rowH}" stroke="${barLine ? "#7a7a90" : "#3a3a4c"}" stroke-width="${barLine ? 1.5 : 1}"/>`);
    if (barLine && s < totalSteps) {
      const bar = s / beat;
      const label = chords && chords[bar] ? `${bar + 1}  ${chords[bar]}` : `${bar + 1}`;
      parts.push(`<text x="${left + s * cell + 3}" y="${top - 6}" fill="#ffe066">${label}</text>`);
    }
  }
  // 音符
  tracks.forEach((t, ti) => {
    const color = TRACK_COLORS[ti % TRACK_COLORS.length];
    for (const e of t.events) {
      for (const midi of e.midi) {
        const inset = t.melody ? 0.5 : 2;
        parts.push(
          `<rect x="${left + e.step * cell + 0.5}" y="${y(midi) + inset}" width="${e.len * cell - 1}" height="${rowH - inset * 2}" fill="${color}" fill-opacity="${t.melody ? 0.95 : 0.55}" rx="1.5"/>`,
        );
      }
    }
  });
  // 凡例
  tracks.forEach((t, ti) => {
    const x = left + ti * 110;
    const yy = y(lo) + rowH + 22;
    parts.push(`<rect x="${x}" y="${yy - 9}" width="10" height="10" fill="${TRACK_COLORS[ti % TRACK_COLORS.length]}"/>`);
    parts.push(`<text x="${x + 14}" y="${yy}" fill="#c0c0d0">${t.name}${t.melody ? " (melody)" : ""}</text>`);
  });
  parts.push("</svg>");
  return parts.join("\n");
}
