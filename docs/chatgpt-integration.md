# Integração ChatGPT / MCP

O Viaggio expõe um servidor MCP autenticado em:

`https://siabldasqinpfmxslwji.supabase.co/functions/v1/viaggio-mcp`

## O que já está implementado

- servidor MCP remoto em Supabase Edge Functions;
- autenticação preparada com `withOAuthProtectedResource()` + Supabase Auth;
- consent screen em `/oauth/consent/`;
- ferramentas de leitura e escrita para viagens, dias, agenda, locais, passageiros, checklist e orçamento;
- histórico de alterações com `source = chatgpt`;
- snapshot restaurável após toda mutação feita pelo MCP;
- `restore_snapshot` para voltar toda a viagem a um momento anterior;
- pacote portátil em `plugins/viaggio/`.

## Configuração OAuth necessária no projeto Supabase

No Dashboard, em **Authentication → OAuth Server**:

1. habilitar **OAuth 2.1 Server**;
2. habilitar **Dynamic Client Registration**;
3. definir **Authorization Path** como `/oauth/consent/`.

Em **Authentication → URL Configuration**, a **Site URL** deve ser:

`https://paulosince.github.io/viagens`

O projeto deve usar uma chave de assinatura JWT assimétrica (ES256 ou RS256), exigida pelo middleware autenticado do Supabase para MCP.

## Teste no ChatGPT antes da publicação

1. Ative Developer Mode no ChatGPT.
2. Em Plugins, adicione um servidor MCP.
3. Use a URL do Viaggio acima.
4. O ChatGPT deve descobrir o OAuth, abrir a tela de consentimento do Viaggio e, após autorização, listar as ferramentas.
5. Teste leitura, criação, alteração e `restore_snapshot`.

## Publicação para usuários comuns

Envie o servidor MCP pelo portal de submissão de Plugins da OpenAI usando a URL universal acima. O portal solicitará verificação de domínio. Depois da aprovação, configure a URL pública/listing do plugin em `CHATGPT_PLUGIN_URL` no frontend.

Quando essa URL estiver definida, o botão **Perfil → Integrações → ChatGPT → Conectar ao ChatGPT** passa a abrir diretamente a experiência pública de instalação/conexão. A autorização da conta continua exigindo consentimento explícito do usuário.
