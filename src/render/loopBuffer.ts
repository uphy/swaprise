/**
 * 音声ファイルの曲を区間で繰り返すときの継ぎ目の計算。Web Audio に依存しないので単体テストできる。
 */

/**
 * 区間 [loopStart, loopEnd) を繰り返す素材の継ぎ目を準備する。
 * 区間の終わり fade 秒を「区間の直前 fade 秒の音」と等パワーで溶かし、飛び先（loopStart）へ元の曲と同じ入り方でつなぐ。
 * 継ぎ目の瞬間にクリックも出ない。channel は書き換える。loopStart の前に fade 秒ぶんの音がなければ何もしない。
 * @returns 溶かしたら true
 */
export function bakeLoopCrossfade(channel: Float32Array, sampleRate: number, loopStart: number, loopEnd: number, fade = 0.06): boolean {
  const n = Math.round(fade * sampleRate);
  const s = Math.round(loopStart * sampleRate);
  const e = Math.round(loopEnd * sampleRate);
  if (n <= 0 || s - n < 0 || e > channel.length || e - n < s) return false;
  for (let i = 0; i < n; i++) {
    const w = (i / n) * (Math.PI / 2);
    channel[e - n + i] = channel[e - n + i] * Math.cos(w) + channel[s - n + i] * Math.sin(w);
  }
  return true;
}

/**
 * 頭から elapsed 秒鳴らしたときの、素材の中の位置。loopEnd に達したら loopStart へ戻って繰り返す。
 */
export function loopPosition(elapsed: number, loopStart: number, loopEnd: number): number {
  if (elapsed < loopEnd) return Math.max(0, elapsed);
  const len = loopEnd - loopStart;
  return loopStart + ((elapsed - loopStart) % len);
}
