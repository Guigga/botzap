// C:\Users\Guilherme\bot-whatsapp\games\Truco\truco.js

const sessionManager = require('../../sessions/sessionManager');
const baralhoUtils = require('../baralhoUtils');
const trucoBot = require('./botPlayer');
const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const NAIPE_EMOJI = { 's': '♠️', 'h': '♥️', 'd': '♦️', 'c': '♣️' };
const ORDEM_FORCA_COMUM = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];
const ORDEM_FORCA_NAIPE_MANILHA = { 'd': 1, 's': 2, 'h': 3, 'c': 4 }; // Ouros, Espadas, Copas, Paus

// A ordem de força das cartas para determinar a manilha (vira '3', manilha é '4')
const ORDEM_MANILHAS = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

function getManilhaValor(vira) {
    const valorVira = vira[0];
    const indexVira = ORDEM_MANILHAS.indexOf(valorVira);
    // O operador de módulo (%) garante que se o vira for '3' (último), a manilha seja '4' (primeiro)
    const indexManilha = (indexVira + 1) % ORDEM_MANILHAS.length;
    return ORDEM_MANILHAS[indexManilha];
}

function formatarMaoParaMensagem(mao, manilhaValor) {
    // 1. Começa a mensagem de forma limpa
    let textoMao = 'Sua mão:\n\n';

    // 2. Adiciona a lista de cartas
    let temCarta = false;
    mao.forEach((carta, index) => {
        // Mostra apenas as cartas que não foram jogadas (não são nulas)
        if (carta) {
            temCarta = true;
            const valor = carta[0];
            const naipe = carta[1];
            textoMao += `${index + 1}. ${valor}${NAIPE_EMOJI[naipe]}\n`;
        }
    });
    
    // 3. Adiciona a informação da manilha
    textoMao += `\n*Manilha:* ${manilhaValor}\n\n`;

    if (!temCarta) {
        return 'Você não tem mais cartas para jogar.';
    }
    
    // 4. Adiciona as instruções no final, onde fazem mais sentido
    textoMao += '\nPara jogar, digite:\n`!carta <número>`\nou\n`!carta <número> hide` (para esconder)';
    
    return textoMao;
}

function getForcaCarta(carta, manilhaValor) {
    const valor = carta[0];
    const naipe = carta[1];

    // Se a carta for uma manilha
    if (valor === manilhaValor) {
        // As manilhas têm uma força base alta (100) + a força do seu naipe
        return 100 + ORDEM_FORCA_NAIPE_MANILHA[naipe];
    }

    // Se for uma carta comum, a força é sua posição na ordem de força
    return ORDEM_FORCA_COMUM.indexOf(valor);
}

function prepararJogo(session) {
    console.log(`[Truco] Preparando jogo para a sessão: ${session.groupId}`);
    session.gameState = {
        rodada: 1,
        placar: { time1: 0, time2: 0 },
        valorDaMao: 1,
        turnosGanhos: { time1: 0, time2: 0 },
        primeiroTurnoEmpatado: false,
        numeroDoTurno: 1,
        jogadores: session.players.map(p => ({ ...p, mao: [] })),
        baralho: [],
        vira: null,
        manilhaValor: null,
        cartasNaMesa: [],
        vezDoJogador: 0,
        status: 'aguardando_jogada',
        trucoState: null,
        actionLock: false,
        botActionId: null
    };
    session.status = 'em_jogo';
    console.log(`[Truco] Jogo preparado com ${session.gameState.jogadores.length} jogadores.`);
}

/**
 * Inicia uma nova rodada de Truco.
 * @param {object} session - A sessão do jogo.
 * @param {object} client - O cliente do WhatsApp.
 */
