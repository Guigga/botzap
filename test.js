// test.js - Teste de Estresse para Rotação e Saída de Jogadores na Forca

const handleCommand = require('./controllers/commandHandler.js');
const sessionManager = require('./sessions/sessionManager.js');

// --- SIMULAÇÃO DO AMBIENTE DO BOT ---
const mockClient = {
    sendMessage: async (chatId, content, options = {}) => {
        const target = chatId.split('@')[0];
        console.log(`\n+++++++++++++ MENSAGEM DO BOT PARA ${target} +++++++++++++`);
        
        if (typeof content === 'object' && content.mimetype && content.mimetype.startsWith('image/')) {
            const caption = options.caption || "(sem legenda)";
            console.log(`[IMAGEM ENVIADA] 🖼️`);
            console.log(`Legenda: "${caption.replace(/\n/g, ' ')}"`);
        } else {
            console.log(content);
        }
        console.log(`++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n`);
    }
};

function createMockMessage(body, author, fromGroup) {
    return {
        body,
        author,
        from: fromGroup,
        reply: async (text) => await mockClient.sendMessage(fromGroup, text),
    };
}

// --- O EXECUTOR DOS TESTES ---
async function runTests() {
    console.log('--- INICIANDO TESTE DE ESTRESSE DO JOGO DA FORCA ---\n');

    const GROUP_ID = '123456789@g.us';
    const USERS = Array.from({ length: 8 }, (_, i) => `${i + 1}11111111@c.us`);

    const sendCommand = async (command, userId, isPrivate = false) => {
        const from = isPrivate ? userId : GROUP_ID;
        const message = createMockMessage(command, userId, from);
        console.log(`\n>>> [TESTE] Usuário ${userId.split('@')[0]} enviou: "${command}" ${isPrivate ? 'no PV' : 'no Grupo'}`);
        await handleCommand(message, mockClient);
        await new Promise(res => setTimeout(res, 100)); 
    };

    // =================================================================
    // CENÁRIO 1: JOGO DA FORCA (4 JOGADORES) COM SAÍDA
    // =================================================================
    console.log('\n\n--- CENÁRIO 1: FORCA COM 4 JOGADORES E SAÍDA DE JOGADOR ---');
    await sendCommand('!jogo forca', USERS[0]);
    await sendCommand('!entrar P1', USERS[0]);
    await sendCommand('!entrar P2', USERS[1]);
    await sendCommand('!entrar P3', USERS[2]);
    await sendCommand('!entrar P4', USERS[3]);
    await sendCommand('!iniciar', USERS[0]);
    
    // --- Rodada 1 (P1 define) ---
    console.log('\n>>> [TESTE] Rodada 1: P1 define a palavra.');
    await sendCommand('!palavra TESTE', USERS[0], true);
    await sendCommand('!letra T', USERS[1]); // P2 joga
    console.log('\n>>> [TESTE] P3 vai sair do jogo no meio da rodada.');
    await sendCommand('!sair', USERS[2]); // P3 sai do jogo
    await sendCommand('!letra E', USERS[3]); // P4 joga (o bot deve pular o P3)
    await sendCommand('!letra S', USERS[1]); // P2 joga e ganha a rodada

    // --- Rodada 2 (P2 define) ---
    console.log('\n>>> [TESTE] Rodada 2: A vez de definir deve passar para P2.');
    await sendCommand('!palavra VITORIA', USERS[1], true);
    console.log('\n>>> [TESTE] O próximo a jogar deve ser P4, pois P3 saiu e P1 já foi.');
    await sendCommand('!letra A', USERS[3]); // P4 joga
    await sendCommand('!letra I', USERS[0]); // P1 joga

    console.log('\n\n--- CENÁRIO 1 FINALIZADO ---');
    await sendCommand('!sair', USERS[0]); // Encerrando o jogo para o próximo cenário


    // =================================================================
    // CENÁRIO 2: JOGO DA FORCA (8 JOGADORES) TESTANDO A ROTAÇÃO COMPLETA
    // =================================================================
    console.log('\n\n--- CENÁRIO 2: FORCA COM 8 JOGADORES E ROTAÇÃO ---');
    if (sessionManager.getSession(GROUP_ID)) {
        console.error('!!! FALHA: Sessão anterior não foi encerrada corretamente !!!');
        return;
    }
    await sendCommand('!jogo forca', USERS[0]);
    for (let i = 0; i < 8; i++) {
        await sendCommand(`!entrar Player${i + 1}`, USERS[i]);
    }
    await sendCommand('!iniciar', USERS[0]);

    // --- Rodada 1 (Player1 define) ---
    console.log('\n>>> [TESTE] Rodada 1/8: Player1 define a palavra.');
    await sendCommand('!palavra JOGO', USERS[0], true);
    await sendCommand('!letra O', USERS[1]); // Player2 acerta e ganha

    // --- Rodada 2 (Player2 define) ---
    console.log('\n>>> [TESTE] Rodada 2/8: Vez de Player2 definir.');
    await sendCommand('!palavra BOT', USERS[1], true);
    await sendCommand('!letra B', USERS[2]); // Player3 acerta e ganha

    // --- Rodada 3 (Player3 define) ---
    console.log('\n>>> [TESTE] Rodada 3/8: Vez de Player3 definir.');
    await sendCommand('!palavra TESTE', USERS[2], true);
    console.log('\n>>> [TESTE] Player5 vai sair do jogo.');
    await sendCommand('!sair', USERS[4]); // Player5 sai
    await sendCommand('!letra T', USERS[3]); // Player4 joga


    console.log('\n\n--- SUÍTE DE TESTES FINALIZADA ---');
    console.log('VERIFIQUE O LOG ACIMA PARA CONFIRMAR SE A ROTAÇÃO DE JOGADORES E A SAÍDA FUNCIONARAM.');
}

// Executa os testes
runTests();
