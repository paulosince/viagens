# Viaggio — Etapa 03/14: serviço privado de migração de contas

**Estado em 2026-10-21: EM ANDAMENTO. NÃO ACEITAR ESTA ETAPA COMO CONCLUÍDA.**
A lista acordada mantém **14 etapas**. A etapa 03 só termina quando o backend completo estiver efetivamente implantado e as duas contas da família forem migradas/verificadas de forma segura.

## Concluído nesta rodada
- Orquestrador server-side `auth/link-orchestrator.mjs`: exige duas identidades verificadas, prepara ligação em A/B antes de ativar, tenta revogação compensatória após falha de ativação, nunca envia IDs de usuários ao browser, CORS estrito e respostas sem segredos.
- Repositório `auth/link-store.mjs`: operações PostgreSQL parametrizadas, `BEGIN/COMMIT/ROLLBACK`, lock central por usuário, prevenção de associação contraditória e atualização idempotente de `activated_at` nos dois bancos.
- Serviço `auth/link-service/index.mjs`: usa `pg`, `jose`, `prepareIdentityProof`, verifica JWT central com JWKS e EdDSA, emissor/audiência definidos, confirma conta antiga via Supabase Auth e `emailVerified` no diretório privado central. Somente URLs de branches de **staging** devem ser configuradas para A e B.
- Testes unitários de orquestração e repositório adicionados ao GitHub. CI da branch atualizado para incluí-los; workflow de empacotamento usa dependências do npm e gera um artifact ZIP sem incluir segredos.
- Neon central project `dark-union-03886858`, branch `br-square-river-b765bpl4`: Function `linkup` implantada, status da implantação **completed**. É intencionalmente um **stub bloqueado** (respostas 403 ou 503) e NÃO contém ainda a versão executável com consultas PostgreSQL. Não pode migrar ninguém nesta versão.
- Neon Auth central consultado ao final: **0 usuários reais**. Nenhum vínculo foi inserido nos bancos A/B nesta rodada. Supabase e aplicativo em produção inalterados.
- A tentativa de construir o pacote completo via GitHub Actions ainda não teve execução final comprovada. Ambiente local de ferramentas não possui `pg`, `jose` ou `esbuild` instalados, e o acesso ao registry npm falhou por DNS; portanto **não** afirmar que testes novos ou build estão aprovados localmente.

## Pendências que pertencem À etapa 03 (não são novas etapas numeradas)
1. Executar `node --test experiments/neon-pilot/migration/auth/*.test.mjs` em CI/ambiente com Node 24 e conferir resultado dos novos testes.
2. `npm install` com lockfile gerado e testado em `auth/link-service`, `npm run build`, bundle ESM Node 24 e ZIP com `index.mjs` na raiz.
3. No Neon, implantar este bundle completo na Function central `linkup`, inicialmente com `VIAGGIO_LINK_ENABLED=false`.
4. Configurar somente em secrets/environ da Function: `VIAGGIO_A_STAGING_DATABASE_URL`, `VIAGGIO_B_STAGING_DATABASE_URL`, `VIAGGIO_SUPABASE_URL`, `VIAGGIO_SUPABASE_PUBLISHABLE_KEY`, `VIAGGIO_CENTRAL_JWKS_URL`, `VIAGGIO_CENTRAL_ISSUER`. `DATABASE_URL` é injetada no projeto de Auth. Nunca inserir os valores secretos no GitHub ou enviar tokens pelo chat.
5. Testar HTTP do serviço implantado (negações 401/403, 503 antes da ativação e CORS). Testar o registro de mapeamento usando identidades de ensaio verificadas. O código de compensação usa duas transações independentes, portanto não é commit distribuído atômico; preparar uma estratégia durável para intervenção/reconciliação em caso de falha de rede ou encerramento entre ativações.
6. Criar e verificar separadamente as novas credenciais de Paulo e Cíntia no Better Auth (ação individual dos titulares) e efetuar prova dupla de sessões e migração sem apagar ou modificar a origem.
7. Confirmar duas associações corretas, sem colisão, com dados existentes preservados; prosseguir à **etapa 04/14** para teste ponta a ponta do JWT real, roteamento e RLS entre projetos.

## Gate de segurança
- Nenhuma conta pode ser associada apenas pelo endereço de e-mail, por UUID fornecido pelo navegador ou por token não verificado.
- Os bancos principais de A/B continuam usando a autenticação Supabase durante esta fase.
- A Function `linkup` atualmente não executa operações sobre dados de usuários. Não desativar o stub até que os testes de segurança e configurações privadas estejam completos.

