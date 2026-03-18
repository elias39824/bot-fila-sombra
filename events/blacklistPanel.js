const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const taxadosPath = path.join(__dirname, '../DataBaseJson/taxados.json');
const analistaPath = path.join(__dirname, '../DataBaseJson/analista.json');

function userIsAnalista(member) {
  try {
    const ids = JSON.parse(fs.readFileSync(analistaPath));
    return ids.some(id => member.roles.cache.has(id));
  } catch {
    return false;
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Botão Adicionar Usuário
    if (interaction.isButton() && interaction.customId === 'blacklist_add') {
      if (!userIsAnalista(interaction.member)) {
        await interaction.reply({ content: '❌ Apenas usuários com o cargo de analista podem usar este painel!', ephemeral: true });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId('modal_blacklist_add')
        .setTitle('Adicionar Usuário à Blacklist');

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

    // Modal submit para adicionar usuário
    if (interaction.isModalSubmit() && interaction.customId === 'modal_blacklist_add') {
      if (!userIsAnalista(interaction.member)) {
        await interaction.reply({ content: '❌ Apenas usuários com o cargo de analista podem usar este painel!', ephemeral: true });
        return;
      }
      const id = interaction.fields.getTextInputValue('id');
      const id_jogo = interaction.fields.getTextInputValue('id_jogo');
      const motivo = interaction.fields.getTextInputValue('motivo');
      const provas = interaction.fields.getTextInputValue('provas');
      const data = new Date().toLocaleString('pt-BR');
      const adicionadoid = interaction.user.id;

      let taxados = [];
      if (fs.existsSync(taxadosPath)) {
        taxados = JSON.parse(fs.readFileSync(taxadosPath));
      }

      // Não gera id sequencial, usa o id informado
      taxados.push({
        id: id,
        id_jogo,
        motivo,
        provas,
        data,
        adicionadoid,
      });

      fs.writeFileSync(taxadosPath, JSON.stringify(taxados, null, 2));

      await interaction.reply({ content: `${emojis.confirmed_emoji} Usuário adicionado à blacklist!`, ephemeral: true });
      return;
    }

    // Botão Remover Usuário
    if (interaction.isButton() && interaction.customId === 'blacklist_remove') {
      if (!userIsAnalista(interaction.member)) {
        await interaction.reply({ content: '❌ Apenas usuários com o cargo de analista podem usar este painel!', ephemeral: true });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId('modal_blacklist_remove')
        .setTitle('Remover Usuário da Blacklist');

      const idInput = new TextInputBuilder()
        .setCustomId('id')
        .setLabel('ID do Usuário a Remover')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);

      const firstRow = new ActionRowBuilder().addComponents(idInput);
      modal.addComponents(firstRow);
      await interaction.showModal(modal);
      return;
    }

    // Modal submit para remover usuário
    if (interaction.isModalSubmit() && interaction.customId === 'modal_blacklist_remove') {
      if (!userIsAnalista(interaction.member)) {
        await interaction.reply({ content: '❌ Apenas usuários com o cargo de analista podem usar este painel!', ephemeral: true });
        return;
      }
      const id = interaction.fields.getTextInputValue('id');
      let taxados = [];
      if (fs.existsSync(taxadosPath)) {
        taxados = JSON.parse(fs.readFileSync(taxadosPath));
      }
      const originalLength = taxados.length;
      taxados = taxados.filter(entry => entry.id !== id);
      if (taxados.length === originalLength) {
        await interaction.reply({ content: `${emojis.error_emoji} Nenhum usuário encontrado com esse ID!`, ephemeral: true });
        return;
      }
      fs.writeFileSync(taxadosPath, JSON.stringify(taxados, null, 2));
      await interaction.reply({ content: `${emojis.confirmed_emoji} Usuário removido da blacklist!`, ephemeral: true });
      return;
    }

    // Botão Procurar Usuário
    if (interaction.isButton() && interaction.customId === 'blacklist_search') {
      if (!userIsAnalista(interaction.member)) {
        await interaction.reply({ content: '❌ Apenas usuários com o cargo de analista podem usar este painel!', ephemeral: true });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId('modal_blacklist_search')
        .setTitle('Procurar Usuário na Blacklist');

      const idInput = new TextInputBuilder()
        .setCustomId('id')
        .setLabel('ID do Usuário para Procurar')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);

      const firstRow = new ActionRowBuilder().addComponents(idInput);
      modal.addComponents(firstRow);
      await interaction.showModal(modal);
      return;
    }

    // Modal submit para procurar usuário
    if (interaction.isModalSubmit() && interaction.customId === 'modal_blacklist_search') {
      if (!userIsAnalista(interaction.member)) {
        await interaction.reply({ content: '❌ Apenas usuários com o cargo de analista podem usar este painel!', ephemeral: true });
        return;
      }
      const id = interaction.fields.getTextInputValue('id');
      let taxados = [];
      if (fs.existsSync(taxadosPath)) {
        taxados = JSON.parse(fs.readFileSync(taxadosPath));
      }
      const entry = taxados.find(entry => entry.id === id);
      if (!entry) {
        await interaction.reply({ content: `${emojis.error_emoji} Nenhum usuário encontrado com esse ID!`, ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(0x2f3136)
        .setTitle(`${emojis._ban_emoji} Usuário na Blacklist`)
        .addFields(
          { name: 'ID', value: entry.id, inline: true },
          { name: 'ID do Jogo', value: entry.id_jogo, inline: true },
          { name: 'Motivo', value: entry.motivo, inline: false },
          { name: 'Provas', value: entry.provas, inline: false },
          { name: 'Data', value: entry.data, inline: true },
          { name: 'Adicionado por', value: `<@${entry.adicionadoid}>`, inline: true }
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interaction.isModalSubmit() && (interaction.customId === 'modal_blacklist_add' || interaction.customId === 'modal_blacklist_remove' || interaction.customId === 'modal_blacklist_search')) {
      if (!userIsAnalista(interaction.member)) {
        await interaction.reply({ content: '❌ Apenas usuários com o cargo de analista podem usar este painel!', ephemeral: true });
        return;
      }
    }
  }
}; 