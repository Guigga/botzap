// commands/financas.js

const Transacao = require('../models/Transacao');
const sheetsService = require('../services/sheetsService');

module.exports = {
    name: '!financas',
    aliases: ['!gasto', '!g', '!ganho', '!r'],
    category: 'financas',
    description: 'Registra um ganho ou gasto e exibe a ajuda financeira.',

    // A função agora aceita 'commands' como último parâmetro
    async execute(message, command, body, client, session, commands) {
        
        if (command === '!financas') {
            let helpMessage = `*Módulo de Finanças Pessoais* 💸\n\nComandos disponíveis:\n\n`;
            
            // Usamos um Set para garantir que cada comando seja listado apenas uma vez
            const processed = new Set();

            // Iteramos sobre todos os comandos carregados pelo bot
            for (const cmd of commands.values()) {
                // Se o comando pertence à categoria 'financas' e ainda não foi listado...
                if (cmd.category === 'financas' && !processed.has(cmd.name)) {
                    helpMessage += `• \`${cmd.name}\` - ${cmd.description}\n`;
                    // Adiciona os apelidos (aliases) se existirem
                    if (cmd.aliases && cmd.aliases.length > 0) {
                        helpMessage += `  _Apelidos: ${cmd.aliases.join(', ')}_\n`;
                    }
                    processed.add(cmd.name); // Marca o comando como listado
                }
            }
            
            await message.reply(helpMessage);
            return;
        }

        // A lógica para registrar um ganho ou gasto continua a mesma
        const userId = message.author || message.from;
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
            const novaTransacao = new Transacao({
                userId, tipo, valor, categoria, 
                descricao: descricao || null
            });
            await novaTransacao.save();

            try {
                await sheetsService.adicionarTransacao(novaTransacao);
            } catch (sheetsError) {
                console.error("Falha ao enviar dados para o Google Sheets, mas a transação foi salva no DB.", sheetsError);
            }

            const tipoCapitalized = tipo.charAt(0).toUpperCase() + tipo.slice(1);
            await message.reply(
                `✅ *${tipoCapitalized} registrado para ${message._data.notifyName}!* \n\n` +
                `*Valor:* R$ ${valor.toFixed(2)}\n` +
                `*Categoria:* ${categoria}` +
                `${descricao ? `\n*Descrição:* ${descricao}` : ''}`
            );
        } catch (error) {
            console.error("Erro ao salvar transação:", error);
            await message.reply("❌ Ocorreu um erro ao salvar no banco de dados.");
        }
    }
};