const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const emojis = require('../DataBaseJson/emojis.json');
const { logManager } = require('./matchRoomCreator');

const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const colorPath = path.join(__dirname, '../DataBaseJson/bot_color.json');

function getCorEscolhida() {
  try {
    if (!fs.existsSync(colorPath)) {
      return '#ED4245';
    }
    const data = fs.readFileSync(colorPath, 'utf-8');
    const colorData = JSON.parse(data);
    return colorData.cor || '#ED4245';
  } catch (e) {
    return '#ED4245';
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'aposta_finalizar') return;

    try {
      await interaction.deferReply({ ephemeral: true });

      // Verificar se é mediador
      let filasDados = {};
      if (fs.existsSync(filasDadosPath)) {
        filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
      }

      const partida = filasDados[interaction.channel.id];

      if (partida && partida.id_mediador && interaction.user.id !== partida.id_mediador) {
        return interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} Apenas o mediador pode finalizar a aposta.`
        });
      }

      const corEscolhida = getCorEscolhida();

      const embedFinal = new EmbedBuilder()
        .setTitle('Aposta Finalizada')
        .setDescription(
          `Esta sala de aposta foi encerrada pelo mediador.\n\n` +
          `O canal será deletado em **5 segundos**.`
        )
        .setColor(corEscolhida)
        .setFooter({ text: 'Obrigado por utilizar nosso sistema!' })
        .setTimestamp();

      await interaction.editReply({
        content: `${emojis.confirmed_emoji || '✅'} Aposta finalizada com sucesso!`
      });

      await interaction.channel.send({
        embeds: [embedFinal]
      });

      // Finalizar log
      if (logManager && logManager.sessoes.has(interaction.channel.id)) {
        await logManager.finalizarSessao(interaction.channel.id, 'Aposta finalizada manualmente');
      }

      // Remover do banco de dados
      delete filasDados[interaction.channel.id];
      fs.writeFileSync(filasDadosPath, JSON.stringify(filasDados, null, 2), 'utf-8');

      // Deletar canal
      setTimeout(() => {
        interaction.channel.delete('Aposta finalizada').catch(() => {});
      }, 5000);

    } catch (error) {
      console.error('[FINALIZAR] Erro:', error);

      try {
        if (interaction.deferred) {
          await interaction.editReply({
            content: `${emojis.failuser_emoji || '❌'} Erro ao finalizar aposta.`
          });
        }
      } catch (e) {}
    }
  }
};