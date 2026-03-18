const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

function isOwner(userId) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    return config.ownerId === userId;
  } catch { return false; }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config_filas')
    .setDescription('Painel de configuração das filas.'),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Apenas o dono pode usar este comando!', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuração de Filas')
      .setDescription(
        '**Escolha o que deseja configurar:**\n\n' +
        '📺 **Canais** — Define os canais onde as filas serão enviadas\n' +
        '💰 **Valores** — Edita os valores de aposta de cada fila\n' +
        '🎨 **Embed** — Muda nome da org, cor, banner e footer\n' +
        '📤 **Enviar Filas** — Envia as filas para os canais configurados'
      )
      .setColor(0x5865F2);

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg_canais').setLabel('Canais').setStyle(ButtonStyle.Primary).setEmoji('📺'),
      new ButtonBuilder().setCustomId('cfg_valores').setLabel('Valores').setStyle(ButtonStyle.Primary).setEmoji('💰'),
      new ButtonBuilder().setCustomId('cfg_embed').setLabel('Embed').setStyle(ButtonStyle.Primary).setEmoji('🎨')
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg_enviar').setLabel('Enviar Filas').setStyle(ButtonStyle.Success).setEmoji('📤')
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
  }
};
