const {
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require("discord.js");

module.exports = {
  name: "config",
  aliases: ["configurar", "painel"],
  run: async (client, message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply(`:x: | Você não tem permissão para utilizar esse comando.`);
    }

    const embed = new EmbedBuilder()
      .setTitle("⚙️ | Painel de Configurações")
      .setDescription(
        "Bem-vindo ao painel de configurações do bot!\n\nEscolha uma das opções abaixo para configurar:"
      )
      .addFields([
        {
          name: "🎮 Configurar Filas",
          value: "Crie e gerencie as filas de partidas no servidor.",
          inline: false,
        },
        {
          name: "🛡️ Configurar Mediadores",
          value: "Envie o painel de fila de mediadores para o canal.",
          inline: false,
        },
        {
          name: "🎨 Personalizar Bot",
          value: "Customize cores, banner, thumbnail, título e autor das embeds.",
          inline: false,
        },
      ])
      .setColor(0x5865f2)
      .setFooter({
        text: message.guild.name,
        iconURL: message.guild.iconURL(),
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("config_filas")
        .setLabel("Configurar Filas")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎮"),
      new ButtonBuilder()
        .setCustomId("config_mediadores")
        .setLabel("Configurar Mediadores")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🛡️"),
      new ButtonBuilder()
        .setCustomId("config_personalizar")
        .setLabel("Personalizar Bot")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji("🎨")
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    message.delete().catch(() => {});
  },
};
