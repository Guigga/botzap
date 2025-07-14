// games/Uno/uno.js

const { renderizarMao, renderizarCartaUnica } = require('./imageRendererUno');
const { MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const sessionManager = require('../../sessions/sessionManager');
const { gerarBaralhoUno } = require('./baralhoUno');
const botPlayer = require('./botPlayer'); // Importamos o bot

// games/Uno/uno.js

function formatarMaoJogador(mao, gameState, cartasCompradas = []) {
    const corEmoji = { 'vermelho': '🟥', 'amarelo': '🟨', 'verde': '🟩', 'azul': '🟦', 'preto': '🎨' };
    let textoFinal = '*Sua mão atual:*\n';

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
    
    if (gameState && gameState.comprouNestaRodada) {
        textoFinal += '\nSe não puder jogar, use `!passar`.';
    }

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
        // Propriedade nova para controlar o acúmulo de +2 e +4
        efeitoAcumulado: { tipo: null, quantidade: 0 },
        // Propriedade nova para a regra de compra voluntária
        comprouNestaRodada: false,
        disseUno: new Set()
    };
    console.log(`[UNO] Jogo preparado para ${session.groupId}`);
}

// --- FUNÇÃO DE INÍCIO (já tínhamos) ---
async function iniciarPartida(session, client) {
    const { gameState } = session;

    // 1. Distribui 7 cartas para cada jogador
    for (let i = 0; i < 7; i++) {
        for (const jogador of gameState.jogadores) {
            if (gameState.baralho.length === 0) break;
            jogador.mao.push(gameState.baralho.pop());
        }
    }

    // 2. Vira a primeira carta ANTES de enviar as mãos
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

    // 3. Envia a mão inicial para cada jogador, agora com o gameState completo
    for (const jogador of gameState.jogadores) {
        if (jogador.id.includes('@cpu.bot')) {
            console.log(`[UNO] Mão do Bot ${jogador.name}:`, jogador.mao.map(c => `${c.cor} ${c.valor}`).join(', '));
        } else {
            await enviarMaoGrafica(jogador, client);
        }
    }

    // 4. Monta o anúncio inicial com a IMAGEM da primeira carta
    try {
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        const tempCardPath = path.join(tempDir, `initial_card_${Date.now()}.png`);

        await renderizarCartaUnica(primeiraCarta, tempCardPath);
        const media = MessageMedia.fromFilePath(tempCardPath);
        
        const legendaAnuncio = `*O jogo de UNO começou!* 🃏\n\nA primeira carta na mesa é:`;
        await client.sendMessage(session.groupId, media, { caption: legendaAnuncio });
        fs.unlinkSync(tempCardPath);

    } catch (error) {
        console.error('[UNO] Falha ao renderizar carta inicial, usando fallback de texto.', error);
        const corEmoji = { 'vermelho': '🟥', 'amarelo': '🟨', 'verde': '🟩', 'azul': '🟦', 'preto': '🎨' };
        await client.sendMessage(session.groupId, `*O jogo de UNO começou!* 🃏\n\nA primeira carta na mesa é: *${corEmoji[gameState.corAtual]} ${gameState.cartaAtual.valor}*`);
    }

    // 5. Anuncia os EFEITOS da primeira carta e o próximo jogador
    let anuncioEfeitos = '';
    const jogadorInicial = gameState.jogadores[gameState.jogadorDaVezIndex];

    switch (primeiraCarta.valor) {
        case 'pular':
            gameState.jogadorDaVezIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
            anuncioEfeitos += `*${jogadorInicial.name}* foi pulado!\n`;
            break;
        case 'reverso':
            gameState.sentido *= -1;
            // Com o sentido invertido, o próximo jogador é o anterior na lista (ou o último se for o primeiro a jogar)
            gameState.jogadorDaVezIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
            anuncioEfeitos += `O sentido do jogo foi invertido!\n`;
            break;
        case '+2':
            anuncioEfeitos += `*${jogadorInicial.name}* compra 2 cartas e perde a vez!\n`;
            // A lógica de compra de cartas já está aqui e não precisa mudar.
            const cartasCompradas = [];
            for (let i = 0; i < 2; i++) {
                if (gameState.baralho.length === 0) await reembaralharPilha(session, client);
                const carta = gameState.baralho.pop();
                jogadorInicial.mao.push(carta);
                cartasCompradas.push(carta);
            }
            if (!jogadorInicial.id.includes('@cpu.bot')) {
                await enviarMaoGrafica(jogadorInicial, client, `O jogo começou e você já comprou 2 cartas!`);
            }
            gameState.jogadorDaVezIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
            break;
        case 'curinga':
            if (jogadorInicial.id.includes('@cpu.bot')) {
                const cores = ['vermelho', 'amarelo', 'verde', 'azul'];
                gameState.corAtual = cores[Math.floor(Math.random() * cores.length)];
                anuncioEfeitos += `*${jogadorInicial.name}* (BOT) escolheu a cor *${gameState.corAtual.toUpperCase()}*!\n`;
            } else {
                session.status = 'aguardando_escolha_cor';
                const anuncioCor = `*${jogadorInicial.name}*, você começa! Use \`!cor <vermelho|azul|verde|amarelo>\` para escolher a cor.`;
                await client.sendMessage(session.groupId, anuncioCor);
                return; // Encerra a função aqui, pois aguarda a escolha do jogador
            }
            break;
    }

    const jogadorDaVez = gameState.jogadores[gameState.jogadorDaVezIndex];
    anuncioEfeitos += `É a vez de *${jogadorDaVez.name}* jogar.`;
    await client.sendMessage(session.groupId, anuncioEfeitos);

    // Notifica o jogador da vez no privado
    const dummyDealer = { name: "Dealer" };
    await notificarVezDoJogador(session, client, jogadorDaVez, dummyDealer);

    // Dispara a ação do bot se for a vez dele
    if (jogadorDaVez.id.includes('@cpu.bot')) {
        await dispararAcaoBot(session, client);
    }

    if (jogadorDaVez.id.includes('@cpu.bot')) {
        await dispararAcaoBot(session, client);
    }
}

