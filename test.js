// C:\Users\Guilherme\bot-whatsapp\test.js

const handleCommand = require('./controllers/commandHandler');
const sessionManager = require('./sessions/sessionManager');
const assert = require('assert');

// ==================================================================
// ==================== SETUP DE SIMULAÇÃO ==========================
// ==================================================================

const mockClient = {
    sendMessage: (targetId, message, options) => {
        let cleanMessage = (typeof message === 'string') ? message : (options?.caption || `[Mídia: ${options?.caption || 'jogo da velha'}]`);
        cleanMessage = cleanMessage.replace(/(\r\n|\n|\r)/gm, " ");
        console.log(`[MSG para ${targetId.split('@')[0]}]: ${cleanMessage}`);
    }
};

const GROUP_ID = 'teste_velha_infinito@g.us';
const P1 = { id: 'player1@c.us', name: 'Guiga' };
const P2 = { id: 'player2@c.us', name: 'Chico' };

const PAUSA_ENTRE_ACOES = 500;

const sendCommand = async (player, commandBody) => {
    const authorId = player.id;
    console.log(`\n> ${player.name} executa: "${commandBody}"`);
    const mockMessage = {
        from: GROUP_ID,
        body: commandBody,
        author: authorId,
        reply: (text) => console.log(`[REPLY para ${player.name}]: ${text.split('\n')[0]}...`)
    };
    await handleCommand(mockMessage, mockClient);
    await new Promise(resolve => setTimeout(resolve, PAUSA_ENTRE_ACOES));
};

const setupVelhaTest = async () => {
    if (sessionManager.getSession(GROUP_ID)) {
        sessionManager.endSession(GROUP_ID);
    }
    console.log(`\n=============================================================`);
    console.log(`Ambiente de teste do Jogo da Velha limpo e pronto.`);
    console.log(`=============================================================`);
    
    await sendCommand(P1, '!jogo velha');
    await sendCommand(P1, `!entrar ${P1.name}`);
    await sendCommand(P2, `!entrar ${P2.name}`);
};

// ==================================================================
// =================== CENÁRIOS DE TESTE DA VELHA ===================
// ==================================================================

/**
 * CENÁRIO 1: Testa uma vitória normal, antes de o tabuleiro encher.
 */
async function cenario_Velha_Vitoria_Rapida() {
    console.log('\n--- 🧪 CENÁRIO 1: Jogo da Velha com vitória rápida ---');
    await setupVelhaTest();
    await sendCommand(P1, '!iniciar');

    // Simulação de uma vitória em 5 jogadas
    await sendCommand(P1, '!j a1'); // P1 joga
    await sendCommand(P2, '!j b1'); // P2 joga
    await sendCommand(P1, '!j a2'); // P1 joga
    await sendCommand(P2, '!j b2'); // P2 joga
    await sendCommand(P1, '!j a3'); // P1 joga e vence

    const session = sessionManager.getSession(GROUP_ID);
    assert.strictEqual(session, undefined, 'A sessão deveria ter sido encerrada após a vitória.');
    
    console.log('\n✅ SUCESSO: Cenário de vitória rápida concluído e sessão encerrada.');
}

/**
 * CENÁRIO 2: Testa a mecânica "infinita" após 9 jogadas.
 */
async function cenario_Velha_Infinita() {
    console.log('\n--- 🧪 CENÁRIO 2: Jogo da Velha com mecânica infinita ---');
    await setupVelhaTest();
    await sendCommand(P1, '!iniciar');

    // NOVA sequência de jogadas para encher o tabuleiro sem um vencedor
    console.log('\n--- Enchendo o tabuleiro ---');
    await sendCommand(P1, '!j a1'); // 1. X
    await sendCommand(P2, '!j b2'); // 2. O
    await sendCommand(P1, '!j a2'); // 3. X
    await sendCommand(P2, '!j a3'); // 4. O
    await sendCommand(P1, '!j c1'); // 5. X
    await sendCommand(P2, '!j b1'); // 6. O
    await sendCommand(P1, '!j b3'); // 7. X
    await sendCommand(P2, '!j c3'); // 8. O
    await sendCommand(P1, '!j c2'); // 9. X - Tabuleiro cheio, sem vencedor

    let session = sessionManager.getSession(GROUP_ID);
    assert.notStrictEqual(session, undefined, 'A sessão não deveria ter terminado após 9 jogadas.');
    assert.strictEqual(session.gameState.historicoDeJogadas.length, 9, 'Deveria haver 9 jogadas no histórico.');

    // A 10ª jogada (de P2), que ativa a remoção da mais antiga (P1 em a1)
    console.log('\n--- Ativando a mecânica infinita ---');
    await sendCommand(P2, '!j a1'); // P2 joga no lugar que era do P1

    session = sessionManager.getSession(GROUP_ID);
    const jogadaMaisAntiga = session.gameState.historicoDeJogadas[0];
    assert.strictEqual(jogadaMaisAntiga.posicao, 'b2', 'A jogada mais antiga agora deveria ser a de P2 em b2.');

    // P1 joga na posição b1 (que era do P2 e será removida), completando a linha B e vencendo.
    console.log('\n--- P1 joga para vencer ---');
    await sendCommand(P1, '!j b1'); 
    
    session = sessionManager.getSession(GROUP_ID);
    assert.strictEqual(session, undefined, 'A sessão deveria ter sido encerrada após a vitória no modo infinito.');

    console.log('\n✅ SUCESSO: Cenário da mecânica infinita concluído com sucesso.');
}

// ==================================================================
// =================== EXECUTOR DE TESTES ===========================
// ==================================================================

async function runTests() {
    try {
        await cenario_Velha_Vitoria_Rapida();
        await cenario_Velha_Infinita();
    } catch (error) {
        console.error('\n\n❌ --- UM ERRO CRÍTICO OCORREU DURANTE OS TESTES --- ❌');
        console.error(error);
    } finally {
        if (sessionManager.getSession(GROUP_ID)) {
            sessionManager.endSession(GROUP_ID);
            console.log('\nSessão de teste da Velha final limpa.');
        }
        console.log('\n\n--- ✅ TODOS OS TESTES DO JOGO DA VELHA FORAM CONCLUÍDOS ---');
    }
}

runTests();