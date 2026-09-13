import type { Technique } from "../core";
import { t } from "./i18n";

/**
 * パズルのヒントの 1 段目。次の手で起きることを技法（`src/core/puzzle.ts` の Technique）から文にする。
 * どのマスかは言わない。それは 2 段目で盤面に目印を出す。
 */
export function hintSentence(techniques: Set<Technique>): string {
  if (techniques.has("N")) return t("The next move clears nothing. It sets up the move after it.");
  const parts: string[] = [];
  const h = techniques.has("H");
  const v = techniques.has("V");
  parts.push(h && v ? t("match a row and a column") : v ? t("match a column") : t("match a row"));
  if (techniques.has("F")) parts.push(t("it lines up only after the panel drops"));
  if (techniques.has("D")) parts.push(t("two groups clear at once"));
  if (techniques.has("C")) parts.push(t("the panels that fall make a chain"));
  return t("Next move: {parts}.", { parts: parts.join(t(", ")) });
}

/** 残りの手数では全消しできない盤面のときの案内。 */
export function noHintSentence(): string {
  return t("It cannot be cleared in the moves left. Undo a move.");
}
