# Viaggio — migração 2/14: verificação obrigatória de e-mail

**Situação 2026-10-21:** ainda não concluída. Verificado ao vivo via Neon: projeto `dark-union-03886858`, branch `br-square-river-b765bpl4`, Better Auth ativo; `require_email_verification=false`, `verify_email_on_sign_up=false`, método `otp`, provedor de e-mail compartilhado.

## Alteração necessária (somente no Auth central)
Console Neon → projeto `viaggio-auth-beta` → branch principal → Settings → Better Auth → Sign-up with Email → habilitar **Verify at Sign-up** e exigir verificação do e-mail para login, mantendo código **OTP**. Salvar. Não é preciso alterar as instâncias de Auth A/B nem a aplicação em produção.

O provedor compartilhado do Neon suporta código OTP para ensaio. Links de verificação exigem SMTP próprio. O SMTP customizado será obrigatório antes da abertura pública do beta, mas não é parte da verificação técnica mínima deste item.

API oficial alternativa, se houver chave de API com privilégios administrativos armazenada em gerenciador de segredos, nunca no repositório:
PATCH https://console.neon.tech/api/v2/projects/dark-union-03886858/branches/br-square-river-b765bpl4/auth/email_and_password
Content-Type: application/json
Body mínimo:
```json
{
  "require_email_verification": true,
  "send_verification_email_on_sign_up": true,
  "email_verification_method": "otp"
}
```
API de alterações é parcial: só campos fornecidos são atualizados. Não habilitar exclusão de dados ou alterar outras configurações.

## Gate de aceite (sem criar usuário real)
1. Reconsultar config via integração Neon;
2. Conferir `auth_methods.email_password.require_email_verification === true`;
3. Conferir `auth_methods.email_password.verify_email_on_sign_up === true` (nomenclatura do estado de configuração da integração);
4. Conferir `email_verification_method === "otp"`;
5. Confirmar URL de origem confiável ainda registrada, login por senha ativo e Supabase/projetos A/B intocados.

A conexão Neon atualmente disponível nesta conversa possui `get_neon_auth_config` e `update_auth_config(name)`, **não** a atualização `email_and_password`. Logo a mudança ainda depende de uma ação no Console ou de execução autorizada da API por ferramenta apropriada. Não marcar 2/14 como concluído sem leitura de retorno.

Fontes:
https://neon.com/docs/auth/guides/email-verification
https://api-docs.neon.tech/reference/updateneonauthemailandpasswordconfig
https://neon.com/docs/auth/production-checklist
