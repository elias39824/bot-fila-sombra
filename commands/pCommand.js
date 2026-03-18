const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// 🔥 ADICIONE ESTAS FUNÇÕES NO INÍCIO DO ARQUIVO
const usersPath = path.join(__dirname, '../DataBaseJson/usersinfo.json');

function getUsersDB() {
  if (!fs.existsSync(usersPath)) {
    return {};
  }
  try {
    const data = fs.readFileSync(usersPath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('[STATS] Erro ao ler usersinfo.json:', e);
    return {};
  }
}

function getStatsForUser(userId) {
  const db = getUsersDB();
  
  // Se o usuário não existe, retorna estatísticas zeradas
  if (!db[userId]) {
    return {
      vitorias: 0,
      derrotas: 0,
      pontos: 0,
      partidas: 0,
      consecutivas: 0
    };
  }
  
  return {
    vitorias: db[userId].vitorias || 0,
    derrotas: db[userId].derrotas || 0,
    pontos: db[userId].pontos || 0,
    partidas: db[userId].partidas || 0,
    consecutivas: db[userId].consecutivas || 0
  };
}

module.exports = {
    name: 'p',
    description: 'Mostra as estatísticas de partidas de um usuário.',
    async execute(message, args) {
        // 1. Identifica o usuário
        let user;
        let targetId;
        
        if (args[0]) {
            targetId = args[0].replace(/<@!?(\d+)>/g, '$1');
        }

        if (targetId) {
            user = message.client.users.cache.get(targetId) || message.author;
        } else {
            user = message.author;
        }
        
        // 2. 🔥 AGORA USA A FUNÇÃO LOCAL QUE LÊ O JSON CORRETO
        const stats = getStatsForUser(user.id);
        
        console.log('[DEBUG STATS] 📊 Estatísticas lidas:', stats);
        console.log('[DEBUG STATS] 👤 Usuário:', user.id);
        
        // 3. Calcula estatísticas
        const totalPartidas = stats.vitorias + stats.derrotas;
        const chanceVitoria = totalPartidas > 0 ? ((stats.vitorias / totalPartidas) * 100).toFixed(1) : 0;
        
        // Define a cor do embed baseado na chance de vitória
        let embedColor;
        if (chanceVitoria >= 70) {
            embedColor = 0x3ba55d; // Verde
        } else if (chanceVitoria >= 50) {
            embedColor = 0xfaa61a; // Amarelo
        } else if (chanceVitoria >= 30) {
            embedColor = 0xeb459e; // Rosa
        } else {
            embedColor = 0xed4245; // Vermelho
        }
        
        // Barra de progresso para chance de vitória
        const barLength = 20;
        const filledBars = Math.round((chanceVitoria / 100) * barLength);
        const emptyBars = barLength - filledBars;
        const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
        
        // 4. Cria o embed
        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`**Estatísticas de ${user.username}**`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(`> **Jogador:** ${user}\n> **Total de Partidas:** \`${totalPartidas}\``)
            .addFields(
                {
                    name: '**VITÓRIAS**',
                    value: `\`\`\`yaml\n${stats.vitorias}\`\`\``,
                    inline: true
                },
                {
                    name: '**DERROTAS**',
                    value: `\`\`\`yaml\n${stats.derrotas}\`\`\``,
                    inline: true
                },
                {
                    name: '**COINS**',
                    value: `\`\`\`yaml\n${stats.pontos}\`\`\``,
                    inline: true
                },
                {
                    name: '**CONSECUTIVAS**',
                    value: `\`\`\`diff\n+ ${stats.consecutivas || 0}\`\`\``,
                    inline: true
                },
                {
                    name: '**PARTIDAS**',
                    value: `\`\`\`fix\n${stats.partidas || totalPartidas}\`\`\``,
                    inline: true
                },
                {
                    name: '**CHANCE DE VITÓRIA**',
                    value: `\`\`\`ansi\n\u001b[1;32m${chanceVitoria}%\u001b[0m\`\`\`\n${progressBar}`,
                    inline: true
                }
            )
            .setFooter({ 
                text: `${message.guild.name} • Solicitado por ${message.author.username}`,
                iconURL: message.guild.iconURL() || undefined
            })
            .setTimestamp();

        // 5. Envia o embed
        await message.channel.send({ embeds: [embed] });
    },
};