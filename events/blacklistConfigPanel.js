const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

function getBlacklistChannel() {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../DataBaseJson/blacklist.json'));
    const channelId = JSON.parse(data)[0];
    return channelId ? `<#${channelId}>` : 'Nenhum definido';
  } catch {
    return 'Nenhum definido';
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handler do botão blank_blacklist
    if (interaction.isButton() && interaction.customId === 'blank_blacklist') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._ban_emoji} Configurações da Blacklist`)
        .setDescription(`Veja e altere as configurações da blacklist do servidor.\n\n${emojis._messages_emoji} **Canal:** ${getBlacklistChannel()}`)
        .setFooter({ text: 'Use os botões abaixo para alterar as configurações.', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_blacklist_canal')
          .setLabel('Definir Canal')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._messages_emoji),
        new ButtonBuilder()
          .setCustomId('voltar_painel_principal')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji)
      );

      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    // Handler do botão config_blacklist_canal
    if (interaction.isButton() && interaction.customId === 'config_blacklist_canal') {
      const modal = new ModalBuilder()
        .setCustomId('modal_blacklist_canal')
        .setTitle('Definir Canal da Blacklist');

      const input = new TextInputBuilder()
        .setCustomId('canal_id')
        .setLabel('ID do canal da blacklist')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      await interaction.showModal(modal);
      return;
    }

    // Handler do modal de blacklist
    if (interaction.isModalSubmit() && interaction.customId === 'modal_blacklist_canal') {
      const channelId = interaction.fields.getTextInputValue('canal_id');
      
      // Salva o ID do canal como array
      fs.writeFileSync(path.join(__dirname, '../DataBaseJson/blacklist.json'), JSON.stringify([channelId], null, 2));

      // Atualiza a embed
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._ban_emoji} Configurações da Blacklist`)
        .setDescription(`Veja e altere as configurações da blacklist do servidor.\n\n${emojis._messages_emoji} **Canal:** ${getBlacklistChannel()}`)
        .setFooter({ text: 'Use os botões abaixo para alterar as configurações.', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_blacklist_canal')
          .setLabel('Definir Canal')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._messages_emoji),
        new ButtonBuilder()
          .setCustomId('voltar_painel_principal')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji)
      );

      await interaction.reply({ content: `${emojis.confirmed_emoji} Canal da blacklist atualizado!`, embeds: [embed], components: [row], ephemeral: true });
      return;
    }
  }
}; 