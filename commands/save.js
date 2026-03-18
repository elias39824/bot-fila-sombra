const fs = require('fs');

module.exports = {
  name: 'save',
  description: 'Salva o modelo do servidor (cargos, categorias e canais) em um arquivo JSON.',
  async execute(message, args) {
    const allowedId = '571553695209357342';
    if (!message.member.permissions.has('Administrator') && message.author.id !== allowedId) {
      return message.reply('❌ Você precisa ser administrador para usar este comando.');
    }
    const guild = message.guild;
    // Cargos
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({
        name: r.name,
        color: r.color,
        permissions: r.permissions.bitfield.toString(),
        hoist: r.hoist,
        mentionable: r.mentionable,
        position: r.position
      }));
    // Categorias
    const categories = guild.channels.cache
      .filter(c => c.type === 4)
      .map(c => ({
        name: c.name,
        position: c.position
      }));
    // Canais
    const channels = guild.channels.cache
      .filter(c => c.type !== 4)
      .map(c => {
        // Garante que sempre tenha overwrite para @everyone
        let overwrites = c.permissionOverwrites.cache.map(po => ({
          id: po.id,
          allow: po.allow.bitfield.toString(),
          deny: po.deny.bitfield.toString(),
          type: po.type
        }));
        if (!overwrites.some(po => po.id === guild.id)) {
          // Se não existe, adiciona um overwrite neutro para @everyone
          overwrites.push({
            id: guild.id,
            allow: '0',
            deny: '0',
            type: 0
          });
        }
        return {
          name: c.name,
          type: c.type,
          parent: c.parent ? c.parent.name : null,
          position: c.position,
          permissionOverwrites: overwrites
        };
      });
    // Monta o modelo
    const model = {
      guild: {
        name: guild.name,
        icon: guild.iconURL()
      },
      roles,
      categories,
      channels
    };
    // Salva em arquivo
    fs.writeFileSync('DataBaseJson/server_model.json', JSON.stringify(model, null, 2));
    message.reply('✅ Modelo do servidor salvo em DataBaseJson/server_model.json');
  }
}; 