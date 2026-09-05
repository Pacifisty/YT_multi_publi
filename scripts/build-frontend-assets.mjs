import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';
import sharp from 'sharp';

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const publicRoot = join(repositoryRoot, 'apps', 'api', 'src', 'frontend', 'public');
const sourceAssetsRoot = join(publicRoot, 'assets');
const outputRoot = join(publicRoot, 'generated');
const outputAssetsRoot = join(sourceAssetsRoot, 'optimized');

const textAssets = [
  { source: 'app.js', output: 'app.min.js', loader: 'js' },
  { source: 'i18n.js', output: 'i18n.min.js', loader: 'js' },
  { source: 'app.css', output: 'app.min.css', loader: 'css' },
];

const imageAssets = [
  { source: 'UNI.png', output: 'UNI.webp', width: 1672, quality: 82 },
  { source: 'PLANETA.png', output: 'PLANETA.webp', width: 1254, quality: 88 },
  { source: 'SAT.png', output: 'SAT.webp', width: 1200, quality: 86 },
  { source: 'SOL.png', output: 'SOL.webp', width: 900, quality: 88 },
  { source: 'LUA.png', output: 'LUA.webp', width: 700, quality: 88 },
  { source: 'PMP.png', output: 'PMP.webp', width: 640, quality: 90 },
  { source: 'PMP-logo.png', output: 'PMP-logo.webp', width: 640, quality: 90 },
  { source: 'PMP-tagline.png', output: 'PMP-tagline.webp', width: 1086, quality: 90 },
];

await Promise.all([
  mkdir(outputRoot, { recursive: true }),
  mkdir(outputAssetsRoot, { recursive: true }),
]);

const results = [];

for (const asset of textAssets) {
  const sourcePath = join(publicRoot, asset.source);
  const outputPath = join(outputRoot, asset.output);
  const source = await readFile(sourcePath, 'utf8');
  const minified = await transform(source, {
    loader: asset.loader,
    minify: true,
    target: asset.loader === 'css' ? undefined : 'es2022',
    legalComments: 'none',
  });
  await writeFile(outputPath, minified.code);
  const [before, after] = await Promise.all([stat(sourcePath), stat(outputPath)]);
  results.push({ name: asset.output, before: before.size, after: after.size });
}

for (const asset of imageAssets) {
  const sourcePath = join(sourceAssetsRoot, asset.source);
  const outputPath = join(outputAssetsRoot, asset.output);
  await sharp(sourcePath)
    .rotate()
    .resize({ width: asset.width, withoutEnlargement: true })
    .webp({
      quality: asset.quality,
      alphaQuality: 95,
      effort: 6,
      smartSubsample: true,
    })
    .toFile(outputPath);
  const [before, after] = await Promise.all([stat(sourcePath), stat(outputPath)]);
  results.push({ name: `assets/${asset.output}`, before: before.size, after: after.size });
}

const totals = results.reduce(
  (sum, result) => ({ before: sum.before + result.before, after: sum.after + result.after }),
  { before: 0, after: 0 },
);

for (const result of results) {
  const saving = Math.round((1 - result.after / result.before) * 100);
  console.log(`${result.name}: ${Math.round(result.before / 1024)} KB -> ${Math.round(result.after / 1024)} KB (-${saving}%)`);
}

console.log(
  `Frontend total: ${(totals.before / 1024 / 1024).toFixed(2)} MB -> ${(totals.after / 1024 / 1024).toFixed(2)} MB (-${Math.round((1 - totals.after / totals.before) * 100)}%)`,
);
