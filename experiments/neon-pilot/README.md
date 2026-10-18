# Viaggio — laboratório Neon (isolado)

Este experimento **não altera as viagens atuais**. Não substitui o Supabase até que os testes passem. Não contém nem deve receber senhas, tokens ou connection strings.

## Objetivo
Validar **um projeto Neon por usuário**, no plano Free, sem cartão, com quotas independentes; depois avaliar colaboração entre proprietários diferentes.

## Confirmação oficial em 18/10/2026
- Neon Free: **100 projetos por conta, 1 GB de Postgres por projeto *anunciado* (20 GB de PostgreSQL agregados por conta), 5 GB de Object Storage por projeto, 100 CU-hours por projeto/mês**.
- O cadastro Free não exige cartão.
- **Ressalva crítica:** o banco PostgreSQL tem teto **agregado de 20 GB por conta Free**, independentemente dos 100 projetos. Portanto, não é possível prometer 1 GB a 100 usuários sob a mesma conta.
- **Divergência verificada em 18/10/2026:** os dois projetos de laboratório retornam `branch_logical_size_limit_bytes = 536870912` (512 MiB por branch) na API, abaixo do 1 GB nominal do plano. Não assumir qual limite prevalecerá sem testar.
- Armazenamento de objetos, Auth e Functions são componentes próprios do Neon — não surgem ao executar apenas o SQL.

Referência: https://neon.com/pricing e https://neon.com/blog/neon-free-plan-1-gb-per-project

## Etapas — em ordem
1. **Concluído:** conector Neon autorizado no ChatGPT; não foi necessário expor senhas ou chaves.
2. Confirmar que a organização é realmente **Free**, que não possui meio de pagamento habilitado e que existe vaga para dois projetos.
3. Criar **um projeto de teste** (não de produção), com nome `viaggio-lab-a`; anotar somente seu ID público. Não copiar credentials para GitHub.
4. Executar `schema.sql` nesse projeto, inserir dados totalmente fictícios e verificar consultas/leitura/escrita e uso do banco.
5. Criar `viaggio-lab-b`, verificar que um não reduz a quota do outro e que cada projeto realmente tem limites independentes.
6. Provisionar um bucket **privado** no Object Storage do primeiro projeto e testar upload/download de foto fictícia por URL assinada. O bucket deve ter credenciais somente no servidor, nunca no PWA.
7. Construir e testar ponte autenticada para compartilhamento de viagem entre usuários de projetos diferentes, com autorização revogável, edição concorrente e sincronização offline.
8. Simular limites e erros; confirmar que nenhum teste ativa faturamento nem deixa dados reais vulneráveis.

## Gates
- **G1:** Dois projetos reais no Neon Free, sem cartão.  
- **G2:** Banco isolado e operação CRUD protegida por autenticação.  
- **G3:** Armazenamento privado, consumo verificável, upload/download.  
- **G4:** Compartilhamento de viagem entre projetos sem duplicação de franquias.  
- **G5:** Teste no PWA instalado no iPhone, incluindo perda de conexão e restauração.

Status em 18/10/2026:
- **G1 parcial:** dois projetos reais já criados no plano Free, `viaggio-lab-onboarding-01` (`fragrant-credit-68065034`) e `viaggio-lab-onboarding-02` (`sparkling-field-13794641`). Ambos pertencem **à mesma organização**, não a usuários diferentes. Não há verificação programática da ausência de cartão cadastrado, apenas do plano Free.
- **G2 parcial:** schema `viaggio_lab` criado em ambos e PostgreSQL gravando e lendo dados fictícios isoladamente. Projeto 01 tem uma viagem de teste e um prazo de ingresso; projeto 02 tem outra viagem e nenhum prazo. **Ainda não existe autenticação da aplicação nem autorização de compartilhamento**.
- **G3 parcial:** bucket `viaggio-lab-media` criado com `access_level=private` nos dois projetos. A geração de URLs temporárias de upload foi verificada; **o envio de bytes reais e o download ainda não foram executados**.
- **G4 aberto:** compartilhamento e edição concorrente entre projetos não implementados.
- **G5 aberto:** PWA iPhone não testado.
- **Bloqueio arquitetural:** 20 GB PostgreSQL no total da organização Free. O modelo atual não garante 1 GB de banco para 100 viajantes simultaneamente. O fluxo de transferência do projeto para a conta Neon do próprio usuário está em *private preview* e requer aprovação como parceiro; projetos Claimable temporários não dão acesso a Object Storage antes da reivindicação.

