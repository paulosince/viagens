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
