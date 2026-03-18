const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const configPath = path.join(__dirname, '../config.json');

function isOwner(userId) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    return config.ownerId === userId;
  } catch {
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filas')
    .setDescription('Exibe o painel de filas.'),
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Apenas o dono do bot pode usar este comando!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.command_emoji} Painel de Filas`)
      .setDescription(`Escolha abaixo o tipo de fila que deseja acessar:

${emojis.defense_emoji} **Fila de Mobile**
${emojis.store_emoji} **Fila de Emulador**
${emojis.dream} **Filas Misto**`)
      .setColor(0x5865F2)
      .setFooter({ text: 'Selecione uma opção para continuar!', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('fila_1v1')
        .setLabel('Fila de Mobile')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(emojis.defense_emoji),
      new ButtonBuilder()
        .setCustomId('fila_normais')
        .setLabel('Fila de Emulador')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(emojis.store_emoji),
      new ButtonBuilder()
        .setCustomId('fila_misto')
        .setLabel('Filas Misto')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(emojis.dream)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
  }
};
 