const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// --- CAMINHOS (Mantendo consistência com o código anterior) ---
const filaPath = path.join(__dirname, '../DataBaseJson/mediadores.json');
const cargosPath = path.join(__dirname, '../DataBaseJson/mediador.json'); // Cargo de permissão
const historicoPath = path.join(__dirname, '../DataBaseJson/historicoMediadores.json');
const estatisticasPath = path.join(__dirname, '../DataBaseJson/estatisticasMediadores.json');

// --- FUNÇÕES AUXILIARES (COPIADAS PARA FUNCIONAR INDEPENDENTE) ---

function loadJson(filePath, defaultValue = []) {
    if (!fs.existsSync(filePath)) return defaultValue;
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(data);
        return json === null || json === undefined ? defaultValue : json;
    } catch (e) {
        return defaultValue;
    }
}

function saveJson(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error('[ERROR] Falha ao salvar JSON:', e.message);
    }
}

function atualizarEstatisticas(userId, acao) {
    try {
        let stats = loadJson(estatisticasPath, {});
        if (!stats[userId]) {
            stats[userId] = { entradas: 0, saidas: 0, tempoTotal: 0, ultimaEntrada: null, ultimaSaida: null };
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
    } catch (e) { console.error('[ERROR] Falha ao atualizar stats:', e); }
}

async function checkPermission(member, cargosPermitidos) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (cargosPermitidos.some(roleId => member.roles.cache.has(roleId))) return true;
    return false;
}

// --- 1. COMANDO /REMOVER_MEDIADOR ---

module.exports.remover_mediador = {
    data: new SlashCommandBuilder()
        .setName('remover_mediador')
        .setDescription('Remove um usuário específico da fila de mediadores.')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('O usuário que deseja remover da fila.')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Opcional: Requer Admin para ver o comando na lista

    async execute(interaction) {
        const member = interaction.member;
        const targetUser = interaction.options.getUser('usuario');
        const targetId = targetUser.id;
        const cargosPermitidos = loadJson(cargosPath, []);

        // Verificação de Permissão
        if (!await checkPermission(member, cargosPermitidos)) {
            return interaction.reply({ content: `${emojis.failuser_emoji || '❌'} Você não tem permissão para usar este comando.`, ephemeral: true });
        }

        let fila = loadJson(filaPath, []);

        if (!fila.includes(targetId)) {
            return interaction.reply({ content: `${emojis.failuser_emoji || '❌'} Este usuário não está na fila de mediadores.`, ephemeral: true });
        }

        // Remove da fila
        fila = fila.filter(id => id !== targetId);
        saveJson(filaPath, fila);

        // Atualiza estatísticas (conta como saída)
        atualizarEstatisticas(targetId, 'saiu');

        await interaction.reply({
            content: `${emojis.confirmed_emoji || '✅'} O usuário <@${targetId}> foi removido da fila de mediadores por <@${member.id}>.`,
            ephemeral: true
        });
        
        // Aqui você pode chamar sua função de atualizar embed se estiver no mesmo escopo
        // Ex: updateFilaEmbed(interaction, fila);
    }
};

// --- 2. COMANDO /COLOCAR_MEDIADOR ---

module.exports.colocar_mediador = {
    data: new SlashCommandBuilder()
        .setName('colocar_mediador')
        .setDescription('Adiciona um usuário na fila de mediadores (forçadamente).')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('O usuário que deseja adicionar na fila.')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const member = interaction.member;
        const targetUser = interaction.options.getUser('usuario');
        const targetId = targetUser.id;
        const cargosPermitidos = loadJson(cargosPath, []);

        // Verificação de Permissão
        if (!await checkPermission(member, cargosPermitidos)) {
            return interaction.reply({ content: `${emojis.failuser_emoji || '❌'} Você não tem permissão para usar este comando.`, ephemeral: true });
        }

        let fila = loadJson(filaPath, []);

        if (fila.includes(targetId)) {
            return interaction.reply({ content: `${emojis.failuser_emoji || '❌'} Este usuário já está na fila de mediadores.`, ephemeral: true });
        }

        // Adiciona na fila
        fila.push(targetId);
        saveJson(filaPath, fila);

        // OBS: Se quiser contar como entrada nas estatísticas, descomente a linha abaixo:
        // atualizarEstatisticas(targetId, 'entrou');

        await interaction.reply({
            content: `${emojis.confirmed_emoji || '✅'} O usuário <@${targetId}> foi adicionado à fila de mediadores por <@${member.id}>.`,
            ephemeral: true
        });
    }
};

// --- 3. COMANDO /REMOVER_TODOS_MEDIADORES ---

module.exports.remover_todos_mediadores = {
    data: new SlashCommandBuilder()
        .setName('remover_todos_mediadores')
        .setDescription('Remove TODOS os usuários da fila de mediadores.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const member = interaction.member;
        const cargosPermitidos = loadJson(cargosPath, []);

        // Verificação de Permissão
        if (!await checkPermission(member, cargosPermitidos)) {
            return interaction.reply({ content: `${emojis.failuser_emoji || '❌'} Você não tem permissão para usar este comando.`, ephemeral: true });
        }

        let fila = loadJson(filaPath, []);
        const quantidade = fila.length;

        if (quantidade === 0) {
            return interaction.reply({ content: `${emojis.failuser_emoji || '❌'} A fila de mediadores já está vazia.`, ephemeral: true });
        }

        // Salva um backup antes de limpar (recomendado)
        // criarBackupFila(fila, 'limpeza_total');

        // Atualiza estatísticas de todos antes de limpar (opcional, mas bom para manter dados)
        fila.forEach(id => atualizarEstatisticas(id, 'saiu'));

        // Limpa a fila
        fila = [];
        saveJson(filaPath, fila);

        await interaction.reply({
            content: `${emojis.confirmed_emoji || '✅'} Todos os mediadores (${quantidade}) foram removidos da fila por <@${member.id}>.`,
            ephemeral: true
        });
    }
};