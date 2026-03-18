const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// Caminhos
const logsPath = path.join(__dirname, '../DataBaseJson/logs');
const mediadoresPath = path.join(__dirname, '../DataBaseJson/mediadores.json');

// Verifica permissão de mediador
function isMediator(member) {
  let mediatorRoleIds = [];
  try {
    if (fsSync.existsSync(mediadoresPath)) {
      const data = fsSync.readFileSync(mediadoresPath, 'utf-8');
      mediatorRoleIds = JSON.parse(data);
    }
  } catch (e) {
    console.error('Erro ao ler mediadores:', e);
  }

  if (Array.isArray(mediatorRoleIds) && mediatorRoleIds.some(roleId => member.roles.cache.has(roleId))) {
    return true;
  }
  return member.permissions.has(PermissionFlagsBits.ManageChannels);
}

function formatarData(timestamp) {
  const data = new Date(timestamp);
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

async function buscarLogsPorUsuario(userId) {
  try {
    const dataStr = new Date().toISOString().split('T')[0];
    const arquivos = await fs.readdir(logsPath);
    const logsUsuario = [];

    for (const arquivo of arquivos) {
      if (!arquivo.startsWith(dataStr) || !arquivo.endsWith('.json')) continue;

      const caminhoArquivo = path.join(logsPath, arquivo);
      const conteudo = await fs.readFile(caminhoArquivo, 'utf-8');
      const log = JSON.parse(conteudo);

      if (log.participantes && log.participantes.includes(userId)) {
        logsUsuario.push({ arquivo, caminho: caminhoArquivo, ...log });
      }
    }

    return logsUsuario;

  } catch (error) {
    console.error('[LOGS] ❌ Erro ao buscar logs:', error);
    return [];
  }
}

async function gerarHTMLLog(dadosLog, guild) {
  const { iniciado, finalizado, status, motivo, duracao, dadosPartida, eventos, participantes } = dadosLog;

  const membrosInfo = await Promise.all(
    participantes.map(async (id) => {
      try {
        const member = await guild.members.fetch(id);
        return {
          id,
          username: member.user.username,
          displayName: member.displayName
        };
      } catch (e) {
        return { id, username: 'Desconhecido', displayName: 'Desconhecido' };
      }
    })
  );

  const membrosMap = new Map(membrosInfo.map(m => [m.id, m]));

  const duracaoMin = Math.floor(duracao / 60000);
  const duracaoSeg = Math.floor((duracao % 60000) / 1000);
  const duracaoStr = `${duracaoMin}m ${duracaoSeg}s`;

  const statusBadges = {
    'ativa': '<span class="badge badge-success">✅ Ativa</span>',
    'encerrada': '<span class="badge badge-secondary">🏁 Encerrada</span>',
    'pendente': '<span class="badge badge-warning">⏳ Pendente</span>'
  };

  const statusBadge = statusBadges[status] || status;

  const jogador1Info = membrosMap.get(dadosPartida.jogadores[0]) || { username: 'Desconhecido' };
  const jogador2Info = membrosMap.get(dadosPartida.jogadores[1]) || { username: 'Desconhecido' };
  const mediadorInfo = membrosMap.get(dadosPartida.id_mediador) || { username: 'Desconhecido' };

  const eventosHTML = eventos.map((evento) => {
    const hora = new Date(evento.timestamp).toLocaleTimeString('pt-BR');
    const usuario = evento.dados.userId ? membrosMap.get(evento.dados.userId) : null;

    let icone = '📝';
    let classe = 'evento-normal';
    let detalhes = '';

    switch (evento.tipo) {
      case 'inicio':
        icone = '🎬';
        classe = 'evento-inicio';
        break;
      case 'fim':
        icone = '🏁';
        classe = 'evento-fim';
        break;
      case 'acao':
        icone = '⚡';
        classe = 'evento-acao';
        if (evento.dados.tipo === 'vencedor') {
          icone = '🏆';
          detalhes = `<div class="detalhes">Vencedor: ${usuario ? usuario.username : 'Desconhecido'}</div>`;
        }
        break;
      case 'mensagem':
        icone = '💬';
        classe = 'evento-mensagem';
        if (evento.dados.content) {
          const contentPreview = evento.dados.content.length > 100 
            ? evento.dados.content.substring(0, 100) + '...' 
            : evento.dados.content;
          detalhes = `<div class="detalhes mensagem-preview">"${contentPreview}"</div>`;
        }
        break;
      case 'status':
        icone = '🔄';
        classe = 'evento-status';
        break;
      case 'pagamento':
        icone = '💰';
        classe = 'evento-pagamento';
        break;
    }

    const usuarioNome = usuario ? usuario.username : 'Sistema';

    return `
      <div class="evento ${classe}">
        <div class="evento-time">${hora}</div>
        <div class="evento-icon">${icone}</div>
        <div class="evento-content">
          <div class="evento-titulo">${evento.descricao}</div>
          <div class="evento-usuario">Por: ${usuarioNome}</div>
          ${detalhes}
        </div>
      </div>
    `;
  }).join('');

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log da Partida - ${jogador1Info.username} vs ${jogador2Info.username}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; color: #333; }
    .container { max-width: 1000px; margin: 0 auto; background: white; border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); overflow: hidden; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header .subtitle { font-size: 16px; opacity: 0.9; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; padding: 30px; background: #f8f9fa; }
    .info-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .info-card h3 { color: #667eea; font-size: 14px; text-transform: uppercase; margin-bottom: 10px; font-weight: 600; }
    .info-card .value { font-size: 20px; font-weight: bold; color: #333; }
    .badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: 600; }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-secondary { background: #e2e3e5; color: #383d41; }
    .badge-warning { background: #fff3cd; color: #856404; }
    .jogadores { padding: 30px; background: white; }
    .jogadores h2 { color: #667eea; margin-bottom: 20px; font-size: 24px; }
    .jogador-card { background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 15px; display: flex; align-items: center; gap: 15px; }
    .jogador-numero { background: #667eea; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; }
    .jogador-info { flex: 1; }
    .jogador-nome { font-size: 18px; font-weight: 600; color: #333; }
    .timeline { padding: 30px; background: white; }
    .timeline h2 { color: #667eea; margin-bottom: 20px; font-size: 24px; }
    .evento { display: grid; grid-template-columns: 80px 40px 1fr; gap: 15px; padding: 15px; margin-bottom: 10px; border-radius: 10px; background: #f8f9fa; transition: all 0.3s ease; }
    .evento:hover { transform: translateX(5px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .evento-time { color: #6c757d; font-size: 12px; font-weight: 600; }
    .evento-icon { font-size: 24px; }
    .evento-content { flex: 1; }
    .evento-titulo { font-weight: 600; color: #333; margin-bottom: 5px; }
    .evento-usuario { font-size: 12px; color: #6c757d; }
    .detalhes { margin-top: 10px; padding: 10px; background: white; border-radius: 5px; font-size: 14px; }
    .mensagem-preview { font-style: italic; color: #495057; }
    .evento-inicio { background: #d4edda; border-left: 4px solid #28a745; }
    .evento-fim { background: #f8d7da; border-left: 4px solid #dc3545; }
    .evento-acao { background: #fff3cd; border-left: 4px solid #ffc107; }
    .evento-pagamento { background: #d1ecf1; border-left: 4px solid #17a2b8; }
    .footer { background: #343a40; color: white; text-align: center; padding: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Log da Partida</h1>
      <div class="subtitle">${guild.name}</div>
    </div>
    <div class="info-grid">
      <div class="info-card"><h3>🕐 Iniciado</h3><div class="value">${new Date(iniciado).toLocaleString('pt-BR')}</div></div>
      <div class="info-card"><h3>🏁 Finalizado</h3><div class="value">${new Date(finalizado).toLocaleString('pt-BR')}</div></div>
      <div class="info-card"><h3>⏱️ Duração</h3><div class="value">${duracaoStr}</div></div>
      <div class="info-card"><h3>📊 Status</h3><div class="value">${statusBadge}</div></div>
      <div class="info-card"><h3>🎮 Modo</h3><div class="value">${dadosPartida.modo}</div></div>
      <div class="info-card"><h3>💰 Valor</h3><div class="value">R$ ${dadosPartida.valor}</div></div>
    </div>
    <div class="jogadores">
      <h2>👥 Participantes</h2>
      <div class="jogador-card"><div class="jogador-numero">1</div><div class="jogador-info"><div class="jogador-nome">${jogador1Info.username}</div></div></div>
      <div class="jogador-card"><div class="jogador-numero">2</div><div class="jogador-info"><div class="jogador-nome">${jogador2Info.username}</div></div></div>
      <div class="jogador-card" style="background: #e7f3ff;"><div class="jogador-numero" style="background: #0066cc;">👮</div><div class="jogador-info"><div class="jogador-nome">Mediador: ${mediadorInfo.username}</div></div></div>
    </div>
    <div class="timeline">
      <h2>📅 Timeline de Eventos (${eventos.length})</h2>
      ${eventosHTML}
    </div>
    <div class="footer">
      <p>Log gerado automaticamente • ${new Date().toLocaleString('pt-BR')}</p>
      <p>Sistema de Apostas • ${guild.name}</p>
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.content.startsWith('!logs')) return;

    try {
      if (!isMediator(message.member)) {
        return message.reply({
          content: `${emojis.failuser_emoji || '❌'} Você não tem permissão para usar este comando!`
        });
      }

      const mentioned = message.mentions.users.first();
      
      if (!mentioned) {
        return message.reply({
          content: `${emojis.failuser_emoji || '❌'} Você precisa mencionar um usuário!\n**Uso:** \`!logs @usuario\``
        });
      }

      const logs = await buscarLogsPorUsuario(mentioned.id);

      if (logs.length === 0) {
        return message.reply({
          content: `${emojis.failuser_emoji || '❌'} Nenhum log encontrado para ${mentioned} hoje.`
        });
      }

      const logsAtivos = logs.filter(l => l.status === 'ativa');
      const logsPendentes = logs.filter(l => l.status === 'pendente');
      const logsEncerrados = logs.filter(l => l.status === 'encerrada');

      const embed = new EmbedBuilder()
        .setTitle(`${emojis._star_emoji || '📋'} Logs de ${mentioned.username}`)
        .setDescription(`Logs encontrados de hoje (${new Date().toLocaleDateString('pt-BR')})`)
        .setColor('#667eea')
        .setThumbnail(mentioned.displayAvatarURL())
        .addFields(
          {
            name: '✅ Ativas',
            value: logsAtivos.length > 0 
              ? logsAtivos.map((l, i) => `${i + 1}. Partida às ${formatarData(l.iniciado).split(' ')[1]}`).join('\n')
              : '*Nenhuma*',
            inline: true
          },
          {
            name: '⏳ Pendentes',
            value: logsPendentes.length > 0
              ? logsPendentes.map((l, i) => `${i + 1}. Partida às ${formatarData(l.iniciado).split(' ')[1]}`).join('\n')
              : '*Nenhuma*',
            inline: true
          },
          {
            name: '🏁 Encerradas',
            value: logsEncerrados.length > 0
              ? logsEncerrados.map((l, i) => `${i + 1}. Partida às ${formatarData(l.iniciado).split(' ')[1]}`).join('\n')
              : '*Nenhuma*',
            inline: true
          }
        )
        .setFooter({ text: `Total: ${logs.length} partida(s) | Use os botões abaixo para baixar` })
        .setTimestamp();

      const rows = [];
      let currentRow = new ActionRowBuilder();
      let buttonsInRow = 0;

      logs.forEach((log, index) => {
        const statusEmoji = { 'ativa': '✅', 'pendente': '⏳', 'encerrada': '🏁' };

        const button = new ButtonBuilder()
          .setCustomId(`log_download_${log.canalId}`)
          .setLabel(`#${index + 1}`)
          .setEmoji(statusEmoji[log.status] || '📄')
          .setStyle(ButtonStyle.Primary);

        currentRow.addComponents(button);
        buttonsInRow++;

        if (buttonsInRow === 5 || index === logs.length - 1) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
          buttonsInRow = 0;
        }
      });

      if (logs.length > 1) {
        const downloadAllBtn = new ButtonBuilder()
          .setCustomId(`log_download_all_${mentioned.id}`)
          .setLabel('Baixar Todos')
          .setEmoji('📦')
          .setStyle(ButtonStyle.Success);

        if (buttonsInRow === 0) {
          currentRow = new ActionRowBuilder();
        }
        
        currentRow.addComponents(downloadAllBtn);
        rows.push(currentRow);
      }

      const finalRows = rows.slice(0, 5);

      await message.reply({
        embeds: [embed],
        components: finalRows
      });

    } catch (error) {
      console.error('[LOGS] ❌ Erro no comando !logs:', error);
      await message.reply({
        content: `${emojis.failuser_emoji || '❌'} Erro ao buscar logs.`
      });
    }
  },

  // HANDLER DE BOTÕES
  handleButton: {
    name: 'interactionCreate',
    async execute(interaction) {
      if (!interaction.isButton()) return;
      if (!interaction.customId.startsWith('log_download_')) return;

      try {
        await interaction.deferReply({ ephemeral: true });

        if (!isMediator(interaction.member)) {
          return interaction.editReply({
            content: `${emojis.failuser_emoji || '❌'} Você não tem permissão!`
          });
        }

        if (interaction.customId.includes('log_download_all_')) {
          const userId = interaction.customId.replace('log_download_all_', '');
          const logs = await buscarLogsPorUsuario(userId);

          if (logs.length === 0) {
            return interaction.editReply({ content: `${emojis.failuser_emoji || '❌'} Nenhum log encontrado!` });
          }

          const htmlPromises = logs.map(log => gerarHTMLLog(log, interaction.guild));
          const htmls = await Promise.all(htmlPromises);

          const attachments = htmls.map((html, index) => {
            const log = logs[index];
            const dataHora = new Date(log.iniciado).toISOString().replace(/[:.]/g, '-').split('T')[0];
            const nomeArquivo = `log_${index + 1}_${dataHora}.html`;
            const buffer = Buffer.from(html, 'utf-8');
            return new AttachmentBuilder(buffer, { name: nomeArquivo });
          });

          const embed = new EmbedBuilder()
            .setTitle(`${emojis.confirmed_emoji || '✅'} Todos os Logs Gerados!`)
            .setDescription(`📦 **Total:** ${logs.length} arquivos\n💡 Abra os arquivos HTML no navegador`)
            .setColor('#00FF00')
            .setTimestamp();

          await interaction.editReply({ embeds: [embed], files: attachments });

        } else {
          const canalId = interaction.customId.replace('log_download_', '');
          const dataStr = new Date().toISOString().split('T')[0];
          const arquivos = await fs.readdir(logsPath);
          
          let log = null;
          for (const arquivo of arquivos) {
            if (arquivo.includes(canalId) && arquivo.startsWith(dataStr)) {
              const caminhoArquivo = path.join(logsPath, arquivo);
              const conteudo = await fs.readFile(caminhoArquivo, 'utf-8');
              log = JSON.parse(conteudo);
              break;
            }
          }

          if (!log) {
            return interaction.editReply({ content: `${emojis.failuser_emoji || '❌'} Log não encontrado!` });
          }

          const html = await gerarHTMLLog(log, interaction.guild);
          const buffer = Buffer.from(html, 'utf-8');

          const dataHora = new Date(log.iniciado).toISOString().replace(/[:.]/g, '-').split('T')[0];
          const nomeArquivo = `log_${dataHora}_${canalId}.html`;

          const attachment = new AttachmentBuilder(buffer, { name: nomeArquivo });

          const embed = new EmbedBuilder()
            .setTitle(`${emojis.confirmed_emoji || '✅'} Log Gerado!`)
            .setDescription(`📄 **Arquivo:** \`${nomeArquivo}\`\n💡 Abra o HTML no navegador`)
            .setColor('#00FF00')
            .setTimestamp();

          await interaction.editReply({ embeds: [embed], files: [attachment] });
        }

      } catch (error) {
        console.error('[LOGS] ❌ Erro ao processar download:', error);
        await interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} Erro ao gerar o log.`
        }).catch(() => {});
      }
    }
  }
};