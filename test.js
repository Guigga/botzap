// C:\Users\Guilherme\bot-whatsapp\test.js

const handleCommand = require('./controllers/commandHandler');
const sessionManager = require('./sessions/sessionManager');

// ==================================================================
// ==================== SETUP DE SIMULAÇÃO ==========================
// ==================================================================

const mockClient = {
    sendMessage: (targetId, message, options) => {
        let cleanMessage = (typeof message === 'string') ? message : (options?.caption || '[Mídia de Imagem]');
        cleanMessage = cleanMessage.replace(/(\r\n|\n|\r)/gm, " ");
        console.log(`[MSG para ${targetId.split('@')[0]}]: ${cleanMessage}`);
    }
};

const GROUP_ID = 'jogo_finalissimo_test@g.us';
const P1 = { id: 'player1@c.us', name: 'Guiga' };
const BOT = { id: 'bot_truco@cpu.bot', name: 'BOT Zé da Roça' };
const PAUSA_CURTA = 100;
const PAUSA_LONGA = 2500;

const sendCommand = async (player, commandBody, fromGroup = true, delay = PAUSA_CURTA) => {
    const fromId = fromGroup ? GROUP_ID : player.id;
    const authorId = fromGroup ? player.id : undefined;
    console.log(`\n> ${player.name} executa: "${commandBody}"`);
    
    const mockMessage = {
        from: fromId, body: commandBody, author: authorId,
        reply: (text) => console.log(`[REPLY para ${player.name}]: ${text.split('\n')[0]}...`)
    };

    await handleCommand(mockMessage, mockClient);
    await new Promise(resolve => setTimeout(resolve, delay));
};

// ==================================================================
// =================== CENÁRIO DE TESTE FINAL =======================
// ==================================================================

async function cenarioJogoCompleto_HumanoVence() {
    console.log('\n\n--- 🧪 CENÁRIO: JOGO COMPLETO DE 0 A 12 (Humano Vence) ---');
    await sendCommand(P1, '!jogo truco');
    await sendCommand(P1, '!entrar Guiga');
    await sendCommand(P1, '!iniciar');

    for (let i = 1; i <= 12; i++) {
        let session = sessionManager.getSession(GROUP_ID);
        if (!session || !session.gameState) throw new Error("Sessão terminada prematuramente.");
        
        const placarInicial = { ...session.gameState.placar };
        console.log(`\n\n-=-=-=-=-=-=-= JOGANDO MÃO #${i} | PLACAR INICIAL: ${placarInicial.time1}x${placarInicial.time2} -=-=-=-=-=-=-=`);

        await sendCommand(P1, `!debug-sethand ${P1.id} 3s 2s As`, true);
        await sendCommand(P1, `!debug-sethand ${BOT.id} 7s 6s 5s`, true);

        // Loop de jogadas REATIVO.
        for (let jogada = 1; jogada <= 4; jogada++) {
            session = sessionManager.getSession(GROUP_ID);
            const placarAtual = session.gameState.placar;
            if (placarAtual.time1 > placarInicial.time1 || placarAtual.time2 > placarInicial.time2) break;

            console.log(`-- [Teste] Turno ${session.gameState.numeroDoTurno}, Jogada ${jogada}. Vez de: ${session.gameState.jogadores[session.gameState.vezDoJogador].name}`);
            
            // Apenas joga se for a vez do humano.
            if (session.gameState.jogadores[session.gameState.vezDoJogador].id === P1.id) {
                const maoHumano = session.gameState.jogadores[0].mao;
                const proximaCartaIndex = maoHumano.findIndex(carta => carta !== null);
                if (proximaCartaIndex !== -1) {
                    await sendCommand(P1, `!carta ${proximaCartaIndex + 1}`, false);
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, PAUSA_LONGA));
        }

        const placarFinal = sessionManager.getSession(GROUP_ID)?.gameState?.placar;
        if (!placarFinal) throw new Error(`ERRO: A Mão #${i} não terminou corretamente.`);
        
        console.log(`-=-=-=-=-=-=-= FIM DA MÃO #${i} | PLACAR FINAL: ${placarFinal.time1}x${placarFinal.time2} -=-=-=-=-=-=-=`);

        if (placarFinal.time1 === placarInicial.time1 + 1) {
            console.log(`SUCESSO: Placar da Mão #${i} atualizado corretamente!`);
        } else {
            throw new Error(`ERRO: Placar inconsistente na Mão #${i}! Esperado: ${placarInicial.time1 + 1}, Recebido: ${placarFinal.time1}`);
        }
    }

    const finalSession = sessionManager.getSession(GROUP_ID);
    if(finalSession) {
         throw new Error("ERRO: O jogo deveria ter terminado, mas a sessão ainda existe.");
    } else {
        console.log("\nSUCESSO: O jogo terminou em 12 pontos e a sessão foi encerrada como esperado!");
    }
}

// ==================================================================
// =================== EXECUTOR DE TESTES ===========================
// ==================================================================

async function runTests() {
    try {
        await cenarioJogoCompleto_HumanoVence();
    } catch (error) {
        console.error('\n\n❌ --- UM ERRO CRÍTICO OCORREU DURANTE OS TESTES --- ❌', error);
    } finally {
        if (sessionManager.getSession(GROUP_ID)) {
            await sendCommand(P1, '!sair', true);
        }
        console.log('\n\n--- ✅ TESTES CONCLUÍDOS ---');
    }
}

runTests();