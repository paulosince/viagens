# Viaggio — Supabase → Neon — Etapa 05/14

**STATUS 2026-10-21: IMPLEMENTAÇÃO PUBLICADA EM PRÉVIA ISOLADA; ACEITE REAL PENDENTE.**
Progresso fixo **4/14**, dez itens restantes incluindo esta etapa. Não criar etapas adicionais.

## Entregas desta rodada
- Prévia separada publicada em `https://paulosince.github.io/viagens/experiments/neon-pilot/app/neon-preview.html`.
- **Nenhuma mudança** em `main/index.html`, `main/src/main.js`, nem nas operações do Supabase de produção.
- `neon-preview.html` usa `main-neon.js`, que substitui Supabase Auth pelo `@neondatabase/neon-js@0.9.0-beta` (SDK oficial) com `SupabaseAuthAdapter`. A compatibilidade do método de login, `getSession`, `onAuthStateChange` e `signOut` foi confirmada com o pacote real em CI.
- A consulta aos projetos A e B utiliza `@neondatabase/postgrest-js@0.2.0-beta`, com `fetchWithToken` que só usa JWT emitido pelo Neon Auth. Staging A `ep-empty-pine-b8r7sa8d`, staging B `ep-spring-moon-b8fi6yxc`, Auth central `ep-small-bread-b7uq0zva`; `viaggio_app` com RLS.
- `neon-identity.mjs`: traduz o `neon_auth.user.id` novo para `viaggio_identity.users.id` antigo **usando apenas o `passenger_profiles.user_id` do projeto pessoal autorizado pelo JWT real**, não pela igualdade de e-mails. Mantém o UUID legado esperado por `main-neon.js` em viagens, offline, uploads e perfis. Falha fechado se o perfil não existe, se o JWT falta ou se home é ambíguo.
- `offline-store-neon.js` e `media-cache-neon.js`: bancos/cache separados da prévia Supabase original. Cache registra `neon_subject`; no boot online, a prévia exige sessão Neon válida antes de reutilizar dados locais; offline só permite identidade Neon já verificada. Logout exige sucesso confirmado do Neon e limpa a sessão local, sem fingir que foi encerrado após falha de rede.
- Assinaturas de `SIGNED_OUT` (inclusive logout em outras abas) e `TOKEN_REFRESHED` repassadas ao app depois da tradução do UUID legado.
- Signup via preview desabilitado até onboarding beta. Funções originais Supabase não são invocadas. Mídia bloqueada explicitamente (download/assinatura/upload/delete) até etapas 07–08: isto significa que algumas fotos podem não carregar nesta prévia. Não substituir por Supabase.
- Os arquivos da prévia e testes foram registrados na branch `migration/neon-step5-client-20261021` ([PR #20](https://github.com/paulosince/viagens/pull/20)); fontes espelhadas na branch canônica `migration/neon-app-20261019`.

## Evidências de validação (sem credenciais reais)
- [GitHub Actions 39664449840](https://github.com/paulosince/viagens/actions/runs/39664449840): testes de código e identidade/segurança + SDKs reais `createClient/SupabaseAuthAdapter/NeonPostgrestClient`: PASS.
- [GitHub Actions 39664449551](https://github.com/paulosince/viagens/actions/runs/39664449551): os seis recursos servidos pelo GitHub Pages devolveram HTTP 200, importações CDN 200; **Chrome real** carregou a página com `appReady=true`, sessão `anonymous`, tela de login visível e **zero exceções JS**: PASS.
- Testes unitários do adaptador: vínculo RLS, bloqueio de projeto ambíguo, JWT ausente, erro de RLS, login, logout, evento de refresh/cross-tab, troca de pessoa, signup desabilitado. Esses testes não provam o fluxo com credenciais reais.
- Os testes de JWT reais A/B aprovados em etapa 04 (Paulo 11/11; Cíntia 11/11) **não precisam ser repetidos**.

## Restante do aceite da etapa 05/14 (não são itens novos da lista)
1. Paulo entrar **na nova prévia** com a **nova senha Neon**, confirmar que o perfil Paulo e a viagem compartilhada aparecem sem retorno ao Supabase, salvar evidência do estado do aplicativo. Não editar viagens nesta primeira validação.
2. Recarregar a prévia e verificar sessão persistida; fechar e reabrir a mesma URL no Safari e verificar sessão. Testar sair no perfil, atualizar URL e confirmar ausência de login persistido.
3. Cíntia executar o mesmo teste de login/reabertura/logout, confirmando suas quatro viagens.
4. Confirmar no cliente recuperação após token vencido, sem usar token pessoal no ChatGPT, e troca de conta/cookies entre abas. Se necessário incluir um teste automatizado de renovação no adaptador SDK.
5. Ajustar erro real de UX/runtime identificado, sem modificar o Viaggio principal. Somente com estes testes considerar **5/14 aceita**.

## Limites
A prévia permite operar sobre **cópias de staging**, mas não é o cutover de produção. O Supabase permanece intacto e autoritativo até reconciliar deltas. A etapa de quotas também não está concluída.
