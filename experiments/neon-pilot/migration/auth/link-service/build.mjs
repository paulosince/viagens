import {build} from 'esbuild';
await build({
 entryPoints:['index.mjs'], bundle:true,platform:'node',target:'node24',format:'esm',
 outfile:'dist/index.mjs',
 banner:{js:'import { createRequire } from "node:module";const require = createRequire(import.meta.url);'}
});
