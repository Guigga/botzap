/**
 * Função de log inteligente que adiciona prefixo com nome do grupo e do autor.
 * @param {object | null} message - O objeto da mensagem da whatsapp-web.js.
 * @param  {...any} logTexts - Os textos ou objetos a serem logados, como em um console.log normal.
 */
async function log(message, ...logTexts) {
    let prefix = `[${new Date().toLocaleTimeString('pt-BR')}]`; // Adiciona a hora ao log

    if (message && typeof message.getChat === 'function') {
        try {
            const chat = await message.getChat();
            if (chat.isGroup) {
                const contact = await message.getContact();
                prefix += ` [${chat.name}] [${contact.pushname}]`;
            } else {
                // Mensagem privada
                const contact = await message.getContact();
                prefix += ` [PV - ${contact.pushname}]`;
            }
        } catch (e) {
            // Se houver erro ao buscar dados, não quebra o log
            prefix += ' [Contexto indisponível]';
        }
    }

    console.log(prefix, ...logTexts);
}

module.exports = { log };