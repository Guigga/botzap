// C:\Users\Guilherme\bot-whatsapp\games\lobby.js

const poker = require('./Poker/poker');
const truco = require('./Truco/truco');
const botPlayer = require('./Poker/botPlayer');
const sessionManager = require('../sessions/sessionManager');
const trucoBot = require('./Truco/botPlayer');
const forca = require('./Forca/forca');
const velha = require('./Velha/velha')
const forcaBot = require('./Forca/botPlayer');
const uno = require('./Uno/uno');
const unoBot = require('./Uno/botPlayer');
const xadrez = require('./Xadrez/xadrez');
const xadrezBot = require('./Xadrez/botPlayer');
const { MessageMedia } = require('whatsapp-web.js');
const imageRenderer = require('./Xadrez/imageRenderer');

// --- LÓGICA PRINCIPAL DO LOBBY ---

async function criarLobby(session, client) {
    session.status = 'lobby';
    console.log(`[Lobby] Criando lobby para o jogo: ${session.game}`);
    
    if (session.game === 'truco') {
        session.players = {
            timeBlue: [],
            timeRed: []
        };
    } else {
        session.players = [];
    }

    const lobbyMessage = gerarMensagemLobby(session);
    await client.sendMessage(session.groupId, lobbyMessage);
}

async function handleLobbyCommand(message, session, client) {
    const command = message.body.split(' ')[0].toLowerCase();
    const playerId = message.author || message.from;

    switch (command) {
        case '!sair':
            // ... (código existente sem alterações, se houver)
            return;
        case '!ajuda':
        case '!comandos':
        case '!help':
            await enviarAjudaLobby(session, message);
            return;
    }

    if (session.game === 'truco') {
        await handleTrucoLobby(message, session, client);
    } else {
        await handleLobbyGenerico(message, session, client);
    }
}

function gerarMensagemLobby(session) {
    if (session.game === 'poker') return gerarMensagemLobbyPoker(session);
    if (session.game === 'truco') return gerarMensagemLobbyTruco(session);
    if (session.game === 'forca') return gerarMensagemLobbyForca(session);
    if (session.game === 'velha') return gerarMensagemLobbyVelha(session);
    if (session.game === 'uno') return gerarMensagemLobbyUno(session);
    if (session.game === 'xadrez') return gerarMensagemLobbyXadrez(session);
    return 'Lobby em modo desconhecido.';
}

// --- LÓGICAS DE LOBBY GENÉRICO (P/ POKER, FORCA, VELHA, UNO, XADREZ) ---

async function handleLobbyGenerico(message, session, client) {
    const command = message.body.split(' ')[0].toLowerCase();
    switch (command) {
        case '!entrar':
            await adicionarJogadorGenerico(message, session, client);
            break;
        case '!iniciar':
            if (session.game === 'poker') await iniciarJogoPoker(message, session, client);
            else if (session.game === 'forca') await iniciarJogoForca(message, session, client);
            else if (session.game === 'velha') await iniciarJogoVelha(message, session, client);
            else if (session.game === 'uno') await iniciarJogoUno(message, session, client);
            else if (session.game === 'xadrez') await iniciarJogoXadrez(message, session, client);
            break;
    }
}

const MAX_NAME_LENGTH = 20;

async function adicionarJogadorGenerico(message, session, client) {
    const { author, body } = message;
    const playerId = author || message.from;

    let MAX_PLAYERS = 8;
    if (session.game === 'velha' || session.game === 'xadrez') {
        MAX_PLAYERS = 2;
    }

    if (session.players.length >= MAX_PLAYERS) {
        return message.reply('❌ A sala está cheia!');
    }
    if (session.players.some(p => p.id === playerId)) {
        return message.reply('✔️ Você já está na mesa.');
    }
    
    let playerName = body.split(' ').slice(1).join(' ').trim();
    if (!playerName) {
        return message.reply('⚠️ Por favor, digite seu nome. Ex: `!entrar João`');
    }

    if (playerName.length > MAX_NAME_LENGTH) {
        playerName = playerName.substring(0, MAX_NAME_LENGTH);
        await message.reply(`Seu nome era muito longo e foi encurtado para: *${playerName}*`);
    }

    session.players.push({ id: playerId, name: playerName });
    sessionManager.mapPlayerToGroup(playerId, session.groupId);
    const lobbyMessage = gerarMensagemLobby(session);
    await client.sendMessage(session.groupId, lobbyMessage);
}

