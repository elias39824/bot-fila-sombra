const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const emojis = require('../DataBaseJson/emojis.json');
const { logManager } = require('./matchRoomCreator');

// Caminhos
const usersPath = path.join(__dirname, '../DataBaseJson/usersinfo.json');
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const configPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');

// Funções auxiliares
function getUserInfo(id) {
  let db = {};
  if (fs.existsSync(usersPath)) {
    try {
      db = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    } catch (e) {}
  }
  
  if (!db[id]) {
    db[id] = { 
      id, 
      vitorias: 0, 
      derrotas: 0, 
      pontos: 0, 
      partidas: 0 
    };
  }
  
  return db[id];
}

function saveUserInfo(user) {
  let db = {};
  if (fs.existsSync(usersPath)) {
    try {
      db = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    } catch (e) {}
  }
  
  db[user.id] = user;
  
  try {
    fs.writeFileSync(usersPath, JSON.stringify(db, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

function getPontosConfig() {
  if (!fs.existsSync(configPath)) {
    return 3;
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const pontos = parseInt(config.pontos_vitoria);
    
    if (isNaN(pontos) || pontos < 1) {
      return 3;
    }
    
    return pontos;
  } catch (e) {
    return 3;
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isStringSelectMenu()) return;
    if (interaction.customId !== 'definir_vencedor') return;

    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      let filasDados = {};
      if (fs.existsSync(filasDadosPath)) {
        try {
          filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
        } catch (e) {}
      }

      const partida = filasDados[interaction.channel.id];

      if (!partida) {
        return interaction.editReply({ 
          content: `${emojis.failuser_emoji || '❌'} Dados da partida não encontrados.` 
        });
      }

      if (!partida.id_mediador) {
        return interaction.editReply({ 
          content: `${emojis.failuser_emoji || '❌'} Mediador não identificado.` 
        });
      }

      if (interaction.user.id !== partida.id_mediador) {
        return interaction.editReply({ 
          content: `${emojis.failuser_emoji || '❌'} Apenas o mediador pode definir o vencedor.` 
        });
      }

      const winnerId = interaction.values[0];
      
      let jogadores = [];
      
      if (partida.jogadores && Array.isArray(partida.jogadores) && partida.jogadores.length === 2) {
        jogadores = partida.jogadores;
      } else {
        const msgs = await interaction.channel.messages.fetch({ limit: 20 });
        const primeiraMsgBot = msgs.find(m => 
          m.author.id === interaction.client.user.id && 
          m.embeds.length > 0 &&
          m.embeds[0].fields
        );
        
        if (primeiraMsgBot) {
          const jogadoresField = primeiraMsgBot.embeds[0].fields.find(f => 
            f.name.toLowerCase().includes('jogadores')
          );
          
          if (jogadoresField) {
            const matches = jogadoresField.value.match(/<@!?(\d+)>/g);
            if (matches && matches.length >= 2) {
              jogadores = matches.slice(0, 2).map(m => m.replace(/<@!?|>/g, ''));
            }
          }
        }
      }

      if (jogadores.length !== 2) {
        return interaction.editReply({ 
          content: `${emojis.failuser_emoji || '❌'} Não foi possível identificar os jogadores.` 
        });
      }

      const loserId = jogadores.find(id => id !== winnerId);

      if (!loserId) {
        return interaction.editReply({ 
          content: `${emojis.failuser_emoji || '❌'} Não foi possível identificar o perdedor.` 
        });
      }

      const pontos = getPontosConfig();

      let winner = getUserInfo(winnerId);
      let loser = getUserInfo(loserId);

      winner.vitorias = (winner.vitorias || 0) + 1;
      winner.pontos = (winner.pontos || 0) + pontos;
      winner.partidas = (winner.partidas || 0) + 1;

      loser.derrotas = (loser.derrotas || 0) + 1;
      loser.partidas = (loser.partidas || 0) + 1;

      saveUserInfo(winner);
      saveUserInfo(loser);

      if (logManager && logManager.sessoes.has(interaction.channel.id)) {
        logManager.registrarAcao(interaction.channel.id, 'vencedor', winnerId, {
          perdedorId: loserId,
          pontos: pontos,
          vitorias: winner.vitorias,
          derrotas: loser.derrotas
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`${emojis.confirmed_emoji || '✅'} Vencedor Definido!`)
        .setDescription(
          `**Vencedor:** <@${winnerId}>\n` +
          `**Pontos recebidos:** ${pontos}\n` +
          `**Total de vitórias:** ${winner.vitorias}\n\n` +
          `**Perdedor:** <@${loserId}>\n` +
          `**Total de derrotas:** ${loser.derrotas}`
        )
        .setColor('#00FF00')
        .setFooter({ text: '🗑️ O canal será apagado em 5 segundos' })
        .setTimestamp();

      await interaction.editReply({ 
        embeds: [embed], 
        components: [] 
      });

      await interaction.channel.send({ 
        embeds: [embed] 
      });

      if (logManager && logManager.sessoes.has(interaction.channel.id)) {
        await logManager.finalizarSessao(interaction.channel.id, 'Partida finalizada - Vencedor definido');
      }

      delete filasDados[interaction.channel.id];
      try {
        fs.writeFileSync(filasDadosPath, JSON.stringify(filasDados, null, 2), 'utf-8');
      } catch (e) {}

      setTimeout(() => {
        interaction.channel.delete('Partida finalizada').catch(() => {});
      }, 5000);

    } catch (error) {
      try {
        const reply = {
          content: `${emojis.failuser_emoji || '❌'} Erro ao processar. Tente novamente.`,
          components: []
        };

        if (interaction.deferred && !interaction.replied) {
          await interaction.editReply(reply);
        } else if (!interaction.replied) {
          await interaction.reply({ ...reply, ephemeral: true });
        }
      } catch (e) {}
    }
  }
};