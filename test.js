// C:\Users\Guilherme\bot-whatsapp\test.js

const handleCommand = require('./controllers/commandHandler');
const sessionManager = require('./sessions/sessionManager');
const assert = require('assert');

// ==================================================================
// ==================== SETUP DE SIMULAÇÃO 2x2 ======================
// ==================================================================

const mockClient = {
    sendMessage: (targetId, message, options) => {
        let cleanMessage = (typeof message === 'string') ? message : (options?.caption || '[Mídia de Imagem]');
        cleanMessage = cleanMessage.replace(/(\r\n|\n|\r)/gm, " ");
        console.log(`[MSG para ${targetId.split('@')[0]}]: ${cleanMessage}`);
    }
};

const GROUP_ID = 'teste_2v2_truco@g.us';
// Time Blue
const P1 = { id: 'player1@c.us', name: 'Guiga' };
const P3 = { id: 'player3@c.us', name: 'Tonho' };
// Time Red
const P2 = { id: 'player2@c.us', name: 'Chico' };
const P4 = { id: 'player4@c.us', name: 'Zeca' };

const PAUSA_ENTRE_ACOES = 500;

const sendCommand = async (player, commandBody) => {
    const authorId = player.id;
    console.log(`\n> ${player.name} executa: "${commandBody}"`);
    const mockMessage = {
        from: GROUP_ID, // Em jogos 2x2, todos os comandos vêm do grupo
        body: commandBody,
        author: authorId,
        reply: (text) => console.log(`[REPLY para ${player.name}]: ${text.split('\n')[0]}...`)
    };
    await handleCommand(mockMessage, mockClient);
    await new Promise(resolve => setTimeout(resolve, PAUSA_ENTRE_ACOES));
};

const setupTestEnvironment2v2 = async () => {
    if (sessionManager.getSession(GROUP_ID)) {
        sessionManager.endSession(GROUP_ID);
    }
    console.log('\n=============================================================');
    console.log('Ambiente de teste 2x2 limpo e pronto.');
    console.log('=============================================================\n');
    await sendCommand(P1, '!jogo truco');
    await sendCommand(P1, `!entrar ${P1.name} blue`);
    await sendCommand(P2, `!entrar ${P2.name} red`);
    await sendCommand(P3, `!entrar ${P3.name} blue`);
    await sendCommand(P4, `!entrar ${P4.name} red`);
};

// ==================================================================
// =================== CENÁRIOS DE TESTE 2x2 ========================
// ==================================================================

/**
 * CENÁRIO 1: Uma mão simples para validar a ordem de jogadas e a vitória do time.
 */
async function cenario_2v2_ordem_e_vitoria_simples() {
    console.log('--- 🧪 CENÁRIO 1 (2x2): Ordem de jogadas e vitória simples ---');
    await setupTestEnvironment2v2();
    await sendCommand(P1, '!iniciar');

    let session = sessionManager.getSession(GROUP_ID);
    assert.strictEqual(session.gameState.jogadores.length, 4, 'O jogo não começou com 4 jogadores.');

    await sendCommand(P1, '!debug-setvira 6d'); // Manilha é 7
    await sendCommand(P1, `!debug-sethand ${P1.id} As 2s 3s`); // Mão forte para o Time Blue
    await sendCommand(P2, `!debug-sethand ${P2.id} 4c 5c 6c`);
    await sendCommand(P3, `!debug-sethand ${P3.id} Ks Qs Js`); // Mão forte para o Time Blue
    await sendCommand(P4, `!debug-sethand ${P4.id} 4h 5h 6h`);

    // --- TURNO 1 ---
    console.log('\n--- Jogando Turno 1 ---');
    await sendCommand(P1, '!carta 1'); // P1 (Blue) joga As
    await sendCommand(P2, '!carta 1'); // P2 (Red) joga 4c
    await sendCommand(P3, '!carta 3'); // P3 (Blue) joga Js
    await sendCommand(P4, '!carta 1'); // P4 (Red) joga 4h
    
    session = sessionManager.getSession(GROUP_ID);
    assert.strictEqual(session.gameState.turnosGanhos.time1, 1, 'Time Blue (1) deveria ter vencido o primeiro turno.');
    assert.strictEqual(session.gameState.jogadores[session.gameState.vezDoJogador].id, P1.id, 'P1 deveria começar o próximo turno pois jogou a carta mais forte.');

    // --- TURNO 2 ---
    console.log('\n--- Jogando Turno 2 ---');
    await sendCommand(P1, '!carta 2'); // P1 (Blue) joga 2s
    await sendCommand(P2, '!carta 2'); // P2 (Red) joga 5c
    await sendCommand(P3, '!carta 2'); // P3 (Blue) joga Qs
    await sendCommand(P4, '!carta 2'); // P4 (Red) joga 5h

    session = sessionManager.getSession(GROUP_ID);
    assert.strictEqual(session.gameState.placar.time1, 1, 'Placar do Time Blue deveria ser 1');
    assert.strictEqual(session.gameState.rodada, 2, 'O jogo deveria ter avançado para a rodada 2.');
    
    console.log('\n✅ SUCESSO: Cenário 1 (2x2) concluído. Ordem e vitória validadas.');
}

