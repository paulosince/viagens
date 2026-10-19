import { build } from 'esbuild';
await build({ entryPoints:['index.mjs'],bundle:true,platform:'node',target:'node24',format:'esm',
  define:{'process.env.VIAGGIO_MEDIA_PROJECT':JSON.stringify(process.env.VIAGGIO_MEDIA_PROJECT||'a')},
  outfile:'dist/index.mjs',banner:{js:'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);'} });
