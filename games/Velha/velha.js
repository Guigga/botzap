// games/Velha/velha.js

const sessionManager = require('../../sessions/sessionManager');
const { MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');

// CORREÇÃO 1: Importamos o botPlayer e o imageRenderer no topo do arquivo.
const botPlayer = require('./botPlayer');
const { renderizarVelha } = require('./imageRenderer.js');

const SIMBOLOS = ['❌', '⭕'];
const VITORIAS = [
    ['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'], ['c1', 'c2', 'c3'], // Linhas
    ['a1', 'b1', 'c1'], ['a2', 'b2', 'c2'], ['a3', 'b3', 'c3'], // Colunas
    ['a1', 'b2', 'c3'], ['a3', 'b2', 'c1']  // Diagonais
];

function prepararJogo(session) {
    console.log(`[JogoDaVelha] Preparando jogo para ${session.groupId}`);
    session.gameState = {
        jogadores: [session.players[0].id, session.players[1].id],
        historicoDeJogadas: [],
        vezDoJogador: 0
    };
}

async function montarDisplay(gameState, posicaoParaDestacar, linhaVencedora = null) {
    try {
        // E passa essa informação para o renderizador
        const imagePath = await renderizarVelha(gameState.historicoDeJogadas, posicaoParaDestacar, linhaVencedora);
        const media = MessageMedia.fromFilePath(imagePath);
        fs.unlinkSync(imagePath);
        return media;
    } catch (error) {
        console.error("Erro ao montar display do Jogo da Velha:", error);
        return "❌ Desculpe, tive um problema para desenhar o tabuleiro. 😥";
    }
}

function verificarVencedor(gameState) {
    const jogadorAtualId = gameState.jogadores[gameState.vezDoJogador];
    const posicoesDoJogador = new Set(
        gameState.historicoDeJogadas
            .filter(j => j.jogadorId === jogadorAtualId)
            .map(j => j.posicao)
    );

    if (posicoesDoJogador.size < 3) return null;

    // ALTERAÇÃO: Agora a função retorna um objeto com o vencedor E a linha da vitória
    for (const vitoria of VITORIAS) {
        if (vitoria.every(p => posicoesDoJogador.has(p))) {
            return { vencedor: jogadorAtualId, linha: vitoria };
        }
    }
    return null;
}

// CORREÇÃO 2: A função 'dispararAcaoBot' agora enxerga o 'botPlayer' importado no topo.
async function dispararAcaoBot(session, client) {
    const comandoBot = botPlayer.decideAction(session);
    if (comandoBot) {
        const fakeMessage = {
            author: botPlayer.BOT_ID,
            body: comandoBot,
            reply: () => {},
        };
        await processarJogada(fakeMessage, session, client);
    }
}

async function processarJogada(message, session, client) {
    // ... (o início da função, com as validações, continua o mesmo) ...
    const { author, body } = message;
    const { gameState } = session;
    const jogadorAtualId = gameState.jogadores[gameState.vezDoJogador];
    const botPlayer = require('./botPlayer');

    if (author === botPlayer.BOT_ID) {
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    if (author !== jogadorAtualId) {
        return message.reply("Calma, não é a sua vez de jogar!");
    }

    const posicao = body.split(' ')[1]?.toLowerCase();
    const posicoesValidas = /^[a-c][1-3]$/;

    if (!posicao || !posicoesValidas.test(posicao)) {
        return message.reply("Posição inválida. Use o formato `a1`, `b2`, etc.");
    }
    
    const posicaoOcupada = gameState.historicoDeJogadas.some(j => j.posicao === posicao);
    if (posicaoOcupada) {
        return message.reply("Essa posição já está ocupada! Escolha outra.");
    }
    
    gameState.historicoDeJogadas.push({
        posicao,
        jogadorId: jogadorAtualId,
        simbolo: SIMBOLOS[gameState.vezDoJogador]
    });

    const resultadoVitoria = verificarVencedor(gameState);

    if (resultadoVitoria) {
        const jogadorVencedor = session.players.find(p => p.id === resultadoVitoria.vencedor);
        const legenda = `🏆 Fim de jogo! *${jogadorVencedor.name}* (${SIMBOLOS[gameState.vezDoJogador]}) venceu!`;
        
        // Passamos a linha da vitória para a função de montar o display
        const display = await montarDisplay(gameState, null, resultadoVitoria.linha); 
        await client.sendMessage(session.groupId, display, { caption: legenda });
        
        sessionManager.endSession(session.groupId);
        return;
    }

    // O resto da função (se não houver vitória) continua exatamente igual...
    let infoPecaRemovida = null;
    if (gameState.historicoDeJogadas.length > 8) { 
        const jogadaRemovida = gameState.historicoDeJogadas.shift(); 
        infoPecaRemovida = `O tabuleiro encheu! A jogada mais antiga (${jogadaRemovida.simbolo} em ${jogadaRemovida.posicao.toUpperCase()}) foi removida.`;
    }

    let posicaoParaDestacar = null;
    if (gameState.historicoDeJogadas.length === 8) {
        posicaoParaDestacar = gameState.historicoDeJogadas[0].posicao;
    }

    let legenda = '';
    if (infoPecaRemovida) {
        legenda += `${infoPecaRemovida}\n\n`;
    }
    
    gameState.vezDoJogador = (gameState.vezDoJogador + 1) % 2;
    const proximoJogador = session.players.find(p => p.id === gameState.jogadores[gameState.vezDoJogador]);
    legenda += `É a vez de *${proximoJogador.name}* (${SIMBOLOS[gameState.vezDoJogador]}). Use:\n \`!jogar <posição>\`.`;
    
    const display = await montarDisplay(gameState, posicaoParaDestacar, null);
    await client.sendMessage(session.groupId, display, { caption: legenda });
    
    const proximoJogadorId = gameState.jogadores[gameState.vezDoJogador];
    if (proximoJogadorId === botPlayer.BOT_ID) {
        await dispararAcaoBot(session, client);
    }
}

// CORREÇÃO 3: Exportamos todas as funções necessárias
module.exports = { prepararJogo, processarJogada, montarDisplay, dispararAcaoBot };