// C:\Users\Guilherme\bot-whatsapp\games\lobby.js

const poker = require('./Poker/poker');
const truco = require('./Truco/truco'); // Importamos o módulo principal do Truco
const botPlayer = require('./Poker/botPlayer');
const sessionManager = require('../sessions/sessionManager');
const trucoBot = require('./Truco/botPlayer');
const forca = require('./Forca/forca');
const velha = require('./Velha/velha')

// --- LÓGICA PRINCIPAL DO LOBBY ---

/**
 * Função "mãe" que direciona a criação do lobby para o jogo correto.
 * @param {object} session - A sessão do jogo.
 * @param {object} client - O cliente do WhatsApp.
 */
async function criarLobby(session, client) {
    session.status = 'lobby';
    console.log(`[Lobby] Criando lobby para o jogo: ${session.game}`);
    
    // Prepara a estrutura de jogadores específica do jogo
    if (session.game === 'truco') {
        session.players = {
            timeBlue: [],
            timeRed: []
        };
    } else { // Para poker e outros jogos futuros
        session.players = [];
    }

    const lobbyMessage = gerarMensagemLobby(session);
    await client.sendMessage(session.groupId, lobbyMessage);
}

/**
 * Função "mãe" que direciona os comandos do lobby para o jogo correto.
 * @param {object} message - O objeto da mensagem.
 * @param {object} session - A sessão de jogo ativa.
 * @param {object} client - O cliente do WhatsApp.
 */
async function handleLobbyCommand(message, session, client) {
    const command = message.body.split(' ')[0].toLowerCase();

    // Comandos universais do lobby
    switch (command) {
        case '!sair': // Renomeado
            if (sessionManager.endSession(session.groupId)) {
                await message.reply('O lobby foi encerrado.');
            }
            return;
        case '!ajuda':
        case '!comandos':
        case '!help':
            await enviarAjudaLobby(session, message);
            return;
    }

    // Direciona para o handler específico do jogo
    if (session.game === 'poker') {
        await handlePokerLobby(message, session, client);
    } else if (session.game === 'truco') {
        await handleTrucoLobby(message, session, client);
    } else if (session.game === 'forca') {
        await handlePokerLobby(message, session, client);
    } else if (session.game === 'velha') {
        await handlePokerLobby(message, session, client);
    }
}

function gerarMensagemLobby(session) {
    if (session.game === 'poker') {
        return gerarMensagemLobbyPoker(session);
    } else if (session.game === 'truco') {
        return gerarMensagemLobbyTruco(session);
    } else if (session.game === 'forca') {
        return gerarMensagemLobbyForca(session);
    } else if (session.game === 'velha') { 
        return gerarMensagemLobbyVelha(session);
    }
    return 'Lobby em modo desconhecido.';
}

// --- LÓGICAS ESPECÍFICAS PARA CADA JOGO ---

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

    let comandos = '[ !entrar <seu_nome> ]  [ !ajuda ]';
    if (session.players.length >= 1) {
        comandos += '  *[ !iniciar ]*';
    }

    let lobbyMessage = `*Mesa de Poker Criada!* 🃏\n\n*Jogadores:*\n${playersList}\n---\n${comandos}`;

    // Adiciona o aviso se apenas 1 jogador estiver na mesa
    if (session.players.length === 1) {
        lobbyMessage += '\n\n*Aviso:* Se iniciar agora, um BOT completará a mesa! 🤖';
    }

    return lobbyMessage;
}

async function handlePokerLobby(message, session, client) {
    const command = message.body.split(' ')[0].toLowerCase();
    switch (command) {
        case '!entrar':
            await adicionarJogadorPoker(message, session, client);
            break;
        case '!iniciar':
            await iniciarJogoPoker(message, session, client);
            break;
    }
}

async function adicionarJogadorPoker(message, session, client) {
    const { author, body } = message;
    const playerId = author || message.from;
    // Limite dinâmico: 2 para a velha, 8 para os outros jogos
    const MAX_PLAYERS = session.game === 'velha' ? 2 : 8;

    if (session.players.length >= MAX_PLAYERS) {
        return message.reply('❌ A sala está cheia!');
    }
    // O resto da função continua exatamente igual...
    if (session.players.some(p => p.id === playerId)) {
        return message.reply('✔️ Você já está na mesa.');
    }
    const playerName = body.split(' ').slice(1).join(' ').trim();
    if (!playerName) {
        return message.reply('⚠️ Por favor, digite seu nome. Ex: `!entrar João`');
    }
    session.players.push({ id: playerId, name: playerName });
    sessionManager.mapPlayerToGroup(playerId, session.groupId);
    const lobbyMessage = gerarMensagemLobby(session);
    await client.sendMessage(session.groupId, lobbyMessage);
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
    poker.prepararJogo(session); // Chama a preparação específica do poker
    await client.sendMessage(session.groupId, '🎲 O jogo de *Poker* está começando! Boa sorte a todos.');
    await poker.iniciarRodada(session, client);
}


// =================================================================
// TRUCO
// =================================================================

