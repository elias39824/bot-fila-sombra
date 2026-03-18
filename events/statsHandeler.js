const fs = require('fs');
const path = require('path');

// 🔥 CAMINHO CORRETO - Mudado para usersinfo.json (onde os outros códigos salvam)
const statsPath = path.join(__dirname, '../DataBaseJson/usersinfo.json'); 

/**
 * Lê e retorna todas as estatísticas dos usuários.
 * @returns {object} O objeto de estatísticas.
 */
function getStats() {
    if (!fs.existsSync(statsPath)) {
        // Cria o arquivo se ele não existir
        fs.writeFileSync(statsPath, JSON.stringify({}), 'utf8');
        console.log('[STATS] 📁 Arquivo usersinfo.json criado');
        return {};
    }
    try {
        const data = fs.readFileSync(statsPath, 'utf8');
        const stats = JSON.parse(data);
        console.log('[STATS] ✅ Dados carregados com sucesso');
        return stats && typeof stats === 'object' ? stats : {};
    } catch (e) {
        console.error("[STATS] ❌ Erro ao ler/parsear usersinfo.json:", e);
        return {};
    }
}

/**
 * Salva o objeto de estatísticas no arquivo JSON.
 * @param {object} stats O objeto de estatísticas a ser salvo.
 */
function saveStats(stats) {
    try {
        fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8');
        console.log('[STATS] 💾 Estatísticas salvas com sucesso');
    } catch (e) {
        console.error("[STATS] ❌ Erro ao salvar usersinfo.json:", e);
    }
}

/**
 * Obtém as estatísticas de um usuário específico, ou um objeto base.
 * @param {string} userId O ID do usuário.
 * @returns {object} As estatísticas do usuário.
 */
function getStatsForUser(userId) {
    const stats = getStats();
    
    // 🔥 RETORNA OS DADOS DO USUÁRIO OU OBJETO BASE
    const userStats = stats[userId] || {
        id: userId,
        partidas: 0,
        vitorias: 0,
        derrotas: 0,
        pontos: 0,
        consecutivas: 0
    };
    
    console.log(`[STATS] 📊 Estatísticas de ${userId}:`, userStats);
    
    return userStats;
}

module.exports = { getStats, saveStats, getStatsForUser };