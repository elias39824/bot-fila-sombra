const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { criarSalaAposta } = require('./matchRoomCreator');

const streamerRoomsPath = path.join(__dirname, '../DataBaseJson/fila_streamer_rooms.json');

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

    const { customId } = interaction;
    if (!customId.startsWith('streamer_confirmar:') && !customId.startsWith('streamer_cancelar:')) return;

    const canalId = customId.split(':')[1];
    const rooms = loadDB(streamerRoomsPath);
    const room = rooms[canalId];

    if (!room) {
      return interaction.reply({ content: '❌ Esta sala não está mais ativa.', ephemeral: true });
    }

    const userId = interaction.user.id;
    if (userId !== room.jogador1 && userId !== room.jogador2) {
      return interaction.reply({ content: '❌ Você não faz parte desta partida.', ephemeral: true });
    }

    // --- CANCELAR ---
    if (customId.startsWith('streamer_cancelar:')) {
      await interaction.deferUpdate();

      delete rooms[canalId];
      saveDB(streamerRoomsPath, rooms);

      try {
        await interaction.channel.send({
          content: `❌ <@${userId}> cancelou a partida. Este canal será fechado em 5 segundos.`
        });
      } catch {}

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);

      return;
    }

    // --- CONFIRMAR ---
    await interaction.deferReply({ ephemeral: true });

    if (room.confirmados.includes(userId)) {
      return interaction.editReply({ content: '⚠️ Você já confirmou! Aguardando o outro jogador.' });
    }

    room.confirmados.push(userId);
    rooms[canalId] = room;
    saveDB(streamerRoomsPath, rooms);

    if (room.confirmados.length < 2) {
      await interaction.editReply({ content: '✅ Você confirmou! Aguardando o outro jogador confirmar...' });

      const outro = room.confirmados[0] === room.jogador1 ? room.jogador2 : room.jogador1;
      try {
        await interaction.channel.send({
          content: `✅ <@${userId}> confirmou! Aguardando <@${outro}>...`
        });
      } catch {}

      return;
    }

    // --- AMBOS CONFIRMARAM → CRIAR SALA DE APOSTA ---
    delete rooms[canalId];
    saveDB(streamerRoomsPath, rooms);

    try {
      await interaction.channel.send({
        content: `✅ Ambos confirmaram! Criando sala de partida...\nEste canal será fechado em instantes.`
      });
    } catch {}

    setTimeout(() => {
      interaction.channel.delete().catch(() => {});
    }, 3000);

    try {
      const guild = interaction.guild;
      const jogador1 = await guild.members.fetch(room.jogador1);
      const jogador2 = await guild.members.fetch(room.jogador2);

      await criarSalaAposta(
        guild,
        jogador1.user,
        jogador2.user,
        room.descricao,
        'Streamer',
        room.valor,
        null
      );

      await interaction.editReply({ content: '✅ Sala de partida criada com sucesso! Verifique os canais.' });
    } catch (e) {
      console.error('[FILA STREAMER CONFIRM] Erro ao criar sala de aposta:', e);
      await interaction.editReply({ content: '❌ Erro ao criar a sala de partida. Contate um administrador.' });
    }
  }
};
