# Viaggio — etapa 07/14 — teste das duas imagens (22/10/2026)

**Status: em andamento; progresso geral 6/14.**

O teste no Safari mostrou HTTP 503 ao obter a imagem do Hotel Jardim Lisboa e HTTP 403 para a imagem do Elevador de Santa Justa.

O banco de staging conserva dois objetos diferentes e as referências originais. A rotina de permissão do banco autoriza a leitura das duas imagens para as duas identidades ligadas à viagem em testes SQL controlados, mas isso não confirma o funcionamento da função HTTP.

A função de mídia do staging apresenta implantação concluída com registro às 10h35 BRT, depois da captura das 10h25. Não há evidência de que essa nova implantação tenha solucionado o problema. Os logs disponíveis exibem apenas início e fim das chamadas, não a causa dos dois erros.

Foi criada a página diagnóstica isolada `https://paulosince.github.io/viagens/experiments/neon-pilot/app/neon-photo-check-v2.html`, sem alteração de fotos. Ela mostra separadamente o resultado da autorização da base de dados e o resultado da requisição ao serviço de mídia.

**Pendente:** obter a evidência do novo teste. Nenhum upload ou delete autorizado, sem cutover e sem alterações no aplicativo principal.
