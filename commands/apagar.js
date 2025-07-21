// commands/apagar.js

const Transacao = require('../models/Transacao');

module.exports = {
    name: '!apagar',
    aliases: ['!remover', '!deletar'],
    category: 'financas',
    description: 'Apaga uma transação financeira pelo seu ID curto.',

    async execute(message, command, body) {
        const userId = message.author || message.from;
        const args = body.split(' ').slice(1);
        const shortId = args[0]?.toLowerCase(); // Converte para minúsculo para garantir a busca

        if (!shortId) {
            return await message.reply('❌ Formato inválido. Use `!apagar <ID_curto>`.\nVocê pode ver o ID de cada transação no comando `!extrato`.');
        }

        try {
            // Passo 1: Busca as últimas 50 transações do usuário para encontrar o alvo.
            // (É um buffer seguro, o usuário provavelmente vai apagar algo recente).
            const transacoesRecentes = await Transacao.find({ userId: userId })
                .sort({ createdAt: -1 })
                .limit(50);

            // Passo 2: Encontra a transação exata na lista usando o ID curto.
            const transacaoParaApagar = transacoesRecentes.find(
                t => t._id.toString().slice(-5).toLowerCase() === shortId
            );

            if (!transacaoParaApagar) {
                return await message.reply(`❌ Nenhuma transação recente encontrada com o ID \`${shortId}\`. Verifique o ID no \`!extrato\` e tente novamente.`);
            }

            // Passo 3: Apaga a transação usando seu ID completo e exato.
            const resultado = await Transacao.findByIdAndDelete(transacaoParaApagar._id);
            
            if (!resultado) {
                // Verificação extra caso algo dê errado entre o find e o delete.
                return await message.reply('❌ Erro ao apagar. A transação foi encontrada mas não pôde ser removida.');
            }

            // Se encontrou e apagou, manda uma confirmação
            const tipo = resultado.tipo;
            const emoji = tipo === 'ganho' ? '🟢' : '🔴';
            const valor = resultado.valor.toFixed(2).replace('.', ',');
            const categoria = resultado.categoria;

            await message.reply(`✅ Transação apagada com sucesso!\n\n${emoji} R$ ${valor} - *${categoria}*`);

        } catch (error) {
            console.error("Erro ao apagar transação:", error);
            await message.reply("❌ Ocorreu um erro ao tentar apagar a transação.");
        }
    }
};