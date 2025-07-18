// RPG/fichaHandler.js

// Importações
const Ficha = require('../models/Ficha');
const ARQUETIPOS = require('./classes');
const RACAS = require('./racas.js');

const ATRIBUTO_LIMITES = {
    // Atributos Principais
    nome: { type: 'string', maxLength: 50 },
    classe: { type: 'string', maxLength: 50 },
    raca: { type: 'string', maxLength: 50 },
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

    // Detalhes Físicos
    idade: { type: 'string', maxLength: 30 },
    altura: { type: 'string', maxLength: 30 },
    peso: { type: 'string', maxLength: 30 },
    // Detalhes Narrativos
    alinhamento: { type: 'string', maxLength: 50 },
    antecedente: { type: 'string', maxLength: 150 },
    divindade: { type: 'string', maxLength: 50 },
    historia: { type: 'string', maxLength: 2048 },
};

// --- FUNÇÕES HELPER ---
function aplicarArquétipo(ficha, nomeClasse) {
    const arquétipo = ARQUETIPOS[nomeClasse.toLowerCase()];
    if (!arquétipo) return;
    Object.keys(arquétipo).forEach(key => {
        ficha[key] = arquétipo[key];
    });
    ficha.classe = nomeClasse.charAt(0).toUpperCase() + nomeClasse.slice(1);
}

function aplicarRaca(ficha, nomeRaca) {
    const raca = RACAS[nomeRaca.toLowerCase()];
    if (!raca || !raca.modificadores) return;
    Object.keys(raca.modificadores).forEach(key => {
        if (ficha[key] !== undefined) {
            ficha[key] += raca.modificadores[key];
        }
    });
    ficha.raca = nomeRaca.charAt(0).toUpperCase() + nomeRaca.slice(1);
}

// --- FUNÇÕES DE COMANDO ---

async function handleCriarFicha(message) {
    const playerId = message.author || message.from;
    const fichaExistente = await Ficha.findOne({ playerId: playerId });
    if (fichaExistente) {
        return message.reply('❌ Você já possui uma ficha. Use `!apagar-ficha` para recomeçar.');
    }

    const args = message.body.split(' ').slice(1);
    const nomePersonagem = args[0];
    const classePersonagem = args[1];
    const racaPersonagem = args[2];

    let fichaData = { playerId: playerId, nome: nomePersonagem || "Sem Nome" };

    if (classePersonagem) {
        const classeNormalizada = classePersonagem.toLowerCase();
        if (ARQUETIPOS[classeNormalizada]) {
            Object.assign(fichaData, ARQUETIPOS[classeNormalizada]);
            fichaData.classe = classeNormalizada.charAt(0).toUpperCase() + classeNormalizada.slice(1);
        } else {
            const classesDisponiveis = Object.keys(ARQUETIPOS).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
            return message.reply(`❌ Classe "*${classePersonagem}*" inválida.\n\nClasses disponíveis: ${classesDisponiveis}.`);
        }
    }

    if (racaPersonagem) {
        const racaNormalizada = racaPersonagem.toLowerCase();
        if (RACAS[racaNormalizada]) {
            aplicarRaca(fichaData, racaNormalizada);
        } else {
            const racasDisponiveis = Object.keys(RACAS).map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ');
            return message.reply(`❌ Raça "*${racaPersonagem}*" inválida.\n\nRaças disponíveis: ${racasDisponiveis}.`);
        }
    }
    
    await Ficha.create(fichaData);
    await message.reply(`✅ Ficha para *${fichaData.nome}* (${fichaData.raca || 'N/A'}, ${fichaData.classe || 'N/A'}) criada com sucesso! Use \`!ficha\` para vê-la.`);
}

