// client.js
const dataPath = path.join(__dirname, '.wwebjs_auth');
const path = require('path');

console.log('Caminho da sessão configurado para:', dataPath);

const client = new Client({
    authStrategy: new LocalAuth({
        // 2. Especifique o caminho exato para a pasta de autenticação
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

client.initialize();

module.exports = { client };