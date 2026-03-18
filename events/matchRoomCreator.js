const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');
const emojis = require('../DataBaseJson/emojis.json');

const QR_CODE_API_URL = 'https://easyqrcode.app.br/api/generate-qrcode';

const PATHS = {
  categoria: path.join(__dirname, '../DataBaseJson/categoria.json'),
  mediadores: path.join(__dirname, '../DataBaseJson/mediadores.json'),
  pagamentos: path.join(__dirname, '../DataBaseJson/pagamentos.json'),
  filasDados: path.join(__dirname, '../DataBaseJson/filasDados.json'),
  config: path.join(__dirname, '../DataBaseJson/configuracoes.json'),
  logs: path.join(__dirname, '../DataBaseJson/logs'),
  configFilas: path.join(__dirname, '../DataBaseJson/configFilas.json'),
  controleRotacao: path.join(__dirname, '../DataBaseJson/controleRotacao.json')
};

if (!fsSync.existsSync(PATHS.logs)) {
  fsSync.mkdirSync(PATHS.logs, { recursive: true });
  console.log('[LOGS] 📁 Pasta de logs criada em:', PATHS.logs);
}

const DEFAULT_CONFIG = {
  SERVICE_FEE: 1.80,
  TIMEOUT_API: 15000,
  MAX_RETRIES: 3
};

// --- SISTEMA DE LOGS ---

class LogManager {
  constructor() {
    this.sessoes = new Map();
  }

  iniciarSessao(canalId, dadosPartida) {
    const sessao = {
      canalId,
      iniciado: Date.now(),
      status: 'ativa',
      eventos: [],
      participantes: new Set([
        dadosPartida.jogadores[0],
        dadosPartida.jogadores[1],
        dadosPartida.id_mediador
      ]),
      dadosPartida: {
        jogadores: dadosPartida.jogadores,
        id_mediador: dadosPartida.id_mediador,
        modo: dadosPartida.modo,
        tipo: dadosPartida.tipo,
        valor: dadosPartida.valor,
        time: dadosPartida.time || null
      }
    };

    this.sessoes.set(canalId, sessao);
    this.adicionarEvento(canalId, 'inicio', 'Partida iniciada', { dadosPartida });
    this.salvarLogSync(sessao);
    console.log(`[LOGS] ✅ Sessão iniciada e salva: ${canalId}`);
    return sessao;
  }

  adicionarEvento(canalId, tipo, descricao, dados = {}) {
    const sessao = this.sessoes.get(canalId);
    if (!sessao) {
      console.warn(`[LOGS] ⚠️ Sessão não encontrada: ${canalId}`);
      return;
    }

    const evento = {
      timestamp: Date.now(),
      tipo,
      descricao,
      dados
    };

    sessao.eventos.push(evento);

    if (dados.userId) {
      sessao.participantes.add(dados.userId);
    }
    if (dados.users) {
      dados.users.forEach(id => sessao.participantes.add(id));
    }

    this.salvarLogSync(sessao);
    console.log(`[LOGS] 📝 ${tipo}: ${descricao} (salvo)`);
  }

  registrarMensagem(canalId, message) {
    this.adicionarEvento(canalId, 'mensagem', 'Mensagem enviada', {
      userId: message.author.id,
      username: message.author.username,
      content: message.content,
      attachments: message.attachments.size,
      embeds: message.embeds.length
    });
  }

  registrarAcao(canalId, tipo, userId, detalhes = {}) {
    const descricoes = {
      'vencedor': 'Vencedor definido',
      'finalizar': 'Partida finalizada',
      'cancelar': 'Partida cancelada',
      'pagamento': 'Pagamento confirmado'
    };

    this.adicionarEvento(canalId, 'acao', descricoes[tipo] || tipo, {
      userId,
      tipo,
      ...detalhes
    });
  }

  async finalizarSessao(canalId, motivo = 'Encerrado') {
    const sessao = this.sessoes.get(canalId);
    if (!sessao) {
      console.warn(`[LOGS] ⚠️ Sessão não encontrada: ${canalId}`);
      return null;
    }

    sessao.finalizado = Date.now();
    sessao.status = 'encerrada';
    sessao.motivo = motivo;

    this.adicionarEvento(canalId, 'fim', `Sessão encerrada: ${motivo}`, {});
    await this.salvarLog(sessao);
    this.sessoes.delete(canalId);
    console.log(`[LOGS] ✅ Sessão finalizada: ${canalId}`);
    return true;
  }

