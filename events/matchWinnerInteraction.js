const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// --- Caminhos ---
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const mediadoresPath = path.join(__dirname, '../DataBaseJson/mediadores.json');

// --- Funções Auxiliares (isMediator é necessária para a verificação de permissão) ---

function isMediator(member) {
  let mediatorRoleIds = [];
  try {
      const data = fs.readFileSync(mediadoresPath, 'utf-8');
      mediatorRoleIds = JSON.parse(data);
  } catch (e) {
      // Falha silenciosa na leitura do JSON
  }

  if (mediatorRoleIds.some(roleId => member.roles.cache.has(roleId))) {
      return true;
  }
  return member.permissions.has(PermissionsBitField.Flags.ManageChannels);
}

// ----------------------------------------------------------------------------


module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'match_action') return;
    const selected = interaction.values[0];
    if (selected !== 'vencedor') return;

    let replied = false;
    let jogadoresIDs = [];

    // Tenta deferir a interação *imediatamente*.
    try {
        await interaction.deferReply({ ephemeral: true });
        replied = true;
    } catch (e) {
        // 🚨 FLUXO DE RECUPERAÇÃO: A interação falhou/expirou.
        console.error(`[ERRO INTERAÇÃO EXPIRADA] Falha ao deferir match_action:`, e.message);
        
        const partidaEmbed = interaction.message.embeds[0];
        const jogadoresField = partidaEmbed?.fields?.find(f => f.name.toLowerCase().includes('jogadores'));
        
        // Tenta extrair IDs da Embed
        if (jogadoresField) {
            jogadoresIDs = (jogadoresField.value.match(/<@!?\d+>/g) || []).slice(0, 2).map(m => m.replace(/<@!?|>/g, ''));
        }
        
        // Tenta buscar IDs do DB se a embed falhar
        let filasDados = {};
        if (fs.existsSync(filasDadosPath)) {
             try {
                 filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
             } catch(err) {
                 console.error("Erro ao ler filasDados.json na recuperação:", err);
             }
        }
        const partida = filasDados[interaction.channel.id];

        if ((!jogadoresIDs || jogadoresIDs.length < 2) && partida && Array.isArray(partida.jogadores) && partida.jogadores.length === 2) {
          // Garante que a estrutura seja um array de IDs puros (se for um array de objetos)
          jogadoresIDs = partida.jogadores.map(j => (typeof j === 'object' && j.id) ? j.id : j);
        }

        if (jogadoresIDs.length === 2) {
          const select = new StringSelectMenuBuilder()
            .setCustomId('definir_vencedor')
            .setPlaceholder('⭐ Selecione o vencedor')
            .addOptions(jogadoresIDs.map(id => {
              const member = interaction.guild.members.cache.get(id);
              return {
                label: member ? member.displayName : id,
                value: id,
                emoji: emojis.confirmed_emoji || '✅'
              };
            }));
          const row = new ActionRowBuilder().addComponents(select);
          const selectEmbed = new EmbedBuilder()
            .setTitle(`${emojis._star_emoji || '⭐'} Definir Vencedor`)
            .setDescription(`${emojis._star_emoji || '⭐'} Selecione o vencedor da partida`)
            .setThumbnail(interaction.user.displayAvatarURL());
            
          await interaction.channel.send({ content: `<@${interaction.user.id}> Esta interação expirou. Selecione novamente o vencedor da partida:`, embeds: [selectEmbed], components: [row] });
        } else {
          await interaction.channel.send({ content: `<@${interaction.user.id}> Esta interação expirou. Não foi possível recuperar os jogadores.` });
        }
        
        return; // CRÍTICO: Termina a execução após a recuperação da falha de defer.
    }

    // 🚨 FLUXO PRINCIPAL (Se o deferReply funcionou)
    try {
        
      // 4. VERIFICAÇÃO DE PERMISSÃO DE MEDIADOR
      if (!isMediator(interaction.member)) {
         return await interaction.editReply({ 
           content: `${emojis.failuser_emoji || '❌'} Apenas membros com cargo de Mediador podem usar este menu.`,
           ephemeral: true 
         });
      }

      // 5. Buscar IDs dos jogadores na embed original
      const partidaEmbed = interaction.message.embeds[0];
      const jogadoresField = partidaEmbed?.fields?.find(f => f.name.toLowerCase().includes('jogadores'));
      
      if (jogadoresField) {
        // Extrai IDs e mapeia para IDs puros
        jogadoresIDs = (jogadoresField.value.match(/<@!?\d+>/g) || []).slice(0, 2).map(m => m.replace(/<@!?|>/g, ''));
      }
      
      // 6. Preencher o Select Menu
      
      if (!jogadoresIDs || jogadoresIDs.length < 2) {
        return await interaction.editReply({ content: 'Não foi possível encontrar jogadores para definir o vencedor.' });
      }

      // Cria as opções do menu de seleção
      const options = jogadoresIDs.map(id => {
          const member = interaction.guild.members.cache.get(id);
          // Usa o nome de exibição do membro se encontrado, caso contrário, usa o ID
          const label = member ? member.displayName : id; 
          return { label: label, value: id, emoji: emojis.confirmed_emoji || '✅' };
      });

      // Cria o Select menu
      const select = new StringSelectMenuBuilder()
        .setCustomId('definir_vencedor')
        .setPlaceholder('⭐ Selecione o vencedor')
        .addOptions(options);
        
      const row = new ActionRowBuilder().addComponents(select);

      // Cria a Embed curta
      const selectEmbed = new EmbedBuilder()
        .setTitle(`${emojis._star_emoji || '⭐'} Definir Vencedor`)
        .setDescription(`${emojis._star_emoji || '⭐'} Selecione o vencedor da partida`)
        .setThumbnail(interaction.user.displayAvatarURL());

      await interaction.editReply({ embeds: [selectEmbed], components: [row] });
      
    } catch (error) {
      console.error('Erro no fluxo principal matchWinnerInteraction:', error);
      // Garante que a resposta de erro use o editReply, já que o deferReply funcionou
      await interaction.editReply({ content: 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.' });
    }
  }
};
