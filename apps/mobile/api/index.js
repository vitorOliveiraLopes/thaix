// Função da Vercel que atende o que não é arquivo estático: as rotas de API
// (src/app/api) e as páginas com parâmetro (ex.: /treino/123). Usa o build do
// servidor gerado por "expo export -p web" (dist/server).
const path = require('node:path');
const { createRequestHandler } = require('expo-server/adapter/vercel');

module.exports = createRequestHandler({
  build: path.join(__dirname, '../dist/server'),
});
