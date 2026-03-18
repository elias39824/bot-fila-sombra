const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const logsPath = path.join(__dirname, '../DataBaseJson/logs');
const mediadoresPath = path.join(__dirname, '../DataBaseJson/mediadores.json');

function isMediator(member) {
  let mediatorRoleIds = [];
  try {
    if (fsSync.existsSync(mediadoresPath)) {
      const data = fsSync.readFileSync(mediadoresPath, 'utf-8');
      mediatorRoleIds = JSON.parse(data);
    }
  } catch (e) {
    console.error('[LOGS] ❌ Erro ao ler mediadores:', e);
  }

  if (Array.isArray(mediatorRoleIds) && mediatorRoleIds.some(roleId => member.roles.cache.has(roleId))) {
    return true;
  }
  return member.permissions.has(PermissionFlagsBits.ManageChannels);
}

async function buscarLogsPorUsuario(userId) {
  try {
    if (!fsSync.existsSync(logsPath)) return [];

    const arquivos = await fs.readdir(logsPath);
    const logsUsuario = [];

    for (const arquivo of arquivos) {
      if (!arquivo.endsWith('.json')) continue;

      try {
        const caminhoArquivo = path.join(logsPath, arquivo);
        const conteudo = await fs.readFile(caminhoArquivo, 'utf-8');
        const log = JSON.parse(conteudo);

        if (log.participantes && Array.isArray(log.participantes) && log.participantes.includes(userId)) {
          logsUsuario.push({ 
            arquivo, 
            caminho: caminhoArquivo, 
            ...log 
          });
        }
      } catch (e) {
        console.error(`[LOGS] ❌ Erro ao ler arquivo ${arquivo}:`, e.message);
      }
    }

    return logsUsuario;
  } catch (error) {
    return [];
  }
}

// --- FUNÇÃO GERADORA DE HTML (MODO DISCORD) ---

