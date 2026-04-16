const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, PermissionFlagsBits } = require("discord.js")

module.exports = {
  name: "personalizar",
  aliases: ["configurar", "custom", "settings"],
  run: async(client, message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply(`:x: | Você não tem permissão para utilizar esse comando.`)
    }

    const subCommand = args[0]?.toLowerCase();
    const valor = args.slice(1).join(" ");

    if (!subCommand) {
      // Mostra o painel de personalização
      const config = client.database.get(`config_${message.guild.id}`) || {};
      
      const embed = new EmbedBuilder()
        .setTitle("🎨 | Personalização do Bot")
        .setDescription(`Configure as cores, banner e thumbnail das embeds do bot.\n\n**Configurações atuais:**`)
        .addFields([
          { name: "🎨 Cor da Embed", value: config.cor ? `\`${config.cor}\`` : "❌ Não definido", inline: true },
          { name: "🖼️ Banner (Footer)", value: config.banner ? `[Clique aqui](${config.banner})` : "❌ Não definido", inline: true },
          { name: "🖼️ Thumbnail", value: config.thumbnail ? `[Clique aqui](${config.thumbnail})` : "❌ Não definido", inline: true },
          { name: "🏷️ Título", value: config.titulo || "❌ Não definido", inline: true },
          { name: "👤 Autor", value: config.autor || "❌ Não definido", inline: true },
          { name: "🖼️ Ícone do Autor", value: config.autorIcone ? `[Clique aqui](${config.autorIcone})` : "❌ Não definido", inline: true }
        ])
        .setColor(config.cor ? parseInt(config.cor.replace("#", ""), 16) : 0x2b2d31)
        .setFooter({ text: "Use .personalizar <opção> <valor>", iconURL: message.guild.iconURL() });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🎨 Cor")
          .setCustomId("personalizar_cor")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🎨"),
        new ButtonBuilder()
          .setLabel("🖼️ Banner")
          .setCustomId("personalizar_banner")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🖼️"),
        new ButtonBuilder()
          .setLabel("🖼️ Thumbnail")
          .setCustomId("personalizar_thumbnail")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🖼️"),
        new ButtonBuilder()
          .setLabel("🏷️ Título")
          .setCustomId("personalizar_titulo")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🏷️"),
        new ButtonBuilder()
          .setLabel("🔄 Resetar")
          .setCustomId("personalizar_reset")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔄")
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("👤 Autor")
          .setCustomId("personalizar_autor")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("👤"),
        new ButtonBuilder()
          .setLabel("🖼️ Ícone Autor")
          .setCustomId("personalizar_autor_icone")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🖼️")
      );

      await message.reply({ embeds: [embed], components: [row, row2] });
      message.delete().catch(() => {});
      return;
    }

    // Função para validar URL de imagem
    const isValidImageUrl = (url) => {
      // Verifica se é uma URL válida
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }

    const config = client.database.get(`config_${message.guild.id}`) || {};

    switch(subCommand) {
      case "cor":
        if (!valor) return message.reply(`:x: | Informe uma cor em hexadecimal. Ex: \`.personalizar cor #5865F2\``);
        let corHex = valor.replace("#", "");
        if (!/^[0-9A-Fa-f]{6}$/.test(corHex)) {
          return message.reply(`:x: | Cor inválida! Use formato hexadecimal. Ex: \`#5865F2\``);
        }
        config.cor = `#${corHex.toUpperCase()}`;
        client.database.set(`config_${message.guild.id}`, config);
        message.reply(`✅ | Cor alterada para \`${config.cor}\``);
        break;

      case "banner":
        if (!valor) return message.reply(`:x: | Informe uma URL de imagem para o banner. Ex: \`.personalizar banner https://exemplo.com/imagem.png\``);
        if (!isValidImageUrl(valor)) {
          return message.reply(`:x: | URL inválida! Certifique-se de que é uma URL válida. Ex: \`https://exemplo.com/imagem.png\``);
        }
        config.banner = valor;
        client.database.set(`config_${message.guild.id}`, config);
        message.reply(`✅ | Banner alterado!`);
        break;

      case "thumbnail":
        if (!valor) return message.reply(`:x: | Informe uma URL de imagem para a thumbnail. Ex: \`.personalizar thumbnail https://exemplo.com/imagem.png\``);
        if (!isValidImageUrl(valor)) {
          return message.reply(`:x: | URL inválida! Certifique-se de que é uma URL válida. Ex: \`https://exemplo.com/imagem.png\``);
        }
        config.thumbnail = valor;
        client.database.set(`config_${message.guild.id}`, config);
        message.reply(`✅ | Thumbnail alterada!`);
        break;

      case "titulo":
        if (!valor) return message.reply(`:x: | Informe um título. Ex: \`.personalizar titulo CAVALO APOSTAS\``);
        config.titulo = valor;
        client.database.set(`config_${message.guild.id}`, config);
        message.reply(`✅ | Título alterado para \`${config.titulo}\``);
        break;

      case "autor":
        if (!valor) return message.reply(`:x: | Informe um nome para o autor. Ex: \`.personalizar autor CAVALO E-SPORTS\``);
        config.autor = valor;
        client.database.set(`config_${message.guild.id}`, config);
        message.reply(`✅ | Autor alterado para \`${config.autor}\``);
        break;

      case "autoricone":
      case "autor_icone":
      case "iconeautor":
        if (!valor) return message.reply(`:x: | Informe uma URL de imagem para o ícone do autor. Ex: \`.personalizar autoricone https://exemplo.com/icone.png\``);
        if (!isValidImageUrl(valor)) {
          return message.reply(`:x: | URL inválida! Certifique-se de que é uma URL válida.`);
        }
        config.autorIcone = valor;
        client.database.set(`config_${message.guild.id}`, config);
        message.reply(`✅ | Ícone do autor alterado!`);
        break;

      case "reset":
        client.database.delete(`config_${message.guild.id}`);
        message.reply(`🔄 | Todas as configurações foram resetadas para o padrão!`);
        break;

      default:
        message.reply(`:x: | Opção inválida! Use: \`cor\`, \`banner\`, \`thumbnail\`, \`titulo\`, \`autor\`, \`autoricone\`, \`reset\``);
    }

    message.delete().catch(() => {});
  }
}