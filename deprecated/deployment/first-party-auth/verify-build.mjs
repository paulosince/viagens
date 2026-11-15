import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const root=new URL('../../',import.meta.url),built=new URL('./public/viagens/',import.meta.url);
for(const path of ['login.html','index.html','style.css','src/login-neon.mjs','experiments/neon-pilot/app/main-neon.js','experiments/neon-pilot/app/photo-source-neon.mjs','experiments/neon-pilot/app/storage-neon.mjs','experiments/neon-pilot/app/ticket-image-zoom.mjs'])assert.deepEqual(await readFile(new URL(path,built)),await readFile(new URL(path,root)),path);
const backend=await readFile(new URL('experiments/neon-pilot/app/backend-neon.mjs',built),'utf8');
assert.match(backend,/new URL\('\/api\/auth',location.origin\)/);
const sw=await readFile(new URL('sw.js',built),'utf8');
for(const [,asset]of sw.matchAll(/'\.\/([^']+)'/g))await stat(new URL(asset.split('?')[0],built));
console.log('PASS: published app layout, tickets, photos and main flow are byte-identical; auth is same-origin; all precached files exist.');