async function gerarHTMLLog(dadosLog, guild) {
  const { iniciado, finalizado, status, duracao, dadosPartida, eventos, participantes } = dadosLog;

  // Buscar dados de membros
  const membrosInfo = await Promise.all(
    participantes.map(async (id) => {
      try {
        const member = await guild.members.fetch(id);
        return {
          id,
          username: member.user.username,
          displayName: member.displayName,
          avatarURL: member.user.displayAvatarURL({ dynamic: true, size: 128 })
        };
      } catch (e) {
        return { 
          id, 
          username: 'Desconhecido', 
          displayName: 'Desconhecido', 
          avatarURL: 'https://cdn.discordapp.com/embed/avatars/0/5d966851c7150a6a3c516f8774d9a9d4.png?size=128' 
        };
      }
    })
  );

  const membrosMap = new Map(membrosInfo.map(m => [m.id, m]));

  const duracaoMin = Math.floor(duracao / 60000);
  const duracaoSeg = Math.floor((duracao % 60000) / 1000);
  const duracaoStr = `${duracaoMin}min ${duracaoSeg}s`;

  // Gerar HTML do Chat
  const chatHtml = eventos.map((evento) => {
    const hora = new Date(evento.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const usuario = evento.dados.userId ? membrosMap.get(evento.dados.userId) : null;
    
    // Avatar
    const isBot = !usuario || evento.tipo !== 'mensagem';
    const avatarUrl = usuario?.avatarURL || 'https://cdn.discordapp.com/embed/avatars/0/5d966851c7150a6a3c516f8774d9a9d4.png?size=128';
    
    const displayNome = usuario ? (usuario.displayName || usuario.username) : 'Sistema';
    const userColor = '#ffffff';
    const isMediador = usuario?.id === dadosPartida.id_mediador;
    const badge = (usuario?.bot || isMediador) ? '<span class="bot-tag">BOT</span>' : '';

    // Conteúdo da mensagem
    let conteudo = '';

    if (evento.tipo === 'mensagem') {
      // Renderiza mensagem de texto
      const contentText = evento.dados.content || '';
      
      if (contentText.trim() === '') {
        // Se não tem texto mas tem anexos
        conteudo = `<span class="attachment-text">📎 <i>Contém ${evento.dados.attachments} anexo(s) ou embed.</i></span>`;
      } else {
        // Mensagem de texto normal
        conteudo = contentText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>');
      }
    } else {
      // Renderiza sistema/bots como Embeds
      let embedColor = '#99aab5'; 
      let title = 'Sistema';
      let description = evento.descricao || '';

      if (evento.tipo === 'inicio') { title = '🎬 Início da Partida'; embedColor = '#3ba55c'; }
      if (evento.tipo === 'fim') { title = '🏁 Fim da Partida'; embedColor = '#ed4245'; }
      if (evento.tipo === 'pagamento') { title = '💳 Pagamento PIX'; embedColor = '#5865f2'; }
      if (evento.tipo === 'acao') {
        title = 'Ação Realizada'; embedColor = '#faa61a';
        if (evento.dados.tipo === 'vencedor') { title = '🏆 Vencedor Definido'; embedColor = '#f1c40f'; }
        if (evento.dados.tipo === 'finalizar') { title = '🏁 Partida Finalizada'; embedColor = '#ed4245'; }
      }

      conteudo = `
        <div class="discord-embed" style="border-left:4px solid ${embedColor};">
          <div class="embed-title" style="color: ${embedColor};">${title}</div>
          <div class="embed-desc">${description}</div>
        </div>
      `;
    }

    return `
      <div class="message-group">
        <div class="message-avatar">
          <img src="${avatarUrl}" alt="Avatar">
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="username">${displayNome}</span>
            ${badge}
            <span class="timestamp">${hora}</span>
          </div>
          <div class="message-text">${conteudo}</div>
        </div>
      </div>
    `;
  }).join('');

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      background-color: #36393f;
      color: #dcddde;
      font-family: 'gg sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      display: flex;
      justify-content: center;
      padding: 0;
    }

    .discord-app {
      width: 100%;
      max-width: 920px;
      background-color: #36393f;
      overflow: hidden;
    }

    .header {
      background-color: #2f3136;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #202225;
    }

    .header-left { display: flex; align-items: center; gap: 8px; }
    .channel-name { font-size: 16px; font-weight: 500; color: #8e9297; }
    .channel-name span { font-weight: 700; color: #fff; }
    .header-info { font-size: 12px; color: #b9bbbe; text-align: right; }

    .chat-area {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .message-group {
      display: flex;
      margin-top: 8px;
      padding: 4px 8px;
      border-radius: 4px;
      transition: background-color 0.1s;
    }

    .message-group:hover {
      background-color: #32353b;
    }

    .message-avatar {
      margin-right: 16px;
      flex-shrink: 0;
    }

    .message-avatar img {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #2f3136;
      cursor: pointer;
    }

    .message-content {
      flex-grow: 1;
      min-width: 0;
    }

    .message-header {
      display: flex;
      align-items: baseline;
      margin-bottom: 4px;
    }

    .username {
      font-size: 16px;
      font-weight: 500;
      color: #ffffff;
      margin-right: 8px;
      cursor: pointer;
    }
    
    .username:hover { text-decoration: underline; }

    .timestamp {
      font-size: 12px;
      font-weight: 500;
      color: #72767d;
      text-transform: uppercase;
    }

    .message-text {
      font-size: 15px;
      line-height: 1.375rem;
      color: #dcddde;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .bot-tag {
      background-color: #5865f2;
      color: #fff;
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 3px;
      vertical-align: middle;
      margin-left: 4px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .discord-embed {
      margin-top: 8px;
      background-color: #2f3136;
      border-left: 4px solid #99aab5;
      border-radius: 4px;
      padding: 12px;
      max-width: 520px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }

    .embed-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .embed-desc {
      font-size: 14px;
      color: #dcddde;
      line-height: 1.3;
    }

    .attachment-text {
      color: #99aab5;
      font-style: italic;
      font-size: 14px;
    }
  `;

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log - ${dadosPartida.modo}</title>
  <style>${css}</style>
</head>
<body>
  <div class="discord-app">
    <div class="header">
      <div class="header-left">
        <div class="channel-name"># <span>aposta-log</span></div>
      </div>
      <div class="header-info">
        ${dadosPartida.modo} - R$ ${dadosPartida.valor}<br>
        Tempo: ${duracaoStr}
      </div>
    </div>

    <div class="chat-area">
      ${chatHtml}
    </div>
  </div>
</body>
</html>
  `;

  return html;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('log_download_')) return;

    try {
      await interaction.deferReply({ ephemeral: true });

      if (!isMediator(interaction.member)) {
        return interaction.editReply({
          content: '❌ Você não tem permissão!'
        });
      }

      if (interaction.customId.includes('log_download_all_')) {
        const userId = interaction.customId.replace('log_download_all_', '');
        const logs = await buscarLogsPorUsuario(userId);

        if (logs.length === 0) {
          return interaction.editReply({ 
            content: '❌ Nenhum log encontrado!' 
          });
        }

        const logsToDownload = logs.slice(0, 5);
        const htmlPromises = logsToDownload.map(log => gerarHTMLLog(log, interaction.guild));
        const htmls = await Promise.all(htmlPromises);

        const attachments = htmls.map((html, index) => {
          const log = logsToDownload[index];
          const dataHora = new Date(log.iniciado).toISOString().replace(/[:.]/g, '-').split('T')[0];
          const nomeArquivo = `log_${index + 1}_${dataHora}.html`;
          const buffer = Buffer.from(html, 'utf-8');
          return new AttachmentBuilder(buffer, { name: nomeArquivo });
        });

        try {
          await interaction.user.send({
            content: `📦 **Logs do sistema (Modo Discord)** (${logsToDownload.length} arquivos)`,
            files: attachments
          });
          return interaction.editReply({ 
            content: `✅ **Enviado no seu PV!** Verifique suas mensagens privadas.` 
          });
        } catch (dmError) {
          console.error('[LOGS] ❌ Erro ao enviar PV:', dmError);
          return interaction.editReply({ 
            content: `❌ **Não consegui enviar no seu PV.** (Seus Privados estão fechados?)` 
          });
        }

      } else {
        const canalId = interaction.customId.replace('log_download_', '');
        
        const arquivos = await fs.readdir(logsPath);
        let log = null;
        
        for (const arquivo of arquivos) {
          if (arquivo.includes(canalId) && arquivo.endsWith('.json')) {
            const caminhoArquivo = path.join(logsPath, arquivo);
            const conteudo = await fs.readFile(caminhoArquivo, 'utf-8');
            log = JSON.parse(conteudo);
            break;
          }
        }

        if (!log) {
          return interaction.editReply({ 
            content: `❌ Log não encontrado!` 
          });
        }

        const html = await gerarHTMLLog(log, interaction.guild);
        const buffer = Buffer.from(html, 'utf-8');

        const dataHora = new Date(log.iniciado).toISOString().replace(/[:.]/g, '-').split('T')[0];
        const nomeArquivo = `log_${dataHora}_${canalId}.html`;

        const attachment = new AttachmentBuilder(buffer, { name: nomeArquivo });

        try {
          await interaction.user.send({
            content: `📄 **Log da partida**`,
            files: [attachment]
          });
          return interaction.editReply({ 
            content: `✅ **Enviado no seu PV!** Verifique suas mensagens privadas.` 
          });
        } catch (dmError) {
          console.error('[LOGS] ❌ Erro ao enviar PV:', dmError);
          return interaction.editReply({ 
            content: `❌ **Não consegui enviar no seu PV.** (Seus Privados estão fechados?)` 
          });
        }
      }

    } catch (error) {
      console.error('[LOGS] ❌ Erro ao processar download:', error);
      if (interaction.deferred) {
        await interaction.editReply({
          content: `❌ Erro ao gerar log: ${error.message}`
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: `❌ Erro ao gerar log: ${error.message}`,
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
};