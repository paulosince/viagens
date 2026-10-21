# Viaggio — Supabase → Neon: etapa 02/14

**Status: CONCLUÍDA para o requisito "exigir verificação de e-mail no Auth central".**
**Data: 2026-10-21.**

## Identificação
Projeto: `viaggio-auth-beta` (`dark-union-03886858`)
Branch: `br-square-river-b765bpl4`
Serviço: Neon Managed Better Auth central

## Evidências
- A pessoa responsável ativou `Verify at Sign-up` na interface de Settings → Better Auth. A imagem mostra `Sign-up with Email` ligado, `Verify at Sign-up` ligado, `Verification code` selecionado, `Sign-in with Email` ligado e toast `Authentication settings updated successfully`.
- Uma leitura subsequente da configuração ao vivo via conector Neon retornou:
  - `auth_methods.email_password.require_email_verification = true`
  - `auth_methods.email_password.email_verification_method = "otp"`
  - `enabled = true`
  - `allow_sign_up = true`
  - `trusted_origins = ["https://paulosince.github.io"]`
  - `verify_email_on_sign_up = false`, que corresponde a uma configuração *separada* de envio automático no cadastro; não contradiz o predicado `require_email_verification = true`.
- A API Neon documenta independentemente `require_email_verification` (bloquear login até confirmar e-mail) e `send_verification_email_on_sign_up` (envio automático durante cadastro). A documentação de UI instrui habilitar apenas `Sign-up with Email` + `Verify at Sign-up` e escolher o método.

## Escopo e próximos testes (dentro das 14 etapas fixas)
- Esta etapa exige que Neon Auth bloqueie login por e-mail não confirmado. A configuração desse gate está comprovada.
- A entrega real do OTP, reenvio, confirmação, criação de credenciais e login devem ser testados com uma conta real na etapa **03–04/14**. Se o envio automático não ocorrer, o aplicativo/servidor deverá solicitar o envio do OTP de maneira explícita, ou a configuração `send_verification_email_on_sign_up` deverá ser habilitada; NÃO presumir OTP entregue.
- `allow_sign_up = true` persiste no serviço Auth; o bloqueio público por convite é requisito de onboarding e permanece pendente na lista existente, não uma etapa adicional.
- Provedor compartilhado de e-mail ainda é de desenvolvimento. Definir operação de e-mail apropriada antes do beta público; não constitui falha deste toggle.
- Não foi criada conta real e nenhum projeto de dados nem Supabase foi alterado.

## Fontes
https://neon.com/docs/auth/guides/email-verification
https://api-docs.neon.tech/reference/updateneonauthemailandpasswordconfig
