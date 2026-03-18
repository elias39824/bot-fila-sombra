const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const emojis = require('../DataBaseJson/emojis.json');
const { logManager } = require('./matchRoomCreator');

// Caminhos
const usersPath = path.join(__dirname, '../DataBaseJson/usersinfo.json');
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const configPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');
const colorPath = path.join(__dirname, '../DataBaseJson/bot_color.json');

// 🎨 Função para obter a cor escolhida
function getCorEscolhida() {
  try {
    if (!fs.existsSync(colorPath)) {
      return '#00FF00';
    }
    const data = fs.readFileSync(colorPath, 'utf-8');
    const colorData = JSON.parse(data);
    return colorData.cor || '#00FF00';
  } catch (e) {
    return '#00FF00';
  }
}

// Funções auxiliares
function getUsersDB() {
  if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, JSON.stringify({}), 'utf-8');
    return {};
  }
  
  try {
    const data = fs.readFileSync(usersPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('[USERS DB] Erro ao ler:', e);
    return {};
  }
}

function saveUsersDB(db) {
  try {
    fs.writeFileSync(usersPath, JSON.stringify(db, null, 2), 'utf-8');
    console.log('[USERS DB] ✅ Salvo com sucesso');
    return true;
  } catch (e) {
    console.error('[USERS DB] ❌ Erro ao salvar:', e);
    return false;
  }
}

function getUserInfo(db, id) {
  if (!db[id]) {
    db[id] = { 
      id, 
      vitorias: 0, 
      derrotas: 0, 
      pontos: 0, 
      partidas: 0 
    };
    console.log(`[USERS DB] 📝 Novo usuário criado: ${id}`);
  }
  return db[id];
}

function getPontosConfig() {
  if (!fs.existsSync(configPath)) {
    console.warn('[CONFIG] Arquivo não encontrado. Usando pontos padrão: 3');
    return 3;
  }
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const pontos = parseInt(config.pontos_vitoria);
    
    if (isNaN(pontos) || pontos < 1) {
      console.warn('[CONFIG] Pontos inválidos. Usando padrão: 3');
      return 3;
    }
    
    console.log(`[CONFIG] Pontos por vitória: ${pontos}`);
    return pontos;
  } catch (e) {
    console.error('[CONFIG] Erro ao ler:', e);
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

      console.log('[VENCEDOR] 🎮 Processando vitória via select menu...');
      console.log(`[VENCEDOR] 🏆 Vencedor: ${winnerId}`);
      console.log(`[VENCEDOR] 💀 Perdedor: ${loserId}`);

      const pontos = getPontosConfig();
      const corEscolhida = getCorEscolhida();

      // 🔥 CARREGAR DB COMPLETO
      let usersDB = getUsersDB();

      // 🔥 PEGAR/CRIAR INFORMAÇÕES DOS JOGADORES
      let winner = getUserInfo(usersDB, winnerId);
      let loser = getUserInfo(usersDB, loserId);

      console.log('[VENCEDOR] 📊 ANTES - Vencedor:', JSON.stringify(winner));
      console.log('[VENCEDOR] 📊 ANTES - Perdedor:', JSON.stringify(loser));

      // 🔥 ATUALIZAR ESTATÍSTICAS DO VENCEDOR
      winner.vitorias = (winner.vitorias || 0) + 1;
      winner.pontos = (winner.pontos || 0) + pontos;
      winner.partidas = (winner.partidas || 0) + 1;

      // 🔥 ATUALIZAR ESTATÍSTICAS DO PERDEDOR
      loser.derrotas = (loser.derrotas || 0) + 1;
      loser.partidas = (loser.partidas || 0) + 1;

      console.log('[VENCEDOR] 📊 DEPOIS - Vencedor:', JSON.stringify(winner));
      console.log('[VENCEDOR] 📊 DEPOIS - Perdedor:', JSON.stringify(loser));

      // 🔥 SALVAR NO DB (CRÍTICO!)
      usersDB[winnerId] = winner;
      usersDB[loserId] = loser;

      const salvou = saveUsersDB(usersDB);

      if (!salvou) {
        console.error('[VENCEDOR] ❌ FALHA AO SALVAR NO BANCO DE DADOS!');
        return interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} Erro ao salvar estatísticas! Tente novamente.`
        });
      }

      console.log('[VENCEDOR] ✅ Estatísticas salvas com sucesso!');

      if (logManager && logManager.sessoes.has(interaction.channel.id)) {
        logManager.registrarAcao(interaction.channel.id, 'vencedor', winnerId, {
          perdedorId: loserId,
          pontos: pontos,
          vitorias: winner.vitorias,
          derrotas: loser.derrotas
        });
      }

      // 🎨 EMBED MELHORADA
      const embed = new EmbedBuilder()
        .setTitle('Vencedor Definido!')
        .setDescription(
          `A partida foi concluída e o resultado foi registrado.\n\n` +
          `**Vencedor:** <@${winnerId}>\n` +
          `**Perdedor:** <@${loserId}>\n\n` +
          `**Pontos concedidos:** +${pontos} pontos`
        )
        .setColor(corEscolhida)
        .addFields(
          { 
            name: 'Estatísticas do Vencedor', 
            value: `Vitórias: **${winner.vitorias}**\nPontos Totais: **${winner.pontos}**\nPartidas: **${winner.partidas}**`, 
            inline: true 
          },
          { 
            name: 'Estatísticas do Perdedor', 
            value: `Derrotas: **${loser.derrotas}**\nPontos Totais: **${loser.pontos || 0}**\nPartidas: **${loser.partidas}**`, 
            inline: true 
          }
        )
        .setFooter({ text: 'Selecione uma ação abaixo' })
        .setTimestamp();

      // 🎮 BOTÕES DE AÇÃO
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('aposta_revanche')
          .setLabel('Revanche')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._star_emoji || '🔄'),
        new ButtonBuilder()
          .setCustomId('aposta_alterar_valor')
          .setLabel('Alterar Valor')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._money_emoji || '💰'),
        new ButtonBuilder()
          .setCustomId('aposta_finalizar')
          .setLabel('Finalizar Aposta')
          .setStyle(ButtonStyle.Danger)
          .setEmoji(emojis._fixe_emoji || '🛑')
      );

      await interaction.editReply({ 
        content: `${emojis.confirmed_emoji || '✅'} Vencedor registrado com sucesso!`,
        ephemeral: true
      });

      await interaction.channel.send({ 
        embeds: [embed],
        components: [row]
      });

    } catch (error) {
      console.error('[VENCEDOR] ❌ Erro crítico:', error);
      
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