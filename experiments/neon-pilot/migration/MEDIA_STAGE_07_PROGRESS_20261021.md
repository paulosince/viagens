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
