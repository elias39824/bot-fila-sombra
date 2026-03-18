const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// --- CAMINHOS DOS ARQUIVOS ---
const configPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');
const configHistoryPath = path.join(__dirname, '../DataBaseJson/configHistory.json');
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const historicoPath = path.join(__dirname, '../DataBaseJson/historicoPartidas.json');
const backupDir = path.join(__dirname, '../Backups');

// --- SISTEMA DE COOLDOWN (Matchmaking) ---
const cooldowns = new Map();

// --- SISTEMA DE CACHE (Configurações) ---
let configCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 segundos

// --- SISTEMA DE PERMISSÕES ---
function verificarPermissao(interaction) {
  const config = getConfig();
  const member = interaction.member;
  
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return { temPermissao: true };
  }
  
  if (config.administrador && member.roles.cache.has(config.administrador)) {
    return { temPermissao: true };
  }
  
  return { 
    temPermissao: false, 
    mensagem: `${emojis.failuser_emoji || '❌'} Você não tem permissão para alterar as configurações do bot.` 
  };
}

// --- SCHEMA DE VALIDAÇÃO ---
const CONFIG_SCHEMA = {
  administrador: { 
    type: 'string', 
    pattern: /^\d{17,19}$/, 
    description: 'ID do cargo (17-19 dígitos)',
    exemplo: '1234567890123456789'
  },
  suporte: { 
    type: 'string', 
    pattern: /^\d{17,19}$/, 
    description: 'ID do cargo (17-19 dígitos)',
    exemplo: '1234567890123456789'
  },
  logs: { 
    type: 'string', 
    pattern: /^\d{17,19}$/, 
    description: 'ID do canal (17-19 dígitos)',
    exemplo: '1234567890123456789'
  }
};

// --- FUNÇÕES DE CONFIGURAÇÃO ---

function getConfig() {
  const agora = Date.now();
  if (configCache && (agora - cacheTimestamp) < CACHE_DURATION) {
    return { ...configCache };
  }
  
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    configCache = config && typeof config === 'object' ? config : {};
    cacheTimestamp = agora;
    return { ...configCache };
  } catch (e) {
    if (e.code === 'ENOENT') {
      const defaultConfig = {};
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      configCache = defaultConfig;
      cacheTimestamp = agora;
      return defaultConfig;
    }
    console.error('[ERROR] Erro ao ler configuracoes.json:', e);
    return {};
  }
}

function saveConfig(config) {
  try {
    criarBackupConfig();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    configCache = null;
    cacheTimestamp = 0;
    console.log('[SUCCESS] Configurações salvas com sucesso.');
    return true;
  } catch (e) {
    console.error('[ERROR] Erro ao salvar configurações:', e);
    return false;
  }
}

function validarConfiguracao(field, value) {
  const schema = CONFIG_SCHEMA[field];
  if (!schema) return { valido: true, valor: value };
  
  if (schema.type === 'string') {
    if (schema.pattern && !schema.pattern.test(value)) {
      return { valido: false, erro: `Formato inválido. ${schema.description}. Exemplo: ${schema.exemplo}` };
    }
    return { valido: true, valor: value };
  }
  
  return { valido: true, valor: value };
}

function criarBackupConfig() {
  try {
    const backupDirConfig = path.join(backupDir, 'Config');
    if (!fs.existsSync(backupDirConfig)) fs.mkdirSync(backupDirConfig, { recursive: true });
    if (!fs.existsSync(configPath)) return;
    
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupPath = path.join(backupDirConfig, `config_${timestamp}.json`);
    fs.copyFileSync(configPath, backupPath);
    console.log(`[BACKUP] Configuração salva em: ${backupPath}`);
  } catch (e) {
    console.error('[ERROR] Falha ao criar backup config:', e);
  }
}

function registrarAlteracao(usuario, campo, valorAntigo, valorNovo) {
  try {
    let historico = fs.existsSync(configHistoryPath) ? JSON.parse(fs.readFileSync(configHistoryPath, 'utf-8')) : [];
    historico.push({
      timestamp: new Date().toISOString(),
      usuario: { id: usuario.id, tag: usuario.tag, nome: usuario.username },
      campo: campo, valorAntigo: valorAntigo, valorNovo: valorNovo
    });
    if (historico.length > 500) historico = historico.slice(-500);
    fs.writeFileSync(configHistoryPath, JSON.stringify(historico, null, 2));
  } catch (e) { console.error('[ERROR] Falha ao registrar histórico:', e); }
}

