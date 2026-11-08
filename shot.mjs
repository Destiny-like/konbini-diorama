// node shot.mjs <out.png> [query] [page]
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const out = process.argv[2] || 'out/shot.png';
const query = process.argv[3] || '';
const page = process.argv[4] || 'dist/index.html';
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const file = resolve(page).replace(/\\/g, '/');
const url = 'file:///' + file + query;
mkdirSync(dirname(resolve(out)), { recursive: true });
const args = [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  '--disable-lcd-text',
  '--window-size=1600,900',
  '--virtual-time-budget=9000',
  '--screenshot=' + resolve(out).replace(/\\/g, '/'),
  url,
];
const r = spawnSync(chrome, args, { stdio: 'ignore' });
console.log('shot ->', out, 'exit', r.status);