const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const pagamentosPath = path.join(__dirname, '../DataBaseJson/pagamentos.json');
const mediadorPath = path.join(__dirname, '../DataBaseJson/mediador.json');

function getUserPaymentConfig(userId) {
  try {
    const data = fs.readFileSync(pagamentosPath);
    const configs = JSON.parse(data);
    return configs[userId] || null;
  } catch {
    return null;
  }
}

function userIsMediador(member) {
  try {
    const ids = JSON.parse(fs.readFileSync(mediadorPath));
    return ids.some(id => member.roles.cache.has(id));
  } catch {
    return false;
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handler do botão config_pix
    if (interaction.isButton() && interaction.customId === 'config_pix') {
      if (!userIsMediador(interaction.member)) {
        await interaction.reply({ content: '❌ Apenas usuários com o cargo de mediador podem usar este painel!', ephemeral: true });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId('modal_config_pix')
        .setTitle('Configurar Chave PIX');

      const chavePixInput = new TextInputBuilder()
        .setCustomId('chave_pix')
        .setLabel('Chave PIX')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: email@exemplo.com ou 12345678900')
        .setRequired(true);

      const qrCodeInput = new TextInputBuilder()
        .setCustomId('qr_code')
        .setLabel('URL do QR Code')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('URL da imagem do QR Code')
        .setRequired(false);

      const avisoInput = new TextInputBuilder()
        .setCustomId('aviso')
        .setLabel('Aviso (opcional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Mensagem adicional para exibir junto ao pagamento')
        .setRequired(false);

      const firstRow = new ActionRowBuilder().addComponents(chavePixInput);
      const secondRow = new ActionRowBuilder().addComponents(qrCodeInput);
      const thirdRow = new ActionRowBuilder().addComponents(avisoInput);

      modal.addComponents(firstRow, secondRow, thirdRow);
      await interaction.showModal(modal);
      return;
    }

    // Handler do modal de configuração PIX
    if (interaction.isModalSubmit() && interaction.customId === 'modal_config_pix') {
      if (!userIsMediador(interaction.member)) {
        await interaction.reply({ content: '❌ Apenas usuários com o cargo de mediador podem usar este painel!', ephemeral: true });
        return;
      }
      const chavePix = interaction.fields.getTextInputValue('chave_pix');
      const qrCode = interaction.fields.getTextInputValue('qr_code');
      const aviso = interaction.fields.getTextInputValue('aviso');

      // Carrega configurações existentes
      let configs = {};
      if (fs.existsSync(pagamentosPath)) {
        configs = JSON.parse(fs.readFileSync(pagamentosPath));
      }

      // Atualiza configurações do usuário
      configs[interaction.user.id] = {
        chave_pix: chavePix,
        qr_code: qrCode || '',
        aviso: aviso || ''
      };

      // Salva no arquivo
      fs.writeFileSync(pagamentosPath, JSON.stringify(configs, null, 2));

      // Atualiza a embed
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._money_emoji} Configurações de Pagamento`)
        .setDescription('Gerencie suas configurações de pagamento de forma rápida e segura.')
        .setThumbnail(interaction.guild.iconURL() || null)
        .setFooter({ text: 'Use os botões abaixo para gerenciar suas configurações.', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_pix')
          .setLabel('Definir Chave PIX')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._money_emoji),
        new ButtonBuilder()
          .setCustomId('ver_config_pix')
          .setLabel('Ver Configurações')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._settings_emoji)
      );

      await interaction.update({ content: `${emojis.confirmed_emoji} Configurações de pagamento atualizadas!`, embeds: [embed], components: [row] });
      return;
    }

    // Handler do botão ver_config_pix
    if (interaction.isButton() && interaction.customId === 'ver_config_pix') {
      if (!userIsMediador(interaction.member)) {
        await interaction.reply({ content: '❌ Apenas usuários com o cargo de mediador podem usar este painel!', ephemeral: true });
        return;
      }
      const config = getUserPaymentConfig(interaction.user.id);
      
      if (!config) {
        await interaction.reply({ content: '❌ Você ainda não configurou suas informações de pagamento!', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._money_emoji} Suas Configurações de Pagamento`)
        .setDescription(`Aqui estão suas configurações atuais de pagamento:`)
        .addFields(
          { name: `${emojis._money_emoji} Chave PIX`, value: config.chave_pix, inline: false }
        )
        .setThumbnail(interaction.guild.iconURL() || null);

      if (config.aviso) {
        embed.addFields({ name: `${emojis._messages_emoji} Aviso`, value: config.aviso, inline: false });
      }
      if (config.qr_code) {
        embed.setImage(config.qr_code);
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  }
}; 