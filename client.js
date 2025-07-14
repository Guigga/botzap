// client.js

// --- BLOCO DE IMPORTAÇÕES ---
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

// --- BLOCO DE CONFIGURAÇÃO ---
const dataPath = path.join(__dirname, '.wwebjs_auth');
console.log('Caminho da sessão configurado para:', dataPath); // <<< A LINHA DE DEPURAÇÃO

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: dataPath
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
    }
});

// --- BLOCO DE INICIALIZAÇÃO E EXPORTAÇÃO ---
client.initialize();

module.exports = { client };