// client.js
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const path = require('path');

const dataPath = path.join(__dirname, '.wwebjs_auth');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: dataPath
    }),
    puppeteer: {
        headless: true,
        // --- SUBSTITUA SEU BLOCO 'args' POR ESTE ---
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // Apenas um processo para o browser
            '--disable-gpu',
            
            // --- Argumentos NOVOS para estabilidade ---
            '--disable-features=site-per-process',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-ipc-flooding-protection',
            '--no-default-browser-check',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync'
        ],
    }
});

client.initialize();

module.exports = { client };