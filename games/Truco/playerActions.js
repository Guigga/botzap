// C:\Users\Guilherme\bot-whatsapp\games\Truco\playerActions.js

const truco = require('./truco');
const sessionManager = require('../../sessions/sessionManager');

async function handleGameCommand(message, session, client) {
    const { from, body } = message;
    const commandArgs = body.split(' ');
    const command = commandArgs[0].toLowerCase();
    
    console.log(`[Truco Actions] Comando '${command}' recebido de ${from} na sessão ${session.groupId}`);

    switch (command) {
        case '!carta':
            await truco.jogarCarta(message, session, client);
            break;
        case '!truco':
            await truco.pedirTruco(message, session, client);
            break;
        case '!aceitar':
            await truco.aceitarTruco(message, session, client);
            break;
        case '!correr':
            await truco.correrDoTruco(message, session, client);
            break;
        case '!pede6':
        case '!pede9':
        case '!pede12':
            await truco.aumentarAposta(message, session, client);
            break;
        
        // --- CORREÇÃO IMPORTANTE AQUI ---
        case '!sair':
            // 1. Manda o módulo de Truco limpar qualquer estado interno
            truco.limparTudo();
            
            // 2. AGORA, encerra a sessão no gerenciador
            if (sessionManager.endSession(session.groupId)) {
                await message.reply('O jogo foi encerrado.');
            }
            break;
            
        default:
            if (command.startsWith('!')) {
                 await message.reply("Comando de Truco não reconhecido.");
            }
            break;
    }
}

module.exports = {
    handleGameCommand
};