// C:\Users\Guilherme\bot-whatsapp\sessions\sessionManager.js

const sessions = {};
const playerSessionMap = {};

function createSession(groupId, game, creatorId) { // Adicionado creatorId
    if (!sessions[groupId]) {
        sessions[groupId] = {
            groupId: groupId,
            creatorId: creatorId, // <-- NOVA PROPRIEDADE
            game: game,
            players: [], 
            gameState: null, 
        };
        console.log(`Sessão criada para o grupo: ${groupId} para o jogo: ${game} por ${creatorId}`);
    }
    return sessions[groupId];
}

function getSession(groupId) {
    return sessions[groupId];
}

function endSession(groupId) {
    const session = sessions[groupId];
    if (session) {
        let playerIds = [];

        // NOVO: Verifica se session.players é um array (Poker) ou um objeto (Truco)
        if (Array.isArray(session.players)) {
            // Lógica para o Poker (e para o Truco quando o jogo já começou)
            playerIds = session.players.map(p => p.id);
        } else if (session.players && typeof session.players === 'object') {
            // Lógica para o lobby do Truco
            const bluePlayers = session.players.timeBlue || [];
            const redPlayers = session.players.timeRed || [];
            playerIds = [...bluePlayers.map(p => p.id), ...redPlayers.map(p => p.id)];
        }

        unmapPlayersInGroup(playerIds);
        delete sessions[groupId];
        console.log(`Sessão encerrada para o grupo: ${groupId}`);
        return true;
    }
    return false;
}

// Adaptação para notificar estado do jogo para todos os jogadores na sessão (sem saldos de fichas)
async function notificarEstado(session, client) {
    if (session && session.gameState) {
        const poker = require('../games/Poker/poker'); 
        const statusMessage = poker.buildStatusMessage(session.gameState, session.players);
        await client.sendMessage(session.groupId, statusMessage);
    }
}

// Nova função para notificar o status COMPLETO, incluindo saldos
async function notificarStatusCompleto(session, client) {
    if (session && session.gameState) {
        const poker = require('../games/Poker/poker'); 
        const statusMessage = poker.buildStatusMessage(session.gameState, session.players);
        const chipBalanceMessage = poker.buildChipBalanceMessage(session.players);
        
        await client.sendMessage(session.groupId, `${statusMessage}\n\n---\n${chipBalanceMessage}`);
    }
}

function mapPlayerToGroup(playerId, groupId) {
    playerSessionMap[playerId] = groupId;
    console.log(`[Player Map] Jogador ${playerId.split('@')[0]} mapeado para o grupo ${groupId}`);
}

/**
 * Encontra o ID do grupo em que um jogador está ativo.
 * @param {string} playerId ID do jogador.
 * @returns {string|null} O ID do grupo ou null se não for encontrado.
 */
function getGroupFromPlayer(playerId) {
    return playerSessionMap[playerId] || null;
}

/**
 * Remove todos os jogadores de um grupo do mapa.
 * @param {string[]} playerIds Array de IDs de jogadores a serem removidos.
 */
function unmapPlayersInGroup(playerIds) {
    if (!playerIds || playerIds.length === 0) return;
    playerIds.forEach(pId => {
        if (playerSessionMap[pId]) {
            delete playerSessionMap[pId];
            console.log(`[Player Map] Jogador ${pId.split('@')[0]} desmapeado.`);
        }
    });
}

module.exports = {
    createSession,
    getSession,
    endSession,
    mapPlayerToGroup,
    getGroupFromPlayer,
    unmapPlayersInGroup,
    notificarEstado,
    notificarStatusCompleto
};
