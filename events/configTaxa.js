const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
      const defaultConfig = { timeout_match: 60, taxa_servico: 1.80 };
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

function validarTaxa(valor) {
  const num = parseFloat(valor.toString().replace(',', '.'));
  
  if (isNaN(num)) {
    return { valido: false, erro: 'Valor numérico inválido. Digite um número válido.' };
  }
  
  if (num < 0) {
    return { valido: false, erro: 'A taxa não pode ser negativa.' };
  }
  
  if (num > 100) {
    return { valido: false, erro: 'A taxa não pode ser maior que R$ 100,00.' };
  }
  
  return { valido: true, valor: num };
}

function calcularExemplos(taxa) {
  const exemplos = [
    { aposta: 10.90, taxa: taxa, lucro: 10.90 - taxa },
    { aposta: 5.90, taxa: taxa, lucro: 5.90 - taxa },
    { aposta: 1.90, taxa: taxa, lucro: 1.90 - taxa }
  ];
  
  return exemplos.map(ex => {
    return `💰 Aposta: R$ ${ex.aposta.toFixed(2).replace('.', ',')} → Taxa: R$ ${ex.taxa.toFixed(2).replace('.', ',')} → Lucro: R$ ${ex.lucro.toFixed(2).replace('.', ',')}`;
  }).join('\n');
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    
    // Botão principal de configuração de taxa
    if (interaction.isButton() && interaction.customId === 'config_taxa') {
      const config = getConfig();
      const taxaAtual = config.taxa_servico !== undefined ? config.taxa_servico : 1.80;
      
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._money_emoji || '💰'} Configuração de Taxa de Serviço`)
        .setDescription('Configure o valor da taxa de serviço cobrada em cada partida.\n\n**Taxa Atual:**')
        .addFields(
          {
            name: '💵 Valor da Taxa',
            value: `\`R$ ${taxaAtual.toFixed(2).replace('.', ',')}\``,
            inline: true
          },
          {
            name: '📊 Porcentagem',
            value: taxaAtual > 0 ? `~${((taxaAtual / 10.90) * 100).toFixed(1)}% (base R$ 10,90)` : '0%',
            inline: true
          },
          {
            name: '📈 Exemplos de Cálculo',
            value: calcularExemplos(taxaAtual),
            inline: false
          },
          {
            name: '💡 Informações',
            value: '• A taxa é deduzida do valor da aposta\n• Valor mínimo: R$ 0,00\n• Valor máximo: R$ 100,00\n• Use vírgula ou ponto para decimais',
            inline: false
          }
        )
        .setFooter({ text: '💡 Clique no botão abaixo para alterar', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' })
        .setTimestamp();

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('taxa_alterar')
          .setLabel('Alterar Taxa')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💰'),
        new ButtonBuilder()
          .setCustomId('taxa_zerar')
          .setLabel('Zerar Taxa (0%)')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🚫')
      );

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

    // Botão para alterar taxa
    if (interaction.isButton() && interaction.customId === 'taxa_alterar') {
      const config = getConfig();
      const taxaAtual = config.taxa_servico !== undefined ? config.taxa_servico : 1.80;
      
      const modal = new ModalBuilder()
        .setCustomId('modal_taxa_servico')
        .setTitle('💰 Alterar Taxa de Serviço');

      const inputTaxa = new TextInputBuilder()
        .setCustomId('taxa_input')
        .setLabel('Novo valor da taxa (em R$)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ex: 1.80 ou 1,80 ou 2.50')
        .setRequired(true)
        .setValue(taxaAtual.toFixed(2).replace('.', ','))
        .setMinLength(1)
        .setMaxLength(10);

      modal.addComponents(new ActionRowBuilder().addComponents(inputTaxa));
      
      await interaction.showModal(modal);
      return;
    }

    // Botão para zerar taxa
    if (interaction.isButton() && interaction.customId === 'taxa_zerar') {
      const config = getConfig();
      const taxaAntiga = config.taxa_servico !== undefined ? config.taxa_servico : 1.80;
      
      config.taxa_servico = 0.00;
      
      if (saveConfig(config)) {
        registrarAlteracao(
          interaction.user,
          'Taxa de Serviço',
          `R$ ${taxaAntiga.toFixed(2).replace('.', ',')}`,
          'R$ 0,00'
        );

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(`${emojis.confirmed_emoji || '✅'} Taxa Zerada!`)
          .setDescription('A taxa de serviço foi **zerada** com sucesso!')
          .addFields(
            {
              name: '📊 Taxa Anterior',
              value: `\`R$ ${taxaAntiga.toFixed(2).replace('.', ',')}\``,
              inline: true
            },
            {
              name: '💰 Nova Taxa',
              value: '`R$ 0,00` **(0%)**',
              inline: true
            },
            {
              name: '💡 Informação',
              value: 'Agora não será cobrada nenhuma taxa nas partidas.',
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

    // Handler do modal de taxa
    if (interaction.isModalSubmit() && interaction.customId === 'modal_taxa_servico') {
      const taxaInput = interaction.fields.getTextInputValue('taxa_input');
      
      const validacao = validarTaxa(taxaInput);
      
      if (!validacao.valido) {
        await interaction.reply({
          content: `${emojis.failuser_emoji || '❌'} **Erro!** ${validacao.erro}\n\n💡 **Exemplos válidos:**\n• \`1.80\` ou \`1,80\`\n• \`2.50\` ou \`2,50\`\n• \`0\` (para taxa zero)`,
          ephemeral: true
        });
        return;
      }

      const config = getConfig();
      const taxaAntiga = config.taxa_servico !== undefined ? config.taxa_servico : 1.80;
      
      config.taxa_servico = validacao.valor;
      
      if (saveConfig(config)) {
        registrarAlteracao(
          interaction.user,
          'Taxa de Serviço',
          `R$ ${taxaAntiga.toFixed(2).replace('.', ',')}`,
          `R$ ${validacao.valor.toFixed(2).replace('.', ',')}`
        );

        const porcentagem = validacao.valor > 0 ? `(~${((validacao.valor / 10.90) * 100).toFixed(1)}%)` : '(0%)';

        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(`${emojis.confirmed_emoji || '✅'} Taxa Configurada!`)
          .setDescription('A taxa de serviço foi atualizada com sucesso!')
          .addFields(
            {
              name: '📊 Taxa Anterior',
              value: `\`R$ ${taxaAntiga.toFixed(2).replace('.', ',')}\``,
              inline: true
            },
            {
              name: '💰 Nova Taxa',
              value: `\`R$ ${validacao.valor.toFixed(2).replace('.', ',')}\` ${porcentagem}`,
              inline: true
            },
            {
              name: '📈 Exemplos Atualizados',
              value: calcularExemplos(validacao.valor),
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