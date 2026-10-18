# Viaggio — laboratório Neon (isolado)

Este experimento **não altera as viagens atuais**. Não substitui o Supabase até que os testes passem. Não contém nem deve receber senhas, tokens ou connection strings.

## Objetivo
Validar **um projeto Neon por usuário**, no plano Free, sem cartão, com quotas independentes; depois avaliar colaboração entre proprietários diferentes.

## Confirmação oficial em 18/10/2026
- Neon Free: **100 projetos por conta, 1 GB de Postgres por projeto, 5 GB de Object Storage por projeto, 100 CU-hours por projeto/mês**.
- O cadastro Free não exige cartão.
- Essas franquias são **por projeto na mesma conta Neon**; o total de projetos continua limitado.
- Armazenamento de objetos, Auth e Functions são componentes próprios do Neon — não surgem ao executar apenas o SQL.

Referência: https://neon.com/pricing e https://neon.com/blog/neon-free-plan-1-gb-per-project

## Etapas — em ordem
1. Conectar o plugin Neon ao ChatGPT (autorização no provedor, sem colar senha ou chave na conversa).
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

Status: **G1–G5 não comprovados** até que existam recursos Neon reais e os testes sejam executados.

## Segurança
- Não abrir a API SQL publicamente só porque o projeto é individual.
- Não colocar `NEON_API_KEY`, `DATABASE_URL`, token S3 ou secrets em `index.html`, JavaScript do cliente ou arquivos versionados.
- Não migrar dados pessoais nem remover o Supabase existente nesta fase.
- Não criar projetos por cliques repetidos sem idempotência e sem verificar a quota de 100.
- Não habilitar plano pago. Em qualquer dúvida, interromper o provisionamento.

## Próximo passo
Usar a conexão Neon do ChatGPT para criar os dois ambientes e aplicar este esquema. Só depois criar a tela navegável de teste, alimentada por dados reais e identificada como experimento.