async function iniciarRodada(session, client) {
    console.log(`[Truco] Iniciando rodada para a sessão: ${session.groupId}`);
    const gameState = session.gameState;
    
    // 1. Gerar baralho de truco e o vira
    const baralho = baralhoUtils.gerarBaralhoTruco();
    const vira = baralho.pop(); // Pega a carta do topo para ser o vira
    gameState.vira = vira;
    gameState.baralho = baralho;

    // 2. Definir o valor da manilha
    gameState.manilhaValor = getManilhaValor(vira);
    console.log(`[Truco] Vira: ${vira} | Manilha: ${gameState.manilhaValor}`);
    
    // 3. Distribuir 3 cartas para cada jogador
    for (const jogador of gameState.jogadores) {
        jogador.mao = gameState.baralho.splice(0, 3);
    }
    
    // 4. Enviar a mão para cada jogador (de forma privada)
    for (const jogador of gameState.jogadores) {
        if (jogador.id === trucoBot.BOT_ID) {
            console.log(`[Truco] Mão do Bot ${jogador.name}: ${jogador.mao.join(', ')}`);
        } else {
            try {
                const imagePath = await baralhoUtils.gerarImagemCartas(jogador.mao);
                const textoMao = formatarMaoParaMensagem(jogador.mao, gameState.manilhaValor);

                if (imagePath) {
                    const media = MessageMedia.fromFilePath(imagePath);
                    // Envia a imagem COM o novo texto como legenda
                    await client.sendMessage(jogador.id, media, { caption: textoMao });
                    fs.unlinkSync(imagePath);
                } else {
                    // Fallback caso a imagem falhe: envia só o texto
                    await client.sendMessage(jogador.id, textoMao);
                }
            } catch (error) {
                console.error(`[Truco] Falha ao enviar mão para ${jogador.id}. Enviando como texto. Erro:`, error);
                await client.sendMessage(jogador.id, `Sua mão: ${jogador.mao.join(', ')}`);
            }
        }
    }
    
    // 5. Anunciar o vira e de quem é a vez no grupo
    const jogadorDaVez = gameState.jogadores[gameState.vezDoJogador];
    let viraImagePath;
    try {
        viraImagePath = await baralhoUtils.gerarImagemCartas([vira]);
        if(viraImagePath) {
            const media = MessageMedia.fromFilePath(viraImagePath);
            await client.sendMessage(session.groupId, media, { 
                caption: `*Rodada ${gameState.rodada} começando!* 🎴\n\nO *vira* é este. A manilha é *${gameState.manilhaValor}*.\n\nÉ a vez de *${jogadorDaVez.name}* jogar!`
            });
            fs.unlinkSync(viraImagePath);
        }
    } catch (error) {
        console.error('[Truco] Falha ao gerar imagem do vira. Enviando como texto. Erro:', error);
        await client.sendMessage(session.groupId, `*Rodada ${gameState.rodada} começando!* 🎴\n\nO *vira* é *${vira}*. A manilha é *${gameState.manilhaValor}*.\n\nÉ a vez de *${jogadorDaVez.name}* jogar!`);
    }

    // 6. Atualizar status e aguardar jogada
    gameState.status = 'aguardando_jogada';

    // 7. Se for a vez do bot, aciona sua jogada
    if (jogadorDaVez.id === trucoBot.BOT_ID) {
        await processarAcaoBot(session, client);
    } else {
        // CORREÇÃO: Se o primeiro a jogar for humano, libera a trava de ação.
        gameState.actionLock = false;
    }
}

async function finalizarMao(session, client) {
    console.log(`\n[DEBUG] --- Finalizando Mão #${session.gameState.rodada} ---`); // ADICIONE AQUI    
    const gameState = session.gameState;
    const { turnosGanhos, placar, valorDaMao } = gameState;

    let timeVencedor = null;
    if (turnosGanhos.time1 > turnosGanhos.time2) {
        timeVencedor = 'time1';
        placar.time1 += valorDaMao;
    } else if (turnosGanhos.time2 > turnosGanhos.time1) {
        timeVencedor = 'time2';
        placar.time2 += valorDaMao;
    }
    // Se empatar em turnos (ex: 1 a 1 e o último empata), ninguém pontua.

    let mensagemPlacar = `*Fim da mão!*`;
    if (timeVencedor) {
        const nomeTime = timeVencedor === 'time1' ? 'Time Blue 🔵' : 'Time Red 🔴';
        mensagemPlacar += `\n\n*${nomeTime}* venceu e marcou *${valorDaMao}* ponto(s).`;
    } else {
        mensagemPlacar += `\n\nA mão empatou! Ninguém marcou pontos.`;
    }
    mensagemPlacar += `\n\n*Placar:*\nTime Blue 🔵: *${placar.time1}* \nTime Red 🔴: *${placar.time2}*`;

    await client.sendMessage(session.groupId, mensagemPlacar);

    // Verifica se o jogo acabou
    if (placar.time1 >= 12 || placar.time2 >= 12) {
        const nomeTimeVencedor = placar.time1 >= 12 ? 'Time Blue 🔵' : 'Time Red 🔴';
        await client.sendMessage(session.groupId, `*O JOGO ACABOU!* 🏆\n\nParabéns ao *${nomeTimeVencedor}* pela vitória!`);
        sessionManager.endSession(session.groupId);
        return;
    }

    // Prepara para a próxima mão
    gameState.rodada++;
    gameState.numeroDoTurno = 1;
    gameState.valorDaMao = 1;
    gameState.turnosGanhos = { time1: 0, time2: 0 };
    gameState.primeiroTurnoEmpatado = false;
    gameState.cartasNaMesa = [];
    gameState.botActionId = null;
    gameState.vezDoJogador = (gameState.rodada - 1) % gameState.jogadores.length;

    await client.sendMessage(session.groupId, `--- Preparando a ${gameState.rodada}ª mão ---`);
    await iniciarRodada(session, client);
}

