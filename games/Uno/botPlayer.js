// games/Uno/botPlayer.js

const BOT_ID = 'bot_uno@cpu.bot';
const BOT_NAME = 'BOT Unildo';

/**
 * Cria um objeto de jogador para o bot.
 */
function createBotPlayer() {
    console.log(`[UnoBot] Criando jogador bot: ${BOT_NAME}`);
    return { id: BOT_ID, name: BOT_NAME };
}

/**
 * O bot decide sua próxima ação de forma aleatória entre as jogadas válidas.
 * @param {object} gameState - O estado atual do jogo.
 * @param {Array<object>} maoDoBot - As cartas na mão do bot.
 * @returns {string} O comando da jogada (ex: "!jogar 2") ou "!comprar".
 */
function decideAction(gameState, maoDoBot) {
    const { cartaAtual, corAtual } = gameState;
    const jogadasPossiveis = [];

    // Mapeia as jogadas válidas
    maoDoBot.forEach((carta, index) => {
        const podeJogar = (
            carta.cor === 'preto' || // Curingas podem sempre ser jogados
            carta.cor === corAtual ||
            carta.valor === cartaAtual.valor
        );
        if (podeJogar) {
            // O comando é o índice da carta + 1 (para ser mais intuitivo para humanos)
            jogadasPossiveis.push(`!jogar ${index + 1}`);
        }
    });

    // Se tiver jogadas, escolhe uma aleatoriamente
    if (jogadasPossiveis.length > 0) {
        const jogadaAleatoria = jogadasPossiveis[Math.floor(Math.random() * jogadasPossiveis.length)];
        console.log(`[UnoBot] Decisão do bot: ${jogadaAleatoria}`);
        return jogadaAleatoria;
    }

    // Se não tiver jogadas, o comando é comprar
    console.log('[UnoBot] Decisão do bot: !comprar');
    return '!comprar';
}

module.exports = { createBotPlayer, decideAction, BOT_ID };