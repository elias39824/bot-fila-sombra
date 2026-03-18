const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const blacklistPath = path.join(__dirname, '../DataBaseJson/blacklist.json');
const taxadosPath = path.join(__dirname, '../DataBaseJson/taxados.json');
const emojisPath = path.join(__dirname, '../DataBaseJson/emojis.json');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Ignora bots
    if (message.author.bot) return;

    // Pega os ids dos canais de blacklist (agora pode ser array)
    if (!fs.existsSync(blacklistPath)) return;
    const blacklistData = JSON.parse(fs.readFileSync(blacklistPath));
    let blacklistChannelIds = [];
    if (Array.isArray(blacklistData)) {
      blacklistChannelIds = blacklistData;
    } else if (typeof blacklistData === 'object' && blacklistData.id) {
      blacklistChannelIds = [blacklistData.id];
    }
    if (!blacklistChannelIds.includes(message.channel.id)) return;

    // Se não for só números, apaga
    if (!/^\d+$/.test(message.content.trim())) {
      try { await message.delete(); } catch (e) {}
      return;
    }

    // Busca no taxados.json
    let taxados = [];
    if (fs.existsSync(taxadosPath)) taxados = JSON.parse(fs.readFileSync(taxadosPath));
    const idProcurado = message.content.trim();
    const encontrado = taxados.find(t => t.id_jogo === idProcurado || t.id === idProcurado);

    // Carrega emojis
    let emojis = {};
    if (fs.existsSync(emojisPath)) emojis = JSON.parse(fs.readFileSync(emojisPath));

    let embed;
    if (encontrado) {
      embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`${emojis.confirmed_emoji} Detectado`)
        .setDescription(`O id \`${idProcurado}\` foi detectado na blacklist.\n-# Adicionado em ${encontrado.data || 'data desconhecida'} por <@${encontrado.adicionadoid || 'desconhecido'}>`);
    } else {
      embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`${emojis.failuser_emoji} Não Detectado`)
        .setDescription(`O id \`${idProcurado}\` não foi detectado na blacklist.\n-# Caso isso for um erro, chame a administração.`);
    }
    try {
      await message.reply({ embeds: [embed] });
      // Não apaga a mensagem original se for só números
    } catch (e) {}
  }
}; 