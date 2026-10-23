# Viaggio migration safety checkpoint — 2026-10-19

Production stays on Supabase until verified cutover. Do not delete source records or objects.

Verified staging: four trips including two soft-deleted, 160 state snapshots and 31 historical photos. All 31 historical photos matched source hashes.

Remaining: 76 private Storage objects (about 120 MB) inventoried but not transferred. The application also relies on Supabase Auth, sharing RPCs, storage permissions and offline synchronization. The Neon JSON staging tables are not a drop-in replacement for production relational tables.

Next gate: authenticated, resumable media transfer to a private Neon bucket; verify source and destination size and digest for each object, then audit quota and missing objects. Keep source intact.

After that: implement relational schema and row-level authorization, validate family accounts and sharing, test offline editing and conflict recovery on an isolated preview, and perform an explicit approved cutover with rollback.


## Audit reconciliação — 22/10/2026 (prévia Neon, sem cutover)
- Comparação PostgreSQL: **13 de 15 tabelas possuem contagens e fingerprints iguais** entre Supabase de produção e Neon de prévia. As exceções são `state_snapshots` e `change_log`, ambos contendo **um registro adicional exclusivo do ambiente de teste** após a restauração de registros ausentes.
- Restaurados na prévia o local **Yooma Urban Lodge Eiffel**, seu vínculo com a atividade "Manhã livre - mercado" e a descrição original de "Transfer para o Aeroporto de Beauvais"; inseridos dois snapshots e dois itens de change_log ausentes, sem apagar históricos exclusivos da prévia.
- **76/76 arquivos** do inventário apontam para 76/76 objetos no bucket privado `viaggio-lab-media`; tamanho e **ETag físico do objeto coincidem com os da origem para todos os 76**. ETag igual não substitui a validação SHA-256 por leitura dos bytes.
- Funções `appmedia` dos branches isolados A/B receberam override de endpoints JWKS/base da **autenticação Neon central**, criando deployment #2 completed em ambos. Acesso HTTP autenticado às fotos ainda requer confirmação no iPhone; 503 **não considerado resolvido** sem resultado físico positivo.
- O RPC `viaggio_app.media_read_manifest` foi adicionado somente ao branch de prévia A; rejeita requisições sem identidade autenticada. Não está integrado ao gateway existente nem ao aplicativo em produção.
- **Bloqueios até cutover:** execução do diagnóstico real com JWT, hash SHA-256 físico, auditoria completa dos snapshots históricos e testes de compartilhamento/offline. Não excluir nem modificar arquivos de origem.


## Gate 1/4 — autorização de dados pessoais (23/10/2026)

- Revisadas as políticas RLS nas tabelas `viaggio_app.passenger_profiles` e `viaggio_app.saved_passengers` nos projetos A e B. As políticas `project_personal_profile` e `project_saved_passengers` estão corretamente marcadas como **RESTRICTIVE**, portanto se combinam por AND com políticas permissivas de identidade própria. O alerta anterior de autorização ampla por OR era um **falso positivo**. Nenhuma mudança de RLS foi necessária.
- Validação com `SET LOCAL ROLE authenticated` e contexto JWT simulado dentro de transações somente de teste: owner do projeto A visualiza 1 perfil e 5 passageiros salvos; colaborador do mesmo projeto visualiza **0/0**; owner do projeto B visualiza 1 perfil e 0 passageiros salvos; colaborador no B visualiza **0/0**; usuário sem vínculo válido visualiza **0/0**.
- Teste negativo de escrita no projeto A: sessão de colaborador tentando `UPDATE` sobre registros do owner obteve **0 registros modificáveis** nas duas tabelas, com `SAVEPOINT` e `ROLLBACK TO SAVEPOINT`.
- **Gate 1/4 aprovado em escopo RLS dessas duas tabelas.** Os testes de sessão são simulações do contexto PostgreSQL (não substituem teste end-to-end de JWT válido pelo Data API). Não foram modificados dados, políticas ou arquivos do banco. Supabase de produção intocado.


## Gate 2/4 — CRUD relacional e restauração (23/10/2026)
- Projeto A: teste com `SET LOCAL ROLE authenticated` e claims de owner/editor vinculados comprovou INSERT de viagem, membros, dia e atividade; UPDATE pelo proprietário e editor; SELECT do valor alterado; DELETE da atividade; ROLLBACK TO SAVEPOINT; **zero registros residuais**.
- Projeto A: viagem sintética com usuário `viewer` tentou UPDATE e afetou **zero registros**; `capture_trip_snapshot`, alteração posterior e `restore_trip_snapshot` retornaram a descrição original; operações inteiramente revertidas.
- Projeto B: INSERT/UPDATE/DELETE sintéticos com identidade do próprio owner, seguidos por ROLLBACK; zero resíduos.
- Roteador `router-neon.mjs`: testes em memória sobre o código real rotearam INSERT/UPDATE/DELETE às branches corretas; INSERT de nova viagem ao projeto pessoal; rejeitaram gravação entre projetos e identificador inexistente.
- Criada em **ambiente A de testes apenas** a RPC `viaggio_app.gate2_crud_selftest()` `SECURITY INVOKER`, executável só por `authenticated`, requer `viaggio_identity.uid() = project_owner()`, executa criar/editar/ler/excluir **na mesma transação** e não deixa registros sintéticos. Simulação positiva de owner retornou os seis flags `true`; execução simulada como editor devolveu `TEST_OWNER_ONLY`. Contagens antes/depois inalteradas.
- Página de validação com sessão real Neon: `experiments/neon-pilot/app/neon-crud-diagnostics-v1.html`. O JavaScript passou na verificação de sintaxe.
- **Pendência Gate 2:** abrir página no iPhone logado no Neon e obter aprovação com JWT real; mais tarde validar operação normal na interface completa antes do cutover. A flag `allowMutations:false` presente em `backend-neon.mjs` bloqueia somente **mutações de arquivos no storage**, não o CRUD relacional.
- Nenhuma edição em Supabase de produção ou viagem real; gate 3 de upload privado continua pendente.

