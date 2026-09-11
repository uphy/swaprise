import { expect, test, type Page } from "@playwright/test";

const SHOT = "e2e/__screenshots__";
const IDLE = { moveX: 0, moveY: 0, swap: false, raise: false };

/** メニューの人物選びの状態。 */
async function pickerState(page: Page): Promise<{ open: boolean; p1: string; p2: string; slot: number; names: string[] }> {
  return page.evaluate(() => {
    const m = (window as any).__swapriseScenes.menu;
    const cp = m.charPicker;
    const name = (n: string): string => cp?.panel.getByName(n)?.text ?? "";
    return { open: Boolean(cp), p1: cp?.state.sel.p1 ?? "", p2: cp?.state.sel.p2 ?? "", slot: cp?.state.slot ?? -1, names: [name("char-name-1"), name("char-name-2")] };
  });
}

async function characters(page: Page): Promise<{ id: string; action: string; fallback: boolean }[]> {
  return page.evaluate(() => (window as any).__swaprise.scene.characters.map((c: any) => ({ id: c.character.id, action: c.action, fallback: c.fallback })));
}

async function press(page: Page, ...keys: string[]): Promise<void> {
  for (const key of keys) {
    await page.keyboard.press(key);
    await page.waitForTimeout(120);
  }
}

test("VS CPU: 難易度のあとに人物を選び、選択が保存されて対戦に引き継がれる", async ({ page }) => {
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu?.charPicker === null));
  // VS CPU ▸ NORMAL
  await press(page, "ArrowDown", "Enter", "ArrowDown", "Enter");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu.charPicker));
  let st = await pickerState(page);
  expect(st.open).toBe(true);
  expect(st.slot).toBe(0);
  // 既定は素材のある先頭2人（ニカとミト）
  expect(st.names).toEqual(["ニカ", "ミト"]);
  // → で1Pをミトへ、↓でCPU側へ移り←でニカへ
  await press(page, "ArrowRight");
  st = await pickerState(page);
  expect(st.p1).toBe("mito");
  expect(st.names[0]).toBe("ミト");
  await press(page, "ArrowDown", "ArrowLeft");
  st = await pickerState(page);
  expect(st.slot).toBe(1);
  expect(st.p2).toBe("nika");
  await page.screenshot({ path: `${SHOT}/character-picker.png` });
  // PLAY
  await press(page, "Enter");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("swaprise.characters.v1") ?? "{}"))).toEqual({ p1: "mito", p2: "nika" });
  const chars = await characters(page);
  expect(chars.map((c) => c.id)).toEqual(["mito", "nika"]);
  // 採用された待機画像で表示する
  expect(chars.every((c) => !c.fallback)).toBe(true);
  expect(await page.evaluate(() => (window as any).__swaprise.game.cpu?.level)).toBe("normal");

  // R でやり直しても同じ組み合わせ
  await page.keyboard.press("r");
  await page.waitForFunction(() => (window as any).__swaprise.game.boards[0].frame === 0);
  expect((await characters(page)).map((c) => c.id)).toEqual(["mito", "nika"]);

  // メニューに戻って開き直すと前回の選択から始まる
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu?.scene.isActive()));
  await press(page, "Enter", "Enter");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu.charPicker));
  st = await pickerState(page);
  expect([st.p1, st.p2]).toEqual(["mito", "nika"]);
  // Esc で閉じてもメニューに残る
  await press(page, "Escape");
  expect((await pickerState(page)).open).toBe(false);
});

test("2 PLAYERS: 同じ人物を選べる", async ({ page }) => {
  await page.goto("/?bgm=0");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await press(page, "ArrowDown", "ArrowDown", "Enter");
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu.charPicker));
  // 2Pをミトから1つ前のニカへ
  const before = await pickerState(page);
  expect(before.names).toEqual(["ニカ", "ミト"]);
  await press(page, "ArrowDown");
  await press(page, "ArrowLeft");
  const st = await pickerState(page);
  expect([st.p1, st.p2]).toEqual(["nika", "nika"]);
  await press(page, "Enter");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  expect((await characters(page)).map((c) => c.id)).toEqual(["nika", "nika"]);
  expect(await page.evaluate(() => (window as any).__swaprise.game.boards.length)).toBe(2);
});

