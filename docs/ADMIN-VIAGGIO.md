# Administração e atividade
A interface é aberta no perfil somente após confirmação pela RPC administrativa central. Não armazenar dados administrativos no IndexedDB, cache ou localStorage.
- Auth: schema exclusivo `viaggio_admin` na Data API central; somente RPCs, sem SELECT direto em usuários/sessões ou tabela de acessos. A RPC admin_accounts verifica o subject do administrador vinculado e email verificado no servidor; record_access extrai o próprio subject do JWT. Nenhum token, IP ou user agent é armazenado. Data por Brasília.
- Produção A+B: `viaggio_admin_snapshot` verifica a identidade administrativa no banco e agrega viagens e membros; leitura deduplicada por UUID. Cotas usam o appusage existente (medição física v2), sem atribuir cota de outro projeto a membro compartilhado.
- Dias anteriores não foram preenchidos artificialmente; acessos apenas offline não são contabilizados. Permissões de compartilhamento não demonstram abertura real da viagem.
- Contas centrais e perfis operacionais são entidades distintas. Usuários sem projeto próprio não recebem cota fictícia.
- Antes da publicação: testar com JWT real do administrador e de não administrador, verificar negação anônima, confirmar atualização do cache da Data API e funcionamento das cotas físicas. O teste SQL com claims simuladas não substitui teste HTTP autenticado.
- A API administrativa central foi provisionada separadamente, com apenas o schema viaggio_admin exposto, sem grants padrão. Nenhuma alteração em tabelas de autenticação ou de viagens.
