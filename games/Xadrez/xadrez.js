// games/Xadrez/xadrez.js

const { Chess } = require('chess.js');

// Mapeamento das peças do chess.js para emojis
const pecasUnicode = {
    'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', // Brancas
    'p': '♟︎', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚'  // Pretas
};

/**
 * Prepara o estado inicial do jogo na sessão.
 * @param {object} session - O objeto da sessão do jogo.
 */
function prepararJogo(session) {
    const game = new Chess();
    session.gameState = {
        fen: game.fen(), // Armazena o estado do tabuleiro na notação FEN
        jogadorDaVez: 'w', // 'w' para brancas, 'b' para pretas
        capturadas: { w: [], b: [] }, // Peças capturadas
        historico: [], // Histórico de jogadas
    };
    console.log('[Xadrez] Jogo preparado. FEN inicial:', session.gameState.fen);
}

/**
 * Desenha o tabuleiro de xadrez em formato de texto com emojis.
 * @param {object} gameState - O estado do jogo da sessão.
 * @returns {string} Uma string formatada representando o tabuleiro.
 */
async function desenharTabuleiro(gameState) {
    if (!gameState || !gameState.fen) {
        return 'Estado do jogo inválido.';
    }
    const game = new Chess(gameState.fen);
    const board = game.board(); // Pega a representação 2D do tabuleiro

    let boardStr = '```'; // Usamos ``` para formatar como monoespaçado no WhatsApp
    
    // Adiciona letras das colunas no topo
    boardStr += '  A B C D E F G H\n';

    for (let i = 0; i < board.length; i++) {
        const row = board[i];
        boardStr += `${8 - i} `; // Adiciona o número da linha
        for (let j = 0; j < row.length; j++) {
            const peca = row[j];
            if (peca) {
                boardStr += pecasUnicode[peca.type.toUpperCase() === peca.type ? peca.type : peca.type.toLowerCase()];
            } else {
                // Alterna entre quadrados brancos e pretos para o fundo
                boardStr += (i + j) % 2 === 0 ? '⬜' : '⬛';
            }
            boardStr += ' ';
        }
        boardStr += `${8 - i}\n`; // Adiciona o número da linha no final
    }
    
    // Adiciona letras das colunas na base
    boardStr += '  A B C D E F G H';
    boardStr += '```';

    return boardStr;
}

module.exports = {
    prepararJogo,
    desenharTabuleiro,
};