// commands/limparfinancas.js

const Transacao = require('../models/Transacao');

module.exports = {
    name: '!limpar-financas-confirmado',
    aliases: ['!gasto', '!g', '!ganho', '!r'],
    category: 'financas',
    description: 'APAGA TODAS as transações financeiras. Comando de admin.',

    async execute(message, command, body) {
        // --- CORREÇÃO AQUI ---
        // 1. Lê a string de IDs do .env e a transforma em uma lista (array).
        const adminIdString = process.env.ADMIN_WHATSAPP_ID || '';
        const adminIds = adminIdString.split(',').map(id => id.trim()); // .trim() remove espaços extras
        
        const userId = message.author || message.from;

        // 2. Verifica se o ID do usuário ESTÁ NA LISTA de admins.
        if (!adminIds.includes(userId)) {
            // Se você quiser remover os logs de debug, pode apagar as 3 linhas abaixo.
            console.log(`[DEBUG] ID do Admin no .env: ${adminIdString}`);
            console.log(`[DEBUG] ID do Usuário que enviou: ${userId}`);
            console.log(`[DEBUG] O usuário está na lista de admins? ${adminIds.includes(userId)}`);
            return; // Ignora silenciosamente se não for um admin da lista.
        }

        try {
            await message.reply('⚠️ *Atenção!* Você está prestes a apagar TODAS as transações financeiras. Esta ação não pode ser desfeita. Confirmando em 3 segundos...');
            
            await new Promise(res => setTimeout(res, 3000));

            const resultado = await Transacao.deleteMany({ userId: { $in: adminIds } });

            const totalApagado = resultado.deletedCount;
            await message.reply(`✅ Operação concluída! *${totalApagado}* transações financeiras foram apagadas. Agora você pode começar do zero.`);

        } catch (error) {
            console.error("Erro ao limpar finanças:", error);
            await message.reply("❌ Ocorreu um erro durante a limpeza do banco de dados.");
        }
    }
};