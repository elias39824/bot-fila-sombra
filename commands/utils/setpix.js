module.exports = {
  name: "setpix",
  aliases: ["pix", "configurarpix"],
  run: async (client, message, args) => {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply(`:x: | Você não tem permissão para utilizar esse comando.`);
    }

    const subCommand = args[0]?.toLowerCase();

    // .setpix add @usuario chave
    if (subCommand === "add") {
      const target = message.mentions.users.first();
      if (!target) return message.reply(`:x: | Mencione o mediador. Ex: \`.setpix add @mediador chave_pix\``);

      const chave = args.slice(2).join(" ");
      if (!chave) return message.reply(`:x: | Informe a chave PIX. Ex: \`.setpix add @mediador 12345678901\``);

      client.database.set(`pix_${target.id}`, chave);
      return message.reply(`✅ | Chave PIX de <@${target.id}> definida como: \`${chave}\``);
    }

    // .setpix remove @usuario
    if (subCommand === "remove" || subCommand === "del") {
      const target = message.mentions.users.first();
      if (!target) return message.reply(`:x: | Mencione o mediador. Ex: \`.setpix remove @mediador\``);

      client.database.delete(`pix_${target.id}`);
      return message.reply(`✅ | Chave PIX de <@${target.id}> removida.`);
    }

    // .setpix ver @usuario
    if (subCommand === "ver" || subCommand === "check") {
      const target = message.mentions.users.first();
      if (!target) return message.reply(`:x: | Mencione o mediador. Ex: \`.setpix ver @mediador\``);

      const chave = client.database.get(`pix_${target.id}`);
      if (!chave) return message.reply(`❌ | <@${target.id}> não tem chave PIX configurada.`);
      return message.reply(`🔑 | Chave PIX de <@${target.id}>: \`${chave}\``);
    }

    // Sem subcomando: mostra ajuda
    return message.reply(
      `**Comandos de PIX:**\n` +
      `\`.setpix add @mediador chave\` — Define a chave PIX\n` +
      `\`.setpix remove @mediador\` — Remove a chave PIX\n` +
      `\`.setpix ver @mediador\` — Vê a chave PIX`
    );
  }
};