// --- NOVAS FUNÇÕES ---

async function processarJogada(message, session, client) {
    const { gameState } = session;
    const playerId = message.author || message.from;
    const jogadorAtual = gameState.jogadores[gameState.jogadorDaVezIndex];

    // Validações de turno e carta (aqui não muda)
    if (!jogadorAtual || jogadorAtual.id !== playerId) {
        if (!playerId.includes('@cpu.bot')) { return message.reply("Opa, não é a sua vez de jogar!"); }
        return;
    }
    const commandArgs = message.body.trim().split(/\s+/);
    const numeroCarta = parseInt(commandArgs[1]);
    if (isNaN(numeroCarta) || numeroCarta < 1 || numeroCarta > jogadorAtual.mao.length) {
        if (!playerId.includes('@cpu.bot')) { return message.reply(`Número de carta inválido.`); }
        return;
    }
    const indexCarta = numeroCarta - 1;
    const cartaJogada = jogadorAtual.mao[indexCarta];

    // --- NOVA LÓGICA DE VALIDAÇÃO (COM REGRA DE ACÚMULO) ---
    const { efeitoAcumulado } = gameState;
    if (efeitoAcumulado.quantidade > 0) {
        // Se há um efeito, o jogador SÓ pode responder com uma carta de mesmo valor
        if (cartaJogada.valor !== efeitoAcumulado.tipo) {
            return message.reply(`Você deve responder com uma carta *${efeitoAcumulado.tipo}* ou usar \`!comprar\`.`);
        }
    } else {
        // Validação normal, se não houver efeito
        const podeJogar = cartaJogada.cor === 'preto' || cartaJogada.cor === gameState.corAtual || cartaJogada.valor === gameState.cartaAtual.valor;
        if (!podeJogar) {
            if (!playerId.includes('@cpu.bot')) { return message.reply(`Jogada inválida!`); }
            return;
        }
    }
    
    // Lógica de Coringa (aqui não muda)
    if (cartaJogada.cor === 'preto') {
        const corEscolhida = commandArgs[2]?.toLowerCase();
        const coresValidas = ['vermelho', 'amarelo', 'verde', 'azul'];
        if (!corEscolhida || !coresValidas.includes(corEscolhida)) {
            return message.reply(`Essa é uma carta coringa! Use: \`!jogar ${numeroCarta} <cor>\``);
        }
        gameState.corAtual = corEscolhida;
    } else {
        gameState.corAtual = cartaJogada.cor;
    }

    // --- Execução da Jogada e Anúncio (aqui não muda) ---
    jogadorAtual.mao.splice(indexCarta, 1);
    gameState.pilhaDescarte.push(cartaJogada);
    gameState.cartaAtual = cartaJogada;

    // NOVO: Anúncio da jogada com imagem
    try {
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
        const tempCardPath = path.join(tempDir, `played_card_${Date.now()}.png`);

        await renderizarCartaUnica(cartaJogada, tempCardPath);
        const media = MessageMedia.fromFilePath(tempCardPath);

        let legendaAnuncio = `*${jogadorAtual.name}* jogou:`;
        if (cartaJogada.cor === 'preto') {
            legendaAnuncio += `\nE escolheu a cor *${gameState.corAtual.toUpperCase()}*!`;
        }

        await client.sendMessage(session.groupId, media, { caption: legendaAnuncio });
        fs.unlinkSync(tempCardPath); // Apaga a imagem temporária

    } catch (error) {
        console.error('[UNO] Falha ao anunciar jogada com imagem, usando fallback de texto.', error);
        const corEmoji = { 'vermelho': '🟥', 'amarelo': '🟨', 'verde': '🟩', 'azul': '🟦', 'preto': '🎨' };
        let anuncioJogada = `*${jogadorAtual.name}* jogou: *${corEmoji[cartaJogada.cor]} ${cartaJogada.valor}*`;
        if (cartaJogada.cor === 'preto') {
            anuncioJogada += ` e escolheu a cor *${gameState.corAtual.toUpperCase()}*!`;
        }
        await client.sendMessage(session.groupId, anuncioJogada);
    }

// Envia a mão atualizada para o jogador no privado (lógica inalterada)
if (!jogadorAtual.id.includes('@cpu.bot')) {
    await enviarMaoGrafica(jogadorAtual, client, `Você jogou a carta. Esta é sua nova mão:`);
}

    // Verificação de vitória e UNO
    if (jogadorAtual.mao.length === 0) {
        await client.sendMessage(session.groupId, `*FIM DE JOGO!* 🏆\n*${jogadorAtual.name}* venceu a partida!`);
        sessionManager.endSession(session.groupId);
        return;
    }
    // Adiciona a verificação e o anúncio automático de UNO
    if (jogadorAtual.mao.length === 1 && !gameState.disseUno.has(playerId)) {
        await client.sendMessage(session.groupId, `UNO! 🗣️\n*${jogadorAtual.name}* tem apenas uma carta!`);
        gameState.disseUno.add(playerId);
    }


    // --- APLICAÇÃO DE EFEITOS (COM REGRA DE REVERSO PARA 2 JOGADORES) ---
    if (cartaJogada.valor === 'reverso') {
        // Apenas inverte o sentido se houver mais de 2 jogadores
        if (gameState.jogadores.length > 2) {
            gameState.sentido *= -1;
            await client.sendMessage(session.groupId, 'O sentido do jogo foi invertido!');
        }
    }
    
    // Se a carta for +2 ou +4, ACUMULA o efeito
    if (cartaJogada.valor === '+2' || cartaJogada.valor === '+4') {
        const eraAcumulado = gameState.efeitoAcumulado.quantidade > 0;
        gameState.efeitoAcumulado.tipo = cartaJogada.valor;
        gameState.efeitoAcumulado.quantidade += (cartaJogada.valor === '+2' ? 2 : 4);
        if (eraAcumulado) {
            await client.sendMessage(session.groupId, `💥 Efeito acumulado! Próximo jogador deve comprar *${gameState.efeitoAcumulado.quantidade}* ou responder com outra carta *${cartaJogada.valor}*!`);
        }
    }

    // Define se a próxima jogada deve pular um turno.
    // Isso acontece se a carta for 'pular' OU se for 'reverso' com apenas 2 jogadores.
    const devePular = cartaJogada.valor === 'pular' || (cartaJogada.valor === 'reverso' && gameState.jogadores.length === 2);
    
    // Chama a função de avançar o turno, informando se deve pular ou não.
    await avancarTurno(session, client, devePular);
}

