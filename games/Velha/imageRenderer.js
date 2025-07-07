// games/Velha/imageRenderer.js

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

/**
 * Renders the Tic-Tac-Toe board state as a PNG image with improvements.
 * - Features a more solid grid.
 * - Watermarks for coordinates only appear on empty cells.
 * @param {Array<Object>} historicoDeJogadas - An array of move objects, e.g., [{ posicao: 'a1', simbolo: '❌' }]
 * @returns {Promise<string>} The file path to the generated image.
 */
async function renderizarVelha(historicoDeJogadas) {
    const width = 300;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // White background for a clean look
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 1. DRAW THE SOLID GRID
    // Using a darker color and thicker lines for a "solid" feel.
    ctx.strokeStyle = '#333333'; // Dark gray
    ctx.lineWidth = 10;
    ctx.lineCap = 'round'; // Smoother line ends
    ctx.beginPath();
    // Vertical lines
    ctx.moveTo(100, 20);
    ctx.lineTo(100, 280);
    ctx.moveTo(200, 20);
    ctx.lineTo(200, 280);
    // Horizontal lines
    ctx.moveTo(20, 100);
    ctx.lineTo(280, 100);
    ctx.moveTo(20, 200);
    ctx.lineTo(280, 200);
    ctx.stroke();

    // Create a map of played moves for efficient lookup (O(1) access)
    const jogadasFeitas = new Map(historicoDeJogadas.map(j => [j.posicao, j.simbolo]));
    const todasPosicoes = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3'];

    // 2. DRAW MOVES (X/O) OR WATERMARKS
    // Iterate through each cell of the board.
    for (const posicao of todasPosicoes) {
        const col = parseInt(posicao[1]) - 1;
        const row = posicao.charCodeAt(0) - 'a'.charCodeAt(0); // More robust than using magic number 97
        const x = col * 100 + 50;
        const y = row * 100 + 50;

        if (jogadasFeitas.has(posicao)) {
            // If the cell has a move, draw the corresponding symbol (X or O).
            const simbolo = jogadasFeitas.get(posicao);
            ctx.lineWidth = 8; // Line width for X and O symbols

            if (simbolo === '❌') {
                ctx.strokeStyle = '#D32F2F'; // Red for X
                ctx.beginPath();
                ctx.moveTo(x - 25, y - 25);
                ctx.lineTo(x + 25, y + 25);
                ctx.moveTo(x + 25, y - 25);
                ctx.lineTo(x - 25, y + 25);
                ctx.stroke();
            } else { // '⭕'
                ctx.strokeStyle = '#1976D2'; // Blue for O
                ctx.beginPath();
                ctx.arc(x, y, 30, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else {
            // If the cell is empty, draw the coordinate watermark.
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // Black with low opacity
            ctx.font = 'bold 32px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(posicao.toUpperCase(), x, y);
        }
    }

    // Save the image to a temporary file
    const tempDir = path.join(__dirname, '..', '..', 'temp_images');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `velha_${Date.now()}.png`);
    fs.writeFileSync(filePath, canvas.toBuffer('image/png'));
    
    return filePath;
}

module.exports = { renderizarVelha };
