const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const configPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');
const configHistoryPath = path.join(__dirname, '../DataBaseJson/configHistory.json');

function getConfig() {
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    return config && typeof config === 'object' ? config : {};
  } catch (e) {
    if (e.code === 'ENOENT') {
      const defaultConfig = { timeout_match: 60 };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      return defaultConfig;
    }
    console.error('[ERROR] Erro ao ler configuracoes.json:', e);
    return {};
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    console.log('[SUCCESS] Configurações salvas com sucesso.');
    return true;
  } catch (e) {
    console.error('[ERROR] Erro ao salvar configurações:', e);
    return false;
  }
}

function registrarAlteracao(usuario, campo, valorAntigo, valorNovo) {
  try {
    let historico = fs.existsSync(configHistoryPath) ? JSON.parse(fs.readFileSync(configHistoryPath, 'utf-8')) : [];
    historico.push({
      timestamp: new Date().toISOString(),
      usuario: { id: usuario.id, tag: usuario.tag, nome: usuario.username },
      campo: campo,
      valorAntigo: valorAntigo,
      valorNovo: valorNovo
    });
    if (historico.length > 500) historico = historico.slice(-500);
    fs.writeFileSync(configHistoryPath, JSON.stringify(historico, null, 2));
  } catch (e) {
    console.error('[ERROR] Falha ao registrar histórico:', e);
  }
}