## Arquivos relevantes
- `auth/link-service/index.mjs`, `auth/link-service/build.mjs`, `auth/link-service/package.json`
- `auth/link-orchestrator.mjs` e testes
- `auth/link-store.mjs` e testes
- `auth/identity-proof-core.mjs` e `auth/trusted-auth-adapters.mjs`
- `.github/workflows/viaggio-neon-auth-checks.yml`, `.github/workflows/viaggio-link-build-stage.yml`

### Endpoint provisionado (inativo por segurança)
`https://br-square-river-b765bpl4-linkup.compute.c-13.us-east-1.aws.neon.tech/`

Neon relatou deployment `completed` da versão limitada que não manipula identidades. Bloqueio por origem e estado `MIGRATION_NOT_ENABLED` permanecem como proteção. **O deploy não equivale à implantação da integração completa** do código `auth/link-service/index.mjs`.

## Atualização comprovada — 21/10/2026, 14:19 UTC

**3/14 permanece EM ANDAMENTO** até que Paulo e Cíntia criem novas credenciais verificadas e ambos os vínculos administrativos com as identidades antigas estejam confirmados. Não mudar a contagem de 14.

1. Branch de validação `migration/linkup-stage3-check-20261021` criou PR draft #15, executando testes em GitHub Actions. O CI identificou e corrigiu formato inválido do regex UUID em `auth/link-store.mjs`. Os testes subiram para **40/40 aprovados** e o bundle completo com dependências `pg`/`jose` foi gerado. O fix foi levado de volta para a branch principal da migração.
2. Neon Function `linkup`, projeto central `dark-union-03886858` e branch `br-square-river-b765bpl4`, tem deployment **8**, status `completed`, com código **completo** e variáveis privadas das duas branches de staging e do Supabase. O flag `VIAGGIO_LINK_ENABLED=false` permanece desligado.
3. O endpoint foi comprovado em testes HTTPS reais via GitHub Actions, execução https://github.com/paulosince/viagens/actions/runs/39615622502:
   - origem não autorizada → HTTP **403**;
   - preflight da origem autorizada → HTTP **204**;
   - POST com a origem autorizada enquanto a migração está desabilitada → HTTP **503** / `MIGRATION_NOT_ENABLED`.
   Logs e status do backend comprovaram a resposta, não apenas implantação.
4. A prévia de atualização de identidade foi publicada em um arquivo isolado no GitHub Pages (`main`, sem modificar `index.html` ou `src/main.js`):
   `https://paulosince.github.io/viagens/experiments/neon-pilot/app/auth-upgrade.html`.
   Verificação real HTTP 200 no GitHub Actions, execução https://github.com/paulosince/viagens/actions/runs/39615761463. A página possui cadastro Neon por e-mail com nova senha, código OTP e confirmação; não solicita senha do Supabase, não expõe tokens e **não** faz vinculação das viagens.
5. Foi necessário corrigir inicialização de Neon Functions para aceitar endereços `-pooler` e banco injetado distinto de `viaggio_auth`, mais tratamento de startup que falha de maneira segura em vez de falhar sem diagnóstico. Código final também replicado em `migration/neon-app-20261019`.
6. Temporário ZIP codificado em base64 foi removido do GitHub depois do deploy. No staging, os dois bancos têm **0 registros** em `viaggio_identity.neon_auth_links`; Auth central tem **0 contas reais**, sem nenhuma ativação. Os bancos principais e Supabase permanecem intocados.
7. CI de smoke HTTP manual `viaggio-linkup-smoke.yml` registrado na branch de migração; é intencionalmente um teste de modo **desabilitado** — adaptar ao habilitar a migração.

### Próxima ação necessária dentro da etapa 03/14
- Os próprios titulares (primeiro Paulo, depois Cíntia) devem acessar o portal isolado, usar o **mesmo e-mail** da conta Supabase e uma **senha nova**, confirmar o OTP. Não enviar senhas/códigos/tokens ao ChatGPT.
- Consultar `neon_auth.user` e confirmar `emailVerified=true`, sem imprimir os e-mails desnecessariamente.
- Falta criar uma interface segura de **prova simultânea da sessão Supabase antiga e da sessão Neon nova** que chama `linkup` com dois JWTs já verificados, habilitar a Function em staging e validar o fluxo ponta a ponta, incluindo recuperação em caso de falha de qualquer banco. **O serviço ainda não vinculou ninguém.**
- Além disso, o projeto Neon Free compartilha capacidade entre projetos e o portal não integra ainda o aplicativo em produção.

**Nenhuma alteração do roteamento em produção, nenhuma migração real de conta e nenhuma mudança do Supabase.**