  async marcarPendente(canalId) {
    const sessao = this.sessoes.get(canalId);
    if (!sessao) return null;

    sessao.status = 'pendente';
    this.adicionarEvento(canalId, 'status', 'Marcado como pendente', {});
    return await this.salvarLog(sessao);
  }

  salvarLogSync(sessao) {
    try {
      const data = new Date(sessao.iniciado);
      const dataStr = data.toISOString().split('T')[0];
      const nomeArquivo = `${dataStr}_${sessao.canalId}.json`;
      const caminhoArquivo = path.join(PATHS.logs, nomeArquivo);

      const dadosLog = {
        canalId: sessao.canalId,
        iniciado: sessao.iniciado,
        finalizado: sessao.finalizado || null,
        status: sessao.status,
        motivo: sessao.motivo || null,
        duracao: (sessao.finalizado || Date.now()) - sessao.iniciado,
        participantes: Array.from(sessao.participantes),
        dadosPartida: sessao.dadosPartida,
        eventos: sessao.eventos,
        totalEventos: sessao.eventos.length
      };

      fsSync.writeFileSync(caminhoArquivo, JSON.stringify(dadosLog, null, 2), 'utf-8');
      console.log(`[LOGS] 💾 Salvo: ${nomeArquivo} (${sessao.eventos.length} eventos)`);
      return caminhoArquivo;
    } catch (error) {
      console.error('[LOGS] ❌ Erro ao salvar:', error);
      return null;
    }
  }

  async salvarLog(sessao) {
    try {
      const data = new Date(sessao.iniciado);
      const dataStr = data.toISOString().split('T')[0];
      const nomeArquivo = `${dataStr}_${sessao.canalId}.json`;
      const caminhoArquivo = path.join(PATHS.logs, nomeArquivo);

      const dadosLog = {
        canalId: sessao.canalId,
        iniciado: sessao.iniciado,
        finalizado: sessao.finalizado || null,
        status: sessao.status,
        motivo: sessao.motivo || null,
        duracao: (sessao.finalizado || Date.now()) - sessao.iniciado,
        participantes: Array.from(sessao.participantes),
        dadosPartida: sessao.dadosPartida,
        eventos: sessao.eventos,
        totalEventos: sessao.eventos.length
      };

      await fs.writeFile(caminhoArquivo, JSON.stringify(dadosLog, null, 2), 'utf-8');
      console.log(`[LOGS] 💾 Salvo (async): ${nomeArquivo}`);
      return caminhoArquivo;
    } catch (error) {
      console.error('[LOGS] ❌ Erro ao salvar:', error);
      return null;
    }
  }
}

const logManager = new LogManager();

// --- FUNÇÕES AUXILIARES ---

async function loadJsonSafe(filePath, defaultValue = null) {
  try {
    if (!fsSync.existsSync(filePath)) {
      console.warn(`[AVISO] Arquivo não encontrado: ${filePath}`);
      return defaultValue;
    }
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`[ERRO] Falha ao ler ${filePath}:`, error.message);
    return defaultValue;
  }
}

async function saveJsonSafe(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`[ERRO] Falha ao salvar ${filePath}:`, error.message);
    return false;
  }
}

