// Em games/Forca/playerActions.js

const forca = require('./forca');
// 1. Adicione a importação do sessionManager
const sessionManager = require('../../sessions/sessionManager');


async function handleGameCommand(message, session, client) {
    const command = message.body.split(' ')[0].toLowerCase();

    switch (command) {
        case '!letra':
            await forca.processarLetra(message, session, client);
            break;

        // 2. Adicione a lógica para o comando !sair
        case '!sair':
            if (sessionManager.endSession(session.groupId)) {
                await message.reply('O jogo da Forca foi encerrado.');
            }
            break;
            
        default:
            // Nenhum outro comando é reconhecido durante o jogo.
            break;
    }
}

module.exports = {
    handleGameCommand
};