async function enviarLogConfiguracao(interaction, campo, valorAntigo, valorNovo) {
  try {
    const config = getConfig();
    if (!config.logs) return;
    const canalLogs = await interaction.guild.channels.fetch(config.logs).catch(() => null);
    if (!canalLogs) return;
    
    await canalLogs.send({ embeds: [new EmbedBuilder()
      .setTitle(`${emojis._settings_emoji || '⚙️'} Configuração Alterada`)
      .addFields(
        { name: '👤 Usuário', value: `<@${interaction.user.id}>`, inline: true },
        { name: '⚙️ Campo', value: `\`${campo}\``, inline: true },
        { name: '📥 Novo Valor', value: `\`${valorNovo}\``, inline: true }
      )
      .setColor(0x3498db)
    ]});
  } catch (e) { console.error('[ERROR] Falha ao enviar log:', e); }
}

// --- FUNÇÕES DE MATCHMAKING ---

function getFilasPath(tipoFila) {
  if (tipoFila === 'normal') return path.join(__dirname, '../DataBaseJson/filasNormal.json');
  if (tipoFila === 'misto') return path.join(__dirname, '../DataBaseJson/filasMisto.json');
  return path.join(__dirname, '../DataBaseJson/filas1v1.json');
}

function getFilasDB(tipoFila = '1v1') {
  const filePath = getFilasPath(tipoFila);
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify({}), 'utf-8');
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } 
  catch (e) { console.error(`[ERROR] Falha ao ler ${filePath}:`, e); return {}; }
}

