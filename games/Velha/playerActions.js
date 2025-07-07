// Em games/Velha/playerActions.js

const jogoDaVelha = require('./velha.js');
const sessionManager = require('../../sessions/sessionManager'); // Importamos o sessionManager

async function handleGameCommand(message, session, client) {
    const command = message.body.split(' ')[0].toLowerCase();

    switch (command) {
        case '!jogar':
        case '!j': // Atalho
            await jogoDaVelha.processarJogada(message, session, client);
            break;
        
        // ADICIONAMOS A LÓGICA PARA SAIR
        case '!sair':
            if (sessionManager.endSession(session.groupId)) {
                await message.reply('O Jogo da Velha foi encerrado.');
            }
            break;
    }
}

module.exports = { handleGameCommand };