import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const encode = value => JSON.stringify(value, null, 2) + '\n';
const slash = p => p.split(path.sep).join('/');
const assert = (value, message) => { if (!value) throw new Error(message); };
const identifier = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const positive = value => Number.isFinite(value) && value > 0;
const integer = value => Number.isInteger(value) && value > 0;
const finite = value => Number.isFinite(value);

function localFile(base, ref, boundary) {
  assert(typeof ref === 'string' && ref && !path.isAbsolute(ref), `相対パスが必要: ${ref}`);
  const target = realpathSync(path.resolve(base, ref));
  const relative = path.relative(realpathSync(boundary), target);
  assert(relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `素材の外への参照: ${ref}`);
  return target;
}

function validateAnimation(asset, image) {
  const bytes = readFileSync(image);
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `PNGが必要: ${asset.id}`);
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  assert(integer(asset.frameCount) && positive(asset.fps) && typeof asset.loop === 'boolean', `再生設定が不正: ${asset.id}`);
  for (const key of ['scale']) if (asset[key] !== undefined) assert(positive(asset[key]), `${key}が不正: ${asset.id}`);
  if (asset.baselineY !== undefined) assert(finite(asset.baselineY), `床位置が不正: ${asset.id}`);
  if (asset.lastHoldMs !== undefined) assert(finite(asset.lastHoldMs) && asset.lastHoldMs >= 0, `末尾待ちが不正: ${asset.id}`);
  if (asset.pivotX !== undefined) assert(Array.isArray(asset.pivotX) && asset.pivotX.length === asset.frameCount && asset.pivotX.every(finite), `基準点が不正: ${asset.id}`);
  if (asset.frames) {
    assert(Array.isArray(asset.frames) && asset.frames.length === asset.frameCount, `コマ数が不一致: ${asset.id}`);
    for (const f of asset.frames) {
      assert(Number.isInteger(f.x) && Number.isInteger(f.y) && f.x >= 0 && f.y >= 0 && integer(f.width) && integer(f.height) && f.x + f.width <= width && f.y + f.height <= height, `コマが画像の範囲外: ${asset.id}`);
      if (f.pivotX !== undefined) assert(finite(f.pivotX), `コマ基準点が不正: ${asset.id}`);
      if (f.baselineY !== undefined) assert(finite(f.baselineY), `コマ床位置が不正: ${asset.id}`);
      if (f.scale !== undefined) assert(positive(f.scale), `コマ倍率が不正: ${asset.id}`);
    }
  } else {
    assert([asset.columns, asset.rows, asset.frameWidth, asset.frameHeight].every(integer), `グリッドが不正: ${asset.id}`);
    assert(width === asset.columns * asset.frameWidth && height === asset.rows * asset.frameHeight && asset.frameCount <= asset.columns * asset.rows, `グリッドと画像が不一致: ${asset.id}`);
  }
}

