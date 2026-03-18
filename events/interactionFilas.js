const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isButton() && interaction.customId === 'fila_1v1') {
      const modal = new ModalBuilder()
        .setCustomId('modal_fila_1v1')
        .setTitle('Criar Fila de Mobile');

      const canalInput = new TextInputBuilder()
        .setCustomId('canal_id')
        .setLabel('ID do canal para a fila de mobile')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);

      const modoInput = new TextInputBuilder()
        .setCustomId('modo_fila')
        .setLabel('Modo da fila')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: clássico, rápido, ranked...')
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(canalInput);
      const secondActionRow = new ActionRowBuilder().addComponents(modoInput);
      modal.addComponents(firstActionRow, secondActionRow);

      await interaction.showModal(modal);
    }
    // Modal da Fila de Emulador
    if (interaction.isButton() && interaction.customId === 'fila_normais') {
      const modal = new ModalBuilder()
        .setCustomId('modal_fila_normal')
        .setTitle('Criar Fila de Emulador');

      const canalInput = new TextInputBuilder()
        .setCustomId('canal_id')
        .setLabel('ID do canal para a fila de emulador')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);

      const modoInput = new TextInputBuilder()
        .setCustomId('modo_fila')
        .setLabel('Modo da fila')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: clássico, rápido, ranked...')
        .setRequired(true);

      const formatoInput = new TextInputBuilder()
        .setCustomId('formato_fila')
        .setLabel('Formato da fila')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: solo, duo, squad...')
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(canalInput);
      const secondActionRow = new ActionRowBuilder().addComponents(modoInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(formatoInput);
      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

      await interaction.showModal(modal);
    }
    // Modal da Fila Misto
    if (interaction.isButton() && interaction.customId === 'fila_misto') {
      const modal = new ModalBuilder()
        .setCustomId('modal_fila_misto')
        .setTitle('Criar Fila Misto');

      const canalInput = new TextInputBuilder()
        .setCustomId('canal_id')
        .setLabel('ID do canal para a fila misto')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);

      const modoInput = new TextInputBuilder()
        .setCustomId('modo_fila')
        .setLabel('Modo da fila')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: clássico, rápido, ranked...')
        .setRequired(true);

      const formatoInput = new TextInputBuilder()
        .setCustomId('formato_fila')
        .setLabel('Formato da fila (apenas 2x2, 3x3 ou 4x4)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('2x2, 3x3 ou 4x4')
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(canalInput);
      const secondActionRow = new ActionRowBuilder().addComponents(modoInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(formatoInput);
      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

      await interaction.showModal(modal);
    }
  }
};
