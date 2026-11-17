# Instruções obrigatórias — Viaggio

## PRIORIDADE MÁXIMA: dados reais de produção no Neon (verificado em 17/11/2026)

**NUNCA usar a branch padrão/main por omissão** em consultas ou alterações de dados de viagens. O aplicativo usa branches NÃO padrão do Neon. A branch main tem tabelas com os mesmos nomes e IDs, mas registros antigos e divergentes. **Isso já causou repetidos erros reais de manutenção.**

Antes de qualquer leitura, diagnóstico ou escrita no banco:
1. Ler `docs/FONTE-CANONICA-NEON.md` e `experiments/neon-pilot/app/backend-neon.mjs`.
2. Confirmar que os `API_ROOTS` do código ainda correspondem às Data APIs das branches indicadas no documento. Se houver divergência, **parar a escrita** e investigar o roteamento atual.
3. Em **toda chamada** `mcp__Neon__run_sql`, `run_sql_transaction`, `get_database_tables` ou `describe_table_schema`, informar expressamente `project_id`, `branch_id` e `database_name`. Nunca depender de defaults.
4. Localizar a viagem por ID nos projetos A e B antes de selecionar o destino de escrita. A escrita deve ocorrer **somente** no projeto/branch que contém a viagem e depois de conferir os registros reais do dia. Se a viagem aparecer em ambos ou nenhum, não alterar.
5. A data do dia é `trips.start_date + trip_days.position` (posição zero-based). Conferir todas as atividades, anexos e status de compra antes de alterar. Não descartar itens pagos, reservas ou pendências locais.
6. Lembrar que o app é local-first: IndexedDB/outbox pode manter diferenças ainda não sincronizadas. Mudança no Neon não garante, sozinha, que o aparelho já exiba a versão nova. Não declarar validação no aparelho sem teste.

### Endereçamento de produção confirmado
- **Dados A**: projeto `fragrant-credit-68065034`, branch `br-silent-band-b80nklzl` (NÃO `main`), banco `viaggio_lab`, schema `viaggio_app`; Data API `ep-empty-pine-b8r7sa8d`.
- **Dados B**: projeto `sparkling-field-13794641`, branch `br-falling-leaf-b8xuv1d0` (NÃO `main`), banco `viaggio_lab`, schema `viaggio_app`; Data API `ep-spring-moon-b8fi6yxc`.
- A autenticação Neon é separada dos dois projetos de dados. Nenhuma gravação de roteiro deve ser direcionada ao projeto de autenticação ou ao Supabase.
- Estrutura ativa da agenda: `viaggio_app.trips` → `viaggio_app.trip_days` → `viaggio_app.activities`; pontos em `day_locations`, tickets em `day_attachments`, orçamento em `budget_items`. `state_snapshots` é histórico, **não** a agenda ativa.

**Falha concreta de 17/11/2026:** a consulta sem `branch_id` devolveu para 26/11 o antigo título “Emily in Paris & Miraculous”, enquanto a branch ativa tinha “Luxemburgo — centro histórico e Winterlights”. A igualdade de `trip_id` e `day_id` entre branches NÃO é evidência de que se esteja na branch certa.

## Fluxo geral do projeto

- Este repositório é publicado diretamente em `origin/main` após as verificações pertinentes.
- Antes de publicar, inspecionar o diff, preservar trabalho remoto/do usuário, sincronizar com `origin/main`, executar os testes e publicar. Paulo aprovou pushes diretos na main para este projeto; prompts de segurança da plataforma podem exigir confirmação.
- Manter transições da UI orientadas por CSS, preservar comportamento reativo/estável do DOM e salvar a partir do estado do aplicativo, não raspando HTML renderizado.
- Para alterações no app shell, incrementar `CACHE_NAME` do service worker e atualizar URLs versionadas em `index.html` e `APP_SHELL`. Sem mudança do `sw.js`, o gerenciador de atualização PWA pode não identificar a nova versão.
