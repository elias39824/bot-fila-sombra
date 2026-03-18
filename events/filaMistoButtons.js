const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');
const { tentarParear } = require('./filaMatchmaker'); // Importa a função de pareamento

const filasPath = path.join(__dirname, '../DataBaseJson/filasMisto.json');

function getFilasDB() {
  if (!fs.existsSync(filasPath)) {
    fs.writeFileSync(filasPath, JSON.stringify({}), 'utf-8');
  }
  return JSON.parse(fs.readFileSync(filasPath, 'utf-8'));
}

function saveFilasDB(db) {
  fs.writeFileSync(filasPath, JSON.stringify(db, null, 2), 'utf-8');
}

function getValorFromEmbed(embed) {
  const valorField = embed.fields.find(f => f.name.includes('VALOR'));
  if (!valorField) return null;
  return valorField.value.replace('R$ ', '').trim();
}

function getModoFromEmbed(embed) {
  const modoField = embed.fields.find(f => f.name.includes('MODO'));
  if (!modoField) return null;
  return modoField.value.trim();
}

function getFormatoFromEmbed(embed) {
  const formatoField = embed.fields.find(f => f.name === 'Formato');
  if (!formatoField) return null;
  return formatoField.value.trim();
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton()) return;
    const customId = interaction.customId;
    // Garante que só processa botões de EMu ou SAIR
    if (!customId.startsWith('emu_') && customId !== 'sair_fila_misto') return;

    // Pega embed e valor
    const embed = interaction.message.embeds[0];
    if (!embed) return interaction.reply({ content: 'Embed não encontrada.', ephemeral: true });
    
    const valor = getValorFromEmbed(embed);
    if (!valor) return interaction.reply({ content: 'Valor não encontrado na embed.', ephemeral: true });
    
    const modo = getModoFromEmbed(embed) || '';
    const formato = getFormatoFromEmbed(embed) || '';
    
    let filasDB = getFilasDB();
    if (!filasDB[valor]) filasDB[valor] = [];
    
    let jogadores = filasDB[valor];
    const userId = interaction.user.id;
    let mudou = false;

    await interaction.deferReply({ ephemeral: true });

    // --- Lógica de Entrada na Fila (Botões emu_X) ---
    if (customId.startsWith('emu_')) {
      const emuTime = customId; // emu_1, emu_2, etc.

      // 1. Impede que o mesmo usuário entre duas vezes
      if (jogadores.some(j => j.id === userId)) {
        await interaction.editReply({ content: `${emojis.failuser_emoji || '❌'} Você já está na fila!`, ephemeral: true });
        return;
      }
      
      // 2. Adiciona o jogador à fila
      jogadores.push({ id: userId, time: emuTime });
      mudou = true;
      
      await interaction.editReply({ content: `${emojis.confirmed_emoji || '✅'} Você entrou na fila!`, ephemeral: true });
      
      // 3. Verificação de PAREAMENTO CRÍTICA (2 pagantes = Match)
      if (jogadores.length === 2) {
        
        // Extrai os dois jogadores que acabaram de preencher a fila
        const [jogador1, jogador2] = jogadores;
        
        // 4. Limpa a fila antes de parear
        filasDB[valor] = []; 
        saveFilasDB(filasDB);

        // 5. Chama o pareamento com os dois pagantes
        await tentarParear(
          interaction,
          valor,
          modo,
          formato,
          interaction.message,
          'misto',
          [jogador1, jogador2] // Passa os dois jogadores (pagantes)
        );

        // O match foi criado, a fila foi limpa.
        
      } else {
         // Se a fila não está cheia, salva o estado atual
         saveFilasDB(filasDB);
      }
      
      // Recarrega o estado atual da fila (pode estar vazia se houve match) para atualizar a embed
      filasDB = getFilasDB();
      jogadores = filasDB[valor] || [];

    // --- Lógica de Saída da Fila ---
    } else if (customId === 'sair_fila_misto') {
      if (!jogadores.some(j => j.id === userId)) {
        await interaction.editReply({ content: `${emojis.failuser_emoji || '❌'} Você não está na fila!`, ephemeral: true });
        return;
      }
      
      filasDB[valor] = jogadores.filter(j => j.id !== userId);
      mudou = true;
      
      await interaction.editReply({ content: `${emojis.confirmed_emoji || '✅'} Você saiu da fila!`, ephemeral: true });
      saveFilasDB(filasDB);
      
      // Recarrega o estado atual da fila para atualizar a embed
      filasDB = getFilasDB();
      jogadores = filasDB[valor] || [];
    }

    // --- Atualização da Embed ---
    if (mudou) {
      let jogadoresStr = jogadores.length > 0
        ? jogadores.map(j => `<@${j.id}> | ${j.time.replace('emu_', '')} emu`).join('\n')
        : 'Nenhum jogador na fila.';
        
      // Cria uma nova Embed a partir da original
      const newEmbed = EmbedBuilder.from(embed)
        .setFields([
          { name: `${emojis.command_emoji || '📜'} MODO`, value: modo, inline: false },
          { name: `${emojis._money_emoji || '💰'} VALOR`, value: `R$ ${valor}`, inline: false },
          { name: `Formato`, value: formato, inline: false },
          { name: `${emojis._people_emoji || '👥'} JOGADORES`, value: jogadoresStr, inline: false }
        ]);
        
      try {
          await interaction.message.edit({ embeds: [newEmbed] });
      } catch (e) {
          console.error('Erro ao editar mensagem após atualização da fila mista:', e);
      }
    }
  }
};
