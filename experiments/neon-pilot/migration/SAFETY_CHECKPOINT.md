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
