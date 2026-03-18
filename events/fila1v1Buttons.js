const { EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

// IMPORTAÇÕES
const emojis = require('../DataBaseJson/emojis.json');
const { tentarParear } = require('./filaMatchmaker');

// Caminhos dos Bancos de Dados
const filasPath = path.join(__dirname, '../DataBaseJson/filas1v1.json');
const mediadoresPath = path.join(__dirname, '../DataBaseJson/mediadores.json');

// --- FUNÇÕES DE GERENCIAMENTO DE ARQUIVOS ---

function getFilasDB() {
  if (!fs.existsSync(filasPath)) {
    fs.writeFileSync(filasPath, JSON.stringify({}), 'utf-8');
  }
  return JSON.parse(fs.readFileSync(filasPath, 'utf-8'));
}

function saveFilasDB(db) {
  fs.writeFileSync(filasPath, JSON.stringify(db, null, 2), 'utf-8'); 
}

/**
 * Lê o arquivo JSON de mediadores de forma segura.
 * @returns {Array<string>} Uma lista de IDs de mediadores disponíveis.
 */
function getMediadoresDB() {
    if (!fs.existsSync(mediadoresPath)) {
        return [];
    }
    try {
        const mediadores = JSON.parse(fs.readFileSync(mediadoresPath, 'utf-8'));
        return Array.isArray(mediadores) ? mediadores : [];
    } catch (e) {
        console.error("❌ Erro ao ler mediadores.json:", e);
        return [];
    }
}

// --- FUNÇÕES DE AUXÍLIO ---

/**
 * Extrai o valor da aposta da Embed, removendo a formatação 'R$ ' para uso como chave no DB.
 * O valor retornado é a string exata salva na configuração (ex: "89,90" ou "100").
 */
function getValorFromEmbed(embed) {
  if (!embed.fields) return null;
  const valorField = embed.fields.find(f => f.name && f.name.includes('VALOR'));
  if (!valorField || !valorField.value) return null;
  // Garante que o valor da chave (string) seja limpo, mas preserve a vírgula.
  // Ex: "R$ 89,90" -> "89,90"
  return valorField.value.replace('R$ ', '').trim();
}

function getModoFromEmbed(embed) {
  if (!embed.fields) return null;
  const modoField = embed.fields.find(f => f.name && f.name.includes('MODO'));
  if (modoField && modoField.value) {
    return modoField.value.replace('fila ', '').trim();
  }
  return null;
}

// --- LÓGICA PRINCIPAL DO HANDLER ---

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // 1. Filtros iniciais
    if (!interaction.isButton()) return;
    const customId = interaction.customId;
    if (!['gel_normal', 'gel_infinito', 'sair_fila_1v1'].includes(customId)) return;

    // Uso de flags para evitar o warning de 'ephemeral'
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

    // 2. Extração de Dados
    const embed = interaction.message.embeds[0];
    if (!embed) return interaction.editReply({ content: `${emojis.failuser_emoji} Embed da fila não encontrada.` });
    
    // O valor será a CHAVE do DB (ex: "89,90")
    const valorChaveDB = getValorFromEmbed(embed); 
    if (!valorChaveDB) return interaction.editReply({ content: `${emojis.failuser_emoji} Valor da partida não encontrado na Embed.` });
    
    const modo = getModoFromEmbed(embed) || 'modo_padrao';
    
    let filasDB = getFilasDB();
    if (!filasDB[valorChaveDB]) filasDB[valorChaveDB] = []; // Usa o valor como chave
    
    let jogadores = filasDB[valorChaveDB];
    const userId = interaction.user.id;
    let mudou = false;

    // 3. Lógica de ENTRADA NA FILA
    if (customId === 'gel_normal' || customId === 'gel_infinito') {
      
      const mediadores = getMediadoresDB();

      // a. Checagem de Mediadores
      if (mediadores.length === 0) {
        return interaction.editReply({ content: `${emojis.failuser_emoji} Não há mediadores disponíveis no momento. Tente novamente mais tarde!` });
      }
      
      // b. Checagem de Duplicidade
      if (jogadores.some(j => j.id === userId)) {
        return interaction.editReply({ content: `${emojis.failuser_emoji} Você já está na fila!` });
      }
      
      // c. Adiciona Jogador
      const tipoGel = customId === 'gel_normal' ? 'Gel Normal' : 'Gel Infinito';
      jogadores.push({ id: userId, tipo: tipoGel });
      mudou = true;
      
      await interaction.editReply({ content: `${emojis.confirmed_emoji} Você entrou na fila com sucesso! Tipo de Gel: **${tipoGel}**` });
      saveFilasDB(filasDB);
      
      // d. Tenta Parear (Matchmaking)
      // Passa a CHAVE DO VALOR CORRETA para o Matchmaker:
      await tentarParear(interaction, valorChaveDB, modo, tipoGel, interaction.message);
      
      // Recarrega o banco após a tentativa de pareamento
      filasDB = getFilasDB();
      jogadores = filasDB[valorChaveDB] || [];

    // 4. Lógica de SAÍDA DA FILA
    } else if (customId === 'sair_fila_1v1') {
      if (!jogadores.some(j => j.id === userId)) {
        return interaction.editReply({ content: `${emojis.failuser_emoji} Você não está na fila!` });
      }
      
      filasDB[valorChaveDB] = jogadores.filter(j => j.id !== userId);
      mudou = true;
      
      await interaction.editReply({ content: `${emojis.confirmed_emoji} Você saiu da fila com sucesso!` });
    }

    // 5. Atualização da Embed (Se Houve Mudança)
    if (mudou) {
      saveFilasDB(filasDB);
      
      // Monta a string de jogadores
      let jogadoresStr = filasDB[valorChaveDB].length > 0
        ? filasDB[valorChaveDB].map(j => `<@${j.id}> | ${j.tipo}`).join('\n')
        : 'Nenhum jogador na fila.';
        
      try {
          // Cria uma nova embed a partir da antiga, atualizando apenas os campos
          const newEmbed = EmbedBuilder.from(embed)
            .setFields([
              { name: `${emojis.command_emoji} MODO`, value: `fila ${modo}`, inline: false },
              // Exibe o valor de volta, formatando com R$
              { name: `${emojis._money_emoji} VALOR`, value: `R$ ${valorChaveDB}`, inline: false }, 
              { name: `${emojis._people_emoji} JOGADORES`, value: jogadoresStr, inline: false } 
            ]);
            
          await interaction.message.edit({ embeds: [newEmbed] });
          
      } catch (e) {
          console.error("❌ Erro ao editar a mensagem da fila (provavelmente foi deletada):", e.message);
      }
    }
  }
};
