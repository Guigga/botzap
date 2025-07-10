// games/Uno/uno.js

const sessionManager = require('../../sessions/sessionManager');
const { gerarBaralhoUno } = require('./baralhoUno');
const botPlayer = require('./botPlayer'); // Importamos o bot

// --- FUNÇÃO DE FORMATAÇÃO (já tínhamos) ---
function formatarMaoParaMensagem(mao, gameState, cartasCompradas = []) {
    const corEmoji = { 'vermelho': '🟥', 'amarelo': '🟨', 'verde': '🟩', 'azul': '🟦', 'preto': '🎨' };
    let textoFinal = '';

    // VERIFICAÇÃO ADICIONADA: Só mostra a última carta se ela existir.
    if (gameState.cartaAtual) {
        const sentidoEmoji = gameState.sentido === 1 ? '➡️' : '⬅️';
        textoFinal += `Última carta jogada: *${corEmoji[gameState.corAtual]} ${gameState.cartaAtual.valor}* ${sentidoEmoji}\n\n`;
    } else {
        // Mensagem especial para a mão inicial, antes do jogo começar de fato.
        textoFinal += 'Estas são suas cartas iniciais!\n\n';
    }
    
    textoFinal += '*Sua mão:*\n';

    const maoAntiga = mao.filter(c => !cartasCompradas.includes(c));
    if (maoAntiga.length > 0) {
        maoAntiga.forEach((carta, index) => {
            textoFinal += `${index + 1}. ${corEmoji[carta.cor]} ${carta.valor}\n`;
        });
    } else if (cartasCompradas.length === 0) {
        return 'Você não tem mais cartas. Parabéns, você venceu!';
    }

    if (cartasCompradas.length > 0) {
        textoFinal += '---\n*Cartas compradas:*\n';
        cartasCompradas.forEach((carta, index) => {
            textoFinal += `${maoAntiga.length + index + 1}. ${corEmoji[carta.cor]} ${carta.valor}\n`;
        });
    }

    textoFinal += '\nPara jogar, use `!jogar <número da carta>`.';
    return textoFinal;
}

// --- FUNÇÃO DE PREPARAÇÃO (já tínhamos) ---
function prepararJogo(session) {
    session.status = 'em_jogo';
    session.gameState = {
        jogadores: session.players.map(p => ({ ...p, mao: [] })),
        baralho: gerarBaralhoUno(),
        pilhaDescarte: [],
        cartaAtual: null,
        jogadorDaVezIndex: 0,
        sentido: 1,
        corAtual: null,
        efeitoPendente: null,
        disseUno: new Set()
    };
    console.log(`[UNO] Jogo preparado para ${session.groupId}`);
}