async function finalizarTurno(session, client) {
    const gameState = session.gameState;
    console.log(`\n[DEBUG] --- Finalizando Turno #${gameState.numeroDoTurno} ---`);
    console.log('[Truco] Finalizando turno. Cartas na mesa:', gameState.cartasNaMesa);

    let maiorForca = -1;
    let jogadaVencedora = null;

    for (const jogada of gameState.cartasNaMesa) {
        const forca = jogada.isHidden ? -1 : getForcaCarta(jogada.carta, gameState.manilhaValor);

        console.log(`[FORCA_DEBUG] Carta: ${jogada.carta}, Manilha: ${gameState.manilhaValor}, Força Calculada: ${forca}`);

        if (forca > maiorForca) {
            maiorForca = forca;
            jogadaVencedora = jogada;
        }
    }

    const vencedores = gameState.cartasNaMesa.filter(j => !j.isHidden && getForcaCarta(j.carta, gameState.manilhaValor) === maiorForca);
    let mensagemResultado = '';
    let aMaoAcabou = false;

    // --- NOVA LÓGICA DE EMPATE ---
    if (vencedores.length > 1) {
        mensagemResultado = 'O turno *empatou*!';
        // REGRA #1: Empate na primeira
        if (gameState.numeroDoTurno === 1) {
            gameState.primeiroTurnoEmpatado = true;
            mensagemResultado += '\nQuem vencer o próximo turno, leva a mão!';
        } else {
            // REGRA #2: Empate na segunda ou terceira -> Mão acaba.
            // O vencedor será quem ganhou o primeiro turno. A `finalizarMao` cuida disso.
            aMaoAcabou = true;
        }
    } 
    // --- LÓGICA DE VITÓRIA (sem empate no turno) ---
    else {
        const jogadorVencedor = gameState.jogadores.find(p => p.id === jogadaVencedora.jogadorId);
        const timeIndex = gameState.jogadores.findIndex(p => p.id === jogadorVencedor.id);
        const timeVencedorTurno = (timeIndex % 2 === 0) ? 'time1' : 'time2';
        gameState.turnosGanhos[timeVencedorTurno]++;
        console.log(`[DEBUG] Vencedor do turno: ${timeVencedorTurno}. Placar de turnos: T1=${gameState.turnosGanhos.time1}, T2=${gameState.turnosGanhos.time2}`);
        mensagemResultado = `*${jogadorVencedor.name}* (${timeVencedorTurno === 'time1' ? '🔵' : '🔴'}) venceu o turno!`;
    }
    
    await client.sendMessage(session.groupId, mensagemResultado);

    // --- VERIFICA SE A MÃO ACABOU (lógica mais robusta) ---
    const { turnosGanhos, numeroDoTurno, primeiroTurnoEmpatado } = gameState;
    const vitoriasTime1 = turnosGanhos.time1;
    const vitoriasTime2 = turnosGanhos.time2;

    if (aMaoAcabou || vitoriasTime1 === 2 || vitoriasTime2 === 2 || (primeiroTurnoEmpatado && numeroDoTurno === 2 && vitoriasTime1 !== vitoriasTime2) || numeroDoTurno === 3) {
        await finalizarMao(session, client);
        return;
    }

    // --- SE A MÃO NÃO ACABOU, PREPARA O PRÓXIMO TURNO ---
    gameState.numeroDoTurno++;
    gameState.cartasNaMesa = [];
    
    const proximoJogadorIndex = vencedores.length > 1
        ? gameState.vezDoJogador // Se empatou, quem abriu o turno abre o próximo
        : gameState.jogadores.findIndex(p => p.id === jogadaVencedora.jogadorId); // Se teve vencedor, ele abre
        
    gameState.vezDoJogador = proximoJogadorIndex;
    const proximoJogador = gameState.jogadores[proximoJogadorIndex];

    await client.sendMessage(session.groupId, `--- ${gameState.numeroDoTurno}º Turno ---\nÉ a vez de *${proximoJogador.name}* jogar.`);

    if (proximoJogador.id === trucoBot.BOT_ID) {
        await processarAcaoBot(session, client);
    } else {
        gameState.actionLock = false;
    }
}