async function getCategoriaId() {
  const data = await loadJsonSafe(PATHS.categoria, []);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function getPagamentoInfo(mediadorId) {
  const data = await loadJsonSafe(PATHS.pagamentos, {});
  return data[mediadorId] || null;
}

async function getServiceFee() {
  const config = await loadJsonSafe(PATHS.config, {});
  const fee = parseFloat(config.taxa_servico);
  
  if (isNaN(fee) || fee < 0) {
    console.warn(`[AVISO] Taxa inválida. Usando padrão: R$ ${DEFAULT_CONFIG.SERVICE_FEE}`);
    return DEFAULT_CONFIG.SERVICE_FEE;
  }
  
  return fee;
}

function escolherMediadorPorHash(mediadores, idPartida) {
  if (!Array.isArray(mediadores) || mediadores.length === 0) {
    return null;
  }
  
  let hash = 0;
  for (let i = 0; i < idPartida.length; i++) {
    hash = ((hash << 5) - hash + idPartida.charCodeAt(i)) | 0;
  }
  
  return mediadores[Math.abs(hash) % mediadores.length];
}

function parseEmoji(emojiString) {
  if (!emojiString) return null;
  
  const customMatch = emojiString.match(/<?(a)?:?(\w+):(\d+)>?/);
  if (customMatch) {
    return {
      name: customMatch[2],
      id: customMatch[3],
      animated: !!customMatch[1]
    };
  }
  
  if (emojiString.length > 0 && !emojiString.includes(':')) {
    return emojiString;
  }
  
  return null;
}

function formatarValor(valor) {
  return valor.toFixed(2).replace('.', ',');
}

// --- SISTEMA PIX ---

function calcularCRC16(payload) {
  const polynomial = 0x1021;
  let crc = 0xFFFF;
  
  const bytes = Buffer.from(payload, 'utf-8');
  
  for (let i = 0; i < bytes.length; i++) {
    crc ^= (bytes[i] << 8);
    
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function adicionarCampo(id, valor) {
  const tamanho = valor.length.toString().padStart(2, '0');
  return `${id}${tamanho}${valor}`;
}

function gerarPayloadPixEstatico(chave) {
  let payload = '';
  
  payload += adicionarCampo('00', '01');
  payload += adicionarCampo('01', '12');
  
  let merchantInfo = '';
  merchantInfo += adicionarCampo('00', 'BR.GOV.BCB.PIX');
  merchantInfo += adicionarCampo('01', chave);
  payload += adicionarCampo('26', merchantInfo);
  
  payload += adicionarCampo('52', '0000');
  payload += adicionarCampo('53', '986');
  payload += adicionarCampo('58', 'BR');
  payload += adicionarCampo('59', 'PAGAMENTO APOSTA');
  payload += adicionarCampo('60', 'SAO PAULO');
  
  payload += '6304';
  payload += calcularCRC16(payload);
  
  return payload;
}

async function gerarQRCodeComRetry(payload, tentativas = DEFAULT_CONFIG.MAX_RETRIES) {
  for (let i = 0; i < tentativas; i++) {
    try {
      console.log(`[QR CODE] Tentativa ${i + 1}/${tentativas}`);

      const response = await axios.post(QR_CODE_API_URL, {
        text: payload,
        backgroundColor: '#FFFFFF',
        qrcodeColor: '#000000'
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: DEFAULT_CONFIG.TIMEOUT_API
      });

      if (response.data.success && response.data.qrcode) {
        const base64 = response.data.qrcode.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        
        if (!base64) {
          console.error('[QR CODE] ❌ Base64 vazio');
          continue;
        }
        
        const buffer = Buffer.from(base64, 'base64');
        console.log(`[QR CODE] ✅ Sucesso! ${buffer.length} bytes`);
        return buffer;
      }

      console.warn(`[QR CODE] ⚠️ API retornou erro`);
      
    } catch (error) {
      console.error(`[QR CODE] ❌ Tentativa ${i + 1} falhou:`, error.message);
      
      if (i < tentativas - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  console.error('[QR CODE] ❌ Todas tentativas falharam');
  return null;
}

function validarJogadores(jogador1, jogador2) {
  if (!jogador1 || !jogador2) {
    throw new TypeError('Jogadores não podem ser nulos');
  }
  
  if (!jogador1.id || !jogador2.id) {
    throw new TypeError('IDs dos jogadores são obrigatórios');
  }
  
  if (jogador1.id === jogador2.id) {
    throw new Error('Os jogadores não podem ser os mesmos');
  }
  
  return true;
}

function criarEmbedPartida(guild, mediadorId, modo, tipoGel, time, valor, taxaString, jogador1, jogador2) {
  const estiloJogo = time ? `${modo} | ${tipoGel} | ${time}` : `${modo} | ${tipoGel}`;
  
  return new EmbedBuilder()
    .setTitle(`${emojis._star_emoji || '⭐'} Partida Iniciada`)
    .setColor(0xF59E42)
    .setThumbnail(guild.iconURL() || null)
    .addFields(
      { 
        name: `${emojis._people_emoji || '🎮'} Estilo de Jogo`, 
        value: `\`${estiloJogo}\``, 
        inline: false 
      },
      { 
        name: `${emojis._staff_emoji || '👮'} Mediador`, 
        value: `<@${mediadorId}>`, 
        inline: true 
      },
      { 
        name: `${emojis._money_emoji || '💰'} Taxa de Serviço`, 
        value: `R$ ${taxaString}`, 
        inline: true 
      },
      { 
        name: `${emojis._money_emoji || '💵'} Valor da Aposta`, 
        value: `R$ ${valor}`, 
        inline: true 
      },
      { 
        name: `${emojis._people_emoji || '👥'} Jogadores`, 
        value: `1️⃣ <@${jogador1.id}>\n2️⃣ <@${jogador2.id}>`, 
        inline: false 
      },
      { 
        name: `${emojis.time_emoji || '🕐'} Horário`, 
        value: `<t:${Math.floor(Date.now() / 1000)}:F>`, 
        inline: false 
      }
    )
    .setFooter({ 
      text: 'Use o menu abaixo para gerenciar a partida',
      iconURL: guild.iconURL() || undefined
    })
    .setTimestamp();
}

function criarSelectMenu() {
  return new StringSelectMenuBuilder()
    .setCustomId('match_action')
    .setPlaceholder('⚙️ Selecione uma ação')
    .addOptions([
      {
        label: 'Finalizar Aposta',
        description: 'Encerra e fecha esta sala de aposta',
        value: 'finalizar',
        emoji: parseEmoji(emojis._fixe_emoji) || '🛑'
      },
      {
        label: 'Definir Vencedor',
        description: 'Seleciona o vencedor da partida',
        value: 'vencedor',
        emoji: parseEmoji(emojis._star_emoji) || '🏆'
      }
    ]);
}

// --- FUNÇÃO PRINCIPAL ---

async function criarSalaAposta(guild, jogador1, jogador2, modo, tipoGel, valor, time = null) {
  const startTime = Date.now();
  console.log(`[SALA] 🎬 Iniciando: ${jogador1.username} vs ${jogador2.username}`);

  try {
    validarJogadores(jogador1, jogador2);
    
    // --- Carregar Configuração de Filas ---
    const configFilas = await loadJsonSafe(PATHS.configFilas);
    if (!configFilas || !configFilas.tipo) {
      throw new Error('Configuração "tipo" não encontrada em configFilas.json');
    }
    
    const tipo = configFilas.tipo;
    console.log(`[SALA] ℹ️ Tipo de criação configurado: ${tipo}`);

    // --- Carregar Controle de Rotação ---
    const controleRotacao = await loadJsonSafe(PATHS.controleRotacao, { 
      ultimoCanalTopico: 0, 
      ultimaCategoriaCanal: 0 
    });

    let canal;

    // --- LÓGICA CRIAÇÃO POR TÓPICO ---
    if (tipo === 'topico') {
      const canaisConfig = configFilas.canais;
      if (!canaisConfig || canaisConfig.length === 0) {
        throw new Error('Nenhum canal configurado em configFilas.json para criação de tópicos');
      }

      let index = controleRotacao.ultimoCanalTopico || 0;
      let targetChannelId = null;
      let loops = 0;
      let countThreads = 0;

      // Sistema de rotação para tópicos
      do {
        const candidateId = canaisConfig[index];
        console.log(`[ROTACAO] 🔍 Verificando canal ${candidateId} (índice ${index})`);

        const channel = await guild.channels.fetch(candidateId).catch(() => null);
        
        if (channel && channel.isTextBased()) {
          const activeThreads = await channel.threads.fetchActive();
          countThreads = activeThreads.threads.size;
          
          console.log(`[ROTACAO] 📊 Tópicos ativos em ${channel.name}: ${countThreads}/50`);

          if (countThreads < 50) {
            targetChannelId = candidateId;
            // Atualiza o índice para o próximo (se for o último, volta pro 0)
            controleRotacao.ultimoCanalTopico = (index + 1) % canaisConfig.length;
            await saveJsonSafe(PATHS.controleRotacao, controleRotacao);
            console.log(`[ROTACAO] ✅ Canal ${channel.name} selecionado.`);
            break;
          }
        } else {
          console.warn(`[ROTACAO] ⚠️ Canal ${candidateId} inválido ou não encontrado.`);
        }

        index = (index + 1) % canaisConfig.length;
        loops++;
      } while (loops < canaisConfig.length);

      // Se todos estiverem cheios, volta para o primeiro (conforme requisito)
      if (!targetChannelId) {
        console.warn(`[ROTACAO] ⚠️ Todos os canais atingiram 50 tópicos. Voltando para o primeiro.`);
        targetChannelId = canaisConfig[0];
        controleRotacao.ultimoCanalTopico = 1 % canaisConfig.length;
        await saveJsonSafe(PATHS.controleRotacao, controleRotacao);
      }

      const parentChannel = await guild.channels.fetch(targetChannelId);
      
      // --- MUDANÇA AQUI: Cria o tópico diretamente sem mensagem no chat ---
      canal = await parentChannel.threads.create({
        name: `aposta-${jogador1.username}-${jogador2.username}`.substring(0, 100),
        autoArchiveDuration: 1440, // 1 dia
        type: ChannelType.PrivateThread,
        reason: 'Sala de aposta privada'
      });

      console.log(`[SALA] ✅ Tópico criado: ${canal.name} (${canal.id})`);

      // Adicionar jogadores ao tópico (Equivalente a permissões em canais)
      await canal.members.add(jogador1.id);
      await canal.members.add(jogador2.id);
    } 
    
    // --- LÓGICA CRIAÇÃO POR CANAL (CATEGORIA) ---
    else if (tipo === 'categoria') {
      const categoriasConfig = configFilas.categorias;
      if (!categoriasConfig || categoriasConfig.length === 0) {
        throw new Error('Nenhuma categoria configurada em configFilas.json para criação de canais');
      }

      let index = controleRotacao.ultimaCategoriaCanal || 0;
      let targetCategoryId = null;
      let loops = 0;

      // Sistema de rotação para categorias
      do {
        const candidateId = categoriasConfig[index];
        console.log(`[ROTACAO] 🔍 Verificando categoria ${candidateId} (índice ${index})`);

        // Contar canais ativos na categoria
        const channelsInCat = guild.channels.cache.filter(ch => ch.parentId === candidateId && ch.type === ChannelType.GuildText);
        const countChannels = channelsInCat.size;

        console.log(`[ROTACAO] 📊 Canais na categoria ${candidateId}: ${countChannels}/50`);

        if (countChannels < 50) {
          targetCategoryId = candidateId;
          controleRotacao.ultimaCategoriaCanal = (index + 1) % categoriasConfig.length;
          await saveJsonSafe(PATHS.controleRotacao, controleRotacao);
          console.log(`[ROTACAO] ✅ Categoria ${targetCategoryId} selecionada.`);
          break;
        }

        index = (index + 1) % categoriasConfig.length;
        loops++;
      } while (loops < categoriasConfig.length);

      // Se todas cheias, voltar para a primeira
      if (!targetCategoryId) {
        console.warn(`[ROTACAO] ⚠️ Todas as categorias atingiram 50 canais. Voltando para a primeira.`);
        targetCategoryId = categoriasConfig[0];
        controleRotacao.ultimaCategoriaCanal = 1 % categoriasConfig.length;
        await saveJsonSafe(PATHS.controleRotacao, controleRotacao);
      }

      // Criar o canal com permissões padrão
      canal = await guild.channels.create({
        name: `aposta-${jogador1.username}-${jogador2.username}`.substring(0, 100),
        type: ChannelType.GuildText,
        parent: targetCategoryId,
        permissionOverwrites: [
          { 
            id: guild.roles.everyone.id, 
            deny: [PermissionFlagsBits.ViewChannel] 
          },
          { 
            id: jogador1.id, 
            allow: [
              PermissionFlagsBits.ViewChannel, 
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ] 
          },
          { 
            id: jogador2.id, 
            allow: [
              PermissionFlagsBits.ViewChannel, 
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ] 
          }
        ]
      });

      console.log(`[SALA] ✅ Canal: ${canal.name} (${canal.id})`);
    } 
    
    else {
      throw new Error(`Tipo "${tipo}" inválido em configFilas.json. Use "topico" ou "categoria".`);
    }

    // --- SELEÇÃO DE MEDIADOR ---
    const mediadores = await loadJsonSafe(PATHS.mediadores, []);
    if (!Array.isArray(mediadores) || mediadores.length === 0) {
      throw new Error('Nenhum mediador configurado');
    }

    const mediadorId = escolherMediadorPorHash(mediadores, canal.id);

    // Adicionar permissões/mediador dependendo se é Tópico ou Canal
    if (tipo === 'topico') {
      try {
        await canal.members.add(mediadorId);
        console.log(`[SALA] ✅ Mediador adicionado ao tópico`);
      } catch (error) {
        console.error(`[SALA] ⚠️ Erro ao adicionar mediador ao tópico:`, error.message);
        await canal.send(`⚠️ **Aviso:** Falha ao adicionar mediador.`);
      }
    } else {
      try {
        await canal.permissionOverwrites.edit(mediadorId, { 
          ViewChannel: true, 
          SendMessages: true,
          ManageMessages: true,
          ReadMessageHistory: true
        });
        console.log(`[SALA] ✅ Mediador adicionado ao canal`);
      } catch (error) {
        console.error(`[SALA] ⚠️ Erro ao adicionar mediador:`, error.message);
        await canal.send(`⚠️ **Aviso:** Falha ao adicionar mediador.`);
      }
    }

    logManager.iniciarSessao(canal.id, {
      jogadores: [jogador1.id, jogador2.id],
      id_mediador: mediadorId,
      modo,
      tipo: tipoGel,
      valor,
      time: time || null
    });

    await canal.send({
      content: 
        `🎮 **Partida Confirmada!**\n\n` +
        `**Jogador 1:** <@${jogador1.id}>\n` +
        `**Jogador 2:** <@${jogador2.id}>\n` +
        `**Mediador:** <@${mediadorId}>\n\n` +
        `───────────────────────────`
    });

    const serviceFee = await getServiceFee();
    const taxaString = formatarValor(serviceFee);
    const baseValor = parseFloat(valor.replace(',', '.'));
    const totalPagar = baseValor + serviceFee;
    const totalString = formatarValor(totalPagar);

    console.log(`[SALA] 💰 Aposta: R$ ${valor} | Taxa: R$ ${taxaString} | Total: R$ ${totalString}`);

    const embed = criarEmbedPartida(
      guild, mediadorId, modo, tipoGel, time, 
      valor, taxaString, jogador1, jogador2
    );

    const select = criarSelectMenu();
    const row = new ActionRowBuilder().addComponents(select);
    
    await canal.send({ embeds: [embed], components: [row] });

    const pagamento = await getPagamentoInfo(mediadorId);
    
    if (pagamento?.chave_pix) {
      const pixChave = pagamento.chave_pix.trim();
      
      console.log(`[PIX] 💳 Gerando QR Code estático`);

      try {
        const payloadPix = gerarPayloadPixEstatico(pixChave);
        const qrBuffer = await gerarQRCodeComRetry(payloadPix);

        if (qrBuffer) {
          const attachment = new AttachmentBuilder(qrBuffer, { name: 'qrcode-pix.png' });
          
          // --- MUDANÇA AQUI: ENVIO SIMPLES SEM EMBED ---
          let contentMsg = `💳 **Pagamento PIX**\n`;
          contentMsg += `💵 **Valor a pagar:** \`${totalString}\`\n`;
          contentMsg += `🔑 **Chave Pix:** \`${pixChave}\``;
          
          if (pagamento.aviso) {
            contentMsg += `\n\n⚠️ **Aviso:** ${pagamento.aviso}`;
          }

          await canal.send({ content: contentMsg, files: [attachment] });
          
          logManager.adicionarEvento(canal.id, 'pagamento', 'QR Code PIX gerado', {
            chave: pixChave,
            valor: totalString,
            tipo: 'estatico'
          });
          
        } else {
          // Fallback caso o QR Code falhe
          await canal.send(
            `⚠️ **Erro ao gerar QR Code PIX.**\n\n` +
            `💳 **Valor:** \`${totalString}\`\n` +
            `🔑 **Chave:** \`${pixChave}\``
          );
        }
        
      } catch (error) {
        console.error('[PIX] ❌ Erro:', error);
        await canal.send(
          `❌ **Erro ao processar PIX.**\n` +
          `💳 **Valor:** \`${totalString}\`\n` +
          `🔑 **Chave:** \`${pixChave}\``
        );
      }
    } else {
      await canal.send(`⚠️ **Aviso:** Sem informações de pagamento.`);
    }

    const filasDados = await loadJsonSafe(PATHS.filasDados, {});
    
    filasDados[canal.id] = {
      valor,
      modo,
      tipo: tipoGel,
      jogadores: [jogador1.id, jogador2.id],
      status: 'iniciada',
      id_mediador: mediadorId,
      criado_em: Date.now(),
      ...(time && { time })
    };

    await saveJsonSafe(PATHS.filasDados, filasDados);

    const duration = Date.now() - startTime;
    console.log(`[SALA] ✅ Concluído em ${duration}ms`);
    console.log(`[SALA] 📁 Log salvo em: DataBaseJson/logs/`);

    return canal;

  } catch (error) {
    console.error('[SALA] ❌ Erro:', error);
    throw error;
  }
}

// --- FUNÇÃO GERAR HTML DISCORD MIRROR (ATUALIZADA) ---

async function gerarHTMLLog(canalId, guild) {
  try {
    const arquivos = await fs.readdir(PATHS.logs);
    let dadosLog = null;

    for (const arquivo of arquivos) {
      if (arquivo.includes(canalId) && arquivo.endsWith('.json')) {
        const caminhoArquivo = path.join(PATHS.logs, arquivo);
        const conteudo = await fs.readFile(caminhoArquivo, 'utf-8');
        dadosLog = JSON.parse(conteudo);
        break;
      }
    }

    if (!dadosLog) {
      throw new Error('Log não encontrado para este canal');
    }

    const { iniciado, finalizado, status, duracao, dadosPartida, eventos, participantes } = dadosLog;

    // Fetchar membros do Discord para avatares e nomes
    const membrosInfo = await Promise.all(
      participantes.map(async (id) => {
        try {
          const member = await guild.members.fetch(id);
          return {
            id,
            username: member.user.username,
            displayName: member.displayName,
            color: member.displayHexColor,
            avatarURL: member.user.displayAvatarURL({ dynamic: true, size: 128 }),
            bot: member.user.bot
          };
        } catch (e) {
          return { 
            id, 
            username: 'Desconhecido', 
            displayName: 'Desconhecido', 
            color: '#99AAB5', 
            avatarURL: 'https://cdn.discordapp.com/embed/avatars/0/5d966851c7150a6a3c516f8774d9a9d4.png?size=128',
            bot: false
          };
        }
      })
    );

    const membrosMap = new Map(membrosInfo.map(m => [m.id, m]));

    const duracaoMin = Math.floor(duracao / 60000);
    const duracaoSeg = Math.floor((duracao % 60000) / 1000);
    const duracaoStr = `${duracaoMin}min ${duracaoSeg}s`;

    // --- CSS DO DISCORD (DARK MODE) ---
    const css = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      
      body {
        background-color: #36393f;
        color: #dcddde;
        font-family: 'gg sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        display: flex;
        justify-content: center;
        min-height: 100vh;
        padding: 0;
      }

      .discord-app {
        width: 100%;
        max-width: 920px;
        background-color: #36393f;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .chat {
        display: flex;
        flex-direction: column;
      }

      .header {
        background-color: #2f3136;
        padding: 11px 16px;
        display: flex;
        align-items: center;
        border-bottom: 1px solid #202225;
      }

      .header-icon {
        color: #72767d;
        margin-right: 8px;
        font-size: 20px;
      }

      .header-name {
        color: #fff;
        font-size: 16px;
        font-weight: 500;
        margin-right: 8px;
      }

      .header-info {
        color: #72767d;
        font-size: 14px;
        font-weight: 400;
      }

      .messages-wrapper {
        padding: 16px 0;
        overflow-y: auto;
        flex-grow: 1;
      }

      .message {
        display: flex;
        margin-bottom: 17px;
        padding: 2px 16px 2px 0;
      }

      .message:hover {
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
        object-fit: cover;
        background-color: #2f3136;
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
        font-size: 1rem;
        font-weight: 500;
        color: #fff;
        margin-right: 8px;
        cursor: pointer;
      }

      .username:hover {
        text-decoration: underline;
      }

      .timestamp {
        font-size: 0.75rem;
        font-weight: 500;
        color: #72767d;
        text-transform: uppercase;
      }

      .bot-tag {
        background-color: #5865F2;
        color: #fff;
        font-size: 0.625rem;
        font-weight: 700;
        border-radius: 3px;
        padding: 1px 4px;
        vertical-align: middle;
        margin-left: 4px;
        text-transform: uppercase;
      }

      .message-text {
        font-size: 1rem;
        line-height: 1.375rem;
        color: #dcddde;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      /* Estilo de Embeds */
      .embed-container {
        margin-top: 8px;
        background-color: #2f3136;
        border-left: 4px solid #99aab5;
        border-radius: 4px;
        padding: 12px;
        max-width: 520px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }

      .embed-title {
        color: #fff;
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .embed-title-red { color: #ED4245; }
      .embed-title-green { color: #3BA55C; }
      .embed-title-blue { color: #5865F2; }

      .embed-description {
        color: #dcddde;
        font-size: 0.875rem;
        line-height: 1.3;
      }

      .embed-fields {
        margin-top: 8px;
        display: grid;
        grid-template-columns: minmax(50%, 1fr);
        gap: 8px;
      }

      .embed-field-name {
        color: #99aab5;
        font-weight: 500;
        font-size: 0.875rem;
        margin-bottom: 4px;
      }

      .embed-field-value {
        color: #dcddde;
        font-size: 0.875rem;
        font-weight: 500;
      }
      
      .embed-footer {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #4f545c;
        font-size: 0.8rem;
        color: #99aab5;
        display: flex;
        align-items: center;
      }
    `;

    // --- GERAR MENSAGENS ---
    const messagesHTML = eventos.map((evento) => {
      const hora = new Date(evento.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const usuario = evento.dados.userId ? membrosMap.get(evento.dados.userId) : null;
      
      // Se for mensagem do usuário
      if (evento.tipo === 'mensagem') {
        const avatarUrl = usuario?.avatarURL || 'https://cdn.discordapp.com/embed/avatars/0/5d966851c7150a6a3c516f8774d9a9d4.png?size=128';
        const displayName = usuario ? usuario.displayName : 'Desconhecido';
        const userColor = usuario ? usuario.color : '#ffffff';
        const isBot = usuario?.bot || false;
        const content = evento.dados.content || '';
        
        return `
          <div class="message">
            <div class="message-avatar">
              <img src="${avatarUrl}" alt="Avatar">
            </div>
            <div class="message-content">
              <div class="message-header">
                <span class="username" style="color: ${userColor}">${displayName}</span>
                ${isBot ? '<span class="bot-tag">BOT</span>' : ''}
                <span class="timestamp">${hora}</span>
              </div>
              <div class="message-text">${content}</div>
            </div>
          </div>
        `;
      }
      
      // Se for ação do sistema (Vencedor, Início, etc) - Simular como Embed
      let embedColor = '#99aab5';
      let title = 'Sistema';
      let desc = evento.descricao || '';
      
      if (evento.tipo === 'inicio') { title = '🎬 Início da Partida'; embedColor = '#3BA55C'; }
      if (evento.tipo === 'fim') { title = '🏁 Fim da Partida'; embedColor = '#ED4245'; }
      if (evento.tipo === 'pagamento') { title = '💳 Pagamento PIX'; embedColor = '#5865F2'; }
      if (evento.tipo === 'acao') {
        title = 'Ação Realizada'; embedColor = '#FAA61A';
        if (evento.dados.tipo === 'vencedor') { title = '🏆 Vencedor Definido'; embedColor = '#F1C40F'; }
        if (evento.dados.tipo === 'finalizar') { title = '🏁 Partida Finalizada'; embedColor = '#ED4245'; }
      }

      const avatarUrl = 'https://cdn.discordapp.com/embed/avatars/0/5d966851c7150a6a3c516f8774d9a9d4.png?size=128'; // Avatar Padrão
      
      return `
        <div class="message">
          <div class="message-avatar">
            <img src="${avatarUrl}" alt="Avatar">
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="username" style="color: #ffffff;">Sistema</span>
              <span class="bot-tag">BOT</span>
              <span class="timestamp">${hora}</span>
            </div>
            <div class="embed-container" style="border-left: 4px solid ${embedColor};">
              <div class="embed-title" style="color: ${embedColor};">${title}</div>
              <div class="embed-description">${desc}</div>
              ${evento.dados.valor ? `<div class="embed-footer">Valor: R$ ${evento.dados.valor}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log da Partida</title>
  <style>
    ${css}
  </style>
</head>
<body>
  <div class="discord-app">
    <div class="chat">
      <div class="header">
        <span class="header-icon">#</span>
        <span class="header-name"># ${dadosPartida.modo} - ${dadosPartida.valor}</span>
        <span class="header-info">${dadosPartida.tipo || 'Aposta'}</span>
      </div>
      <div class="messages-wrapper">
        ${messagesHTML}
      </div>
    </div>
  </div>
</body>
</html>
    `;

    return html;
  } catch (error) {
    console.error('[LOGS] ❌ Erro ao gerar HTML:', error);
    throw error;
  }
}

module.exports = { 
  criarSalaAposta,
  logManager,
  gerarHTMLLog // Exportado para uso externo
};