const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const analistaPath = path.join(__dirname, '../DataBaseJson/analista.json');
const canalAnalisePath = path.join(__dirname, '../DataBaseJson/canal_analise.json');

// Função para obter os cargos de analista
function getAnalistas() {
  try {
    const data = fs.readFileSync(analistaPath);
    const ids = JSON.parse(data);
    return ids.length ? ids.map(id => `<@&${id}>`).join(', ') : 'Nenhum definido';
  } catch {
    return 'Nenhum definido';
  }
}

// Função para obter o canal de análise configurado
function getCanalAnalise() {
  try {
    if (!fs.existsSync(canalAnalisePath)) {
      // Cria o arquivo se não existir
      fs.writeFileSync(canalAnalisePath, JSON.stringify({ canal: null }, null, 2));
      return 'Nenhum definido';
    }
    const data = fs.readFileSync(canalAnalisePath, 'utf-8');
    const config = JSON.parse(data);
    return config.canal ? `<#${config.canal}>` : 'Nenhum definido';
  } catch (error) {
    console.error('[ERROR] Erro ao ler canal_analise.json:', error);
    return 'Nenhum definido';
  }
}

// Função para salvar o canal de análise
function setCanalAnalise(canalId) {
  try {
    const dir = path.dirname(canalAnalisePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(canalAnalisePath, JSON.stringify({ canal: canalId }, null, 2));
    return true;
  } catch (error) {
    console.error('[ERROR] Erro ao salvar canal_analise.json:', error);
    return false;
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // ========================================
    // BOTÃO: Analista do painel principal
    // ========================================
    if (interaction.isButton() && interaction.customId === 'blank_analista') {
      const embed = new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle(`${emojis._staff_emoji} Painel Analista`)
        .setDescription('Gerencie o cargo de analista e o canal de avisos de análise do servidor.')
        .addFields(
          { name: '👔 Cargo Analista', value: getAnalistas(), inline: false },
          { name: '📢 Canal de Análise', value: getCanalAnalise(), inline: false }
        )
        .setFooter({ text: 'Use os botões abaixo para configurar o sistema de análise.', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_analista_cargo')
          .setLabel('Definir Cargo')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._staff_emoji),
        new ButtonBuilder()
          .setCustomId('config_canal_analise')
          .setLabel('Definir Canal de Análise')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📢')
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('voltar_painel_principal')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji)
      );

      await interaction.update({ embeds: [embed], components: [row1, row2] });
      return;
    }

    // ========================================
    // BOTÃO: Definir Cargo de Analista
    // ========================================
    if (interaction.isButton() && interaction.customId === 'config_analista_cargo') {
      const modal = new ModalBuilder()
        .setCustomId('modal_analista_cargo')
        .setTitle('Definir Cargo de Analista');

      const input = new TextInputBuilder()
        .setCustomId('analista_id')
        .setLabel('ID do cargo de analista')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);
      await interaction.showModal(modal);
      return;
    }

    // ========================================
    // BOTÃO: Definir Canal de Análise
    // ========================================
    if (interaction.isButton() && interaction.customId === 'config_canal_analise') {
      const modal = new ModalBuilder()
        .setCustomId('modal_canal_analise')
        .setTitle('Definir Canal de Análise');

      const input = new TextInputBuilder()
        .setCustomId('canal_analise_id')
        .setLabel('ID do canal de avisos de análise')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 123456789012345678')
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);
      await interaction.showModal(modal);
      return;
    }

    // ========================================
    // MODAL SUBMIT: Definir Cargo de Analista
    // ========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_analista_cargo') {
      const id = interaction.fields.getTextInputValue('analista_id').trim();

      // Validação básica do ID
      if (!/^\d{17,19}$/.test(id)) {
        return interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} ID inválido! Por favor, insira um ID válido de cargo.`,
          ephemeral: true
        });
      }

      // Verifica se o cargo existe no servidor
      const role = await interaction.guild.roles.fetch(id).catch(() => null);
      if (!role) {
        return interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Cargo não encontrado! Verifique se o ID está correto.`,
          ephemeral: true
        });
      }

      // Salva o cargo
      fs.writeFileSync(analistaPath, JSON.stringify([id], null, 2));

      // Atualiza o painel
      const embed = new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle(`${emojis._staff_emoji} Painel Analista`)
        .setDescription('Gerencie o cargo de analista e o canal de avisos de análise do servidor.')
        .addFields(
          { name: '👔 Cargo Analista', value: getAnalistas(), inline: false },
          { name: '📢 Canal de Análise', value: getCanalAnalise(), inline: false }
        )
        .setFooter({ text: 'Use os botões abaixo para configurar o sistema de análise.', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_analista_cargo')
          .setLabel('Definir Cargo')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._staff_emoji),
        new ButtonBuilder()
          .setCustomId('config_canal_analise')
          .setLabel('Definir Canal de Análise')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📢')
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('voltar_painel_principal')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji)
      );

      await interaction.update({ embeds: [embed], components: [row1, row2] });

      // Mensagem de confirmação
      await interaction.followUp({
        content: `${emojis.confirmed_emoji || '✅'} Cargo de analista definido com sucesso como ${role}!`,
        ephemeral: true
      });

      console.log(`[CONFIG] ${interaction.user.tag} definiu o cargo de analista: ${role.name} (${id})`);
      return;
    }

    // ========================================
    // MODAL SUBMIT: Definir Canal de Análise
    // ========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_canal_analise') {
      const id = interaction.fields.getTextInputValue('canal_analise_id').trim();

      // Validação básica do ID
      if (!/^\d{17,19}$/.test(id)) {
        return interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} ID inválido! Por favor, insira um ID válido de canal.`,
          ephemeral: true
        });
      }

      // Verifica se o canal existe no servidor
      const channel = await interaction.guild.channels.fetch(id).catch(() => null);
      if (!channel) {
        return interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Canal não encontrado! Verifique se o ID está correto.`,
          ephemeral: true
        });
      }

      // Verifica se é um canal de texto
      if (!channel.isTextBased()) {
        return interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} O canal precisa ser um canal de texto!`,
          ephemeral: true
        });
      }

      // Salva o canal
      const sucesso = setCanalAnalise(id);
      
      if (!sucesso) {
        return interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Erro ao salvar o canal! Tente novamente.`,
          ephemeral: true
        });
      }

      // Atualiza o painel
      const embed = new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle(`${emojis._staff_emoji} Painel Analista`)
        .setDescription('Gerencie o cargo de analista e o canal de avisos de análise do servidor.')
        .addFields(
          { name: '👔 Cargo Analista', value: getAnalistas(), inline: false },
          { name: '📢 Canal de Análise', value: getCanalAnalise(), inline: false }
        )
        .setFooter({ text: 'Use os botões abaixo para configurar o sistema de análise.', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_analista_cargo')
          .setLabel('Definir Cargo')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._staff_emoji),
        new ButtonBuilder()
          .setCustomId('config_canal_analise')
          .setLabel('Definir Canal de Análise')
          .setStyle(ButtonStyle.Success)
          .setEmoji('📢')
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('voltar_painel_principal')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji)
      );

      await interaction.update({ embeds: [embed], components: [row1, row2] });

      // Mensagem de confirmação
      await interaction.followUp({
        content: `${emojis.confirmed_emoji || '✅'} Canal de análise definido com sucesso como ${channel}!`,
        ephemeral: true
      });

      console.log(`[CONFIG] ${interaction.user.tag} definiu o canal de análise: ${channel.name} (${id})`);
      return;
    }

    // ========================================
    // BOTÃO: Voltar ao Painel Principal
    // ========================================
    if (interaction.isButton() && interaction.customId === 'voltar_painel_principal') {
      let emojis = require('../DataBaseJson/emojis.json');
      const embed = new EmbedBuilder()
        .setColor(0x7289DA)
        .setTitle(`${emojis._settings_emoji} Painel Blank Config`)
        .setDescription('Gerencie as principais funções do Blank de forma rápida.')
        .setThumbnail(interaction.guild.iconURL() || null);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('blank_filas')
          .setLabel('Filas')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._people_emoji),
        new ButtonBuilder()
          .setCustomId('blank_blacklist')
          .setLabel('Blacklist')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._ban_emoji),
        new ButtonBuilder()
          .setCustomId('blank_logs')
          .setLabel('Logs')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._messages_emoji),
        new ButtonBuilder()
          .setCustomId('blank_analista')
          .setLabel('Analista')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._staff_emoji)
      );

      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }
  }
};