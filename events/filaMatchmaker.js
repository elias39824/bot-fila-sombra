const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// --- Caminhos do DB ---
const filasPath = path.join(__dirname, '../DataBaseJson/filas1v1.json'); 
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json'); // Caminho crucial

// --- FUNÇÕES DE GERENCIAMENTO DE ARQUIVOS ---

function getFilasPath(tipoFila) {
  if (tipoFila === 'normal') return path.join(__dirname, '../DataBaseJson/filasNormal.json');
  if (tipoFila === 'misto') return path.join(__dirname, '../DataBaseJson/filasMisto.json');
  return path.join(__dirname, '../DataBaseJson/filas1v1.json');
}

function getFilasDB(tipoFila = '1v1') {
  const filePath = getFilasPath(tipoFila);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}), 'utf-8');
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function saveFilasDB(db, tipoFila = '1v1') {
  const filePath = getFilasPath(tipoFila);
  fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
}

/**
 * SALVAMENTO CRÍTICO: Salva os dados da partida usando o ID do Tópico como chave.
 * @param {string} matchKey - O ID do Tópico/Thread.
 * @param {object} dados - Dados da partida (jogadores, valor, modo, etc.).
 */
function saveFilaDados(matchKey, dados) {
  let db = {};
  if (fs.existsSync(filasDadosPath)) {
    try {
      db = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
    } catch (e) {
      console.error("Erro ao ler filasDados.json para salvamento:", e);
    }
  }
  db[matchKey] = dados;
  fs.writeFileSync(filasDadosPath, JSON.stringify(db, null, 2), 'utf-8');
  console.log('[DEBUG] MatchMaker: Dados da partida salvos com a chave (Tópico ID):', matchKey);
}

// --- FUNÇÃO PRINCIPAL ---

