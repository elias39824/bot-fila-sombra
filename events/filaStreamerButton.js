const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { criarSalaAposta } = require('./matchRoomCreator');

const streamerDataPath = path.join(__dirname, '../DataBaseJson/fila_streamer.json');

function loadDB(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return {}; }
}

function saveDB(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'jogar_contra_streamer') return;

    await interaction.deferReply({ ephemeral: true });

    const msgId = interaction.message.id;
    const db = loadDB(streamerDataPath);
    const fila = db[msgId];

    if (!fila) {
      return interaction.editReply({ content: '❌ Esta fila não está mais ativa.' });
    }

    const userId = interaction.user.id;

    if (fila.jogadores.includes(userId)) {
      return interaction.editReply({ content: '❌ Você já está na fila!' });
    }

    if (fila.jogadores.length >= 2) {
      return interaction.editReply({ content: '❌ Esta fila já está cheia!' });
    }

    fila.jogadores.push(userId);
    db[msgId] = fila;
    saveDB(streamerDataPath, db);

    if (fila.jogadores.length < 2) {
      return interaction.editReply({
        content: `✅ Você entrou na fila! Aguardando mais 1 jogador... (${fila.jogadores.length}/2)`
      });
    }

    const [jogador1Id, jogador2Id] = fila.jogadores;

    delete db[msgId];
    saveDB(streamerDataPath, db);

    const guild = interaction.guild;

    try {
      const jogador1 = await guild.members.fetch(jogador1Id);
      const jogador2 = await guild.members.fetch(jogador2Id);

      await criarSalaAposta(
        guild,
        jogador1.user,
        jogador2.user,
        fila.descricao || 'Fila Streamer',
        'Streamer',
        fila.valor || '0,00',
        null
      );

      await interaction.editReply({
        content: `✅ Partida criada! <@${jogador1Id}> vs <@${jogador2Id}> — verifique os canais.`
      });

    } catch (e) {
      console.error('[FILA STREAMER] Erro ao criar sala:', e);

      const dbAtual = loadDB(streamerDataPath);
      if (!dbAtual[msgId]) {
        fila.jogadores = [];
        dbAtual[msgId] = fila;
        saveDB(streamerDataPath, dbAtual);
      }

      await interaction.editReply({
        content: `❌ Erro ao criar a sala de partida: ${e.message || 'erro desconhecido'}. Contate um administrador.`
      });
    }
  }
};
