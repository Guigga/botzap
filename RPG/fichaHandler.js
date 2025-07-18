const fs = require('fs');
const path = require('path');

// Define o caminho para a pasta onde as fichas serão salvas
const fichasDir = path.join(__dirname, 'fichas');

// Garante que a pasta 'fichas' exista
if (!fs.existsSync(fichasDir)) {
    fs.mkdirSync(fichasDir);
}

// --- CONFIGURAÇÃO DE LIMITES ---
const ATRIBUTO_LIMITES = {
    // Limites de texto
    nome: { type: 'string', maxLength: 50 },
    classe: { type: 'string', maxLength: 50 },

    // Limites numéricos
    nivel: { type: 'number', min: 1, max: 100 },
    hp_max: { type: 'number', min: 1, max: 9999 },
    hp_atual: { type: 'number', min: 0, max: 9999 },
    ca: { type: 'number', min: 1, max: 100 },
    forca: { type: 'number', min: 1, max: 100 },
    destreza: { type: 'number', min: 1, max: 100 },
    constituicao: { type: 'number', min: 1, max: 100 },
    inteligencia: { type: 'number', min: 1, max: 100 },
    sabedoria: { type: 'number', min: 1, max: 100 },
    carisma: { type: 'number', min: 1, max: 100 },
};


// --- FUNÇÕES DE ARQUIVO ---

// Função para carregar os dados de um jogador
function carregarFicha(playerId) {
    const caminhoArquivo = path.join(fichasDir, `${playerId}.json`);
    if (fs.existsSync(caminhoArquivo)) {
        const dados = fs.readFileSync(caminhoArquivo, 'utf-8');
        return JSON.parse(dados);
    }
    return null;
}

// Função para salvar os dados de um jogador
function salvarFicha(playerId, dadosFicha) {
    const caminhoArquivo = path.join(fichasDir, `${playerId}.json`);
    fs.writeFileSync(caminhoArquivo, JSON.stringify(dadosFicha, null, 2));
}

// --- FUNÇÕES DE COMANDO ---

// Comando !criar-ficha
async function handleCriarFicha(message) {
    const playerId = message.author || message.from;
    
    if (carregarFicha(playerId)) {
        return message.reply('❌ Você já possui uma ficha. Use `!set` para atualizá-la ou `!apagar-ficha` para recomeçar.');
    }

    const fichaPadrao = {
        nome: "Aventureiro Sem Nome",
        classe: "N/A",
        nivel: 1,
        hp_max: 10,
        hp_atual: 10,
        ca: 10,
        forca: 10,
        destreza: 10,
        constituicao: 10,
        inteligencia: 10,
        sabedoria: 10,
        carisma: 10,
        inventario: []
    };

    salvarFicha(playerId, fichaPadrao);
    await message.reply('✅ Ficha criada com sucesso! Use `!set nome=Seu Nome` para começar a personalizá-la e `!ficha` para vê-la.');
}

// Comando !ficha
async function handleVerFicha(message) {
    const playerId = message.author || message.from;
    const ficha = carregarFicha(playerId);

    if (!ficha) {
        return message.reply('Você ainda não tem uma ficha. Crie uma com `!criar-ficha`.');
    }

    // Formata a ficha para uma mensagem bonita
    let resposta = `*--- ${ficha.nome} ---*\n`;
    resposta += `*Classe:* ${ficha.classe}\n`;
    resposta += `*Nível:* ${ficha.nivel}\n`;
    resposta += `*HP:* ${ficha.hp_atual} / ${ficha.hp_max} ❤️\n`;
    resposta += `*CA:* ${ficha.ca} 🛡️\n\n`;
    resposta += `*Atributos:*\n`;
    resposta += `For: ${ficha.forca} | Des: ${ficha.destreza} | Con: ${ficha.constituicao}\n`;
    resposta += `Int: ${ficha.inteligencia} | Sab: ${ficha.sabedoria} | Car: ${ficha.carisma}\n\n`;
    resposta += `*Inventário:*\n`;
    resposta += ficha.inventario && ficha.inventario.length > 0 ? `• ${ficha.inventario.join('\n• ')}` : "Vazio";

    await message.reply(resposta);
}

