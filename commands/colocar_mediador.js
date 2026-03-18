const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// Caminhos dos arquivos
const filaPath = path.join(__dirname, '../DataBaseJson/mediadores.json');
const cargosPath = path.join(__dirname, '../DataBaseJson/mediador.json');
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
        
        if (acao === 'entrou') {
            stats[userId].entradas++;
            stats[userId].ultimaEntrada = new Date().toISOString();
        }
        
        saveJson(estatisticasPath, stats);
    } catch (e) {
        console.error('[ERROR] Falha ao atualizar estatísticas:', e);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('colocar_mediador')
        .setDescription('Adiciona um mediador na fila')
        .addUserOption(option =>
            option
                .setName('mediador')
                .setDescription('O mediador que você deseja adicionar na fila')
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

        // Verifica se o membro existe no servidor
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        
        if (!member) {
            return interaction.editReply({
                content: `${emojis.failuser_emoji || '❌'} Não foi possível encontrar este membro no servidor!`
            });
        }

        // Verifica se o usuário tem cargo de mediador
        const cargosPermitidos = loadJson(cargosPath, []);
        
        if (cargosPermitidos.length === 0) {
            return interaction.editReply({
                content: `${emojis.failuser_emoji || '❌'} Nenhum cargo de mediador foi configurado ainda!`
            });
        }

        const temCargo = member.roles.cache.some(role => cargosPermitidos.includes(role.id));
        
        if (!temCargo) {
            return interaction.editReply({
                content: `${emojis.failuser_emoji || '❌'} <@${userId}> não possui um cargo de mediador válido!`
            });
        }

        // Carrega a fila atual
        let fila = loadJson(filaPath, []);

        // Verifica se o mediador já está na fila
        if (fila.includes(userId)) {
            return interaction.editReply({
                content: `${emojis.failuser_emoji || '❌'} <@${userId}> já está na fila de mediadores!`
            });
        }

        // Adiciona o mediador na fila
        fila.push(userId);
        saveJson(filaPath, fila);

        // Registra no histórico e atualiza estatísticas
        registrarAcao(interaction.user, 'adicionou_mediador', { 
            mediadorAdicionado: userId,
            posicao: fila.length 
        });
        atualizarEstatisticas(userId, 'entrou');

        // Cria embed de confirmação
        const embed = new EmbedBuilder()
            .setTitle(`${emojis.member_add_emoji || '➕'} Mediador Adicionado`)
            .setDescription(
                `<@${userId}> foi adicionado na fila de mediadores por <@${interaction.user.id}>`
            )
            .addFields(
                { name: '📍 Posição na Fila', value: `\`${fila.length}º\``, inline: true },
                { name: '👥 Total de Mediadores', value: `\`${fila.length}\``, inline: true }
            )
            .setColor(0x2ecc71)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        console.log(`[COMANDO] ${interaction.user.tag} adicionou ${mediadorAlvo.tag} na fila`);
    },
};