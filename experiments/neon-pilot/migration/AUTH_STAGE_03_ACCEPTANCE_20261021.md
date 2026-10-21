# Viaggio — Migração Supabase → Neon — Etapa 03/14

**STATUS: CONCLUÍDA (vinculação segura das duas contas no STAGING).**
Data de verificação: 2026-10-21.
Próximo item da lista fixa: **04/14 — validar JWT real, RLS, sessões e permissões nos dois projetos**.

## Evidências independentes
- Página OTP de Paulo retornou `linked`; titular confirmou que era sua sessão Supabase original.
- Página OTP de Cíntia retornou `linked` e mostrou explicitamente seu e-mail da conta antiga.
- Neon Auth central: **2 usuários**, **2 com e-mail verificado**.
- Banco A, branch `br-silent-band-b80nklzl`: `viaggio_identity.neon_auth_links` = **2 mapeamentos ativos**, **0 pendentes**.
- Banco B, branch `br-falling-leaf-b8xuv1d0`: `viaggio_identity.neon_auth_links` = **2 mapeamentos ativos**, **0 pendentes**.
- Comparação de e-mails, identificadores legados e Neon: **2/2 correspondências exatas e consistentes entre ambos os bancos**, e cada Neon user possui `emailVerified = true`.
- Os diretórios privados `viaggio_identity.users` contêm ambas as identidades legadas em A e B, razão pela qual ambos os bancos registraram dois mapeamentos. **Isso NÃO representa duplicação de viagens ou propriedade duplicada**: as tabelas operacionais continuam com **4 viagens em A e 0 em B**, e `project_binding` tem um proprietário por projeto.
- Testes reais de PostgreSQL em staging, usando **claims simuladas via `set_config`, não JWT assinado**:
  - Cíntia em A (proprietária) → **4 viagens visíveis**;
  - Paulo em A (convidado) → **1 viagem visível**;
  - Paulo em B (proprietário) → **0 viagens próprias visíveis**;
  - Cíntia em B (não proprietária) → **0 viagens visíveis**.
- O serviço privado `linkup` está implantado com versão de roteamento e deploy **10**, usando somente as branches Neon de validação. No teste HTTP real, origens estranhas negadas (403), tokens falsos negados (401), preflight válido (204). Antes da aceitação, a suíte do serviço registrou **48/48 testes aprovados**.

## Limitações e próximos gates
1. Validação das permissões acima é real em PostgreSQL, mas com `request.jwt.claims` simuladas. **Ainda não prova um JWT realmente assinado pelo Neon** atravessando Data API de ambos os projetos; isto pertence expressamente à **etapa 04/14**.
2. O browser de produção `main` continua usando Supabase, sem novo Auth real. O cutover será posterior, depois da etapa 04 e integração do frontend.
3. Não alteramos nem apagamos dados do Supabase, nem misturamos as viagens dos dois bancos; projetos Neon principais continuam sem links de federação.
4. A existência de associação da Cíntia em B é derivada do diretório privado legado que inclui sua identidade, mas não lhe dá propriedade ou viagens visíveis; rotas RLS verificadas. Otimizar diretório/metadados por projeto pode ser discutido em regressão futura, sem criar nova etapa no plano de 14.
5. Fluxo de restauração/interrupção após erro interprojetos necessita validação operacional antes do corte definitivo, prevista nos gates de integração/rollback já existentes.

**Progresso de projeto: 3/14 concluídas; 11 restantes.** Nenhuma nova etapa adicionada.