// Comando !set
async function handleSetAtributo(message) {
    const playerId = message.author || message.from;
    const ficha = carregarFicha(playerId);

    if (!ficha) {
        return message.reply('Você ainda não tem uma ficha. Crie uma com `!criar-ficha`.');
    }

    const args = message.body.split(' ').slice(1).join(' ');
    const [chave, ...valorArray] = args.split('=');
    const valor = valorArray.join('=').trim();

    const chaveNormalizada = chave.trim().toLowerCase();
    const limite = ATRIBUTO_LIMITES[chaveNormalizada];

    if (!limite) {
        return message.reply(`❌ Atributo desconhecido: *${chaveNormalizada}*.\n\nUse o comando \`!ficha\` para ver os atributos válidos.`);
    }

    // --- LÓGICA DE VALIDAÇÃO ---

    // Validação para atributos de texto
    if (limite.type === 'string') {
        if (valor.length > limite.maxLength) {
            return message.reply(`❌ O valor para *${chaveNormalizada}* é muito longo. O máximo é de ${limite.maxLength} caracteres.`);
        }
        ficha[chaveNormalizada] = valor;
    } 
    // Validação para atributos numéricos
    else if (limite.type === 'number') {
        const numero = Number(valor);
        if (isNaN(numero)) {
            return message.reply(`❌ O valor para *${chaveNormalizada}* deve ser um número.`);
        }

        // Validação inteligente: hp_atual não pode ser maior que hp_max
        const maxVal = (chaveNormalizada === 'hp_atual') ? ficha.hp_max : limite.max;
        const minVal = limite.min;

        if (numero < minVal || numero > maxVal) {
            return message.reply(`❌ O valor para *${chaveNormalizada}* deve estar entre ${minVal} e ${maxVal}.`);
        }
        
        ficha[chaveNormalizada] = Math.floor(numero); // Arredonda para baixo para garantir um número inteiro
    }

    salvarFicha(playerId, ficha);
    await message.reply(`✅ Atributo *${chaveNormalizada}* atualizado para *${valor}*!`);
}

// Comando !add
async function handleAddItem(message) {
    const playerId = message.author || message.from;
    const ficha = carregarFicha(playerId);

    if (!ficha) {
        return message.reply('❌ Você não tem uma ficha para adicionar itens.');
    }

    // Pega tudo que vem depois do comando "!add "
    const valor = message.body.split(' ').slice(1).join(' ').trim();
    if (!valor) {
        return message.reply('Formato inválido. Use `!add item1, item2, ...`');
    }

    const novosItens = valor.split(',').map(item => item.trim().substring(0, 70)).filter(item => item);
    if (ficha.inventario.length + novosItens.length > 20) {
        return message.reply(`❌ Seu inventário excederia o limite de 20 itens.`);
    }

    ficha.inventario.push(...novosItens);
    salvarFicha(playerId, ficha);

    await message.reply(`✅ Itens adicionados: *${novosItens.join(', ')}*`);
}

// Comando !rmv
async function handleRemoveItem(message) {
    const playerId = message.author || message.from;
    const ficha = carregarFicha(playerId);

    if (!ficha || !ficha.inventario || ficha.inventario.length === 0) {
        return message.reply('❌ Seu inventário está vazio ou você não tem uma ficha.');
    }

    // Pega tudo que vem depois do comando "!rmv "
    const itemParaRemover = message.body.split(' ').slice(1).join(' ').trim().toLowerCase();
    if (!itemParaRemover) {
        return message.reply('Formato inválido. Use `!rmv <nome do item>`.');
    }
    
    const itemIndex = ficha.inventario.findIndex(item => item.toLowerCase() === itemParaRemover);

    if (itemIndex === -1) {
        return message.reply(`❌ Item "*${itemParaRemover}*" não encontrado no seu inventário.`);
    }

    const [itemRemovido] = ficha.inventario.splice(itemIndex, 1);
    salvarFicha(playerId, ficha);

    await message.reply(`✅ Item "*${itemRemovido}*" removido do seu inventário.`);
}

// Comando !apagar-ficha
async function handleApagarFicha(message) {
    const playerId = message.author || message.from;
    const caminhoArquivo = path.join(fichasDir, `${playerId}.json`);

    if (!fs.existsSync(caminhoArquivo)) {
        return message.reply('❌ Você não possui uma ficha para apagar.');
    }

    try {
        fs.unlinkSync(caminhoArquivo);
        await message.reply('✅ Sua ficha foi apagada com sucesso. Você pode criar uma nova com `!criar-ficha`.');
    } catch (error) {
        console.error("Erro ao apagar ficha:", error);
        await message.reply('❌ Ocorreu um erro ao tentar apagar sua ficha.');
    }
}


// Exporta as funções para serem usadas no commandHandler
module.exports = {
    handleCriarFicha,
    handleVerFicha,
    handleSetAtributo,
    handleAddItem,
    handleRemoveItem,
    handleApagarFicha 
};