export function loadCharacters(root = defaultRoot) {
  const base = path.join(root, 'assets/characters');
  const ids = json(path.join(base, 'index.json'));
  assert(Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(identifier), '人物の一覧が不正');
  const groups = json(path.join(base, 'actions.json'));
  const actions = new Set(groups.flatMap(group => group.items.map(([id]) => id)));
  const assetIds = new Set();
  const catalog = ids.map(id => {
    const directory = path.join(base, id);
    const character = json(path.join(directory, 'character.json'));
    assert(character.id === id && Array.isArray(character.assets), `人物定義が不正: ${id}`);
    const definitions = new Set();
    const assets = character.assets.map(ref => {
      const definition = localFile(directory, ref, directory);
      assert(!definitions.has(definition), `素材定義が重複: ${ref}`); definitions.add(definition);
      const asset = json(definition);
      assert(identifier(asset.id) && asset.id.startsWith(`${id}-${asset.action}-`) && !assetIds.has(asset.id), `素材IDが不正または重複: ${asset.id}`);
      assetIds.add(asset.id);
      assert(actions.has(asset.action) && ['image', 'animation'].includes(asset.kind), `素材の種類が不正: ${asset.id}`);
      const image = localFile(path.dirname(definition), asset.image, directory);
      const resolved = { ...asset, image };
      if (asset.prompt) resolved.prompt = localFile(path.dirname(definition), asset.prompt, directory);
      if (asset.history) resolved.history = asset.history.map(h => ({ ...h, url: /^https?:\/\//.test(h.url) ? h.url : localFile(path.dirname(definition), h.url, directory) }));
      if (asset.kind === 'animation') validateAnimation(asset, image);
      return resolved;
    });
    // 登録漏れのasset.jsonは、新規版が画廊に出ない原因になる。
    function scan(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const target = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(target);
        else if (entry.name === 'asset.json') assert(definitions.has(realpathSync(target)), `character.jsonに未登録: ${target}`);
      }
    }
    scan(directory);
    for (const [action, adopted] of Object.entries(character.adoptedAssets ?? {})) {
      assert(assets.some(a => a.id === adopted && a.action === action), `採用IDの参照先が不正: ${id}/${action}/${adopted}`);
    }
    return { ...character, assets };
  });
  return { groups, catalog };
}

export function galleryFiles(root, data) {
  const directory = path.join(root, 'docs/characters/gallery');
  const catalog = data.catalog.map(c => ({ ...c, assets: c.assets.map(a => ({
    ...a,
    image: slash(path.relative(directory, a.image)),
    ...(a.prompt ? { prompt: slash(path.relative(directory, a.prompt)) } : {}),
    ...(a.history ? { history: a.history.map(h => ({ ...h, url: /^https?:\/\//.test(h.url) ? h.url : slash(path.relative(directory, h.url)) })) } : {}),
  })) }));
  return new Map([
    [path.join(directory, 'catalog.js'), '// 自動生成: pnpm assets。正本は assets/characters/。\nwindow.CHARACTER_CATALOG = ' + encode(catalog).trimEnd() + ';\n'],
    [path.join(directory, 'actions.js'), '// 自動生成: pnpm assets。正本は assets/characters/actions.json。\nwindow.CHARACTER_ACTION_GROUPS = ' + encode(data.groups).trimEnd() + ';\n'],
  ]);
}

const gameKeys = ['id', 'action', 'kind', 'pixelArt', 'columns', 'rows', 'frameWidth', 'frameHeight', 'frameCount', 'fps', 'loop', 'lastHoldMs', 'pivotX', 'baselineY', 'scale', 'frames'];
export function gameFiles(root, data) {
  const files = new Map();
  const catalog = data.catalog.map(c => {
    const assets = {};
    for (const [action, id] of Object.entries(c.adoptedAssets ?? {})) {
      const a = c.assets.find(a => a.id === id);
      const bytes = readFileSync(a.image);
      const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
      const url = `characters/${c.id}/${hash}${path.extname(a.image)}`;
      files.set(path.join(root, 'public', url), bytes);
      assets[action] = { ...Object.fromEntries(gameKeys.filter(k => a[k] !== undefined).map(k => [k, a[k]])), image: url, bytes: bytes.length };
    }
    return { id: c.id, name: c.name, role: c.role, color: c.color, assets };
  });
  const manifest = encode(catalog);
  files.set(path.join(root, 'public/characters/manifest.json'), manifest);
  files.set(path.join(root, 'src/generated/characters.ts'), '// 自動生成: pnpm assets:game。\nexport const CHARACTER_ASSETS = ' + manifest.trimEnd() + ' as const;\n');
  return files;
}

export function generate({ root = defaultRoot, check = false, game = false } = {}) {
  const data = loadCharacters(root);
  const gallery = galleryFiles(root, data);
  if (check) {
    for (const [file, contents] of gallery) assert(existsSync(file) && readFileSync(file, 'utf8') === contents, `画廊の生成データが古い: ${file}（pnpm assets を実行）`);
  } else {
    // 出力前に採用素材もすべて読み、壊れた入力では既存出力を消さない。
    const exported = game ? gameFiles(root, data) : new Map();
    if (game) rmSync(path.join(root, 'public/characters'), { recursive: true, force: true });
    for (const [file, contents] of [...gallery, ...exported]) { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, contents); }
  }
  return data;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    assert(args.every(arg => ['--check', '--game'].includes(arg)) && !(args.includes('--check') && args.includes('--game')), '使用法: node tools/character-assets.mjs [--check | --game]');
    const { catalog } = generate({ check: args.includes('--check'), game: args.includes('--game') });
    console.log(`${catalog.length}人・${catalog.reduce((n, c) => n + c.assets.length, 0)}素材・採用${catalog.reduce((n, c) => n + Object.keys(c.adoptedAssets ?? {}).length, 0)}件を${args.includes('--check') ? '検証' : '出力'}しました`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
