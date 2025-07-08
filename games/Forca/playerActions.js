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
            sessionManager.unmapPlayersInGroup([playerId]); // Remove o mapeamento do jogador

            await message.reply(`*${playerSaindo.name}* saiu do jogo da Forca.`);

            // Se restarem menos de 2 jogadores, encerra o jogo
            if (session.gameState.jogadores.length < 2) {
                await client.sendMessage(session.groupId, 'O jogo da Forca foi encerrado por falta de jogadores.');
                sessionManager.endSession(session.groupId);
                return;
            }

            // Se quem saiu era o definidor da palavra, a rodada precisa recomeçar
            if (playerId === session.gameState.definidorDaPalavra) {
                await client.sendMessage(session.groupId, `Como quem escolheu a palavra saiu, vamos para a próxima rodada!`);
                session.gameState.delegatorIndex = playerIndex % session.gameState.jogadores.length; // Passa para o próximo
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