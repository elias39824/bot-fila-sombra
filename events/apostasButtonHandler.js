// Adicione este código no seu arquivo principal de interactionCreate
// ou crie um novo event handler

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton()) return;
        
        // Verifica se é um botão de apostas
        if (interaction.customId.startsWith('apostas_')) {
            // Carrega o módulo de apostas
            const apostasModule = require('./apostas.js');
            
            // Chama o handler de botões
            await apostasModule.handleButton(interaction);
        }
    }
};