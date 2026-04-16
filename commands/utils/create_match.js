const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require("discord.js")

module.exports = {
  name: "creatematch",
  aliases: ["create_match", "cm"],
  run: async(client, message, args) => {
    if (!message.member.permissions.has("Administrator")) return message.reply(`:x: | Você não tem permissão para utilizar esse comando.`)
    
    const matchType = args[0];
    const matchValue = args[1];
    const modoJogo = args[2]?.toLowerCase();
    
    const modosValidos = ["mobile", "emulador", "misto", "soco", "fullsoco", "ump", "fullump", "xm8", "fullxm8"];
    
    if (!matchType) return message.reply(`:x: | Informe o tipo de partida. Ex: \`.cm 1x1 100 mobile\``)
    if (!matchValue) return message.reply(`:x: | Informe o valor da partida. Ex: \`.cm 1x1 100 mobile\``)
    if (!modoJogo || !modosValidos.includes(modoJogo)) return message.reply(`:x: | Informe o modo de jogo:\n\`mobile\`, \`emulador\`, \`misto\`, \`soco\`, \`ump\`, \`xm8\``)
    
    let modoExibicao = "";
    switch(modoJogo) {
      case "mobile": modoExibicao = "Mobile"; break;
      case "emulador": modoExibicao = "Emulador"; break;
      case "misto": modoExibicao = "Misto"; break;
      case "soco": 
      case "fullsoco": modoExibicao = "Full Soco"; break;
      case "ump": 
      case "fullump": modoExibicao = "Full UMP"; break;
      case "xm8": 
      case "fullxm8": modoExibicao = "Full XM8"; break;
      default: modoExibicao = modoJogo;
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`${matchType} | CAVALO APOSTAS`)
      .setDescription(`<a:trofeu:1492925286965186793> **Modo:**\n${matchType} ${modoExibicao}\n\n<a:swagcoin:1492925288382861374> **Valor:**\nR$ ${matchValue},00\n\n<a:emoji_172:1492923566310559954> **Jogadores:**\nNenhum jogador na fila`)
      .setColor(0x5865F2)
      
    const gelNormalButton = new ButtonBuilder()
      .setLabel("Gelo Normal")
      .setCustomId("gelnormal")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("<:gelo:1492630115652468916>")
      
    const gelInfinitoButton = new ButtonBuilder()
      .setLabel("Gelo Infinito")
      .setCustomId("gelinfinito")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("<:gelo:1492630115652468916>")
      
    const sairButton = new ButtonBuilder()
      .setLabel("Sair da fila")
      .setCustomId("sair")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("<a:emote2222:1492923538082894097>")
      
    const row = new ActionRowBuilder().addComponents(gelNormalButton, gelInfinitoButton, sairButton)
    
    const msg = await message.channel.send({
      embeds: [embed], components: [row]
    })
    
    client.database.set(`match_${msg.id}`, {
      type: matchType,
      valor: matchValue,
      modo: `${matchType} ${modoExibicao}`,
      gelnormal: [],
      gelinfinito: []
    })
    
    message.delete()
  }
}