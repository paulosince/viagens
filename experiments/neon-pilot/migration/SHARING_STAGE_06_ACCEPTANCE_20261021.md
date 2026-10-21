# Viaggio — migração Supabase → Neon — Etapa 06/14

**STATUS: CONCLUÍDA NO ESCOPO DE IMPLEMENTAÇÃO E REGRESSÃO TÉCNICA EM STAGING — 2026-10-21.**
**Progresso da sequência fixa: 6/14.** Nenhum item extra foi criado.

## Escopo da etapa
Roteamento para proprietário do projeto, compartilhamento de viagem por e-mail, perfis `viewer/editor`, convites de contas ainda não cadastradas, reivindicação posterior de convites e revogação pelo proprietário, com RLS e falha fechada.

## O que foi confirmado diretamente no Neon
- Projeto A (Cíntia): 4 viagens, 5 registros de `trip_members` (4 owner, 1 editor) e **0 convites pendentes** no instante da inspeção.
- Projeto B (Paulo): 0 viagens, 0 registros de `trip_members`, 0 convites pendentes.
- O único compartilhamento ativo tem duas identidades Neon distintas, proprietário e convidado editor. Os testes com JWT assinado nas duas contas da etapa 04 já haviam confirmado visibilidade correta de uma viagem compartilhada por Paulo e quatro próprias para Cíntia.
- Nos projetos A e B, funções já existentes `viaggio_app.invite_trip_by_email`, `list_trip_shares`, `remove_trip_share`, `list_trip_members`, `claim_trip_invitations` e `share_trip_with_email` têm `EXECUTE` disponível para `authenticated`.
- A inspeção do código PostgreSQL confirma que `invite_trip_by_email` permite apenas ao proprietário convidar, suporta `viewer/editor`, registra convite pendente por e-mail quando a conta antiga ainda não existe no diretório privado e atualiza membership quando já existe.
- `remove_trip_share` limita a revogação ao proprietário e não remove o `owner`; cobre registros de convites pendentes e `trip_members`. `list_trip_shares` só permite consulta pelo proprietário.
- `trip_invitations` tem **RLS habilitado e nenhum privilégio direto SELECT/INSERT/UPDATE/DELETE para `authenticated`**. A alteração é mediada pelas funções `SECURITY DEFINER` que verificam a identidade. As tabelas de viagens, membros e atividades têm RLS habilitado.
- A tentativa de simular diretamente claims de JWT por SQL em ambiente de teste foi barrada por proteção da ferramenta; não há evidência nova dessa simulação nesta etapa. Os resultados reais anteriores da etapa 04 e os testes estáticos/HTTP são evidências separadas.

## Correção efetivamente implementada
- `claim_trip_invitations()` retorna **integer** em cada banco. O antigo router indevidamente aplicava uma fusão de arrays, retornando `[]` em vez da soma numérica. Novo `router-neon.mjs` soma inteiros não negativos dos projetos A/B, propaga falha de qualquer projeto e recusa respostas inesperadas.
- `shared_trip_owners()` continua agregando listas, mas agora exige respostas de array de ambos os projetos em vez de ignorar resposta inválida.
- Convites, listagem e revogação com `p_trip_id` já eram encaminhados corretamente via identificação da viagem; foram preservados, não reimplementados.
- A tela de compartilhamento requer confirmação explícita antes de revogar acesso e avisa que cópias offline antigas só poderão refletir a revogação após reconexão.
- O módulo corrigido é isolado em `experiments/neon-pilot/app/router-neon.mjs` e `backend-neon.mjs` da prévia referencia somente esse módulo. O `router.mjs` da prévia antiga permanece intacto, assim como o app principal do Viaggio.
- `neon-preview.html` chama `main-neon.js?v=20261021-2` para contornar cache antigo do Safari.

## Evidências de validação
- [CI de compartilhamento — GitHub Actions 39676777988](https://github.com/paulosince/viagens/actions/runs/39676777988): **15/15 testes**. Cobrem envio/listagem/revogação direcionados ao projeto da viagem, contas sem permissão e viagens invisíveis, convites somados numericamente, falha parcial ou resposta incorreta, visibilidade de perfil pessoal e gravações bloqueadas pelo RLS simulado.
- [CI HTTP staging — GitHub Actions 39675833776](https://github.com/paulosince/viagens/actions/runs/39675833776): ambos os Data APIs rejeitaram token JWT **forjado** ao chamar `invite_trip_by_email` e `remove_trip_share`. Nenhum convite/revogação real foi criado.
- [Regressão token-refresh da etapa 05 — 39676777961](https://github.com/paulosince/viagens/actions/runs/39676777961): aprovado com o roteador exclusivo da etapa 06.
- [Live preview — GitHub Actions 39676778152](https://github.com/paulosince/viagens/actions/runs/39676778152): quatro arquivos da prévia publicados responderam HTTP 200, referências ao módulo correto e cache-buster verificadas; inicialização com Chrome em sessão anônima, sem exceções JavaScript.
- Código publicado aditivamente em `https://paulosince.github.io/viagens/experiments/neon-pilot/app/neon-preview.html`; código e workflows registrados na branch `migration/neon-app-20261019`.

## Limites claros: sem efeitos sobre os compartilhamentos atuais
- **Não executamos um convite positivo novo ou uma revogação real no PostgreSQL**, pois isso alteraria relações pessoais de acesso. Os testes de escrita foram mocks controlados e rejeições por JWT falso; as implementações das rotinas existentes foram inspecionadas diretamente.
- A revogação de acesso online é aplicada pela RLS quando houver nova consulta; **cópias de dados já descarregadas offline não podem ser apagadas remotamente** sem reconexão e limpeza apropriada. Avaliar estado e sincronização na etapa **09/14** já existente.
- Convidados ainda não provisionados no diretório privado precisam ser integrados no processo de onboarding beta; esse pré-requisito está dentro do escopo de novas contas e gestão nas etapas de integração e quotas, sem etapas extras.
- Segurança funcional de convite/revogação é aprovada com base em SQL existente, auditoria de permissões e testes de regressão. **O teste positivo ponta a ponta de convite e revogação deverá ser repetido em um ambiente descartável antes do corte de produção na etapa 14**. Não alegar que foi realizado nesta etapa.

## Estado final
- **6/14 concluídas tecnicamente**, 8 restantes.
- **Próxima 07/14:** integração de leitura, upload e exclusão de mídia privada Neon, com JWT, autorização e integridade; não habilitar presigned URLs sem checagem de acesso à viagem. Fonte Supabase e produção continuam preservadas.
