# Viaggio — persistência, leitura e diagnóstico de sincronização

Atualizado em 2026-11-06. Escopo: `https://paulosince.github.io/viagens/` e `experiments/neon-pilot/app/`.

## Arquitetura efetiva

1. **GitHub Pages** publica o frontend estático a partir de `index.html`. A aplicação importa `main-neon.js` e registra `sw.js` (cache de shell e assets). GitHub Pages não é banco de dados.
2. **Neon Auth** fornece o JWT. `backend-neon.mjs` constrói clientes PostgREST com `schema('viaggio_app')` e JWT do usuário.
3. **Roteamento**: `router-neon.mjs` lê os dois projetos configurados em `API_ROOTS`, agrega as respostas e encaminha mutações ao projeto que contém a viagem. As políticas RLS do PostgreSQL determinam acesso. O segundo projeto pode estar vazio.
4. **Fonte remota**: `trips`, `trip_days`, `activities`, `day_locations`, além de tickets, anexos, orçamento etc. Os dados do roteiro são carregados por `fetchTripData` / `loadDayRecords` em `main-neon.js`.
5. **Offline**: `offline-store-neon.js` guarda viagens e atividades em IndexedDB, além de fila `outbox`. `fetchTripData` pode renderizar essa cópia imediatamente e substituí-la após leitura remota bem-sucedida.
6. **Sincronização**: `flushOutbox` envia mutações locais. **Fila vazia não prova que o download de dados remotos funcionou**.
7. **Atualização do frontend**: mudanças em `main-neon.js` exigem atualizar a query `?v=` em `index.html` e `sw.js`, e incrementar `CACHE_NAME` do service worker.

## Falhas diagnosticadas

- **F1 — falso positivo**: `refreshSyncStatus` exibia “Sincronizado” quando a fila estava vazia e havia snapshot, mesmo sem verificar a consulta atual da agenda.
- **F2 — falha silenciosa**: `fetchTripData` capturava erros da API e devolvia IndexedDB; a tela apresentava dados antigos sem aviso explícito.
- **F3 — ação incompleta**: tocar no indicador executava apenas `flushOutbox`, sem baixar novamente o roteiro.
- **F4 — risco de perda de dados**: substituir o IndexedDB integralmente pelos registros remotos poderia apagar atividades presentes apenas no aparelho. O código de reconciliação agora preserva essas entradas pelo ID, sem enviá-las automaticamente ao servidor.
- **F5 — consultas lentas**: `loadDayRecords` percorria os dias em série; a consulta agora processa grupos de três dias em paralelo.
- **F6 — cache PWA**: sem alteração dos identificadores de versão, um iPhone poderia continuar executando JavaScript anterior.

## Evidências da viagem Paris & Lisboa

- Projeto remoto consultado: `viaggio-lab-onboarding-01` (schema `viaggio_app`).
- Dia 25/11: atividade “Manhã”, Montmartre 14h, Parque dos Príncipes 19h, outlet 10h e Boris Lumé 16h presentes na tabela `activities`.
- Dia 26/11: Notre-Dame 8h30 presente na mesma tabela.
- Captura do iPhone: “Almoço econômico — Montmartre · €65 / 5” às 13h, não encontrado como atividade desse dia no banco consultado. **Isso prova divergência entre os conjuntos exibido e consultado; não prova isoladamente a causa.**
- Há registros de snapshots do roteiro no banco; a expressão exata do almoço da captura não foi encontrada nesses snapshots. Não substituir os dados locais sem backup.

## Fluxo correto de reconciliação

1. Renderizar cache local com status **não verificado**.
2. Com internet, consultar `trip_days`, `activities` e `day_locations` usando JWT do usuário.
3. Se houver erro, preservar cache, registrar falha e mostrar aviso visível. Não marcar como sincronizado.
4. Se houver sucesso, comparar por IDs e preservar entradas locais exclusivas, sem propagá-las automaticamente ao Neon.
5. Atualizar IndexedDB e estado da UI; marcar `remoteVerified` apenas se não houver divergências locais exclusivas.
6. Ao tocar no indicador, primeiro enviar mutações pendentes e **depois forçar nova leitura remota**, sem usar cache de 60 segundos.

## Verificações antes de concluir um incidente