// --- FUNÇÃO DE INÍCIO (já tínhamos) ---
async function iniciarPartida(session, client) {
    const { gameState } = session;
    for (let i = 0; i < 7; i++) {
        for (const jogador of gameState.jogadores) {
            // Garante que o baralho não fique vazio durante a distribuição
            if (gameState.baralho.length === 0) break;
            jogador.mao.push(gameState.baralho.pop());
        }
    }

    // CORREÇÃO 1: Passar o 'gameState' ao formatar a mão inicial
    for (const jogador of gameState.jogadores) {
        if (jogador.id.includes('@cpu.bot')) {
            console.log(`[UNO] Mão do Bot ${jogador.name}:`, jogador.mao.map(c => `${c.cor} ${c.valor}`).join(', '));
        } else {
            // A função agora é chamada com os dois argumentos necessários
            await client.sendMessage(jogador.id, formatarMaoParaMensagem(jogador.mao, gameState));
        }
    }

    let primeiraCarta = gameState.baralho.pop();
    while (primeiraCarta.valor === '+4') {
        gameState.baralho.push(primeiraCarta);
        for (let i = gameState.baralho.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [gameState.baralho[i], gameState.baralho[j]] = [gameState.baralho[j], gameState.baralho[i]];
        }
        primeiraCarta = gameState.baralho.pop();
    }
    gameState.pilhaDescarte.push(primeiraCarta);
    gameState.cartaAtual = primeiraCarta;
    gameState.corAtual = primeiraCarta.cor;

    // CORREÇÃO 2: Formatar a primeira carta diretamente, sem chamar a função da mão
    const corEmoji = { 'vermelho': '🟥', 'amarelo': '🟨', 'verde': '🟩', 'azul': '🟦', 'preto': '🎨' };
    let anuncioInicial = `*O jogo de UNO começou!* 🃏\n\nA primeira carta na mesa é: *${corEmoji[gameState.corAtual]} ${gameState.cartaAtual.valor}*\n\n`;

    const jogadorInicial = gameState.jogadores[gameState.jogadorDaVezIndex];
    switch (primeiraCarta.valor) {
        case 'pular':
            gameState.jogadorDaVezIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
            anuncioInicial += `*${jogadorInicial.name}* foi pulado!\n`;
            break;
        case 'reverso':
            gameState.sentido *= -1;
            gameState.jogadorDaVezIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
            anuncioInicial += `O sentido do jogo foi invertido!\n`;
            break;
        case '+2':
            anuncioInicial += `*${jogadorInicial.name}* compra 2 cartas e perde a vez!\n`;
            jogadorInicial.mao.push(gameState.baralho.pop(), gameState.baralho.pop());
            // Envia a mão atualizada para o jogador que comprou
            if (!jogadorInicial.id.includes('@cpu.bot')) {
                await client.sendMessage(jogadorInicial.id, formatarMaoParaMensagem(jogadorInicial.mao, gameState, [jogadorInicial.mao.slice(-2)[0], jogadorInicial.mao.slice(-1)[0]]));
            }
            gameState.jogadorDaVezIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
            break;
        case 'curinga':
            if (jogadorInicial.id.includes('@cpu.bot')) {
                const cores = ['vermelho', 'amarelo', 'verde', 'azul'];
                gameState.corAtual = cores[Math.floor(Math.random() * cores.length)];
                anuncioInicial += `*${jogadorInicial.name}* (BOT) escolheu a cor *${gameState.corAtual.toUpperCase()}*!\n`;
            } else {
                session.status = 'aguardando_escolha_cor';
                anuncioInicial += `*${jogadorInicial.name}*, você começa! Use \`!cor <vermelho|azul|verde|amarelo>\` para escolher a cor.`;
                await client.sendMessage(session.groupId, anuncioInicial);
                return;
            }
            break;
    }
    const jogadorDaVez = gameState.jogadores[gameState.jogadorDaVezIndex];
    anuncioInicial += `É a vez de *${jogadorDaVez.name}* jogar.`;
    await client.sendMessage(session.groupId, anuncioInicial);

    if (jogadorDaVez.id.includes('@cpu.bot')) {
        await dispararAcaoBot(session, client);
    }
}

// --- NOVAS FUNÇÕES ---

/**
 * Processa a tentativa de um jogador de jogar uma carta.
 * @param {object} message - O objeto da mensagem.
 * @param {object} session - A sessão do jogo.
 * @param {object} client - O cliente do WhatsApp.
 */
