// VERSÃO FINAL (COMO DEVE FICAR)

const { Chess } = require('chess.js');
const { MessageMedia } = require('whatsapp-web.js'); // 1. IMPORTAÇÃO ADICIONADA
const imageRenderer = require('./imageRenderer');   // 2. NOVA IMPORTAÇÃO
const xadrezBot = require('./botPlayer');
const sessionManager = require('../../sessions/sessionManager');

/**
 * Função auxiliar para aplicar uma jogada, anunciar o resultado e passar a vez.
 */
async function aplicarJogadaEAnunciar(moveString, session, client, message) {
    const game = new Chess(session.gameState.fen);
    const moveResult = game.move(moveString, { sloppy: true });

    if (moveResult === null) {
        await message.reply('❌ Movimento inválido! Verifique a jogada e tente novamente.');
        return;
    }

    session.gameState.fen = game.fen();
    session.gameState.jogadorDaVez = game.turn();
    session.gameState.historico.push(moveResult.san);

    // 3. SUBSTITUIÇÃO DA LÓGICA DE RENDERIZAÇÃO
    const imagemBuffer = await imageRenderer.renderBoardToImage(session.gameState);
    
    // 4. CORREÇÃO DO BUG: Anuncia o nome do jogador que acabou de mover
    let legenda = `*${session.players[moveResult.color === 'w' ? 0 : 1].name}* jogou *${moveResult.san}*.`;

    if (game.isCheckmate()) {
        // CORREÇÃO DO BUG: Anuncia o vencedor corretamente
        legenda += `\n\n🏆 *XEQUE-MATE!* O jogador *${session.players[moveResult.color === 'w' ? 0 : 1].name}* venceu!`;
        if (imagemBuffer) {
            await client.sendMessage(session.groupId, new MessageMedia('image/png', imagemBuffer.toString('base64')), { caption: legenda });
        }
        sessionManager.endSession(session.groupId);
        return;
    } else if (game.isDraw()) {
        legenda += `\n\n🤝 *EMPATE!* O jogo terminou empatado.`;
        if (imagemBuffer) {
            await client.sendMessage(session.groupId, new MessageMedia('image/png', imagemBuffer.toString('base64')), { caption: legenda });
        }
        sessionManager.endSession(session.groupId);
        return;
    }

    const proximoJogador = session.players[game.turn() === 'w' ? 0 : 1];
    legenda += `\n\nÉ a vez de *${proximoJogador.name}* (${game.turn() === 'w' ? 'Brancas' : 'Pretas'}).`;
    if (game.inCheck()) {
        legenda += `\n\n⚠️ *Você está em XEQUE!*`;
    }

    // 5. ENVIO DA MENSAGEM COMO IMAGEM E LEGENDA
    if (imagemBuffer) {
        await client.sendMessage(session.groupId, new MessageMedia('image/png', imagemBuffer.toString('base64')), { caption: legenda });
    } else {
        await message.reply('❌ Ocorreu um erro ao gerar a imagem do tabuleiro.');
    }
    
    if (proximoJogador.id === xadrezBot.BOT_ID) {
        await client.sendMessage(session.groupId, `🤖 *${xadrezBot.BOT_NAME}* está pensando...`);
        const botMove = xadrezBot.getBotMove(session.gameState.fen); // Bot síncrono agora
        if (botMove) {
            await aplicarJogadaEAnunciar(botMove, session, client, message);
        } else {
            await client.sendMessage(session.groupId, `O Bot não encontrou movimentos possíveis (Fim de Jogo).`);
        }
    }
}

/**
 * Manipula os comandos do jogador durante uma partida de xadrez.
 */
async function handleGameCommand(message, session, client) {
    const { from, body, author } = message;
    const playerId = author || from;
    const commandArgs = body.split(' ');
    const command = commandArgs[0].toLowerCase();
    
    const jogadorAtualIndex = session.gameState.jogadorDaVez === 'w' ? 0 : 1;
    const jogadorAtual = session.players[jogadorAtualIndex];

    switch (command) {
        case '!mover':
            if (playerId !== jogadorAtual.id) {
                return await message.reply('❌ Não é a sua vez de jogar!');
            }
            if (commandArgs.length !== 3) {
                return await message.reply('Formato incorreto. Use: `!mover <origem> <destino>` (ex: `!mover e2 e4`)');
            }
            const fromSquare = commandArgs[1].toLowerCase();
            const toSquare = commandArgs[2].toLowerCase();
            const moveString = `${fromSquare}${toSquare}`;
            await aplicarJogadaEAnunciar(moveString, session, client, message);
            break;

        case '!desistir':
            const vencedorIndex = jogadorAtualIndex === 0 ? 1 : 0;
            const vencedor = session.players[vencedorIndex];
            await client.sendMessage(session.groupId, `🏳️ *${jogadorAtual.name}* desistiu da partida. *${vencedor.name}* é o vencedor!`);
            sessionManager.endSession(session.groupId);
            break;

        case '!tabuleiro':
        case '!status':
            // 6. ATUALIZAÇÃO DO COMANDO !tabuleiro
            const imagemBufferStatus = await imageRenderer.renderBoardToImage(session.gameState);
            const legendaStatus = `É a vez de *${jogadorAtual.name}* (${jogadorAtualIndex === 0 ? 'Brancas' : 'Pretas'}).`;
            if (imagemBufferStatus) {
                await client.sendMessage(session.groupId, new MessageMedia('image/png', imagemBufferStatus.toString('base64')), { caption: legendaStatus });
            }
            break;

        default:
            if (command.startsWith('!')) {
                await message.reply('Comando de xadrez inválido. Use `!mover`, `!desistir` ou `!tabuleiro`.');
            }
            break;
    }
}

module.exports = {
    handleGameCommand,
};