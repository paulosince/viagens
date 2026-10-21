# Viaggio — Supabase → Neon — Etapa 04/14

**STATUS: EM ANDAMENTO (NÃO concluída).** 21/10/2026.

## Objetivo desta etapa da lista fixa
Validar um JWT **real e assinado pelo Neon Auth central**, suas sessões e as permissões RLS nos **dois projetos de dados**. Sem alterar viagens ou o Supabase de produção.

## Verificações já concluídas
1. Ambos os Data APIs de **staging** ativos, schema `viaggio_app`, `jwt_role_claim_key=.role`, CORS configurado no projeto para `https://paulosince.github.io`. A/B:
   - A: `https://ep-empty-pine-b8r7sa8d.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1`
   - B: `https://ep-spring-moon-b8fi6yxc.apirest.c-14.us-east-1.aws.neon.tech/viaggio_lab/rest/v1`
2. Criados `experiments/neon-pilot/app/federation-live.mjs` e seus testes, com **11 checagens por sessão real**: em cada projeto JWT forjado negado, anônimo negado, context RPC, viagens e perfis autorizados; consistência final de propriedade e contagens.
3. Critérios esperados, conferidos anteriormente em SQL com claims simuladas:
   - Cíntia (home A): A=4 viagens e 1 perfil pessoal; B=0 viagens e 0 perfis.
   - Paulo (home B): A=1 viagem compartilhada e 0 perfis pessoais; B=0 viagens e 1 perfil pessoal.
   - **Esses números devem ser confirmados pelo JWT real; não pressupor aprovação.**
4. Criada página pública e isolada `https://paulosince.github.io/viagens/experiments/neon-pilot/app/auth-neon-smoke.html`, login por OTP Neon, solicita JWT temporário, faz consultas somente de leitura aos dois endpoints e mostra as contagens sem persistir/exibir o token. Fonte publicada adicionalmente no `main` sem alterar `index.html` nem `src/main.js`.
5. CI no [GitHub Actions run 39655619779](https://github.com/paulosince/viagens/actions/runs/39655619779):
   - **7/7 testes unitários simulados**, sintaxe da página e ausência de armazenamento de tokens: PASS.
   - APIs A e B negaram token forjado com **HTTP 400** e acesso sem JWT com **HTTP 400**, sem expor dados: PASS. O 400 é resposta de rejeição, não autorização (o contrato inicial assumia 401/403 e foi corrigido).
   - Preflight POST com autorização, Accept-Profile, Content-Profile, Content-Type: HTTP 200, cabeçalhos de autorização: PASS nos dois endpoints.
   - Página e módulo entregues via GitHub Pages: **HTTP 200 / HTTP 200**.
6. **Desvio de CORS que precisa ser conhecido**: embora as configurações da Data API mostrem `server_cors_allowed_origins = https://paulosince.github.io`, o preflight retornou `Access-Control-Allow-Origin: *` nas duas APIs. Browser requests usando Bearer sem cookies continuam possíveis; controles de autorização devem depender do JWT verificado + RLS, não de CORS. Revalidar origem efetiva antes do cutover definitivo, dentro dos gates de segurança/integração já existentes.

## Ainda falta, dentro da etapa 04/14
1. Paulo abrir a página de diagnóstico pelo Safari e concluir sign-in OTP **sem informar código nem JWT neste chat**; enviar apenas screenshot do quadro de 11 checagens, ou erro exibido. Confirmar espera A=1 viagem, B=0 viagens, home B, A=0 perfil, B=1.
2. Cíntia executar a mesma página no Safari dela; confirmar espera home A, A=4 viagens, B=0, A=1 perfil, B=0.
3. Se alguma sessão real falhar, corrigir JWT role/issuer/audience/CORS/request headers com evidência, nunca inserir credenciais no repositório.
4. Validar persistência e recuperação de sessão pelo fluxo que será integrado ao aplicativo; logout/refresh conforme comportamento suportado pelo Neon Auth. Não declarar etapa concluída sem evidência real das duas pessoas.

## Progresso fixo
**3/14 aceitas; etapa 04 em andamento; 10 posteriores.** Os dados de produção continuam exclusivamente no Supabase; Neon main branches não sofreram cutover.

## Correção após teste real de Paulo (21/10/2026)

- Captura do navegador mostrou `a_PROFILES_QUERY_FAILED_HTTP_400` na execução da etapa 04. O teste alcançou a consulta do projeto A, mas interrompeu antes das 11 verificações; **não é aceite**.
- Inspeção direta de `viaggio_app.passenger_profiles` em **A e B** provou que a chave primária é `user_id uuid`, não `id`. Ambos os bancos têm `authenticated` com USAGE no schema e SELECT na tabela.
- A função de diagnóstico consultava incorretamente `/passenger_profiles?select=id&limit=5`. Corrigido para `/passenger_profiles?select=user_id&limit=5`.
- Código corrigido em `main` e `migration/neon-app-20261019`. Acrescentada asserção de regressão em `federation-live.test.mjs`.
- O código real do módulo foi executado com **respostas de APIs simuladas**, em ambiente isolado: caso Paulo/home B (A:1 viagem,0 perfis; B:0 viagens,1 perfil) e caso Cíntia/home A (A:4 viagens,1 perfil; B:0 viagens,0 perfis) retornaram ambos **passed=true** com 11 verificações, e todas as quatro consultas de perfis utilizaram `select=user_id`. **Isso não substitui o teste real assinado.**
- Página original passou a importar `federation-live.mjs?v=20261021-schemafix1`; publicada também a URL inédita `auth-neon-smoke-v2.html` para evitar cache do Safari. Confirmados os arquivos no GitHub `main`. A propagação HTTP 200 **dessa nova URL** ainda não foi independentemente atestada.
- Próximo teste: Paulo repetir apenas OTP na página v2 e compartilhar o quadro sem códigos nem tokens. Se passar, testar Cíntia. Sem reabrir cadastro ou vinculação e sem alterar produção.

**Progresso permanece 3/14; etapa 04 não encerrada.**
