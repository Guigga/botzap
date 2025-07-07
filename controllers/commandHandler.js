// C:\Users\Guilherme\bot-whatsapp\controllers\commandHandler.js

const sessionManager = require('../sessions/sessionManager');
const lobby = require('../games/lobby');
const pokerActions = require('../games/Poker/playerActions');
const trucoActions = require('../games/Truco/playerActions');

async function handleCommand(message, client) {
    try {
        const { from, body } = message;
        const commandArgs = body.split(' ');
        const command = commandArgs[0].toLowerCase();

        if (command.startsWith('!debug-')) {
            const session = sessionManager.getSession(from);
            if (!session) return console.log('[DEBUG] Sessão não encontrada para comando de debug.');

            if (command === '!debug-sethand') {
                const playerId = commandArgs[1];
                const cards = commandArgs.slice(2); // Pega todas as cartas
                const player = session.gameState.jogadores.find(p => p.id === playerId);
                if (player) {
                    player.mao = [null, null, null]; // Limpa a mão primeiro
                    cards.forEach((card, i) => player.mao[i] = card);
                    console.log(`[DEBUG] Mão de ${player.name} definida para: ${cards.join(', ')}`);
                }
            }
            return; // Interrompe a execução para não processar como um comando normal
        }

        // 1. Comandos Globais (funcionam a qualquer momento, com ou sem jogo)
        if (command === '!botzap') {
            const botZapMessage = `Olá! Eu sou o *BotZap* 👾, o bot especializado em *muita diversão nesse ZAP*🤣👌🏽🤪👍🏽!\n\n` +
                                  `Minha missão é trazer a _verdadeira_ diversão do zap com jogos & funcionalidades para o seu grupo.\n\n` +
                                  `*Jogos Disponíveis:*\n` +
                                  `• *Poker* Texas Hold'em\n` +
                                  `• *Truco* Paulista\n\n` +
                                  `---\n\n` +
                                  `*Como começar um jogo?*\n` +
                                  `É fácil! Digite \`[ !jogo ]\` seguido do nome do jogo.\n\n` +
                                  `*Exemplo:* \`!jogo poker\`\n\n` +
                                  `---\n\n` +
                                  `*Comandos Gerais:*\n` +
                                  `• \`!ajuda\` - Mostra os comandos disponíveis.\n` +
                                  `• \`!sair\` - Encerra um jogo ou lobby em andamento.\n\n` +
                                  `Vamos jogar? 🎉`;
            await message.reply(botZapMessage);
            return;
        }

        let session;
        const isGroup = from.endsWith('@g.us');

        if (isGroup) {
            // Se a mensagem veio de um grupo, a sessão é a do grupo.
            session = sessionManager.getSession(from);
        } else {
            // Se a mensagem veio do privado, busca o grupo pelo ID do jogador.
            const groupId = sessionManager.getGroupFromPlayer(from);
            if (groupId) {
                session = sessionManager.getSession(groupId);
            }
        }

        // 2. Comando para CRIAR um novo jogo
        if (command === '!jogo') {
            if (session) {
                await message.reply('Já existe uma mesa em andamento. Use `!fimjogo` para encerrar.');
                return;
            }

            const gameName = commandArgs[1]?.toLowerCase();
            switch (gameName) {
                case 'poker':
                    const newPokerSession = sessionManager.createSession(from, 'poker');
                    await lobby.criarLobby(newPokerSession, client);
                    break;
                case 'truco':
                    const newTrucoSession = sessionManager.createSession(from, 'truco');
                    await lobby.criarLobby(newTrucoSession, client);
                    break;
                default:
                    await message.reply('Jogo não reconhecido. Use: `!jogo poker` ou `!jogo truco`.');
                    break;
            }
            return;
        }
        
        // Se chegou aqui, o comando é para um jogo existente. Se não há sessão, avisa o usuário.
        if (!session) {
            if (command.startsWith('!')) {
                 await message.reply('Nenhum jogo em andamento. Para começar, digite `!botzap`.');
            }
            return;
        }

        // 3. Comandos DENTRO de uma sessão ativa (Lobby ou Em Jogo)
        if (session.status === 'lobby') {
            await lobby.handleLobbyCommand(message, session, client);
            return;
        }

        if (session.status === 'em_jogo') {
            // Direciona o comando para o handler do jogo correto
            switch (session.game) {
                case 'poker':
                    await pokerActions.handleGameCommand(message, session, client);
                    break;
                case 'truco':
                    await trucoActions.handleGameCommand(message, session, client);
                    break;
                default:
                    await message.reply('Erro: Jogo em andamento não reconhecido na sessão.');
                    break;
            }
            return;
        }

    } catch (error) {
        console.error('ERRO FATAL AO PROCESSAR COMANDO:', error);
        await message.reply('❌ Ocorreu um erro inesperado ao processar seu comando.');
    }
}

module.exports = handleCommand;