async function processarJogada(message, session, client) {
    const { gameState } = session;
    const playerId = message.author || message.from;
    const jogadorAtual = gameState.jogadores[gameState.jogadorDaVezIndex];

    // --- Bloco de Validações (AGORA COMPLETO) ---
    if (jogadorAtual.id !== playerId) {
        // Ignora silenciosamente se não for um bot, para não poluir o chat
        if (!playerId.includes('@cpu.bot')) {
            return message.reply("Opa, não é a sua vez de jogar!");
        }
        return; // Sai silenciosamente se for um bot tentando jogar fora de hora
    }
    if (session.status === 'aguardando_escolha_cor') {
        return message.reply("Você precisa escolher uma cor antes de jogar! Use `!cor <nome da cor>`.");
    }

    const numeroCarta = parseInt(message.body.split(' ')[1]);
    if (isNaN(numeroCarta) || numeroCarta < 1 || numeroCarta > jogadorAtual.mao.length) {
        if (!playerId.includes('@cpu.bot')) {
            return message.reply(`Número de carta inválido. Escolha um número de 1 a ${jogadorAtual.mao.length}.`);
        }
        return; // Bot cometeu um erro, sai para evitar crash
    }
    const indexCarta = numeroCarta - 1;
    const cartaJogada = jogadorAtual.mao[indexCarta];

    const podeJogar = cartaJogada.cor === 'preto' || cartaJogada.cor === gameState.corAtual || cartaJogada.valor === gameState.cartaAtual.valor;
    if (!podeJogar) {
        if (!playerId.includes('@cpu.bot')) {
            return message.reply(`Jogada inválida! Você só pode jogar uma carta da cor *${gameState.corAtual.toUpperCase()}*, com o valor *${gameState.cartaAtual.valor}* ou um *Curinga*.`);
        }
        return; // Bot cometeu um erro, sai para evitar crash
    }

    // --- Bloco de Execução (continua como antes) ---
    jogadorAtual.mao.splice(indexCarta, 1); // Remove a carta da mão
    gameState.pilhaDescarte.push(cartaJogada);
    gameState.cartaAtual = cartaJogada;
    gameState.corAtual = cartaJogada.cor;

    const corEmoji = { 'vermelho': '🟥', 'amarelo': '🟨', 'verde': '🟩', 'azul': '🟦', 'preto': '🎨' };
    await client.sendMessage(session.groupId, `*${jogadorAtual.name}* jogou: *${corEmoji[cartaJogada.cor]} ${cartaJogada.valor}*`);

    if (!jogadorAtual.id.includes('@cpu.bot')) {
        const msgMao = formatarMaoParaMensagem(jogadorAtual.mao, gameState);
        await client.sendMessage(jogadorAtual.id, msgMao);
    }

    if (jogadorAtual.mao.length === 0) {
        await client.sendMessage(session.groupId, `*FIM DE JOGO!* 🏆\n*${jogadorAtual.name}* venceu a partida!`);
        sessionManager.endSession(session.groupId);
        return;
    }

    if (jogadorAtual.mao.length === 1 && !gameState.disseUno.has(playerId)) {
        await client.sendMessage(session.groupId, `*${jogadorAtual.name}* tem apenas uma carta!`);
    }

    // ... (verificação de vitória e de "UNO!" continua a mesma) ...

    // Lidar com efeitos de cartas de ação
    if (cartaJogada.cor !== 'preto') {
        let devePular = false;
        switch(cartaJogada.valor) {
            case 'pular':
                devePular = true;
                break;
            case 'reverso':
                gameState.sentido *= -1;
                await client.sendMessage(session.groupId, `Sentido do jogo invertido!`);
                break;
            case '+2':
                const proximoJogadorIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
                const proximoJogador = gameState.jogadores[proximoJogadorIndex];
                const cartasCompradas = [];
                
                for (let i = 0; i < 2; i++) {
                    if (gameState.baralho.length === 0) await reembaralharPilha(session, client);
                    const carta = gameState.baralho.pop();
                    proximoJogador.mao.push(carta);
                    cartasCompradas.push(carta);
                }
                
                await client.sendMessage(session.groupId, `*${proximoJogador.name}* compra 2 cartas e perde a vez!`);
                if (!proximoJogador.id.includes('@cpu.bot')) {
                    const msgMao = formatarMaoParaMensagem(proximoJogador.mao, gameState, cartasCompradas);
                    await client.sendMessage(proximoJogador.id, msgMao);
                }
                devePular = true;
                break;
        }
        if (devePular) {
            gameState.jogadorDaVezIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
        }
        await avancarTurno(session, client);
    } else {
        // Curinga ou +4: aguardar escolha da cor
        session.status = 'aguardando_escolha_cor';
        if (jogadorAtual.id.includes('@cpu.bot')) {
            // Se for o bot, ele escolhe a cor aleatoriamente e o jogo continua
            const cores = ['vermelho', 'amarelo', 'verde', 'azul'];
            gameState.corAtual = cores[Math.floor(Math.random() * cores.length)];
            await client.sendMessage(session.groupId, `*${jogadorAtual.name}* (BOT) escolheu a cor *${gameState.corAtual.toUpperCase()}*!`);
            session.status = 'em_jogo'; // Bot já escolheu, volta ao normal
            await avancarTurno(session, client);
        } else {
            // Se for humano, espera o comando !cor
            await client.sendMessage(session.groupId, `*${jogadorAtual.name}*, escolha a nova cor com \`!cor <nome da cor>\`.`);
        }
    }
}

/**
 * Avança para o próximo jogador e anuncia sua vez.
 * @param {object} session - A sessão do jogo.
 * @param {object} client - O cliente do WhatsApp.
 */
async function avancarTurno(session, client) {
    const { gameState } = session;
    gameState.jogadorDaVezIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
    
    const jogadorDaVez = gameState.jogadores[gameState.jogadorDaVezIndex];
    await client.sendMessage(session.groupId, `É a vez de *${jogadorDaVez.name}*.`);

    // Se o próximo jogador for um bot, dispara sua ação
    if (jogadorDaVez.id.includes('@cpu.bot')) {
        await dispararAcaoBot(session, client);
    }
}

/**
 * Dispara a ação do bot após um breve delay.
 * @param {object} session - A sessão do jogo.
 * @param {object} client - O cliente do WhatsApp.
 */
