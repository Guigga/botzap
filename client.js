// client.js

// --- BLOCO DE IMPORTAÇÕES ---
// Todas as suas importações devem vir primeiro.
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

// --- BLOCO DE CONFIGURAÇÃO ---
// Agora que 'path' foi importado, podemos usá-lo.
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '.wwebjs_auth')
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