function formatarValoresFila(valoresInput) {
  let valoresLimpos = valoresInput.replace(/;/g, ',').replace(/\s+/g, ',');
  const valoresFormatados = valoresLimpos.split(',').map(v => v.trim()).filter(v => v.length > 0);
  
  const valoresFinais = valoresFormatados.map(v => {
    const numericValue = parseFloat(v.replace(',', '.').replace(/[^\d.]/g, ''));
    if (isNaN(numericValue) || numericValue <= 0) return null;
    return numericValue.toFixed(2).replace('.', ',');
  }).filter(v => v !== null);
  
  return valoresFinais;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    
    // Botão principal de configuração de valores
    if (interaction.isButton() && interaction.customId === 'config_valores') {
      const config = getConfig();
      
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._money_emoji || '💰'} Configuração de Valores das Filas`)
        .setDescription('Configure os valores de aposta disponíveis para cada tipo de fila.\n\n**Status Atual:**')
        .addFields(
          {
            name: `${emojis._star_emoji || '🎯'} Fila 1V1`,
            value: config.valores_1v1 && config.valores_1v1.length > 0 
              ? `\`\`\`${config.valores_1v1.join(', ')}\`\`\`\n📊 **Total:** ${config.valores_1v1.length} valores`
              : '`Não configurado`',
            inline: false
          },
          {
            name: `${emojis.command_emoji || '⚔️'} Fila Normal`,
            value: config.valores_normal && config.valores_normal.length > 0
              ? `\`\`\`${config.valores_normal.join(', ')}\`\`\`\n📊 **Total:** ${config.valores_normal.length} valores`
              : '`Não configurado`',
            inline: false
          },
          {
            name: `${emojis._diamond_emoji || '🎪'} Fila Misto`,
            value: config.valores_misto && config.valores_misto.length > 0
              ? `\`\`\`${config.valores_misto.join(', ')}\`\`\`\n📊 **Total:** ${config.valores_misto.length} valores`
              : '`Não configurado`',
            inline: false
          }
        )
        .setFooter({ text: '💡 Selecione a fila que deseja configurar', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' })
        .setTimestamp();

      const select = new StringSelectMenuBuilder()
        .setCustomId('valores_select_fila')
        .setPlaceholder('🔧 Selecione uma fila para configurar')
        .addOptions([
          {
            label: 'Fila 1V1',
            value: 'valores_1v1',
            description: 'Configurar valores da fila 1V1',
            emoji: emojis._star_emoji || '🎯'
          },
          {
            label: 'Fila Normal',
            value: 'valores_normal',
            description: 'Configurar valores da fila Normal',
            emoji: emojis.command_emoji || '⚔️'
          },
          {
            label: 'Fila Misto',
            value: 'valores_misto',
            description: 'Configurar valores da fila Misto',
            emoji: emojis._diamond_emoji || '🎪'
          }
        ]);

      const row1 = new ActionRowBuilder().addComponents(select);
      
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('voltar_blank_filas')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji || '◀️')
      );

      await interaction.update({ embeds: [embed], components: [row1, row2] });
      return;
    }

    // Handler do select menu de valores
    if (interaction.isStringSelectMenu() && interaction.customId === 'valores_select_fila') {
      const tipoFila = interaction.values[0].replace('valores_', '');
      const config = getConfig();
      
      const valoresSalvos = config[`valores_${tipoFila}`] || ['10,90', '5,90', '1,90'];
      
      const modal = new ModalBuilder()
        .setCustomId(`modal_valores_${tipoFila}`)
        .setTitle(`💰 Configurar Valores - ${tipoFila.toUpperCase()}`);

      const inputValores = new TextInputBuilder()
        .setCustomId('valores_input')
        .setLabel(`Valores para fila ${tipoFila.toUpperCase()}`)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Ex: 10.90, 5.90, 1.90 ou 10,90; 5,90; 1,90')
        .setRequired(true)
        .setValue(valoresSalvos.join(', '))
        .setMaxLength(500);

      modal.addComponents(new ActionRowBuilder().addComponents(inputValores));
      
      await interaction.showModal(modal);
      return;
    }

    // Handler do modal de valores
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_valores_')) {
      const tipoFila = interaction.customId.replace('modal_valores_', '');
      const valoresInput = interaction.fields.getTextInputValue('valores_input');
      
      const valoresFinais = formatarValoresFila(valoresInput);
      
      if (valoresFinais.length === 0) {
        await interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} **Erro!** Nenhum valor válido foi fornecido.\n\n💡 **Dica:** Use valores numéricos separados por vírgula, espaço ou ponto-e-vírgula.\n**Exemplo:** \`10.90, 5.90, 1.90\``,
          ephemeral: true
        });
        return;
      }

      const config = getConfig();
      const valoresAntigos = config[`valores_${tipoFila}`] || [];
      
      config[`valores_${tipoFila}`] = valoresFinais;
      
      if (saveConfig(config)) {
        registrarAlteracao(
          interaction.user,
          `Valores Fila ${tipoFila.toUpperCase()}`,
          valoresAntigos.join(', '),
          valoresFinais.join(', ')
        );

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(`${emojis.confirmed_emoji || '✅'} Valores Configurados!`)
          .setDescription(`Os valores da fila **${tipoFila.toUpperCase()}** foram atualizados com sucesso!`)
          .addFields(
            {
              name: '📊 Valores Anteriores',
              value: valoresAntigos.length > 0 ? `\`${valoresAntigos.join(', ')}\`` : '`Nenhum`',
              inline: false
            },
            {
              name: '💰 Novos Valores',
              value: `\`${valoresFinais.join(', ')}\``,
              inline: false
            },
            {
              name: '📈 Estatísticas',
              value: `**Total de valores:** ${valoresFinais.length}\n**Menor valor:** R$ ${valoresFinais[valoresFinais.length - 1]}\n**Maior valor:** R$ ${valoresFinais[0]}`,
              inline: false
            }
          )
          .setFooter({ text: `Configurado por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } else {
        await interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} Erro ao salvar as configurações. Tente novamente.`,
          ephemeral: true
        });
      }
      return;
    }

    // Botão voltar para blank_filas
    if (interaction.isButton() && interaction.customId === 'voltar_blank_filas') {
      // Recriar o embed de blank_filas
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._settings_emoji} Configurações de Filas`)
        .setDescription(`Veja e altere as configurações principais das filas do servidor.\n\n${emojis._people_emoji} **Mediador:** ${getMediadores()}\n${emojis._folder_emoji} **Categoria:** ${getCategoria()}`)
        .setFooter({ text: 'Use os botões abaixo para alterar as configurações.', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_mediador')
          .setLabel('Mediador')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._people_emoji),
        new ButtonBuilder()
          .setCustomId('config_categoria')
          .setLabel('Categoria')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._folder_emoji),
        new ButtonBuilder()
          .setCustomId('config_valores')
          .setLabel('Valores')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('config_taxa')
          .setLabel('Taxa')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('config_regenerar')
          .setLabel('Regenerar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji(emojis._clean_emoji),
        new ButtonBuilder()
          .setCustomId('voltar_painel_principal')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji)
      );
      
      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }
  }
};

function getMediadores() {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../DataBaseJson/mediador.json'));
    const ids = JSON.parse(data);
    return ids.length ? ids.map(id => `<@&${id}>`).join(', ') : '@cargo desconhecido';
  } catch {
    return '@cargo desconhecido';
  }
}

function getCategoria() {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../DataBaseJson/categoria.json'));
    const ids = JSON.parse(data);
    return ids.length ? `<#${ids[0]}>` : 'Nenhuma definida';
  } catch {
    return 'Nenhuma definida';
  }
}