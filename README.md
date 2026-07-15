# Viagens

Primeiro protótipo do conceito de contas separadas para planejamento de viagens.

## Teste rápido

Use:

- E-mail: `familia@exemplo.com`
- Senha: `familia123`

Também é possível criar uma conta nova e criar uma viagem.

## Importante

Esta versão é apenas um protótipo visual/funcional. Os dados ficam no `localStorage` do navegador e não estão protegidos para produção.

Próximo passo: trocar o armazenamento local por Supabase Auth + banco PostgreSQL com Row Level Security. A aplicação deve usar somente a chave pública do Supabase no navegador; a chave administrativa nunca deve ser publicada.
