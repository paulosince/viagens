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
