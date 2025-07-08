// unoRenderer.js

const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

async function gerarImagemMaoUno(cartas, nomeJogador) {
  const larguraCarta = 100;
  const alturaCarta = 150;
  const espacamento = 10;
  const canvasWidth = cartas.length * (larguraCarta + espacamento) - espacamento;
  const canvasHeight = alturaCarta + 40;

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#006400'; // fundo estilo mesa UNO
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  for (let i = 0; i < cartas.length; i++) {
    const carta = cartas[i];
    const imgPath = path.join(__dirname, 'assets', 'uno', `${carta}.png`);
    try {
      const img = await loadImage(imgPath);
      ctx.drawImage(img, i * (larguraCarta + espacamento), 10, larguraCarta, alturaCarta);
    } catch (err) {
      console.error(`Erro ao carregar imagem ${imgPath}`, err);
    }
  }

  ctx.font = '24px sans-serif';
  ctx.fillStyle = 'white';
  ctx.fillText(nomeJogador, 10, canvasHeight - 10);

  const outputPath = path.join(__dirname, 'temp', `mao_${nomeJogador}.png`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log(`Image generated at ${outputPath}`);
  return outputPath;
}

// Teste:
(async () => {
  await gerarImagemMaoUno(['R5', 'G+2', 'B7'], 'Jogador1');
})();
