const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');
const { logManager } = require('../events/matchRoomCreator');

// --- Caminhos ---
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const mediadoresPath = path.join(__dirname, '../DataBaseJson/mediadores.json');
const colorPath = path.join(__dirname, '../DataBaseJson/bot_color.json');

// --- Funções Auxiliares ---

function isMediator(member) {
  let mediatorRoleIds = [];
  try {
    const data = fs.readFileSync(mediadoresPath, 'utf-8');
    mediatorRoleIds = JSON.parse(data);
  } catch (e) {
    // Falha silenciosa na leitura do JSON
  }

  if (mediatorRoleIds.some(roleId => member.roles.cache.has(roleId))) {
    return true;
  }
  return member.permissions.has(PermissionsBitField.Flags.ManageChannels);
}

function getCorEscolhida() {
  try {
    if (!fs.existsSync(colorPath)) {
      return '#ED4245';
    }
    const data = fs.readFileSync(colorPath, 'utf-8');
    const colorData = JSON.parse(data);
    return colorData.cor || '#ED4245';
  } catch (e) {
    return '#ED4245';
  }
}

module.exports = {
  name: 'f',
  description: 'Finaliza e fecha a sala de aposta atual',
  async execute(message, args) {
    try {
      console.log(`[!F] 🛑 Comando executado por: ${message.author.username}`);

      // Verifica se é mediador
      if (!isMediator(message.member)) {
        return message.reply({ 
          content: `${emojis.failuser_emoji || '❌'} Apenas membros com cargo de Mediador podem usar este comando.`
        });
      }

      // Verifica se existe uma partida ativa no canal
      let filasDados = {};
      if (fs.existsSync(filasDadosPath)) {
        try {
          filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
        } catch(err) {
          console.error("[!F] Erro ao ler filasDados.json:", err);
          return message.reply({ 
            content: `${emojis.failuser_emoji || '❌'} Erro ao acessar dados da partida.`
          });
        }
      }

      const partida = filasDados[message.channel.id];

      // Se não há partida ativa, apenas fecha o canal
      if (!partida) {
        console.warn(`[!F] ⚠️ Nenhuma partida ativa encontrada no canal ${message.channel.id}`);
        
        const embedAviso = new EmbedBuilder()
          .setTitle('Fechando Canal')
          .setDescription(
            `Este canal será fechado em **5 segundos**.\n\n` +
            `*Nenhuma partida ativa foi encontrada neste canal.*`
          )
          .setColor('#FFA500')
          .setFooter({ text: `Solicitado por ${message.author.tag}` })
          .setTimestamp();

        await message.reply({ embeds: [embedAviso] });

        // Deletar mensagem do comando
        setTimeout(() => {
          message.delete().catch(() => {});
        }, 2000);

        // Deletar canal
        setTimeout(() => {
          message.channel.delete('Canal fechado manualmente via !f').catch(err => {
            console.error('[!F] Erro ao deletar canal:', err);
          });
        }, 5000);

        return;
      }

      // Verifica se quem executou é o mediador da partida
      if (partida.id_mediador && message.author.id !== partida.id_mediador) {
        // Permite se for um mediador geral (tem permissão), mas avisa
        console.log(`[!F] ⚠️ ${message.author.username} não é o mediador da partida, mas tem permissão`);
      }

      const corEscolhida = getCorEscolhida();

      console.log(`[!F] 🗑️ Finalizando partida no canal ${message.channel.id}`);

      // Criar embed de finalização
      const embedFinal = new EmbedBuilder()
        .setTitle('Aposta Finalizada')
        .setDescription(
          `Esta sala de aposta foi encerrada pelo mediador.\n\n` +
          `**Mediador:** <@${message.author.id}>\n` +
          `**Motivo:** Finalização manual\n\n` +
          `O canal será deletado em **5 segundos**.`
        )
        .setColor(corEscolhida)
        .addFields(
          { 
            name: 'Informações da Partida', 
            value: 
              `**Modo:** ${partida.modo || 'N/A'}\n` +
              `**Tipo:** ${partida.tipo || 'N/A'}\n` +
              `**Valor:** R$ ${partida.valor || 'N/A'}`,
            inline: false
          }
        )
        .setFooter({ text: 'Obrigado por utilizar nosso sistema!' })
        .setTimestamp();

      await message.reply({ embeds: [embedFinal] });

      // Finalizar log
      if (logManager && logManager.sessoes.has(message.channel.id)) {
        await logManager.finalizarSessao(
          message.channel.id, 
          `Aposta finalizada manualmente via !f por ${message.author.tag}`
        );
        console.log(`[!F] 📝 Log finalizado para ${message.channel.id}`);
      }

      // Remover do banco de dados
      delete filasDados[message.channel.id];
      try {
        fs.writeFileSync(filasDadosPath, JSON.stringify(filasDados, null, 2), 'utf-8');
        console.log(`[!F] 🗑️ Partida removida do banco de dados`);
      } catch (err) {
        console.error('[!F] Erro ao salvar filasDados.json:', err);
      }

      // Deletar mensagem do comando
      setTimeout(() => {
        message.delete().catch(() => {});
      }, 3000);

      // Deletar canal
      setTimeout(() => {
        message.channel.delete('Aposta finalizada via comando !f').catch(err => {
          console.error('[!F] Erro ao deletar canal:', err);
        });
      }, 5000);

      console.log(`[!F] ✅ Aposta finalizada com sucesso`);

    } catch (error) {
      console.error('[!F] ❌ Erro crítico:', error);
      message.reply({ 
        content: `${emojis.failuser_emoji || '❌'} Ocorreu um erro ao processar o comando.`
      }).catch(() => {});
    }
  }
};