async function notificarVezDoJogador(session, client, jogadorDaVez, jogadorAnterior) {
    if (jogadorDaVez.id.includes('@cpu.bot')) return;

    const { gameState } = session;
    const corEmoji = { 'vermelho': '🟥', 'amarelo': '🟨', 'verde': '🟩', 'azul': '🟦', 'preto': '🎨' };
    const sentidoEmoji = gameState.sentido === 1 ? '➡️' : '⬅️';
    
    let notificacao = `Na mesa: *${corEmoji[gameState.corAtual]} ${gameState.cartaAtual.valor}* (${jogadorAnterior.name}) ${sentidoEmoji}\n` +
                      `*Sua vez!*`;

    // Avisa sobre um efeito acumulado
    if (gameState.efeitoAcumulado.quantidade > 0) {
        notificacao += `\n\n*ATENÇÃO!* Você deve jogar uma carta *${gameState.efeitoAcumulado.tipo}* ou usar \`!comprar\` para pegar *${gameState.efeitoAcumulado.quantidade}* cartas.`;
    }
    
    let commandLine = `\`!jogar <número>\` | \`!comprar\``;
    // Mostra a opção de passar apenas se o jogador já comprou
    if (gameState.comprouNestaRodada) {
        commandLine += ` | \`!passar\``;
    }
    notificacao += `\n---\n${commandLine}`;
    
    await client.sendMessage(jogadorDaVez.id, notificacao);
}