- Conferir URL publicada, versão `main-neon.js?v=`, cache `sw.js` e commit de Pages.
- Verificar `trip_id` e `day_id` reais, projeto Neon e papel do usuário (owner/editor).
- Comparar IDs/títulos/horários de todos os itens do dia no Neon e no IndexedDB, sem apagar nada.
- Testar rede funcionando, rede indisponível, API retornando erro, outbox pendente e outbox vazia.
- Validar que o indicador **não** fica verde com API indisponível.
- Validar que atividades locais exclusivas sobrevivem a uma atualização remota.
- Conferir dia 25/11 (outlet, almoço, Montmartre, padaria, jogo) e 26/11 (Notre-Dame e passeios existentes).
- Somente afirmar “resolvido no aparelho” após validação real no iPhone autenticado.

## Cloudflare

Nenhuma chamada Cloudflare aparece na implementação de persistência examinada. Os endpoints de dados no código são Neon, e o frontend é servido por GitHub Pages. Isso não exclui Cloudflare para DNS de outro domínio, mas tal configuração não foi verificada na conta Cloudflare.

## Limitações

Acesso administrativo ao banco permite verificar registros, mas **não reproduz a RLS e a sessão JWT do iPhone**. O diagnóstico de falha silenciosa é demonstrado pelo código; a razão exata da falha remota no aparelho só pode ser confirmada com a resposta HTTP/erro correspondente. Não apagar IndexedDB, nem fazer migração destrutiva.

## Causa adicional identificada: bloqueio total de leitura por outbox

Em `fetchTripData`, a condição `hasPendingForTrip(tripId)` fazia retorno antecipado com **apenas dados do IndexedDB**. Assim, uma única alteração local pendente impedia indefinidamente a leitura de qualquer atividade nova do Neon, inclusive as inseridas diretamente no banco. O clique no indicador também retornava antes da leitura quando `flushOutbox` falhava. Isso é uma falha lógica confirmada no código; não há acesso à fila real do iPhone para afirmar que ela está pendente neste caso.

Correção: consultar Neon mesmo com outbox pendente; preservar alterações locais para IDs afetados por mutações pendentes; respeitar IDs de exclusão da fila; incorporar registros remotos novos; continuar exibindo estado pendente até a fila ser enviada. O botão de sincronização também consulta o servidor mesmo que o envio de alterações locais falhe. Não limpar a fila e não sobrescrever exclusões locais pendentes.

## 2026-11-06 — CAUSA RAIZ CONFIRMADA: BRANCH NEON INCORRETA

A API de produção em `backend-neon.mjs` utiliza o endpoint `ep-empty-pine-b8r7sa8d` do projeto `fragrant-credit-68065034`, que corresponde à branch **`br-silent-band-b80nklzl`**, denominada `auth-federation-validation-20261020`. As gravações iniciais das três atividades foram feitas por SQL na branch padrão **`br-dawn-bread-b83r0ztn`** (`main`), que NÃO alimenta a aplicação.

Evidência discriminante: o almoço `Almoço econômico — Montmartre · €65 / 5` às 13h está na branch de produção e na captura do usuário, mas não na branch main. Inversamente, as três novas atividades estavam apenas na main. Isso confirma a causa do desaparecimento; as hipóteses anteriores de cache e outbox eram problemas possíveis de código, mas não explicavam a divergência principal.

**Reparo executado diretamente na branch ativa**, database `viaggio_lab`, schema `viaggio_app`, com inserção idempotente de três IDs originais, sem UPDATE/DELETE: outlet 25/11 às 10h (`243d00de-4670-4f31-a837-759da09c9920`), Boris Lumé 25/11 às 16h (`183355e5-0785-4cbd-956c-d476bbb996ab`) e Notre-Dame 26/11 às 08h30 (`cfc110de-e48e-4b59-9440-170aed939184`). Consulta de confirmação mostrou sete atividades em 25/11 e oito em 26/11, com almoço, lanche, Montmartre, jogo e demais compromissos preservados.

**Regra obrigatória para manutenção futura:** qualquer SQL que altere dados do Viaggio deve informar explicitamente `project_id`, `branch_id` e `database_name` e verificar a correspondência com o endpoint `API_ROOTS`. Nunca presumir que a branch padrão Neon seja a branch usada pelo aplicativo. A confirmação no iPhone ainda é necessária para encerrar o incidente.
