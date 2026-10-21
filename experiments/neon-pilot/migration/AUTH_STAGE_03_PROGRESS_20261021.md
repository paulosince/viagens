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

## Confirmação de identidade real — 21/10/2026 (após a publicação do portal)
- O titular confirmou na interface do portal a mensagem final **E-mail confirmado**.
- Leitura do diretório central `neon_auth.user`: **1 conta total, 1 com `emailVerified=true`**. Nenhum e-mail, UUID, senha ou OTP foi incluído neste registro.
- **Etapa 03/14 continua parcial**: o serviço `linkup` permanece desabilitado, e a prova simultânea de sessão Supabase + Neon e os vínculos com os dados ainda não foram executados.
- Próximo acesso humano: confirmar a identidade de Cíntia no mesmo portal com o e-mail original dela, sem repassar credenciais no chat. Depois completar fluxo privado de dupla sessão e testar antes de ativar mapeamento real.

## Duas contas reais verificadas — 21/10/2026 (segunda confirmação)
- `neon_auth.user`, no Auth central, consultado diretamente: **2 usuários cadastrados, 2 com emailVerified=true, 0 não verificados**.
- O diretório privado de origem no projeto A possui **2 contas antigas elegíveis**; comparação de endereços de e-mail normalizados executada sem imprimir e-mails: **2/2 correspondências**.
- Nas branches de staging A/B: `neon_auth_links` possui **0 vínculos preparados** e **0 ativados** em ambas. O serviço `linkup` continua no deployment 8 e com `VIAGGIO_LINK_ENABLED=false`.
- Iniciada uma página isolada de dupla autenticação em `experiments/neon-pilot/app/auth-link.html` **apenas na branch de migração**. O objetivo é conferir a sessão Supabase antiga e a sessão Neon nova no navegador e enviar somente JWTs de curta duração à Neon Function; nenhuma senha é enviada ao ChatGPT nem ao próprio linkup. O portal **não está publicado nem liberado para utilização** porque falta validação final da obtenção de JWT no Safari/iOS e teste live da ligação.
- O cadastro das duas credenciais foi concluído, **mas a etapa 3/14 ainda está pendente da vinculação real e validação posterior**. Não confundir correspondência de e-mail com prova de controle de duas sessões.

## Progresso adicional — prova via OTP e liberação em staging (2026-10-21)

- Implementado e publicado no GitHub Pages um fluxo alternativo que **não solicita nem armazena a senha do Supabase**: consulta a sessão antiga já aberta no **mesmo navegador**, usa Neon email OTP `type: sign-in` e envia apenas os JWTs autenticados a `linkup`.
- Página: `https://paulosince.github.io/viagens/experiments/neon-pilot/app/auth-link-otp.html`.
- Arquivos de fonte e testes espelhados em `migration/neon-app-20261019/experiments/neon-pilot/app/auth-link-otp.html`, `link-session.mjs`, `link-session.test.mjs`; publicações de página e módulo em `main` são **aditivas** e não alteram a aplicação principal.
- GitHub Actions [run 39650164875](https://github.com/paulosince/viagens/actions/runs/39650164875) aprovou testes unitários do módulo de transporte, sintaxe do portal, CORS dos métodos email, `email-otp/send-verification-otp`, `sign-in/email-otp`, negação do JWT anônimo e rejeição de credenciais forjadas.
- HTTP público confirmado: **200** para a página e **200** para o módulo importado. A primeira verificação HTTP detectou atraso de publicação 404; novo teste passou após propagação, sem alteração de configuração do Pages.
- Neon Function `linkup` central implantada no deployment **9** (`completed`) e habilitada `VIAGGIO_LINK_ENABLED=true` **APENAS** para os dois bancos de *staging*, cujos hostnames são fixados no código. Tokens falsos comprovadamente recebem **401**; CORS OPTIONS autorizado retorna **204**. A habilitação inicialmente retornou 503 durante estabilização, mas a execução subsequente [run 39650164875](https://github.com/paulosince/viagens/actions/runs/39650164875) aprovou o contrato real.
- Confirmado após habilitação: **2/2 contas centrais verificadas**, vínculos **A=0/B=0** e ativações **A=0/B=0**. Ninguém foi vinculado automaticamente nem houve escrita em banco principal ou Supabase.
- O próximo teste exige ação do titular: entrar no Viaggio antigo pelo **Safari na versão web**, depois abrir a página OTP no **mesmo navegador**. A entrada do código Neon comprova a segunda sessão. O serviço então confere ambas e só prepara/ativa mapeamentos em staging. Aplicativos PWA instalados e Safari podem não compartilhar sessão/cookies. Se a tela detectar falta de sessão antiga, usar o site antigo no mesmo Safari e tentar novamente.
- **3/14 ainda não concluída:** usuários precisam realizar e comprovar vinculação. O teste positivo real no Safari e acessos por JWT nos dois bancos continuam pendentes. Não marcar 3/14 como concluída antecipadamente.

## Continuação — titular Paulo identificado e correção de roteamento (21/10/2026)

- A interface isolada de OTP mostrou **“Vinculação concluída no ambiente de teste”**; o titular confirmou em conversa que o Safari estava conectado à **conta antiga de Paulo**. Este é aceite da jornada de Paulo pelo frontend/serviço, NÃO uma confirmação SQL independente: a conexão recusou consultas SQL no momento da verificação, inclusive SELECTs não sensíveis.
- Revisão identificou bug do backend: `linkTwoProjects` exigia obrigatoriamente vincular as duas contas em **A e B**, apesar de a identidade antiga da Cíntia existir só em A. Sem correção, a vinculação dela falharia com `IDENTITY_DIRECTORY_MISSING` em B.
- Corrigidos `auth/link-store.mjs` e `auth/link-orchestrator.mjs`: seleção privada de projetos pelo usuário legada verificada e `project_binding`. Paulo deve participar de A (convidado) e B (proprietário); Cíntia só de A (proprietária). Nenhum projeto é selecionado pelo navegador; requer exatamente um home válido.
- Novo ciclo de testes em PR temporário #17: **48/48 aprovados**, sem falhas. Código e testes transferidos para branch `migration/neon-app-20261019`.
- Função Neon Auth central `linkup` atualizada: **deployment 10, completed/active**, conexões ainda fixadas somente em branches de staging. HTTP de segurança comprovado em [GitHub Actions run 39653114045](https://github.com/paulosince/viagens/actions/runs/39653114045), rejeição de origem não autorizada (403), rejeição de JWT forjado (401), OPTIONS (204).
- Página pública isolada `auth-link-otp.html` atualizada para mostrar o e-mail da **conta antiga realmente conectada** antes de pedir OTP. A página não muda produção e não recebe a senha antiga.
- PR temporário #17 fechado sem merge; artifact ZIP temporário e workflow de construção temporário removidos da branch de teste após deployment.
- **Próxima ação:** Cíntia deve acessar a versão web de Viaggio pelo Safari com a sessão antiga **dela**, conferir seu e-mail na página de OTP, realizar a vinculação, e enviar confirmação. Não utilizar sessão de Paulo. Depois solicitar verificação administrativa dos vínculos nas duas branches.
- Progresso fixo: **2/14 concluídas; 3/14 ainda em curso** até confirmação real de Cíntia e inspeção final. Nenhum Supabase/Neon main foi alterado por essas correções.