async function handleSetAtributo(message) {
    const playerId = message.author || message.from;
    const ficha = await Ficha.findOne({ playerId: playerId });

    if (!ficha) {
        return message.reply('Você ainda não tem uma ficha. Crie uma com `!criar-ficha`.');
    }

    const args = message.body.split(' ').slice(1).join(' ');
    const parts = args.split('=');
    let chave = parts[0].trim().toLowerCase();
    const valor = parts.slice(1).join('=').trim();

    if (!chave || !valor) {
        return message.reply('Formato inválido. Use `!set <atributo>=<valor>`.');
    }

    const aliasAtributos = {
        for: 'forca', des: 'destreza', con: 'constituicao', int: 'inteligencia',
        sab: 'sabedoria', car: 'carisma', hp: 'hp_atual'
    };
    if (aliasAtributos[chave]) chave = aliasAtributos[chave];

    if (chave === 'classe' || chave === 'raca') {
        if (chave === 'classe') {
            const novaClasse = valor.toLowerCase();
            if (!ARQUETIPOS[novaClasse]) {
                const classesDisponiveis = Object.keys(ARQUETIPOS).map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
                return message.reply(`❌ Classe "*${valor}*" inválida.\n\nClasses disponíveis: ${classesDisponiveis}.`);
            }
            ficha.classe = ARQUETIPOS[novaClasse] ? (novaClasse.charAt(0).toUpperCase() + novaClasse.slice(1)) : ficha.classe;
        }
        if (chave === 'raca') {
            const novaRaca = valor.toLowerCase();
            if (!RACAS[novaRaca]) {
                const racasDisponiveis = Object.keys(RACAS).map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ');
                return message.reply(`❌ Raça "*${valor}*" inválida.\n\nRaças disponíveis: ${racasDisponiveis}.`);
            }
            ficha.raca = RACAS[novaRaca] ? (novaRaca.charAt(0).toUpperCase() + novaRaca.slice(1)) : ficha.raca;
        }

        // Recalcular atributos
        if (ficha.classe && ficha.classe !== 'N/A') aplicarArquétipo(ficha, ficha.classe);
        if (ficha.raca && ficha.raca !== 'N/A') aplicarRaca(ficha, ficha.raca);
        
        await ficha.save();
        return message.reply(`✅ Atributos recalculados para a nova ${chave}!`);
    }
    
    const limite = ATRIBUTO_LIMITES[chave];
    if (!limite) return message.reply(`❌ Atributo desconhecido: *${chave}*.`);

    if (limite.type === 'string') {
        if (valor.length > limite.maxLength) return message.reply(`❌ O valor para *${chave}* é muito longo (máx: ${limite.maxLength} caracteres).`);
        ficha[chave] = valor;
    } else if (limite.type === 'number') {
        const numero = Number(valor);
        if (isNaN(numero)) return message.reply(`❌ O valor para *${chave}* deve ser um número.`);
        const maxVal = (chave === 'hp_atual') ? ficha.hp_max : limite.max;
        const minVal = limite.min;
        if (numero < minVal || numero > maxVal) return message.reply(`❌ O valor para *${chave}* deve estar entre ${minVal} e ${maxVal}.`);
        ficha[chave] = Math.floor(numero);
    }
    
    await ficha.save();
    await message.reply(`✅ Atributo *${chave}* atualizado para *${valor}*!`);
}

async function handleVerFicha(message) {
    const playerId = message.author || message.from;
    const ficha = await Ficha.findOne({ playerId: playerId });

    if (!ficha) return message.reply('Você ainda não tem uma ficha. Crie uma com `!criar-ficha`.');

    let resposta = `*--- ${ficha.nome} ---*\n\n`;
    resposta += `*${ficha.classe || 'N/A'} | ${ficha.raca || 'N/A'}* - Nível ${ficha.nivel}\n`;
    resposta += `*Alinhamento:* ${ficha.alinhamento || 'N/A'} | *Divindade:* ${ficha.divindade || 'N/A'}\n\n`;

    resposta += `*HP:* ${ficha.hp_atual}/${ficha.hp_max} ❤️ | *CA:* ${ficha.ca} 🛡️\n\n`;
    
    resposta += `*Atributos:*\nFor: ${ficha.forca} | Des: ${ficha.destreza} | Con: ${ficha.constituicao} \nInt: ${ficha.inteligencia}  | Sab: ${ficha.sabedoria} | Car: ${ficha.carisma}\n\n`;

    resposta += `*Ataques ⚔*\n${ficha.ataques && ficha.ataques.length > 0 ? `• ${ficha.ataques.join('\n• ')}` : "_Nenhum_"}\n\n`;
    resposta += `*Magias ✨*\n${ficha.magias && ficha.magias.length > 0 ? `• ${ficha.magias.join('\n• ')}` : "_Nenhuma_"}\n\n`;
    resposta += `*Habilidades* 💪\n${ficha.habilidades && ficha.habilidades.length > 0 ? `• ${ficha.habilidades.join('\n• ')}` : "_Nenhuma_"}\n\n`;
    resposta += `*Inventário* 🎒\n${ficha.inventario && ficha.inventario.length > 0 ? `• ${ficha.inventario.join('\n• ')}` : "_Vazio_"}\n\n`;

    resposta += `*Detalhes Pessoais:* 👤\nIdade: ${ficha.idade || 'N/A'} | Altura: ${ficha.altura || 'N/A'} | Peso: ${ficha.peso || 'N/A'}\n\n`;
    
    resposta += `*Antecedente:* 📜 ${ficha.antecedente || 'N/A'}\n\n`;
    resposta += `*História* 📖 ${ficha.historia || 'N/A'}\n`;

    resposta += `\n---\n_Para ajuda com os comandos, digite !rpg-help_`;

    await message.reply(resposta);
}

