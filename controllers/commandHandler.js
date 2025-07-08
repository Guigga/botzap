// C:\Users\Guilherme\bot-whatsapp\controllers\commandHandler.js

const sessionManager = require('../sessions/sessionManager');
const lobby = require('../games/lobby');
const pokerActions = require('../games/Poker/playerActions');
const trucoActions = require('../games/Truco/playerActions');
const forcaActions = require('../games/Forca/playerActions');
const velhaActions = require('../games/Velha/playerActions');
const handleMusica = require('./musicaHandler');
const JOGOS_VALIDOS = ['poker', 'truco', 'forca', 'velha'];

async function handleCommand(message, client) {
    try {
        const { from, body } = message;
        const isGroup = from.endsWith('@g.us');

        // --- BLOCO DE DEBUG PARA O JOGO DA FORCA NO PV ---
        

        const commandArgs = body.split(' ');
        const command = commandArgs[0].toLowerCase();

        // COMANDOS GLOBAIS
        if (command === '!botzap') {
            const botZapMessage = 
                                  `*Como começar um jogo?*\n` +
                                  `Digite \`!jogo <nome do jogo>\`\n\n` +
                                  `*Jogos Disponíveis:*\n` +
                                  `• Poker\n` +
                                  `• Truco\n` +
                                  `• Forca\n` +
                                  `• Velha\n\n` +
                                  `---\n\n` +
                                  `*Outros comandos:*\n` +
                                  `• \`!figurinha\` - Responda a uma imagem para criar um sticker.\n` +
                                  `• \`!musica <nome>\` - Envia o link de uma música do YouTube.\n` +
                                  `• \`!sair\` - Encerra um jogo ou lobby em andamento.\n\n` +
                                  `Vamos começar? 🎉`;
            await message.reply(botZapMessage);
            return;
        }

        if (command === '!figurinha' || command === '!sticker') {
            if (message.hasQuotedMsg) {
                const quotedMsg = await message.getQuotedMessage();
                if (quotedMsg.hasMedia) {
                    await message.reply("Criando sua figurinha, um momento... 🎨");
                    try {
                        const media = await quotedMsg.downloadMedia();
                        await client.sendMessage(from, media, { sendMediaAsSticker: true, stickerAuthor: "BotZap 🤖", stickerName: "Criado pelo Bot" });
                    } catch (error) {
                        await message.reply("❌ Ih, deu erro! Tente com outra imagem ou vídeo curto.");
                    }
                } else {
                    await message.reply("Você precisa responder a uma imagem ou vídeo para eu transformar em figurinha!");
                }
            } else {
                await message.reply("Para criar uma figurinha, responda a uma imagem com o comando `!figurinha`.");
            }
            return;
        }

        if (command === '!musica') {
            const query = commandArgs.slice(1).join(' '); 
            return await handleMusica(message, client, query);
        }
        
        // =======================================================
        // LÓGICA DE SESSÃO DE JOGO
        // =======================================================

        let session = isGroup ? sessionManager.getSession(from) : sessionManager.getSession(sessionManager.getGroupFromPlayer(from));
        
        if (command === '!jogo') {
            if (session) {
            return message.reply(`❌ Um jogo de *${session.game}* já está em andamento. Para encerrar, use \`!sair\`.`);
            }

            const gameName = commandArgs[1]?.toLowerCase();
            if (!gameName) {
                return message.reply(`🤔 Qual jogo você quer iniciar? Use: \`!jogo <nome do jogo>\`\n\n*Jogos disponíveis:*\n${JOGOS_VALIDOS.join(', ')}`);
            }

            if (!JOGOS_VALIDOS.includes(gameName)) {
                return message.reply(`❌ Jogo inválido! Os jogos disponíveis são: *${JOGOS_VALIDOS.join(', ')}*.`);
            }

            const groupId = message.from;
            const creatorId = message.author || message.from;
            const novaSessao = sessionManager.createSession(groupId, gameName, creatorId);

            if (novaSessao) {
                await lobby.criarLobby(novaSessao, client);
            } else {
                await message.reply('❌ Ocorreu um erro ao criar a sessão do jogo.');
            }
            return;
        }
        
        if (!session) {
            if (command.startsWith('!')) {
                 await message.reply('Nenhum jogo em andamento. Para começar, digite:\n`!jogo <nome do jogo>`');
            }
            return;
        }

        if (session.status === 'lobby') {
            await lobby.handleLobbyCommand(message, session, client);
            return;
        }

        if (session.status === 'em_jogo') {
            switch (session.game) {
                case 'poker':
                    await pokerActions.handleGameCommand(message, session, client);
                    break;
                case 'truco':
                    await trucoActions.handleGameCommand(message, session, client);
                    break;
                case 'forca':
                    await forcaActions.handleGameCommand(message, session, client);
                    break;
                case 'velha':
                    await velhaActions.handleGameCommand(message, session, client);
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