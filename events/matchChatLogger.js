const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');

// CORREÇÃO: Importando do arquivo correto 'matchRoomCreator'
const { logManager } = require('./matchRoomCreator');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Ignorar bots
    if (message.author.bot) return;
    
    // Ignorar se não for canal de texto
    if (message.channel.type !== 0) return;

    try {
      // Ler o banco de dados das salas para ver se este canal é uma aposta ativa
      const data = await fs.readFile(filasDadosPath, 'utf-8');
      const filasDados = JSON.parse(data);
      
      const salaData = filasDados[message.channel.id];

      // Só registrar mensagens se a sala estiver 'iniciada'
      if (salaData && salaData.status === 'iniciada') {
        console.log(`[LOGGER] 💬 Mensagem capturada em ${message.channel.tag} (${message.channel.id})`);
        
        // Envia o objeto message inteiro para o logManager salvar no JSON
        logManager.registrarMensagem(message.channel.id, message);
      }
    } catch (error) {
      console.error('[LOGGER] ❌ Erro ao processar mensagem:', error);
    }
  }
};