async function _avancarJogo(session, client, jogadorAtualIndex) {
    const gameState = session.gameState;
    const totalJogadores = gameState.jogadores.length;

    if (gameState.cartasNaMesa.length === totalJogadores) {
        await finalizarTurno(session, client);
    } else {
        gameState.vezDoJogador = (jogadorAtualIndex + 1) % totalJogadores;
        const proximoJogador = gameState.jogadores[gameState.vezDoJogador];
        await client.sendMessage(session.groupId, `É a vez de *${proximoJogador.name}*!`);

        if (proximoJogador.id === trucoBot.BOT_ID) {
            // A trava é passada para o bot, que a liberará
            await processarAcaoBot(session, client);
        } else {
            // Se o próximo for humano, libera a trava agora
            gameState.actionLock = false;
        }
    }
}

async function jogarCarta(message, session, client, isInternalCall = false) { // Parâmetro adicionado
    const gameState = session.gameState;
    
    // Verificação modificada: só bloqueia se não for uma chamada interna
    if (gameState.actionLock && !isInternalCall) {
        return console.log('[Truco] Ação ignorada: Jogo está processando outra ação.');
    }
    gameState.actionLock = true;

    try {
        const { author, body } = message;
        const playerId = author || message.from;
        const jogadorAtualIndex = gameState.vezDoJogador;
        const jogador = gameState.jogadores[jogadorAtualIndex];

        if (gameState.status !== 'aguardando_jogada' || jogador.id !== playerId) {
            if (playerId !== trucoBot.BOT_ID) {
                message.reply("Calma, não é sua vez de jogar!");
            }
            gameState.actionLock = false;
            return;
        }

        const args = body.split(' ');
        const numeroCarta = parseInt(args[1]);

        if (isNaN(numeroCarta) || numeroCarta < 1 || numeroCarta > 3 || !jogador.mao[numeroCarta - 1]) {
            message.reply(`Carta inválida. Verifique os números disponíveis na sua mão.`);
            gameState.actionLock = false;
            return;
        }
        
        const isHidden = args[2]?.toLowerCase() === 'hide';
        const cartaJogada = jogador.mao[numeroCarta - 1];
        jogador.mao[numeroCarta - 1] = null;
        gameState.cartasNaMesa.push({ jogadorId: playerId, carta: cartaJogada, isHidden: isHidden });
        console.log(`[Truco] Jogador ${jogador.name} jogou ${cartaJogada}${isHidden ? ' (escondida)' : ''}`);

        if (isHidden) {
            await client.sendMessage(session.groupId, `*${jogador.name}* jogou uma carta virada para baixo. 🤫`);
        } else {
            const imagePath = await baralhoUtils.gerarImagemCartas([cartaJogada]);
            const media = MessageMedia.fromFilePath(imagePath);
            await client.sendMessage(session.groupId, media, { caption: `*${jogador.name}* jogou:` });
            fs.unlinkSync(imagePath);
        }

        if (jogador.id !== trucoBot.BOT_ID) {
            const maoRestante = jogador.mao.filter(c => c !== null);
            if (maoRestante.length > 0) {
                 const imagePathMao = await baralhoUtils.gerarImagemCartas(maoRestante);
                 const textoMao = formatarMaoParaMensagem(jogador.mao, gameState.manilhaValor);
                 const mediaMao = MessageMedia.fromFilePath(imagePathMao);
                 await client.sendMessage(jogador.id, mediaMao, { caption: textoMao });
                 fs.unlinkSync(imagePathMao);
            } else {
                 await client.sendMessage(jogador.id, "Você jogou sua última carta!");
            }
        }
        
        // A função _avancarJogo não é mais necessária, a lógica foi reincorporada aqui
        const totalJogadores = gameState.jogadores.length;
        if (gameState.cartasNaMesa.length === totalJogadores) {
            await finalizarTurno(session, client);
        } else {
            gameState.vezDoJogador = (jogadorAtualIndex + 1) % totalJogadores;
            const proximoJogador = gameState.jogadores[gameState.vezDoJogador];
            await client.sendMessage(session.groupId, `É a vez de *${proximoJogador.name}*!`);

            if (proximoJogador.id === trucoBot.BOT_ID) {
                await processarAcaoBot(session, client);
            } else {
                gameState.actionLock = false; // Libera trava se o próximo for humano
            }
        }

    } catch (error) {
        console.error("[Truco] Erro em jogarCarta:", error);
        gameState.actionLock = false;
    }
}

