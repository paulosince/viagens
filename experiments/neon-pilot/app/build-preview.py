from pathlib import Path
root=Path(__file__).resolve().parents[3]
out=Path(__file__).resolve().parent
main=(root/'src/main.js').read_text()
main="import { createPreviewBackend } from './backend.mjs?v=20261019-1';\n"+main
old='supabase = createClient(SUPABASE_URL, SUPABASE_KEY);'
assert main.count(old)==1
main=main.replace(old,'supabase = createPreviewBackend(createClient, createClient(SUPABASE_URL, SUPABASE_KEY));')
main=main.replace('@supabase/supabase-js@2/+esm','@supabase/supabase-js@2.118.0/+esm')
main=main.replace("./itinerary-pdf.mjs?v=20260927-56","../../../src/itinerary-pdf.mjs?v=20260927-56")
(out/'main.js').write_text(main)
for name,old,new in [('offline-store.js','viaggio-local','viaggio-neon-preview-v1'),('media-cache.js','viaggio-media-v1','viaggio-neon-preview-media-v1')]:
 text=(root/'src'/name).read_text();assert old in text
 (out/name).write_text(text.replace(old,new))
html=(root/'index.html').read_text().replace('<head>','<head>\n  <base href="../../../">')
html=html.replace('src="src/main.js?v=20261018-64"','src="experiments/neon-pilot/app/main.js?v=20261019-1"')
html=html.replace('  <script type="module" src="src/update-manager.js?v=20261018-63"></script>','')
html=html.replace('<body', '<body',1)
html=html.replace('<main', '<aside style="position:relative;z-index:9999;padding:12px;background:#fff3cf;color:#3b2e13;text-align:center">Prévia Neon — alterações ficam nesta versão de teste. Login e leitura de fotos ainda usam o serviço anterior; uploads estão indisponíveis.</aside>\n  <main',1)
html=html.replace('<title>Viaggio</title>','<title>Viaggio · Prévia Neon</title>')
(out/'index.html').write_text(html)
