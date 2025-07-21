// client.js
require('dotenv').config();

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
    restartOnAuthFail: true, // Adicionado: Tenta reiniciar em caso de falha de autenticação
    puppeteer: {
        headless: 'new', // Alterado: Use o novo modo headless para maior estabilidade
        args: [
            '--no-sandbox',               // Crucial para evitar problemas de permissão em alguns sistemas
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',    // Essencial para VMs e Docker com pouca memória SHM
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',                // Pode melhorar a estabilidade em alguns casos
            // '--single-process',        // Removido: Já não é tão necessário com 'new' headless e pode causar problemas
            '--disable-gpu',              // Desativa a aceleração de GPU (VMs raramente têm GPU dedicada)
            '--disable-infobars',         // Remove barras de informação do Chrome
            '--disable-extensions',       // Desativa extensões
            '--window-size=1920,1080',    // Define um tamanho de janela para o navegador
            '--disable-web-security',     // Pode ajudar em alguns cenários de carregamento
            '--disable-features=IsolateOrigins,site-per-process' // Ajuda com problemas de sandbox
        ],
    }
});

// --- BLOCO DE INICIALIZAÇÃO E EXPORTAÇÃO ---
client.initialize();

module.exports = { client };