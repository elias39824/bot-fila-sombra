const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');
const permsPath = path.join(__dirname, '../DataBaseJson/perms.json');

const configPath = path.join(__dirname, '../config.json');

function isOwnerOrPermitted(userId) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    if (config.ownerId === userId) return true;
    if (fs.existsSync(permsPath)) {
      const perms = JSON.parse(fs.readFileSync(permsPath));
      return Object.keys(perms).includes(userId);
    }
    return false;
  } catch {
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Gerencie a blacklist de usuários.'),
  async execute(interaction) {
    if (!isOwnerOrPermitted(interaction.user.id)) {
      return interaction.reply({ content: '❌ Apenas o dono do bot ou quem tem permissão pode usar este comando!', ephemeral: true });
    }
    const embed = new EmbedBuilder()
      .setColor(0x2f3136)
      .setTitle(`${emojis._ban_emoji} Painel de Blacklist`)
      .setDescription('Gerencie a blacklist de usuários do servidor de forma rápida e segura.')
      .setThumbnail(interaction.guild.iconURL() || null)
      .setFooter({ text: 'Use os botões abaixo para adicionar, remover ou procurar usuários na blacklist.' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('blacklist_add')
        .setLabel('Adicionar Usuário')
        .setStyle(ButtonStyle.Success)
        .setEmoji(emojis._add_emoji),
      new ButtonBuilder()
        .setCustomId('blacklist_remove')
        .setLabel('Remover Usuário')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis._remove_emoji),
      new ButtonBuilder()
        .setCustomId('blacklist_search')
        .setLabel('Procurar Usuário')
        .setStyle(ButtonStyle.Primary)
        .setEmoji(emojis._search_emoji)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
}; 