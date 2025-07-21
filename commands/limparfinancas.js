// commands/limparfinancas.js

const Transacao = require('../models/Transacao');
const sessionManager = require('../sessions/sessionManager'); // Importa o sessionManager

module.exports = {
    name: '!limpar-financas-confirmado',
    description: 'Inicia o processo para apagar TODAS as transações financeiras.',

    async execute(message, command, body) {
        const adminIdString = process.env.ADMIN_WHATSAPP_ID || '';
        const adminIds = adminIdString.split(',').map(id => id.trim());
        const userId = message.author || message.from;
        const { from } = message;

        if (!adminIds.includes(userId)) return; // Ignora silenciosamente

        const sessaoExistente = sessionManager.getSession(from);
        if (sessaoExistente) {
            return message.reply('❌ Já existe uma outra operação (ou jogo) em andamento neste chat.');
        }

        // Cria uma nova sessão de confirmação
        sessionManager.createSession(from, 'confirmacao-limpeza', userId);
        
        await message.reply('⚠️ *VOCÊ TEM CERTEZA?*\nEsta ação apagará TODAS as suas transações financeiras e não pode ser desfeita.\n\nDigite `sim` para confirmar ou qualquer outra coisa para cancelar.');

        // Adiciona um timeout de 30 segundos para cancelar automaticamente
        setTimeout(() => {
            const sessaoAindaExiste = sessionManager.getSession(from);
            if (sessaoAindaExiste && sessaoAindaExiste.game === 'confirmacao-limpeza') {
                message.reply('Tempo esgotado. Operação de limpeza cancelada.');
                sessionManager.endSession(from);
            }
        }, 30000); // 30 segundos
    }
};