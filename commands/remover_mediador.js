const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// Caminhos dos arquivos
const filaPath = path.join(__dirname, '../DataBaseJson/mediadores.json');
const historicoPath = path.join(__dirname, '../DataBaseJson/historicoMediadores.json');
const estatisticasPath = path.join(__dirname, '../DataBaseJson/estatisticasMediadores.json');

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
        .setName('remover_mediador')
        .setDescription('Remove um mediador específico da fila')
        .addUserOption(option =>
            option
                .setName('mediador')
                .setDescription('O mediador que você deseja remover da fila')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction) {
        // Verifica se o usuário tem permissão
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: `${emojis.failuser_emoji || '❌'} Você não tem permissão para usar este comando!`,
                ephemeral: true
            });
        }

        const mediadorAlvo = interaction.options.getUser('mediador');
        const userId = mediadorAlvo.id;

        await interaction.deferReply({ ephemeral: false });

        // Carrega a fila atual
        let fila = loadJson(filaPath, []);

        // Verifica se o mediador está na fila
        if (!fila.includes(userId)) {
            return interaction.editReply({
                content: `${emojis.failuser_emoji || '❌'} <@${userId}> não está na fila de mediadores!`
            });
        }

        // Carrega as estatísticas para calcular o tempo
        const stats = loadJson(estatisticasPath, {});
        const tempoNaFila = stats[userId]?.ultimaEntrada 
            ? calcularTempoNaFila(stats[userId].ultimaEntrada)
            : 0;

        // Remove o mediador da fila
        fila = fila.filter(id => id !== userId);
        saveJson(filaPath, fila);

        // Registra no histórico e atualiza estatísticas
        registrarAcao(interaction.user, 'removeu_mediador', { 
            mediadorRemovido: userId,
            tempoNaFila 
        });
        atualizarEstatisticas(userId, 'saiu');

        // Cria embed de confirmação
        const embed = new EmbedBuilder()
            .setTitle(`${emojis.member_remove_emoji || '➖'} Mediador Removido`)
            .setDescription(
                `<@${userId}> foi removido da fila de mediadores por <@${interaction.user.id}>`
            )
            .addFields(
                { name: '⏱️ Tempo na Fila', value: `\`${formatarTempo(tempoNaFila)}\``, inline: true },
                { name: '👥 Mediadores Restantes', value: `\`${fila.length}\``, inline: true }
            )
            .setColor(0xe74c3c)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        console.log(`[COMANDO] ${interaction.user.tag} removeu ${mediadorAlvo.tag} da fila`);
    },
};