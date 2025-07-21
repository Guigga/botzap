// commands/mega.js
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');

// Lógica do Mega-Sena agora está encapsulada dentro do seu próprio módulo
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
        } catch (e) { /* Ignora erros de linha */ }
    })
    .on('end', function () {
        megaCarregada = true;
        console.log(`[Mega-Sena] Módulo carregado com ${resultadosPassados.size} resultados.`);
    })
    .on('error', function (error) {
        console.error('[Mega-Sena] Erro no módulo:', error.message);
    });

function gerarJogoInedito() {
    if (!megaCarregada) return null;
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

module.exports = {
    name: '!mega',
    description: 'Gera um jogo inédito da Mega-Sena.',
    async execute(message, command, body) {
        const jogo = gerarJogoInedito();
        if (jogo) {
            const resultado = jogo.map(n => n.toString().padStart(2, '0')).join(' - ');
            await message.reply(`*Combinação Inédita Encontrada!*\n\n✨ *${resultado}* ✨\n\nEssa nunca saiu! Boa sorte!`);
        } else {
            await message.reply('Desculpe, ainda estou processando o histórico de jogos. Tente novamente em um instante.');
        }
    }
};