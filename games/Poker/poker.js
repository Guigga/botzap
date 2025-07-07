// C:\Users\Guilherme\bot-whatsapp\games\Poker\poker.js

const { MessageMedia } = require('whatsapp-web.js'); 
const { gerarBaralho, gerarImagemCartas } = require('../baralhoUtils');
const { avaliarMaos } = require('./avaliadorPoker');
const chipManager = require('../../economy/chipManager');
const sessionManager = require('../../sessions/sessionManager');
const { getFormattedId } = require('./pokerValidators');
const botPlayer = require('./botPlayer');

// --- CONSTANTES ---
const INITIAL_SMALL_BLIND = 50;
const INITIAL_BIG_BLIND = 100;
const BLIND_INCREASE_ROUNDS = 3;

// --- FUNÇÕES DE LÓGICA PRINCIPAL ---

function formatarCartasArray(cartas) {
    const valorMap = { 'T': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A' };
    const naipeMap = { 's': '♠️', 'h': '♥️', 'd': '♦️', 'c': '♣️' };
    if (!Array.isArray(cartas) || cartas.length === 0) return [];
    return cartas.map(carta => {
        if (!carta || carta.length !== 2) return '??';
        const valor = valorMap[carta[0]] || carta[0];
        const naipe = naipeMap[carta[1]] || '?';
        return `${valor}${naipe}`;
    });
}


function initializeGameState(session) {
    session.gameState = {
        deck: [],
        mesa: [],
        etapa: 'inicio',
        ativos: [],
        maosPrivadas: {},
        iniciou: false,
        dealer: null,
        sb: null,
        bb: null,
        currentPlayerIndex: 0,
        apostaAtual: 0,
        pote: 0,
        smallBlindValue: INITIAL_SMALL_BLIND,
        bigBlindValue: INITIAL_BIG_BLIND,
        roundCounter: 0,
        apostasRodada: {},
        ultimoApostador: null,
        numRaises: 0,
        playersWhoActed: new Set(),
        minRaiseAmount: 0,
        playersAllIn: new Set(),
    };
}

async function iniciarRodada(session, client) {
    if (!session.gameState) {
        initializeGameState(session);
    }
    if (session.players.length < 2) {
        session.gameState.iniciou = false;
        return;
    }

    session.gameState.roundCounter++;
    await enviarMensagemPreRodada(session, client);
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (session.gameState.roundCounter > 1 && session.gameState.roundCounter % BLIND_INCREASE_ROUNDS === 0) {
        session.gameState.smallBlindValue *= 2;
        session.gameState.bigBlindValue *= 2;
        await client.sendMessage(session.groupId, `🚨 Atenção! Os blinds aumentaram para SB: ${session.gameState.smallBlindValue}, BB: ${session.gameState.bigBlindValue}!`);
    }

    session.gameState.deck = gerarBaralho();
    session.gameState.mesa = [];
    session.gameState.etapa = 'pre-flop';
    session.gameState.ativos = session.players.filter(p => chipManager.getPlayerChips(p.id) > 0).map(p => p.id);

    if (session.gameState.ativos.length < 2) {
        await client.sendMessage(session.groupId, 'Não há jogadores suficientes com fichas para iniciar uma nova rodada. Jogo encerrado!');
        sessionManager.endSession(session.groupId);
        return;
    }

    session.gameState.maosPrivadas = {};
    session.gameState.apostaAtual = 0;
    session.gameState.pote = 0;
    session.gameState.apostasRodada = {};
    session.gameState.ultimoApostador = null;
    session.gameState.numRaises = 0;
    session.gameState.playersWhoActed = new Set();
    session.gameState.minRaiseAmount = session.gameState.bigBlindValue;
    session.gameState.playersAllIn = new Set();

    const currentActivePlayerIds = session.gameState.ativos;
    if (!session.gameState.dealer || !currentActivePlayerIds.includes(session.gameState.dealer)) {
        session.gameState.dealer = currentActivePlayerIds[0];
    } else {
        const currentIdx = currentActivePlayerIds.indexOf(session.gameState.dealer);
        session.gameState.dealer = currentActivePlayerIds[(currentIdx + 1) % currentActivePlayerIds.length];
    }
    const dealerIdx = currentActivePlayerIds.indexOf(session.gameState.dealer);
    
    // Lógica de Posição Corrigida
    if (currentActivePlayerIds.length === 2) {
        session.gameState.sb = currentActivePlayerIds[dealerIdx];
        session.gameState.bb = currentActivePlayerIds[(dealerIdx + 1) % currentActivePlayerIds.length];
        session.gameState.currentPlayerIndex = dealerIdx;
    } else {
        session.gameState.sb = currentActivePlayerIds[(dealerIdx + 1) % currentActivePlayerIds.length];
        session.gameState.bb = currentActivePlayerIds[(dealerIdx + 2) % currentActivePlayerIds.length];
        const bbIndex = currentActivePlayerIds.indexOf(session.gameState.bb);
        session.gameState.currentPlayerIndex = (bbIndex + 1) % currentActivePlayerIds.length;
    }
    
    // Pagamento dos blinds... (continua igual)
    const sbPlayerId = session.gameState.sb;
    const bbPlayerId = session.gameState.bb;
    const sbChips = chipManager.getPlayerChips(sbPlayerId);
    const bbChips = chipManager.getPlayerChips(bbPlayerId);
    const actualSBbet = Math.min(sbChips, session.gameState.smallBlindValue);
    const actualBBbet = Math.min(bbChips, session.gameState.bigBlindValue);

    if (actualSBbet > 0) {
        chipManager.deductChips(sbPlayerId, actualSBbet);
        session.gameState.pote += actualSBbet;
        session.gameState.apostasRodada[sbPlayerId] = actualSBbet;
        // session.gameState.playersWhoActed.add(sbPlayerId); // <--- REMOVA ESTA LINHA
        if (sbChips <= session.gameState.smallBlindValue) session.gameState.playersAllIn.add(sbPlayerId);
    }
    if (actualBBbet > 0) {
        chipManager.deductChips(bbPlayerId, actualBBbet);
        session.gameState.pote += actualBBbet;
        session.gameState.apostasRodada[bbPlayerId] = actualBBbet;
        // A aposta atual é definida, mas o BB ainda não "agiu" voluntariamente
        session.gameState.apostaAtual = actualBBbet;
        // session.gameState.playersWhoActed.add(bbPlayerId); // <--- ESSA LÓGICA NÃO EXISTIA AQUI, MAS GARANTA QUE NÃO ESTEJA
        if (bbChips <= session.gameState.bigBlindValue) session.gameState.playersAllIn.add(bbPlayerId);
    }

    await enviarMensagemDeEtapa(session, client);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    for (const jogadorId of session.gameState.ativos) {
        const cartas = [session.gameState.deck.pop(), session.gameState.deck.pop()];
        session.gameState.maosPrivadas[jogadorId] = cartas;

        if (jogadorId !== botPlayer.BOT_ID) {
            const imagePath = await gerarImagemCartas(cartas);
            if (imagePath) {
                const media = MessageMedia.fromFilePath(imagePath); // <--- CORRIGIDO
                const comandos = getComandosDisponiveis(session);
                const caption = `*Sua mão na rodada #${session.gameState.roundCounter}*`;
                await client.sendMessage(jogadorId, media, { caption: caption });
            } else {
                await client.sendMessage(jogadorId, '⚠️ Houve um erro ao gerar a imagem das suas cartas.');
            }
        } else {
            // Para o log do bot, podemos manter o texto simples
            const valorMap = {'T':'10','J':'J','Q':'Q','K':'K','A':'A'};
            const naipeMap = {'s':'♠️','h':'♥️','d':'♦️','c':'♣️'};
            const cartasFormatadas = cartas.map(c => (valorMap[c[0]]||c[0]) + (naipeMap[c[1]]||c[1]));
            console.log(`[Game] Cartas do BOT: ${cartasFormatadas.join(', ')}`);
        }
    }

    // ==================================================================
    // ================= INÍCIO DA SEÇÃO CORRIGIDA ======================
    // ==================================================================
    // NÃO chamamos mais avancarTurnoApostas aqui. Em vez disso, anunciamos
    // o primeiro jogador a agir ou iniciamos a ação do bot.
    const firstPlayerId = session.gameState.ativos[session.gameState.currentPlayerIndex];
    if (firstPlayerId === botPlayer.BOT_ID) {
        // Se o primeiro a agir for o bot, chama a ação dele diretamente.
        await avancarTurnoApostas(session, client);
    } else {
        // Se for um humano, apenas anuncia a vez dele.
        await enviarMensagemDeTurno(session, client);
    }
    // ==================================================================
    // =================== FIM DA SEÇÃO CORRIGIDA =======================
    // ==================================================================
}

async function avancarEtapa(session, client) {
    const gameState = session.gameState;
    const etapas = ['pre-flop', 'flop', 'turn', 'river', 'fim'];
    const etapaAtualIdx = etapas.indexOf(gameState.etapa);
    
    const proximaEtapa = (etapaAtualIdx >= etapas.length - 2) ? 'fim' : etapas[etapaAtualIdx + 1];
    gameState.etapa = proximaEtapa;

    // Apenas avança para o showdown ou para a próxima rodada de apostas.
    // A lógica de iniciar uma nova rodada só acontecerá DEPOIS do showdown.
    if (gameState.etapa === 'fim') {
        // --- LÓGICA DE SHOWDOWN ---
        const jogadoresAtivos = gameState.ativos.filter(pId => gameState.maosPrivadas[pId]);
        
        if (jogadoresAtivos.length <= 1) {
            const winnerId = jogadoresAtivos[0];
            if (winnerId) {
                chipManager.addChips(winnerId, gameState.pote);
                await client.sendMessage(session.groupId, `🎉 ${getPlayerNameById(winnerId, session.players)} venceu e ganhou ${gameState.pote} fichas!`);
            }
        } else {
            const maosPrivadasParaAvaliar = jogadoresAtivos.map(j => gameState.maosPrivadas[j]);
            const resultado = avaliarMaos(jogadoresAtivos, maosPrivadasParaAvaliar, gameState.mesa);
            let showdownMessage = "*Showdown! Revelando as cartas:*\n";
            resultado.ranking.forEach(playerResult => {
            const playerName = getFormattedId(playerResult.jogador, session);
            // Esta linha agora funcionará por causa da função que adicionamos
            const playerHand = formatarCartasArray(gameState.maosPrivadas[playerResult.jogador]); 
            showdownMessage += `\n*${playerName}:* ${playerHand.join(' ')} -> *${playerResult.descricao}*`;
            });
            await client.sendMessage(session.groupId, showdownMessage);
            await new Promise(resolve => setTimeout(resolve, 2500));
            const winnerName = getFormattedId(resultado.vencedor.jogador, session);
            chipManager.addChips(resultado.vencedor.jogador, gameState.pote);
            await client.sendMessage(session.groupId, `🎉 *${winnerName}* venceu com *${resultado.vencedor.descricao}* e ganhou ${gameState.pote} fichas!`);
        }
        // Inicia a próxima rodada APÓS o showdown ter sido concluído.
        await iniciarRodada(session, client);
        return;

    } else {
        // --- LÓGICA PARA PRÓXIMA RODADA DE APOSTAS (FLOP, TURN, RIVER) ---
        gameState.apostaAtual = 0;
        gameState.apostasRodada = {};
        gameState.ultimoApostador = null;
        gameState.numRaises = 0;
        gameState.playersWhoActed = new Set();
        gameState.minRaiseAmount = gameState.bigBlindValue;

        if (gameState.etapa === 'flop') {
            gameState.mesa.push(...[gameState.deck.pop(), gameState.deck.pop(), gameState.deck.pop()]);
        } else if (gameState.etapa === 'turn' || gameState.etapa === 'river') {
            gameState.mesa.push(gameState.deck.pop());
        }

        await enviarMensagemDeEtapa(session, client);
        await new Promise(resolve => setTimeout(resolve, 1500));

            // Conta quantos jogadores ativos ainda podem fazer ações (não estão all-in)
    const playersAbleToBet = gameState.ativos.filter(pId => !gameState.playersAllIn.has(pId));

    if (playersAbleToBet.length < 2) {
        console.log(`[Flow] Apenas ${playersAbleToBet.length} jogador(es) pode(m) apostar. Pulando para a próxima etapa automaticamente.`);
        await client.sendMessage(session.groupId, 'Não há mais ações possíveis. Revelando as próximas cartas...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Uma pausa para o fluxo ficar natural

        // Chama a próxima etapa (ex: turn -> river -> fim) recursivamente até o showdown
        await avancarEtapa(session, client);
        return; // Impede que o resto da função (que procuraria o próximo jogador) seja executado
    }
        
        const allPlayersInOrder = session.players.map(p => p.id);
        const sortedActivePlayers = allPlayersInOrder.filter(pId => gameState.ativos.includes(pId));
        const dealerIdx = sortedActivePlayers.indexOf(gameState.dealer);
        let startIndex = -1;

        for (let i = 1; i <= sortedActivePlayers.length; i++) {
            const potentialPlayerId = sortedActivePlayers[(dealerIdx + i) % sortedActivePlayers.length];
            if (!gameState.playersAllIn.has(potentialPlayerId)) {
                startIndex = gameState.ativos.indexOf(potentialPlayerId);
                break;
            }
        }

        if (startIndex === -1) {
            await avancarEtapa(session, client);
            return;
        }

        gameState.currentPlayerIndex = startIndex;
        const firstPlayerId = gameState.ativos[startIndex];

        if (firstPlayerId === botPlayer.BOT_ID) {
            await avancarTurnoApostas(session, client, null);
        } else {
            await enviarMensagemDeTurno(session, client);
        }
    }
}


async function avancarTurnoApostas(session, client, lastPlayerId) {
    const gameState = session.gameState;
    console.log(`\n[DEBUG] --- Iniciando avancarTurnoApostas (último a jogar: ${lastPlayerId || 'N/A'}) ---`);

    // CORREÇÃO ALL-IN: Verifica se os jogadores que ainda podem agir já estão all-in.
    const playersAbleToAct = gameState.ativos.filter(pId => !gameState.playersAllIn.has(pId));
    if (playersAbleToAct.length < 2 && gameState.apostaAtual > 0) {
        console.log('[DEBUG] Rodada de apostas terminada pois não há jogadores suficientes para continuar a ação.');
        await client.sendMessage(session.groupId, 'Rodada de apostas encerrada! 💰');
        await avancarEtapa(session, client);
        return;
    }

    const playersToAct = gameState.ativos.filter(pId => !gameState.playersAllIn.has(pId));
    
    const roundIsOver = playersToAct.length > 0 && playersToAct.every(pId =>
        gameState.playersWhoActed.has(pId) &&
        (gameState.apostasRodada[pId] || 0) === gameState.apostaAtual
    );
    
    console.log(`[DEBUG] Verificando se a rodada acabou: ${roundIsOver}`);
    console.log(`[DEBUG] Jogadores que já agiram:`, Array.from(gameState.playersWhoActed));
    console.log(`[DEBUG] Apostas na rodada:`, gameState.apostasRodada);
    console.log(`[DEBUG] Aposta atual: ${gameState.apostaAtual}`);

    if (gameState.ativos.length <= 1 || roundIsOver) {
        if (roundIsOver) await client.sendMessage(session.groupId, 'Rodada de apostas encerrada! 💰');
        console.log('[DEBUG] A rodada acabou. Avançando para a próxima etapa...');
        await avancarEtapa(session, client);
        return;
    }
    
    console.log('[DEBUG] Rodada não acabou. Procurando próximo jogador...');
    const playerOrder = session.players.map(p => p.id);
    const lastPlayerIndex = playerOrder.indexOf(lastPlayerId || gameState.ativos[gameState.currentPlayerIndex]);

    for (let i = 1; i <= playerOrder.length * 2; i++) {
        const nextPlayerId = playerOrder[(lastPlayerIndex + i) % playerOrder.length];
        console.log(`[DEBUG] Loop ${i}: Verificando ${nextPlayerId}...`);
        
        if (gameState.ativos.includes(nextPlayerId)) {
            console.log(`[DEBUG] -> ${nextPlayerId} está ativo.`);
            if (!gameState.playersAllIn.has(nextPlayerId)) {
                console.log(`[DEBUG] -> ${nextPlayerId} não está all-in.`);
                if (!gameState.playersWhoActed.has(nextPlayerId) || (gameState.apostasRodada[nextPlayerId] || 0) < gameState.apostaAtual) {
                    console.log(`[DEBUG] -> DECISÃO: ${nextPlayerId} PRECISA AGIR!`);
                    gameState.currentPlayerIndex = gameState.ativos.indexOf(nextPlayerId);
                    
                    if (nextPlayerId === botPlayer.BOT_ID) {
                        console.log('[DEBUG] É a vez do BOT. Chamando a IA...');
                        await client.sendMessage(session.groupId, `Vez de *${getPlayerNameById(nextPlayerId, session.players)}* 🤖`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        const context = { position: getBotPosition(session) };
                        const commandText = botPlayer.decideAction(session, context);
                        const fakeMessage = { from: session.groupId, author: botPlayer.BOT_ID, body: commandText, client: client, reply: (text) => client.sendMessage(session.groupId, text) };
                        // A forma correta de chamar o handler é através do playerActions
                        const playerActions = require('./playerActions');
                        await playerActions.handleGameCommand(fakeMessage, session, client);
                    } else {
                        console.log(`[DEBUG] É a vez de um humano. Enviando mensagem de turno...`);
                        await enviarMensagemDeTurno(session, client);
                    }
                    console.log('[DEBUG] --- Fim de avancarTurnoApostas (ação passada) ---');
                    return;
                }
            }
        }
    }

    console.log('[DEBUG] ERRO: O loop terminou sem encontrar um próximo jogador. Forçando o avanço da etapa.');
    await client.sendMessage(session.groupId, 'Rodada de apostas encerrada (fallback)!');
    await avancarEtapa(session, client);
}


// --- FUNÇÕES DE AÇÃO DO JOGADOR ---

async function handleCheck(session, playerId, client) {
    const gameState = session.gameState;
    if (gameState.apostaAtual > (gameState.apostasRodada[playerId] || 0)) {
        if (playerId !== botPlayer.BOT_ID) {
            await client.sendMessage(playerId, `❌ Não é possível dar !mesa. Você precisa !pagar ou !apostar.`);
        }
        return false;
    }
    gameState.playersWhoActed.add(playerId);
    await client.sendMessage(session.groupId, `*${getPlayerNameById(playerId, session.players)}* foi de !mesa.`);
    await avancarTurnoApostas(session, client, playerId); // <-- MUDANÇA AQUI
    return true;
}

async function handleCall(session, playerId, client) {
    const gameState = session.gameState;
    const playerChips = chipManager.getPlayerChips(playerId);
    const amountToCall = gameState.apostaAtual - (gameState.apostasRodada[playerId] || 0);

    if (amountToCall <= 0) {
        if (playerId !== botPlayer.BOT_ID) await client.sendMessage(playerId, `❌ Não há aposta para pagar. Use !mesa para passar a vez.`);
        return false;
    }
    
    if (playerChips < amountToCall) {
        return await handleAllIn(session, playerId, client);
    }
    chipManager.deductChips(playerId, amountToCall);
    gameState.pote += amountToCall;
    gameState.apostasRodada[playerId] = gameState.apostaAtual;
    gameState.playersWhoActed.add(playerId);
    await client.sendMessage(session.groupId, `${getPlayerNameById(playerId, session.players)} pagou (${amountToCall} fichas)✅`);
    await avancarTurnoApostas(session, client, playerId); // <-- MUDANÇA AQUI
    return true;
}

async function handleBet(session, playerId, amount, client) {
    const gameState = session.gameState;
    const playerChips = chipManager.getPlayerChips(playerId);
    if (gameState.apostaAtual > 0) {
        if (playerId !== botPlayer.BOT_ID) await client.sendMessage(playerId, `❌ Já existe uma aposta. Use !pagar ou !aumentar.`);
        return false;
    }
    if (amount < gameState.bigBlindValue) {
        if (playerId !== botPlayer.BOT_ID) await client.sendMessage(playerId, `❌ A aposta mínima é de ${gameState.bigBlindValue} fichas.`);
        return false;
    }
    if (playerChips < amount) {
        if (playerId !== botPlayer.BOT_ID) await client.sendMessage(playerId, `❌ Você não tem fichas suficientes. Considere !allin.`);
        return false;
    }
    chipManager.deductChips(playerId, amount);
    gameState.pote += amount;
    gameState.apostasRodada[playerId] = amount;
    gameState.apostaAtual = amount;
    gameState.ultimoApostador = playerId;
    gameState.playersWhoActed = new Set([playerId]);
    await client.sendMessage(session.groupId, `💵 ${getPlayerNameById(playerId, session.players)} apostou ${amount} fichas.`);
    await avancarTurnoApostas(session, client, playerId); // <-- MUDANÇA AQUI
    return true;
}

async function handleRaise(session, playerId, amount, client) {
    const gameState = session.gameState;
    const playerChips = chipManager.getPlayerChips(playerId);
    const playerBetInRound = gameState.apostasRodada[playerId] || 0;
    const currentBet = gameState.apostaAtual;
    if (currentBet === 0) {
        if (playerId !== botPlayer.BOT_ID) await client.sendMessage(playerId, `❌ Não há aposta para aumentar. Use !apostar.`);
        return false;
    }
    if (amount <= currentBet) {
        if (playerId !== botPlayer.BOT_ID) await client.sendMessage(playerId, `❌ O valor do aumento (${amount}) deve ser maior que a aposta atual (${currentBet}).`);
        return false;
    }
    const raiseAmount = amount - currentBet;
    if (raiseAmount < gameState.minRaiseAmount) {
        if (playerId !== botPlayer.BOT_ID) await client.sendMessage(playerId, `❌ O aumento deve ser de pelo menos ${gameState.minRaiseAmount} fichas.`);
        return false;
    }
    const chipsNeeded = amount - playerBetInRound;
    if (playerChips < chipsNeeded) {
        if (playerId !== botPlayer.BOT_ID) await client.sendMessage(playerId, `❌ Você não tem fichas para aumentar para ${amount}.`);
        return false;
    }
    chipManager.deductChips(playerId, chipsNeeded);
    gameState.pote += chipsNeeded;
    gameState.apostasRodada[playerId] = amount;
    gameState.apostaAtual = amount;
    gameState.ultimoApostador = playerId;
    gameState.numRaises++;
    gameState.minRaiseAmount = raiseAmount;
    gameState.playersWhoActed = new Set([playerId]);
    await client.sendMessage(session.groupId, `${getPlayerNameById(playerId, session.players)} aumentou para ${amount} fichas ⬆️`);
    await avancarTurnoApostas(session, client, playerId); // <-- MUDANÇA AQUI
    return true;
}

async function handleAllIn(session, playerId, client) {
    const gameState = session.gameState;
    const playerChips = chipManager.getPlayerChips(playerId);
    if (playerChips <= 0) {
        if (playerId !== botPlayer.BOT_ID) await client.sendMessage(playerId, `❌ Você não tem fichas para ir !allin.`);
        return false;
    }
    const totalBetForPlayer = (gameState.apostasRodada[playerId] || 0) + playerChips;
    chipManager.deductChips(playerId, playerChips);
    gameState.pote += playerChips;
    gameState.apostasRodada[playerId] = totalBetForPlayer;
    gameState.playersAllIn.add(playerId);

    let actionMessage;
    if (totalBetForPlayer > gameState.apostaAtual) {
        // A CORREÇÃO ESTÁ NA LINHA ABAIXO: 'apostaAtual' estava com um espaço.
        gameState.minRaiseAmount = totalBetForPlayer - gameState.apostaAtual;
        gameState.apostaAtual = totalBetForPlayer;
        gameState.ultimoApostador = playerId;
        gameState.playersWhoActed = new Set();
        actionMessage = `🔥 ${getPlayerNameById(playerId, session.players)} foi de !allin, aumentando para ${totalBetForPlayer} fichas!`;
    } else {
        actionMessage = `🔥 ${getPlayerNameById(playerId, session.players)} foi de !allin com ${playerChips} fichas.`;
    }
    gameState.playersWhoActed.add(playerId);
    await client.sendMessage(session.groupId, actionMessage);
    await avancarTurnoApostas(session, client, playerId);
    return true;
}

// --- FUNÇÕES DE MENSAGEM ---

function getPlayerNameById(playerId, playersArray) {
    const player = playersArray.find(p => p.id === playerId);
    return player ? player.name : playerId.split('@')[0];
}

function formatarMesaVisual(mesa) {
    const cartasVisuais = formatarCartasArray(mesa);
    const placeholders = Array(5 - cartasVisuais.length).fill('X');
    return [...cartasVisuais, ...placeholders].join('    ');
}

function getComandosDisponiveis(session) {
    const gameState = session.gameState;
    const playerId = gameState.ativos[gameState.currentPlayerIndex];
    const playerBetInRound = gameState.apostasRodada[playerId] || 0;
    const currentBet = gameState.apostaAtual;
    let comandos = [];
    if (currentBet > playerBetInRound) {
        comandos.push('!pagar', '!aumentar <valor>');
    } else {
        comandos.push('!mesa', '!apostar <valor>');
    }
    comandos.push('!allin', '!desistir', '!ajuda');
    return comandos.join(' | ');
}

async function enviarMensagemPreRodada(session, client) {
    const round = session.gameState.roundCounter;
    let message = `*Rodada #${round}* 🎲\n\n*Jogadores na mesa:*\n`;
    session.players.forEach((player, index) => {
        const chips = chipManager.getPlayerChips(player.id);
        message += `${index + 1}. ${player.name} - *${chips} fichas*\n`;
    });
    await client.sendMessage(session.groupId, message);
}

async function enviarMensagemDeEtapa(session, client) {
    const gameState = session.gameState;
    const nomeEtapa = gameState.etapa.toUpperCase().replace('-', ' ');

    // SE FOR PRE-FLOP, ENVIA TEXTO
    if (gameState.etapa === 'pre-flop') {
        let message = `*--- ${nomeEtapa} ---*\n\n`;
        message += `Mesa: X    X    X    X    X\n\n`; // Mesa com placeholders
        
        const sbPlayer = session.players.find(p => p.id === gameState.sb);
        const bbPlayer = session.players.find(p => p.id === gameState.bb);
        if (sbPlayer && bbPlayer) {
            const sbAmount = gameState.smallBlindValue;
            const bbAmount = gameState.bigBlindValue;
            message += `SB: ${sbPlayer.name} (-${sbAmount} fichas)\n`;
            message += `BB: ${bbPlayer.name} (-${bbAmount} fichas)\n\n`;
        }
        message += `*Pote Total: ${gameState.pote} fichas*`;
        await client.sendMessage(session.groupId, message);
    } else {
        // PARA FLOP, TURN E RIVER, ENVIA IMAGEM
        let caption = `*--- ${nomeEtapa} ---*\n\n`;
        caption += `*Pote Total: ${gameState.pote} fichas*`;

        const imagePath = await gerarImagemCartas(gameState.mesa);
        if (imagePath) {
            const media = MessageMedia.fromFilePath(imagePath);
            await client.sendMessage(session.groupId, media, { caption: caption });
        } else {
            // Fallback caso a imagem falhe por outro motivo
             await client.sendMessage(session.groupId, caption + '\n\n(Erro ao gerar imagem da mesa)');
        }
    }
}

async function enviarMensagemDeTurno(session, client) {
    const gameState = session.gameState;
    const currentPlayerId = gameState.ativos[gameState.currentPlayerIndex];
    // A função já ignora o bot, o que é perfeito.
    if (currentPlayerId === botPlayer.BOT_ID) return;

    const player = session.players.find(p => p.id === currentPlayerId);
    if (!player) return;

    const currentBet = gameState.apostaAtual;
    const playerBetInRound = gameState.apostasRodada[currentPlayerId] || 0;
    const amountToCall = currentBet - playerBetInRound;
    
    let line1 = `*Sua vez de jogar, ${player.name}!*`;

    let line2 = '';
    if (amountToCall > 0) {
        line2 = `Aposta: *${currentBet}* | Pagar: *${amountToCall}*`;
    } else {
        line2 = `Aposta: *0* (Você pode dar \`!mesa\` ou \`!apostar\`)`;
    }

    const commands = getComandosDisponiveis(session);
    const line3 = `\`\`\`${commands}\`\`\``;

    const finalMessage = `${line1}\n${line2}\n${line3}`;

    // 1. Envia a mensagem para o grupo (comportamento atual, mas com o nome do jogador)
    await client.sendMessage(session.groupId, `Vez de *${player.name}* 🕓`);

    // 2. NOVO: Envia a mensagem detalhada para o privado do jogador da vez
    await client.sendMessage(currentPlayerId, finalMessage);
}

const STARTING_CHIPS = 5000; // Certifique-se que esta constante está acessível ou defina-a aqui.

function prepararJogo(session) {
    // Esta função é a "ponte". O lobby entrega a lista de jogadores,
    // e o módulo de poker cuida de dar as fichas.
    session.players.forEach(player => {
        chipManager.initializePlayerChips(player.id, STARTING_CHIPS);
    });
    console.log('[Game] Fichas iniciais distribuídas para os jogadores.');
}

function getBotPosition(session) {
    const { ativos, dealer, sb, bb } = session.gameState;
    const botId = botPlayer.BOT_ID; // Você precisa ter o botPlayer importado neste arquivo
    const numPlayers = ativos.length;

    if (!session.players || session.players.length === 0) return 'UNKNOWN';

    // Garante que o botPlayer foi importado no topo do poker.js
    // Ex: const botPlayer = require('./botPlayer');

    if (botId === sb) return 'SB';
    if (botId === bb) return 'BB';

    const playerOrder = session.players.map(p => p.id);
    const botSeatIndex = playerOrder.indexOf(botId);
    const dealerSeatIndex = playerOrder.indexOf(dealer);
    
    if (botSeatIndex === -1 || dealerSeatIndex === -1) return 'UNKNOWN';

    const relativePosition = (botSeatIndex - dealerSeatIndex + numPlayers) % numPlayers;

    if (numPlayers > 6) { // Mesa cheia (Full Ring)
        if (relativePosition <= 2) return 'EARLY';
        if (relativePosition < numPlayers - 1) return 'MIDDLE';
        return 'LATE';
    } else { // Mesa curta (6-max)
        if (relativePosition <= 1) return 'EARLY';
        if (relativePosition < numPlayers - 1) return 'MIDDLE';
        return 'LATE';
    }
}

// --- EXPORTAÇÕES ---

module.exports = {
    initializeGameState,
    iniciarRodada,
    avancarEtapa,
    handleCheck,
    handleCall,
    handleBet,
    handleRaise,
    handleAllIn,
    avancarTurnoApostas,
    prepararJogo
};