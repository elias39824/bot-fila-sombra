const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
  name: "mediadores",
  aliases: ["medfila", "fila_med"],
  run: async (client, message, args) => {
    // Verifica se é administrador
    if (!message.member.permissions.has("Administrator")) {
      return message.reply({ content: '❌ Apenas administradores podem usar este comando!', ephemeral: true });
    }

    // Pega a fila de mediadores do banco de dados
    let fila = client.database.get(`fila_mediadores_${message.guild.id}`) || [];

    let desc = fila.length > 0 
      ? fila.map(u => `<@${u}> \`${u}\``).join('\n') 
      : 'Nenhum mediador na fila.';

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ Fila de Mediadores`)
      .setDescription('Entre ou saia da fila de mediadores usando os botões abaixo.')
      .addFields({ name: 'Mediadores na Fila:', value: desc })
      .setColor(0x2ecc71)
      .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL() });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('entrar_fila_med')
        .setLabel('Entrar na fila')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('sair_fila_med')
        .setLabel('Sair da fila')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    const msg = await message.channel.send({ embeds: [embed], components: [row] });
    message.delete().catch(() => {});
  }
};