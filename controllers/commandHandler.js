// C:\Users\Guilherme\bot-whatsapp\controllers\commandHandler.js

const sessionManager = require('../sessions/sessionManager');
const lobby = require('../games/lobby');
const pokerActions = require('../games/Poker/playerActions');
const trucoActions = require('../games/Truco/playerActions');
const forcaActions = require('../games/Forca/playerActions');
const velhaActions = require('../games/Velha/playerActions');



async function handleCommand(message, client) {
    try {
        const { from, body } = message;
        const isGroup = from.endsWith('@g.us');

        // Lógica para tratar palavras secretas da Forca no PV
        if (!isGroup && !body.startsWith('!')) {
            const groupId = sessionManager.getGroupFromPlayer(from);
            if (groupId) {
                const session = sessionManager.getSession(groupId);
                if (session && session.game === 'forca' && session.status === 'em_jogo') {
                    const forca = require('../games/Forca/forca');
                    await forca.definirPalavra(message, session, client);
                    return;
                }
            }
        }

        const commandArgs = body.split(' ');
        const command = commandArgs[0].toLowerCase();

        // COMANDOS DE DEBUG
        if (command.startsWith('!debug-')) {
            // ... (A sua lógica de debug aqui)
            return;
        }

        // =======================================================
        // SEÇÃO DE COMANDOS GLOBAIS CORRIGIDA
        // =======================================================

        if (command === '!botzap') {
            const botZapMessage = `Olá! Eu sou o *BotZap* 👾, o bot especializado em *muita diversão nesse ZAP*🤣👌🏽🤪👍🏽!\n\n` +
                                  `Minha missão é trazer a _verdadeira_ diversão do zap com jogos & funcionalidades para o seu grupo.\n\n` +
                                  `*Como começar um jogo?*\n` +
                                  `É fácil! Digite \`!jogo <nome do jogo>\`\n\n` +
                                  `*Jogos Disponíveis:*\n` +
                                  `• Poker\n` +
                                  `• Truco\n` +
                                  `• Forca\n` +
                                  `• Jogo da Velha\n\n` +
                                  `---\n\n` +
                                  `*Outros comandos:*\n` +
                                  `• \`!figurinha\` - Responda a uma imagem para criar um sticker.\n` +
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

        if (command === '!elo') {
            // Pega todo o texto após "!elo" como o Riot ID completo
            const riotIdCompleto = commandArgs.slice(1).join(' ').trim();

            // Valida se o formato inclui o '#'
            if (!riotIdCompleto || !riotIdCompleto.includes('#')) {
                return message.reply("Formato inválido! Use: `!elo NomeDeJogo#TAG`\nExemplo: `!elo Faker#KR1`");
            }

            // Separa o nome e a tag usando o '#' como divisor
            const [gameName, tagLine] = riotIdCompleto.split('#');

            console.log(`[DEBUG] Nome de Jogo: "${gameName}", Tagline: "${tagLine}"`);

            // Valida se ambos (nome e tag) existem após a separação
            if (!gameName || !tagLine) {
                return message.reply("Formato inválido! Você precisa incluir o nome e a tag. Exemplo: `!elo Faker#KR1`");
            }

            await message.reply(`Buscando o elo de *${gameName}#${tagLine}*... 🔎`);
            
            // Envia o nome e a tag como duas variáveis separadas, como a função espera
            const eloInfo = await riotService.buscarElo(gameName, tagLine);
            
            await message.reply(eloInfo);
            return;
        }
        
        // =======================================================
        // O restante do código para lidar com sessões de jogo
        // =======================================================

        let session = isGroup ? sessionManager.getSession(from) : sessionManager.getSession(sessionManager.getGroupFromPlayer(from));
        
        if (command === '!jogo') {
            // ... (seu código para !jogo continua aqui)
        }
        
        if (!session) {
            if (command.startsWith('!')) {
                 await message.reply('Nenhum jogo em andamento. Para começar, digite:\n `!jogo <nome do jogo>`.');
            }
            return;
        }

        if (session.status === 'lobby') {
            // ... (seu código para lobby continua aqui)
        }

        if (session.status === 'em_jogo') {
            // ... (seu código para jogo em andamento continua aqui)
        }

    } catch (error) {
        console.error('ERRO FATAL AO PROCESSAR COMANDO:', error);
        await message.reply('❌ Ocorreu um erro inesperado ao processar seu comando.');
    }
}

module.exports = handleCommand;