async function processarAcaoBot(session, client) {
    const gameState = session.gameState;
    const currentActionId = Date.now(); // 1. Gera um "carimbo" único para esta ordem.
    gameState.botActionId = currentActionId; // 2. Atualiza o estado com o carimbo mais recente.

    try {
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 3. VERIFICAÇÃO PRINCIPAL: A ordem ainda é válida?
        if (gameState.botActionId !== currentActionId) {
            console.log(`[Truco Bot] Ação obsoleta (ID: ${currentActionId}) foi ignorada.`);
            // A trava de ação (actionLock) será liberada pela nova ação que tornou esta obsoleta.
            return; 
        }

        const comandoBot = trucoBot.decideAction(session);
        if (!comandoBot) {
            gameState.actionLock = false;
            return;
        }

        console.log(`[Truco Bot] Processando comando do bot: "${comandoBot}"`);

        // NOVO: Objeto de mensagem falso mais completo
        const fakeMessage = {
            author: trucoBot.BOT_ID,
            body: comandoBot,
            reply: (text) => { // Garante que a função reply sempre exista
                console.log(`[Truco Bot] Tentou usar .reply com a mensagem: ${text}`);
                // Não enviamos a mensagem, apenas registramos no log, pois é uma ação interna.
            }
        };

        const command = comandoBot.split(' ')[0].toLowerCase();
        
        if (command === '!carta') {
            await jogarCarta(fakeMessage, session, client, true);
        } else if (command === '!aceitar') {
            await aceitarTruco(fakeMessage, session, client);
        } else if (command === '!correr') { // <-- ADICIONE ESTE BLOCO
            await correrDoTruco(fakeMessage, session, client);
        }
    } catch (error) {
        console.error("[Truco] Erro ao processar ação do bot:", error);
        gameState.actionLock = false;
    }
}

async function pedirTruco(message, session, client) {
    const { author } = message;
    const gameState = session.gameState;

    if (gameState.status !== 'aguardando_jogada') return;
    if (gameState.valorDaMao > 1) {
        return message.reply("Opa, alguém já pediu truco ou mais!");
    }

    const playerIndex = gameState.jogadores.findIndex(p => p.id === author);
    const callingTeam = (playerIndex % 2 === 0) ? 'time1' : 'time2';
    const opponentTeam = (playerIndex % 2 === 0) ? 'time2' : 'time1';

    gameState.status = 'aguardando_resposta_truco';
    gameState.valorDaMao = 3;
    gameState.trucoState = { challengedBy: callingTeam, pendingResponseFrom: opponentTeam };
    
    const opponentTeamName = opponentTeam === 'time1' ? 'Time Blue 🔵' : 'Time Red 🔴';
    await client.sendMessage(session.groupId, `🗣️ *TRUCO!!!* \nA mão agora vale *3 pontos*! \n\nO ${opponentTeamName} deve responder com \`!aceitar\`, \`!correr\` ou \`!pede6\`.`);

    // --- CORREÇÃO ADICIONADA AQUI ---
    // Após pedir truco, verifica se o bot precisa responder
    const botIndex = gameState.jogadores.findIndex(p => p.id === trucoBot.BOT_ID);
    if (botIndex !== -1) {
        const botTeam = (botIndex % 2 === 0) ? 'time1' : 'time2';
        if (botTeam === opponentTeam) {
            console.log(`[Truco] Bot foi desafiado pelo TRUCO. Acionando sua resposta...`);
            await processarAcaoBot(session, client);
        }
    }
}

