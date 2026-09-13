import { t } from "./i18n";

/** レッスンの課の見出し・説明・達成の一言。id は `src/core/lessons.ts` の Lesson.id。 */
export interface LessonText {
  title: string;
  body: string;
  done: string;
}

export function lessonText(id: string, touch: boolean): LessonText {
  const swap = touch ? t("Drag a panel sideways to swap it.") : t("Arrow keys move the cursor. Z swaps.");
  switch (id) {
    case "clear":
      return {
        title: t("CLEAR 3"),
        body: `${t("Line up 3 of the same panel to clear them. Move the lone panel next to the two.")}\n${swap}`,
        done: t("You cleared 3 panels. That is the basic move."),
      };
    case "drop":
      return {
        title: t("DROP"),
        body: t("A moved panel falls into a hole. Drop the panel onto the two below it. Vertical lines clear too."),
        done: t("Dropping lets you reach panels that are far apart."),
      };
    case "chain":
      return {
        title: t("CHAIN"),
        body: t("When panels above a clear fall and line up, that is a chain. Clear the three so the panel above lands next to its pair."),
        done: t("A 2-chain. Each extra step scores more and sends more garbage."),
      };
    case "combo":
      return {
        title: t("COMBO"),
        body: t("Clearing 4 or more at once is a combo. Drop the panel into the gap. Combos and chains send garbage to the opponent."),
        done: t("A combo. Big clears send a wide block of garbage."),
      };
    case "active":
      return {
        title: t("ACTIVE CHAIN"),
        body: t("You can swap while panels are flashing. Clear the three, then quickly swap the two on the right before the panels fall."),
        done: t("That was an active chain. This is how long chains are built."),
      };
    default:
      return {
        title: t("RISING BOARD"),
        body: touch
          ? t("The board rises on its own. Make a 2-chain. Hold the bar under the board to raise it faster.")
          : t("The board rises on its own. Make a 2-chain. Hold X to raise it faster."),
        done: t("A chain on a rising board. You are ready for ENDLESS."),
      };
  }
}