async function avancarTurno(session, client, pularProximo = false) {
    const { gameState } = session;
    const jogadorAnterior = gameState.jogadores[gameState.jogadorDaVezIndex];

    gameState.comprouNestaRodada = false;

    let proximoIndex = (gameState.jogadorDaVezIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;

    // Se a jogada anterior exige um pulo, avança mais uma vez
    if (pularProximo) {
        const jogadorPulado = gameState.jogadores[proximoIndex];
        console.log(`[UNO] Ação pulou o turno de ${jogadorPulado.name}`);
        proximoIndex = (proximoIndex + gameState.sentido + gameState.jogadores.length) % gameState.jogadores.length;
    }

    gameState.jogadorDaVezIndex = proximoIndex;
    
    const jogadorDaVez = gameState.jogadores[gameState.jogadorDaVezIndex];
    
    await client.sendMessage(session.groupId, `É a vez de *${jogadorDaVez.name}*.`);
    await notificarVezDoJogador(session, client, jogadorDaVez, jogadorAnterior);

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
    const msgGrupo = `*${jogadorAtual.name}* escolheu a cor *${corEmoji[corEscolhida]} ${corEscolhida.toUpperCase()}*!`;
    await client.sendMessage(session.groupId, msgGrupo);

    // <<< MENSAGEM DE FEEDBACK ADICIONADA >>>
    // Envia a confirmação também no privado do jogador.
    if (!jogadorAtual.id.includes('@cpu.bot')) {
        await client.sendMessage(jogadorAtual.id, `✅ Cor definida para *${corEscolhida.toUpperCase()}*!`);
    }

    gameState.disseUno.delete(playerId);

    const ultimaCarta = gameState.cartaAtual;
    const devePular = cartaJogada.valor === 'pular';
    await avancarTurno(session, client, devePular);
}

async function processarCompra(message, session, client) {
    const { gameState } = session;
    const playerId = message.author || message.from;
    const jogadorAtual = gameState.jogadores[gameState.jogadorDaVezIndex];

    if (jogadorAtual.id !== playerId) return;

    // Se existe um efeito acumulado, a compra é FORÇADA
    if (gameState.efeitoAcumulado.quantidade > 0) {
        const { quantidade, tipo } = gameState.efeitoAcumulado;
        const cartasCompradas = [];

        await client.sendMessage(session.groupId, `*${jogadorAtual.name}* não tinha uma carta *${tipo}* e comprou *${quantidade}* cartas!`);
        for (let i = 0; i < quantidade; i++) {
            if (gameState.baralho.length === 0) await reembaralharPilha(session, client);
            const carta = gameState.baralho.pop();
            jogadorAtual.mao.push(carta);
            cartasCompradas.push(carta);
        }
        
        if (!jogadorAtual.id.includes('@cpu.bot')) {
            const legenda = `Você comprou ${cartasCompradas.length} cartas. Esta é sua nova mão:`;
            await enviarMaoGrafica(jogadorAtual, client, legenda);
        }

        // Zera o efeito e passa a vez (jogador que compra perde a vez)
        gameState.efeitoAcumulado = { tipo: null, quantidade: 0 };
        await avancarTurno(session, client);

    } else { // Se não, a compra é VOLUNTÁRIA
        if (gameState.comprouNestaRodada) {
            return message.reply("Você já comprou uma carta nesta rodada.");
        }
        if (gameState.baralho.length === 0) await reembaralharPilha(session, client);
        
        const cartaComprada = gameState.baralho.pop();
        jogadorAtual.mao.push(cartaComprada);
        gameState.comprouNestaRodada = true;
        gameState.disseUno.delete(playerId);

        await client.sendMessage(session.groupId, `*${jogadorAtual.name}* comprou uma carta.`);

        if (jogadorAtual.id.includes('@cpu.bot')) {
            // O bot verifica se a carta comprada pode ser jogada
            const podeJogar = cartaComprada.cor === 'preto' || cartaComprada.cor === gameState.corAtual || cartaComprada.valor === gameState.cartaAtual.valor;
            
            await new Promise(resolve => setTimeout(resolve, 1500)); // Pequena pausa para o bot "pensar"

            if (podeJogar) {
                const numeroDaCarta = jogadorAtual.mao.length; // A carta comprada é sempre a última
                
                let comandoBot = `!jogar ${numeroDaCarta}`;
                // Se a carta for coringa, o bot escolhe uma cor
                if (cartaComprada.cor === 'preto') {
                    const cores = ['vermelho', 'amarelo', 'verde', 'azul'];
                    const corAleatoria = cores[Math.floor(Math.random() * cores.length)];
                    comandoBot += ` ${corAleatoria}`;
                }
                
                const fakeMessageJogar = { author: playerId, body: comandoBot, reply: () => {} };
                await processarJogada(fakeMessageJogar, session, client);

            } else {
                // Se não pode jogar a carta, o bot agora sabe que deve passar a vez
                console.log(`[UnoBot] Carta comprada (${cartaComprada.cor} ${cartaComprada.valor}) não é jogável. O bot vai passar a vez.`);
                const fakeMessagePassar = { author: playerId, body: '!passar', reply: () => {} };
                await processarPasse(fakeMessagePassar, session, client);
            }
        } else { // Jogador humano
            const legenda = `Você comprou uma carta. Esta é sua nova mão:`;
            await enviarMaoGrafica(jogadorAtual, client, legenda);

            // --- INÍCIO DA ALTERAÇÃO ---
            // Envia a notificação de ação logo em seguida.
            const notificacaoAcao = `*Sua vez!*\n---\n\`!jogar <número>\` | \`!passar\``;
            await client.sendMessage(jogadorAtual.id, notificacaoAcao);
            // --- FIM DA ALTERAÇÃO ---
        }
    }
}

async function processarPasse(message, session, client) {
    const { gameState } = session;
    const playerId = message.author || message.from;
    const jogadorAtual = gameState.jogadores[gameState.jogadorDaVezIndex];

    // Valida se é o jogador correto
    if (!jogadorAtual || jogadorAtual.id !== playerId) {
        return message.reply("Opa, não é a sua vez de jogar!");
    }

    // Valida se o jogador comprou uma carta nesta rodada para poder passar
    if (!gameState.comprouNestaRodada) {
        return message.reply("Você só pode passar a vez depois de ter comprado uma carta.");
    }

    // Se a validação passar, anuncia e avança o turno
    await client.sendMessage(session.groupId, `*${jogadorAtual.name}* passou a vez.`);
    await avancarTurno(session, client);
}

async function enviarMaoGrafica(jogador, client, legenda = '') {
    if (jogador.id.includes('@cpu.bot')) {
        // Não envia imagem para o bot, apenas loga no console
        console.log(`[UNO] Mão do Bot ${jogador.name}:`, jogador.mao.map(c => `${c.cor} ${c.valor}`).join(', '));
        return;
    }

    // Define um caminho único para a imagem de cada jogador
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const outputPath = path.join(tempDir, `${jogador.id}.png`);

    try {
        // Chama a função de renderização
        const imagePath = await renderizarMao(jogador.mao, outputPath);

        if (imagePath) {
            const media = MessageMedia.fromFilePath(imagePath);
            await client.sendMessage(jogador.id, media, { caption: legenda || 'Sua mão atual:' });

            // Apaga a imagem temporária após o envio
            fs.unlinkSync(imagePath);
        } else if (jogador.mao.length === 0) {
             await client.sendMessage(jogador.id, 'Você não tem mais cartas!');
        }
    } catch (error) {
        console.error('[UNO] Erro ao renderizar ou enviar imagem da mão:', error);
        // Fallback: se a imagem falhar, envia a versão em texto
        await client.sendMessage(jogador.id, formatarMaoJogador(jogador.mao, null));
    }
}

module.exports = { 
    prepararJogo, 
    iniciarPartida, 
    processarJogada,
    processarEscolhaDeCor,
    processarCompra,
    processarPasse
};