function gerarMensagemLobbyTruco(session) {
    let blueList = '';
    let redList = '';

    for (let i = 0; i < 2; i++) {
        const playerBlue = session.players.timeBlue[i];
        blueList += `${i + 1}. ${playerBlue ? playerBlue.name : '<vazio>'}\n`;
        const playerRed = session.players.timeRed[i];
        redList += `${i + 1}. ${playerRed ? playerRed.name : '<vazio>'}\n`;
    }

    let comandos = '[ !entrar <seu_nome> <blue ou red> ]  [ !ajuda ]';
    const blueCount = session.players.timeBlue.length;
    const redCount = session.players.timeRed.length;
    const totalPlayers = blueCount + redCount;

    // Nova condição para iniciar: 1 jogador (vs Bot), 1v1 ou 2v2
    if (totalPlayers === 1 || (blueCount === 1 && redCount === 1) || (blueCount === 2 && redCount === 2)) {
        comandos += '  *[ !iniciar ]*';
    }

    let lobbyMessage = `*Mesa de Truco Criada!* 🎴\n\n*Jogadores:*\n\n*Time Blue* 🔵\n${blueList}\n*Time Red* 🔴\n${redList}\n---\n${comandos}`;

    // Adiciona o aviso se apenas 1 jogador estiver na mesa
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

    // Validações Iniciais
    if (session.players.timeBlue.some(p => p.id === playerId) || session.players.timeRed.some(p => p.id === playerId)) {
        return message.reply('✔️ Você já está em um time.');
    }
    if (args.length === 0) {
        return message.reply('⚠️ Por favor, digite seu nome. Ex: `!entrar João`');
    }

    let playerName;
    let timeEscolhido = args[args.length - 1].toLowerCase();
    let timeObject;

    // Cenário 1: Jogador especificou um time
    if (timeEscolhido === 'blue' || timeEscolhido === 'red') {
        playerName = args.slice(0, -1).join(' ').trim();
        if (!playerName) {
            return message.reply('⚠️ Por favor, digite seu nome antes do time. Ex: `!entrar João blue`');
        }
        
        timeObject = (timeEscolhido === 'blue') ? session.players.timeBlue : session.players.timeRed;
        if (timeObject.length >= 2) {
            return message.reply(`❌ O time ${timeEscolhido} já está cheio!`);
        }
    
    // Cenário 2: Jogador NÃO especificou um time (alocação automática)
    } else {
        playerName = args.join(' ').trim();
        
        if (session.players.timeBlue.length < 2) {
            timeObject = session.players.timeBlue;
            timeEscolhido = 'Blue 🔵';
        } else if (session.players.timeRed.length < 2) {
            timeObject = session.players.timeRed;
            timeEscolhido = 'Red 🔴';
        } else {
            return message.reply('❌ A mesa está cheia! Não há vagas em nenhum time.');
        }
        await message.reply(`Você foi alocado automaticamente ao time *${timeEscolhido}*!`);
    }

    // Adiciona o jogador ao time determinado
    timeObject.push({ id: playerId, name: playerName });
    sessionManager.mapPlayerToGroup(playerId, session.groupId);

    // Envia a atualização do lobby para o grupo
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

    // LÓGICA DO BOT: Se apenas 1 jogador iniciar, adiciona o bot
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

    // Condição de início: 1x1 (incluindo bot) ou 2x2
    if (!((blueCount === 1 && redCount === 1) || (blueCount === 2 && redCount === 2))) {
        return message.reply('⚠️ Não é possível iniciar! O jogo deve ser 1x1 ou 2x2.');
    }
    
    // **A CORREÇÃO ESTÁ AQUI**
    // 1. Cria um novo array para os jogadores ordenados
    const jogadoresOrdenados = [];
    const timeBlue = session.players.timeBlue;
    const timeRed = session.players.timeRed;

    // 2. Popula o novo array na ordem correta (alternando times)
    for (let i = 0; i < 2; i++) {
        if (timeBlue[i]) jogadoresOrdenados.push(timeBlue[i]);
        if (timeRed[i]) jogadoresOrdenados.push(timeRed[i]);
    }
    
    // 3. AGORA SIM, substitui a estrutura de times pelo array plano de jogadores
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

    let comandos = '[ !entrar <seu_nome> ]  [ !ajuda ]';
    if (session.players.length >= 1) {
        comandos += '  *[ !iniciar ]*';
    }

    let lobbyMessage = `*Sala de Jogo da Forca Criada!* 💀\n\n*Jogadores na Fila:*\n${playersList}\n---\n${comandos}`;

    if (session.players.length === 1) {
        lobbyMessage += '\n\n*Aviso:* Se iniciar agora, você jogará sozinho contra o Bot!';
    } else if (session.players.length > 1) {
        lobbyMessage += `\n\n*Aviso:* Se iniciar agora, o jogo será em grupo e *${session.players[0].name}* escolherá a primeira palavra!`;
    }

    return lobbyMessage;
}

