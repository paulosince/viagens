# Viaggio — Migração Supabase → Neon, etapa 05/14

**STATUS: ACEITA — 2026-10-21.** Progresso **5/14** (9 etapas restantes).
**Escopo:** substituir login e Data API Supabase na **prévia isolada**, com persistência de sessão, logout, identidade legada, troca de contas e integração da renovação de JWT do SDK Neon. Produção e Supabase mantidos intactos.

## Comprovações e fonte técnica
1. Prévia isolada: https://paulosince.github.io/viagens/experiments/neon-pilot/app/neon-preview.html. `main-neon.js` com SDK `@neondatabase/neon-js@0.9.0-beta`, `SupabaseAuthAdapter()`, `@neondatabase/postgrest-js@0.2.0-beta`, Auth central e bancos A/B de staging. `neon-identity.mjs` resolve o UUID anterior com RLS; dados offline em banco separado, sem fallback Supabase.
2. Testes manuais relatados pelo usuário: **primeira sessão era Cíntia, segunda Paulo**. Ambos funcionaram na nova prévia, inclusive reabrir Safari, logout e novo login; correção da atribuição está no checkpoint de progresso da etapa.
3. Sintaxe, inicialização em Chrome com sessão anônima, importação real do SDK e arquivos públicos aprovados em [GitHub Actions run 39664449551](https://github.com/paulosince/viagens/actions/runs/39664449551) e [run 39664449840](https://github.com/paulosince/viagens/actions/runs/39664449840).
4. Renovação de token verificada no CI [**GitHub Actions run 39669864859**](https://github.com/paulosince/viagens/actions/runs/39669864859): **15/15 testes passaram** (3 testes da integração de refresh e 12 regressões de identidade).
   - Pacote real `@neondatabase/postgrest-js@0.2.0-beta`, incluindo `fetchWithToken`, executado contra endpoint simulado, sem tráfego ou segredo de clientes.
   - SDK Auth de teste com controle de expiração emitiu JWT A antes de expirar e JWT B após refresh. Requisições pós-expiração enviaram **somente JWT B** às duas APIs A e B, incluindo leitura da tabela pessoal roteada ao projeto B.
   - Falha deliberada de refresh retorna erro sem reutilizar JWT antigo nem acessar o banco; evento `TOKEN_REFRESHED` mantém o UUID legado; `SIGNED_OUT` torna sessão nula.
   - Biblioteca Neon Auth / `SupabaseAuthAdapter` documenta que `auth.getSession()` refresca automaticamente tokens expirados: https://neon.com/docs/reference/javascript-sdk; https://github.com/neondatabase/neon-js/blob/main/packages/auth/README.md
5. Código e workflow de regressão preservados em `experiments/neon-pilot/app/neon-refresh-integration.test.mjs` e `.github/workflows/viaggio-stage05-refresh.yml` na branch `migration/neon-app-20261019`.

## Limites rigorosos do aceite
- **O teste automatizado simulou expiração e a resposta renovada no adaptador de autenticação**, usando o transporte PostgREST real. Não é um teste cronometrado em que o JWT real de Paulo ou Cíntia expirou. A capacidade interna do SDK de renovar tokens baseia-se no contrato documentado do Neon.
- Não testamos o acesso à mídia privada com novo Auth: ela está bloqueada expressamente na prévia. Seu tratamento está contemplado na **etapa 07/14**, sem etapas extras.
- Não houve cutover: dados do Supabase, código principal `index.html/src/main.js` e branches principais Neon continuam preservados. Restam testes de regressão mais amplos de offline e recuperação de estado nas etapas previamente combinadas.
- Ambiente de teste ainda usa projetos pessoais Neon A/B staging, Auth central e arquivo isolado publicado via GitHub Pages.

**Próxima etapa da lista fixa: 06/14 — finalizar roteamento de convites, compartilhamento e revogação entre projetos.**
