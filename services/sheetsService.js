const { google } = require('googleapis');
const path = require('path');

// Carrega as credenciais e o ID da planilha do .env
const KEYFILEPATH = path.join(__dirname, '..', 'credentials.json');
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Configura a autenticação
const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth: auth });

/**
 * Adiciona uma nova transação à planilha do Google Sheets.
 * @param {object} transacao - O objeto da transação salvo no MongoDB.
 */
async function adicionarTransacao(transacao) {
    if (!SPREADSHEET_ID) {
        console.warn('[SheetsService] GOOGLE_SHEET_ID não definido no .env. Planilha não será atualizada.');
        return;
    }

    try {
        const linhaParaAdicionar = [
            new Date(transacao.createdAt).toLocaleString('pt-BR'),
            transacao.tipo.charAt(0).toUpperCase() + transacao.tipo.slice(1),
            transacao.valor.toString().replace('.', ','), // Formato de moeda brasileiro
            transacao.categoria,
            transacao.descricao || '', // Garante que não seja nulo
            transacao.userId
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Página1!A:F', // Ajuste 'Página1' se o nome da sua aba for diferente
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [linhaParaAdicionar],
            },
        });
        console.log('[SheetsService] Transação adicionada à planilha com sucesso.');
    } catch (error) {
        console.error('Erro ao adicionar linha na planilha do Google Sheets:', error);
    }
}

module.exports = { adicionarTransacao };