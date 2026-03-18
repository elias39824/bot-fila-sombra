const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const emojis = require('../DataBaseJson/emojis.json');
const mediadorCargo = require('../DataBaseJson/mediador.json')[0];
const analistaCargo = require('../DataBaseJson/analista.json')[0];

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;

    // Só trata botões e modais do analista
    const customIds = ['usuario_limpo', 'usuario_xitado', 'modal_blacklist_analista'];
    if (!customIds.includes(interaction.customId)) return;

    // Recupera dados da mensagem original, se possível
    let user, motivo, solicitante;
    if (interaction.message && interaction.message.embeds.length > 0) {
      const desc = interaction.message.embeds[0].description || '';
      const userMatch = desc.match(/<@!?\d+>/);
      user = userMatch ? userMatch[0] : 'Usuário';
      const motivoMatch = desc.match(/\*\*Motivo:\*\* ([^\n]+)/);
      motivo = motivoMatch ? motivoMatch[1] : '';
      const solicitanteMatch = desc.match(/\*\*Solicitante:\*\* (<@!?\d+>)/);
      solicitante = solicitanteMatch ? solicitanteMatch[1] : '';
    }

    // Verifica se o usuário tem o cargo de analista
    if (!interaction.member.roles.cache.has(analistaCargo)) {
      return interaction.reply({
        content: `${emojis.negative_emoji} Apenas analistas podem usar estes botões!`,
        ephemeral: true
      });
    }

    // Botão: Usuário Limpo
    if (interaction.customId === 'usuario_limpo') {
      const embedLimpo = new EmbedBuilder()
        .setColor('#2b2d31')
        .setDescription(`${emojis.confirmed_emoji} O analista ${interaction.user} definiu ${user} como limpo!`)
        .setTimestamp();

      // Atualiza a embed principal para mostrar o resultado
      const embedAnalise = EmbedBuilder.from(interaction.message.embeds[0]);
      embedAnalise.setDescription(
        `${emojis._people_emoji} **Usuário:** ${user}\n` +
        `${emojis._text_emoji} **Motivo:** ${motivo}\n` +
        `${emojis._star_emoji} **Solicitante:** ${solicitante}\n` +
        `${emojis._staff_emoji} **Analista:** ${interaction.user}\n` +
        `${emojis.confirmed_emoji} **Resultado:** Usuário Limpo`
      );

      await interaction.update({
        embeds: [embedAnalise, embedLimpo],
        components: []
      });
      await interaction.channel.send({
        embeds: [embedLimpo]
      });
      return;
    }

    // Botão: Usuário Xitado
    if (interaction.customId === 'usuario_xitado') {
      const modal = new ModalBuilder()
        .setCustomId('modal_blacklist_analista')
        .setTitle('Adicionar à Blacklist');

      const idInput = new TextInputBuilder()
        .setCustomId('id')
        .setLabel('ID do Usuário')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);

      const idJogoInput = new TextInputBuilder()
        .setCustomId('id_jogo')
        .setLabel('ID do Jogo')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 987654321')
        .setRequired(true);

      const motivoInput = new TextInputBuilder()
        .setCustomId('motivo')
        .setLabel('Motivo')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Descreva o motivo da blacklist')
        .setRequired(true);

      const provasInput = new TextInputBuilder()
        .setCustomId('provas')
        .setLabel('Provas')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Links, prints ou descrição das provas')
        .setRequired(true);

      const firstRow = new ActionRowBuilder().addComponents(idInput);
      const secondRow = new ActionRowBuilder().addComponents(idJogoInput);
      const thirdRow = new ActionRowBuilder().addComponents(motivoInput);
      const fourthRow = new ActionRowBuilder().addComponents(provasInput);
      modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

      await interaction.showModal(modal);
      return;
    }

    // Modal: Blacklist
    if (interaction.isModalSubmit() && interaction.customId === 'modal_blacklist_analista') {
      const id = interaction.fields.getTextInputValue('id');
      const id_jogo = interaction.fields.getTextInputValue('id_jogo');
      const motivo = interaction.fields.getTextInputValue('motivo');
      const provas = interaction.fields.getTextInputValue('provas');
      const data = new Date().toLocaleString('pt-BR');
      const adicionadoid = interaction.user.id;
      const fs = require('fs');
      const path = require('path');
      const taxadosPath = path.join(__dirname, '../DataBaseJson/taxados.json');
      let taxados = [];
      if (fs.existsSync(taxadosPath)) {
        taxados = JSON.parse(fs.readFileSync(taxadosPath));
      }
      taxados.push({ id, id_jogo, motivo, provas, data, adicionadoid });
      fs.writeFileSync(taxadosPath, JSON.stringify(taxados, null, 2));

      // Atualiza a embed principal para mostrar o resultado
      const embedAnalise = EmbedBuilder.from(interaction.message.embeds[0]);
      embedAnalise.setDescription(
        `${emojis._people_emoji} **Usuário:** <@${id}>\n` +
        `${emojis._text_emoji} **Motivo:** ${motivo}\n` +
        `${emojis._star_emoji} **Solicitante:** ${solicitante}\n` +
        `${emojis._staff_emoji} **Analista:** ${interaction.user}\n` +
        `${emojis._ban_emoji} **Resultado:** Usuário Xitado\n` +
        `${emojis._text_emoji} **Motivo Blacklist:** ${motivo}`
      );

      const embedXitado = new EmbedBuilder()
        .setColor('#2b2d31')
        .setDescription(`${emojis._ban_emoji} O analista ${interaction.user} encontrou hack em <@${id}>!\n${emojis._text_emoji} **Motivo:** ${motivo}\n${emojis._folder_emoji} **Provas:** ${provas}`)
        .setTimestamp();

      await interaction.channel.send({
        embeds: [embedXitado]
      });

      // Atualiza a mensagem original
      try {
        await interaction.message.edit({
          embeds: [embedAnalise],
          components: []
        });
      } catch (e) {
        // Mensagem não existe mais, ignora o erro
      }
      return;
    }
  }
}; 