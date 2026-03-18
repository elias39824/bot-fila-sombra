const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// --- FUNÇÕES DE STATUS E CONFIGURAÇÃO ---

/**
 * Retorna os mediadores definidos.
 */
function getMediadores() {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../DataBaseJson/mediadores.json'), 'utf-8');
    const ids = JSON.parse(data);
    // Assumindo que mediadores.json contém IDs de CARGOS (Role IDs)
    return Array.isArray(ids) && ids.length ? ids.map(id => `<@&${id}>`).join(', ') : 'Nenhum definido';
  } catch (e) {
    // Retorna string padrão em caso de erro na leitura ou parsing
    return 'Nenhum definido';
  }
}

/**
 * Retorna a categoria de canal definida.
 */
function getCategoria() {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../DataBaseJson/categoria.json'), 'utf-8');
    const ids = JSON.parse(data);
    // Assumindo que categoria.json contém um ID de canal/categoria
    return Array.isArray(ids) && ids.length ? `<#${ids[0]}>` : 'Nenhuma definida';
  } catch (e) {
    return 'Nenhuma definida';
  }
}

/**
 * Conta o total de jogadores em todas as filas.
 */
function getStatusFilas() {
  function countFila(file) {
    try {
      const data = fs.readFileSync(path.join(__dirname, `../DataBaseJson/${file}`), 'utf-8');
      const filas = JSON.parse(data);
      // Soma o tamanho de todos os arrays de jogadores em cada chave de valor
      return Object.values(filas).reduce((acc, arr) => {
        return acc + (Array.isArray(arr) ? arr.length : 0);
      }, 0);
    } catch {
      return 0;
    }
  }
  return {
    '1v1': countFila('filas1v1.json'),
    'Normal': countFila('filasNormal.json'),
    'Misto': countFila('filasMisto.json')
  };
}

/**
 * Limpa o array de jogadores em todos os arquivos de fila.
 */
function limparFilas() {
  const arquivos = ['filas1v1.json', 'filasNormal.json', 'filasMisto.json'];
  for (const arquivo of arquivos) {
    const filePath = path.join(__dirname, `../DataBaseJson/${arquivo}`);
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      let filas = JSON.parse(data);
      
      // Itera sobre as chaves (valores de aposta)
      for (const key in filas) {
        // Se for um array (lista de jogadores), ele é limpo
        if (Array.isArray(filas[key])) {
          filas[key] = [];
        } 
        // Se a estrutura de fila for diferente (ex: objeto com campo jogadores), você ajustaria aqui
        // Mas a lógica do matchmaker assume que filas[key] é um array de jogadores.
      }
      fs.writeFileSync(filePath, JSON.stringify(filas, null, 2), 'utf-8');
    } catch (e) {
        console.error(`[LIMPEZA] Falha ao limpar o arquivo ${arquivo}:`, e.message);
    }
  }
}

/**
 * Atualiza as mensagens de Embed das filas no Discord para mostrar que estão vazias.
 * @param {Client} client - A instância do bot.
 */
async function atualizarEmbedsFilas(client) {
  const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
  if (!fs.existsSync(filasDadosPath)) return;
  
  try {
    const filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
    const jogadoresVazios = 'Nenhum jogador na fila.';

    for (const msgId in filasDados) {
      const dados = filasDados[msgId];
      if (!dados.status || dados.status !== 'aberta') continue;
      
      // VERIFICAÇÃO CRÍTICA: Certifique-se de que o ID do canal existe nos dados.
      if (!dados.canalId) {
          // console.warn(`[ATUALIZAR EMBED] Dados da fila ${msgId} não contêm canalId. Ignorando.`);
          continue;
      }

      try {
        const canal = await client.channels.fetch(dados.canalId).catch(() => null);
        if (!canal) continue;
        const msg = await canal.messages.fetch(msgId).catch(() => null);
        if (!msg) continue;
        
        let embed = msg.embeds[0];
        if (!embed) continue;
        
        // --- Lógica de Atualização (Focada em Sobrescrever o campo JOGADORES) ---
        
        const newEmbed = EmbedBuilder.from(embed);
        let fields = newEmbed.data.fields || [];

        // Encontra o índice do campo JOGADORES
        const indexJogadores = fields.findIndex(f => f.name.includes('JOGADORES'));

        if (indexJogadores !== -1) {
          // Se o campo JOGADORES for encontrado, atualiza-o para a string vazia
          fields[indexJogadores] = { 
            name: fields[indexJogadores].name, // Mantém o nome (incluindo emojis)
            value: jogadoresVazios, 
            inline: fields[indexJogadores].inline 
          };
        } else {
            // Se o campo JOGADORES não for encontrado, adiciona-o (fallback)
             fields.push({ name: `${emojis._people_emoji} JOGADORES`, value: jogadoresVazios, inline: false });
        }
        
        // Define os campos atualizados
        newEmbed.setFields(fields); 
        
        await msg.edit({ embeds: [newEmbed] });
        
      } catch (e) {
         // Erro ao buscar mensagem ou canal (por exemplo, deletados)
         // console.error(`[ATUALIZAR EMBED] Erro ao processar mensagem ${msgId}:`, e.message);
      }
    }
  } catch (e) {
      console.error("[ATUALIZAR EMBED] Erro fatal ao ler filasDados.json:", e);
  }
}

// --- HANDLER DE INTERAÇÃO ---

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isButton() && interaction.customId === 'config_regenerar') {
        
      // Defer para garantir que a interação não expire
      await interaction.deferUpdate().catch(() => {});
        
      limparFilas();
      await atualizarEmbedsFilas(interaction.client);
      
      // Prepara os dados de status e configuraçoes
      const status = getStatusFilas(); // Mantido o uso, mas não mostrado na Embed abaixo
      const mediadores = getMediadores();
      const categoria = getCategoria();

      // Monta a Embed de Configuração (com dados atualizados)
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._settings_emoji} Configurações de Filas`)
        .setDescription(`Veja e altere as configurações principais das filas do servidor.\n\n${emojis._people_emoji} **Mediador:** ${mediadores}\n${emojis._folder_emoji} **Categoria:** ${categoria}`)
        .setFooter({ text: 'Use os botões abaixo para alterar as configurações.', iconURL: 'https://cdn.discordapp.com/emojis/1378534194849775647.png' });
        
      // ActionRow (Mantido o código original)
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('config_mediador')
          .setLabel('Mediador')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._people_emoji),
        new ButtonBuilder()
          .setCustomId('config_categoria')
          .setLabel('Categoria')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._folder_emoji),
        new ButtonBuilder()
          .setCustomId('config_regenerar')
          .setLabel('Regenerar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji(emojis._clean_emoji)
      );
      
      // Atualiza a mensagem de configuração
      await interaction.editReply({ 
          content: `${emojis.confirmed_emoji} **Sucesso!** Todas as filas foram limpas e as mensagens de fila foram atualizadas.`, 
          embeds: [embed], 
          components: [row] 
      });
    }
  }
};
