// commands/figurinha.js
module.exports = {
    name: '!figurinha',
    aliases: ['!sticker'],
    description: 'Cria uma figurinha a partir de uma imagem ou vídeo.',
    async execute(message, command, body, client) { // <--- Note o 'client' aqui
        const { from } = message;

        if (message.hasQuotedMsg) {
            const quotedMsg = await message.getQuotedMessage();
            if (quotedMsg.hasMedia) {
                await message.reply("Criando sua figurinha, um momento... 🎨");
                try {
                    const media = await quotedMsg.downloadMedia();
                    await client.sendMessage(from, media, { sendMediaAsSticker: true, stickerAuthor: "BotZap 🤖", stickerName: "Criado pelo Bot" });
                } catch (error) {
                    await message.reply("❌ Ih, deu erro! Tente com outra imagem ou vídeo curto.");
                }
            } else {
                await message.reply("Você precisa responder a uma imagem ou vídeo para eu transformar em figurinha!");
            }
        } else {
            await message.reply("Para criar uma figurinha, responda a uma imagem com o comando `!figurinha`.");
        }
    }
};