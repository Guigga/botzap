// commands/uteis.js
module.exports = {
    name: '!id',
    aliases: ['!debug', '!moeda', '!bicho', '!responda'],
    description: 'Comandos utilitários diversos.',
    async execute(message, command, body) {
        const { from } = message;

        switch (command) {
            case '!id':
                await message.reply(`O ID deste chat é:\n\`${from}\``);
                break;
            
            case '!debug':
                console.log('===== OBJETO MESSAGE COMPLETO =====');
                console.log(message);
                console.log('=================================');
                await message.reply('O objeto da mensagem foi impresso no console do bot. 😉');
                break;

            case '!moeda':
                await message.reply('Jogando a moeda... 🪙');
                const resultado = Math.random() < 0.5 ? 'Cara' : 'Coroa';
                const emoji = resultado === 'Cara' ? '🗿' : '👑';
                await message.reply(`Deu *${resultado}*! ${emoji}`);
                break;
            
            case '!bicho':
                const animais = ['Avestruz G1', 'Águia G2', 'Burro G3', 'Borboleta G4', 'Cachorro G5', 'Cabra G6', 'Carneiro G7', 'Camelo G8', 'Cobra G9', 'Coelho G10', 'Cavalo G11', 'Elefante G12', 'Galo G13', 'Gato G14', 'Jacaré G15', 'Leão G16', 'Macaco G17', 'Porco G18', 'Pavão G19', 'Peru G20', 'Touro G21', 'Tigre G22', 'Urso G23', 'Veado G24', 'Vaca G25'];
                const sorteado = animais[Math.floor(Math.random() * animais.length)];
                await message.reply(`O resultado de hoje é: *${sorteado}*`);
                break;

            case '!responda':
                const respostas = ["Sim.", "Não.", "Com certeza!", "Definitivamente não.", "Talvez.", "Os astros indicam que sim.", "Concentre-se e pergunte de novo.", "Não conte com isso."];
                const respostaMistica = respostas[Math.floor(Math.random() * respostas.length)];
                await message.reply(`O Botzap responde:\n\n*${respostaMistica}*`);
                break;
        }
    }
};