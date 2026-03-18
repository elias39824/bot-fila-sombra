const fs = require('fs');
const { PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'org',
  description: 'Apaga tudo que conseguir do servidor e recria o modelo salvo.',
  async execute(message, args) {
    const allowedId = '571553695209357342';
    if (!message.member.permissions.has('Administrator') && message.author.id !== allowedId) {
      return message.reply('❌ Você precisa ser administrador para usar este comando.');
    }
    const guild = message.guild;
    // Confirmação
    await message.reply('⏳ Organizando o servidor. Isso pode demorar alguns minutos...');
    // 1. Apagar canais (exceto canal atual)
    for (const channel of guild.channels.cache.values()) {
      if (channel.id !== message.channel.id) {
        try { await channel.delete(); } catch {}
      }
    }
    // 2. Apagar cargos (exceto @everyone e cargos acima do bot)
    const botMember = guild.members.me;
    for (const role of guild.roles.cache.values()) {
      if (role.id === guild.id) continue; // @everyone
      if (role.position >= botMember.roles.highest.position) continue;
      try { await role.delete(); } catch {}
    }
    // 3. Ler modelo salvo
    let model;
    try {
      model = JSON.parse(fs.readFileSync('DataBaseJson/server_model.json'));
    } catch {
      return message.channel.send('❌ Não foi possível ler o modelo salvo. Use !save antes.');
    }
    // 4. Recriar cargos e mapear IDs antigos para novos
    const roleMap = {};
    const idMap = {};
    for (const r of model.roles) {
      try {
        const newRole = await guild.roles.create({
          name: r.name,
          color: r.color,
          permissions: BigInt(r.permissions),
          hoist: r.hoist,
          mentionable: r.mentionable,
          position: r.position
        });
        roleMap[r.name] = newRole;
        if (r.id) idMap[r.id] = newRole.id;
      } catch {}
    }
    // Ajustar posições dos cargos
    const positions = model.roles.map(r => {
      const created = roleMap[r.name];
      if (created) {
        return { role: created.id, position: r.position };
      }
      return null;
    }).filter(Boolean);
    if (positions.length > 0) {
      await guild.roles.setPositions(positions);
    }
    // 5. Recriar categorias
    const categoryMap = {};
    for (const c of model.categories) {
      try {
        const newCat = await guild.channels.create({
          name: c.name,
          type: 4,
          position: c.position
        });
        categoryMap[c.name] = newCat;
      } catch {}
    }
    // 6. Recriar canais usando os novos IDs dos cargos
    for (const ch of model.channels) {
      try {
        const parent = ch.parent ? categoryMap[ch.parent] : null;
        const overwrites = ch.permissionOverwrites.map(po => {
          let overwriteType = po.type;
          if (overwriteType !== 0 && overwriteType !== 1) {
            overwriteType = guild.roles.cache.has(po.id) ? 0 : 1;
          }
          return {
            id: idMap[po.id] || po.id,
            allow: new PermissionsBitField(BigInt(po.allow)).toArray(),
            deny: new PermissionsBitField(BigInt(po.deny)).toArray(),
            type: overwriteType
          };
        });
        console.log('Criando canal', ch.name, 'com overwrites:', overwrites);
        await guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: parent ? parent.id : undefined,
          position: ch.position,
          permissionOverwrites: overwrites
        });
      } catch {}
    }
    message.channel.send('✅ Organização concluída!');
  }
}; 