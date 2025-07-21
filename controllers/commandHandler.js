// controllers/commandHandler.js
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const sessionManager = require('../sessions/sessionManager');
const lobby = require('../games/lobby');
const pokerActions = require('../games/Poker/playerActions');
const trucoActions = require('../games/Truco/playerActions');
const forcaActions = require('../games/Forca/playerActions');
const velhaActions = require('../games/Velha/playerActions');
const unoActions = require('../games/Uno/playerActions');
const xadrezActions = require('../games/Xadrez/playerActions');
const Transacao = require('../models/Transacao');

// --- CARREGADOR DE COMANDOS ---
const commands = new Map();
const commandFiles = fs.readdirSync(path.join(__dirname, '..', 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const commandModule = require(path.join(__dirname, '..', 'commands', file));
    if (commandModule.name) {
        commands.set(commandModule.name.toLowerCase(), commandModule);
    }
    if (commandModule.aliases && commandModule.aliases.length > 0) {
        commandModule.aliases.forEach(alias => commands.set(alias.toLowerCase(), commandModule));
    }
}
console.log(`[Command Loader] ${commands.size} comandos e apelidos carregados.`);

// --- LÓGICA PRINCIPAL ---
async function handleCommand(message, client) {
    try {
        const { from, body } = message;
        if (!body) return;

        logger.log(message, `Comando recebido: ${body}`);
        const isGroup = from.endsWith('@g.us');

        const groupFilterEnabled = process.env.ENABLE_GROUP_FILTER === 'true';
        if (groupFilterEnabled && isGroup) {
            const allowedGroupIds = process.env.ALLOWED_GROUP_IDS ? process.env.ALLOWED_GROUP_IDS.split(',') : [];
            if (!allowedGroupIds.includes(from)) {
                return logger.log(message, 'Comando ignorado: grupo não permitido.');
            }
        }

        const commandArgs = body.split(' ');
        const command = commandArgs[0].toLowerCase();
        let session = isGroup ? sessionManager.getSession(from) : sessionManager.getSession(sessionManager.getGroupFromPlayer(from)); // <--- DECLARAÇÃO ÚNICA E CORRETA

        // --- ROTEADOR DINÂMICO DE COMANDOS ---
        const commandModule = commands.get(command);
        if (commandModule) {
            await commandModule.execute(message, command, body, client, session, commands);
            return;
        }

        // A LINHA DUPLICADA FOI REMOVIDA DESTA POSIÇÃO

        if (session && session.game === 'confirmacao-limpeza') {
            const autorDaMensagem = message.author || message.from;

            // Garante que apenas o usuário que iniciou o comando pode confirmar
            if (autorDaMensagem === session.creatorId) {
                if (message.body.toLowerCase() === 'sim') {
                    const adminIdString = process.env.ADMIN_WHATSAPP_ID || '';
                    const adminIds = adminIdString.split(',').map(id => id.trim());
                    const resultado = await Transacao.deleteMany({ userId: { $in: adminIds } });
                    await message.reply(`✅ Confirmado! *${resultado.deletedCount}* transações foram apagadas.`);
                } else {
                    await message.reply('Operação cancelada.');
                }
                sessionManager.endSession(from); // Encerra a sessão de confirmação
            }
            return; // Impede que o resto do código seja executado
        }

        // --- ROTEADOR DE JOGO EM ANDAMENTO ---
        // Se não era um comando conhecido, mas existe uma sessão, é uma ação dentro de um jogo.
        if (session) {
            if (session.status === 'lobby') {
                return await lobby.handleLobbyCommand(message, session, client);
            }
            if (session.status === 'em_jogo') {
                const gameActions = { poker: pokerActions, truco: trucoActions, forca: forcaActions, velha: velhaActions, uno: unoActions, xadrez: xadrezActions };
                if (gameActions[session.game]) {
                    return await gameActions[session.game].handleGameCommand(message, session, client);
                }
            }
        }

        // Se chegou até aqui, é um comando desconhecido
        if (command.startsWith('!') || command.startsWith('/')) {
            await message.reply('Comando desconhecido. Digite `!botzap` para ver a lista de comandos.');
        }

    } catch (error) {
        console.error('ERRO FATAL AO PROCESSAR COMANDO:', error);
        await message.reply('❌ Ocorreu um erro inesperado ao processar seu comando.');
    }
}

module.exports = handleCommand;