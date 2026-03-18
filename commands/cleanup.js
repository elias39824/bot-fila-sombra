const { PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../config.json');
const permsPath = path.join(__dirname, '../DataBaseJson/perms.json');

function isOwnerOrPermitted(userId) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    if (config.ownerId === userId) return true;
    if (fs.existsSync(permsPath)) {
      const perms = JSON.parse(fs.readFileSync(permsPath));
      return Object.keys(perms).includes(userId);
    }
    return false;
  } catch {
    return false;
  }
}

module.exports = {
  name: 'cleanup',
  description: 'Dá nuke (deleta e recria) em todos os canais de texto do servidor (apenas para o dono ou quem tem permissão).',
  async execute(message, args) {
    if (!isOwnerOrPermitted(message.author.id)) {
      return message.reply('❌ Apenas o dono do bot ou quem tem permissão pode usar este comando!');
    }
    if (!message.guild) return;
    await message.reply('💣 Iniciando nuke em todos os canais de texto...');
    const channels = message.guild.channels.cache.filter(c => c.type === ChannelType.GuildText && c.deletable);
    for (const [id, channel] of channels) {
      const clone = await channel.clone({ reason: 'Nuke geral via !cleanup' });
      await channel.delete('Nuke geral via !cleanup');
      // Reposiciona o canal clonado na mesma posição
      await clone.setPosition(channel.position).catch(() => {});
    }
    await message.reply('✅ Nuke concluído! Todos os canais de texto foram limpos instantaneamente.');
  }
}; 