# deprecated/

Arquivos que **nenhuma página do app carrega**, movidos para cá em 15/11/2026 em vez de apagados.
A estrutura de pastas original foi preservada dentro de `deprecated/`, então cada arquivo
está em `deprecated/<caminho original>`.

Plano: se depois da viagem (18/11 a 01/12/2026) tudo continuar funcionando, esta pasta pode ser apagada.

## Como foi decidido o que mover

Um script percorreu, a partir dos pontos de entrada (`index.html`, `login.html`, `sw.js`,
`manifest.webmanifest`, `legacy-supabase.html` e `functions/`), todos os `import`, `src` e `href`
locais. O app carrega **27 arquivos de código**; os **71** que nenhum deles alcança foram movidos,
com estas exceções mantidas no lugar até decisão do responsável:

- `export.html`, `repair.html`: podem ser abertos diretamente pelo endereço;
- `oauth/`, `plugins/viaggio/`: integração com o ChatGPT;
- `legacy-supabase.html` e `src/main.js` (e o que ele importa): recuperação de dados antigos do Supabase;
- `supabase/` e o workflow `supabase-keepalive`;
- `experiments/neon-pilot/functions/appmedia` e `appusage`: código-fonte das funções Neon em uso;
- arquivos `.sql` e `.md` (documentação).

## O que está aqui

- `experiments/neon-pilot/app/`: páginas de diagnóstico e versões antigas (`backend.mjs`, `main.js`,
  `router.mjs`, `storage.mjs`, `offline-store.js`, `media-cache.js`) substituídas pelas versões `*-neon`.
- `experiments/neon-pilot/*.html`: páginas da migração Supabase → Neon, já concluída.
- `experiments/neon-pilot/functions/g3automatic`, `media-smoke`: funções de teste/migração.
- `deployment/first-party-auth/`: protótipo de login pelo mesmo endereço, substituído por `functions/api/auth`.
- `app.js`, `app-supabase.js`, `style-*.css`, `autofill-diagnostico.html`: versões antigas na raiz.
- `github-workflows/`: workflows da migração (`neon-g3-lab`, `neon-media-ci`, `neon-migrate-one`).
  Fora de `.github/workflows/` eles não rodam.

## Como voltar um arquivo

```bash
git mv deprecated/<caminho original> <caminho original>
# workflows:
git mv deprecated/github-workflows/<nome>.yml .github/workflows/<nome>.yml
```