// Alteração: jogadoresMatch agora é o terceiro parâmetro, mantendo a ordem.
// O parâmetro tipo é o formato (2x2, 3x3, etc.)
async function tentarParear(interaction, valor, modo, formato, filaEmbedMsg, tipoFila = '1v1', jogadoresPassados = null) {
  let filasDB = getFilasDB(tipoFila);
  const todosJogadoresDaFila = filasDB[valor] || []; // Usar || [] para segurança
  
  let jogadoresMatch = [];
  let jogadoresARemover = [];

  // 1. LÓGICA DE PAREAMENTO E CONTROLE DE JOGADORES
  if (tipoFila === '1v1') {
    // Lógica 1v1
    const tipo = formato; // O parâmetro que você chamou de 'tipo' antes, é o formato em 1v1
    jogadoresMatch = todosJogadoresDaFila.filter(j => j.tipo === tipo).slice(0, 2);
    jogadoresARemover = jogadoresMatch;
    if (jogadoresMatch.length < 2) return;
    
  } else if (tipoFila === 'misto') {
    // 🚨 CORREÇÃO: Usa os jogadores que já vieram pareados (os 2 pagantes)
    if (jogadoresPassados && jogadoresPassados.length === 2) {
        jogadoresMatch = jogadoresPassados;
        // Marca para remoção os jogadores do DB original, mas como você já limpou o DB no handler anterior, 
        // A lista de remoção é apenas para a lógica, mas não será usada para filtrar a fila
        jogadoresARemover = jogadoresPassados; 
    } else {
        // Se, por alguma razão, não vieram 2 jogadores, não pareia.
        return; 
    }

  } else if (tipoFila === 'normal') {
    // Lógica Normal
    jogadoresMatch = todosJogadoresDaFila.slice(0, 2);
    jogadoresARemover = jogadoresMatch;
    if (jogadoresMatch.length < 2) return;
  }
  
  // Se o pareamento foi bem-sucedido (e para 'misto' sempre será 2 aqui):
  
  // 2. REMOÇÃO DE JOGADORES DA FILA (Apenas para 1v1 e Normal, misto já foi limpo)
  if (tipoFila !== 'misto') {
      filasDB[valor] = todosJogadoresDaFila.filter(j => !jogadoresARemover.some(jm => jm.id === j.id));
      saveFilasDB(filasDB, tipoFila);
  }
  

  // 3. EXTRAÇÃO E ATUALIZAÇÃO DA EMBED DA FILA
  let valorReal = valor;
  const canal = filaEmbedMsg.channel; 
  if (!canal || canal.type !== ChannelType.GuildText) {
      console.error(`[Matchmaker] Canal da mensagem da fila não é um canal de texto válido ou não encontrado.`);
      return; 
  }

  // Extrai o valor da Embed para exibição (se necessário)
  if (filaEmbedMsg.embeds && filaEmbedMsg.embeds[0]) {
    const valorField = filaEmbedMsg.embeds[0].fields?.find(f => f.name.toLowerCase().includes('valor'));
    if (valorField) {
      const matchValor = valorField.value.match(/([0-9]+,[0-9]+)/); 
      if (matchValor) valorReal = matchValor[1];
    }
  }

  // AQUI DEVE ESTAR A LÓGICA CORRETA PARA ATUALIZAR A EMBED, MESMO APÓS O MATCH
  // Recarrega o DB da fila para mostrar o estado ATUAL da fila (vazia ou com novos jogadores)
  let filasDBAtualizada = getFilasDB(tipoFila);
  let jogadoresRestantes = filasDBAtualizada[valor] || [];

  let jogadoresStr = jogadoresRestantes.length > 0
    ? jogadoresRestantes.map(j => {
        const info = j.tipo || j.time?.replace('emu_', '') + ' emu' || '';
        return `<@${j.id}> | ${info}`;
    }).join('\n')
    : 'Nenhum jogador na fila.';

  const embedOriginal = filaEmbedMsg.embeds[0];
  const newEmbed = EmbedBuilder.from(embedOriginal)
    .setFields([
      { name: `${emojis.command_emoji || '📜'} MODO`, value: modo, inline: false },
      { name: `${emojis._money_emoji || '💰'} VALOR`, value: `R$ ${valorReal}`, inline: false },
      // O campo "Formato" deve usar o parâmetro 'formato' que é a dimensão (2x2)
      ...(tipoFila !== '1v1' ? [{ name: 'Formato', value: formato, inline: false }] : []), 
      { name: `${emojis._people_emoji || '👥'} JOGADORES`, value: jogadoresStr, inline: false }
    ]);
  await filaEmbedMsg.edit({ embeds: [newEmbed] }).catch(e => console.error("Falha ao editar embed da fila:", e.message));

  // 4. CRIAÇÃO DO TÓPICO DE CONFIRMAÇÃO E SALVAMENTO NO DB
  let topicName = `fila ${modo} ${formato} ${valorReal}`; // Usando 'formato' (2x2)
  let tipoPartida = `${tipoFila} ${formato}`; 
  
  try {
    // Permissão para criar Tópicos/Threads é ChannelType.GuildText
    const topic = await canal.threads.create({ 
      name: topicName,
      type: ChannelType.PrivateThread, // Threads privadas
      reason: `Match de fila ${tipoPartida}`,
      invitable: false, 
      autoArchiveDuration: 60 
    });

    // 📌 PASSO CRÍTICO: SALVA OS DADOS DA PARTIDA USANDO O ID DO TÓPICO!
    saveFilaDados(topic.id, {
        jogadores: jogadoresMatch, 
        valor: valor,              
        modo: modo,                
        formato: formato,          // Usando o formato (2x2, 3x3...)
        canalId: canal.id,
        status: 'match'
    });

    // Adiciona os jogadores (os 2 pagantes) ao tópico
    for (const jogador of jogadoresMatch) {
      await topic.members.add(jogador.id).catch(e => console.error(`[Matchmaker] Falha ao adicionar jogador ${jogador.id} ao tópico:`, e));
    }

    // Embed de Match
    const listaJogadoresEmbed = jogadoresMatch.map(j => {
        const infoExtra = j.time ? ` | ${j.time.replace('emu_', '')} emu` : '';
        return `<@${j.id}>${infoExtra}`;
    }).join('\n');
    
    const matchEmbed = new EmbedBuilder()
      .setTitle(`${emojis._star_emoji || '⭐'} Match Encontrado!`)
      .setDescription(
        `Jogadores:\n${listaJogadoresEmbed}\n\nModo: **${modo}**\nValor: **R$ ${valorReal}**\nFormato: **${formato}**`
      )
      .setThumbnail(interaction.guild.iconURL() || null)
      .setColor(0x2ecc71);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('match_confirmar')
        .setLabel('Confirmar')
        .setStyle(ButtonStyle.Success)
        .setEmoji(emojis.confirmed_emoji || '✅'),
      new ButtonBuilder()
        .setCustomId('match_recusar')
        .setLabel('Recusar')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis.failuser_emoji || '❌')
    );

    await topic.send({ content: jogadoresMatch.map(j => `<@${j.id}>`).join(' '), embeds: [matchEmbed], components: [row] });
    
  } catch (err) {
    console.error(`[Matchmaker] Erro fatal ao criar tópico:`, err);
  }
}

module.exports = { tentarParear };