test("対戦中の反応: 連鎖で成功、おじゃま着地で着地、危険でピンチ。結果は勝利・敗北で最後の姿勢を保つ", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?mode=versus&p1=pirika&p2=nika&seed=5&speed=1&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.waitForFunction(() => {
    const s = (window as any).__swaprise.scene;
    return s.characters.every((c: any) => ["idle", "danger", "success", "garbage-land", "victory", "defeat", "finish"].every((action) => {
      const a = c.character.assets[action];
      return !a || s.textures.exists(`char:${a.id}`);
    }));
  });
  expect((await characters(page)).map((c) => [c.id, c.action])).toEqual([
    ["pirika", "idle"],
    ["nika", "idle"],
  ]);
  // 描画ループを止め、決定論的に進める
  await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
  const quiet = [[0, 1], [2, 3], [4, 0], [1, 2], [3, 4], [0, 1]];
  // 1P: 下の段に同じ柄を 4 枚並べて同時消しを起こす
  await page.evaluate((q) => {
    const p = (window as any).__swaprise;
    p.game.boards[0].setColumns([[0, 1], [0, 2], [0, 1], [0, 2], [3, 4], [1, 3]]);
    p.game.boards[1].setColumns(q);
    for (let i = 0; i < 5; i++) p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }, { moveX: 0, moveY: 0, swap: false, raise: false }]);
  }, quiet);
  let chars = await characters(page);
  expect(chars[0].action).toBe("success");
  expect(chars[1].action).toBe("idle");

  // 2P へおじゃまを落として着地
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    p.game.boards[1].receiveGarbage([{ width: 6, height: 1, type: "normal" }]);
    for (let i = 0; i < 240 && !p.game.boards[1].events.some((e: any) => e.type === "garbageLand"); i++) {
      p.tick([{ moveX: 0, moveY: 0, swap: false, raise: false }, { moveX: 0, moveY: 0, swap: false, raise: false }]);
    }
  });
  chars = await characters(page);
  expect(chars[1].action).toBe("garbage-land");
  expect(chars[1].fallback).toBe(false);

  // 1P の盤面を危険な高さまで積む。短い反応が終わるとピンチへ
  await page.evaluate(() => (window as any).__swaprise.scene.scene.resume());
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const col: number[] = [];
    for (let r = 0; r < 9; r++) col.push(r % 2);
    p.game.boards[0].setColumns([col, [0, 1], [2, 3], [4, 0], [1, 2], [3, 4]]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.scene.characters[0].action === "danger");
  // 2P の着地（6 コマ / 12fps = 0.5 秒）が終わると待機へ戻る
  await page.waitForFunction(() => (window as any).__swaprise.scene.characters[1].action === "idle");
  expect((await characters(page))[0].action).toBe("danger");
  await page.screenshot({ path: `${SHOT}/character-danger.png` });

  // 2P を天井まで積んで 1P の勝ち
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const col: number[] = [];
    for (let r = 0; r < 12; r++) col.push(r % 2);
    p.game.boards[1].setColumns([col]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.game.finished);
  await page.waitForTimeout(200);
  expect((await characters(page)).map((c) => c.action)).toEqual(["victory", "defeat"]);
  // 結果のあとは反応を受け付けない
  await page.evaluate(() => (window as any).__swaprise.scene.characters[0].react("garbage-land"));
  expect((await characters(page))[0].action).toBe("victory");
  // 勝利の動作が終わっても（ピリカ 15 コマ / 8fps ≈ 1.9 秒）最後の姿勢のまま
  await page.waitForTimeout(2200);
  expect((await characters(page)).map((c) => c.action)).toEqual(["victory", "defeat"]);
  await page.screenshot({ path: `${SHOT}/character-result.png` });
  // 結果表示中でも RETRY はすぐ効く（アニメーションの終了を待たない）
  await page.keyboard.press("r");
  await page.waitForFunction(() => !(window as any).__swaprise.game.finished);
  expect((await characters(page)).map((c) => c.action)).toEqual(["idle", "idle"]);
  expect(errors.filter((e) => !e.includes("drawImage"))).toEqual([]);
});

test("引き分けは DRAW と通常終了の動作", async ({ page }) => {
  await page.goto("/?mode=versus&p1=pirika&p2=pirika&seed=5&bgm=0&countdown=0");
  await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
  await page.evaluate(() => {
    const p = (window as any).__swaprise;
    const col: number[] = [];
    for (let r = 0; r < 12; r++) col.push(r % 2);
    p.game.boards[0].setColumns([col]);
    p.game.boards[1].setColumns([col]);
  });
  await page.waitForFunction(() => (window as any).__swaprise.game.finished);
  expect(await page.evaluate(() => (window as any).__swaprise.game.winner)).toBe(-1);
  expect((await characters(page)).map((c) => c.action)).toEqual(["finish", "finish"]);
});

