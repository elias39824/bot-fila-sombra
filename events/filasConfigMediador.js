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

function getCategoria() {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../DataBaseJson/categoria.json'));
    const ids = JSON.parse(data);
    return ids.length ? `<#${ids[0]}>` : 'Nenhuma definida';
  } catch {
    return 'Nenhuma definida';
  }
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

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // Botão para abrir select menu de mediador
    if (interaction.isButton() && interaction.customId === 'config_mediador') {
      await interaction.deferReply({ ephemeral: true });
      
      // Busca todos os cargos do servidor
      const roles = await interaction.guild.roles.fetch();
      const sortedRoles = roles
        .filter(role => role.id !== interaction.guild.id) // Remove @everyone
        .sort((a, b) => b.position - a.position) // Ordena por posição
        .first(25); // Limita a 25 (máximo do select menu)
      
      // Cria as opções do select menu
      const options = sortedRoles.map(role => 
        new StringSelectMenuOptionBuilder()
          .setLabel(role.name)
          .setValue(role.id)
          .setDescription(`ID: ${role.id}`)
      );
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_mediador')
        .setPlaceholder('🔍 Pesquise e selecione o cargo de mediador')
        .addOptions(options);
      
      const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
      
      await interaction.editReply({ 
        content: `${emojis._settings_emoji} Use a barra de pesquisa abaixo para encontrar e selecionar o cargo de mediador:`, 
        components: [rowSelect] 
      });
      return;
    }
    
    // Select menu de mediador
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_mediador') {
      const roleId = interaction.values[0];
      
      // Valida se o cargo existe
      try {
        const role = await interaction.guild.roles.fetch(roleId);
        if (!role) {
          return interaction.update({ 
            content: `${emojis.failuser_emoji || '❌'} Cargo não encontrado!`, 
            components: [] 
          });
        }
      } catch (error) {
        return interaction.update({ 
          content: `${emojis.failuser_emoji || '❌'} Erro ao buscar o cargo!`, 
          components: [] 
        });
      }
      
      fs.writeFileSync(path.join(__dirname, '../DataBaseJson/mediadores.json'), JSON.stringify([roleId], null, 2));
      
      const status = getStatusFilas();
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._settings_emoji} Configurações de Filas`)
        .setDescription(`Veja e altere as configurações principais das filas do servidor.\n\n${emojis._people_emoji} **Mediador:** ${getMediadores()}\n${emojis._folder_emoji} **Categoria:** ${getCategoria()}`);
      
      await interaction.update({ 
        content: `${emojis.confirmed_emoji} Cargo de mediador atualizado para <@&${roleId}>!`, 
        embeds: [embed], 
        components: [] 
      });
      return;
    }
  }
};