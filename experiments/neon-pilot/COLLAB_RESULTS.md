# Viaggio Neon — colaboração entre projetos: resultados de laboratório

**Data:** 18/10/2026

## Escopo

- Aplicação principal, fotos reais, Supabase de produção e viagens familiares não foram alterados.
- Dois projetos Neon Free previamente criados: `viaggio-lab-onboarding-01` (A) e `viaggio-lab-onboarding-02` (B).
- `collaboration-jwt.sql` aplicado aos dois projetos para obter a identidade apenas do JWT **validado pela Neon Data API**, via `request.jwt.claims`.
- A assinatura do JWT e audiência são validadas pelo gateway Neon (JWKS do Supabase). Nunca utilizar `sub` enviado pelo corpo de uma chamada.
- A autorização por RLS utiliza `can_view` e `can_edit`; alterações sensíveis ocorrem em funções específicas.
- A criação autenticada real já foi comprovada anteriormente em A pela conta de teste do Viaggio. **Compartilhamento entre duas sessões reais ainda não foi comprovado.**

## Testes executados

| Cenário | Resultado |
|---|---|
| Proprietário fictício B pode consultar sua viagem | PASS |
| Proprietário fictício B concede papel `viewer` a conta fictícia | PASS |
| Convidado `viewer` pode consultar a viagem | PASS |
| Convidado `viewer` não pode editar | PASS |
| Terceira identidade fictícia não convidada não pode visualizar | PASS |
| Proprietário muda permissão para `editor` | PASS |
| Convidado `editor` altera o título com revisão vigente | PASS |
| Edição com revisão desatualizada | PASS — `REVISION_CONFLICT` |
| Proprietário revoga permissão do convidado | PASS |
| Ex-convidado não pode visualizar ou editar | PASS |
| Função `actor_uid()` disponível para role `anonymous` | NEGADO |
| Role `authenticated` pode acessar a função `actor_uid()` | PASS |

Os testes de autorização acima simulam claims JWT dentro de transações SQL controladas. **Eles validam a lógica PostgreSQL, não substituem um teste de integração com dois JWTs reais no navegador.** Os registros fictícios usados no teste foram restaurados, e nenhum convite experimental ficou ativo.

### Segurança

- Nenhuma viagem é duplicada entre projetos; convidados acessam o banco proprietário.
- A conta B continua vinculada a um UUID **fictício**, aguardando uma segunda conta real consentida.
- APIs públicas expõem apenas o schema `viaggio_collab`, não controle de quota, dados de infraestrutura ou dados atuais do usuário.
- Não ativar o beta até testar real-time/offline, mídia privada, erros de sincronização, revogação e limites reais.

## Roteiro manual pelo Safari

1. Proprietário autenticado no Safari abre `compartilhar.html`, seleciona projeto A e escolhe uma viagem fictícia.
2. Segunda conta **consentida** abre Viaggio e `compartilhar.html` em outro navegador/dispositivo, copia o UUID.
3. Proprietário insere o UUID no projeto A e concede `viewer`. Convidado consulta o mesmo projeto A: deve visualizar apenas a viagem autorizada.
4. Convidado tenta editar: deve receber `ACCESS_DENIED`.
5. Proprietário concede `editor`. Convidado consulta e edita. Uma segunda gravação com a versão antiga deve receber `REVISION_CONFLICT`.
6. Proprietário revoga. Convidado consulta novamente e deve ver zero viagens autorizadas no projeto A, exceto outras viagens a que já tenha acesso.
7. Após receber autorização explícita da pessoa que usará a segunda conta, substituir o UUID fictício de propriedade do projeto B por seu UUID real, e repetir criação nesse projeto.

**Status:** G4 PASS na simulação SQL, G4 **ABERTO** em autenticação real de dois usuários.
