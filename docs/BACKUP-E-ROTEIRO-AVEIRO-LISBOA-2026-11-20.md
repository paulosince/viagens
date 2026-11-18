# Viaggio — backup e revisão do dia 20/11/2026 (Aveiro → Lisboa → Paris)

**Data de execução:** 18/11/2026. **Status:** alterações efetivadas somente no dia 20/11, na fonte canônica do Neon.

## Banco correto e origem

- Projeto: `fragrant-credit-68065034`
- Branch ativa: `br-silent-band-b80nklzl`
- Banco/schema: `viaggio_lab.viaggio_app`
- Viagem: `cc4b6649-edf1-422d-867d-c9740020da1c` (Paris & Lisboa)
- Dia 20/11: `622b0b04-2ce5-4b06-b090-1e7d6c77f6ab` (posição 2)
- **Não confundir com branch principal/default do projeto**, que contém versões antigas. Consultar `AGENTS.md` e `docs/FONTE-CANONICA-NEON.md`.

## Backup ANTES da edição (Neon branch filha)

- **Nome:** `backup-antes-revisao-aveiro-lisboa-2026-11-18`
- **ID:** `br-small-glade-b82nobh0`
- **Parent branch:** `br-silent-band-b80nklzl`
- **Parent LSN:** `0/14FFC600`
- **Parent timestamp:** `2026-11-18T17:55:52Z`
- **Status confirmado:** `ready`
- Criada via `create_branch` com `no_compute:true`. Cópia transacional do banco (não é um dump SQL, nem um backup independente de objetos do bucket). A branch permanece distinta da produção e não foi restaurada sobre nenhum banco.
- Tentativa anterior de `create_snapshot` sobre a branch não-raiz foi rejeitada pelo Neon; **o backup efetivamente criado é a branch filha**, não um snapshot.

## Estado anterior do dia 20

Antes da edição: 8 atividades, 7 locais, 2 anexos, 2 registros de orçamento. Título: **Castelo, Au Revoir Lisboa, Boa Noite Paris**. A programação incluía Castelo de São Jorge às 09h, lancha no Tejo às 11h, almoço no Doca de Santo às 12h30, retorno a um hotel em Lisboa às 15h30, chegada ao aeroporto de Lisboa às 17h, lanche às 18h, Easy Go Shuttle às 23h e Yooma às 23h59. O status de foto, links e detalhes completos permaneceram preservados na branch de backup.

Os anexos do dia incluíam **Reserva no Doca de Santo**, `IMG_2287.png` (ticket de 12h30), e `IMG_2292.png` (não classificado). Ambos permaneceram associados ao dia, sem mudanças nem exclusão de objetos.

Orçamento anterior do dia, preservado:
- `€100` previstos para almoço Doca de Santo (não pago)
- `€20` previstos para lanche Lisboa T2 (não pago)

## Estado novo — roteiro do dia 20

| Início planejado | Atividade | Natureza |
|---|---|---|
| 05h30 | Hotel Jardim (Praceta D. Afonso V, Aveiro) → estação | Transporte a contratar |
| 05h45 | Chegada à estação de Aveiro | Embarque |
| **06h16** | **Alfa Pendular AP 180 → Lisboa-Oriente** | Grade ferroviária consultada, bilhetes pendentes |
| **08h22** | Chegada a Lisboa-Oriente | Grade ferroviária |
| 08h40 | Recolha das malas pela LUGGit (entrega no aeroporto T1) | **Não contratada** |
| 09h10 | Praça do Comércio | Caminhada livre |
| 09h35 | Rua Augusta | Caminhada livre |
| 09h55 | Elevador de Santa Justa (exterior) | Fotos sem fila para subida |
| 10h15 | Carro para a Doca de Santo Amaro | Transporte a contratar |
| 11h00 | Lancha pelo Tejo, cerca de 1h | Operador e horário a confirmar |
| **12h30** | **Doca de Santo — almoço para cinco** | Reserva existente e ticket preservados |
| 14h00 | Doca de Santo → Freeport Alcochete | Transporte a contratar, tempo variável |
| 14h45 | Compras de casacos e roupas de inverno | Horário-alvo |
| **16h15** | Freeport → aeroporto | Transporte a contratar |
| 17h00 | Recolha da bagagem em Lisboa T1 e transfer interno ao T2 | Serviço LUGGit a contratar |
| 18h00 | Jantar-lanche | €20 existentes, não pagos |
| **19h20** | **Ryanair FR1083 → Paris-Beauvais** | Voo existente preservado |
| 22h50 | Chegada programada a Beauvais | Programação do voo |
| 23h00 | Easy Go Shuttle para Paris | Transfer da agenda original; 23h é só referência |
| 23h59 | Yooma Urban Lodge Paris | Marcador; chegada pode ocorrer depois de 00h de 21/11 |

## Alterações de dados e garantias

- Atualizadas as 8 atividades preexistentes mantendo seus IDs, com informações incorretas do hotel de Lisboa e Castelo removidas do **dia 20**.
- Adicionadas 12 atividades, totalizando **20**, e 7 locais, totalizando **14**.
- Os 2 tickets e 2 registros de orçamento ficaram intactos, conforme leitura posterior; **não foram inventados preços** de trem, LUGGit, lancha nem transfer.
- A foto de Castelo não foi associada indevidamente à Praça do Comércio; objeto original está retido no backup.
- A capa do dia foi substituída por uma imagem urbana de Lisboa já usada na viagem; a foto anterior de uma croisière em Paris era incompatível com o tema.
- A verificação SQL pós-escrita confirmou o título, as 20 atividades ordenadas, os tickets intactos, os orçamentos e 14 locais.
- **O dia 19/11 não foi editado nesta operação.** Ele ainda contém a programação antiga em Lisboa/Freeport e requer correção posterior para refletir Hotel Jardim Aveiro, passeio moliceiro e jantar no centro. Não esquecer de revisar isso antes de iniciar o roteiro do dia 19.
- A aplicação é **local-first**; dados do Neon não asseguram automaticamente sincronização já comprovada no dispositivo.

## Verificação de terceiros em 18/11/2026

- CP: grade AP 180 Aveiro 06h16 → Lisboa Oriente 08h22 ([tabela CP](https://www.cp.pt/info/documents/d/cp/comboios-alfa-pendular-intercidades-lisboa-norte-sul)).
- LUGGit: serviço de recolha e entrega, incluindo Oriente → aeroporto, disponível em princípio mas não reservado ([LUGGit](https://luggit.app/pt/blog/luggage-storage-lisbon-oriente-station/); [pontos de encontro](https://luggit.app/pt/meeting-points/lisbon)).
- Freeport: horário de sexta-feira e distância aproximada ao aeroporto ([horários](https://www.freeportfashionoutlet.pt/horario-de-funcionamento); [operador](https://www.viaoutlets.com/portfolio/freeport-lisboa-fashion-outlet)).
