const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const emojis = require('../DataBaseJson/emojis.json');
const filaPath = path.join(__dirname, '../DataBaseJson/mediadores.json');
const configPath = path.join(__dirname, '../config.json');
const permsPath = path.join(__dirname, '../DataBaseJson/perms.json');

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
    .setName('mediadores')
    .setDescription('Veja ou entre na fila de mediadores.'),
  async execute(interaction) {
    if (!isOwnerOrPermitted(interaction.user.id)) {
      return interaction.reply({ content: '❌ Apenas o dono do bot ou quem tem permissão pode usar este comando!', ephemeral: true });
    }

    let fila = [];
    if (fs.existsSync(filaPath)) {
      const raw = fs.readFileSync(filaPath);
      fila = JSON.parse(raw).fila || [];
    }

    
    let desc = fila.length > 0 ? fila.map(u => `<@${u}> \`${u}\``).join('\n') : 'Nenhum mediador na fila.';

    
    const embed = new EmbedBuilder()
      .setTitle(`${emojis.information_emoji} Fila de Mediadores`)
      .setDescription('Entre ou saia da fila de mediadores usando os botões abaixo.')
      .addFields({ name: 'Admins Especiais Atuais:', value: desc })
      .setColor(0x2ecc71);

    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('entrar_fila')
        .setLabel('Entrar na fila')
        .setStyle(ButtonStyle.Success)
        .setEmoji(emojis.member_add_emoji),
      new ButtonBuilder()
        .setCustomId('sair_fila')
        .setLabel('Sair da fila')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.member_remove_emoji)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });
  }
}; 