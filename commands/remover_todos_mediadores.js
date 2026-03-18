const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// Caminhos dos arquivos
const filaPath = path.join(__dirname, '../DataBaseJson/mediadores.json');
const historicoPath = path.join(__dirname, '../DataBaseJson/historicoMediadores.json');
const estatisticasPath = path.join(__dirname, '../DataBaseJson/estatisticasMediadores.json');
const backupDir = path.join(__dirname, '../Backups/Mediadores');

// Funções utilitárias
function loadJson(filePath, defaultValue) {
    if (!fs.existsSync(filePath)) {
        saveJson(filePath, defaultValue);
        return defaultValue;
    }
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(data);
        if (json === null || json === undefined) {
            return defaultValue;
        }
        return json;
    } catch (e) {
        console.error(`[ERROR] Erro ao ler JSON em ${filePath}:`, e.message);
        return defaultValue;
    }
}

function saveJson(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error(`[ERROR] Erro ao salvar JSON em ${filePath}:`, e.message);
    }
}

function criarBackupFila(fila, motivo = 'manual') {
    try {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const backupPath = path.join(backupDir, `fila_${timestamp}_${motivo}.json`);
        
        fs.writeFileSync(backupPath, JSON.stringify({
            fila: fila,
            timestamp: new Date().toISOString(),
            motivo: motivo
        }, null, 2));
        
        console.log(`[BACKUP] Fila salva em: ${backupPath}`);
        
        const backups = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('fila_'))
            .sort()
            .reverse();
        
        if (backups.length > 30) {
            for (let i = 30; i < backups.length; i++) {
                fs.unlinkSync(path.join(backupDir, backups[i]));
            }
        }
    } catch (e) {
        console.error('[ERROR] Falha ao criar backup:', e);
    }
}

function registrarAcao(usuario, acao, detalhes = {}) {
    try {
        let historico = loadJson(historicoPath, []);
        
        historico.push({
            timestamp: new Date().toISOString(),
            usuario: {
                id: usuario.id,
                tag: usuario.tag,
                username: usuario.username
            },
            acao: acao,
            ...detalhes
        });
        
        if (historico.length > 1000) {
            historico = historico.slice(-1000);
        }
        
        saveJson(historicoPath, historico);
        console.log(`[HISTORICO] ${acao} por ${usuario.tag}`);
    } catch (e) {
        console.error('[ERROR] Falha ao registrar histórico:', e);
    }
}

function atualizarEstatisticas(userId, acao) {
    try {
        let stats = loadJson(estatisticasPath, {});
        
        if (!stats[userId]) {
            stats[userId] = {
                entradas: 0,
                saidas: 0,
                tempoTotal: 0,
                ultimaEntrada: null,
                ultimaSaida: null
            };
        }
        
        if (acao === 'saiu') {
            stats[userId].saidas++;
            stats[userId].ultimaSaida = new Date().toISOString();
            
            if (stats[userId].ultimaEntrada) {
                const entrada = new Date(stats[userId].ultimaEntrada);
                const saida = new Date();
                const tempo = Math.floor((saida - entrada) / 1000);
                stats[userId].tempoTotal += tempo;
            }
        }
        
        saveJson(estatisticasPath, stats);
    } catch (e) {
        console.error('[ERROR] Falha ao atualizar estatísticas:', e);
    }
}

function calcularTempoNaFila(entrada) {
    if (!entrada) return 0;
    const agora = Date.now();
    const entradaTime = new Date(entrada).getTime();
    return Math.floor((agora - entradaTime) / 1000);
}

