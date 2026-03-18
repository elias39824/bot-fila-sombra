const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const emojis = require('../DataBaseJson/emojis.json');
const { criarSalaAposta } = require('./matchRoomCreator');

const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const colorPath = path.join(__dirname, '../DataBaseJson/bot_color.json');

function getCorEscolhida() {
  try {
    if (!fs.existsSync(colorPath)) {
      return '#5865F2';
    }
    const data = fs.readFileSync(colorPath, 'utf-8');
    const colorData = JSON.parse(data);
    return colorData.cor || '#5865F2';
  } catch (e) {
    return '#5865F2';
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'aposta_revanche') return;

    try {
      await interaction.deferReply({ ephemeral: false });

      // Carregar dados da partida
      let filasDados = {};
      if (fs.existsSync(filasDadosPath)) {
        filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
      }

      const partida = filasDados[interaction.channel.id];

      if (!partida || !partida.jogadores || partida.jogadores.length !== 2) {
        return interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} Dados da partida não encontrados.`
        });
      }

      const [jogador1Id, jogador2Id] = partida.jogadores;

      // Buscar objetos de usuário
      const jogador1 = await interaction.guild.members.fetch(jogador1Id).then(m => m.user);
      const jogador2 = await interaction.guild.members.fetch(jogador2Id).then(m => m.user);

      const corEscolhida = getCorEscolhida();

      const embedConfirmacao = new EmbedBuilder()
        .setTitle('Revanche Solicitada!')
        .setDescription(
          `Uma nova partida será criada com os mesmos jogadores.\n\n` +
          `**Jogador 1:** <@${jogador1Id}>\n` +
          `**Jogador 2:** <@${jogador2Id}>\n\n` +
          `**Modo:** ${partida.modo}\n` +
          `**Tipo:** ${partida.tipo}\n` +
          `**Valor:** R$ ${partida.valor}\n\n` +
          `Confirme abaixo para criar a nova sala de aposta.`
        )
        .setColor(corEscolhida)
        .setFooter({ text: 'Confirme ou cancele a revanche' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('revanche_confirmar')
          .setLabel('Confirmar Revanche')
          .setStyle(ButtonStyle.Success)
          .setEmoji(emojis.confirmed_emoji || '✅'),
        new ButtonBuilder()
          .setCustomId('revanche_cancelar')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji(emojis.failuser_emoji || '❌')
      );

      await interaction.editReply({
        embeds: [embedConfirmacao],
        components: [row]
      });

      // Collector para os botões de confirmação
      const filter = i => ['revanche_confirmar', 'revanche_cancelar'].includes(i.customId);
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });

      collector.on('collect', async i => {
        if (i.customId === 'revanche_confirmar') {
          await i.deferUpdate();

          try {
            // Criar nova sala
            const novaSala = await criarSalaAposta(
              interaction.guild,
              jogador1,
              jogador2,
              partida.modo,
              partida.tipo,
              partida.valor,
              partida.time || null
            );

            const embedSucesso = new EmbedBuilder()
              .setTitle('Revanche Criada!')
              .setDescription(
                `Nova sala de aposta criada com sucesso!\n\n` +
                `**Nova Sala:** ${novaSala}\n\n` +
                `Esta sala será fechada em **10 segundos**.`
              )
              .setColor(0x00ff00)
              .setTimestamp();

            const botaoIr = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel('Ir para Nova Sala')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://discord.com/channels/${interaction.guild.id}/${novaSala.id}`)
            );

            await interaction.editReply({
              embeds: [embedSucesso],
              components: [botaoIr]
            });

            // Deletar sala antiga
            setTimeout(() => {
              interaction.channel.delete('Revanche criada').catch(() => {});
            }, 10000);

          } catch (error) {
            console.error('[REVANCHE] Erro ao criar sala:', error);

            await interaction.editReply({
              content: `${emojis.failuser_emoji || '❌'} Erro ao criar sala de revanche: ${error.message}`,
              embeds: [],
              components: []
            });
          }
        } else {
          await i.update({
            content: `${emojis.failuser_emoji || '❌'} Revanche cancelada.`,
            embeds: [],
            components: []
          });
        }
      });

      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.editReply({
            content: `${emojis.failuser_emoji || '❌'} Tempo esgotado. Revanche cancelada.`,
            embeds: [],
            components: []
          }).catch(() => {});
        }
      });

    } catch (error) {
      console.error('[REVANCHE] Erro:', error);

      try {
        if (interaction.deferred) {
          await interaction.editReply({
            content: `${emojis.failuser_emoji || '❌'} Erro ao processar revanche.`
          });
        }
      } catch (e) {}
    }
  }
};