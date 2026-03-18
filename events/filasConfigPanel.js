const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

function getMediadores() {
  try {
    const data = fs.readFileSync(
      path.join(__dirname, '../DataBaseJson/mediador.json'),
      'utf8'
    );
    const ids = JSON.parse(data);
    return ids.length ? ids.map(id => `<@&${id}>`).join(', ') : '@cargo desconhecido';
  } catch {
    return '@cargo desconhecido';
  }
}

function getCategoria() {
  try {
    const data = fs.readFileSync(
      path.join(__dirname, '../DataBaseJson/categoria.json'),
      'utf8'
    );
    const ids = JSON.parse(data);
    return ids.length ? `<#${ids[0]}>` : 'Nenhuma definida';
  } catch {
    return 'Nenhuma definida';
  }
}

function getStatusFilas() {
  function countFila(file) {
    try {
      const data = fs.readFileSync(
        path.join(__dirname, `../DataBaseJson/${file}`),
        'utf8'
      );
      const filas = JSON.parse(data);
      return Object.values(filas).reduce((acc, arr) => acc + arr.length, 0);
    } catch {
      return 0;
    }
  }

  return {
    '1v1': countFila('filas1v1.json'),
    'Normal': countFila('filasNormal.json'),
    'Misto': countFila('filasMisto.json')
  };
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;

    // ===============================
    // PAINEL DE CONFIGURAÇÃO DE FILAS
    // ===============================
    if (interaction.customId === 'blank_filas') {
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._settings_emoji} Configurações de Filas`)
        .setDescription(
          `Veja e altere as configurações principais das filas do servidor.\n\n` +
          `${emojis._people_emoji} **Mediador:** ${getMediadores()}\n` +
          `${emojis._folder_emoji} **Categoria:** ${getCategoria()}`
        )
        .setFooter({
          text: 'Use os botões abaixo para alterar as configurações.',
          iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png'
        });

      // ===== PRIMEIRA LINHA (5 BOTÕES) =====
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_mediador')
          .setLabel('Mediador')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._people_emoji),

        new ButtonBuilder()
          .setCustomId('config_categoria')
          .setLabel('Categoria')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._folder_emoji),

        new ButtonBuilder()
          .setCustomId('config_valores')
          .setLabel('Valores')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._money_emoji || '💰'),

        new ButtonBuilder()
          .setCustomId('config_taxa')
          .setLabel('Taxa')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId('config_pontos')
          .setLabel('Pontos por Vitória')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._star_emoji || '⭐')
      );

      // ===== SEGUNDA LINHA (2 BOTÕES) =====
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_regenerar')
          .setLabel('Regenerar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji(emojis._clean_emoji),
          
          new ButtonBuilder()
          .setCustomId('config_embed')
          .setLabel('Personalizar Embed')
          .setStyle(ButtonStyle.Secondary),

        new ButtonBuilder()
          .setCustomId('voltar_painel_principal')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji)
      );

      await interaction.update({
        embeds: [embed],
        components: [row1, row2]
      });

      return;
    }
  }
};