// --- LÓGICAS ESPECÍFICAS DE CADA JOGO ---

// =================================================================
// POKER
// =================================================================
function gerarMensagemLobbyPoker(session) {
    const MAX_PLAYERS = 8;
    let playersList = '';
    for (let i = 0; i < MAX_PLAYERS; i++) {
        const player = session.players[i];
        playersList += `${i + 1}. ${player ? player.name : '<vazio>'}\n`;
    }

    let comandos = '[ !entrar <seu_nome> ]  [ !ajuda ]';
    if (session.players.length >= 1) {
        comandos += '  *[ !iniciar ]*';
    }

    let lobbyMessage = `*Mesa de Poker Criada!* 🃏\n\n*Jogadores:*\n${playersList}\n---\n${comandos}`;

    if (session.players.length === 1) {
        lobbyMessage += '\n\n*Aviso:* Se iniciar agora, um BOT completará a mesa! 🤖';
    }

    return lobbyMessage;
}

async function iniciarJogoPoker(message, session, client) {
    const playerId = message.author || message.from;

    if (session.players.length > 0 && session.players[0].id !== playerId) {
        return message.reply('Apenas o primeiro jogador que entrou na mesa pode iniciar o jogo.');
    }
    if (session.players.length === 0) {
        return client.sendMessage(session.groupId, '⚠️ Não é possível iniciar um jogo sem jogadores!');
    }
    if (session.players.length === 1) {
        const bot = botPlayer.createBotPlayer();
        session.players.push(bot);
        await client.sendMessage(session.groupId, `🤖 ${bot.name} entrou para completar a mesa.`);
    }

    session.status = 'em_jogo';
    poker.prepararJogo(session);
    await client.sendMessage(session.groupId, '🎲 O jogo de *Poker* está começando! Boa sorte a todos.');
    await poker.iniciarRodada(session, client);
}

// =================================================================
// TRUCO
// =================================================================
// (Funções de Truco permanecem aqui, pois têm lógica customizada)
function gerarMensagemLobbyTruco(session) {
    let blueList = '';
    let redList = '';

    for (let i = 0; i < 2; i++) {
        const playerBlue = session.players.timeBlue[i];
        blueList += `${i + 1}. ${playerBlue ? playerBlue.name : '<vazio>'}\n`;
        const playerRed = session.players.timeRed[i];
        redList += `${i + 1}. ${playerRed ? playerRed.name : '<vazio>'}\n`;
    }

    let comandos = '[ !entrar <seu_nome> <blue ou red> ]  [ !ajuda ]';
    const blueCount = session.players.timeBlue.length;
    const redCount = session.players.timeRed.length;
    const totalPlayers = blueCount + redCount;

    if (totalPlayers === 1 || (blueCount === 1 && redCount === 1) || (blueCount === 2 && redCount === 2)) {
        comandos += '  *[ !iniciar ]*';
    }

    let lobbyMessage = `*Mesa de Truco Criada!* 🎴\n\n*Jogadores:*\n\n*Time Blue* 🔵\n${blueList}\n*Time Red* 🔴\n${redList}\n---\n${comandos}`;

    if (totalPlayers === 1) {
        lobbyMessage += '\n\n*Aviso:* Se iniciar agora, você jogará contra um BOT! 🤖';
    }

    return lobbyMessage;
}

async function handleTrucoLobby(message, session, client) {
    const command = message.body.split(' ')[0].toLowerCase();
    switch (command) {
        case '!entrar':
            await adicionarJogadorTruco(message, session, client);
            break;
        case '!iniciar':
            await iniciarJogoTruco(message, session, client);
            break;
    }
}

