# Viaggio — fonte canônica de dados em produção (Neon)
**Última verificação direta: 17/11/2026.** Consultar também o aviso prioritário em [AGENTS.md](../AGENTS.md).

## Por que este documento existe

Os dois projetos de dados do Neon mantêm **branches `main` com tabelas e IDs semelhantes aos da produção**, porém com conteúdo diferente. Ferramentas de SQL e inspeção, se chamadas sem `branch_id`, podem consultar a branch padrão sem indicar claramente ao operador que não é a branch ativa do Viaggio. Esse erro já ocorreu repetidas vezes, inclusive em 06/11 e 17/11/2026.

**Regra absoluta:** não consultar nem escrever dados do roteiro com parâmetros implícitos; localizar primeiro o banco/branch da API efetivamente usada pelo aplicativo.

## Mapa técnico confirmado

| Papel | project_id | branch_id usado pelo APP | database_name | Data API, identificador |
| --- | --- | --- | --- | --- |
| Dados A | `fragrant-credit-68065034` | `br-silent-band-b80nklzl` (`auth-federation-validation-20261020`) | `viaggio_lab` | `ep-empty-pine-b8r7sa8d` |
| Dados B | `sparkling-field-13794641` | `br-falling-leaf-b8xuv1d0` (`auth-federation-validation-20261020`) | `viaggio_lab` | `ep-spring-moon-b8fi6yxc` |

- **Código fonte decisivo:** `experiments/neon-pilot/app/backend-neon.mjs` → `API_ROOTS` e `pg.schema('viaggio_app')`.
- **Roteamento efetivo:** `experiments/neon-pilot/app/router-neon.mjs` → leitura agregada A+B; gravação dirigida ao projeto onde a viagem/registro está localizado. **Não há um fallback “escreva sempre em A”.**
- **Entidades principais do schema `viaggio_app`:** `trips`, `trip_days`, `activities`, `day_locations`, `day_attachments`, `budget_items`. O histórico em `state_snapshots` não substitui a leitura da agenda ativa.
- **Branches erradas para produção:** `br-dawn-bread-b83r0ztn` (A/main) e `br-proud-paper-b83l1z7d` (B/main). Mesmo quando um ID existe nelas, não usar para edições do app.
- O projeto `dark-union-03886858` é de **autenticação**, não contém o roteiro a editar. A integração MCP legada com **Supabase não é fonte de dados do Viaggio atual**.

## Procedimento obrigatório em cada alteração

1. Ler `AGENTS.md` e este arquivo antes da primeira operação.
2. Ler **o código atual** de `backend-neon.mjs`, extrair `API_ROOTS` e confirmar, com `get_data_api`, qual `project_id` e `branch_id` corresponde a cada URL. Se o código mudou, o mapa deste arquivo precisa ser revisto **antes** de escrever.
3. Nas ferramentas de Neon, informar em **todas** as operações os três argumentos: `project_id`, `branch_id`, `database_name: "viaggio_lab"`. Isso vale inclusive para consultas exploratórias de tabelas, schema, títulos e datas.
4. Pesquisar a viagem nos projetos A e B **nas branches ativas**, usando `viaggio_app.trips` e seu `id`; só editar no projeto/branch onde o ID está presente uma única vez.
5. Identificar o dia em `viaggio_app.trip_days` pelo `trip_id` e `position`. A data é derivada de `trips.start_date + trip_days.position`. Ler `activities`, `day_locations`, `day_attachments` e, quando pertinentes, `budget_items` antes de modificar.
6. Em correções, usar o menor conjunto de alterações, manter IDs e dados válidos, preservar ingressos/atividades pagas, evitar deleções irreversíveis e conferir o resultado lendo **a mesma branch ativa**.
7. O app armazena dados em IndexedDB e possui fila offline/outbox; inserções no Neon podem não aparecer no telefone até ocorrer leitura remota/sincronização. Não assumir que o aparelho foi validado só porque SQL retornou os dados.

### Exemplo explícito (leitura, projeto A)

```javascript
await tools.mcp__Neon__run_sql({
  project_id: "fragrant-credit-68065034",
  branch_id: "br-silent-band-b80nklzl",
  database_name: "viaggio_lab",
  sql: "SELECT id, name, start_date FROM viaggio_app.trips WHERE deleted_at IS NULL"
});
```

Para o projeto B, usar os três argumentos correspondentes ao projeto B. A ferramenta `run_sql` sem branch retorna dados potencialmente divergentes, mesmo quando não há erro SQL.

## Evidência comparativa reproduzida em 17/11/2026

Consulta de `trips` + `trip_days` com IDs de dia iguais nas duas branches do projeto A:

| Dia | A/main (**não** utilizada pelo aplicativo) | A/`br-silent-band-b80nklzl` (**produção**) |
| --- | --- | --- |
| 23/11 | `De Luxemburgo ao Arco do Triunfo`, 7 atividades | `Da casa da Emily ao Arco do Triunfo`, 11 atividades |
| 26/11 | `Emily in Paris & Miraculous — cenas e personagens`, 6 atividades | `Luxemburgo — centro histórico e Winterlights`, 5 atividades |

Isto demonstra que **o mesmo registro aparente pode ser uma versão histórica, não o estado atual**. A branch de produção foi identificada tanto pelo endpoint do código quanto pela configuração atual da Neon Data API, não somente pelo título da atividade.

### Fontes adicionais do próprio repositório

- [Auditoria de arquitetura de 15/11/2026](ARCHITECTURE-AUDIT-2026-11-15.md), seção 3 — branches efetivas e roteamento.
- [Incidente de sincronização de 06/11/2026](NEON-SYNC-ARCHITECTURE-AND-INCIDENT-2026-11-06.md), seção *CAUSA RAIZ CONFIRMADA: BRANCH NEON INCORRETA* — documenta a repetição deste mesmo problema.

**Não considerar este inventário imutável:** em eventual migração de infraestrutura, atualizar o arquivo após revalidar os endpoints ativos no código e os bancos correspondentes.
