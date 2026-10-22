# Viaggio — Supabase → Neon — Etapa 07/14: mídia privada

**STATUS: EM ANDAMENTO — leitura isolada publicada para teste positivo com JWT real; uploads e exclusões não habilitados.**
**Progresso oficial permanece: 6/14 concluídas; etapa 07/14 em validação.** Oito etapas incluindo a atual.

## Verificações de preservação e integridade
- A (Cíntia) staging `fragrant-credit-68065034 / br-silent-band-b80nklzl`: bucket **privado** `viaggio-lab-media`, **76 objetos**. Diretório SQL `viaggio_identity.media`: 76 linhas ready (trip-images 65, profile-photos 7, day-attachments 4) total ~119,6 MB. O manifesto mapeia o caminho lógico `bucket_id + object_key` para o objeto físico `storage_key = uploads/<UUID>`. Não misturar esses dois caminhos. Nenhuma imagem precisa ser reenviada para que o backend as encontre.
- B (Paulo) staging `sparkling-field-13794641 / br-falling-leaf-b8xuv1d0`: bucket privado com **1 objeto**. Projeto B não contém viagem própria neste snapshot; uma viagem de A está compartilhada com Paulo.
- Integridade por chave lógica em A: **3/3 capas mapeadas, 3/3 hashes de capa iguais aos registros de mídia, 43/43 fotos de atividade mapeadas, 4/4 anexos mapeados**. Isto não compara cada byte dos 76 arquivos baixados e não equivale à reconciliação final de deltas da etapa 12/14.

## Erros identificados e corrigidos
1. Antes, `backend-neon.mjs` continha URLs `appmedia` de **branches principais** (A `br-dawn-bread-b83r0ztn` e B `br-proud-paper-b83l1z7d`) embora a prévia de dados use *staging*. Corrigidos para os endereços reais de Function identificados diretamente em Neon: A `br-silent-band-b80nklzl-appmedia` e B `br-falling-leaf-b8xuv1d0-appmedia`. Nenhuma Function foi redeployada.
2. O adaptador antigo `storage.mjs` tentava ler mídia em outro projeto após 403/404. Isso é inseguro como estratégia de autorização. Criado `storage-neon.mjs` **isolado** que determina projeto usando a viagem visível por RLS ou o perfil pessoal/avatars compartilhados por RPC, envia JWT central ao serviço de mídia e **não efetua fallback em 401/403/404**.
3. Todas as URLs recebidas pelo cliente são HTTPS de Functions staging, sem redirecionamento de Bearer. Prefixo de objeto exige UUID e caminhos com `..`, `/`, caracteres de controle ou bucket desconhecido falham antes de HTTP.
4. A leitura usa a Function `/download` e assina URL privada `/sign`; objetos de imagem são verificados por SHA-256 pelo módulo já existente `media-cache-neon.js`. Metadados lógicos são vinculados a `uploads/<UUID>` **no backend**.
5. `createNeonMediaClient({allowMutations:false})` mantém **UPLOAD e REMOVE explicitamente bloqueados**; testes de contrato dessas operações executados apenas com mocks. Jamais interpretar esta prévia como autorizando exclusão física, quota ou publicação definitiva.
6. Publicado `storage-neon.mjs`, atualizado `backend-neon.mjs`, `main-neon.js` com cache-buster `v=20261021-7media`, além da nova URL independente `https://paulosince.github.io/viagens/experiments/neon-pilot/app/neon-media-preview.html`. A prévia original e o aplicativo principal continuam preservados; a nova página esclarece bloqueio de upload/exclusão.

