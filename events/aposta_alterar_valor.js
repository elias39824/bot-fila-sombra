const fs = require('fs');
const path = require('path');
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const emojis = require('../DataBaseJson/emojis.json');

const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const colorPath = path.join(__dirname, '../DataBaseJson/bot_color.json');

function getCorEscolhida() {
  try {
    if (!fs.existsSync(colorPath)) {
      return '#FFA500';
    }
    const data = fs.readFileSync(colorPath, 'utf-8');
    const colorData = JSON.parse(data);
    return colorData.cor || '#FFA500';
  } catch (e) {
    return '#FFA500';
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handler do botão
    if (interaction.isButton() && interaction.customId === 'aposta_alterar_valor') {
      
      // Verificar se é mediador
      let filasDados = {};
      if (fs.existsSync(filasDadosPath)) {
        filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
      }

      const partida = filasDados[interaction.channel.id];

      if (partida && partida.id_mediador && interaction.user.id !== partida.id_mediador) {
        return interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Apenas o mediador pode alterar o valor.`,
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_alterar_valor')
        .setTitle('Alterar Valor da Aposta');

      const valorInput = new TextInputBuilder()
        .setCustomId('novo_valor')
        .setLabel('Novo Valor (ex: 50,90 ou 100,00)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Digite o novo valor')
        .setRequired(true)
        .setMinLength(4)
        .setMaxLength(10);

      modal.addComponents(new ActionRowBuilder().addComponents(valorInput));

      await interaction.showModal(modal);
    }

    // Handler do modal
    if (interaction.isModalSubmit() && interaction.customId === 'modal_alterar_valor') {
      try {
        await interaction.deferReply({ ephemeral: false });

        const novoValor = interaction.fields.getTextInputValue('novo_valor').trim();

        // Validação do valor
        if (!/^\d+[,.]?\d{0,2}$/.test(novoValor)) {
          return interaction.editReply({
            content: `${emojis.failuser_emoji || '❌'} Valor inválido! Use o formato: 50,90 ou 100,00`
          });
        }

        // Normalizar valor (trocar . por ,)
        const valorFormatado = novoValor.replace('.', ',');

        // Atualizar no banco de dados
        let filasDados = {};
        if (fs.existsSync(filasDadosPath)) {
          filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
        }

        if (filasDados[interaction.channel.id]) {
          const valorAnterior = filasDados[interaction.channel.id].valor;
          filasDados[interaction.channel.id].valor = valorFormatado;
          fs.writeFileSync(filasDadosPath, JSON.stringify(filasDados, null, 2), 'utf-8');

          const corEscolhida = getCorEscolhida();

          const embedSucesso = new EmbedBuilder()
            .setTitle('Valor Alterado!')
            .setDescription(
              `O valor da aposta foi atualizado com sucesso.\n\n` +
              `**Valor Anterior:** R$ ${valorAnterior}\n` +
              `**Novo Valor:** R$ ${valorFormatado}\n\n` +
              `Os jogadores devem realizar o pagamento com o novo valor.`
            )
            .setColor(corEscolhida)
            .setFooter({ text: 'Alteração realizada pelo mediador' })
            .setTimestamp();

          await interaction.editReply({
            embeds: [embedSucesso]
          });

        } else {
          await interaction.editReply({
            content: `${emojis.failuser_emoji || '❌'} Dados da partida não encontrados.`
          });
        }

      } catch (error) {
        console.error('[ALTERAR VALOR] Erro:', error);

        try {
          if (interaction.deferred) {
            await interaction.editReply({
              content: `${emojis.failuser_emoji || '❌'} Erro ao alterar valor.`
            });
          }
        } catch (e) {}
      }
    }
  }
};