// C:\Users\Guilherme\bot-whatsapp\games\Forca\forca.js

const { MessageMedia } = require('whatsapp-web.js');
const path = require('path'); // Precisaremos do 'path'
const sessionManager = require('../../sessions/sessionManager');
const getPalavraAleatoria = require('./palavras');

function montarDisplay(gameState) {
    const { palavraSecreta, letrasCorretas, letrasErradas } = gameState;
    const erros = letrasErradas.length;

    // 1. Monta o texto da legenda
    const palavraDisplay = palavraSecreta
        .split('')
        .map(letra => (letrasCorretas.includes(letra) ? letra : '_'))
        .join(' ');

    let legenda = `Palavra: *${palavraDisplay}*\n\n`;
    if (letrasErradas.length > 0) {
        legenda += `Letras erradas: ${letrasErradas.join(', ')}\n\n`;
    }
    legenda += `Para jogar, digite \`!letra <letra>\``;

    // 2. Carrega a imagem estática correspondente ao número de erros
    const imagePath = path.join(__dirname, 'assets', `forca_${erros}.png`);
    const media = MessageMedia.fromFilePath(imagePath);

    // 3. Retorna a imagem e a legenda prontas para serem enviadas
    return { media, legenda };
}

/** Prepara o estado inicial do jogo da Forca */
function prepararJogo(session) {
    const numJogadores = session.players.length;
    session.gameState = {
        modo: numJogadores === 1 ? 'solo' : 'multiplayer',
        jogadores: session.players.map(p => ({ ...p })),
        delegatorIndex: 0,
        palavraSecreta: '',
        palavraDefinida: false,
        letrasCorretas: [],
        letrasErradas: [],
        tentativasMax: 6
    };
    console.log(`[Forca] Jogo preparado no modo ${session.gameState.modo} com ${numJogadores} jogadores.`);
}

/** Inicia uma nova rodada (ou a primeira) */
async function iniciarRodada(session, client) {
    const { gameState } = session;
    
    // Reseta o estado da rodada
    gameState.palavraSecreta = '';
    gameState.palavraDefinida = false;
    gameState.letrasCorretas = [];
    gameState.letrasErradas = [];

    if (gameState.modo === 'solo') {
        gameState.palavraSecreta = getPalavraAleatoria();
        gameState.palavraDefinida = true;
        console.log(`[Forca] Modo Solo. Palavra: ${gameState.palavraSecreta}`);

        await client.sendMessage(session.groupId, "🎉 *Jogo da Forca Começou!* 🎉");

        // --- NOVA LÓGICA HÍBRIDA ---

        // 1. Envia o texto essencial IMEDIATAMENTE para feedback instantâneo.
        const palavraDisplay = gameState.palavraSecreta.split('').map(() => '_').join(' ');
        const textoInicial = `A palavra é:\n*${palavraDisplay}*\n\nPara jogar, digite \`!letra <letra>\``;
        await client.sendMessage(session.groupId, textoInicial);

        // 2. Envia a imagem da forca vazia como um complemento visual.
        try {
            const imagePath = path.join(__dirname, 'assets', 'forca_0.png');
            const media = MessageMedia.fromFilePath(imagePath);
            await client.sendMessage(session.groupId, media); // Envia a imagem sem legenda
        } catch (error) {
            console.error("Não foi possível enviar a imagem inicial da forca, o jogo continuará em modo texto.", error);
        }

    } else {
        // A lógica do modo multiplayer continua a mesma
        const delegator = gameState.jogadores[gameState.delegatorIndex];
        await client.sendMessage(session.groupId, `Atenção, grupo! É a vez de *${delegator.name}* escolher a palavra secreta. Estou aguardando a palavra no privado... 🤫`);
        await client.sendMessage(delegator.id, `Sua vez de escolher a palavra para o jogo da forca no grupo! Envie a palavra que você quer que o pessoal adivinhe aqui no nosso privado. Apenas a palavra, sem comandos.`);
    }
}

/** Lida com a palavra secreta enviada no PV */
async function definirPalavra(message, session, client) {
    const { gameState } = session;
    const delegator = gameState.jogadores[gameState.delegatorIndex];

    if (message.from !== delegator.id || gameState.palavraDefinida) return;

    const palavraLimpa = message.body.trim().toUpperCase().replace(/[^A-Z]/g, '');

    if (palavraLimpa.length < 3) {
        return message.reply("Palavra muito curta! Por favor, escolha uma palavra com pelo menos 3 letras.");
    }

    gameState.palavraSecreta = palavraLimpa;
    gameState.palavraDefinida = true;
    console.log(`[Forca] ${delegator.name} definiu a palavra: ${gameState.palavraSecreta}`);
    
    await message.reply(`✅ Palavra *"${gameState.palavraSecreta}"* definida! O jogo vai começar no grupo.`);
    
    await client.sendMessage(session.groupId, `Palavra definida! Vamos começar!`);
    const display = montarDisplay(gameState);
    await client.sendMessage(session.groupId, montarDisplay(gameState));
}

/** Processa a tentativa de uma letra */
async function processarLetra(message, session, client) {
    const { gameState } = session;

    if (!gameState.palavraDefinida) {
        return message.reply("Calma! O jogo ainda não começou. Estamos esperando a palavra secreta ser definida.");
    }
    if (gameState.modo === 'multiplayer' && message.author === gameState.jogadores[gameState.delegatorIndex].id) {
        return message.reply("Você não pode chutar letras, você que escolheu a palavra!");
    }

    const letra = message.body.split(' ')[1]?.toUpperCase();

    if (!letra || letra.length !== 1 || !/^[A-Z]$/.test(letra)) {
        return message.reply("Isso não parece uma letra válida. Tente `!letra A`.");
    }

    if (gameState.letrasCorretas.includes(letra) || gameState.letrasErradas.includes(letra)) {
        return message.reply(`A letra *${letra}* já foi tentada!`);
    }

    if (gameState.palavraSecreta.includes(letra)) {
        gameState.letrasCorretas.push(letra);
    } else {
        gameState.letrasErradas.push(letra);
    }

    const vitoria = gameState.palavraSecreta.split('').every(l => gameState.letrasCorretas.includes(l));
    const derrota = gameState.letrasErradas.length >= gameState.tentativasMax;

    if (vitoria || derrota) {
        const autorDaJogada = session.players.find(p => p.id === message.author)?.name || 'Alguém';
        let mensagemFinal = vitoria
            ? `🏆 *VITÓRIA DE ${autorDaJogada.toUpperCase()}!* Parabéns, vocês acertaram a palavra: *${gameState.palavraSecreta}*`
            : `💀 *FIM DE JOGO!* Vocês foram enforcados! A palavra era: *${gameState.palavraSecreta}*`;
        
        await client.sendMessage(session.groupId, mensagemFinal);

        if (gameState.modo === 'multiplayer') {
            gameState.delegatorIndex = (gameState.delegatorIndex + 1) % gameState.jogadores.length;
            await client.sendMessage(session.groupId, `--- Preparando a próxima rodada ---`);
            await iniciarRodada(session, client); // Reutiliza a função para iniciar a próxima rodada
        } else {
            sessionManager.endSession(session.groupId);
        }
        return;
    }

    const novoDisplay = montarDisplay(gameState);
    await client.sendMessage(session.groupId, novoDisplay.media, { caption: novoDisplay.legenda });
}

// Exporta todas as funções que serão usadas por outros arquivos
module.exports = { prepararJogo, iniciarRodada, definirPalavra, processarLetra };