const Compromisso = require('../models/Compromisso');

// Função helper para interpretar dias da semana
function getDateForNextWeekday(weekday) {
    const weekdays = {
        'domingo': 0, 'segunda': 1, 'terca': 2, 'terça': 2, 'quarta': 3,
        'quinta': 4, 'sexta': 5, 'sabado': 6, 'sábado': 6
    };
    const targetDay = weekdays[weekday.toLowerCase()];

    if (targetDay === undefined) return null;

    const today = new Date();
    const todayDay = today.getDay();
    let daysToAdd = targetDay - todayDay;

    // Se o dia já passou nesta semana ou é hoje, agendamos para a próxima semana
    if (daysToAdd <= 0) {
        daysToAdd += 7;
    }

    const targetDate = new Date();
    targetDate.setDate(today.getDate() + daysToAdd);
    return targetDate;
}


module.exports = {
    name: '!agenda',
    aliases: [
        '!agendar', '!add-compromisso',     // Para adicionar
        '!compromissos', '!lembretes',      // Para ver
        '!apagar-compromisso', '!rmv-compromisso', // Para remover
        '!ver', '!veragenda'                // Novos aliases para ver
    ],
    category: 'agenda',
    description: 'Gerencia seus compromissos e lembretes.',

    async execute(message, command, body) {
        const userId = message.author || message.from;

        // --- ROTEADOR INTERNO DO MÓDULO DE AGENDA ---

        // 1. COMANDO PRINCIPAL E DE AJUDA
        if (command === '!agenda') {
            const helpMessage =
                `*Módulo de Agenda* 🗓️\n\n` +
                `Gerencie seus compromissos e lembretes.\n\n` +
                `*--- Comandos Disponíveis ---*\n` +
                `• \`!agendar <data> [hora] "título"\`: Adiciona um compromisso.\n` +
                `• \`!compromissos\` (ou \`!veragenda\`): Mostra seus próximos eventos.\n` +
                `• \`!apagar-compromisso <ID>\`: Remove um evento agendado.\n\n` +
                `*--- Exemplos de uso para !agendar ---*\n` +
                `\`!agendar 25/12/2025 09:00 "Ceia de Natal"\`\n` +
                `\`!agendar 15/10 "Prova de Matemática"\` (assume o ano atual)\n` +
                `\`!agendar 05 "Pagar aluguel"\` (assume o mês e ano atuais)\n` +
                `\`!agendar terça 14:30 "Reunião de equipe"\` (assume a próxima terça-feira)\n` +
                `\`!agendar 18:00 "Ir para a academia"\` (assume o dia de hoje)`;
            return await message.reply(helpMessage);
        }
        
        // 2. COMANDO PARA ADICIONAR UM NOVO COMPROMISSO (Lógica aprimorada)
        if (command === '!agendar' || command === '!add-compromisso') {
            const matchTitulo = body.match(/"([^"]+)"/);
            if (!matchTitulo) {
                return await message.reply('❌ Formato inválido! O título do compromisso precisa estar entre aspas.\nEx: `!agendar 25/12 18:00 "Amigo Secreto"`');
            }
            const titulo = matchTitulo[1];
            const infoDataHora = body.replace(matchTitulo[0], '').trim().split(' ').slice(1).join(' ');

            let dataFinal;
            let hora = 9, minuto = 0; // Hora padrão caso não seja informada

            const hoje = new Date();
            let dia = hoje.getDate(), mes = hoje.getMonth(), ano = hoje.getFullYear();

            // Tenta identificar a hora
            const matchHora = infoDataHora.match(/(\d{2}):(\d{2})/);
            if (matchHora) {
                hora = parseInt(matchHora[1]);
                minuto = parseInt(matchHora[2]);
            }

            // Tenta identificar a data
            const infoData = infoDataHora.replace(/(\d{2}):(\d{2})/, '').trim();
            
            if (infoData.match(/^\d{2}\/\d{2}\/\d{4}$/)) { // Formato DD/MM/AAAA
                [dia, mes, ano] = infoData.split('/').map(Number);
                mes -= 1; // Mês em JS é 0-indexado
            } else if (infoData.match(/^\d{2}\/\d{2}$/)) { // Formato DD/MM
                [dia, mes] = infoData.split('/').map(Number);
                mes -= 1;
            } else if (infoData.match(/^\d{1,2}$/)) { // Formato DD
                dia = parseInt(infoData);
            } else if (/^[a-zA-Zçãáéíóú]+$/.test(infoData)) { // Formato "terça", "sabado", etc.
                const dataDiaSemana = getDateForNextWeekday(infoData);
                if (!dataDiaSemana) return await message.reply('❌ Dia da semana inválido.');
                dia = dataDiaSemana.getDate();
                mes = dataDiaSemana.getMonth();
                ano = dataDiaSemana.getFullYear();
            } else if (!infoData && matchHora) {
                // Se só informou a hora, mantém a data de hoje
            } else if (infoData) {
                return await message.reply('❌ Formato de data não reconhecido.');
            }

            dataFinal = new Date(ano, mes, dia, hora, minuto);

            if (isNaN(dataFinal.getTime())) {
                return await message.reply('❌ Data ou hora inválida. Verifique os valores.');
            }
            if (dataFinal < new Date()) {
                return await message.reply('❌ Você não pode agendar um compromisso no passado!');
            }

            try {
                const novoCompromisso = new Compromisso({ userId, titulo, dataHora: dataFinal });
                await novoCompromisso.save();

                // --- LINHA CORRIGIDA ---
                // Adicionamos as opções de formatação para garantir que a hora seja exibida corretamente.
                const dataFormatada = dataFinal.toLocaleString('pt-BR', { 
                    timeZone: 'America/Sao_Paulo',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                await message.reply(`✅ *Compromisso agendado!*\n\n*O quê:* ${titulo}\n*Quando:* ${dataFormatada}`);
            } catch (error) {
                console.error("Erro ao salvar compromisso:", error);
                await message.reply("❌ Ocorreu um erro ao salvar seu compromisso no banco de dados.");
            }
            return;
        }

        // 3. COMANDO PARA VER OS PRÓXIMOS COMPROMISSOS (agora com novos aliases)
        if (['!compromissos', '!lembretes', '!ver', '!veragenda'].includes(command)) {
            try {
                const compromissos = await Compromisso.find({ 
                    userId: userId,
                    dataHora: { $gte: new Date() }
                }).sort({ dataHora: 1 }).limit(10);

                if (compromissos.length === 0) {
                    return await message.reply("Você não tem nenhum compromisso futuro agendado. 🎉");
                }

                let resposta = '*Seus próximos 10 compromissos:*\n\n';
                for (const c of compromissos) {
                    const shortId = c._id.toString().slice(-5);
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

        // 4. COMANDO PARA APAGAR UM COMPROMISSO (lógica inalterada)
        if (command === '!apagar-compromisso' || command === '!rmv-compromisso') {
            const shortId = body.split(' ')[1]?.toLowerCase();

            if (!shortId) {
                return await message.reply('❌ Formato inválido. Use `!apagar-compromisso <ID_curto>`.\nVocê pode ver o ID com o comando `!agenda`.');
            }

            try {
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