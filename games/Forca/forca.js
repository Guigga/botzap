// C:\Users\Guilherme\bot-whatsapp\games\Forca\forca.js

const { MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const sessionManager = require('../../sessions/sessionManager');
const getPalavraAleatoria = require('./palavras');
const botPlayer = require('./botPlayer'); // Importa o nosso novo bot

function montarDisplay(gameState) {
    // Calcula o número de erros para saber qual imagem carregar (forca_0, forca_1, etc.)
    const erros = 6 - gameState.vidas;
    const imagePath = path.join(__dirname, 'assets', `forca_${erros}.png`);
    const media = MessageMedia.fromFilePath(imagePath);

    // Monta a legenda no formato que você pediu
    const palavraDisplay = gameState.palavraOculta.join(' ');
    let legenda = `Palavra: \`${palavraDisplay}\`\n\n`;

    if (gameState.letrasTentadas.some(l => !gameState.palavra.includes(l))) {
        const letrasErradas = gameState.letrasTentadas.filter(l => !gameState.palavra.includes(l));
        legenda += `Letras erradas: ${letrasErradas.join(', ')}\n\n`;
    }
    
    legenda += 'Para jogar, digite `!letra <letra>`';

    return { media, legenda };
}

/** Prepara o estado inicial do jogo da Forca */
function prepararJogo(session) {
    console.log(`[Forca] Jogo preparado para ${session.groupId}`);
    session.gameState = {
        jogadores: session.players.map(p => ({ ...p })),
        definidorDaPalavra: null,
        vezDoJogador: 0,
        palavra: [],
        palavraOculta: [],
        letrasTentadas: [],
        vidas: 6,
        status: 'preparando' // Status: preparando, definindo_palavra, aguardando_palpite
    };
    session.status = 'em_jogo';
}

/** Inicia uma nova rodada (ou a primeira) */
async function iniciarRodada(session, client) {
    const { gameState } = session;
    
    // ... (a lógica de reset da rodada continua a mesma)
    gameState.palavra = [];
    gameState.palavraOculta = [];
    gameState.letrasTentadas = [];
    gameState.vidas = 6;
    
    if (gameState.modo === 'solo') {
        // ... (a lógica do modo solo continua a mesma)
    } else { // Multiplayer
        const definidor = gameState.jogadores[0]; 
        gameState.definidorDaPalavra = definidor.id;
        gameState.vezDoJogador = 1; 
        gameState.status = 'definindo_palavra';

        await client.sendMessage(session.groupId, `Atenção, grupo! É a vez de *${definidor.name}* escolher a palavra secreta. Estou aguardando a palavra no privado... 🤫`);
        
        // --- ALTERAÇÃO NA INSTRUÇÃO DO PV ---
        // Agora instrui o usuário a usar o comando !palavra
        await client.sendMessage(definidor.id, `Sua vez de escolher a palavra para o jogo da forca!\nUse o comando \`!palavra <SUA_PALAVRA>\` aqui no nosso privado (sem acentos ou espaços).`);
    }
}

/** Dispara a ação do bot de forma assíncrona */
async function dispararAcaoBot(session, client) {
    await new Promise(resolve => setTimeout(resolve, 1500)); // Pausa para o bot "pensar"

    const comandoBot = botPlayer.decideAction(session.gameState);
    if (comandoBot) {
        const fakeMessage = { author: botPlayer.BOT_ID, body: comandoBot, reply: () => {} };
        await processarLetra(fakeMessage, session, client);
    }
}

/** Lida com a palavra secreta enviada no PV */
async function definirPalavra(message, session, client) {
    // ... (o início da função, com as validações, continua o mesmo)
    const { from, body } = message;
    const { gameState } = session;

    if (from !== gameState.definidorDaPalavra) { return; }
    if (gameState.status !== 'definindo_palavra') { return message.reply("❌ Você só pode definir a palavra no início da rodada."); }

    const palavra = body.split(' ').slice(1).join(' ').trim().toUpperCase();
    
    if (!palavra || palavra.length < 3 || palavra.length > 15 || !/^[A-Z]+$/.test(palavra)) {
        return client.sendMessage(from, '❌ Comando inválido ou palavra inválida! Use: `!palavra SUA_PALAVRA` (apenas letras, sem espaços, de 3 a 15 caracteres).');
    }

    gameState.palavra = palavra.split('');
    gameState.palavraOculta = Array(palavra.length).fill('_');
    gameState.status = 'aguardando_palpite';
    
    await client.sendMessage(from, `✅ Sua palavra foi definida, ela é: *${palavra}*`);

    const proximoJogador = gameState.jogadores[gameState.vezDoJogador];
    
    // --- ALTERAÇÃO PARA USAR O DISPLAY COM IMAGEM ---
    const { media, legenda } = montarDisplay(gameState);
    const legendaComVez = `A palavra foi definida! *${proximoJogador.name}*, é sua vez de adivinhar.\n\n${legenda}`;
    await client.sendMessage(session.groupId, media, { caption: legendaComVez });
    // --- FIM DA ALTERAÇÃO ---

    if (proximoJogador && proximoJogador.id === botPlayer.BOT_ID) {
        await dispararAcaoBot(session, client);
    }
}

/** Processa a tentativa de uma letra */
async function processarLetra(message, session, client) {
    // ... (o início da função, com as validações de vez, continua o mesmo)
    const { gameState } = session;
    const playerId = message.author || message.from;

    if (gameState.status !== 'aguardando_palpite') { return; }
    if (playerId === gameState.definidorDaPalavra) { return message.reply("Você não pode chutar letras, você que escolheu a palavra!"); }
    if (playerId !== gameState.jogadores[gameState.vezDoJogador].id) { return message.reply("Opa, não é a sua vez de jogar!"); }
    
    const letra = message.body.split(' ')[1]?.toUpperCase();

    if (!letra || letra.length !== 1 || !/^[A-Z]$/.test(letra)) { return; }
    if (gameState.letrasTentadas.includes(letra)) {
        if(playerId !== botPlayer.BOT_ID) message.reply(`A letra *${letra}* já foi tentada!`);
        return;
    }
    gameState.letrasTentadas.push(letra);

    // ... (a lógica de acerto, erro e verificação de vitória/derrota continua a mesma)
    const acertou = gameState.palavra.includes(letra);
    if (acertou) {
        gameState.palavra.forEach((l, index) => { if (l === letra) gameState.palavraOculta[index] = letra; });
    } else {
        gameState.vidas--;
    }

    const vitoria = !gameState.palavraOculta.includes('_');
    const derrota = gameState.vidas <= 0;

    // --- LÓGICA DE MENSAGEM FINAL ATUALIZADA ---
    if (vitoria || derrota) {
        const autorDaJogada = gameState.jogadores.find(p => p.id === playerId)?.name || 'Alguém';
        let mensagemFinal = vitoria
            ? `🏆 *VITÓRIA DE ${autorDaJogada.toUpperCase()}!* Parabéns, acertaram a palavra!`
            : `💀 *FIM DE JOGO!* Vocês foram enforcados!`;
        
        await client.sendMessage(session.groupId, mensagemFinal);

        // Envia o tabuleiro final para mostrar a palavra
        const displayFinal = montarDisplay(gameState);
        const legendaFinal = `A palavra era: *${gameState.palavra.join('')}*`;
        await client.sendMessage(session.groupId, displayFinal.media, { caption: legendaFinal });
        
        sessionManager.endSession(session.groupId);
        return;
    }
    // --- FIM DA ATUALIZAÇÃO ---
    
    // Avança para o próximo jogador
    gameState.vezDoJogador = (gameState.vezDoJogador + 1) % gameState.jogadores.length;
    if (gameState.jogadores[gameState.vezDoJogador].id === gameState.definidorDaPalavra) {
        gameState.vezDoJogador = (gameState.vezDoJogador + 1) % gameState.jogadores.length;
    }

    // --- ALTERAÇÃO PARA ENVIAR O DISPLAY COM IMAGEM ---
    const proximoJogador = gameState.jogadores[gameState.vezDoJogador];
    const { media, legenda } = montarDisplay(gameState);
    const legendaComVez = `${legenda}\n\nÉ a vez de *${proximoJogador.name}*.`;
    await client.sendMessage(session.groupId, media, { caption: legendaComVez });
    // --- FIM DA ALTERAÇÃO ---

    if (proximoJogador.id === botPlayer.BOT_ID) {
        await dispararAcaoBot(session, client);
    }
}

// Exporta as funções
module.exports = { prepararJogo, iniciarRodada, definirPalavra, processarLetra, montarDisplay };