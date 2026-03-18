const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const configPath = path.join(__dirname, '../config.json');
const streamerDataPath = path.join(__dirname, '../DataBaseJson/fila_streamer.json');

function isOwner(userId) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    return config.ownerId === userId;
  } catch {
    return false;
  }
}

function saveStreamerQueue(msgId, data) {
  let db = {};
  if (fs.existsSync(streamerDataPath)) {
    try { db = JSON.parse(fs.readFileSync(streamerDataPath, 'utf-8')); } catch {}
  }
  db[msgId] = data;
  fs.writeFileSync(streamerDataPath, JSON.stringify(db, null, 2), 'utf-8');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fila_streamer')
    .setDescription('Cria uma fila para jogar contra um streamer.')
    .addUserOption(opt =>
      opt.setName('streamer')
        .setDescription('O streamer que vai jogar')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('descricao')
        .setDescription('Texto da partida (ex: Full Ump e Xm8)')
        .setRequired(true)
    )
    .addChannelOption(opt =>
      opt.setName('canal')
        .setDescription('Canal onde a fila será postada')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('valor')
        .setDescription('Valor da aposta (ex: 10,00)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Apenas o dono pode usar este comando!', ephemeral: true });
    }

    const streamer = interaction.options.getUser('streamer');
    const descricao = interaction.options.getString('descricao');
    const canal = interaction.options.getChannel('canal');
    const valor = interaction.options.getString('valor') || '0,00';

    const embed = new EmbedBuilder()
      .setTitle(`Jogar Contra ${streamer.username}`)
      .setDescription(
        `✅ **Streamer:** ${streamer}\n\n${descricao}\n\n<t:${Math.floor(Date.now() / 1000)}:f>`
      )
      .setThumbnail(streamer.displayAvatarURL({ dynamic: true }))
      .setColor(0x57F287)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('jogar_contra_streamer')
        .setLabel('Jogar Contra')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
    );

    await interaction.deferReply({ ephemeral: true });

    try {
      const msg = await canal.send({ embeds: [embed], components: [row] });

      saveStreamerQueue(msg.id, {
        streamerId: streamer.id,
        streamerName: streamer.username,
        descricao,
        valor,
        jogadores: [],
        canalOrigemId: canal.id
      });

      await interaction.editReply({ content: `✅ Fila de streamer criada em ${canal}!` });
    } catch (e) {
      console.error('[FILA STREAMER] Erro ao criar fila:', e);
      await interaction.editReply({ content: '❌ Erro ao criar a fila. Verifique as permissões do bot no canal.' });
    }
  }
};
