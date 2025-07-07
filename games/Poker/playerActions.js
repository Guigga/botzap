// C:\Users\Guilherme\bot-whatsapp\games\Poker\playerActions.js

const poker = require('./poker');
const sessionManager = require('../../sessions/sessionManager');
const pokerValidators = require('./pokerValidators');
const chipManager = require('../../economy/chipManager');


// Nova função "mãe" para lidar com TODOS os comandos durante o jogo
async function handleGameCommand(message, session, client) {
    const { from, body } = message;
    const commandArgs = body.split(' ');
    const command = commandArgs[0].toLowerCase();
    
    console.log(`[Truco Actions] Comando '${command}' recebido de ${from} na sessão ${session.groupId}`);

    // Nova lógica para identificar comandos numéricos
    const isNumberCommand = command.startsWith('!') && command.length > 1 && !isNaN(parseInt(command.substring(1)));

    if (isNumberCommand) {
        // Para manter a compatibilidade com a função `jogarCarta` que já temos,
        // nós "traduzimos" o comando !1 para !carta 1 internamente.
        const number = command.substring(1);
        const hideOrNot = commandArgs.slice(1).join(' '); // Pega o resto, como "hide"
        message.body = `!carta ${number} ${hideOrNot}`;
        await truco.jogarCarta(message, session, client);
    } else if (command === '!truco') {
        await truco.pedirTruco(message, session, client);
    } else if (command === '!aceitar') {
        await truco.aceitarTruco(message, session, client);
    } else if (command === '!correr') {
        await truco.correrDoTruco(message, session, client);
    } else if (['!pede6', '!pede9', '!pede12'].includes(command)) {
        await truco.aumentarAposta(message, session, client);
    } else if (command === '!sair') {
        if (sessionManager.endSession(session.groupId)) {
            await message.reply('O jogo foi encerrado.');
        }
    } else {
        if (command.startsWith('!')) {
             await message.reply("Comando de Truco não reconhecido.");
        }
    }
}

async function handleLeaveCommand(message, session, client) {
    const playerId = message.author || message.from;

    if (!pokerValidators.isPlayerInGame(session, playerId)) {
        await message.reply('Você não está mais na mesa.');
        return;
    }

    const playerName = pokerValidators.getFormattedId(playerId, session);
    const wasHisTurn = pokerValidators.isPlayersTurn(session, playerId);

    session.players = session.players.filter(p => p.id !== playerId);
    session.gameState.ativos = session.gameState.ativos.filter(id => id !== playerId);
    chipManager.removePlayer(playerId);
    
    await client.sendMessage(session.groupId, `👋 ${playerName} saiu do jogo.`);

    if (session.gameState.ativos.length < 2 && session.players.length < 2) {
        await client.sendMessage(session.groupId, 'Jogadores insuficientes para continuar. Encerrando o jogo.');
        sessionManager.endSession(session.groupId);
        return;
    }
    
    if (wasHisTurn) {
        // Passa o ID do jogador que saiu para que o avanço de turno seja calculado corretamente
        await poker.avancarTurnoApostas(session, client, playerId); // <-- MUDANÇA AQUI
    }
}

// Funções de ação individuais (agora são chamadas internamente por handleGameCommand)
async function handleCheckCommand(message, session, client) {
    await poker.handleCheck(session, message.author || message.from, client);
}
async function handleCallCommand(message, session, client) {
    await poker.handleCall(session, message.author || message.from, client);
}
async function handleBetCommand(message, session, client) {
    const amount = parseInt(message.body.split(' ')[1]);
    if (isNaN(amount) || amount <= 0) {
        await message.reply('Valor de aposta inválido. Use: !apostar <valor>');
        return;
    }
    await poker.handleBet(session, message.author || message.from, amount, client);
}
async function handleRaiseCommand(message, session, client) {
    const amount = parseInt(message.body.split(' ')[1]);
    if (isNaN(amount) || amount <= 0) {
        await message.reply('Valor de aumento inválido. Use: !aumentar <valor>');
        return;
    }
    await poker.handleRaise(session, message.author || message.from, amount, client);
}
async function handleAllInCommand(message, session, client) {
    await poker.handleAllIn(session, message.author || message.from, client);
}
async function handleFold(message, session, client) {
    const playerId = message.author || message.from;
    
    await client.sendMessage(session.groupId, `🚪 ${pokerValidators.getFormattedId(playerId, session)} desistiu da rodada.`);

    session.gameState.ativos = session.gameState.ativos.filter(id => id !== playerId);
    session.gameState.playersWhoActed.delete(playerId);

    if (session.gameState.ativos.length === 1) {
        const winnerId = session.gameState.ativos[0];
        const pot = session.gameState.pote;
        
        chipManager.addChips(winnerId, pot);
        
        await client.sendMessage(session.groupId, `🎉 ${pokerValidators.getFormattedId(winnerId, session)} venceu a rodada! Ganhou ${pot} fichas.`);
        
        await poker.iniciarRodada(session, client);
    } else {
        // Passa o ID do jogador que desistiu para que o avanço de turno seja calculado corretamente
        await poker.avancarTurnoApostas(session, client, playerId); // <-- MUDANÇA AQUI
    }
}
function getPokerHelpMessage(session) {
    // ... (código da função de ajuda permanece o mesmo)
    let helpMessage = `📖 *Comandos de Poker:*\n`;
    if (session.status === 'em_jogo') {
        helpMessage += `- !status - Mostra o status atual da rodada\n`;
        helpMessage += `- !mesa (ou !check) - Passa a vez sem apostar\n`; 
        helpMessage += `- !pagar (ou !call) - Iguala a aposta atual\n`; 
        helpMessage += `- !apostar <valor> - Faz uma aposta inicial\n`; 
        helpMessage += `- !aumentar <valor> - Aumenta a aposta atual\n`; 
        helpMessage += `- !allin - Aposta todas as suas fichas\n`; 
        helpMessage += `- !desistir (ou !fold) - Sai da rodada atual\n`;
    }
    helpMessage += `\n*Comandos Gerais:*\n - !fimjogo - Encerra o jogo atual\n`; 
    return helpMessage;
}

module.exports = {
    handleGameCommand // Exportamos apenas a função "mãe"
};