# Viaggio

Protótipo de uma plataforma de planejamento de viagens com contas separadas.

## Configuração do Supabase

1. Abra o projeto no Supabase.
2. Vá em SQL Editor → New query.
3. Cole e execute o conteúdo de supabase/schema.sql.
4. Em Authentication → Providers → Email, escolha se quer exigir confirmação de e-mail.

A aplicação usa a URL do projeto e a chave publishable/anon, que podem aparecer no frontend. A chave service_role nunca deve ser publicada.

## O que já funciona

- criação de conta com e-mail e senha;
- login e logout;
- sessão persistente;
- criação e leitura de viagens;
- isolamento por usuário usando Row Level Security.

O próximo passo é transformar cada viagem em um conjunto de tabelas: roteiro por dia, checklist, orçamento e reservas, todas ligadas a trip_id e protegidas pelas mesmas regras.

## Fotos do Unsplash

1. Execute `supabase/migrations/20260717_unsplash_photos.sql` no SQL Editor.
2. Cadastre a chave pública da aplicação como secret: `supabase secrets set UNSPLASH_ACCESS_KEY=...`.
3. Publique a função autenticada: `supabase functions deploy unsplash-photos`.

A chave fica somente na Edge Function. A interface oculta as sugestões quando a cota não está disponível e mantém o envio de foto do aparelho.


## Dias ordenados

O roteiro usa um modelo posicional:

- a viagem tem `start_date` e `day_count`;
- cada dia tem uma `position` zero-based;
- a data exibida é derivada de `start_date + position`;
- atividades armazenam `start_time`, sem repetir a data do dia;
- reduzir a quantidade de dias marca os excedentes como ocultos, preservando agenda, locais e fotos;
- ao aumentar novamente a duração, os dias ocultos voltam como recuperáveis;
- a ordem dos dias pode ser alterada pelos botões de subir/descer uma posição e é salva localmente antes da sincronização.

A migração correspondente está em `supabase/migrations/20260925_ordered_trip_days.sql`. O frontend mantém compatibilidade temporária com o schema antigo durante a transição.

## Disponibilidade offline

A aplicação é local-first para o roteiro de viagem:

- perfil, viagens, passageiros, dias, locais e agenda recebem uma cópia durável em IndexedDB;
- a abertura do app e a consulta do roteiro usam essa cópia quando o Supabase ou a internet não estão disponíveis;
- edições de dias são salvas primeiro no aparelho e entram em uma fila de sincronização;
- quando a conexão retorna, a fila é enviada ao Supabase;
- mudanças locais pendentes nunca são substituídas por uma leitura remota;
- o Service Worker mantém o app shell e imagens já visualizadas disponíveis offline;
- a Home informa se o conteúdo está sincronizado, salvo localmente com mudanças pendentes ou em modo offline.

Criação de viagens, mudança de duração/data inicial, perfil e exclusões estruturais continuam exigindo conexão. Reordenação dos dias e edição do roteiro são local-first e entram na fila de sincronização.

### Primeira cópia

Depois de publicar uma versão nova, abra o app uma vez com o Supabase acessível. O app cria um snapshot completo dos dias, agenda e locais de todas as viagens; a partir daí o roteiro pode ser consultado offline naquele aparelho.

### Keepalive

O workflow `.github/workflows/supabase-keepalive.yml` faz uma consulta diária ao projeto para reduzir a chance de pausa automática por inatividade. Ele é uma camada adicional de disponibilidade, não substitui a cópia local.