// --- FUNÇÕES DE GERENCIAMENTO DE LISTAS ---
async function gerenciarLista(message, tipo) {
    const acao = message.body.startsWith('!add') ? 'add' : 'remove';
    const singular = tipo.slice(0, -1); // Ex: 'magias' -> 'magia'
    const limite = { magias: 50, ataques: 10, habilidades: 20, inventario: 20 }[tipo];

    const playerId = message.author || message.from;
    const ficha = await Ficha.findOne({ playerId: playerId });
    if (!ficha) return message.reply('❌ Você não tem uma ficha.');

    if (acao === 'remove' && (!ficha[tipo] || ficha[tipo].length === 0)) {
        return message.reply(`❌ Você não tem ${tipo} para remover.`);
    }

    const valor = message.body.split(' ').slice(1).join(' ').trim();
    if (!valor) return message.reply(`Formato inválido. Use \`!${acao}${singular} <nome>\``);

    if (acao === 'add') {
        const novosItens = valor.split(',').map(i => i.trim().substring(0, 100)).filter(i => i);
        if ((ficha[tipo].length + novosItens.length) > limite) return message.reply(`❌ Limite de ${limite} ${tipo} atingido.`);
        await Ficha.updateOne({ playerId: playerId }, { $push: { [tipo]: { $each: novosItens } } });
        await message.reply(`✅ ${singular.charAt(0).toUpperCase() + singular.slice(1)}(s) adicionado(s): *${novosItens.join(', ')}*`);
    } else { // remover
        const itemParaRemover = ficha[tipo].find(i => i.toLowerCase() === valor.toLowerCase());
        if (!itemParaRemover) return message.reply(`❌ ${singular.charAt(0).toUpperCase() + singular.slice(1)} "*${valor}*" não encontrado.`);
        await Ficha.updateOne({ playerId: playerId }, { $pull: { [tipo]: itemParaRemover } });
        await message.reply(`✅ ${singular.charAt(0).toUpperCase() + singular.slice(1)} "*${itemParaRemover}*" removido.`);
    }
}

const handleAddItem = (message) => gerenciarLista(message, 'inventario');
const handleRemoveItem = (message) => gerenciarLista(message, 'inventario');
const handleAddHabilidade = (message) => gerenciarLista(message, 'habilidades');
const handleRmvHabilidade = (message) => gerenciarLista(message, 'habilidades');
const handleAddAtaque = (message) => gerenciarLista(message, 'ataques');
const handleRmvAtaque = (message) => gerenciarLista(message, 'ataques');
const handleAddMagia = (message) => gerenciarLista(message, 'magias');
const handleRmvMagia = (message) => gerenciarLista(message, 'magias');


async function handleApagarFicha(message) {
    const playerId = message.author || message.from;
    const resultado = await Ficha.deleteOne({ playerId: playerId });
    if (resultado.deletedCount === 0) return message.reply('❌ Você não possui uma ficha para apagar.');
    await message.reply('✅ Sua ficha foi apagada com sucesso.');
}

async function handleVerClasses(message) {
    let resposta = "*Classes Disponíveis no BotZap RPG* ⚔️\n\n";
    for (const classe in ARQUETIPOS) {
        const data = ARQUETIPOS[classe];
        const nomeClasse = classe.charAt(0).toUpperCase() + classe.slice(1);
        resposta += `*${nomeClasse}*\nHP: ${data.hp_max} | CA: ${data.ca}\n`;
        resposta += `For:${data.forca}|Des:${data.destreza}|Con:${data.constituicao}|Int:${data.inteligencia}|Sab:${data.sabedoria}|Car:${data.carisma}\n\n`;
    }
    await message.reply(resposta);
}

async function handleVerRacas(message) {
    let resposta = "*Raças Disponíveis no BotZap RPG* 🌍\n\n";
    for (const raca in RACAS) {
        const data = RACAS[raca];
        const nomeRaca = raca.charAt(0).toUpperCase() + raca.slice(1);
        resposta += `*${nomeRaca}*: ${data.descricao}\n`;
        const mods = Object.entries(data.modificadores).map(([attr, val]) => `${attr.substring(0,3)}: ${val > 0 ? '+' : ''}${val}`).join(' | ');
        resposta += `_Modificadores: ${mods}_\n\n`;
    }
    await message.reply(resposta);
}

module.exports = {
    handleCriarFicha, handleVerFicha, handleSetAtributo, handleAddItem,
    handleRemoveItem, handleAddHabilidade, handleRmvHabilidade, handleAddAtaque,
    handleRmvAtaque, handleAddMagia, handleRmvMagia, handleApagarFicha,
    handleVerClasses, handleVerRacas
};