/**
 * CENÁRIO 2: Testa o pedido de truco e a resposta vinda do parceiro do oponente.
 */
async function cenario_2v2_truco_resposta_parceiro() {
    console.log('--- 🧪 CENÁRIO 2 (2x2): Pedido de Truco e resposta do parceiro ---');
    await setupTestEnvironment2v2();
    await sendCommand(P1, '!iniciar');

    // P1 pede truco logo no início
    await sendCommand(P1, '!truco');

    let session = sessionManager.getSession(GROUP_ID);
    assert.strictEqual(session.gameState.valorDaMao, 3, 'Valor da mão deveria ser 3 após o truco.');

    // P4 (parceiro do P2, que seria o próximo a jogar) aceita em nome do time Red.
    console.log('\n--- P4 aceita o truco pelo Time Red ---');
    await sendCommand(P4, '!aceitar');

    session = sessionManager.getSession(GROUP_ID);
    assert.strictEqual(session.gameState.status, 'aguardando_jogada', 'O jogo deveria voltar para o estado de aguardando jogada.');

    console.log('\n✅ SUCESSO: Cenário 2 (2x2) concluído. Resposta de truco pelo parceiro foi aceita.');
}

/**
 * CENÁRIO 3: Testa a regra de empate (canga) em um turno.
 */
async function cenario_2v2_empate_de_turno() {
    console.log('--- 🧪 CENÁRIO 3 (2x2): Empate em um turno (Canga) ---');
    await setupTestEnvironment2v2();
    await sendCommand(P1, '!iniciar');

    await sendCommand(P1, '!debug-setvira 6d'); // Manilha é 7
    await sendCommand(P1, `!debug-sethand ${P1.id} Ks 2s 3s`); // P1 joga o Rei
    await sendCommand(P2, `!debug-sethand ${P2.id} 4c 5c 6c`);
    await sendCommand(P3, `!debug-sethand ${P3.id} 4h 5h 6h`);
    await sendCommand(P4, `!debug-sethand ${P4.id} Kh Qs Js`); // P4 joga o Rei

    const p1Index = sessionManager.getSession(GROUP_ID).gameState.jogadores.findIndex(p => p.id === P1.id);
    
    // --- TURNO 1 (com empate) ---
    console.log('\n--- Jogando Turno 1 para empatar ---');
    await sendCommand(P1, '!carta 1'); // P1 (Blue) joga Ks
    await sendCommand(P2, '!carta 1'); // P2 (Red) joga 4c
    await sendCommand(P3, '!carta 1'); // P3 (Blue) joga 4h
    await sendCommand(P4, '!carta 1'); // P4 (Red) joga Kh, empatando com P1

    let session = sessionManager.getSession(GROUP_ID);
    assert.strictEqual(session.gameState.primeiroTurnoEmpatado, true, 'O estado primeiroTurnoEmpatado deveria ser true.');
    assert.strictEqual(session.gameState.vezDoJogador, p1Index, 'A vez de jogar deveria voltar para P1, que iniciou o turno empatado.');

    console.log('\n✅ SUCESSO: Cenário 3 (2x2) concluído. Turno empatou e a vez voltou para o jogador correto.');
}

// ==================================================================
// =================== EXECUTOR DE TESTES ===========================
// ==================================================================

async function runTests() {
    try {
        await cenario_2v2_ordem_e_vitoria_simples();
        await cenario_2v2_truco_resposta_parceiro();
        await cenario_2v2_empate_de_turno();
    } catch (error) {
        console.error('\n\n❌ --- UM ERRO CRÍTICO OCORREU DURANTE OS TESTES --- ❌');
        console.error(error);
    } finally {
        if (sessionManager.getSession(GROUP_ID)) {
            sessionManager.endSession(GROUP_ID);
            console.log('\nSessão de teste 2v2 final limpa.');
        }
        console.log('\n\n--- ✅ TODOS OS TESTES FORAM CONCLUÍDOS ---');
    }
}

runTests();