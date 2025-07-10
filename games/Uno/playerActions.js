// games/Uno/playerActions.js

const uno = require('./uno');

async function handleGameCommand(message, session, client) {
    const command = message.body.split(' ')[0].toLowerCase();

    // Direciona o comando para a função de lógica apropriada
    switch (command) {
        case '!jogar':
            await uno.processarJogada(message, session, client);
            break;

        case '!cor':
            await uno.processarEscolhaDeCor(message, session, client);
            break;
        
        case '!comprar':
            await uno.processarCompra(message, session, client);
            break;
        
        // Futuramente, podemos adicionar !uno aqui
    }
}

module.exports = {
    handleGameCommand
};