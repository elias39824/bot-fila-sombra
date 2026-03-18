const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

// streamingButtonHandler não está disponível nesta versão
const streamingHandler = { voltarStreamerParaFila: async () => {} };

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      if (!interaction.isStringSelectMenu() || interaction.customId !== 'match_action') return;
      if (!interaction.replied && !interaction.deferred) {
        try { await interaction.deferReply({ flags: 64 }); } catch (e) {}
      }
      // Busca o id do mediador na database
      const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
      let filasDados = {};
      if (fs.existsSync(filasDadosPath)) filasDados = JSON.parse(fs.readFileSync(filasDadosPath));
      const partida = filasDados[interaction.channel.id];
      if (!partida || !partida.id_mediador) {
        try {
          return await interaction.editReply({ content: 'Não foi possível identificar o mediador desta partida.' });
        } catch (e) { return; }
      }
      if (interaction.user.id !== partida.id_mediador) {
        try {
          return await interaction.editReply({ content: 'Apenas o mediador desta partida pode usar este menu.' });
        } catch (e) { return; }
      }
      const selected = interaction.values[0];
      if (selected === 'finalizar') {
        // Busca canal de logs
        const logsPath = path.join(__dirname, '../DataBaseJson/logs.json');
        let logsId = null;
        if (fs.existsSync(logsPath)) {
          const arr = JSON.parse(fs.readFileSync(logsPath));
          logsId = arr[0];
        }
        // Buscar jogadores da primeira mensagem do canal
        let jogadoresStr = 'Desconhecido';
        const jogadores = partida.jogadores || [];
        try {
          const msgs = await interaction.channel.messages.fetch({ limit: 5 });
          const primeira = msgs.last();
          if (primeira && primeira.mentions && primeira.mentions.users.size >= 2) {
            const users = Array.from(primeira.mentions.users.values());
            jogadoresStr = users.slice(0,2).map(u => `<@${u.id}>`).join(' x ');
          }
        } catch (e) {}
        // Cria embed de log
        const embed = new EmbedBuilder()
          .setTitle('Partida Finalizada')
          .setDescription(`O canal <#${interaction.channel.id}> foi finalizado por <@${interaction.user.id}>.`)
          .setColor(0xED4245)
          .setThumbnail(interaction.user.displayAvatarURL())
          .addFields(
            { name: 'Usuário', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Canal', value: `<#${interaction.channel.id}>`, inline: true },
            { name: 'Jogadores', value: jogadoresStr, inline: false },
            { name: 'Data', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: false }
          );
        if (logsId) {
          const logChannel = await interaction.guild.channels.fetch(logsId).catch(() => null);
          if (logChannel) await logChannel.send({ embeds: [embed] });
        }

        // ====================================
        // STREAMING: VOLTA STREAMER PARA FILA
        // ====================================
        for (const jogadorId of jogadores) {
          await streamingHandler.voltarStreamerParaFila(interaction.guild, jogadorId);
        }
        console.log('[MATCH] ✅ Streamers retornaram para a fila');
        // ====================================

        // Remove do banco
        delete filasDados[interaction.channel.id];
        fs.writeFileSync(filasDadosPath, JSON.stringify(filasDados, null, 2));

        await interaction.editReply({ content: 'Partida finalizada e log enviada!' });
        setTimeout(() => {
          interaction.channel.delete('Partida finalizada pelo select menu');
        }, 2000);
      }
    } catch (err) {
      console.error('Erro no matchActionHandler:', err);
      try { await interaction.editReply({ content: 'Ocorreu um erro inesperado ao processar a ação.' }); } catch (e) {}
    }
  }
};