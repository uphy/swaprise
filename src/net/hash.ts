import type { Game } from "../core/game";
/** 通信破損・実装差の検出用。認証や不正対策用のハッシュではない。 */
export function stateHash(game: Game): string {
  const text = JSON.stringify([
    game.boards.map((b) => b.syncState()),
    game.finished,
    game.winner,
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
