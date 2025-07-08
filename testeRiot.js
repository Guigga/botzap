const { buscarElo } = require('./services/riotService'); // ajuste o caminho conforme seu projeto

async function testar() {
  const gameName = 'Etheldreda';  // coloque o nick que quiser testar
  const tagLine = 'Negs';         // coloque a tag do jogador

  try {
    console.log(`Testando elo para ${gameName}#${tagLine}...`);
    const resultado = await buscarElo(gameName, tagLine);
    console.log('Resultado:\n', resultado);
  } catch (error) {
    console.error('Erro no teste:', error);
  }
}

testar();
