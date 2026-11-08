import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const dev = argv.includes('--dev');
const outIdx = argv.indexOf('--out');
const outFile = resolve(root, outIdx >= 0 ? argv[outIdx + 1] : 'dist/index.html');
const entryIdx = argv.indexOf('--entry');
const entry = resolve(root, entryIdx >= 0 ? argv[entryIdx + 1] : 'src/main.js');

const result = await build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  target: ['chrome100'],
  write: false,
  minify: !dev,
  legalComments: 'none',
  logLevel: 'warning',
});

const code = result.outputFiles[0].text;
const tpl = readFileSync(resolve(root, 'index.template.html'), 'utf8');
const html = tpl.replace('/*__APP__*/', () => code);
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, html);
console.log(outFile + '  ' + (html.length / 1024).toFixed(0) + ' KB' + (dev ? ' (dev)' : ' (min)'));