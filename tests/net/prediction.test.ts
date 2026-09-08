import { expect, it } from "vitest";
import { Game } from "../../src/core/game";
import { NO_INPUT } from "../../src/core/types";
import { Lockstep, initialFrames } from "../../src/net/lockstep";
import { Prediction } from "../../src/net/prediction";
import { stateHash } from "../../src/net/hash";

it("盤面の複製は乱数・攻撃待ちを保ち、元のゲームを変更しない", () => {
  const source = new Game({ mode: "versus", seed: 42 });
  for (let n = 0; n < 180; n++)
    source.tick([{ ...NO_INPUT, raise: true, swap: n % 13 === 0 }, NO_INPUT]);
  const copy = new Game({ mode: "versus", seed: 0 });
  copy.copyVersusFrom(source);
  expect(stateHash(copy)).toBe(stateHash(source));
  for (let n = 0; n < 240; n++) {
    const inputs = [
      {
        ...NO_INPUT,
        raise: true,
        moveX: n % 2 === 0 ? 1 : -1,
        swap: n % 17 === 0,
      },
      NO_INPUT,
    ] as const;
    source.tick([...inputs]);
    copy.tick([...inputs]);
    expect(stateHash(copy)).toBe(stateHash(source));
  }
  copy.boards[0].score++;
  expect(copy.boards[0].score).not.toBe(source.boards[0].score);
});

it("未確定の交換を即座に表示し、確定盤面には書き込まない", () => {
  const l = new Lockstep({ id: "m", seed: 42, delay: 12, version: "test" });
  l.game.boards[0].setColumns([
    [0, 1],
    [2, 3],
    [4, 0],
    [1, 2],
    [3, 4],
    [0, 1],
  ]);
  const prediction = new Prediction(l, 0);
  const board = prediction.game.boards[0];
  prediction.advance(12, { ...NO_INPUT, swap: true, cursorTo: { x: 0, y: 0 } });
  expect(board.cell(0, 0).state).toBe("swapping");
  expect(l.game.boards[0].cell(0, 0).state).toBe("idle");
});

it("遅れて届いた相手の操作で補正し、確定後は全状態が一致する", () => {
  const l = new Lockstep({ id: "m", seed: 42, delay: 6, version: "test" });
  const prediction = new Prediction(l, 0);
  const board = prediction.game.boards[0];
  const local = { ...NO_INPUT, swap: true, cursorTo: { x: 0, y: 0 } };
  const remote = { ...NO_INPUT, moveX: 1 as const, swap: true };
  prediction.advance(6, local);
  prediction.advance(7, NO_INPUT);
  prediction.advance(8, NO_INPUT);
  l.receive(0, [
    ...initialFrames(6),
    [local, remote],
    [NO_INPUT, NO_INPUT],
    [NO_INPUT, NO_INPUT],
  ]);
  while (l.step()) {}
  prediction.reconcile();
  expect(prediction.game.boards[0]).toBe(board);
  expect(stateHash(prediction.game)).toBe(stateHash(l.game));
  expect(prediction.game.boards.every((b) => b.events.length === 0)).toBe(true);
});

it("予測上の終了後に最後の効果音を繰り返さない", () => {
  const l = new Lockstep({ id: "m", seed: 42, delay: 6, version: "test" });
  const prediction = new Prediction(l, 0);
  prediction.game.finished = true;
  prediction.game.boards[0].gameOver = true;
  prediction.game.boards[0].events = [{ type: "gameOver" }];
  prediction.advance(6, NO_INPUT);
  expect(prediction.game.boards[0].events).toEqual([]);
});

it("相手の終了が予測だけなら、自分の操作を止めない", () => {
  const l = new Lockstep({ id: "m", seed: 42, delay: 6, version: "test" });
  const prediction = new Prediction(l, 0);
  prediction.game.boards[0].setColumns([
    [0, 1],
    [2, 3],
    [4, 0],
    [1, 2],
    [3, 4],
    [0, 1],
  ]);
  prediction.game.boards[1].gameOver = true;
  prediction.game.finished = true;
  prediction.advance(6, { ...NO_INPUT, swap: true, cursorTo: { x: 0, y: 0 } });
  expect(prediction.game.boards[0].cell(0, 0).state).toBe("swapping");
});