async function aceitarTruco(message, session, client) {
    const { author } = message;
    const gameState = session.gameState;

    if (gameState.status !== 'aguardando_resposta_truco') return;

    const playerIndex = gameState.jogadores.findIndex(p => p.id === author);
    const playerTeam = (playerIndex % 2 === 0) ? 'time1' : 'time2';

    if (playerTeam !== gameState.trucoState.pendingResponseFrom) {
        return message.reply("Calma, não é seu time que responde!");
    }

    gameState.status = 'aguardando_jogada';
    gameState.trucoState = null;

    const jogadorDaVez = gameState.jogadores[gameState.vezDoJogador];
    await client.sendMessage(session.groupId, `✅ A aposta foi aceita! O jogo continua valendo *${gameState.valorDaMao}* pontos. \n\nÉ a vez de *${jogadorDaVez.name}* jogar.`);

    if (jogadorDaVez.id === trucoBot.BOT_ID) {
        await processarAcaoBot(session, client);
    } else {
        // Se o próximo jogador for humano, libera a trava.
        gameState.actionLock = false;
    }
}

async function correrDoTruco(message, session, client) {
    const { author } = message;
    const gameState = session.gameState;
    
    if (gameState.status !== 'aguardando_resposta_truco') return;
    
    const playerIndex = gameState.jogadores.findIndex(p => p.id === author);
    const playerTeam = (playerIndex % 2 === 0) ? 'time1' : 'time2';

    if (playerTeam !== gameState.trucoState.pendingResponseFrom) return;

    const valorCorrido = gameState.valorDaMao === 3 ? 1 : (gameState.valorDaMao / 2);
    const timeVencedor = gameState.trucoState.challengedBy;
    
    gameState.placar[timeVencedor] += valorCorrido;

    await client.sendMessage(session.groupId, `O time ${playerTeam === 'time1' ? 'Blue' : 'Red'} correu! 🏃‍♂️`);
    await finalizarMao(session, client); // Reutiliza a função de fim de mão para mostrar placar e reiniciar
}

async function aumentarAposta(message, session, client) {
    const { author, body } = message;
    const command = body.split(' ')[0].toLowerCase();
    const gameState = session.gameState;

    if (gameState.status !== 'aguardando_resposta_truco') return;
    
    const apostas = { '!pede6': 6, '!pede9': 9, '!pede12': 12 };
    const novoValor = apostas[command];

    if (!novoValor || novoValor <= gameState.valorDaMao) {
        return message.reply("Aposta inválida!");
    }

    const playerIndex = gameState.jogadores.findIndex(p => p.id === author);
    const playerTeam = (playerIndex % 2 === 0) ? 'time1' : 'time2';
    
    if (playerTeam !== gameState.trucoState.pendingResponseFrom) return;

    // Inverte os papéis
    const newOpponentTeam = gameState.trucoState.challengedBy;
    gameState.valorDaMao = novoValor;
    gameState.trucoState = { challengedBy: playerTeam, pendingResponseFrom: newOpponentTeam };
    
    const opponentTeamName = newOpponentTeam === 'time1' ? 'Time Blue 🔵' : 'Time Red 🔴';
    await client.sendMessage(session.groupId, `CHAMOU PRA BRIGA! A aposta subiu para *${novoValor} PONTOS*! 💥\n\nE agora, ${opponentTeamName}? \`!aceitar\` ou \`!correr\`?`);

    // --- CORREÇÃO ADICIONADA AQUI ---
    // Após aumentar a aposta, verifica se o bot precisa responder
    const botIndex = gameState.jogadores.findIndex(p => p.id === trucoBot.BOT_ID);
    if (botIndex !== -1) {
        const botTeam = (botIndex % 2 === 0) ? 'time1' : 'time2';
        if (botTeam === newOpponentTeam) {
            console.log(`[Truco] Bot foi desafiado pelo AUMENTO. Acionando sua resposta...`);
            await processarAcaoBot(session, client);
        }
    }
}


module.exports = {
    prepararJogo,
    iniciarRodada,
    jogarCarta,
    pedirTruco,
    aceitarTruco,
    correrDoTruco,
    aumentarAposta
};
