# Viagens

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
