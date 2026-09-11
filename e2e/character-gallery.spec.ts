import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('ローカル画廊で全素材の画像と再生設定を読み込める', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('docs/characters/gallery/index.html')).href);
  const catalog = JSON.parse(readFileSync('docs/characters/gallery/catalog.js', 'utf8').split('window.CHARACTER_CATALOG = ')[1].trim().slice(0, -1)) as { id: string; assets: { id: string; kind: string; frameCount?: number }[] }[];
  for (const person of catalog) {
    await page.evaluate(`selectPerson(catalog.find(p => p.id === ${JSON.stringify(person.id)}))`);
    if (!person.assets.length) await expect(page.locator('#empty')).toBeVisible();
    for (const asset of person.assets) {
      await page.evaluate(`selectAsset(person.assets.find(a => a.id === ${JSON.stringify(asset.id)}))`);
      await page.waitForFunction('ready === true');
      await expect(page.locator('#status')).not.toContainText('一致しません');
      if (asset.kind === 'animation') {
        await page.evaluate('playing = false; frame = 0; draw()');
        await expect(page.locator('#counter')).toHaveText(`1 / ${asset.frameCount}`);
        await page.locator('#next').click();
        await expect(page.locator('#counter')).toHaveText(`${asset.frameCount === 1 ? 1 : 2} / ${asset.frameCount}`);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('明示的に全素材を保存すると一覧と全画像をオフラインで取得できる', async ({ page, context }) => {
  const images: string[] = [];
  context.on('request', (r) => { if (/\/characters\/.*\.png/.test(r.url())) images.push(r.url()); });
  await page.goto('/?bgm=0');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  expect(images).toEqual([]);
  await page.waitForFunction(() => Boolean((window as any).__swapriseScenes?.menu));
  await page.evaluate(() => {
    const s = (window as any).__swapriseScenes.menu;
    s.showSettings(); s.overlay.buttons.find((b: any) => b.name === 'offline-data').emit('pointerdown');
  });
  await page.getByRole('button', { name: 'SAVE ALL CHARACTERS', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('All characters are ready offline.', { timeout: 30000 });
  await context.setOffline(true);
  const result = await page.evaluate(async () => {
    const response = await fetch('characters/manifest.json');
    const catalog = await response.json() as { assets: Record<string, { image: string }> }[];
    const urls = [...new Set(catalog.flatMap(c => Object.values(c.assets).map(a => a.image)))];
    const sizes = await Promise.all(urls.map(async url => {
      const image = new Image(); image.src = url; await image.decode();
      return image.naturalWidth * image.naturalHeight;
    }));
    return { ok: response.ok, count: urls.length, sizes };
  });
  expect(result.ok).toBe(true);
  expect(result.count).toBeGreaterThan(0);
  expect(result.sizes.every(size => size > 0)).toBe(true);
});