test("人物を替えても同じ seed と入力列なら盤面と得点は同じ", async ({ page }) => {
  const run = async (p1: string, p2: string): Promise<unknown> => {
    await page.goto(`/?mode=cpu&cpu=hard&p1=${p1}&p2=${p2}&seed=11&speed=20&bgm=0&countdown=0`);
    await page.waitForFunction(() => Boolean((window as any).__swaprise?.game));
    await page.evaluate(() => (window as any).__swaprise.scene.scene.pause());
    return page.evaluate((idle) => {
      const p = (window as any).__swaprise;
      for (let i = 0; i < 1800; i++) p.tick([idle]);
      return p.game.boards.map((b: any) => [b.score, b.panelsCleared, b.cells.map((r: any[]) => r.map((c) => c.kind).join("")).join("/")]);
    }, IDLE);
  };
  const a = await run("nika", "pirika");
  const b = await run("baro", "nui");
  expect(b).toEqual(a);
  expect((a as [number, number, string][])[1][1]).toBeGreaterThan(0);
});


test.describe("立ち絵の読み込み", () => {
  test.use({ serviceWorkers: "block" });
  test("低速回線でも待機を優先し、反応の読み込み中は名前札に戻らない", async ({ page }) => {
    let releaseIdle!: () => void;
    let releaseRest!: () => void;
    const idleGate = new Promise<void>((r) => { releaseIdle = r; });
    const restGate = new Promise<void>((r) => { releaseRest = r; });
    const idleUrls = new Set<string>();
    const requests: string[] = [];
    await page.route(/\/characters\/.*\.(png|webp)$/, async (route) => {
      requests.push(route.request().url());
      await idleGate;
      if (!idleUrls.has(route.request().url())) await restGate;
      await route.continue();
    });
    try {
      await page.goto("/?mode=versus&p1=nika&p2=pirika&bgm=0&countdown=0");
      await page.waitForFunction(() => (window as any).__swaprise?.scene.characters.length === 2);
      const initial = await page.evaluate(() => {
        const s = (window as any).__swaprise.scene;
        s.paused = true;
        return s.characters.map((c: any) => ({
          idle: new URL(c.character.assets.idle.image, location.href).href,
          card: c.card.visible, caption: c.caption.text,
        }));
      });
      for (const c of initial) {
        idleUrls.add(c.idle);
        expect(c.card).toBe(false);
        expect(c.caption).toBe("");
      }
      expect(requests.every((url) => idleUrls.has(url))).toBe(true);
      releaseIdle();
      await page.waitForFunction(() => (window as any).__swaprise.scene.characters.every((c: any) => c.image.visible && !c.fallback));
      const fallback = await page.evaluate(() => (window as any).__swaprise.scene.characters.map((c: any) => {
        c.update(200);
        const frame = c.playing.frame;
        c.react("success");
        return { action: c.action, card: c.card.visible, key: c.image.texture.key, expected: `char:${c.character.assets.idle.id}`, frame: c.playing.frame, previous: frame };
      }));
      for (const c of fallback) {
        expect(c.action).toBe("success");
        expect(c.card).toBe(false);
        expect(c.key).toBe(c.expected);
        expect(c.frame).toBe(c.previous);
      }
      // 短い反応が終わった後に届いても、過去の成功動作を再生しない。
      await page.evaluate(() => (window as any).__swaprise.scene.characters.forEach((c: any) => {
        for (let i = 0; i < 4; i++) c.update(200);
      }));
      releaseRest();
      await page.waitForFunction(() => (window as any).__swaprise.scene.characters.every((c: any) => c.scene.textures.exists(`char:${c.character.assets.success.id}`)));
      expect((await characters(page)).map((c) => c.action)).toEqual(["idle", "idle"]);
    } finally {
      releaseIdle();
      releaseRest();
    }
  });
  test("人物選択は画像の読み込み中に代替の名前札を表示しない", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route(/\.(png|webp)(\?.*)?$/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.addInitScript(() => localStorage.setItem("swaprise.characters.v1", JSON.stringify({ p1: "nika", p2: "pirika" })));
    await page.goto("/?bgm=0");
    await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
    await press(page, "ArrowDown", "ArrowDown", "Enter");
    await page.waitForFunction(() => Boolean((window as any).__swapriseScenes.menu.charPicker));
    try {
      const state = await page.evaluate(() => (window as any).__swapriseScenes.menu.charPicker.views.map((v: any) => ({ image: v.image.visible, card: v.card.visible })));
      expect(state).toEqual([{ image: false, card: false }, { image: false, card: false }]);
      expect((await pickerState(page)).names).toEqual(["ニカ", "ピリカ"]);
    } finally {
      release();
    }
    await page.waitForFunction(() => (window as any).__swapriseScenes.menu.charPicker.views.every((v: any) => v.image.visible && !v.card.visible));
  });
});

