# Viaggio: same-origin authentication deployment

> **SUSPENSO — NÃO PUBLICAR.** A auditoria de 15/11 identificou dependências não cobertas pelos testes isolados: CORS das Data APIs/Functions, cache de auth same-origin no service worker e recursos ausentes no pacote. Este diretório é somente um protótipo não implantado. Consulte [a auditoria](../../docs/ARCHITECTURE-AUDIT-2026-11-15.md). Vercel não é requisito; a infraestrutura Cloudflare existente precisa ser inspecionada antes de escolher hospedagem.


Status: implementation prepared and tested locally. NOT deployed, NOT validated on the user's iPad. The GitHub Pages app remains unchanged.

## Evidence and scope

The iPad's D2 report shows sign-in HTTP 200 followed by get-session HTTP 200 with no session. This establishes failure to recover the session, not a password rejection. Cookie blocking is consistent with the observed cross-site architecture but was not directly inspected on the iPad.

This deployment removes that cross-site dependency. It uses the official `handleAuthProxyRequest` from `@neondatabase/auth@0.7.0-beta/server`, keeping Secure, HttpOnly, host-only cookies, SameSite=Lax, signature checks and Neon upstream identity. It does not copy tokens into localStorage or disable browser protections.

Only the generated copy's auth URL and service-worker cache name change. Source app HTML, main JS, photo and ticket logic, and Neon application databases remain untouched. No users, passwords, files, or records are migrated.

## Deploy alongside the existing app

1. Connect the user's Vercel account and import paulosince/viagens as a separate project.
2. Use root directory `deployment/first-party-auth`, framework Other, Node 24, build `npm run build`, output `public`. Enable inclusion of source files outside the root directory so the build can copy the existing app.
3. Assign its stable HTTPS hostname. Set server environment `VIAGGIO_PUBLIC_ORIGIN` to that exact origin (no path or trailing slash).
4. Generate a random `NEON_AUTH_COOKIE_SECRET` of at least 32 characters and set it only as a secret server environment variable. Never commit or print it.
5. Register the exact HTTPS origin as a trusted origin on Neon project `dark-union-03886858`, branch `br-square-river-b765bpl4`, preserving all existing origins.
6. Deploy. No redirects or changes to the existing GitHub Pages deployment until authenticated tests pass and the owner chooses to switch.

## Validation before any switch

- `npm ci && npm test` in this directory.
- Verify rejected credentials (401), then a real sign-in, get-session, JWT, RLS-backed home profile and trip list.
- Verify sign-out, reload, and PWA close/reopen, especially on the affected iPad.
- Verify existing ticket image rendering, zoom, and itinerary photographs.
- Verify missing/invalid cookie cannot access session or protected data, foreign Origin is rejected, no auth response is cached, and cookie attributes are Secure + HttpOnly + SameSite=Lax, host-only, without Partitioned.
- The new host has its own browser storage; the existing offline copy and PWA stay intact. Adding a replacement PWA is a separate user action after validation.

Current routes intentionally support the app's existing password login/session/token/logout only. They do not add OAuth, password resets, admin APIs or signup capabilities.

Sources: https://github.com/neondatabase/neon-js/blob/main/packages/auth/BUILDING-AN-ADAPTER.md and the installed SDK's server exports/types.
