const { EmbedBuilder, ButtonStyle, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const { criarSalaAposta } = require('./matchRoomCreator');

const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const usersInfoPath = path.join(__dirname, '../DataBaseJson/usersinfo.json');

function getMatchDataFromDB(matchKey) {
  if (!fs.existsSync(filasDadosPath)) return null;
  try {
    const db = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
    return db[matchKey] || null;
  } catch (e) {
    console.error("[MATCH] Erro ao ler filasDados.json:", e);
    return null;
  }
}

function saveMatchDataToDB(matchKey, data) {
  try {
    let db = {};
    if (fs.existsSync(filasDadosPath)) {
      db = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
    }
    db[matchKey] = data;
    fs.writeFileSync(filasDadosPath, JSON.stringify(db, null, 2));
    return true;
  } catch (e) {
    console.error("[MATCH] Erro ao salvar filasDados.json:", e);
    return false;
  }
}

function removeMatchFromDB(matchKey) {
  try {
    if (!fs.existsSync(filasDadosPath)) return true;
    
    const db = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
    delete db[matchKey];
    fs.writeFileSync(filasDadosPath, JSON.stringify(db, null, 2));
    
    return true;
  } catch (e) {
    console.error("[MATCH] Erro ao remover do filasDados.json:", e);
    return false;
  }
}

function incrementarPartida(userId) {
  try {
    let db = {};
    if (fs.existsSync(usersInfoPath)) {
      db = JSON.parse(fs.readFileSync(usersInfoPath, 'utf-8'));
    }
    
    if (!db[userId]) {
      db[userId] = {
        id: userId,
        vitorias: 0,
        derrotas: 0,
        pontos: 0,
        partidas: 0
      };
    }
    
    db[userId].partidas = (db[userId].partidas || 0) + 1;
    
    fs.writeFileSync(usersInfoPath, JSON.stringify(db, null, 2));
    return true;
  } catch (e) {
    console.error("[MATCH] Erro ao incrementar partida:", e);
    return false;
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;
    
    const customId = interaction.customId;
    
    if (!['match_confirmar', 'match_recusar'].includes(customId)) return;

    const thread = interaction.channel;
    const userId = interaction.user.id;
    const matchKey = thread.id;

    try {
      await interaction.deferReply({ ephemeral: true }).catch(err => {
        return interaction.reply({ 
          content: 'Processando...', 
          ephemeral: true 
        }).catch(() => null);
      });

      const matchData = getMatchDataFromDB(matchKey);
      
      if (!matchData || !matchData.jogadores || matchData.jogadores.length === 0) {
        return interaction.editReply({ 
          content: `${emojis.failuser_emoji || 'X'} Dados da partida nao encontrados.` 
        }).catch(() => {
          interaction.followUp({ 
            content: `${emojis.failuser_emoji || 'X'} Dados da partida nao encontrados.`,
            ephemeral: true 
          }).catch(() => {});
        });
      }

      const jogadoresIds = matchData.jogadores.map(j => {
        return typeof j === 'object' ? j.id : j;
      });
      
      const totalJogadores = jogadoresIds.length;

      if (!jogadoresIds.includes(userId)) {
        return interaction.editReply({ 
          content: `${emojis.failuser_emoji || 'X'} Voce nao faz parte desta partida!` 
        }).catch(() => {
          interaction.followUp({ 
            content: `${emojis.failuser_emoji || 'X'} Voce nao faz parte desta partida!`,
            ephemeral: true 
          }).catch(() => {});
        });
      }

      if (customId === 'match_confirmar') {
        
        if (!matchData.confirmados) {
          matchData.confirmados = [];
        }

        if (matchData.confirmados.includes(userId)) {
          return interaction.editReply({ 
            content: `${emojis.failuser_emoji || 'X'} Voce ja confirmou esta aposta!` 
          }).catch(() => {
            interaction.followUp({ 
              content: `${emojis.failuser_emoji || 'X'} Voce ja confirmou esta aposta!`,
              ephemeral: true 
            }).catch(() => {});
          });
        }

        matchData.confirmados.push(userId);
        saveMatchDataToDB(matchKey, matchData);

        const confirmadosCount = matchData.confirmados.length;
        const faltando = jogadoresIds.filter(id => !matchData.confirmados.includes(id));

        const embedConfirm = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('Aposta Confirmada')
          .setDescription(
            `**${interaction.user.username}** confirmou a participacao.\n\n` +
            `**Confirmados:** ${confirmadosCount}/${totalJogadores}\n` +
            (faltando.length > 0 ? `**Aguardando:** ${faltando.map(id => `<@${id}>`).join(', ')}` : '**Todos confirmaram!**')
          )
          .setTimestamp();

        await thread.send({ embeds: [embedConfirm] }).catch(() => {});
        
        await interaction.editReply({ 
          content: `${emojis.confirmed_emoji || 'OK'} Confirmacao registrada!` 
        }).catch(() => {});

        if (confirmadosCount === totalJogadores) {

          await thread.send({ 
            content: `${emojis.confirmed_emoji || 'OK'} **Todos confirmaram!** Criando Sala de Aposta...` 
          }).catch(() => {});

          try {
            const jogadores = await Promise.all(
              jogadoresIds.map(id => interaction.guild.members.fetch(id).then(m => m.user))
            );

            const canal = await criarSalaAposta(
              interaction.guild,
              jogadores[0],
              jogadores[1],
              matchData.modo,
              matchData.tipo,
              matchData.valor,
              matchData.time || null
            );

            jogadoresIds.forEach(id => incrementarPartida(id));

            removeMatchFromDB(matchKey);

            const embedSucesso = new EmbedBuilder()
              .setColor(0x00ff00)
              .setTitle('Sala de Aposta Criada!')
              .setDescription(
                `**Partida confirmada com sucesso!**\n\n` +
                `**Sala:** ${canal}\n` +
                `**Jogadores:** ${jogadores.map(u => u.username).join(' vs ')}\n` +
                `**Valor:** R$ ${matchData.valor}\n\n` +
                `**Clique no botao abaixo para ir direto para a sala!**`
              )
              .setTimestamp()
              .setFooter({ text: 'Boa sorte na partida!' });

            const botaoIrParaCanal = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel('Ir para Sala de Aposta')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${interaction.guild.id}/${canal.id}`)
            );

            await thread.send({ 
              embeds: [embedSucesso], 
              components: [botaoIrParaCanal] 
            }).catch(() => {});

            setTimeout(() => {
              thread.delete('Sala de aposta criada').catch(() => {});
            }, 10000);

          } catch (error) {
            console.error(`[MATCH] ERRO ao criar sala:`, error);
            
            await thread.send({ 
              content: `${emojis.failuser_emoji || 'X'} **ERRO:** Nao foi possivel criar a sala de aposta.\n\`\`\`${error.message}\`\`\`` 
            }).catch(() => {});
          }
        }
      }

      else if (customId === 'match_recusar') {

        const embedRecusa = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Aposta Recusada')
          .setDescription(
            `**${interaction.user.username}** recusou a aposta.\n\n` +
            `O topico sera fechado em 3 segundos.`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embedRecusa] }).catch(() => {
          interaction.followUp({ embeds: [embedRecusa], ephemeral: true }).catch(() => {});
        });

        await thread.send({ embeds: [embedRecusa] }).catch(() => {});

        removeMatchFromDB(matchKey);

        setTimeout(() => {
          thread.delete('Aposta recusada').catch(() => {});
        }, 3000);
      }

    } catch (error) {
      console.error('[MATCH] Erro critico:', error);
      
      const errorMsg = `${emojis.failuser_emoji || 'X'} Erro ao processar acao. Tente novamente.`;
      
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ content: errorMsg }).catch(() => {});
        } else {
          await interaction.reply({ content: errorMsg, ephemeral: true }).catch(() => {});
        }
      } catch (e) {
        console.error('[MATCH] Erro ao enviar mensagem:', e.message);
      }
    }
  }
};