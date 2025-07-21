// commands/jogo.js
const sessionManager = require('../sessions/sessionManager');
const lobby = require('../games/lobby');
const JOGOS_VALIDOS = ['poker', 'truco', 'forca', 'velha', 'uno', 'xadrez'];

module.exports = {
    name: '!jogo',
    aliases: ['!sair'],
    description: 'Gerencia as sessões de jogo (iniciar e sair).',

    // Note que a função recebe 'client' e 'session' como novos parâmetros
    async execute(message, command, body, client, session) {
        const { from, author } = message;
        const commandArgs = body.split(' ');

        if (command === '!jogo') {
            if (session) {
                return message.reply(`❌ Um jogo de *${session.game}* já está em andamento. Para encerrar, use \`!sair\`.`);
            }

            const gameName = commandArgs[1]?.toLowerCase();

            if (!gameName) {
                return message.reply(`🤔 Qual jogo você quer iniciar? Use: \`!jogo <nome>\`\n\n*Disponíveis:*\n${JOGOS_VALIDOS.join(', ')}`);
            }

            if (!JOGOS_VALIDOS.includes(gameName)) {
                return message.reply(`❌ Jogo inválido! Os jogos disponíveis são: *${JOGOS_VALIDOS.join(', ')}*.`);
            }

            const creatorId = author || from;
            const novaSessao = sessionManager.createSession(from, gameName, creatorId);

            if (novaSessao) {
                await lobby.criarLobby(novaSessao, client);
            } else {
                await message.reply('❌ Ocorreu um erro ao criar a sessão do jogo.');
            }
        }

        if (command === '!sair') {
            if (session) {
                const gameName = session.game.charAt(0).toUpperCase() + session.game.slice(1);
                if (sessionManager.endSession(session.groupId)) {
                    await message.reply(`✅ O jogo de *${gameName}* foi encerrado.`);
                }
            } else {
                await message.reply('Não há nenhum jogo ou lobby em andamento para sair.');
            }
        }
    }
};