async function dispararAcaoBot(session, client) {
    const { gameState } = session;
    const botId = gameState.jogadores[gameState.jogadorDaVezIndex].id;
    const botObject = gameState.jogadores.find(j => j.id === botId);

    await new Promise(resolve => setTimeout(resolve, 2000)); 
    
    const comando = botPlayer.decideAction(gameState, botObject.mao);
    
    const fakeMessage = {
        author: botId,
        body: comando,
        reply: (text) => client.sendMessage(session.groupId, `🤖 ${botObject.name}: ${text}`)
    };

    if (comando.startsWith('!jogar')) {
        await processarJogada(fakeMessage, session, client);
    } else if (comando === '!comprar') { // <-- LÓGICA ATUALIZADA
        await processarCompra(fakeMessage, session, client); 
    }
}

async function reembaralharPilha(session, client) {
    const { gameState } = session;
    await client.sendMessage(session.groupId, "O baralho acabou! Reembaralhando as cartas da mesa...  shuffling");
    
    const cartasParaEmbaralhar = gameState.pilhaDescarte.slice(0, -1);
    gameState.pilhaDescarte = [gameState.cartaAtual];
    gameState.baralho = cartasParaEmbaralhar;

    for (let i = gameState.baralho.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.baralho[i], gameState.baralho[j]] = [gameState.baralho[j], gameState.baralho[i]];
    }
}

/**
 * Processa a escolha de cor do jogador após jogar um Curinga.
 * @param {object} message - O objeto da mensagem.
 * @param {object} session - A sessão do jogo.
 * @param {object} client - O cliente do WhatsApp.
 */
async function processarEscolhaDeCor(message, session, client) {
    const { gameState } = session;
    const playerId = message.author || message.from;
    const jogadorAtual = gameState.jogadores[gameState.jogadorDaVezIndex];

    if (session.status !== 'aguardando_escolha_cor') return;
    if (jogadorAtual.id !== playerId) return message.reply("Não é sua vez de escolher a cor!");

    const corEscolhida = message.body.split(' ')[1]?.toLowerCase();
    const coresValidas = ['vermelho', 'azul', 'verde', 'amarelo'];

    if (!coresValidas.includes(corEscolhida)) {
        return message.reply(`Cor inválida! Escolha entre: ${coresValidas.join(', ')}.`);
    }

    gameState.corAtual = corEscolhida;
    session.status = 'em_jogo';

    const corEmoji = { 'vermelho': '🟥', 'amarelo': '🟨', 'verde': '🟩', 'azul': '🟦' };
    await client.sendMessage(session.groupId, `*${jogadorAtual.name}* escolheu a cor *${corEmoji[corEscolhida]} ${corEscolhida.toUpperCase()}*!`);

    const ultimaCarta = gameState.cartaAtual;
    if (ultimaCarta.valor === '+4') {
        const proximoJogadorIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
        const proximoJogador = gameState.jogadores[proximoJogadorIndex];
        const cartasCompradas = [];

        await client.sendMessage(session.groupId, `*${proximoJogador.name}* compra 4 cartas e perde a vez!`);
        for (let i = 0; i < 4; i++) {
            if (gameState.baralho.length === 0) await reembaralharPilha(session, client);
            const carta = gameState.baralho.pop();
            proximoJogador.mao.push(carta);
            cartasCompradas.push(carta);
        }
        
        if (!proximoJogador.id.includes('@cpu.bot')) {
            const msgMao = formatarMaoParaMensagem(proximoJogador.mao, gameState, cartasCompradas);
            await client.sendMessage(proximoJogador.id, msgMao);
        }
        gameState.jogadorDaVezIndex = proximoJogadorIndex;
    }
    await avancarTurno(session, client);
}

/**
 * Processa a ação de um jogador comprar uma carta do baralho.
 * @param {object} message - O objeto da mensagem.
 * @param {object} session - A sessão do jogo.
 * @param {object} client - O cliente do WhatsApp.
 */
async function processarCompra(message, session, client) {
    const { gameState } = session;
    const playerId = message.author || message.from;
    const jogadorAtual = gameState.jogadores[gameState.jogadorDaVezIndex];

    if (jogadorAtual.id !== playerId) return message.reply("Calma, não é sua vez de comprar!");

    if (gameState.baralho.length === 0) {
        await reembaralharPilha(session, client);
    }
    
    const cartaComprada = gameState.baralho.pop();
    jogadorAtual.mao.push(cartaComprada);

    await client.sendMessage(session.groupId, `*${jogadorAtual.name}* comprou uma carta.`);

    if (!jogadorAtual.id.includes('@cpu.bot')) {
        const msgMao = formatarMaoParaMensagem(jogadorAtual.mao, gameState, [cartaComprada]);
        await client.sendMessage(jogadorAtual.id, msgMao);
    }
    await avancarTurno(session, client);
}

module.exports = { 
    prepararJogo, 
    iniciarPartida, 
    processarJogada,
    processarEscolhaDeCor,
    processarCompra
};