for (const [p1, p2] of [["nika", "mito"], ["sena", "rocca"], ["yuno", "baro"], ["pirika", "nui"], ["ordo", "izel"]]) {
  test(`採用素材を実際に読み込んで表示する: ${p1} / ${p2}`, async ({ page }) => {
    const failures: string[] = [];
    page.on("pageerror", (e) => failures.push(e.message));
    page.on("response", (r) => { if (r.url().includes("/characters/") && !r.ok()) failures.push(`${r.status()} ${r.url()}`); });
    await page.goto(`/?mode=versus&p1=${p1}&p2=${p2}&seed=5&speed=1&bgm=0&countdown=0`);
    await page.waitForFunction(() => {
      const cs = (window as any).__swaprise?.scene.characters;
      return cs?.length === 2 && cs.every((c: any) => !c.fallback && c.image.visible && c.image.texture.key.startsWith("char:"));
    });
    // 試合と人物だけ止め、段階的な素材ロードは動かしておく。
    await page.evaluate(() => { (window as any).__swaprise.scene.paused = true; });
    for (const action of ["idle", "danger", "success", "garbage-land", "victory", "defeat", "finish"]) {
      await page.waitForFunction((a) => (window as any).__swaprise.scene.characters.every((c: any) => {
        const asset = c.character.assets[a];
        return !asset || c.scene.textures.exists(`char:${asset.id}`);
      }), action);
      const states = await page.evaluate((a) => (window as any).__swaprise.scene.characters.map((c: any) => {
        c.restart(a);
        const image = c.image;
        return { visible: image.visible, key: image.texture.key, width: image.frame.width, height: image.frame.height };
      }), action);
      expect(states.every((s: any) => s.visible && s.key.startsWith("char:") && s.width > 0 && s.height > 0)).toBe(true);
      const outside = await page.evaluate(() => {
        const p = (window as any).__swaprise;
        const failures: string[] = [];
        for (const c of p.scene.characters) {
          const playing = c.playing;
          for (let i = 0; i < (playing.asset?.frameCount ?? 1); i++) {
            playing.frame = i;
            c.layout();
            const r = c.image.getBounds();
            if (r.left < 0 || r.right > p.layout.width || r.top < 0 || r.bottom > p.layout.height) {
              failures.push(`${c.character.id} ${playing.action} frame ${i}: ${JSON.stringify(r)}`);
            }
          }
        }
        return failures;
      });
      expect(outside).toEqual([]);
    }
    await page.setViewportSize({ width: 412, height: 839 });
    await page.waitForFunction(() => (window as any).__swaprise.layout.portrait);
    const mobileOutside = await page.evaluate(() => {
      const p = (window as any).__swaprise;
      const failures: string[] = [];
      for (const c of p.scene.characters) {
        for (const action of ["idle", "danger", "success", "garbage-land", "victory", "defeat", "finish"]) {
          c.restart(action);
          for (let i = 0; i < (c.playing.asset?.frameCount ?? 1); i++) {
            c.playing.frame = i;
            c.layout();
            const r = c.image.getBounds();
            if (r.left < 0 || r.right > p.layout.width || r.top < 0 || r.bottom > p.layout.height) {
              failures.push(`${c.character.id} ${action} frame ${i}: ${JSON.stringify(r)}`);
            }
          }
        }
        c.restart("idle");
      }
      return failures;
    });
    expect(mobileOutside).toEqual([]);
    await page.screenshot({ path: `${SHOT}/characters-${p1}-${p2}.png` });
    expect(failures).toEqual([]);
  });
}