function saveFilasDB(db, tipoFila = '1v1') {
  const filePath = getFilasPath(tipoFila);
  try { fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8'); } 
  catch (e) { console.error(`[ERROR] Falha ao salvar ${filePath}:`, e); }
}

function saveFilaDados(matchKey, dados) {
  let db = {};
  if (fs.existsSync(filasDadosPath)) {
    try { db = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8')); } 
    catch (e) { console.error("[ERROR] Erro ao ler filasDados.json:", e); }
  }
  db[matchKey] = { ...dados, criadoEm: new Date().toISOString() };
  fs.writeFileSync(filasDadosPath, JSON.stringify(db, null, 2));
}

function criarBackup(tipoFila) {
  try {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const filePath = getFilasPath(tipoFila);
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const backupPath = path.join(backupDir, `filas_${tipoFila}_${timestamp}.json`);
    if (fs.existsSync(filePath)) fs.copyFileSync(filePath, backupPath);
    console.log(`[BACKUP] Criado: ${backupPath}`);
  } catch (e) { console.error('[ERROR] Falha ao criar backup:', e); }
}

function logPartida(matchKey, dados, status) {
  try {
    let historico = fs.existsSync(historicoPath) ? JSON.parse(fs.readFileSync(historicoPath, 'utf-8')) : [];
    historico.push({
      matchId: matchKey, timestamp: new Date().toISOString(),
      jogadores: dados.jogadores.map(j => j.id), valor: dados.valor,
      modo: dados.modo, formato: dados.formato, tipoFila: dados.tipoFila || '1v1', status: status
    });
    if (historico.length > 1000) historico = historico.slice(-1000);
    fs.writeFileSync(historicoPath, JSON.stringify(historico, null, 2));
  } catch (e) { console.error('[ERROR] Falha ao registrar histórico:', e); }
}

function validarJogadores(jogadores) {
  if (!Array.isArray(jogadores) || jogadores.length === 0) throw new Error('Lista de jogadores inválida');
  for (const j of jogadores) if (!j.id || typeof j.id !== 'string') throw new Error(`Jogador inválido`);
  const ids = jogadores.map(j => j.id);
  if (new Set(ids).size !== ids.length) throw new Error('Jogadores duplicados');
  return true;
}

function calcularEloMedio(jogadores) {
  const elos = jogadores.map(j => j.elo || 1000);
  return Math.round(elos.reduce((a, b) => a + b, 0) / elos.length);
}

function ordenarFilaPorPrioridade(fila) {
  return fila.sort((a, b) => {
    if (a.vip && !b.vip) return -1; if (!a.vip && b.vip) return 1;
    const tempoA = a.entradaFila || Date.now(), tempoB = b.entradaFila || Date.now();
    if (tempoA !== tempoB) return tempoA - tempoB;
    return (b.elo || 1000) - (a.elo || 1000);
  });
}

function encontrarMatchBalanceado(fila, diferencaMaxima = 200) {
  if (fila.length < 2) return null;
  const filaOrdenada = ordenarFilaPorPrioridade([...fila]);
  for (let i = 0; i < filaOrdenada.length - 1; i++) {
    for (let j = i + 1; j < filaOrdenada.length; j++) {
      if (Math.abs((filaOrdenada[i].elo || 1000) - (filaOrdenada[j].elo || 1000)) <= diferencaMaxima) {
        return [filaOrdenada[i], filaOrdenada[j]];
      }
    }
  }
  return filaOrdenada.slice(0, 2);
}

function gerarEstatisticas(filasDB) {
  const stats = { totalJogadores: 0, filasPorValor: {}, tempoMedioEspera: 0, maiorFila: { valor: null, count: 0 } };
  for (const [valor, jogadores] of Object.entries(filasDB)) {
    const count = jogadores.length;
    stats.totalJogadores += count;
    stats.filasPorValor[valor] = count;
    if (count > stats.maiorFila.count) stats.maiorFila = { valor, count };
  }
  return stats;
}

function criarEmbedFila(dados, jogadoresRestantes, capacidade = 2) {
  const progresso = '█'.repeat(Math.min(jogadoresRestantes, capacidade)) + '░'.repeat(Math.max(0, capacidade - jogadoresRestantes));
  const cor = jogadoresRestantes === 0 ? 0x95a5a6 : jogadoresRestantes === capacidade ? 0x00ff00 : 0xffa500;
  let jogadoresStr = jogadoresRestantes > 0 ? dados.jogadores.map(j => {
    const info = j.tipo || (j.time ? j.time.replace('emu_', '') + ' emu' : '');
    const vipBadge = j.vip ? '⭐' : '';
    const eloBadge = j.elo ? ` [${j.elo}]` : '';
    return `${vipBadge}<@${j.id}> | ${info}${eloBadge}`;
  }).join('\n') : 'Nenhum jogador na fila.';

  return new EmbedBuilder()
    .setTitle(`${emojis._star_emoji || '⭐'} Fila de Matchmaking`)
    .setDescription(`**Progresso:** ${jogadoresRestantes}/${capacidade}\n${progresso}\n`)
    .addFields(
      { name: `${emojis.command_emoji || '📜'} MODO`, value: dados.modo, inline: true },
      { name: `${emojis._money_emoji || '💰'} VALOR`, value: `R$ ${dados.valor}`, inline: true },
      { name: '⏱️ Tempo Médio', value: '~2 min', inline: true },
      ...(dados.formato ? [{ name: '📐 Formato', value: dados.formato, inline: false }] : []),
      { name: `${emojis._people_emoji || '👥'} JOGADORES`, value: jogadoresStr, inline: false }
    )
    .setColor(cor).setTimestamp().setFooter({ text: 'Sistema de Matchmaking' });
}

function criarEmbedMatch(jogadores, dados, valorReal) {
  const listaJogadoresEmbed = jogadores.map(j => {
    const infoExtra = j.time ? ` | ${j.time.replace('emu_', '')} emu` : '';
    const eloBadge = j.elo ? ` [ELO: ${j.elo}]` : '';
    return `<@${j.id}>${infoExtra}${eloBadge}`;
  }).join('\n');
  
  return new EmbedBuilder()
    .setTitle(`${emojis._star_emoji || '⭐'} MATCH ENCONTRADO!`)
    .setDescription(`🎮 **Uma partida foi formada!**\n\n⏰ Você tem **60 segundos** para confirmar.\n\n**Jogadores:**\n${listaJogadoresEmbed}\n`)
    .addFields(
      { name: `${emojis.command_emoji || '📜'} Modo`, value: dados.modo, inline: true },
      { name: `${emojis._money_emoji || '💰'} Valor`, value: `R$ ${valorReal}`, inline: true },
      { name: '📐 Formato', value: dados.formato, inline: true },
      { name: '🎯 ELO Médio', value: `${calcularEloMedio(jogadores)}`, inline: true },
      { name: '⏱️ Status', value: '🟢 Aguardando Confirmação', inline: true }
    )
    .setColor(0x00ff00).setTimestamp().setFooter({ text: 'Boa sorte! 🍀' });
}

async function iniciarTimeoutMatch(topic, jogadores, matchKey, dados) {
  const tempoEsperaMs = 60000; // 60 segundos fixo

  const confirmacoesTimeout = setTimeout(async () => {
    try {
      const filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
      const dadosMatch = filasDados[matchKey];
      
      if (!dadosMatch || dadosMatch.status !== 'confirmado') {
        await topic.send({
          content: `${jogadores.map(j => `<@${j.id}>`).join(' ')}`,
          embeds: [new EmbedBuilder()
            .setTitle(`${emojis.failuser_emoji || '❌'} Tempo Esgotado!`)
            .setDescription(`O match foi cancelado por falta de confirmação em 60 segundos.`)
            .setColor(0xff0000).setTimestamp()]
        });
        logPartida(matchKey, dados, 'timeout');
        delete filasDados[matchKey];
        fs.writeFileSync(filasDadosPath, JSON.stringify(filasDados, null, 2));
        await topic.setArchived(true).catch(e => console.error('[ERROR] Falha ao arquivar thread:', e));
      }
    } catch (e) { console.error('[ERROR] Erro no timeout do match:', e); }
  }, tempoEsperaMs);
  
  return confirmacoesTimeout;
}

async function tentarParear(interaction, valor, modo, formato, filaEmbedMsg, tipoFila = '1v1', jogadoresPassados = null) {
  try {
    criarBackup(tipoFila);
    let filasDB = getFilasDB(tipoFila);
    const todosJogadoresDaFila = filasDB[valor] || [];
    let jogadoresMatch = [], jogadoresARemover = [];

    if (tipoFila === '1v1') {
      const jogadoresFiltrados = todosJogadoresDaFila.filter(j => j.tipo === formato);
      jogadoresMatch = encontrarMatchBalanceado(jogadoresFiltrados, 200) || jogadoresFiltrados.slice(0, 2);
      jogadoresARemover = jogadoresMatch;
      if (jogadoresMatch.length < 2) return;
    } else if (tipoFila === 'misto') {
      if (jogadoresPassados && jogadoresPassados.length === 2) { jogadoresMatch = jogadoresPassados; jogadoresARemover = jogadoresPassados; } 
      else return;
    } else if (tipoFila === 'normal') {
      jogadoresMatch = encontrarMatchBalanceado(todosJogadoresDaFila, 200) || todosJogadoresDaFila.slice(0, 2);
      jogadoresARemover = jogadoresMatch;
      if (jogadoresMatch.length < 2) return;
    }
    
    validarJogadores(jogadoresMatch);
    if (tipoFila !== 'misto') {
      filasDB[valor] = todosJogadoresDaFila.filter(j => !jogadoresARemover.some(jm => jm.id === j.id));
      saveFilasDB(filasDB, tipoFila);
    }

    let valorReal = valor;
    const canal = filaEmbedMsg.channel;
    if (!canal || canal.type !== ChannelType.GuildText) return;

    if (filaEmbedMsg.embeds && filaEmbedMsg.embeds[0]) {
      const valorField = filaEmbedMsg.embeds[0].fields?.find(f => f.name.toLowerCase().includes('valor'));
      if (valorField) {
        const matchValor = valorField.value.match(/([0-9]+,[0-9]+)/);
        if (matchValor) valorReal = matchValor[1];
      }
    }

    let filasDBAtualizada = getFilasDB(tipoFila);
    let jogadoresRestantes = filasDBAtualizada[valor] || [];
    const embedAtualizada = criarEmbedFila({ modo: modo, valor: valorReal, formato: formato, jogadores: jogadoresRestantes }, jogadoresRestantes.length, 2);
    await filaEmbedMsg.edit({ embeds: [embedAtualizada] }).catch(e => console.error("[ERROR] Falha ao editar embed:", e));

    const topicName = `${emojis._star_emoji || '⭐'} ${modo} ${formato} R$${valorReal}`;
    const topic = await canal.threads.create({
      name: topicName, type: ChannelType.PrivateThread,
      reason: `Match ${tipoFila} ${formato}`, invitable: false, autoArchiveDuration: 60
    });

    const dadosPartida = { jogadores: jogadoresMatch, valor: valor, modo: modo, formato: formato, canalId: canal.id, status: 'match', tipoFila: tipoFila, criadoEm: new Date().toISOString() };
    saveFilaDados(topic.id, dadosPartida);
    logPartida(topic.id, dadosPartida, 'criado');

    for (const jogador of jogadoresMatch) await topic.members.add(jogador.id).catch(e => console.error(`[ERROR] Falha ao adicionar ao tópico:`, e));

    const matchEmbed = criarEmbedMatch(jogadoresMatch, dadosPartida, valorReal);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('match_confirmar').setLabel('Confirmar').setStyle(ButtonStyle.Success).setEmoji(emojis.confirmed_emoji || '✅'),
      new ButtonBuilder().setCustomId('match_recusar').setLabel('Recusar').setStyle(ButtonStyle.Danger).setEmoji(emojis.failuser_emoji || '❌')
    );

    await topic.send({ content: jogadoresMatch.map(j => `<@${j.id}>`).join(' '), embeds: [matchEmbed], components: [row] });
    await iniciarTimeoutMatch(topic, jogadoresMatch, topic.id, dadosPartida);
    console.log(`[SUCCESS] Match criado! Thread ID: ${topic.id}`);
  } catch (err) {
    console.error(`[ERROR FATAL] Erro no matchmaker:`, err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.followUp({ content: `${emojis.failuser_emoji || '❌'} Ocorreu um erro ao criar a partida.`, ephemeral: true }).catch(() => {});
    }
  }
}

function verificarCooldown(userId, tempoMs = 5000) {
  const agora = Date.now();
  if (cooldowns.has(userId)) {
    const tempoRestante = cooldowns.get(userId) - agora;
    if (tempoRestante > 0) return { emCooldown: true, tempoRestante: Math.ceil(tempoRestante / 1000) };
  }
  cooldowns.set(userId, agora + tempoMs);
  return { emCooldown: false };
}

// --- HANDLER DE INTERAÇÃO (PAINEL & BOTÕES) ---

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    
    // --- PAINEL DE CONFIGURAÇÃO ---
    if (interaction.isButton() && interaction.customId === 'panel_config') {
      const permCheck = verificarPermissao(interaction);
      if (!permCheck.temPermissao) { await interaction.reply({ content: permCheck.mensagem, ephemeral: true }); return; }
      
      const config = getConfig();
      const statusEmoji = (valor) => valor ? '✅' : '⚠️';
      
      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle(`${emojis._settings_emoji || '⚙️'} Painel de Configurações`)
        .setDescription(`${emojis._diamond_emoji || '💎'} **Bem-vindo ao painel de configurações!**\n\nAqui você pode gerenciar as configurações básicas do bot.\nUse o menu abaixo para modificar as opções.\n\n**Status Atual:**`)
        .addFields(
          { 
            name: '👑 Cargos & Canais', 
            value: 
              `${statusEmoji(config.administrador)} Administrador: ${config.administrador ? `<@&${config.administrador}>` : '`Não configurado`'}\n` +
              `${statusEmoji(config.suporte)} Suporte: ${config.suporte ? `<@&${config.suporte}>` : '`Não configurado`'}\n` +
              `${statusEmoji(config.logs)} Logs: ${config.logs ? `<#${config.logs}>` : '`Não configurado`'}`,
            inline: false 
          }
        )
        .setTimestamp().setFooter({ text: '💡 Selecione uma opção no menu abaixo' });

      const select = new StringSelectMenuBuilder()
        .setCustomId('config_select')
        .setPlaceholder('🔧 Selecione uma configuração para alterar')
        .addOptions([
          { label: '👑 Administrador', value: 'administrador', description: 'ID do cargo de administrador', emoji: '👑' },
          { label: '🛡️ Suporte', value: 'suporte', description: 'ID do cargo de suporte', emoji: '🛡️' },
          { label: '📋 Logs', value: 'logs', description: 'ID do canal de logs', emoji: '📋' },
          { label: '📜 Ver Histórico', value: 'ver_historico', description: 'Ver últimas alterações', emoji: '📜' },
          { label: '💾 Criar Backup', value: 'criar_backup', description: 'Fazer backup manual', emoji: '💾' }
        ]);
        
      await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'config_select') {
      const permCheck = verificarPermissao(interaction);
      if (!permCheck.temPermissao) { await interaction.reply({ content: permCheck.mensagem, ephemeral: true }); return; }
      
      const config = getConfig();
      const selected = interaction.values[0];
      
      if (selected === 'ver_historico') {
        let historico = fs.existsSync(configHistoryPath) ? JSON.parse(fs.readFileSync(configHistoryPath, 'utf-8')) : [];
        const ultimasAlteracoes = historico.slice(-10).reverse();
        if (ultimasAlteracoes.length === 0) { await interaction.reply({ content: `${emojis.failuser_emoji || '❌'} Nenhuma alteração registrada.`, ephemeral: true }); return; }
        
        const embed = new EmbedBuilder().setTitle(`${emojis._star_emoji || '📜'} Histórico de Alterações`).setDescription('Últimas 10 alterações:').setColor(0x3498db);
        ultimasAlteracoes.forEach((alt, index) => {
          const data = new Date(alt.timestamp).toLocaleString('pt-BR');
          embed.addFields({ name: `${index + 1}. ${alt.campo}`, value: `👤 **Por:** ${alt.usuario.tag}\n⏰ **Quando:** ${data}\n📥 **Para:** \`${alt.valorNovo}\``, inline: false });
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }
      
      if (selected === 'criar_backup') {
        criarBackupConfig();
        await interaction.reply({ content: `${emojis.confirmed_emoji || '✅'} Backup criado com sucesso!`, ephemeral: true });
        return;
      }
      
      // Handler para Configurações Simples (administrador, suporte, logs)
      const modal = new ModalBuilder().setCustomId(`modal_config_${selected}`).setTitle(`⚙️ Alterar ${selected.replace('_', ' ').toUpperCase()}`);
      const valorAtual = config[selected] !== undefined ? config[selected].toString() : '';
      
      const input = new TextInputBuilder()
        .setCustomId('config_value').setLabel(`Novo valor para ${selected}`).setStyle(TextInputStyle.Short).setRequired(true)
        .setPlaceholder(CONFIG_SCHEMA[selected]?.exemplo || 'Digite o novo valor').setValue(valorAtual);
        
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.isModalSubmit()) {
      const permCheck = verificarPermissao(interaction);
      if (!permCheck.temPermissao) { await interaction.reply({ content: permCheck.mensagem, ephemeral: true }); return; }
      
      const config = getConfig();
      
      // Handler para Modais Simples
      if (interaction.customId.startsWith('modal_config_')) {
        const field = interaction.customId.replace('modal_config_', '');
        const value = interaction.fields.getTextInputValue('config_value').trim();
        
        const validacao = validarConfiguracao(field, value);
        if (!validacao.valido) {
          await interaction.reply({ content: `${emojis.failuser_emoji || '❌'} ${validacao.erro}`, ephemeral: true });
          return;
        }
        
        const valorAntigo = config[field];
        config[field] = validacao.valor;
        
        if (saveConfig(config)) {
          registrarAlteracao(interaction.user, field, valorAntigo, validacao.valor);
          await enviarLogConfiguracao(interaction, field, valorAntigo, validacao.valor);
          
          let mensagemSucesso = `${emojis.confirmed_emoji || '✅'} **Configuração alterada!**\n\n`;
          if (field === 'administrador' || field === 'suporte') mensagemSucesso += `👑 **${field.charAt(0).toUpperCase() + field.slice(1)}:** <@&${validacao.valor}>`;
          else if (field === 'logs') mensagemSucesso += `📋 **Canal de Logs:** <#${validacao.valor}>`;
          else mensagemSucesso += `⚙️ **${field}:** \`${validacao.valor}\``;
          
          await interaction.reply({ content: mensagemSucesso, ephemeral: true });
        } else {
          await interaction.reply({ content: `${emojis.failuser_emoji || '❌'} Erro ao salvar.`, ephemeral: true });
        }
        return;
      }
    }
  },
  // Exportando funções auxiliares para uso em outros comandos
  tentarParear,
  verificarCooldown,
  criarBackup,
  gerarEstatisticas,
  validarJogadores,
  calcularEloMedio
};