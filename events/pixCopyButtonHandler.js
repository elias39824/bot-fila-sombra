module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('copiar_pix_')) return;

    const messageId = interaction.customId.replace('copiar_pix_', '');
    
    if (!global.pixKeys || !global.pixKeys[messageId]) {
      return interaction.reply({
        content: '❌ Chave PIX não encontrada. O QR Code pode ter sido gerado antes do bot reiniciar.',
        ephemeral: true
      });
    }

    const chave = global.pixKeys[messageId];

    await interaction.reply({
      content: `✅ **Chave PIX copiada!**\n\n\`\`\`${chave}\`\`\`\n*Copie o código acima*`,
      ephemeral: true
    });
  }
};