## Segurança
- Não abrir a API SQL publicamente só porque o projeto é individual.
- Não colocar `NEON_API_KEY`, `DATABASE_URL`, token S3 ou secrets em `index.html`, JavaScript do cliente ou arquivos versionados.
- Não migrar dados pessoais nem remover o Supabase existente nesta fase.
- Não criar projetos por cliques repetidos sem idempotência e sem verificar a quota de 100.
- Não habilitar plano pago. Em qualquer dúvida, interromper o provisionamento.

## Próximo passo
**Não migrar o Viaggio de produção.** Implementar um backend autenticado que vincule cada conta do Viaggio a exatamente um projeto Neon, provisione projetos com API key somente no servidor, limite a 20 adesões e recuse novos cadastros ao atingir os tetos. Integrar reservas de upload com presign do Neon e comprovação física do tamanho (HEAD), exclusão de objetos e reconciliação de uploads expirados. Testar partilha e sincronização entre dois projetos antes de expor qualquer interface de produção.

## Resultados verificáveis (18/10/2026)

| Etapa | Projeto 01 | Projeto 02 |
|---|---|---|
| Organização | Free | Free |
| Esquema `viaggio_lab` | Criado | Criado |
| Viagens fictícias encontradas | LAB A - Viagem ficticia | LAB B - Roteiro ficticio |
| Prazo de ingresso fictício | 1 | 0 |
| Tamanho físico de banco via `pg_database_size` | 7.888.896 bytes | 7.872.512 bytes |
| Bucket privado `viaggio-lab-media` | Verificado | Verificado |
| Geração de URL temporária de upload | Verificada | Verificada |

Os valores de `pg_database_size` são medidas instantâneas do PostgreSQL, **não a métrica de faturamento/limite lógico do Neon**; não equipará-los. Evidências obtidas com leitura nos projetos reais através do conector Neon.

Referências adicionais:
- https://neon.com/docs/introduction/plans (limite agregado 20 GB)
- https://neon.com/docs/workflows/claimable-database-integration (transferência em private preview)
- https://neon.com/docs/reference/claimable-neon (projetos temporários não suportam Object Storage antes da reivindicação)

## Teste de limites: 18/10/2026 (laboratórios Neon reais)

- `settings.quota.logical_size_bytes=400000000` foi **configurado** nos dois projetos; leitura da API confirmou o valor. **Não foi feito teste de preenchimento até 400 MB para provar o bloqueio físico.**
- Instalada a implementação experimental de `storage-quota.sql` em ambos os bancos. Cada projeto inicia com `allowance_bytes=4000000000` (4 GB decimais).
- Reserva de 100 MB no projeto 01 e 200 MB no 02: retornaram saldo correto de 3,9 GB e 3,8 GB; os registros ficaram isolados.
- Reserva idempotente: chamada repetida com mesmo `upload_id`, chave e tamanho não contabilizou novamente.
- Tentativas de reservar 3,95 GB (com 3,9 GB livres no projeto 01) e 3,9 GB (com 3,8 GB livres no 02) retornaram `STORAGE_QUOTA_EXCEEDED`.
- Teste de concorrência: duas reservas de 2,4 GB feitas em paralelo no projeto 01; **uma aceita, outra recusada** porque as duas somadas excederiam 4 GB.
- Todos os testes reservaram bytes **fictícios**, sem criar objetos S3. Reservas de teste foram canceladas. Medição final em cada projeto: `reserved_bytes=0`, `committed_bytes=0`.
- Controle do banco via Neon e controle de reservas no SQL **não garantem sozinhos** o limite real de arquivos: falta servidor verificador de tamanho, emissão controlada de URLs, remoção de uploads órfãos e conciliação com Neon Object Storage. Também não testamos alta concorrência ou erros de rede no PWA.
- A documentação oficial do plano Free fixa **20 GB agregados de armazenamento PostgreSQL na organização**; 20 × 400 MB = 8 GB são comportados em tese, mas deve haver reserva para o catálogo do Viaggio e overhead.
- Nenhum cadastro de usuário, login, compartilhamento ou transição do Supabase de produção foi alterado.

**Status de produção:** DESATIVADO. Somente laboratório Neon testado. Não anunciar franquias garantidas antes de uma camada de servidor autenticado controlar a escrita de bytes reais e a sincronização multiusuário.