// Adicione esta nova função para iniciar o jogo
async function iniciarJogoForca(message, session, client) {
    const playerId = message.author || message.from;

    if (session.players.length > 0 && session.players[0].id !== playerId) {
        return message.reply('Apenas o primeiro jogador que entrou na sala pode iniciar o jogo.');
    }
    if (session.players.length === 0) {
        return client.sendMessage(session.groupId, '⚠️ Não é possível iniciar um jogo sem jogadores!');
    }

    session.status = 'em_jogo';
    forca.prepararJogo(session); // Prepara o estado do jogo
    await client.sendMessage(session.groupId, '💀 O *Jogo da Forca* está começando!');
    await forca.iniciarRodada(session, client); // Inicia a primeira rodada
}

async function handlePokerLobby(message, session, client) {
    const command = message.body.split(' ')[0].toLowerCase();
    switch (command) {
        case '!entrar':
            await adicionarJogadorPoker(message, session, client);
            break;
        case '!iniciar':
            // Direciona para o iniciador correto
            if (session.game === 'poker') {
                await iniciarJogoPoker(message, session, client);
            } else if (session.game === 'forca') {
                await iniciarJogoForca(message, session, client);
            } else if (session.game === 'velha') { // <<< Adicione este else if
                await iniciarJogoVelha(message, session, client);
            }
            break;
    }
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

    let comandos = '[ !entrar <seu_nome> ]  [ !ajuda ]';
    
    // CORREÇÃO: Mostra o botão de iniciar com 1 ou 2 jogadores
    if (session.players.length >= 1) {
        comandos += '  *[ !iniciar ]*';
    }

    let lobbyMessage = `*Sala de Jogo da Velha Infinito Criada!* ♾️\n\n*Jogadores (2 no total):*\n${playersList}\n---\n${comandos}`;
    
    // NOVO: Adiciona o aviso sobre jogar contra o bot
    if (session.players.length === 1) {
        const botPlayer = require('./Velha/botPlayer');
        lobbyMessage += `\n\n*Aviso:* Se iniciar agora, você jogará contra o *BOT Velhaco*! 🤖`;
    }
    
    return lobbyMessage;
}

async function iniciarJogoVelha(message, session, client) {
    const botPlayer = require('./Velha/botPlayer'); // Importa para ter o ID do bot

    // LÓGICA PARA ADICIONAR O BOT QUANDO JOGA SOZINHO
    if (session.players.length === 1) {
        const bot = botPlayer.createBotPlayer();
        session.players.push(bot);
        await client.sendMessage(session.groupId, `🤖 ${bot.name} entrou para jogar contra você!`);
    }

    // Esta verificação agora funciona, pois o bot foi adicionado antes
    if (session.players.length !== 2) {
        return message.reply('⚠️ É preciso exatamente 2 jogadores para iniciar o Jogo da Velha.');
    }

    session.status = 'em_jogo';
    const jogoDaVelha = require('./Velha/velha');
    jogoDaVelha.prepararJogo(session);

    const primeiroJogador = session.players[0];
    const legenda = `♾️ O *Jogo da Velha Infinito* está começando!\n\nÉ a vez de *${primeiroJogador.name}* (❌). Use \`!jogar <posição>\`, ex: \`!jogar a1\`.`;
    
    const displayInicial = await jogoDaVelha.montarDisplay(session.gameState);
    await client.sendMessage(session.groupId, displayInicial, { caption: legenda });

    // NOVO: Verifica se o primeiro a jogar é o bot e dispara a ação dele
    if (primeiroJogador.id === botPlayer.BOT_ID) {
        await jogoDaVelha.dispararAcaoBot(session, client);
    }
}

// =================================================================
// AJUDA
// =================================================================

async function enviarAjudaLobby(session, message) {
    let ajudaMsg = '';
    if (session.game === 'poker') {
        ajudaMsg = `📖 *Comandos do Lobby de Poker:*\n` +
                   `- !entrar <seu_nome> - Entra na mesa\n` +
                   `- !iniciar - Começa o jogo com os jogadores atuais\n` +
                   `- !fimjogo - Fecha o lobby\n\n` +
                   `Se apenas 1 jogador iniciar, um bot entrará na partida.`;
    } else if (session.game === 'truco') {
        ajudaMsg = `📖 *Comandos do Lobby de Truco:*\n` +
                `- !entrar <seu_nome> - Entra no primeiro time com vaga\n` +
                `- !entrar <seu_nome> <blue ou red> - Entra em um time específico\n` +
                `- !iniciar - Começa o jogo (requer 1x1 ou 2x2)\n` +
                `- !sair - Fecha o lobby`;
    } else if (session.game === 'velha') {
        ajudaMsg = `📖 *Comandos do Lobby do Jogo da Velha:*\n` +
                   `- !entrar <seu_nome> - Entra na partida (limite de 2 jogadores)\n` +
                   `- !iniciar - Começa o jogo com 2 jogadores\n` +
                   `- !sair - Fecha o lobby`;
    }
    await message.reply(ajudaMsg);
}


module.exports = {
    criarLobby,
    handleLobbyCommand
};
