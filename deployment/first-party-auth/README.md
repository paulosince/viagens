# Viaggio: same-origin authentication deployment

> **SUSPENSO — NÃO PUBLICAR.** A auditoria de 15/11 identificou dependências não cobertas pelos testes isolados: CORS das Data APIs/Functions, cache de auth same-origin no service worker e recursos ausentes no pacote. Este diretório é somente um protótipo não implantado. Consulte [a auditoria](../../docs/ARCHITECTURE-AUDIT-2026-11-15.md). Vercel não é requisito; a infraestrutura Cloudflare existente precisa ser inspecionada antes de escolher hospedagem.


Status: implementation prepared and tested locally. NOT deployed, NOT validated on the user's iPad. The GitHub Pages app remains unchanged.

## Evidence and scope

The iPad's D2 report shows sign-in HTTP 200 followed by get-session HTTP 200 with no session. This establishes failure to recover the session, not a password rejection. Cookie blocking is consistent with the observed cross-site architecture but was not directly inspected on the iPad.

This deployment removes that cross-site dependency. It uses the official `handleAuthProxyRequest` from `@neondatabase/auth@0.7.0-beta/server`, keeping Secure, HttpOnly, host-only cookies, SameSite=Lax, signature checks and Neon upstream identity. It does not copy tokens into localStorage or disable browser protections.

Only the generated copy's auth URL and service-worker cache name change. Source app HTML, main JS, photo and ticket logic, and Neon application databases remain untouched. No users, passwords, files, or records are migrated.

## Target: existing Cloudflare Pages project

The user confirmed Pages project `viagens` at `viagens-cc8.pages.dev` in dashboard screenshots. Vercel instructions are withdrawn. `cloudflare.mjs` is a prepared Pages Functions adapter, not an automatically deployed route. Keep this prototype suspended until these dependencies are resolved:

1. Inspect the existing Pages build/output configuration through an authenticated dashboard. Do not replace it based on the historical Workers branch.
2. Bundle the official SDK and adapter into the Pages function `/api/auth/[[path]]`; verify execution in Cloudflare's runtime, not only Node tests.
3. Set exact `VIAGGIO_PUBLIC_ORIGIN` and a random server-only `NEON_AUTH_COOKIE_SECRET` of at least 32 characters in Pages bindings. Never commit a secret.
4. Preserve existing origins while authorizing the chosen origin in Neon Auth, both Data APIs and the relevant media/usage functions. Existing photograph routing must stay intact.
5. Review generated assets (including apple-touch-icon), manifest scope, `/viagens/` paths and custom-domain routing. The existing build remains an isolated prototype, not a production output definition.
6. After real authenticated session/data/media tests, switch the generated auth URL. Keep the GitHub Pages deployment, local outbox and media caches intact.

The service worker source now excludes same-origin API/auth and Authorization requests from cache. This prevents a future proxy response from being cached; it does not fix the current cross-site iPad login by itself.

## Validation before any switch

- `npm ci && npm test` in this directory.
- Verify rejected credentials (401), then a real sign-in, get-session, JWT, RLS-backed home profile and trip list.
- Verify sign-out, reload, and PWA close/reopen, especially on the affected iPad.
- Verify existing ticket image rendering, zoom, and itinerary photographs.
- Verify missing/invalid cookie cannot access session or protected data, foreign Origin is rejected, no auth response is cached, and cookie attributes are Secure + HttpOnly + SameSite=Lax, host-only, without Partitioned.
- The new host has its own browser storage; the existing offline copy and PWA stay intact. Adding a replacement PWA is a separate user action after validation.

Current routes intentionally support the app's existing password login/session/token/logout only. They do not add OAuth, password resets, admin APIs or signup capabilities.

Sources: https://github.com/neondatabase/neon-js/blob/main/packages/auth/BUILDING-AN-ADAPTER.md and the installed SDK's server exports/types.
