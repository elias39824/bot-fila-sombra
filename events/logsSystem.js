const { 
  EmbedBuilder, 
  AuditLogEvent,
  Events
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const logsConfigPath = path.join(__dirname, '../DataBaseJson/logsConfig.json');

// --- FUNÇÕES AUXILIARES ---

function getLogsConfig() {
  try {
    if (!fs.existsSync(logsConfigPath)) {
      return null;
    }
    const data = fs.readFileSync(logsConfigPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[LOGS] Erro ao ler config:', error);
    return null;
  }
}

async function sendLog(guild, logType, embed) {
  try {
    const config = getLogsConfig();
    if (!config || !config[logType]) return;

    const channel = await guild.channels.fetch(config[logType]).catch(() => null);
    if (!channel) return;

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error(`[LOGS] Erro ao enviar log ${logType}:`, error);
  }
}

// --- REGISTRO DE EVENTOS ---

module.exports = {
  name: 'ready',
  once: false,
  async execute(client) {

    // ==========================================
    // 📥 LOG DE ENTRADA
    // ==========================================

    client.on(Events.GuildMemberAdd, async (member) => {
      const embed = new EmbedBuilder()
        .setTitle('**Entrada no Servidor**')
        .setDescription(
          `**Usuario:** ${member.user.tag}\n` +
          `**Mencao:** ${member}\n` +
          `**ID:** \`${member.id}\`\n` +
          `**Conta criada em:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:F>\n` +
          `**Membro numero:** \`${member.guild.memberCount}\``
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor(0x57F287)
        .setTimestamp()
        .setFooter({ text: `Usuario entrou` });

      await sendLog(member.guild, 'entrada', embed);
    });

    // ==========================================
    // 📤 LOG DE SAÍDA
    // ==========================================

    client.on(Events.GuildMemberRemove, async (member) => {
      const embed = new EmbedBuilder()
        .setTitle('**Saida do Servidor**')
        .setDescription(
          `**Usuario:** ${member.user.tag}\n` +
          `**Mencao:** ${member}\n` +
          `**ID:** \`${member.id}\`\n` +
          `**Entrou em:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F>\n` +
          `**Tempo no servidor:** \`${Math.floor((Date.now() - member.joinedTimestamp) / 86400000)} dias\``
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor(0xED4245)
        .setTimestamp()
        .setFooter({ text: `Usuario saiu` });

      await sendLog(member.guild, 'saida', embed);
    });

    // ==========================================
    // 🧩 LOG DE MUDANÇA DE CARGO
    // ==========================================

    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
      const oldRoles = oldMember.roles.cache;
      const newRoles = newMember.roles.cache;

      const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
      const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));

      if (addedRoles.size === 0 && removedRoles.size === 0) return;

      // Buscar quem alterou nos logs de auditoria
      let executor = null;
      try {
        const auditLogs = await newMember.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberRoleUpdate,
          limit: 1
        });
        const log = auditLogs.entries.first();
        if (log && log.target.id === newMember.id && Date.now() - log.createdTimestamp < 3000) {
          executor = log.executor;
        }
      } catch (e) {}

      let description = `**Usuario:** ${newMember.user.tag}\n` +
                       `**Mencao:** ${newMember}\n` +
                       `**ID:** \`${newMember.id}\`\n\n`;

      if (removedRoles.size > 0) {
        description += `**Cargos Removidos:**\n${removedRoles.map(r => `__-__ ${r}`).join('\n')}\n\n`;
      }

      if (addedRoles.size > 0) {
        description += `**Cargos Adicionados:**\n${addedRoles.map(r => `__+__ ${r}`).join('\n')}\n\n`;
      }

      if (executor) {
        description += `**Alterado por:** ${executor.tag} (${executor})`;
      }

      const embed = new EmbedBuilder()
        .setTitle('**Cargo Atualizado**')
        .setDescription(description)
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor(0xFEE75C)
        .setTimestamp()
        .setFooter({ text: `Mudanca de cargo` });

      await sendLog(newMember.guild, 'mudanca_cargo', embed);
    });

    // ==========================================
    // ✏️ LOG DE NICKNAME
    // ==========================================

    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
      if (oldMember.nickname === newMember.nickname) return;

      const embed = new EmbedBuilder()
        .setTitle('**Nickname Alterado**')
        .setDescription(
          `**Usuario:** ${newMember.user.tag}\n` +
          `**Mencao:** ${newMember}\n` +
          `**ID:** \`${newMember.id}\`\n\n` +
          `**Nickname Antigo:**\n\`\`\`${oldMember.nickname || 'Nenhum'}\`\`\`\n` +
          `**Nickname Novo:**\n\`\`\`${newMember.nickname || 'Nenhum'}\`\`\``
        )
        .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({ text: `Nickname alterado` });

      await sendLog(newMember.guild, 'nickname', embed);
    });

    // ==========================================
    // 🔨 LOG DE MODERAÇÃO
    // ==========================================

    // Ban
    client.on(Events.GuildBanAdd, async (ban) => {
      let executor = null;
      let reason = 'Nao especificado';

      try {
        const auditLogs = await ban.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberBanAdd,
          limit: 1
        });
        const log = auditLogs.entries.first();
        if (log && log.target.id === ban.user.id) {
          executor = log.executor;
          reason = log.reason || 'Nao especificado';
        }
      } catch (e) {}

      const embed = new EmbedBuilder()
        .setTitle('**Usuario Banido**')
        .setDescription(
          `**Usuario:** ${ban.user.tag}\n` +
          `**ID:** \`${ban.user.id}\`\n` +
          `**Motivo:** \`${reason}\`\n` +
          (executor ? `**Banido por:** ${executor.tag} (${executor})` : '')
        )
        .setThumbnail(ban.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor(0xED4245)
        .setTimestamp()
        .setFooter({ text: `Banimento` });

      await sendLog(ban.guild, 'moderacao', embed);
    });

    // Unban
    client.on(Events.GuildBanRemove, async (ban) => {
      let executor = null;

      try {
        const auditLogs = await ban.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberBanRemove,
          limit: 1
        });
        const log = auditLogs.entries.first();
        if (log && log.target.id === ban.user.id) {
          executor = log.executor;
        }
      } catch (e) {}

      const embed = new EmbedBuilder()
        .setTitle('**Usuario Desbanido**')
        .setDescription(
          `**Usuario:** ${ban.user.tag}\n` +
          `**ID:** \`${ban.user.id}\`\n` +
          (executor ? `**Desbanido por:** ${executor.tag} (${executor})` : '')
        )
        .setThumbnail(ban.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor(0x57F287)
        .setTimestamp()
        .setFooter({ text: `Desbanimento` });

      await sendLog(ban.guild, 'moderacao', embed);
    });

    // Timeout (Mute)
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
      const oldTimeout = oldMember.communicationDisabledUntilTimestamp;
      const newTimeout = newMember.communicationDisabledUntilTimestamp;

      if (oldTimeout === newTimeout) return;

      let executor = null;
      try {
        const auditLogs = await newMember.guild.fetchAuditLogs({
          type: AuditLogEvent.MemberUpdate,
          limit: 1
        });
        const log = auditLogs.entries.first();
        if (log && log.target.id === newMember.id) {
          executor = log.executor;
        }
      } catch (e) {}

      if (newTimeout > Date.now()) {
        // Mutado
        const duration = Math.floor((newTimeout - Date.now()) / 1000);
        const embed = new EmbedBuilder()
          .setTitle('**Usuario Mutado**')
          .setDescription(
            `**Usuario:** ${newMember.user.tag}\n` +
            `**Mencao:** ${newMember}\n` +
            `**ID:** \`${newMember.id}\`\n` +
            `**Duracao:** <t:${Math.floor(newTimeout / 1000)}:R>\n` +
            (executor ? `**Mutado por:** ${executor.tag} (${executor})` : '')
          )
          .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setColor(0xFEE75C)
          .setTimestamp()
          .setFooter({ text: `Timeout aplicado` });

        await sendLog(newMember.guild, 'moderacao', embed);
      } else if (oldTimeout > Date.now() && newTimeout === null) {
        // Desmutado
        const embed = new EmbedBuilder()
          .setTitle('**Usuario Desmutado**')
          .setDescription(
            `**Usuario:** ${newMember.user.tag}\n` +
            `**Mencao:** ${newMember}\n` +
            `**ID:** \`${newMember.id}\`\n` +
            (executor ? `**Desmutado por:** ${executor.tag} (${executor})` : '')
          )
          .setThumbnail(newMember.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .setColor(0x57F287)
          .setTimestamp()
          .setFooter({ text: `Timeout removido` });

        await sendLog(newMember.guild, 'moderacao', embed);
      }
    });

    // ==========================================
    // 🗑️ LOG DE MENSAGEM DELETADA
    // ==========================================

    client.on(Events.MessageDelete, async (message) => {
      if (message.author?.bot) return;
      if (!message.guild) return;

      const content = message.content || '*Sem conteudo de texto*';
      const attachments = message.attachments.size > 0 
        ? `\n**Anexos:** ${message.attachments.size} arquivo(s)` 
        : '';

      const embed = new EmbedBuilder()
        .setTitle('**Mensagem Apagada**')
        .setDescription(
          `**Autor:** ${message.author?.tag || 'Desconhecido'}\n` +
          `**Mencao:** ${message.author || 'N/A'}\n` +
          `**Canal:** ${message.channel}\n` +
          `**ID da Mensagem:** \`${message.id}\`${attachments}\n\n` +
          `**Conteudo:**\n\`\`\`${content.substring(0, 1800)}\`\`\``
        )
        .setColor(0xED4245)
        .setTimestamp()
        .setFooter({ text: `Mensagem deletada` });

      if (message.author) {
        embed.setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }));
      }

      await sendLog(message.guild, 'mensagem', embed);
    });

    // ==========================================
    // ✍️ LOG DE EDIÇÃO DE MENSAGEM
    // ==========================================

    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      if (newMessage.author?.bot) return;
      if (!newMessage.guild) return;
      if (oldMessage.content === newMessage.content) return;

      const oldContent = oldMessage.content || '*Sem conteudo*';
      const newContent = newMessage.content || '*Sem conteudo*';

      const embed = new EmbedBuilder()
        .setTitle('**Mensagem Editada**')
        .setDescription(
          `**Autor:** ${newMessage.author.tag}\n` +
          `**Mencao:** ${newMessage.author}\n` +
          `**Canal:** ${newMessage.channel}\n` +
          `**ID da Mensagem:** \`${newMessage.id}\`\n` +
          `**Link:** [Ir para mensagem](${newMessage.url})\n\n` +
          `**Antes:**\n\`\`\`${oldContent.substring(0, 900)}\`\`\`\n` +
          `**Depois:**\n\`\`\`${newContent.substring(0, 900)}\`\`\``
        )
        .setThumbnail(newMessage.author.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor(0x5865F2)
        .setTimestamp()
        .setFooter({ text: `Mensagem editada` });

      await sendLog(newMessage.guild, 'edicao_mensagem', embed);
    });

    // ==========================================
    // 🔊 LOG DE VOZ
    // ==========================================

    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
      const member = newState.member;
      let description = `**Usuario:** ${member.user.tag}\n` +
                       `**Mencao:** ${member}\n` +
                       `**ID:** \`${member.id}\`\n\n`;
      let title = '';
      let color = 0x5865F2;

      // Entrou em call
      if (!oldState.channel && newState.channel) {
        title = '**Entrou em Call**';
        description += `**Canal:** ${newState.channel}`;
        color = 0x57F287;
      }
      // Saiu da call
      else if (oldState.channel && !newState.channel) {
        title = '**Saiu da Call**';
        description += `**Canal:** ${oldState.channel}`;
        color = 0xED4245;
      }
      // Mudou de canal
      else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        title = '**Mudou de Canal de Voz**';
        description += `**De:** ${oldState.channel}\n**Para:** ${newState.channel}`;
        color = 0xFEE75C;
      }
      // Mutado/Desmutado
      else if (oldState.serverMute !== newState.serverMute) {
        if (newState.serverMute) {
          title = '**Mutado em Call (Server Mute)**';
          description += `**Canal:** ${newState.channel}`;
          color = 0xED4245;
        } else {
          title = '**Desmutado em Call**';
          description += `**Canal:** ${newState.channel}`;
          color = 0x57F287;
        }
      }
      // Surdo/Desurdo
      else if (oldState.serverDeaf !== newState.serverDeaf) {
        if (newState.serverDeaf) {
          title = '**Ensurdecido em Call (Server Deafen)**';
          description += `**Canal:** ${newState.channel}`;
          color = 0xED4245;
        } else {
          title = '**Desensurdecido em Call**';
          description += `**Canal:** ${newState.channel}`;
          color = 0x57F287;
        }
      }
      // Self mute/unmute
      else if (oldState.selfMute !== newState.selfMute) {
        if (newState.selfMute) {
          title = '**Mutou o Microfone (Self Mute)**';
          description += `**Canal:** ${newState.channel}`;
        } else {
          title = '**Desmutou o Microfone**';
          description += `**Canal:** ${newState.channel}`;
        }
      }
      // Self deaf/undeaf
      else if (oldState.selfDeaf !== newState.selfDeaf) {
        if (newState.selfDeaf) {
          title = '**Ensurdeceu (Self Deafen)**';
          description += `**Canal:** ${newState.channel}`;
        } else {
          title = '**Desensurdeceu**';
          description += `**Canal:** ${newState.channel}`;
        }
      }
      else {
        return; // Nenhuma mudança relevante
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: `Evento de voz` });

      await sendLog(member.guild, 'voz', embed);
    });

    // ==========================================
    // ⚙️ LOG DO SERVIDOR
    // ==========================================

    // Nome do servidor alterado
    client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
      if (oldGuild.name !== newGuild.name) {
        const embed = new EmbedBuilder()
          .setTitle('**Nome do Servidor Alterado**')
          .setDescription(
            `**Nome Antigo:**\n\`\`\`${oldGuild.name}\`\`\`\n` +
            `**Nome Novo:**\n\`\`\`${newGuild.name}\`\`\``
          )
          .setColor(0x5865F2)
          .setTimestamp()
          .setFooter({ text: `Servidor atualizado` });

        await sendLog(newGuild, 'servidor', embed);
      }

      // Ícone alterado
      if (oldGuild.icon !== newGuild.icon) {
        const embed = new EmbedBuilder()
          .setTitle('**Icone do Servidor Alterado**')
          .setDescription(`**Novo icone:**`)
          .setThumbnail(newGuild.iconURL({ dynamic: true, size: 512 }))
          .setColor(0x5865F2)
          .setTimestamp()
          .setFooter({ text: `Icone atualizado` });

        await sendLog(newGuild, 'servidor', embed);
      }
    });

    // Canal criado
    client.on(Events.ChannelCreate, async (channel) => {
      if (!channel.guild) return;

      let executor = null;
      try {
        const auditLogs = await channel.guild.fetchAuditLogs({
          type: AuditLogEvent.ChannelCreate,
          limit: 1
        });
        const log = auditLogs.entries.first();
        if (log && log.target.id === channel.id) {
          executor = log.executor;
        }
      } catch (e) {}

      const typeNames = {
        0: 'Texto',
        2: 'Voz',
        4: 'Categoria',
        5: 'Anuncio',
        13: 'Palco',
        15: 'Forum'
      };

      const embed = new EmbedBuilder()
        .setTitle('**Canal Criado**')
        .setDescription(
          `**Nome:** ${channel.name}\n` +
          `**Mencao:** ${channel}\n` +
          `**Tipo:** ${typeNames[channel.type] || 'Desconhecido'}\n` +
          `**ID:** \`${channel.id}\`\n` +
          (executor ? `**Criado por:** ${executor.tag} (${executor})` : '')
        )
        .setColor(0x57F287)
        .setTimestamp()
        .setFooter({ text: `Canal criado` });

      await sendLog(channel.guild, 'servidor', embed);
    });

    // Canal deletado
    client.on(Events.ChannelDelete, async (channel) => {
      if (!channel.guild) return;

      let executor = null;
      try {
        const auditLogs = await channel.guild.fetchAuditLogs({
          type: AuditLogEvent.ChannelDelete,
          limit: 1
        });
        const log = auditLogs.entries.first();
        if (log && log.target.id === channel.id) {
          executor = log.executor;
        }
      } catch (e) {}

      const typeNames = {
        0: 'Texto',
        2: 'Voz',
        4: 'Categoria',
        5: 'Anuncio',
        13: 'Palco',
        15: 'Forum'
      };

      const embed = new EmbedBuilder()
        .setTitle('**Canal Deletado**')
        .setDescription(
          `**Nome:** ${channel.name}\n` +
          `**Tipo:** ${typeNames[channel.type] || 'Desconhecido'}\n` +
          `**ID:** \`${channel.id}\`\n` +
          (executor ? `**Deletado por:** ${executor.tag} (${executor})` : '')
        )
        .setColor(0xED4245)
        .setTimestamp()
        .setFooter({ text: `Canal deletado` });

      await sendLog(channel.guild, 'servidor', embed);
    });

    // Cargo criado
    client.on(Events.GuildRoleCreate, async (role) => {
      let executor = null;
      try {
        const auditLogs = await role.guild.fetchAuditLogs({
          type: AuditLogEvent.RoleCreate,
          limit: 1
        });
        const log = auditLogs.entries.first();
        if (log && log.target.id === role.id) {
          executor = log.executor;
        }
      } catch (e) {}

      const embed = new EmbedBuilder()
        .setTitle('**Cargo Criado**')
        .setDescription(
          `**Nome:** ${role.name}\n` +
          `**Mencao:** ${role}\n` +
          `**Cor:** \`${role.hexColor}\`\n` +
          `**ID:** \`${role.id}\`\n` +
          (executor ? `**Criado por:** ${executor.tag} (${executor})` : '')
        )
        .setColor(role.color || 0x57F287)
        .setTimestamp()
        .setFooter({ text: `Cargo criado` });

      await sendLog(role.guild, 'servidor', embed);
    });

    // Cargo deletado
    client.on(Events.GuildRoleDelete, async (role) => {
      let executor = null;
      try {
        const auditLogs = await role.guild.fetchAuditLogs({
          type: AuditLogEvent.RoleDelete,
          limit: 1
        });
        const log = auditLogs.entries.first();
        if (log && log.target.id === role.id) {
          executor = log.executor;
        }
      } catch (e) {}

      const embed = new EmbedBuilder()
        .setTitle('**Cargo Deletado**')
        .setDescription(
          `**Nome:** ${role.name}\n` +
          `**Cor:** \`${role.hexColor}\`\n` +
          `**ID:** \`${role.id}\`\n` +
          (executor ? `**Deletado por:** ${executor.tag} (${executor})` : '')
        )
        .setColor(0xED4245)
        .setTimestamp()
        .setFooter({ text: `Cargo deletado` });

      await sendLog(role.guild, 'servidor', embed);
    });

    console.log('[LOGS] Sistema de logs carregado com sucesso');
  }
};