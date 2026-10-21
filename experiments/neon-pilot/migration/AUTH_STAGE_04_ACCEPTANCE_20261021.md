# Viaggio — migração Supabase → Neon — Etapa 04/14

**STATUS: CONCLUÍDA — 2026-10-21 (Brasil).**
**Escopo aceito:** duas sessões reais Neon Auth central, JWTs reais aceitos nas Data APIs A/B, autorização RLS de leitura isolada por usuário, negação de requisições anônimas e assinaturas inválidas. Não inclui integração do novo cliente Auth ao aplicativo PWA, que permanece na **etapa 05/14** da lista fixa.

## Evidências de aceitação

1. **Paulo / projeto pessoal B:** captura enviada após OTP Neon exibiu "APROVADO — JWT real aceito e permissões conferidas", 11/11. Projeto A: 1 viagem compartilhada, 0 perfis pessoais; B: 0 viagens, 1 perfil pessoal. Home B.
2. **Cíntia / projeto pessoal A:** captura enviada após OTP Neon exibiu "APROVADO — JWT real aceito e permissões conferidas", 11/11. Projeto A: 4 viagens próprias, 1 perfil pessoal; B: 0 viagens, 0 perfis pessoais. Home A.
3. Em ambas as capturas: "Testes de acesso anônimo e token falso — Aprovados", emissor "Neon Auth central". A página `auth-neon-smoke-v2.html` enviou o mesmo JWT obtido após OTP às duas APIs de staging.
4. Diretório de Auth central consultado ao vivo, sem exibir dados identificadores: **2 usuários, 2 com emailVerified=true**. `neon_auth.session` ligado aos usuários verificados: **7 sessões registradas, 7 não expiradas, presentes para ambas as duas identidades** no instante da consulta. Esses dados corroboram a existência de sessões reais, mas não identificam quais sessões geraram as capturas individualmente; a prova dos direitos de acesso é a resposta do teste no browser.
5. Regra PostgreSQL RLS foi também inspecionada nos testes anteriores com JWT claims simuladas. O teste desta fase foi diferente: **JWT realmente emitido pelo Neon Auth** após OTP, enviado às duas Data APIs.
6. Código de diagnóstico corrigido após falha inicial `a_PROFILES_QUERY_FAILED_HTTP_400` porque `passenger_profiles` usa PK `user_id`, não `id`; a tela v2 e `federation-live.mjs` usam `select=user_id`. A mudança encontra-se versionada em `main` e na branch de migração. O primeiro teste de Paulo falhou; somente a execução corrigida (11/11) foi aceita.
7. Testes automatizados do smoke, rejeição de JWT falso/anônimo, preflight/CORS e HTTP 200 da página e módulo registrados no [GitHub Actions run 39655619779](https://github.com/paulosince/viagens/actions/runs/39655619779). Foi documentado desvio de CORS de Data API (cabeçalho `Access-Control-Allow-Origin: *` apesar da configuração declarada da origem); confiar na verificação JWT e RLS, não em CORS, para autorização.

## Fronteira importante: sessões no aplicativo

- **Testado nesta etapa:** login por OTP Neon, criação de sessões não expiradas observáveis no banco, emissão e uso de JWT real e RLS nas duas APIs. O viés de dados/claims sintéticos foi eliminado no teste positivo.
- **Ainda NÃO testado e NÃO deve ser descrito como aprovado:** persistência da sessão do cliente Neon em PWA após reinício, refresh automático de credenciais expiradas, logout e limpeza de cache local, sincronização entre abas e mudança de usuário no mesmo dispositivo. A página de diagnóstico usou uma credencial de vida curta sem persisti-la.
- Esses fluxos pertencem à **etapa 05/14**, já existente ("substituir login e cliente Supabase pelo Neon na prévia"), e serão critério obrigatório dessa integração, além de regressão geral do aplicativo nas etapas seguintes. Não acrescentar etapas, não considerar cutover autorizado.
- Não houve alterações nas viagens, no Supabase nem no app de produção. As Data APIs usadas na prova foram A/B nas branches de staging, não nos bancos principais.

**Progresso atualizado: 4/14 etapas concluídas; 10 restantes.**
**Próxima etapa: 05/14 — substituir o login e o cliente Supabase pelo Neon na prévia, com sessões persistentes, refresh e logout comprovados.**
