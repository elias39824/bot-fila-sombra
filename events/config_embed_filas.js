const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  StringSelectMenuBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// Caminho do arquivo de configuração
const configEmbedFilasPath = path.join(__dirname, '../DataBaseJson/configEmbedFilas.json');

// Configuração padrão
const DEFAULT_CONFIG = {
  cor: '#FF9900',
  banner_url: null,
  footer_text: null,
  footer_icon_url: null
};

// --- FUNÇÕES AUXILIARES ---

function getConfigEmbedFilas() {
  try {
    if (!fs.existsSync(configEmbedFilasPath)) {
      fs.writeFileSync(configEmbedFilasPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
      return DEFAULT_CONFIG;
    }
    const data = fs.readFileSync(configEmbedFilasPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[CONFIG EMBED FILAS] Erro ao ler:', error);
    return DEFAULT_CONFIG;
  }
}

function saveConfigEmbedFilas(config) {
  try {
    fs.writeFileSync(configEmbedFilasPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[CONFIG EMBED FILAS] Erro ao salvar:', error);
    return false;
  }
}

function validarURL(url) {
  if (!url || url.trim() === '') return null;
  
  try {
    const urlObj = new URL(url);
    return urlObj.href;
  } catch (e) {
    return null;
  }
}

function validarCorHex(cor) {
  const corLimpa = cor.replace('#', '').toUpperCase();
  if (/^[0-9A-F]{6}$/.test(corLimpa)) {
    return `#${corLimpa}`;
  }
  return null;
}

function getNomeCor(hex) {
  const cores = {
    'FFFFFF': 'Branco',
    '000000': 'Preto',
    'FF0000': 'Vermelho',
    '00FF00': 'Verde',
    '0000FF': 'Azul',
    'FFFF00': 'Amarelo',
    'FFA500': 'Laranja',
    'FF9900': 'Laranja Padrão',
    'FF1493': 'Rosa',
    'FFD700': 'Dourado',
    '800080': 'Roxo',
    '5865F2': 'Azul Discord',
    'F59E42': 'Laranja Suave',
    'ED4245': 'Vermelho Discord',
    '57F287': 'Verde Discord',
    'FEE75C': 'Amarelo Discord',
    'EB459E': 'Rosa Discord',
    '9B59B6': 'Roxo Discord'
  };
  return cores[hex.toUpperCase().replace('#', '')] || hex;
}

// --- HANDLER PRINCIPAL ---

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    
    // ==========================================
    // BOTÃO PRINCIPAL - ABRIR PAINEL
    // ==========================================
    
    if (interaction.isButton() && interaction.customId === 'config_embed') {
      const config = getConfigEmbedFilas();

      const embed = new EmbedBuilder()
        .setTitle('⚙️ Configuração de Embeds das Filas')
        .setDescription(
          'Personalize as embeds das filas de aposta (1v1, Normal e Mista).\n\n' +
          'Use os botões abaixo para configurar cada elemento.'
        )
        .setColor(config.cor || '#FF9900')
        .addFields(
          { 
            name: '🎨 Cor Atual', 
            value: `\`${config.cor || '#FF9900'}\` (${getNomeCor(config.cor || '#FF9900')})`, 
            inline: true 
          },
          { 
            name: '🖼️ Banner', 
            value: config.banner_url ? `[Ver Banner](${config.banner_url})` : '`Não configurado`', 
            inline: true 
          },
          { 
            name: '📝 Footer - Texto', 
            value: config.footer_text ? `\`${config.footer_text}\`` : '`Não configurado`', 
            inline: false 
          },
          { 
            name: '📌 Footer - Ícone', 
            value: config.footer_icon_url ? `[Ver Ícone](${config.footer_icon_url})` : '`Não configurado`', 
            inline: true 
          }
        )
        .setFooter({ text: 'Configure cada elemento individualmente' })
        .setTimestamp();

      if (config.banner_url) {
        embed.setImage(config.banner_url);
      }

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_filas_cor')
          .setLabel('Escolher Cor')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💎'),
        new ButtonBuilder()
          .setCustomId('config_filas_banner')
          .setLabel('Editar Banner')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🖼️'),
        new ButtonBuilder()
          .setCustomId('config_filas_footer')
          .setLabel('Editar Footer')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📌')
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_filas_preview')
          .setLabel('Visualizar Preview')
          .setStyle(ButtonStyle.Success)
          .setEmoji('👁️'),
        new ButtonBuilder()
          .setCustomId('config_filas_resetar')
          .setLabel('Resetar Padrão')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId('config_filas_voltar')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('◀️')
      );

      await interaction.update({ embeds: [embed], components: [row1, row2] });
      return;
    }

    // ==========================================
    // ESCOLHER COR (SELECT MENU)
    // ==========================================

    if (interaction.isButton() && interaction.customId === 'config_filas_cor') {
      const cores = [
        { label: 'Vermelho', value: '#ED4245', emoji: '🔴' },
        { label: 'Verde', value: '#57F287', emoji: '🟢' },
        { label: 'Azul Discord', value: '#5865F2', emoji: '🔵' },
        { label: 'Amarelo', value: '#FEE75C', emoji: '🟡' },
        { label: 'Laranja', value: '#FFA500', emoji: '🟠' },
        { label: 'Laranja Padrão', value: '#FF9900', emoji: '⭐' },
        { label: 'Rosa', value: '#EB459E', emoji: '🩷' },
        { label: 'Roxo', value: '#9B59B6', emoji: '🟣' },
        { label: 'Dourado', value: '#FFD700', emoji: '🏆' },
        { label: 'Personalizado', value: 'custom', emoji: '✏️' }
      ];

      const select = new StringSelectMenuBuilder()
        .setCustomId('select_config_filas_cor')
        .setPlaceholder('🎨 Escolha uma cor para as embeds')
        .addOptions(cores.map(cor => ({
          label: cor.label,
          value: cor.value,
          emoji: cor.emoji
        })));

      const row = new ActionRowBuilder().addComponents(select);

      await interaction.reply({
        content: '🎨 **Selecione uma cor para as embeds das filas:**',
        components: [row],
        ephemeral: true
      });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_config_filas_cor') {
      const valor = interaction.values[0];

      if (valor === 'custom') {
        const modal = new ModalBuilder()
          .setCustomId('modal_config_filas_cor_custom')
          .setTitle('🎨 Cor Personalizada');

        const corInput = new TextInputBuilder()
          .setCustomId('cor_hex')
          .setLabel('Código Hexadecimal da Cor')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: #FF5733, FF5733, 5865F2')
          .setRequired(true)
          .setMinLength(6)
          .setMaxLength(7);

        modal.addComponents(new ActionRowBuilder().addComponents(corInput));

        await interaction.showModal(modal);
        return;
      }

      // Salva a cor selecionada
      const config = getConfigEmbedFilas();
      config.cor = valor;

      if (saveConfigEmbedFilas(config)) {
        // Cria embed de confirmação com a nova cor
        const embedConfirm = new EmbedBuilder()
          .setTitle('✅ Cor Atualizada!')
          .setDescription(
            `A cor das embeds foi alterada com sucesso!\n\n` +
            `**Nova cor:** \`${valor}\`\n` +
            `**Nome:** ${getNomeCor(valor)}`
          )
          .setColor(valor)
          .setTimestamp();

        await interaction.update({
          content: null,
          embeds: [embedConfirm],
          components: []
        });

        // Volta pro painel após 3 segundos
        setTimeout(async () => {
          try {
            const configAtual = getConfigEmbedFilas();
            
            const embedPainel = new EmbedBuilder()
              .setTitle('⚙️ Configuração de Embeds das Filas')
              .setDescription(
                'Personalize as embeds das filas de aposta (1v1, Normal e Mista).\n\n' +
                'Use os botões abaixo para configurar cada elemento.'
              )
              .setColor(configAtual.cor || '#FF9900')
              .addFields(
                { 
                  name: '🎨 Cor Atual', 
                  value: `\`${configAtual.cor || '#FF9900'}\` (${getNomeCor(configAtual.cor || '#FF9900')})`, 
                  inline: true 
                },
                { 
                  name: '🖼️ Banner', 
                  value: configAtual.banner_url ? `[Ver Banner](${configAtual.banner_url})` : '`Não configurado`', 
                  inline: true 
                },
                { 
                  name: '📝 Footer - Texto', 
                  value: configAtual.footer_text ? `\`${configAtual.footer_text}\`` : '`Não configurado`', 
                  inline: false 
                },
                { 
                  name: '📌 Footer - Ícone', 
                  value: configAtual.footer_icon_url ? `[Ver Ícone](${configAtual.footer_icon_url})` : '`Não configurado`', 
                  inline: true 
                }
              )
              .setFooter({ text: 'Configure cada elemento individualmente' })
              .setTimestamp();

            if (configAtual.banner_url) {
              embedPainel.setImage(configAtual.banner_url);
            }

            const row1 = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('config_filas_cor')
                .setLabel('Escolher Cor')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💎'),
              new ButtonBuilder()
                .setCustomId('config_filas_banner')
                .setLabel('Editar Banner')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🖼️'),
              new ButtonBuilder()
                .setCustomId('config_filas_footer')
                .setLabel('Editar Footer')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📌')
            );

            const row2 = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('config_filas_preview')
                .setLabel('Visualizar Preview')
                .setStyle(ButtonStyle.Success)
                .setEmoji('👁️'),
              new ButtonBuilder()
                .setCustomId('config_filas_resetar')
                .setLabel('Resetar Padrão')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔄'),
              new ButtonBuilder()
                .setCustomId('config_filas_voltar')
                .setLabel('Voltar')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('◀️')
            );

            await interaction.editReply({ embeds: [embedPainel], components: [row1, row2] });
          } catch (e) {
            console.error('[CONFIG EMBED] Erro ao voltar:', e);
          }
        }, 3000);

      } else {
        await interaction.update({
          content: '❌ **Erro ao salvar configuração!**',
          components: []
        });
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_config_filas_cor_custom') {
      await interaction.deferReply({ ephemeral: true });

      const corHex = interaction.fields.getTextInputValue('cor_hex').trim();
      const corValida = validarCorHex(corHex);

      if (!corValida) {
        await interaction.editReply({
          content: '❌ **Cor inválida!** Use o formato hexadecimal (ex: `FF5733` ou `#FF5733`)'
        });
        return;
      }

      const config = getConfigEmbedFilas();
      config.cor = corValida;

      if (saveConfigEmbedFilas(config)) {
        const embedConfirm = new EmbedBuilder()
          .setTitle('✅ Cor Personalizada Salva!')
          .setDescription(
            `A cor das embeds foi alterada com sucesso!\n\n` +
            `**Nova cor:** \`${corValida}\``
          )
          .setColor(corValida)
          .setTimestamp();

        await interaction.editReply({
          content: null,
          embeds: [embedConfirm]
        });
      } else {
        await interaction.editReply({
          content: '❌ **Erro ao salvar configuração!**'
        });
      }
      return;
    }

    // ==========================================
    // EDITAR BANNER
    // ==========================================

    if (interaction.isButton() && interaction.customId === 'config_filas_banner') {
      const config = getConfigEmbedFilas();

      const modal = new ModalBuilder()
        .setCustomId('modal_config_filas_banner')
        .setTitle('🖼️ Editar Banner da Embed');

      const bannerInput = new TextInputBuilder()
        .setCustomId('banner_url')
        .setLabel('URL do Banner (Imagem ou GIF)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: https://i.imgur.com/exemplo.gif')
        .setValue(config.banner_url || '')
        .setRequired(false)
        .setMaxLength(500);

      modal.addComponents(new ActionRowBuilder().addComponents(bannerInput));

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_config_filas_banner') {
      await interaction.deferReply({ ephemeral: true });

      const bannerUrl = interaction.fields.getTextInputValue('banner_url').trim();
      const urlValida = validarURL(bannerUrl);

      if (bannerUrl && !urlValida) {
        await interaction.editReply({
          content: '❌ **URL inválida!** Certifique-se de que é um link válido.'
        });
        return;
      }

      const config = getConfigEmbedFilas();
      config.banner_url = urlValida;

      if (saveConfigEmbedFilas(config)) {
        if (urlValida) {
          const embedPreview = new EmbedBuilder()
            .setTitle('✅ Banner Atualizado!')
            .setDescription('Veja como ficou abaixo:')
            .setImage(urlValida)
            .setColor(config.cor || '#FF9900')
            .setTimestamp();

          await interaction.editReply({
            content: `**URL do banner:** \`${urlValida}\``,
            embeds: [embedPreview]
          });
        } else {
          await interaction.editReply({
            content: '✅ **Banner removido com sucesso!**'
          });
        }
      } else {
        await interaction.editReply({
          content: '❌ **Erro ao salvar configuração!**'
        });
      }
      return;
    }

    // ==========================================
    // EDITAR FOOTER
    // ==========================================

    if (interaction.isButton() && interaction.customId === 'config_filas_footer') {
      const config = getConfigEmbedFilas();

      const modal = new ModalBuilder()
        .setCustomId('modal_config_filas_footer')
        .setTitle('📌 Editar Footer da Embed');

      const textoInput = new TextInputBuilder()
        .setCustomId('footer_text')
        .setLabel('Texto do Footer')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: Entre na fila e boa sorte!')
        .setValue(config.footer_text || '')
        .setRequired(false)
        .setMaxLength(100);

      const iconeInput = new TextInputBuilder()
        .setCustomId('footer_icon')
        .setLabel('URL do Ícone do Footer (Imagem)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: https://i.imgur.com/icone.png')
        .setValue(config.footer_icon_url || '')
        .setRequired(false)
        .setMaxLength(500);

      modal.addComponents(
        new ActionRowBuilder().addComponents(textoInput),
        new ActionRowBuilder().addComponents(iconeInput)
      );

      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_config_filas_footer') {
      await interaction.deferReply({ ephemeral: true });

      const footerText = interaction.fields.getTextInputValue('footer_text').trim();
      const footerIcon = interaction.fields.getTextInputValue('footer_icon').trim();

      const iconValida = validarURL(footerIcon);

      if (footerIcon && !iconValida) {
        await interaction.editReply({
          content: '❌ **URL do ícone inválida!** Certifique-se de que é um link válido.'
        });
        return;
      }

      const config = getConfigEmbedFilas();
      config.footer_text = footerText || null;
      config.footer_icon_url = iconValida;

      if (saveConfigEmbedFilas(config)) {
        const embedPreview = new EmbedBuilder()
          .setTitle('✅ Footer Atualizado!')
          .setDescription('Veja como ficou abaixo:')
          .setColor(config.cor || '#FF9900')
          .setTimestamp();

        if (footerText || iconValida) {
          embedPreview.setFooter({ 
            text: footerText || 'Footer sem texto', 
            iconURL: iconValida || undefined 
          });
        }

        await interaction.editReply({
          embeds: [embedPreview]
        });
      } else {
        await interaction.editReply({
          content: '❌ **Erro ao salvar configuração!**'
        });
      }
      return;
    }

    // ==========================================
    // VISUALIZAR PREVIEW
    // ==========================================

    if (interaction.isButton() && interaction.customId === 'config_filas_preview') {
      await interaction.deferReply({ ephemeral: true });

      const config = getConfigEmbedFilas();

      const embedPreview = new EmbedBuilder()
        .setTitle('🎮 FILA 1V1 | 0% DE TAXA')
        .setColor(config.cor || '#FF9900')
        .setThumbnail(interaction.guild.iconURL() || null)
        .addFields(
          { name: '🎯 MODO', value: '`fila solo`', inline: false },
          { name: '💰 VALOR', value: 'R$ 50,90', inline: false },
          { name: '👥 JOGADORES', value: 'Nenhum jogador na fila.', inline: false }
        )
        .setTimestamp();

      if (config.banner_url) {
        embedPreview.setImage(config.banner_url);
      }

      if (config.footer_text || config.footer_icon_url) {
        embedPreview.setFooter({
          text: config.footer_text || 'Fila de apostas',
          iconURL: config.footer_icon_url || undefined
        });
      }

      await interaction.editReply({
        content: '👁️ **Preview da Embed de Fila:**',
        embeds: [embedPreview]
      });
      return;
    }

    // ==========================================
    // RESETAR PADRÃO
    // ==========================================

    if (interaction.isButton() && interaction.customId === 'config_filas_resetar') {
      if (saveConfigEmbedFilas(DEFAULT_CONFIG)) {
        await interaction.reply({
          content: '✅ **Configurações resetadas para o padrão com sucesso!**',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: '❌ **Erro ao resetar configurações!**',
          ephemeral: true
        });
      }
      return;
    }

    // ==========================================
    // VOLTAR
    // ==========================================

    if (interaction.isButton() && interaction.customId === 'config_filas_voltar') {
      const panelCommand = interaction.client.commands.get('panel');
      if (panelCommand) {
        await panelCommand.execute(interaction);
      } else {
        await interaction.reply({
          content: '❌ **Não foi possível voltar ao painel inicial.**',
          ephemeral: true
        });
      }
      return;
    }
  }
};