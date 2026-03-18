const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const streamerDataPath = path.join(__dirname, '../DataBaseJson/fila_streamer.json');
const streamerRoomsPath = path.join(__dirname, '../DataBaseJson/fila_streamer_rooms.json');
const categoriaPath = path.join(__dirname, '../DataBaseJson/categoria.json');

function loadDB(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return {}; }
}

function saveDB(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getCategoriaId() {
  try {
    const data = JSON.parse(fs.readFileSync(categoriaPath, 'utf-8'));
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch { return null; }
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

    const categoriaId = getCategoriaId();
    const guild = interaction.guild;

    let canal;
    try {
      const jogador1 = await guild.members.fetch(jogador1Id);
      const jogador2 = await guild.members.fetch(jogador2Id);
      const streamer = await guild.members.fetch(fila.streamerId).catch(() => null);

      const overwrites = [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: jogador1Id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: jogador2Id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
      ];

      if (streamer) {
        overwrites.push({ id: fila.streamerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      }

      canal = await guild.channels.create({
        name: `streamer-${jogador1.user.username}-vs-${jogador2.user.username}`.substring(0, 100),
        type: ChannelType.GuildText,
        parent: categoriaId || undefined,
        permissionOverwrites: overwrites
      });

      const embed = new EmbedBuilder()
        .setTitle('⚔️ Fila Streamer — Confirme sua Participação')
        .setDescription(
          `**Streamer:** <@${fila.streamerId}>\n` +
          `**Descrição:** ${fila.descricao}\n` +
          `**Valor:** R$ ${fila.valor}\n\n` +
          `<@${jogador1Id}> e <@${jogador2Id}>, confirmem para iniciar a partida!\n\n` +
          `⏳ Ambos precisam confirmar para prosseguir.`
        )
        .setColor(0xF59E42)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`streamer_confirmar:${canal.id}`)
          .setLabel('Confirmar')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`streamer_cancelar:${canal.id}`)
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌')
      );

      const msg = await canal.send({
        content: `<@${jogador1Id}> <@${jogador2Id}>`,
        embeds: [embed],
        components: [row]
      });

      const rooms = loadDB(streamerRoomsPath);
      rooms[canal.id] = {
        jogador1: jogador1Id,
        jogador2: jogador2Id,
        streamerId: fila.streamerId,
        streamerName: fila.streamerName,
        descricao: fila.descricao,
        valor: fila.valor,
        confirmados: [],
        mensagemId: msg.id
      };
      saveDB(streamerRoomsPath, rooms);

      await interaction.editReply({
        content: `✅ Sala criada! Vá para ${canal} e confirme.`
      });

    } catch (e) {
      console.error('[FILA STREAMER] Erro ao criar sala:', e);

      fila.jogadores = fila.jogadores.filter(id => id !== jogador1Id && id !== jogador2Id);
      db[msgId] = fila;
      saveDB(streamerDataPath, db);

      await interaction.editReply({ content: '❌ Erro ao criar a sala. Tente novamente.' });

      if (canal) {
        canal.delete().catch(() => {});
      }
    }
  }
};
