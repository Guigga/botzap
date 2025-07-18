// C:\Users\Guilherme\bot-whatsapp\controllers\rpgHandler.js

const fichaActions = require('../RPG/fichaHandler');

// Função helper para processar a rolagem de dados
function rolarDados(expressao) {
    const match = expressao.toLowerCase().match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/);
    if (!match) return "Formato inválido. 😕\nUse `NdX` ou `NdX+Y` (ex: `1d6`, `2d20+5`).";

    const numeroDeDados = parseInt(match[1]);
    const ladosDoDado = parseInt(match[2]);
    const modificador = match[3] ? parseInt(match[3].replace(/\s/g, '')) : 0;

    if (numeroDeDados <= 0 || ladosDoDado <= 0) return "❌ O número de dados e de lados deve ser maior que zero.";
    if (numeroDeDados > 10000) return `❌ Limite de 10.000 dados por rolagem excedido.`;
    if (ladosDoDado > 100000000000) return `❌ O limite de lados do dado é de 100.000.000.000`;
    if (Math.abs(modificador) > 1000000) return `❌ O modificador não pode ser maior que 1.000.000.`; // <-- VALIDAÇÃO ADICIONADA AQUI

    const resultados = [];
    let soma = 0;
    for (let i = 0; i < numeroDeDados; i++) {
        const resultado = Math.floor(Math.random() * ladosDoDado) + 1;
        resultados.push(resultado);
        soma += resultado;
    }
    const somaFinal = soma + modificador;

    const textoDados = numeroDeDados === 1 ? 'Dado' : 'Dados';
    const textoLados = ladosDoDado === 1 ? 'Lado' : 'Lados';
    let resposta = `Rolando *${numeroDeDados}* ${textoDados} de *${ladosDoDado}* ${textoLados}...\n\n`;
    let detalhesSoma = `*Soma Total: ${somaFinal}*`;

    // A lógica abaixo apenas oculta os detalhes do modificador na resposta se ele for muito grande,
    // mas a validação acima impede que o cálculo sequer aconteça.
    if (modificador !== 0 && Math.abs(modificador) < 1000000) {
        const sinalModificador = modificador > 0 ? `+ ${modificador}` : `- ${Math.abs(modificador)}`;
        detalhesSoma = `*Soma Total: ${soma} (${sinalModificador}) = ${somaFinal}*`;
    }

    if (numeroDeDados <= 50) {
        resposta += `Resultados: [${resultados.join(', ')}] 🎲\n\n${detalhesSoma}`;
    } else {
        resposta += `${detalhesSoma} 🎲\n\n(Resultados individuais omitidos para mais de 50 dados)`;
    }
    return resposta;
}

// Handler principal para todos os comandos de RPG
async function handleRpgCommand(message) {
    const commandArgs = message.body.split(' ');
    const command = commandArgs[0].toLowerCase();
    const bodyLower = message.body.toLowerCase();

    // --- ROTEAMENTO ATUALIZADO ---
    if (bodyLower.startsWith('!add=')) {
        return fichaActions.handleAddInventario(message);
    }
    if (bodyLower.startsWith('!rmv=')) {
        return fichaActions.handleRmvInventario(message);
    }
    
    const matchDadoRapido = command.match(/^!(\d+d\d+.*)$/i);
    if (command === '!dados' || matchDadoRapido) {
        const expressao = command === '!dados' ? commandArgs[1] : matchDadoRapido[1];
        if (!expressao) {
            return message.reply("Uso: `!dados <formato>` (ex: `!dados 2d20`)");
        }
        const resultado = rolarDados(expressao);
        await message.reply(resultado);
        return;
    }

    switch(command) {
        case '!rpg':
            const rpgHelpMessage = 
                `*Bem-vindo ao Módulo de RPG do BotZap!* ⚔️\n\n` +
                `Este é seu assistente para gerenciar fichas e rolar dados.\n\n` +
                `*--- Comandos de Ficha ---*\n` +
                `• \`!criar-ficha\`: Cria sua ficha de personagem.\n` +
                `• \`!ficha\`: Mostra sua ficha atual.\n` +
                `• \`!set <atr>=<val>\`: Modifica um atributo (Ex: \`!set hp=25\`).\n` +
                `• \`!remover <item>\`: Remove um item do seu inventário.\n` + // <-- Adicionado para clareza
                `• \`!apagar-ficha\`: Apaga permanentemente sua ficha.\n\n` +
                `*--- Comandos de Dados ---*\n` +
                `• \`!dados <N>d<L>\`: Rola N dados de L lados (Ex: \`!dados 2d6\`).\n` +
                `• \`!<N>d<L>\`: Atalho para rolar dados (Ex: \`!1d20\`).\n` +
                `• _Modificadores_: Você pode adicionar + ou - (Ex: \`!2d8+4\`).\n\n` +
                `• Ajuda: \`!rpg-ajuda\` ou \`!rpg-help\`\n\n` +
                `Bons jogos e que seus dados rolem sempre alto! 🎲`;
            await message.reply(rpgHelpMessage);
            break;
        
        case '!criar-ficha':
            await fichaActions.handleCriarFicha(message);
            break;

        case '!ficha':
            await fichaActions.handleVerFicha(message);
            break;
            
        case '!set':
            await fichaActions.handleSetAtributo(message);
            break;
            
        case '!remover':
            await fichaActions.handleRemoverItem(message);
            break;

        case '!add':
            await fichaActions.handleAddItem(message);
            break;

        case '!rmv':
            await fichaActions.handleRemoveItem(message);
            break;
            
        case '!apagar-ficha':
            await fichaActions.handleApagarFicha(message);
            break;

        case '!rpg-ajuda':
        case '!rpg-help':
            const ajudaDetalhada = 
`*Guia de Comandos - Módulo RPG* 📖

Aqui estão todos os comandos que você pode usar para gerenciar sua aventura!

*--- Ficha de Personagem ---*

• \`!criar-ficha\`
_Cria um novo personagem com atributos padrão. Você só pode ter uma ficha por vez._

• \`!ficha\`
_Exibe sua ficha de personagem completa, com todos os atributos, HP, e inventário._

• \`!apagar-ficha\`
_Apaga PERMANENTEMENTE sua ficha. Use com cuidado!_

• \`!set <atributo>=<valor>\`
_O comando mais importante! Serve para modificar QUALQUER atributo da sua ficha._
  *Exemplos:*
  \`!set nome=Aragorn\`
  \`!set hp_atual=25\`
  \`!set hp_max=50\`

*--- Inventário ---*
• \`!add <item1>, <item2>\`
_Adiciona um ou mais itens ao seu inventário._
  *Ex: \`!add Tocha, Corda\`*

• \`!rmv=<nome do item>\`
_Remove um item do seu inventário._
  *Ex: \`!rmv Tocha\`*

*--- Rolagem de Dados ---*

• \`!dados <N>d<L>+/-<M>\` ou \`!<N>d<L>+/-<M>\`
_Rola N dados de L lados com um modificador M._
  *Exemplos:*
  \`!dados 2d6\` (rola 2 dados de 6 lados)
  \`!1d20\` (rola 1 dado de 20 lados)
  \`!3d8+5\` (rola 3 dados de 8 lados e soma 5 ao total)
  \`!2d10-2\` (rola 2 dados de 10 lados e subtrai 2 do total)`;
            
            await message.reply(ajudaDetalhada);
            break;
    }
}

module.exports = { handleRpgCommand };