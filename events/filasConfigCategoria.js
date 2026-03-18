const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

function getMediadores() {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../DataBaseJson/mediadores.json'));
    const ids = JSON.parse(data);
    return ids.length ? ids.map(id => `<@&${id}>`).join(', ') : 'Nenhum definido';
  } catch {
    return 'Nenhum definido';
  }
}

function getConfigFilas() {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../DataBaseJson/configFilas.json'));
    return JSON.parse(data);
  } catch {
    return { tipo: 'nenhum', categorias: [], canais: [] };
  }
}

function saveConfigFilas(config) {
  fs.writeFileSync(path.join(__dirname, '../DataBaseJson/configFilas.json'), JSON.stringify(config, null, 2));
}

function getStatusFilas() {
  function countFila(file) {
    try {
      const data = fs.readFileSync(path.join(__dirname, `../DataBaseJson/${file}`));
      const filas = JSON.parse(data);
      return Object.values(filas).reduce((acc, arr) => acc + arr.length, 0);
    } catch {
      return 0;
    }
  }
  return {
    '1v1': countFila('filas1v1.json'),
    'Normal': countFila('filasNormal.json'),
    'Misto': countFila('filasMisto.json')
  };
}

function formatarConfigFilas() {
  const config = getConfigFilas();
  
  if (config.tipo === 'nenhum') {
    return '**Tipo:** Nenhum configurado';
  }
  
  if (config.tipo === 'topico') {
    const canaisFormatados = config.canais.length 
      ? config.canais.map(id => `<#${id}>`).join(', ')
      : 'Nenhum canal configurado';
    return `**Tipo:** Tópicos\n**Canais:** ${canaisFormatados}`;
  }
  
  if (config.tipo === 'categoria') {
    const categoriasFormatadas = config.categorias.length
      ? config.categorias.map((id, index) => `${index + 1}. <#${id}>`).join('\n')
      : 'Nenhuma categoria configurada';
    return `**Tipo:** Categorias\n**Categorias:**\n${categoriasFormatadas}`;
  }
  
  return 'Configuração inválida';
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Botão para abrir seletor de tipo de fila
    if (interaction.isButton() && interaction.customId === 'config_categoria') {
      const select = new StringSelectMenuBuilder()
        .setCustomId('select_tipo_fila')
        .setPlaceholder('Escolha o tipo de fila')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Tópicos')
            .setDescription('Criar apostas em tópicos de canais específicos')
            .setValue('topico'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Categorias')
            .setDescription('Criar apostas em canais dentro de categorias')
            .setValue('categoria')
        );
      
      const row = new ActionRowBuilder().addComponents(select);
      
      await interaction.reply({
        content: 'Escolha o tipo de sistema de filas:',
        components: [row],
        ephemeral: true
      });
      return;
    }

    // Select menu de tipo de fila
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_tipo_fila') {
      const tipo = interaction.values[0];
      
      if (tipo === 'topico') {
        const modal = new ModalBuilder()
          .setCustomId('modal_topico')
          .setTitle('Configurar Canais para Tópicos');
        
        const input = new TextInputBuilder()
          .setCustomId('canais_ids')
          .setLabel('IDs dos canais (separados por vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: 123456789,987654321,111222333\n(Até 6 canais)')
          .setRequired(true);
        
        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        await interaction.showModal(modal);
        return;
      }
      
      if (tipo === 'categoria') {
        const modal = new ModalBuilder()
          .setCustomId('modal_categoria')
          .setTitle('Configurar Categorias');
        
        const input = new TextInputBuilder()
          .setCustomId('categorias_ids')
          .setLabel('IDs das categorias (separados por vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: 123456789,987654321,111222333\n(Até 6 categorias)')
          .setRequired(true);
        
        const row = new ActionRowBuilder().addComponents(input);
        modal.addComponents(row);
        await interaction.showModal(modal);
        return;
      }
    }

    // Modal de tópicos
    if (interaction.isModalSubmit() && interaction.customId === 'modal_topico') {
      const canaisInput = interaction.fields.getTextInputValue('canais_ids');
      const canaisIds = canaisInput.split(',').map(id => id.trim()).filter(id => id.length > 0);
      
      if (canaisIds.length > 6) {
        await interaction.reply({
          content: `${emojis.error_emoji || '❌'} Você pode configurar no máximo 6 canais!`,
          ephemeral: true
        });
        return;
      }
      
      // Valida se os canais existem
      let canaisInvalidos = [];
      for (const id of canaisIds) {
        const canal = await interaction.guild.channels.fetch(id).catch(() => null);
        if (!canal) {
          canaisInvalidos.push(id);
        }
      }
      
      if (canaisInvalidos.length > 0) {
        await interaction.reply({
          content: `${emojis.error_emoji || '❌'} Canais inválidos ou não encontrados: ${canaisInvalidos.join(', ')}`,
          ephemeral: true
        });
        return;
      }
      
      const config = {
        tipo: 'topico',
        canais: canaisIds,
        categorias: []
      };
      
      saveConfigFilas(config);
      
      const status = getStatusFilas();
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._settings_emoji || '⚙️'} Configurações de Filas`)
        .setDescription(
          `Veja e altere as configurações principais das filas do servidor.\n\n` +
          `**Mediador:** ${getMediadores()}\n\n` +
          `**Configuração de Filas:**\n${formatarConfigFilas()}`
        )
        .setFooter({ text: 'Use os botões abaixo para alterar as configurações.', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });
      
      await interaction.reply({
        content: `${emojis.confirmed_emoji || '✅'} Configuração de tópicos atualizada! ${canaisIds.length} canal(is) configurado(s).`,
        embeds: [embed],
        ephemeral: true
      });
    }

    // Modal de categorias
    if (interaction.isModalSubmit() && interaction.customId === 'modal_categoria') {
      const categoriasInput = interaction.fields.getTextInputValue('categorias_ids');
      const categoriasIds = categoriasInput.split(',').map(id => id.trim()).filter(id => id.length > 0);
      
      if (categoriasIds.length > 6) {
        await interaction.reply({
          content: `${emojis.error_emoji || '❌'} Você pode configurar no máximo 6 categorias!`,
          ephemeral: true
        });
        return;
      }
      
      // Valida se as categorias existem
      let categoriasInvalidas = [];
      for (const id of categoriasIds) {
        const categoria = await interaction.guild.channels.fetch(id).catch(() => null);
        if (!categoria || categoria.type !== 4) { // 4 = GUILD_CATEGORY
          categoriasInvalidas.push(id);
        }
      }
      
      if (categoriasInvalidas.length > 0) {
        await interaction.reply({
          content: `${emojis.error_emoji || '❌'} Categorias inválidas ou não encontradas: ${categoriasInvalidas.join(', ')}`,
          ephemeral: true
        });
        return;
      }
      
      const config = {
        tipo: 'categoria',
        categorias: categoriasIds,
        canais: []
      };
      
      saveConfigFilas(config);
      
      const status = getStatusFilas();
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._settings_emoji || '⚙️'} Configurações de Filas`)
        .setDescription(
          `Veja e altere as configurações principais das filas do servidor.\n\n` +
          `**Mediador:** ${getMediadores()}\n\n` +
          `**Configuração de Filas:**\n${formatarConfigFilas()}`
        )
        .setFooter({ text: 'Use os botões abaixo para alterar as configurações.', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });
      
      await interaction.reply({
        content: `${emojis.confirmed_emoji || '✅'} Configuração de categorias atualizada! ${categoriasIds.length} categoria(s) configurada(s).`,
        embeds: [embed],
        ephemeral: true
      });
    }
  }
};