require('dotenv').config();
const connectDB = require('./config/db');
const { client } = require('./client');
const handleCommand = require('./controllers/commandHandler');
const express = require('express');

// Evento para gerar o QR Code para autenticação
client.on('qr', (qr) => {
  const qrcode = require('qrcode-terminal');
  qrcode.generate(qr, { small: true });
});

// Evento disparado quando o bot está conectado e pronto para uso
client.on('ready', () => {
  console.log('✅ Bot conectado e pronto!');
});

// Evento para escutar e processar as mensagens recebidas
client.on('message', async (message) => {
  // Verifica se o corpo da mensagem começa com "!" para identificar um comando
  if (message.body.startsWith('!')) {
    try {
      // Passa o objeto 'message' e também o 'client' para o manipulador de comandos
      await handleCommand(message, client);
    } catch (error) {
      // Captura e exibe qualquer erro que ocorra durante o processamento do comando
      console.error('ERRO FATAL AO PROCESSAR COMANDO:', error);
      
      // Opcional: Envia uma mensagem de erro para o usuário no WhatsApp
      await message.reply('❌ Ocorreu um erro inesperado ao processar seu comando.');
    }
  }
});

connectDB();