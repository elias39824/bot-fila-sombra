const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const logsPath = path.join(__dirname, '../DataBaseJson/logs');
const mediadoresPath = path.join(__dirname, '../DataBaseJson/mediadores.json');

if (!fsSync.existsSync(logsPath)) {
  fsSync.mkdirSync(logsPath, { recursive: true });
  console.log('[LOGS] 📁 Pasta de logs criada');
}

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
    console.log(`[LOGS] 🔍 Buscando logs para usuário: ${userId}`);
    
    if (!fsSync.existsSync(logsPath)) {
      console.log('[LOGS] ⚠️ Pasta de logs não existe');
      return [];
    }

    const arquivos = await fs.readdir(logsPath);
    console.log(`[LOGS] 📂 Total de arquivos na pasta: ${arquivos.length}`);
    
    const logsUsuario = [];

    for (const arquivo of arquivos) {
      if (!arquivo.endsWith('.json')) continue;

      try {
        const caminhoArquivo = path.join(logsPath, arquivo);
        const conteudo = await fs.readFile(caminhoArquivo, 'utf-8');
        const log = JSON.parse(conteudo);

        if (log.participantes && Array.isArray(log.participantes) && log.participantes.includes(userId)) {
          console.log(`[LOGS] ✅ Usuário encontrado no arquivo: ${arquivo}`);
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

    console.log(`[LOGS] 📊 Total de logs encontrados: ${logsUsuario.length}`);
    return logsUsuario;
  } catch (error) {
    console.error('[LOGS] ❌ Erro ao buscar logs:', error);
    return [];
  }
}

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.content.startsWith('!logs')) return;

    try {
      if (!isMediator(message.member)) {
        return message.reply({
          content: '❌ Você não tem permissão para usar este comando!'
        });
      }

      const mentioned = message.mentions.users.first();
      
      if (!mentioned) {
        return message.reply({
          content: '❌ Você precisa mencionar um usuário!\n**Uso:** `!logs @usuario`'
        });
      }

      console.log(`[LOGS] 🔎 Comando !logs usado por ${message.author.username} para ${mentioned.username}`);

      const logs = await buscarLogsPorUsuario(mentioned.id);

      if (logs.length === 0) {
        return message.reply({
          content: `❌ Nenhum log encontrado para ${mentioned}.`
        });
      }

      const logsAtivos = logs.filter(l => l.status === 'ativa');
      const logsPendentes = logs.filter(l => l.status === 'pendente');
      const logsEncerrados = logs.filter(l => l.status === 'encerrada');

      const embed = new EmbedBuilder()
        .setTitle(`📋 Logs de ${mentioned.username}`)
        .setDescription(`**Total de logs encontrados:** ${logs.length}`)
        .setColor('#667eea')
        .setThumbnail(mentioned.displayAvatarURL())
        .addFields(
          {
            name: 'Ativas',
            value: logsAtivos.length > 0 
              ? logsAtivos.slice(0, 10).map((l, i) => `${i + 1}. ${formatarData(l.iniciado)}`).join('\n')
              : '*Nenhuma*',
            inline: true
          },
          {
            name: 'Pendentes',
            value: logsPendentes.length > 0
              ? logsPendentes.slice(0, 10).map((l, i) => `${i + 1}. ${formatarData(l.iniciado)}`).join('\n')
              : '*Nenhuma*',
            inline: true
          },
          {
            name: 'Encerradas',
            value: logsEncerrados.length > 0
              ? logsEncerrados.slice(0, 10).map((l, i) => `${i + 1}. ${formatarData(l.iniciado)}`).join('\n')
              : '*Nenhuma*',
            inline: true
          }
        )
        .setFooter({ text: `Use os botões abaixo para baixar | Total: ${logs.length}` })
        .setTimestamp();

      const rows = [];
      let currentRow = new ActionRowBuilder();
      let buttonsInRow = 0;

      const logsToShow = logs.slice(0, 10); // Limita a 10 logs para não estourar componentes

      logsToShow.forEach((log, index) => {
        const button = new ButtonBuilder()
          .setCustomId(`log_download_${log.canalId}`)
          .setLabel(`Log #${index + 1}`)
          .setStyle(ButtonStyle.Primary);

        currentRow.addComponents(button);
        buttonsInRow++;

        if (buttonsInRow === 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
          buttonsInRow = 0;
        }
      });

      // Botão de baixar todos
      if (logsToShow.length > 0) {
        const downloadAllBtn = new ButtonBuilder()
          .setCustomId(`log_download_all_${mentioned.id}`)
          .setLabel('Baixar Todos (Limitado)')
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
        content: `❌ Erro ao buscar logs: ${error.message}`
      });
    }
  }
};