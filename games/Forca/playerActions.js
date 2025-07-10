// Substitua o conteúdo de games/Forca/playerActions.js

const forca = require('./forca');
const sessionManager = require('../../sessions/sessionManager');

async function handleGameCommand(message, session, client) {
    const command = message.body.split(' ')[0].toLowerCase();
    const playerId = message.author || message.from; // ID de quem enviou o comando

    switch (command) {
        case '!palavra': // <<< ADICIONADO
            await forca.definirPalavra(message, session, client);
            break;

        case '!letra':
            await forca.processarLetra(message, session, client);
            break;

        // --- LÓGICA DE SAÍDA CORRIGIDA ---
        case '!sair':
            const playerIndex = session.gameState.jogadores.findIndex(p => p.id === playerId);
            
            // Se o jogador não está na partida, não faz nada
            if (playerIndex === -1) return;

            const playerSaindo = session.gameState.jogadores[playerIndex];
            
            // Remove o jogador da lista
            session.gameState.jogadores.splice(playerIndex, 1);
            
            // Agora que a função está exportada, esta chamada funcionará
            sessionManager.unmapPlayersInGroup([playerId]); 

            await message.reply(`*${playerSaindo.name}* saiu do jogo da Forca.`);

            // Se quem saiu era o definidor da palavra ATUAL, a rodada precisa recomeçar
            const eraDefinidor = playerId === session.gameState.definidorDaPalavra;

            // Se restarem menos de 2 jogadores, encerra o jogo
            // (O bot também conta, então a lógica deve ser ajustada se o bot puder jogar sozinho)
            if (session.gameState.jogadores.length < 2) {
                await client.sendMessage(session.groupId, 'O jogo da Forca foi encerrado por falta de jogadores.');
                sessionManager.endSession(session.groupId);
                return;
            }

            // Se o jogador que saiu era o definidor, a rodada reinicia.
            // O 'definidorIndex' não precisa ser alterado, pois o array foi modificado.
            // A função iniciarRodada pegará o jogador que agora ocupa essa posição.
            if (eraDefinidor) {
                await client.sendMessage(session.groupId, `Como quem estava escolhendo a palavra saiu, vamos para a próxima rodada!`);
                await forca.iniciarRodada(session, client);
            }
            break;
            
        default:
            break;
    }
}

module.exports = {
    handleGameCommand
};