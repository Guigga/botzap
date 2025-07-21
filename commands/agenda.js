const Compromisso = require('../models/Compromisso');

module.exports = {
    name: '!agenda',
    aliases: [
        '!agendar', '!add-compromisso',     // Para adicionar
        '!compromissos', '!lembretes',      // Para ver
        '!apagar-compromisso', '!rmv-compromisso' // Para remover
    ],
    category: 'agenda', // Crie uma nova categoria para organização
    description: 'Gerencia seus compromissos e lembretes.',

    async execute(message, command, body) {
        const userId = message.author || message.from;

        // --- ROTEADOR INTERNO DO MÓDULO DE AGENDA ---

        // 1. COMANDO PARA ADICIONAR UM NOVO COMPROMISSO
        if (command === '!agendar' || command === '!add-compromisso') {
            const args = body.split(' ').slice(1).join(' ').match(/^(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+"(.+)"$/);

            if (!args) {
                return await message.reply('❌ Formato inválido! Use:\n`!agendar DD/MM/AAAA HH:MM "Seu compromisso"`');
            }

            const [, dataStr, horaStr, titulo] = args;
            const [dia, mes, ano] = dataStr.split('/');
            const [hora, minuto] = horaStr.split(':');

            // Converte a data/hora para o formato que o MongoDB entende
            const dataHora = new Date(ano, mes - 1, dia, hora, minuto);

            if (isNaN(dataHora.getTime())) {
                return await message.reply('❌ Data ou hora inválida. Verifique o formato.');
            }

            try {
                const novoCompromisso = new Compromisso({ userId, titulo, dataHora });
                await novoCompromisso.save();

                const dataFormatada = dataHora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
                await message.reply(`✅ *Compromisso agendado!*\n\n*O quê:* ${titulo}\n*Quando:* ${dataFormatada}`);
            } catch (error) {
                console.error("Erro ao salvar compromisso:", error);
                await message.reply("❌ Ocorreu um erro ao salvar seu compromisso no banco de dados.");
            }
            return;
        }

        // 2. COMANDO PARA VER OS PRÓXIMOS COMPROMISSOS (similar ao !extrato)
        if (command === '!compromissos' || command === '!lembretes' || command === '!agenda') {
            try {
                // Busca os compromissos do usuário que ainda não aconteceram
                const compromissos = await Compromisso.find({ 
                    userId: userId,
                    dataHora: { $gte: new Date() } // $gte = "maior ou igual a", ou seja, do presente para o futuro
                }).sort({ dataHora: 1 }).limit(10); // Ordena pelo mais próximo e limita a 10

                if (compromissos.length === 0) {
                    return await message.reply("Você não tem nenhum compromisso futuro agendado. 🎉");
                }

                let resposta = '*Seus próximos 10 compromissos:*\n\n';
                for (const c of compromissos) {
                    const shortId = c._id.toString().slice(-5); // Pega os últimos 5 caracteres do ID [cite: 1865]
                    const data = c.dataHora.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                    resposta += `*ID: \`${shortId}\`* 🗓️ [${data}] - *${c.titulo}*\n`;
                }
                resposta += '\nPara remover, use `!apagar-compromisso <ID_curto>`';

                await message.reply(resposta);

            } catch (error) {
                console.error("Erro ao buscar compromissos:", error);
                await message.reply("❌ Ocorreu um erro ao buscar seus compromissos.");
            }
            return;
        }

        // 3. COMANDO PARA APAGAR UM COMPROMISSO (similar ao !apagar de finanças)
        if (command === '!apagar-compromisso' || command === '!rmv-compromisso') {
            const shortId = body.split(' ')[1]?.toLowerCase();

            if (!shortId) {
                return await message.reply('❌ Formato inválido. Use `!apagar-compromisso <ID_curto>`.\nVocê pode ver o ID com o comando `!agenda`.');
            }

            try {
                // Busca nos últimos 50 compromissos (buffer seguro) [cite: 1898]
                const compromissosRecentes = await Compromisso.find({ userId: userId })
                    .sort({ createdAt: -1 })
                    .limit(50);
                
                const compromissoParaApagar = compromissosRecentes.find(
                    c => c._id.toString().slice(-5).toLowerCase() === shortId
                );

                if (!compromissoParaApagar) {
                    return await message.reply(`❌ Nenhum compromisso encontrado com o ID \`${shortId}\`.`);
                }

                await Compromisso.findByIdAndDelete(compromissoParaApagar._id);
                
                await message.reply(`✅ Compromisso "*${compromissoParaApagar.titulo}*" apagado com sucesso!`);

            } catch (error) {
                console.error("Erro ao apagar compromisso:", error);
                await message.reply("❌ Ocorreu um erro ao tentar apagar o compromisso.");
            }
            return;
        }
    }
};