## Gate 2/4 — validação JWT em navegador (23/10/2026)
- O usuário executou o diagnóstico `neon-crud-diagnostics-v2.html` no iPhone e recebeu **APROVADO** com sessão Neon central autenticada, projeto pessoal **B**, criação/edição/leitura/exclusão e limpeza transacional OK.
- O primeiro diagnóstico estava errado porque fixava projeto A. A revisão 2 usa `project_context` para localizar a única branch pessoal autorizada. Essa falha era do teste, não do esquema.
- Gate 2 de CRUD essencial aprovado. Ainda falta validar a interface completa antes do cutover.

## Gate 3/4 — teste físico isolado em andamento (23/10/2026)
- Projeto B: bucket privado `viaggio-lab-media` ativo; implantada a função separada `mediatest` (deployment 1: completed) com operação temporária de upload/GET SHA-256/DELETE/confirmação de ausência no prefixo `tests/`. Somente owner B autenticado por JWT e RPC `project_context` está autorizado; arquivo e caminho são gerados pelo servidor e tamanho máximo 128 KiB. Nenhum arquivo de viagem é admitido nesse teste.
- Criada página `experiments/neon-pilot/app/neon-storage-diagnostics-v1.html`; JS validado em sintaxe e commitado. **Aguardando o resultado do teste com sessão JWT real no navegador.**
- Nenhuma mudança em `appmedia` dos projetos A/B, nem na flag `allowMutations:false` do PWA. Para liberar fotos reais ainda será necessário implementar integração segura de upload/exclusão e metadata no appmedia do projeto A, com limites de tamanho, permissão e verificação física. Não declarar gate 3 aprovado até lá.

## Gate 3/4 — integração da função appmedia B (23/10/2026)
- Captura do usuário confirmou **APROVADO** para função isolada `mediatest` B: upload, download, SHA-256 físico, exclusão e ausência após excluir (imagem sintética PNG 173 bytes).
- RPCs `viaggio_app.media_register_upload`, `media_mark_deleted` e `media_read_manifest` disponíveis nos branches staging A e B; autorizam cada caminho pela `media_access`. Exige-se testar segurança também no navegador. **Atenção**: RPCs de registro/remoção são acessíveis à role autenticada; revisar abuso de metadados/limites antes de beta público.
- Fonte do gateway de leitura original em A preservada em implantação #3. Módulos `appmedia/media-write.mjs` e `storage-sign.mjs` atualizados no GitHub; gateway de mídia escrita **somente B** implantado #3 (completed).
- Publicada e verificada via GitHub Actions a página `experiments/neon-pilot/app/neon-appmedia-gate3-v2.html` (build/deploy success, GitHub Actions run 40027066366). Testa upload com JWT real, registro SQL, download SHA-256, remoção lógica e HTTP 404 após remover, apenas usando `profile-photos` do dono B com caminho temporário. Aguardar execução e evidência do usuário.
- **Não** ativada `allowMutations` no backend de prévia, **não** implantado gateway de escrita no A e **não** houve cutover para Neon. Objetos históricos de produção intactos.

## Gate 3/4 — 503 no registro SQL; correção de cache B (23/10/2026)
- Captura iPhone do diagnóstico `neon-appmedia-gate3-v2.html`: `UPLOAD HTTP 503 / MEDIA_DATABASE_ERROR`. O upload físico sintético anterior havia sido comprovado via `mediatest`; a falha nova era no RPC de cadastro, não prova perda de arquivo.
- Analisados `media_register_upload`, `media_access`, grants e owner da tabela `viaggio_identity.media`; sem violação evidente de RLS. Possível cache PostgREST após DDL, a confirmar com sessão real.
- Enviado `NOTIFY pgrst, 'reload schema'`; realizado refresh do Neon Data API B com configuração integral restaurada e validada: `db_schemas=['public','viaggio_collab','viaggio_app']`, `db_anon_role='anonymous'`, `db_max_rows=1000`, `db_aggregates_enabled=false`, `jwt_role_claim_key='.role'`, `openapi_mode='disabled'`, `server_cors_allowed_origins='https://paulosince.github.io'`. **Importante**: update_data_api vazio resetou temporariamente as configurações para `public` e foi imediatamente corrigido; nunca usar refresh vazio novamente.
- Gateway `appmedia` B deployment **#4 completed**, com log e resposta sanitizada `MEDIA_DATABASE_<SQLSTATE ou PGRST>` para falha futura; nenhuma URL privada/credencial é exposta.
- Não houve alteração de dados reais, endpoint A ou Supabase. Ainda **não comprovado sucesso** do teste de gravação integrada; repetir `neon-appmedia-gate3-v2.html` autenticado e investigar o código se persistir.