async function adicionarJogadorTruco(message, session, client) {
    const { author, body } = message;
    const playerId = author || message.from;
    const args = body.split(' ').slice(1);
    
    if (session.players.timeBlue.some(p => p.id === playerId) || session.players.timeRed.some(p => p.id === playerId)) {
        return message.reply('✔️ Você já está em um time.');
    }
    if (args.length === 0) {
        return message.reply('⚠️ Por favor, digite seu nome. Ex: `!entrar João`');
    }

    let playerName;
    let timeEscolhido = args[args.length - 1].toLowerCase();
    let timeObject;

    if (timeEscolhido === 'blue' || timeEscolhido === 'red') {
        playerName = args.slice(0, -1).join(' ').trim();
    } else {
        playerName = args.join(' ').trim();
    }

    if (!playerName) {
        return message.reply('⚠️ Por favor, digite seu nome. Ex: `!entrar João blue`');
    }

    if (playerName.length > MAX_NAME_LENGTH) {
        playerName = playerName.substring(0, MAX_NAME_LENGTH);
        await message.reply(`Seu nome era muito longo e foi encurtado para: *${playerName}*`);
    }

    if (timeEscolhido === 'blue' || timeEscolhido === 'red') {
        timeObject = (timeEscolhido === 'blue') ? session.players.timeBlue : session.players.timeRed;
        if (timeObject.length >= 2) {
            return message.reply(`❌ O time ${timeEscolhido} já está cheio!`);
        }
    } else {
        if (session.players.timeBlue.length <= session.players.timeRed.length && session.players.timeBlue.length < 2) {
            timeObject = session.players.timeBlue;
            await message.reply(`Você foi alocado automaticamente ao time *Blue 🔵*!`);
        } else if (session.players.timeRed.length < 2) {
            timeObject = session.players.timeRed;
            await message.reply(`Você foi alocado automaticamente ao time *Red 🔴*!`);
        } else {
            return message.reply('❌ A mesa está cheia! Não há vagas em nenhum time.');
        }
    }
    
    timeObject.push({ id: playerId, name: playerName });
    sessionManager.mapPlayerToGroup(playerId, session.groupId);
    const lobbyMessage = gerarMensagemLobby(session);
    await client.sendMessage(session.groupId, lobbyMessage);
}

async function iniciarJogoTruco(message, session, client) {
    const playerId = message.author || message.from;
    const criadorId = session.players.timeBlue[0]?.id || session.players.timeRed[0]?.id;

    if (criadorId && criadorId !== playerId) {
        return message.reply('Apenas o primeiro jogador que entrou na mesa pode iniciar o jogo.');
    }

    let blueCount = session.players.timeBlue.length;
    let redCount = session.players.timeRed.length;
    const totalPlayers = blueCount + redCount;

    if (totalPlayers === 1) {
        const bot = trucoBot.createBotPlayer();
        if (blueCount === 1) {
            session.players.timeRed.push(bot);
            redCount++;
        } else {
            session.players.timeBlue.push(bot);
            blueCount++;
        }
        await client.sendMessage(session.groupId, `🤖 ${bot.name} entrou para o time adversário!`);
    }

    if (!((blueCount === 1 && redCount === 1) || (blueCount === 2 && redCount === 2))) {
        return message.reply('⚠️ Não é possível iniciar! O jogo deve ser 1x1 ou 2x2.');
    }
    
    const jogadoresOrdenados = [];
    const timeBlue = session.players.timeBlue;
    const timeRed = session.players.timeRed;

    for (let i = 0; i < 2; i++) {
        if (timeBlue[i]) jogadoresOrdenados.push(timeBlue[i]);
        if (timeRed[i]) jogadoresOrdenados.push(timeRed[i]);
    }
    
    session.players = jogadoresOrdenados;
    session.status = 'em_jogo';
    truco.prepararJogo(session);
    await client.sendMessage(session.groupId, '🎲 O jogo de *Truco* está começando! Boa sorte a todos.');
    await truco.iniciarRodada(session, client);
}

// =================================================================
// FORCA
// =================================================================
function gerarMensagemLobbyForca(session) {
    const MAX_PLAYERS = 8;
    let playersList = '';
    for (let i = 0; i < MAX_PLAYERS; i++) {
        const player = session.players[i];
        playersList += `${i + 1}. ${player ? player.name : '<vazio>'}\n`;
    }

    let comandos = '[ !entrar <seu_nome> ]  [ !ajuda ]';
    if (session.players.length >= 1) {
        comandos += '  *[ !iniciar ]*';
    }

    let lobbyMessage = `*Sala de Jogo da Forca Criada!* 💀\n\n*Jogadores na Fila:*\n${playersList}\n---\n${comandos}`;

    if (session.players.length === 1) {
        lobbyMessage += '\n\n*Aviso:* Se iniciar agora, você jogará sozinho contra o Bot!';
    } else if (session.players.length > 1) {
        lobbyMessage += `\n\n*Aviso:* Se iniciar agora, o jogo será em grupo e *${session.players[0].name}* escolherá a primeira palavra!`;
    }

    return lobbyMessage;
}