function formatarTempo(segundos) {
    const horas = Math.floor(segundos / 3600);
    const minutos = Math.floor((segundos % 3600) / 60);
    const segs = segundos % 60;
    
    if (horas > 0) {
        return `${horas}h ${minutos}m ${segs}s`;
    } else if (minutos > 0) {
        return `${minutos}m ${segs}s`;
    } else {
        return `${segs}s`;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remover_todos_mediadores')
        .setDescription('Remove todos os mediadores da fila (requer confirmação)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        // Verifica se o usuário tem permissão
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: `${emojis.failuser_emoji || '❌'} Você não tem permissão para usar este comando!`,
                ephemeral: true
            });
        }

        // Carrega a fila atual
        let fila = loadJson(filaPath, []);

        // Verifica se a fila está vazia
        if (fila.length === 0) {
            return interaction.reply({
                content: `${emojis.failuser_emoji || '❌'} A fila de mediadores já está vazia!`,
                ephemeral: true
            });
        }

        // Cria embed de confirmação
        const embed = new EmbedBuilder()
            .setTitle(`${emojis.information_emoji || 'ℹ️'} Confirmação Necessária`)
            .setDescription(
                `⚠️ **ATENÇÃO:** Você está prestes a remover **TODOS** os mediadores da fila!\n\n` +
                `👥 **Total de mediadores na fila:** \`${fila.length}\`\n` +
                `📋 **Mediadores que serão removidos:**\n${fila.map((id, i) => `${i + 1}. <@${id}>`).join('\n')}\n\n` +
                `Esta ação não pode ser desfeita facilmente. Deseja continuar?`
            )
            .setColor(0xe67e22)
            .setTimestamp();

        // Cria botões de confirmação
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`confirmar_remover_todos_${interaction.user.id}`)
                .setLabel('Confirmar')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId(`cancelar_remover_todos_${interaction.user.id}`)
                .setLabel('Cancelar')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('❌')
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

        // Collector para os botões
        const filter = i => {
            return (i.customId === `confirmar_remover_todos_${interaction.user.id}` || 
                    i.customId === `cancelar_remover_todos_${interaction.user.id}`) && 
                   i.user.id === interaction.user.id;
        };

        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 30000, // 30 segundos para responder
            max: 1 
        });

        collector.on('collect', async i => {
            if (i.customId === `confirmar_remover_todos_${interaction.user.id}`) {
                // Cria backup antes de limpar
                criarBackupFila(fila, 'remocao_total');

                // Calcula estatísticas antes de remover
                const stats = loadJson(estatisticasPath, {});
                let tempoTotalCalculado = 0;
                
                fila.forEach(userId => {
                    if (stats[userId]?.ultimaEntrada) {
                        const tempo = calcularTempoNaFila(stats[userId].ultimaEntrada);
                        tempoTotalCalculado += tempo;
                    }
                    atualizarEstatisticas(userId, 'saiu');
                });

                const mediaTempoFila = fila.length > 0 ? Math.floor(tempoTotalCalculado / fila.length) : 0;
                const totalMediadores = fila.length;

                // Registra no histórico
                registrarAcao(interaction.user, 'removeu_todos_mediadores', { 
                    totalRemovidos: fila.length,
                    mediadores: [...fila]
                });

                // Limpa a fila
                saveJson(filaPath, []);

                // Embed de sucesso
                const successEmbed = new EmbedBuilder()
                    .setTitle(`${emojis.confirmed_emoji || '✅'} Fila Limpa`)
                    .setDescription(
                        `Todos os mediadores foram removidos da fila por <@${interaction.user.id}>`
                    )
                    .addFields(
                        { name: '👥 Mediadores Removidos', value: `\`${totalMediadores}\``, inline: true },
                        { name: '⏱️ Tempo Médio na Fila', value: `\`${formatarTempo(mediaTempoFila)}\``, inline: true },
                        { name: '💾 Backup', value: '`Criado com sucesso`', inline: true }
                    )
                    .setColor(0xe74c3c)
                    .setTimestamp();

                await i.update({ embeds: [successEmbed], components: [] });
                
                console.log(`[COMANDO] ${interaction.user.tag} removeu todos os mediadores da fila (${totalMediadores} mediadores)`);

            } else if (i.customId === `cancelar_remover_todos_${interaction.user.id}`) {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle(`${emojis.failuser_emoji || '❌'} Operação Cancelada`)
                    .setDescription('A remoção de todos os mediadores foi cancelada.')
                    .setColor(0x95a5a6)
                    .setTimestamp();

                await i.update({ embeds: [cancelEmbed], components: [] });
            }
        });

        collector.on('end', async collected => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle(`${emojis.failuser_emoji || '⏱️'} Tempo Esgotado`)
                    .setDescription('Você não respondeu a tempo. A operação foi cancelada.')
                    .setColor(0x95a5a6)
                    .setTimestamp();

                await interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
            }
        });
    },
};