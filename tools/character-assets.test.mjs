import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadCharacters, generate, gameFiles } from './character-assets.mjs';

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'swaprise-assets-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'assets/characters/nika/idle/v1');
  mkdirSync(dir, { recursive: true });
  const save = (file, data) => writeFileSync(path.join(root, file), JSON.stringify(data));
  save('assets/characters/index.json', ['nika']);
  save('assets/characters/actions.json', [{ items: [['idle', '待機']] }]);
  const c = { id: 'nika', name: 'ニカ', assets: ['idle/v1/asset.json'], adoptedAssets: { idle: 'nika-idle-v1' } };
  const a = { id: 'nika-idle-v1', action: 'idle', kind: 'animation', image: 'sheet.png', prompt: 'prompt.txt', frameCount: 1, fps: 4, loop: true, frames: [{ x: 0, y: 0, width: 2, height: 3, pivotX: 1, baselineY: 2, scale: 0.9 }] };
  save('assets/characters/nika/character.json', c); save('assets/characters/nika/idle/v1/asset.json', a);
  const png = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(png); png.writeUInt32BE(2,16); png.writeUInt32BE(3,20);
  writeFileSync(path.join(dir, 'sheet.png'), png); writeFileSync(path.join(dir, 'prompt.txt'), '制作指示');
  return { root, dir, save, c, a };
}

test('取り込んだ全ファイルの内容と画廊の生成結果が保存されている', () => {
  const root = process.cwd();
  const manifest = JSON.parse(readFileSync('assets/characters/import-manifest.json', 'utf8'));
  for (const file of manifest.files) {
    const bytes = readFileSync(file.destination);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.importedSha256, file.destination);
    if (file.destination.endsWith('.png')) assert.equal(file.sourceSha256, file.importedSha256);
  }
  const data = generate({ root, check: true });
  assert.equal(data.catalog.length, 10);
  const exports = gameFiles(root, data);
  const game = JSON.parse(exports.get(path.join(root, 'public/characters/manifest.json')));
  for (const c of data.catalog) {
    const exported = game.find(x => x.id === c.id);
    assert.deepEqual(Object.keys(exported.assets), Object.keys(c.adoptedAssets ?? {}));
    for (const [action, id] of Object.entries(c.adoptedAssets ?? {})) {
      const source = c.assets.find(a => a.id === id), target = exported.assets[action];
      assert.equal(target.id, id);
      for (const key of ['frames','fps','loop','pivotX','baselineY','scale','frameCount']) assert.deepEqual(target[key], source[key]);
      assert.equal(target.prompt, undefined); assert.equal(target.history, undefined);
    }
  }
});

test('採用を外して再生成すると古い配信画像が残らず、制作画像は保持する', t => {
  const f = fixture(t);
  generate({ root: f.root, game: true });
  const old = JSON.parse(readFileSync(path.join(f.root, 'public/characters/manifest.json')))[0].assets.idle.image;
  assert.ok(existsSync(path.join(f.root, 'public', old)));
  f.c.adoptedAssets = {}; f.save('assets/characters/nika/character.json', f.c);
  generate({ root: f.root, game: true });
  assert.ok(!existsSync(path.join(f.root, 'public', old)));
  assert.ok(existsSync(path.join(f.dir, 'sheet.png')));
});

test('採用IDが不正なら既存の配信データを消す前に失敗する', t => {
  const f = fixture(t); generate({ root: f.root, game: true });
  const file = path.join(f.root, 'public/characters/manifest.json'), before = readFileSync(file);
  f.c.adoptedAssets.idle = 'unknown'; f.save('assets/characters/nika/character.json', f.c);
  assert.throws(() => generate({ root: f.root, game: true }), /採用ID/);
  assert.deepEqual(readFileSync(file), before);
});

test('コマが画像からはみ出す設定と再生速度の欠落を検出する', t => {
  const f = fixture(t); f.a.frames[0].x = 1; f.save('assets/characters/nika/idle/v1/asset.json', f.a);
  assert.throws(() => loadCharacters(f.root), /範囲外/);
  f.a.frames[0].x = 0; delete f.a.fps; f.save('assets/characters/nika/idle/v1/asset.json', f.a);
  assert.throws(() => loadCharacters(f.root), /再生設定/);
});

test('古い画廊データと人物ディレクトリの外への参照を検出する', t => {
  const f = fixture(t); generate({ root: f.root });
  writeFileSync(path.join(f.root, 'docs/characters/gallery/catalog.js'), 'old');
  assert.throws(() => generate({ root: f.root, check: true }), /古い/);
  f.a.image = '../../../index.json'; f.save('assets/characters/nika/idle/v1/asset.json', f.a);
  assert.throws(() => loadCharacters(f.root), /外への参照/);
});