async function iniciarJogoForca(message, session, client) {
    const playerId = message.author || message.from;

    if (session.players.length > 0 && session.players[0].id !== playerId) {
        return message.reply('Apenas o primeiro jogador que entrou na sala pode iniciar o jogo.');
    }
    if (session.players.length === 0) {
        return client.sendMessage(session.groupId, '⚠️ Não é possível iniciar um jogo sem jogadores!');
    }

    if (session.players.length === 1) {
        const bot = forcaBot.createBotPlayer();
        session.players.push(bot);
        await client.sendMessage(session.groupId, `🤖 ${bot.name} entrou na sala para adivinhar a sua palavra!`);
    }

    session.status = 'em_jogo';
    forca.prepararJogo(session);
    await client.sendMessage(session.groupId, '💀 O *Jogo da Forca* está começando!');
    await forca.iniciarRodada(session, client);
}

// =================================================================
// VELHA
// =================================================================
function gerarMensagemLobbyVelha(session) {
    let playersList = '1. <vazio>\n2. <vazio>\n';
    if (session.players.length > 0) {
        playersList = `1. ${session.players[0].name}\n`;
        playersList += `2. ${session.players[1] ? session.players[1].name : '<vazio>'}\n`;
    }

    let comandos = '[ !entrar <seu_nome> ]  [ !ajuda ]';
    
    if (session.players.length >= 1) {
        comandos += '  *[ !iniciar ]*';
    }

    let lobbyMessage = `*Sala de Jogo da Velha Infinito Criada!* ♾️\n\n*Jogadores (2 no total):*\n${playersList}\n---\n${comandos}`;
    
    if (session.players.length === 1) {
        const botPlayer = require('./Velha/botPlayer');
        lobbyMessage += `\n\n*Aviso:* Se iniciar agora, você jogará contra o *BOT Velhaco*! 🤖`;
    }
    
    return lobbyMessage;
}

async function iniciarJogoVelha(message, session, client) {
    const botPlayer = require('./Velha/botPlayer');

    if (session.players.length === 1) {
        const bot = botPlayer.createBotPlayer();
        session.players.push(bot);
        await client.sendMessage(session.groupId, `🤖 ${bot.name} entrou para jogar contra você!`);
    }

    if (session.players.length !== 2) {
        return message.reply('⚠️ É preciso exatamente 2 jogadores para iniciar o Jogo da Velha.');
    }

    session.status = 'em_jogo';
    const jogoDaVelha = require('./Velha/velha');
    jogoDaVelha.prepararJogo(session);

    const primeiroJogador = session.players[0];
    const legenda = `♾️ O *Jogo da Velha Infinito* está começando!\n\nÉ a vez de *${primeiroJogador.name}* (❌). Use \`!jogar <posição>\`, ex: \`!jogar a1\`.`;
    
    const displayInicial = await jogoDaVelha.montarDisplay(session.gameState, null);
    await client.sendMessage(session.groupId, displayInicial, { caption: legenda });

    if (primeiroJogador.id === botPlayer.BOT_ID) {
        await jogoDaVelha.dispararAcaoBot(session, client);
    }
}

// =================================================================
// UNO
// =================================================================
function gerarMensagemLobbyUno(session) {
    const MAX_PLAYERS = 8;
    let playersList = '';
    for (let i = 0; i < MAX_PLAYERS; i++) {
        const player = session.players[i];
        playersList += `${i + 1}. ${player ? player.name : '<vazio>'}\n`;
    }

    let comandos = '[ !entrar <seu_nome> ]  [ !ajuda ]';
    if (session.players.length >= 1) {
        comandos += '  *[ !iniciar ]*';
    }

    let lobbyMessage = `*Mesa de UNO Criada!* 🃏\n\n*Jogadores:*\n${playersList}\n---\n${comandos}`;

    if (session.players.length === 1) {
        lobbyMessage += `\n\n*Aviso:* Se iniciar agora, você jogará contra o *${unoBot.BOT_NAME}*! 🤖`;
    }

    return lobbyMessage;
}