## Testes realizados sem tokens pessoais
- [GitHub Actions — Functions probe](https://github.com/paulosince/viagens/actions/runs/39683560644): `/download` e `/sign` em ambas Functions retornaram HTTP **401 sem JWT** e **403 com JWT de assinatura falsa**; nenhuma URL assinada vazou. OPTIONS CORS retornou **204** com `Access-Control-Allow-Origin: https://paulosince.github.io`.
- [GitHub Actions — mídia privada](https://github.com/paulosince/viagens/actions/runs/39684909115): **15/15 testes automatizados**, cobrindo roteamento RLS, download/signed URL, falha fechada em 403/404, nome de arquivo malicioso, ausência de token, fotos pessoais e de proprietários compartilhados, upload/delete desabilitados e simulação de operações habilitadas, recusa de resposta vazia.
- [GitHub Actions — prévia publicada no navegador](https://github.com/paulosince/viagens/actions/runs/39684909094): HTML versionado, módulo, endpoints corretos e bloqueio de mutações publicados via HTTPS; Chrome real abriu sessão anônima sem erros JavaScript.
- [GitHub Actions — regressão Auth da etapa 05](https://github.com/paulosince/viagens/actions/runs/39684909080): o teste de renovação do JWT continuou aprovando com o novo módulo de mídia importado.
- Nenhum dado do Supabase foi alterado. Nenhum arquivo privado foi baixado por esta sessão ou modificado no Object Storage durante os testes técnicos.

## O que falta para aceitar 07/14
1. **Teste positivo com JWT real:** Paulo ou Cíntia entrar na página isolada de mídia `neon-media-preview.html` e conferir fotos das viagens; registrar êxito/erro e identificar, sem revelar tokens, quais imagens não apareceram. O GET real das Functions sob autorização do usuário ainda **NÃO** foi comprovado; os testes negativos e mocks não substituem essa evidência.
2. Confirmar privacidade: conta B só lê arquivos ligados a viagem A à qual tenha acesso; não recebe imagens de outras viagens ou perfis sem a vinculação validada. Testar JWT real em A/B e ausência de dados em acesso negado.
3. Testar uma operação **positiva** de upload e sua leitura/checagem de hash em **objeto descartável e isolado** com JWT real, sem sobrescrever foto familiar, além dos cenários negativos de permissionamento `viewer/editor/owner`. Depois testar exclusão somente do próprio objeto descartável em ambiente de teste com autorização explícita. Habilitar `allowMutations` na prévia só após os testes.
4. Validar retorno e comportamento após timeout, falha parcial e gerenciamento do cache offline de mídia. Essas verificações se conectam ao gate de sincronização offline 09/14; não criar etapas adicionais.

**Não encerrar a etapa 07/14 prematuramente.** Próxima etapa futura continua 08/14 (eliminar outras Functions e dependências Supabase) somente após aceite da etapa 07.

## Correção de diagnóstico — fotos divergentes no Safari (21/10/2026)
- Paulo informou expressamente: **"Nenhuma alteração foi feita após o início da migração, ninguém acessou o app."** Assim, não atribuir a divergência fotografada a alterações posteriores ou a uma versão desatualizada da origem.
- Comparamos diretamente `public.activities` do **Supabase atual de produção (somente SELECT)** com `viaggio_app.activities` da **branch staging Neon A**. As atividades `Hotel Jardim Lisboa` e `Elevador de Santa Justa` têm **os mesmos caminhos privados, hashes SHA-256 e timestamps em ambas as bases**. São **dois arquivos distintos**, e o catálogo Neon `viaggio_identity.media` preserva seus objetos físicos distintos. Os dois registros têm `photo_url=NULL` porque suas fotos corretas são privadas/gerenciadas.
- `viaggio_app.day_locations` contém, para o hotel e o Elevador, o **mesmo URL público Unsplash** (foto do bonde de Lisboa). O código original `const photoUrl = activity.photo_url || location?.photo_url || ''` usa esse URL público quando a foto privada não foi hidratada. Isso explica **exatamente por que o Safari exibiu o mesmo bonde nos dois cartões**, sem demonstrar corrupção de dados no PostgreSQL.
- Não confundir esse **fallback visual incorreto** com a causa primária de falha de leitura privada: ainda precisamos apurar por que `activity.photo_url` ficou vazio após login e leitura de mídia. Os testes anteriores com JWT ausente/forjado foram negativos; a leitura positiva com JWT real ainda precisa ser comprovada.
- Correção em `photo-source-neon.mjs` e `main-neon.js`: atividades com `photo_path` privado **NUNCA** herdam a foto pública genérica da localização quando a mídia privada falha. Sem download autorizado, mostram a ausência da foto, em vez de uma foto errada. 4 testes de regressão criados; CI dedicado em `.github/workflows/viaggio-stage07-photo-regression.yml`. As fontes estão espelhadas na branch de migração; o código desta correção também foi publicado aditivamente na prévia, não no app principal.
- Nova página `neon-media-review.html` publicada para visualização sem cache antigo; **nova ferramenta de conferência privada** `neon-photo-check.html` publicada também em `main`, faz leitura **somente GET** usando o login Neon e compara SHA-256 das fotos hotel/elevador em A, sem mostrar JWT, caminho de storage ou senha na saída.
- Os arquivos do Supabase e Neon não foram alterados durante a investigação. Nenhum token de usuário foi solicitado no chat. Não encerrar etapa 07 antes da confirmação do acesso positivo e de upload/exclusão em staging seguro.

## 22/10/2026 — Falha HTTP 503/403 com JWT real: diagnóstico e correção implantada

- A captura real do Safari (10:25 BRT) na página `neon-photo-check.html` mostrou:
  - `Hotel Jardim Lisboa`: **503 — Serviço privado de arquivos indisponível**;
  - `Elevador de Santa Justa`: **403 — Você não tem permissão**.
- Essas respostas demonstraram falha real no proxy de mídia, não erro de foto de referência do banco; a página já consulta `activities` e utiliza caminho privado específico.
- Inspeção do código-fonte `experiments/neon-pilot/functions/appmedia/index.mjs`: a versão implantada usava os Data API endpoints **obsoletos** `ep-floral-sea-b829egtf` (projeto A) e `ep-aged-pine-b8pd3upm` (projeto B).
- A consulta oficial `get_data_api` das branches staging confirmou endpoints **atuais e ativos**:
  - A: `ep-empty-pine-b8r7sa8d`, branch `br-silent-band-b80nklzl`;
  - B: `ep-spring-moon-b8fi6yxc`, branch `br-falling-leaf-b8xuv1d0`.
- A função chama `/rpc/media_access` com o JWT recebido. Um destino incorreto pode resultar em 403/503 mesmo que a autorização por RLS no banco correto esteja íntegra.
- Teste read-only com claims simuladas sob role `authenticated` no banco **A staging** verificou `viaggio_app.media_access('trip-images', photo_path, false)` para hotel e elevador: **allowed=true** para ambas as fotos da proprietária. Isso NÃO substitui teste HTTP com JWT assinado.
- Código corrigido em `experiments/neon-pilot/functions/appmedia/index.mjs`, [PR #24](https://github.com/paulosince/viagens/pull/24), build de função com dependências fixadas e testes aprovados: [Actions 39787844393](https://github.com/paulosince/viagens/actions/runs/39787844393) e [39788598669](https://github.com/paulosince/viagens/actions/runs/39788598669).
- Dois ZIPs compilados `index.mjs` gerados para `VIAGGIO_MEDIA_PROJECT=a/b` e enviados por conector diretamente a `deploy_function`. **Deploy atualizado em staging A e B com status `completed`**, ambos em **22/10/2026**. Não foi implantado em branch principal, nem alterados arquivos do storage, Supabase ou PWA de produção. Fonte corrigida e CI espelhados na branch canônica da migração.
- Regressão HTTP **após deploy**: [Actions 39788598559](https://github.com/paulosince/viagens/actions/runs/39788598559) passou nos dois endpoints: anônimo recebe **401**, preflight CORS **204**, com `Access-Control-Allow-Origin: https://paulosince.github.io`.
- A correção de source URL é material; ainda NÃO há **nova execução positiva com sessão assinada da Cíntia** após o deploy. Não declarar 7/14 concluída por isso.
- **Próxima validação:** acessar a mesma página `https://paulosince.github.io/viagens/experiments/neon-pilot/app/neon-photo-check.html` com a conta Neon da Cíntia, tocar em “Testar com a sessão Neon atual” e confirmar **APROVADO/hashes correspondentes** para as duas fotos, ou coletar os novos status. Nunca enviar JWT, senha ou URL assinada ao chat.
- **Status:** 6/14 concluídas; etapa 07 em execução. Upload/remoção continuam desabilitados, e ainda serão testados em objeto descartável antes de aceitar etapa 07.

## Diagnóstico 22/10/2026: HTTP 503/403 em duas fotos

- Captura de teste real às **10h25 BRT**: `Hotel Jardim Lisboa` retornou **503**; `Elevador de Santa Justa` retornou **403** na Function `appmedia`. A captura **não prova corrupção de dados**; é falha de serviço/acesso.
- Auditoria do código `experiments/neon-pilot/functions/appmedia/index.mjs` mostrou o problema configuracional documentado no [PR #24](https://github.com/paulosince/viagens/pull/24): a Function usava os endpoints antigos `ep-floral-sea-b829egtf` e `ep-aged-pine-b8pd3upm`, enquanto as Data APIs A/B de staging aprovadas utilizam `ep-empty-pine-b8r7sa8d` e `ep-spring-moon-b8fi6yxc`. O código agora aponta a A/B atuais.
- Neon informou que Functions `appmedia` A e B tiveram deployments **completed** às **13:35:09Z/13:35:34Z (10h35 BRT)**, depois da captura de 10h25. Logs de Function registram invocações recentes, mas não expõem status HTTP nem erro interno. Não declarar o reparo comprovado antes de novo teste com JWT real.
- Inspeção `viaggio_app.media_access()` do projeto A: em transação read-only com `role authenticated` e **claims de JWT simuladas** para a proprietária da viagem, ambos os caminhos de Hotel e Elevador retornaram `authorized=true`. Esta simulação é **diferente de validação de assinatura JWT real**; corrobora a correção da regra RLS no banco.
- Inspeção direta do Object Storage em A confirmou **um objeto físico por caminho**, com bytes: **Hotel 3.638.197**, **Elevador 1.686.248**. Isto não confirma hash de bytes do download efetivo; são metadados físicos.
- Um diagnóstico novo, somente leitura, foi preparado e publicado: `https://paulosince.github.io/viagens/experiments/neon-pilot/app/neon-photo-diagnostics-v2.html`. Ele faz download com JWT Neon, verifica SHA-256, e em caso de erro registra apenas HTTP + código curto sanitizado (sem token, body bruto ou URL privada). Repetição limitada a falha transitória 5xx; nunca repete 4xx, e nunca escreve no banco ou armazenamento. Publicado no `main` de GitHub Pages e espelhado na branch canônica.
- **Ainda pendente**: resultado positivo do usuário pós-deploy das Functions; upload e exclusão positivos de mídia descartável após autorização específica, conforme plano da etapa 07/14. O progresso permanece **6/14**.
