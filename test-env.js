// test-env.js
require('dotenv').config();

console.log('--- Teste de Variáveis de Ambiente ---');
console.log('ID da Planilha lido do .env:', process.env.GOOGLE_SHEET_ID);
console.log('URI do Mongo lida do .env:', process.env.MONGO_URI ? 'Encontrada' : 'Não Encontrada');
console.log('------------------------------------');