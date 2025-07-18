// C:\Users\Guilherme\bot-whatsapp\controllers\commandHandler.js

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const logger = require('../utils/logger');
const config = require('../config.json');
const sessionManager = require('../sessions/sessionManager');
const lobby = require('../games/lobby');
const pokerActions = require('../games/Poker/playerActions');
const trucoActions = require('../games/Truco/playerActions');
const forcaActions = require('../games/Forca/playerActions');
const velhaActions = require('../games/Velha/playerActions');
const unoActions = require('../games/Uno/playerActions');
const xadrezActions = require('../games/Xadrez/playerActions');
const rpgHandler = require('./rpgHandler');
const handleMusica = require('./musicaHandler');
const JOGOS_VALIDOS = ['poker', 'truco', 'forca', 'velha', 'uno', 'xadrez'];

const resultadosPassados = new Set();
let megaCarregada = false;

const csvFilePath = path.join(__dirname, '..', 'assets', 'mega_sena.csv');

fs.createReadStream(csvFilePath)
    .pipe(parse({ delimiter: ';', from_line: 2 }))
    .on('data', function (row) {
        try {
            const numeros = row.slice(2, 8).map(Number).sort((a, b) => a - b);
            if (numeros.length === 6 && !numeros.some(isNaN)) {
                resultadosPassados.add(numeros.join(','));
            }
        } catch (e) {
            // Ignora linhas com erro
        }
    })
    .on('end', function () {
        megaCarregada = true;
        console.log(`[Mega-Sena] Carregados ${resultadosPassados.size} resultados históricos.`); // <<< USANDO O NOME CORRETO
    })
    .on('error', function (error) {
        console.error('[Mega-Sena] Erro ao ler o arquivo CSV:', error.message);
    });

function gerarJogoInedito() {
    if (!megaCarregada) {
        return null;
    }

    while (true) {
        const numeros = new Set();
        while (numeros.size < 6) {
            numeros.add(Math.floor(Math.random() * 60) + 1);
        }
        
        const numerosOrdenados = Array.from(numeros).sort((a, b) => a - b);
        const jogoStr = numerosOrdenados.join(',');

        if (!resultadosPassados.has(jogoStr)) {
            return numerosOrdenados;
        }
    }
}

async function handleCommand(message, client) {
    try {
        const { from, body } = message;
        logger.log(message, `Comando recebido: ${body}`);
        console.log(`[ID Hunter] Mensagem recebida do ID: ${from}`);
        const isGroup = from.endsWith('@g.us');

        // --- NOVO BLOCO DE FILTRAGEM DE GRUPO ---
        if (config.enableGroupFilter && isGroup && !config.allowedGroupIds.includes(from)) {
            // O logger vai buscar o nome do contato e do chat automaticamente!
            logger.log(message, 'Comando ignorado: grupo não está na whitelist.');
            return;
        }

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
                                  `• Velha\n` +
                                  `• Uno\n` +
                                  `• Xadrez\n\n` +
                                  `---\n\n` +
                                  `*Outros comandos:*\n` +
                                  `• \`!figurinha\` - Responda a uma imagem para criar um sticker.\n` +
                                  `• \`!mega\` - Gera um número da megasena.\n` +
                                  `• \`!moeda\` - Joga um cara ou coroa.\n` +
                                  `• \`!bicho\` - Te da o resultado do jogo do bicho.\n` +
                                  `• \`!responda <pergunta>\` - Responde suas perguntas com 100% de certeza.\n` +
                                  `• \`!musica <nome>\` - Envia o link de uma música do YouTube.\n` +
                                  `• \`!sair\` - Encerra um jogo ou lobby em andamento.\n\n` +
                                  `Vamos começar? 🎉`;
            await message.reply(botZapMessage);
            return;
        }

        if (command === '!id') {
            await message.reply(`O ID deste chat é:\n\`${from}\``);
            return;
        }

        if (command === '!debug') {
            console.log('===== OBJETO MESSAGE COMPLETO =====');
            console.log(message);
            console.log('=================================');
            await message.reply('O objeto da mensagem foi impresso no console do bot. 😉');
            return;
        }

        const rpgCommandsList = [
            '!rpg', '!dados', '!criar-ficha', '!ficha', '!set', '!apagar-ficha', 
            '!remover', '!rpg-ajuda', '!rpg-help', '!add', '!rmv', '!classes', 
            '!racas', '!addhab', '!rmvhab', '!addmagia', '!rmvmagia', 
            '!addataque', '!rmvataque'
        ];
        const isDiceShorthand = command.match(/^!(\d+d\d+.*)$/i);

        // --- Roteamento para o Módulo de RPG ---
        if (rpgCommandsList.includes(command) || isDiceShorthand) {
            await rpgHandler.handleRpgCommand(message);
            return;
        }

        if (command === '!mega') {
            const jogo = gerarJogoInedito();
            if (jogo) {
                const resultado = jogo.map(n => n.toString().padStart(2, '0')).join(' - ');
                await message.reply(`*Combinação Inédita Encontrada!*\n\n✨ *${resultado}* ✨\n\nEssa nunca saiu! Boa sorte!`);
            } else {
                await message.reply('Desculpe, ainda estou processando o histórico de jogos. Tente novamente em um instante.');
            }
            return;
        }        

        if (command === '!moeda') {
            await message.reply('Jogando a moeda... 🪙');
            const resultado = Math.random() < 0.5 ? 'Cara' : 'Coroa';
            const emoji = resultado === 'Cara' ? '🗿' : '👑';
            await message.reply(`Deu *${resultado}*! ${emoji}`);
            return;
        }        

        if (command === '!bicho') {
            const animais = ['Avestruz  G1', 'Águia G2', 'Burro G3', 'Borboleta G4', 'Cachorro G5', 'Cabra G6', 'Carneiro G7', 'Camelo G8', 'Cobra G9', 'Coelho G10', 'Cavalo G11', 'Elefante G12', 'Galo G13', 'Gato G14', 'Jacaré G15', 'Leão G16', 'Macaco G17', 'Porco G18', 'Pavão G19', 'Peru G20', 'Touro G21', 'Tigre G22', 'Urso G23', 'Veado G24', 'Vaca G25'];
            const sorteado = animais[Math.floor(Math.random() * animais.length)];
            await message.reply(`O resultado de hoje é: *${sorteado}*`);
            return;
        }

        if (command === '!responda') {
            const respostas = ["Sim.", "Não.", "Com certeza!", "Definitivamente não.", "Talvez.", "Os astros indicam que sim.", "Concentre-se e pergunte de novo.", "Não conte com isso."];
            const respostaMistica = respostas[Math.floor(Math.random() * respostas.length)];
            await message.reply(`O Botzap responde:\n\n*${respostaMistica}*`);
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
        
        if (command === '!sair') {
            if (session) {
                const gameName = session.game.charAt(0).toUpperCase() + session.game.slice(1);
                if (sessionManager.endSession(session.groupId)) {
                    await message.reply(`✅ O jogo de *${gameName}* foi encerrado.`);
                }
            } else {
              await message.reply('Não há nenhum jogo ou lobby em andamento para sair.');
          }
          return;
        }
        
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
                 await message.reply('Digite: `!botzap` para mais informações');
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
                case 'uno':
                    await unoActions.handleGameCommand(message, session, client);
                    break;
                case 'xadrez':
                    await xadrezActions.handleGameCommand(message, session, client);
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