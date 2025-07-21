const Transacao = require('../models/Transacao');

module.exports = {
  name: '!financas',
  aliases: ['!gasto', '!g', '!ganho', '!r', '!extrato'], // Adicionei !extrato aqui
  category: 'financas',
  description: 'Gerencia suas finanças.',

  async execute(message, command, body, client, session, commands) {
    const userId = message.author || message.from;

    // Lógica do !extrato (movida para dentro para consistência)
    if (command === '!extrato') {
        try {
            const transacoes = await Transacao.find({ userId: userId }).sort({ createdAt: -1 }).limit(10);
            if (transacoes.length === 0) {
                return await message.reply("Você ainda não tem nenhuma transação registrada.");
            }
            let extrato = `*Suas últimas 10 transações:*\n\n`;
            transacoes.forEach(t => {
                const tipo = t.tipo === 'gasto' ? '🔴' : '🟢';
                extrato += `${tipo} *R$ ${t.valor.toFixed(2)}* - ${t.categoria}\n`;
            });
            return await message.reply(extrato);
        } catch (error) {
            console.error("Erro ao buscar extrato:", error);
            return await message.reply("❌ Ocorreu um erro ao buscar seu extrato.");
        }
    }
    
    // Lógica do !financas (ajuda)
    if (command === '!financas') {
      // ... sua lógica de ajuda ...
      return;
    }

    // Lógica de !gasto e !ganho
    const args = body.split(' ');
    const isGasto = command === '!gasto' || command === '!g';
    const tipo = isGasto ? 'gasto' : 'ganho';
    const valor = parseFloat(args[1]?.replace(',', '.'));
    const categoria = args[2];
    const descricao = args.slice(3).join(' ');

    if (isNaN(valor) || !categoria) {
      return await message.reply(`❌ Formato inválido! Use \`!financas\` para ver os exemplos.`);
    }

    try {
      const novaTransacao = new Transacao({ userId, tipo, valor, categoria, descricao: descricao || null });
      await novaTransacao.save();

    } catch (error) {
      console.error("Erro ao salvar transação:", error);
      return await message.reply("❌ Ocorreu um erro ao registrar sua transação.");
    }
  }
};