async function iniciarJogoUno(message, session, client) {
    const playerId = message.author || message.from;

    if (session.players.length > 0 && session.players[0].id !== playerId) {
        return message.reply('Apenas o primeiro jogador que entrou na mesa pode iniciar o jogo.');
    }
    if (session.players.length === 0) {
        return client.sendMessage(session.groupId, '⚠️ Não é possível iniciar um jogo sem jogadores!');
    }

    if (session.players.length === 1) {
        const bot = unoBot.createBotPlayer();
        session.players.push(bot);
        await client.sendMessage(session.groupId, `🤖 ${bot.name} entrou para completar a mesa.`);
    }

    uno.prepararJogo(session);
    await client.sendMessage(session.groupId, '🃏 O jogo de *UNO* está começando! Boa sorte a todos.');
    await uno.iniciarPartida(session, client);
}

// =================================================================
// XADREZ
// =================================================================
function gerarMensagemLobbyXadrez(session) {
    let playersList = '1. (Brancas) <vazio>\n2. (Pretas) <vazio>\n';
    if (session.players.length > 0) {
        playersList = `1. (Brancas) ${session.players[0].name}\n`;
        playersList += `2. (Pretas) ${session.players[1] ? session.players[1].name : '<vazio>'}\n`;
    }

    let comandos = '[ !entrar <seu_nome> ]  [ !ajuda ]';
    
    if (session.players.length >= 1) {
        comandos += '  *[ !iniciar ]*';
    }

    let lobbyMessage = `*Mesa de Xadrez Criada!* ♟️\n\n*Jogadores (2 no total):*\n${playersList}\n---\n${comandos}`;
    
    if (session.players.length === 1) {
        lobbyMessage += `\n\n*Aviso:* Se iniciar agora, você jogará contra o *BOT Kasparov*! 🤖`;
    }
    
    return lobbyMessage;
}

async function iniciarJogoXadrez(message, session, client) {
    const playerId = message.author || message.from;

    if (session.players.length > 0 && session.players[0].id !== playerId) {
        return message.reply('Apenas o primeiro jogador que entrou na mesa pode iniciar o jogo.');
    }

    if (session.players.length === 1) {
        const bot = xadrezBot.createBotPlayer();
        session.players.push(bot);
        await client.sendMessage(session.groupId, `🤖 *BOT Kasparov* entrou para jogar de Pretas!`);
    }

    if (session.players.length !== 2) {
        return message.reply('⚠️ É preciso exatamente 2 jogadores para iniciar o Xadrez.');
    }

    session.status = 'em_jogo';
    xadrez.prepararJogo(session);
    
    const primeiroJogador = session.players[0];
    const legenda = `♟️ O jogo de *Xadrez* está começando!\n\nÉ a vez de *${primeiroJogador.name}* (Brancas).\n Use \`!mover <origem> <destino>\`\n ex: \`!mover e2 e4\`.`;
    
    
    const imagemBuffer = await imageRenderer.renderBoardToImage(session.gameState);
    
    if (imagemBuffer) {
        const chat = await message.getChat();
        await chat.sendMessage(new MessageMedia('image/png', imagemBuffer.toString('base64')), { caption: legenda });
    } else {
        await message.reply('❌ Ocorreu um erro ao gerar a imagem do tabuleiro.');
    }
}

// =================================================================
// AJUDA
// =================================================================
async function enviarAjudaLobby(session, message) {
    let ajudaMsg = '';
    // ...
    if (session.game === 'xadrez') {
        ajudaMsg = `📖 *Comandos do Lobby de Xadrez:*\n` +
                      `- !entrar <seu_nome> - Entra na partida (limite de 2 jogadores)\n` +
                      `- !iniciar - Começa o jogo\n` +
                      `- !sair - Fecha o lobby ou sai dele\n\n` +
                      `Se apenas 1 jogador iniciar, um bot entrará na partida.`;
    }
    await message.reply(ajudaMsg);
}

module.exports = {
    criarLobby,
    handleLobbyCommand
};