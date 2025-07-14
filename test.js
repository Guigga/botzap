// test.js - Teste de Lógica para o Jogo de UNO (2 Jogadores)

const handleCommand = require('./controllers/commandHandler.js');
const sessionManager = require('./sessions/sessionManager.js');
const unoBot = require('./games/Uno/botPlayer');

// --- SIMULAÇÃO DO AMBIENTE DO BOT ---
const mockClient = {
    sendMessage: async (chatId, content, options = {}) => {
        const target = chatId.split('@')[0];
        console.log(`\n+++++++++++++ MENSAGEM DO BOT PARA ${target} +++++++++++++`);
        console.log(String(content).replace(/\n\n/g, '\n')); // Compacta linhas em branco
        console.log(`++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++\n`);
    }
};

function createMockMessage(body, author, fromGroup) {
    return {
        body,
        author,
        from: fromGroup,
        reply: async (text) => await mockClient.sendMessage(fromGroup, text),
        getChat: async () => ({ isGroup: fromGroup.endsWith('@g.us'), name: 'Grupo de Teste' }),
        getContact: async () => ({ pushname: author.split('@')[0] })
    };
}

const GROUP_ID = '123456789@g.us';
const HUMAN_ID = `player1@c.us`;

const sendCommand = async (command, userId) => {
    const message = createMockMessage(command, userId, GROUP_ID);
    console.log(`\n>>> [TESTE] Usuário ${userId.split('@')[0]} enviou: "${command}"`);
    await handleCommand(message, mockClient);
    await new Promise(res => setTimeout(res, 1500)); // Pausa para processamento
};


// --- CENÁRIOS DE TESTE ---

async function testeDeAcumulo() {
    console.log('\n\n--- CENÁRIO 1: Testando Acúmulo de +2 ---');
    await sendCommand('!jogo uno', HUMAN_ID);
    await sendCommand('!entrar Humano', HUMAN_ID);
    await sendCommand('!iniciar', HUMAN_ID);

    console.log("\n>>> [AÇÃO] O Humano vai jogar a carta 1. Assumimos que é um +2.");
    console.log(">>> [VERIFICAÇÃO] O log deve mostrar que o Bot comprou 2 cartas ou jogou outro +2.");
    await sendCommand('!jogar 1', HUMAN_ID);

    // Aguarda a vez do bot e a próxima vez do humano
    await new Promise(res => setTimeout(res, 3000)); 

    console.log("\n>>> [AÇÃO] O Humano vai jogar a carta 1 novamente. Assumimos que é um +4.");
     console.log(">>> [VERIFICAÇÃO] O log deve mostrar o efeito acumulado e que a vez passou para o Bot sob este efeito.");
    await sendCommand('!jogar 1 azul', HUMAN_ID);
    
    await sendCommand('!sair', HUMAN_ID);
    console.log('--- CENÁRIO 1 FINALIZADO ---');
}

async function testeDeReembaralhamento() {
    console.log('\n\n--- CENÁRIO 2: Testando Reembaralhamento ---');
    await sendCommand('!jogo uno', HUMAN_ID);
    await sendCommand('!entrar Humano', HUMAN_ID);
    await sendCommand('!iniciar', HUMAN_ID);

    console.log("\n>>> [AÇÃO] Forçando o baralho a acabar. O Humano comprará cartas repetidamente.");
    console.log(">>> [AVISO] Mensagens de 'Opa, não é a sua vez' são normais, pois o Bot também joga.");
    for (let i = 0; i < 45; i++) {
        // O bot jogará entre os comandos do humano. O teste força a compra quando for a vez do humano.
        await sendCommand('!comprar', HUMAN_ID);
        await sendCommand('!passar', HUMAN_ID);
    }
    
    console.log("\n>>> [VERIFICAÇÃO] VERIFIQUE NO LOG ACIMA A MENSAGEM: 'O baralho acabou! Reembaralhando as cartas da mesa...'");
    await sendCommand('!sair', HUMAN_ID);
    console.log('--- CENÁRIO 2 FINALIZADO ---');
}


async function runAllTests() {
    await testeDeAcumulo();
    await new Promise(res => setTimeout(res, 2000)); // Pausa entre cenários
    await testeDeReembaralhamento();
    console.log('\n\n--- TODOS OS TESTES FORAM CONCLUÍDOS ---');
}

// Executa os testes
runAllTests();