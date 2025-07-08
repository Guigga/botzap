// controllers/musicaHandler.js

const playdl = require('play-dl');

async function handleMusica(message, client, query) {
    if (!query) {
        return await message.reply('❌ Para buscar uma música, use: `!musica <nome da música>`');
    }

    await message.reply(`🎵 Procurando o link para: *${query}*...`);

    try {
        const videos = await playdl.search(query, { limit: 1, source: { youtube: "video" } });
        if (!videos || videos.length === 0) {
            return await message.reply('❌ Nenhum resultado encontrado no YouTube.');
        }

        const video = videos[0];

        if (!video || !video.id) {
            return await message.reply('❌ Ocorreu um erro ao obter os detalhes do vídeo.');
        }

        // --- CORREÇÃO FINAL AQUI ---
        // Adicionado o '$' para a interpolação da string funcionar
        const videoUrl = `https://www.youtube.com/watch?v=$${video.id}`;
        
        const replyMessage = `✅ Aqui está seu link:\n\n*${video.title}*\n${videoUrl}`;
        
        await message.reply(replyMessage);

    } catch (err) {
        console.error('Erro ao buscar link da música:', err);
        await message.reply('❌ Desculpe, ocorreu um erro inesperado ao tentar buscar o link.');
    }
}

module.exports = handleMusica;