const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const emojis = require('../DataBaseJson/emojis.json');

const designPath = path.join(__dirname, '../DataBaseJson/bot_design.json');
const colorPath = path.join(__dirname, '../DataBaseJson/bot_color.json');
const qrcodePath = path.join(__dirname, '../DataBaseJson/qrcode_config.json');

// Configuração padrão do QR Code
const DEFAULT_QRCODE_CONFIG = {
  size: 300,
  color: '000000',
  bgcolor: 'FFFFFF',
  format: 'png'
};

/**
 * Carrega configuração do QR Code
 */
function getQRCodeConfig() {
  try {
    if (!fs.existsSync(qrcodePath)) {
      fs.writeFileSync(qrcodePath, JSON.stringify(DEFAULT_QRCODE_CONFIG, null, 2));
      return DEFAULT_QRCODE_CONFIG;
    }
    const data = fs.readFileSync(qrcodePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[QR CODE CONFIG] Erro ao ler configuração:', error);
    return DEFAULT_QRCODE_CONFIG;
  }
}

/**
 * Salva configuração do QR Code
 */
function saveQRCodeConfig(config) {
  try {
    fs.writeFileSync(qrcodePath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('[QR CODE CONFIG] Erro ao salvar:', error);
    return false;
  }
}

/**
 * Baixa QR Code da API EasyQRCode
 */
async function baixarQRCode(textoTeste, config) {
  try {
    const apiPayload = {
      text: textoTeste,
      backgroundColor: `#${config.bgcolor.replace('#', '')}`,
      qrcodeColor: `#${config.color.replace('#', '')}`,
      size: config.size
    };

    const response = await axios.post('https://easyqrcode.app.br/api/generate-qrcode', apiPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    if (!response.data.success || !response.data.qrcode) {
      console.error('[QR CODE] API retornou erro:', response.data);
      return null;
    }

    const base64Image = response.data.qrcode.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
    return Buffer.from(base64Image, 'base64');
  } catch (error) {
    console.error('[QR CODE] Erro ao baixar:', error.message);
    return null;
  }
}

/**
 * Valida cor hexadecimal
 */
function validarCorHex(cor) {
  const corLimpa = cor.replace('#', '').toUpperCase();
  if (/^[0-9A-F]{6}$/.test(corLimpa)) {
    return corLimpa;
  }
  return null;
}

/**
 * Converte cor hex para nome
 */
function getNomeCor(hex) {
  const cores = {
    'FFFFFF': 'Branco',
    '000000': 'Preto',
    'FF0000': 'Vermelho',
    '00FF00': 'Verde',
    '0000FF': 'Azul',
    'FFFF00': 'Amarelo',
    'FFA500': 'Laranja',
    'FF1493': 'Rosa',
    'FFD700': 'Dourado',
    '800080': 'Roxo'
  };
  return cores[hex.toUpperCase()] || `#${hex}`;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Handler do botão Meu Bot Design (MENU PRINCIPAL)
    if (interaction.isButton() && interaction.customId === 'panel_meubot') {
      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle(`${emojis._diamond_emoji || '💎'} Meu Bot Design`)
        .setDescription('Personalize o visual do seu bot! Use os botões abaixo para editar o design, cores ou QR Code.');
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('meubot_design')
          .setLabel('Design')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._folder_emoji || '📁'),
        new ButtonBuilder()
          .setCustomId('meubot_cores')
          .setLabel('Cores')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._diamond_emoji || '💎'),
        new ButtonBuilder()
          .setCustomId('meubot_qrcode')
          .setLabel('QR Code')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎨'),
        // REMOVIDO: Botão "Outros" e tudo relacionado a pontos
        new ButtonBuilder()
          .setCustomId('meubot_voltar')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji || '◀️')
      );
      
      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    // ==========================================
    // SISTEMA DE DESIGN (AVATAR, NOME, BANNER)
    // ==========================================

    // Handler do botão Design
    if (interaction.isButton() && interaction.customId === 'meubot_design') {
      const modal = new ModalBuilder()
        .setCustomId('modal_meubot_design')
        .setTitle('Personalizar Design do Bot');
      
      const nomeInput = new TextInputBuilder()
        .setCustomId('bot_nome')
        .setLabel('Nome do Bot')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
      
      const avatarInput = new TextInputBuilder()
        .setCustomId('bot_avatar')
        .setLabel('Avatar (URL)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
      
      const bannerInput = new TextInputBuilder()
        .setCustomId('bot_banner')
        .setLabel('Banner (URL)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
      
      modal.addComponents(
        new ActionRowBuilder().addComponents(nomeInput),
        new ActionRowBuilder().addComponents(avatarInput),
        new ActionRowBuilder().addComponents(bannerInput)
      );
      
      await interaction.showModal(modal);
      return;
    }

    // Handler do modal de design
    if (interaction.isModalSubmit() && interaction.customId === 'modal_meubot_design') {
      const nome = interaction.fields.getTextInputValue('bot_nome');
      const avatar = interaction.fields.getTextInputValue('bot_avatar');
      const banner = interaction.fields.getTextInputValue('bot_banner');
      const data = { nome, avatar, banner };
      
      try {
        if (nome) await interaction.client.user.setUsername(nome);
      } catch (e) {
        console.error('[BOT DESIGN] Erro ao mudar nome:', e);
      }
      
      try {
        if (avatar) await interaction.client.user.setAvatar(avatar);
      } catch (e) {
        console.error('[BOT DESIGN] Erro ao mudar avatar:', e);
      }
      
      try {
        if (banner) await interaction.client.user.setBanner(banner);
      } catch (e) {
        console.error('[BOT DESIGN] Erro ao mudar banner:', e);
      }
      
      fs.writeFileSync(designPath, JSON.stringify(data, null, 2));
      await interaction.reply({ 
        content: `${emojis.confirmed_emoji || '✅'} Design salvo e aplicado!`, 
        ephemeral: true 
      });
      return;
    }

    // ==========================================
    // SISTEMA DE CORES
    // ==========================================

    // Handler do botão Cores
    if (interaction.isButton() && interaction.customId === 'meubot_cores') {
      const cores = [
        { label: 'Vermelho', value: '#ED4245', emoji: emojis.vermelho_emoji || '🔴' },
        { label: 'Verde', value: '#57F287', emoji: emojis.verde_emoji || '🟢' },
        { label: 'Azul', value: '#5865F2', emoji: emojis.azul_emoji || '🔵' },
        { label: 'Amarelo', value: '#FEE75C', emoji: emojis.amarelo_emoji || '🟡' },
        { label: 'Laranja', value: '#FFA500', emoji: emojis.laranja_emoji || '🟠' },
        { label: 'Rosa', value: '#EB459E', emoji: emojis.rosa_emoji || '🔴' },
        { label: 'Preto', value: '#23272A', emoji: emojis.preto_emoji || '⚫' },
        { label: 'Branco', value: '#FFFFFF', emoji: emojis.branco_emoji || '⚪' }
      ];
      
      const select = new StringSelectMenuBuilder()
        .setCustomId('meubot_select_cor')
        .setPlaceholder('Escolha uma cor para o bot')
        .addOptions(cores.map(cor => ({ 
          label: cor.label, 
          value: cor.value, 
          emoji: cor.emoji 
        })));
      
      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ 
        content: 'Selecione uma cor para o bot:', 
        components: [row], 
        ephemeral: true 
      });
      return;
    }

    // Handler do select menu de cor
    if (interaction.isStringSelectMenu() && interaction.customId === 'meubot_select_cor') {
      const cor = interaction.values[0];
      fs.writeFileSync(colorPath, JSON.stringify({ cor }, null, 2));
      await interaction.reply({ 
        content: `${emojis.confirmed_emoji || '✅'} Cor salva: ${cor}`, 
        ephemeral: true 
      });
      return;
    }

    // ==========================================
    // SISTEMA DE PERSONALIZAÇÃO DE QR CODE
    // ========================================

    // Handler do botão QR Code
    if (interaction.isButton() && interaction.customId === 'meubot_qrcode') {
      const config = getQRCodeConfig();
      
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎨 Personalização de QR Code')
        .setDescription(
          'Configure o design dos QR Codes gerados pelo bot.\n\n' +
          '**Configuração Atual:**'
        )
        .addFields(
          { 
            name: '📏 Tamanho', 
            value: `\`${config.size}x${config.size} pixels\``, 
            inline: true 
          },
          { 
            name: '🎨 Cor do QR', 
            value: `\`#${config.color}\` (${getNomeCor(config.color)})`, 
            inline: true 
          },
          { 
            name: '🖼️ Cor de Fundo', 
            value: `\`#${config.bgcolor}\` (${getNomeCor(config.bgcolor)})`, 
            inline: true 
          },
          { 
            name: '📄 Formato', 
            value: `\`${config.format.toUpperCase()}\``, 
            inline: true 
          }
        )
        .setFooter({ text: '💡 Use os botões abaixo para personalizar' })
        .setTimestamp();

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('qrcode_editar')
          .setLabel('Editar Configurações')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId('qrcode_cores_preset')
          .setLabel('Cores Predefinidas')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎨'),
        new ButtonBuilder()
          .setCustomId('qrcode_testar')
          .setLabel('Testar QR Code')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🧪')
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('qrcode_resetar')
          .setLabel('Resetar Padrão')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('qrcode_voltar')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji || '◀️')
      );

      await interaction.update({ embeds: [embed], components: [row1, row2] });
      return;
    }

    // Handler do botão Editar Configurações
    if (interaction.isButton() && interaction.customId === 'qrcode_editar') {
      const config = getQRCodeConfig();
      
      const modal = new ModalBuilder()
        .setCustomId('modal_qrcode_editar')
        .setTitle('🎨 Editar QR Code');

      const tamanhoInput = new TextInputBuilder()
        .setCustomId('qrcode_tamanho')
        .setLabel('Tamanho (pixels)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 300, 400, 500')
        .setValue(config.size.toString())
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(4);

      const corInput = new TextInputBuilder()
        .setCustomId('qrcode_cor')
        .setLabel('Cor do QR Code (Hex)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 000000, FF0000, 5865F2')
        .setValue(config.color)
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(7);

      const bgcolorInput = new TextInputBuilder()
        .setCustomId('qrcode_bgcolor')
        .setLabel('Cor de Fundo (Hex)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: FFFFFF, 000000, FFD700')
        .setValue(config.bgcolor)
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(7);

      modal.addComponents(
        new ActionRowBuilder().addComponents(tamanhoInput),
        new ActionRowBuilder().addComponents(corInput),
        new ActionRowBuilder().addComponents(bgcolorInput)
      );

      await interaction.showModal(modal);
      return;
    }

    // Handler do modal de edição
    if (interaction.isModalSubmit() && interaction.customId === 'modal_qrcode_editar') {
      const tamanho = parseInt(interaction.fields.getTextInputValue('qrcode_tamanho'));
      const cor = interaction.fields.getTextInputValue('qrcode_cor');
      const bgcolor = interaction.fields.getTextInputValue('qrcode_bgcolor');

      // Validações
      if (isNaN(tamanho) || tamanho < 100 || tamanho > 1000) {
        await interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Tamanho inválido! Use um valor entre 100 e 1000 pixels.`,
          ephemeral: true
        });
        return;
      }

      const corValida = validarCorHex(cor);
      if (!corValida) {
        await interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Cor do QR Code inválida! Use formato hexadecimal (ex: 000000 ou #000000).`,
          ephemeral: true
        });
        return;
      }

      const bgcolorValida = validarCorHex(bgcolor);
      if (!bgcolorValida) {
        await interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Cor de fundo inválida! Use formato hexadecimal (ex: FFFFFF ou #FFFFFF).`,
          ephemeral: true
        });
        return;
      }

      // Salva configuração
      const novaConfig = {
        size: tamanho,
        color: corValida,
        bgcolor: bgcolorValida,
        format: 'png'
      };

      if (saveQRCodeConfig(novaConfig)) {
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(`${emojis.confirmed_emoji || '✅'} Configurações Salvas!`)
          .setDescription('As configurações do QR Code foram atualizadas com sucesso!')
          .addFields(
            { name: '📏 Tamanho', value: `\`${tamanho}x${tamanho} pixels\``, inline: true },
            { name: '🎨 Cor do QR', value: `\`#${corValida}\``, inline: true },
            { name: '🖼️ Cor de Fundo', value: `\`#${bgcolorValida}\``, inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        await interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Erro ao salvar configurações.`,
          ephemeral: true
        });
      }
      return;
    }

    // Handler do botão Cores Predefinidas
    if (interaction.isButton() && interaction.customId === 'qrcode_cores_preset') {
      const presets = [
        { label: '⚫ Preto no Branco (Padrão)', value: 'preset_padrao', emoji: '⚫' },
        { label: '⚪ Branco no Preto', value: 'preset_dark', emoji: '⚪' },
        { label: '🔵 Azul Discord', value: 'preset_discord', emoji: '🔵' },
        { label: '🟢 Verde Neon', value: 'preset_neon', emoji: '🟢' },
        { label: '🔴 Vermelho no Preto', value: 'preset_red', emoji: '🔴' },
        { label: '🟡 Dourado', value: 'preset_gold', emoji: '🟡' },
        { label: '🟣 Roxo Galaxy', value: 'preset_purple', emoji: '🟣' }
      ];

      const select = new StringSelectMenuBuilder()
        .setCustomId('qrcode_select_preset')
        .setPlaceholder('🎨 Escolha um preset de cores')
        .addOptions(presets);

      const row = new ActionRowBuilder().addComponents(select);
      
      await interaction.reply({
        content: '**Selecione um preset de cores:**',
        components: [row],
        ephemeral: true
      });
      return;
    }

    // Handler do select menu de presets
    if (interaction.isStringSelectMenu() && interaction.customId === 'qrcode_select_preset') {
      const preset = interaction.values[0];
      let novaConfig = { ...getQRCodeConfig() };

      switch (preset) {
        case 'preset_padrao':
          novaConfig.color = '000000';
          novaConfig.bgcolor = 'FFFFFF';
          break;
        case 'preset_dark':
          novaConfig.color = 'FFFFFF';
          novaConfig.bgcolor = '000000';
          break;
        case 'preset_discord':
          novaConfig.color = '5865F2';
          novaConfig.bgcolor = 'FFFFFF';
          break;
        case 'preset_neon':
          novaConfig.color = '00FF00';
          novaConfig.bgcolor = '000000';
          break;
        case 'preset_red':
          novaConfig.color = 'FF0000';
          novaConfig.bgcolor = '000000';
          break;
        case 'preset_gold':
          novaConfig.color = 'FFD700';
          novaConfig.bgcolor = '000000';
          break;
        case 'preset_purple':
          novaConfig.color = '8B00FF';
          novaConfig.bgcolor = '1A0033';
          break;
      }

      if (saveQRCodeConfig(novaConfig)) {
        await interaction.reply({
          content: `${emojis.confirmed_emoji || '✅'} Preset aplicado! Cor: \`${novaConfig.color}\` | Fundo: \`${novaConfig.bgcolor}\``,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Erro ao aplicar preset.`,
          ephemeral: true
        });
      }
      return;
    }

    // Handler do botão Testar
    if (interaction.isButton() && interaction.customId === 'qrcode_testar') {
      await interaction.deferReply({ ephemeral: true });

      const config = getQRCodeConfig();
      const textoTeste = 'https://discord.gg/exemplo';

      try {
        const qrBuffer = await baixarQRCode(textoTeste, config);

        if (qrBuffer) {
          const attachment = new AttachmentBuilder(qrBuffer, { name: 'qrcode-teste.png' });
          
          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('🧪 Teste de QR Code')
            .setDescription('Aqui está um exemplo de como os QR Codes serão gerados com as configurações atuais:')
            .addFields(
              { name: '📏 Tamanho', value: `\`${config.size}x${config.size}px\``, inline: true },
              { name: '🎨 Cor', value: `\`#${config.color}\``, inline: true },
              { name: '🖼️ Fundo', value: `\`#${config.bgcolor}\``, inline: true }
            )
            .setImage('attachment://qrcode-teste.png')
            .setFooter({ text: 'QR Code de teste gerado com sucesso!' })
            .setTimestamp();

          await interaction.editReply({ embeds: [embed], files: [attachment] });
        } else {
          await interaction.editReply({
            content: `${emojis.failuser_emoji || '❌'} Erro ao gerar QR Code de teste. Verifique suas configurações.`
          });
        }
      } catch (error) {
        console.error('[QR CODE TESTE] Erro:', error);
        await interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} Erro ao gerar QR Code de teste: ${error.message}`
        });
      }
      return;
    }

    // Handler do botão Resetar
    if (interaction.isButton() && interaction.customId === 'qrcode_resetar') {
      if (saveQRCodeConfig(DEFAULT_QRCODE_CONFIG)) {
        await interaction.reply({
          content: `${emojis.confirmed_emoji || '✅'} Configurações resetadas para o padrão!\n\n📏 Tamanho: \`300x300\`\n🎨 Cor: \`#000000\`\n🖼️ Fundo: \`#FFFFFF\``,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Erro ao resetar configurações.`,
          ephemeral: true
        });
      }
      return;
    }

    // Handler do botão Voltar (do QR Code)
    if (interaction.isButton() && interaction.customId === 'qrcode_voltar') {
      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle(`${emojis._diamond_emoji || '💎'} Meu Bot Design`)
        .setDescription('Personalize o visual do seu bot! Use os botões abaixo para editar o design, cores ou QR Code.');
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('meubot_design')
          .setLabel('Design')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._folder_emoji || '📁'),
        new ButtonBuilder()
          .setCustomId('meubot_cores')
          .setLabel('Cores')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._diamond_emoji || '💎'),
        new ButtonBuilder()
          .setCustomId('meubot_qrcode')
          .setLabel('QR Code')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎨'),
        // REMOVIDO: Botão Outros
        new ButtonBuilder()
          .setCustomId('meubot_voltar')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji || '◀️')
      );
      
      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    // Handler do botão Voltar (Principal)
    if (interaction.isButton() && interaction.customId === 'meubot_voltar') {
      const panelCommand = interaction.client.commands.get('panel');
      if (panelCommand) {
        await panelCommand.execute(interaction);
      } else {
        await interaction.reply({ 
          content: 'Não foi possível voltar ao painel inicial.', 
          ephemeral: true 
        });
      }
      return;
    }
  }
};