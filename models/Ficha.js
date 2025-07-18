// models/Ficha.js

const mongoose = require('mongoose');

// Este é o "molde" da sua ficha. Ele define os campos e seus tipos.
const fichaSchema = new mongoose.Schema({
    playerId: { type: String, required: true, unique: true },
    nome: { type: String, default: "Sem Nome" },
    classe: { type: String, default: "N/A" },
    raca: { type: String, default: "N/A" },
    nivel: { type: Number, default: 1 },
    
    // --- NOVOS CAMPOS NARRATIVOS E FÍSICOS ---
    idade: { type: String, default: "N/A" },
    altura: { type: String, default: "N/A" },
    peso: { type: String, default: "N/A" },
    alinhamento: { type: String, default: "N/A" },
    antecedente: { type: String, default: "N/A" },
    divindade: { type: String, default: "N/A" },
    historia: { type: String, default: "N/A" },

    // Atributos Principais
    hp_max: { type: Number, default: 10 },
    hp_atual: { type: Number, default: 10 },
    ca: { type: Number, default: 10 },
    forca: { type: Number, default: 10 },
    destreza: { type: Number, default: 10 },
    constituicao: { type: Number, default: 10 },
    inteligencia: { type: Number, default: 10 },
    sabedoria: { type: Number, default: 10 },
    carisma: { type: Number, default: 10 },
    
    // Listas
    inventario: [String],
    habilidades: [String],
    ataques: [String],
    magias: [String],
});

module.exports = mongoose.model('Ficha', fichaSchema);
