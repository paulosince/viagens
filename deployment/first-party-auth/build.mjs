import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const output=path.join(here,'public/viagens');
await mkdir(output,{recursive:true});
for(const entry of ['index.html','login.html','legacy-supabase.html','style.css','manifest.webmanifest','sw.js','assets','src','vendor','experiments/neon-pilot/app']) {
  await cp(path.join(root,entry),path.join(output,entry),{recursive:true});
}
// Change ONLY the built copy. GitHub Pages and the source remain unchanged.
const backend=path.join(output,'experiments/neon-pilot/app/backend-neon.mjs');
const source=await readFile(backend,'utf8');
const old="export const NEON_AUTH_URL='https://ep-small-bread-b7uq0zva.neonauth.c-13.us-east-1.aws.neon.tech/viaggio_auth/auth';";
if(!source.includes(old))throw new Error('Auth configuration changed; review before deployment.');
await writeFile(backend,source.replace(old,"export const NEON_AUTH_URL=new URL('/api/auth',location.origin).href;"));
const worker=path.join(output,'sw.js');
await writeFile(worker,(await readFile(worker,'utf8')).replace(/const CACHE_NAME = '[^']+';/,"const CACHE_NAME = 'viaggio-first-party-v1';"));
console.log('Built isolated same-origin deployment; original app files unchanged.');
