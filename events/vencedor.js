const { PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');
const { logManager } = require('./matchRoomCreator');

// --- Caminhos ---
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const mediadoresPath = path.join(__dirname, '../DataBaseJson/mediadores.json');
const usersPath = path.join(__dirname, '../DataBaseJson/usersinfo.json');
const configPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');
const colorPath = path.join(__dirname, '../DataBaseJson/bot_color.json');

// --- Funções Auxiliares ---

function isMediator(member) {
  let mediatorRoleIds = [];
  try {
    const data = fs.readFileSync(mediadoresPath, 'utf-8');
    mediatorRoleIds = JSON.parse(data);
  } catch (e) {
    // Falha silenciosa na leitura do JSON
  }

  if (mediatorRoleIds.some(roleId => member.roles.cache.has(roleId))) {
    return true;
  }
  return member.permissions.has(PermissionsBitField.Flags.ManageChannels);
}

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

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Ignora mensagens de bots
    if (message.author.bot) return;
    
    // Verifica se a mensagem começa com !v
    if (!message.content.startsWith('!v ')) return;
    
    try {
      // Verifica se é mediador
      if (!isMediator(message.member)) {
        return message.reply({ 
          content: `${emojis.failuser_emoji || '❌'} Apenas membros com cargo de Mediador podem usar este comando.`
        });
      }

      // Extrai a menção do usuário
      const mentioned = message.mentions.users.first();
      
      if (!mentioned) {
        return message.reply({ 
          content: `${emojis.failuser_emoji || '❌'} Você precisa mencionar um jogador! Uso correto: \`!v @jogador\``
        });
      }

      // Verifica se existe uma partida ativa no canal
      let filasDados = {};
      if (fs.existsSync(filasDadosPath)) {
        try {
          filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
        } catch(err) {
          console.error("[FILAS DADOS] Erro ao ler:", err);
          return message.reply({ 
            content: `${emojis.failuser_emoji || '❌'} Erro ao acessar dados da partida.`
          });
        }
      }

      const partida = filasDados[message.channel.id];
      
      if (!partida) {
        return message.reply({ 
          content: `${emojis.failuser_emoji || '❌'} Não há partida ativa neste canal.`
        });
      }

      // Verifica se o usuário mencionado está na partida
      const jogadoresIDs = Array.isArray(partida.jogadores) 
        ? partida.jogadores.map(j => (typeof j === 'object' && j.id) ? j.id : j)
        : [];
      
      if (!jogadoresIDs.includes(mentioned.id)) {
        return message.reply({ 
          content: `${emojis.failuser_emoji || '❌'} O usuário mencionado não está nesta partida!\n` +
                   `Jogadores: ${jogadoresIDs.map(id => `<@${id}>`).join(', ')}`
        });
      }

      console.log('[VENCEDOR] 🎮 Processando vitória...');

      // --- PROCESSAR VENCEDOR ---
      const winnerId = mentioned.id;
      const loserId = jogadoresIDs.find(id => id !== winnerId);

      if (!loserId) {
        return message.reply({ 
          content: `${emojis.failuser_emoji || '❌'} Não foi possível identificar o perdedor.`
        });
      }

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
        return message.reply({
          content: `${emojis.failuser_emoji || '❌'} Erro ao salvar estatísticas! Tente novamente.`
        });
      }

      console.log('[VENCEDOR] ✅ Estatísticas salvas com sucesso!');

      // Registrar no log
      if (logManager && logManager.sessoes.has(message.channel.id)) {
        logManager.registrarAcao(message.channel.id, 'vencedor', winnerId, {
          perdedorId: loserId,
          pontos: pontos,
          vitorias: winner.vitorias,
          derrotas: loser.derrotas,
          metodo: 'comando_!v',
          mediador: message.author.id
        });
      }

      // 🎨 EMBED MELHORADA COM ESTATÍSTICAS
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
        .setThumbnail(mentioned.displayAvatarURL())
        .setFooter({ text: `Definido por ${message.author.tag}` })
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

      await message.reply({ 
        embeds: [embed],
        components: [row]
      });

      // Deleta a mensagem do comando após 3 segundos
      setTimeout(() => {
        message.delete().catch(() => {});
      }, 3000);

    } catch (error) {
      console.error('[VENCEDOR] ❌ Erro crítico:', error);
      message.reply({ 
        content: `${emojis.failuser_emoji || '❌'} Ocorreu um erro ao processar o comando.`
      }).catch(() => {});
    }
  }
};