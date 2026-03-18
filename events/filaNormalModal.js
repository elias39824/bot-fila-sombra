const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const filasPath = path.join(__dirname, '../DataBaseJson/filasNormal.json');
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const configPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');
const configEmbedFilasPath = path.join(__dirname, '../DataBaseJson/configEmbedFilas.json');

// --- FUNÇÕES ---

function getFilasDB() {
  if (!fs.existsSync(filasPath)) {
    fs.writeFileSync(filasPath, JSON.stringify({}), 'utf-8');
  }
  return JSON.parse(fs.readFileSync(filasPath, 'utf-8'));
}

function saveFilasDB(db) {
  fs.writeFileSync(filasPath, JSON.stringify(db, null, 2), 'utf-8');
}

function saveFilaDados(msgId, dados) {
  let db = {};
  if (fs.existsSync(filasDadosPath)) db = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
  db[msgId] = dados;
  fs.writeFileSync(filasDadosPath, JSON.stringify(db, null, 2), 'utf-8');
}

function getConfig() {
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    return config && typeof config === 'object' ? config : {};
  } catch (e) {
    if (e.code === 'ENOENT') {
      fs.writeFileSync(configPath, JSON.stringify({}), 'utf8');
    }
    return {};
  }
}

function getConfigEmbedFilas() {
  try {
    if (!fs.existsSync(configEmbedFilasPath)) {
      return {
        cor: '#FF9900',
        banner_url: null,
        footer_text: null,
        footer_icon_url: null
      };
    }
    const data = fs.readFileSync(configEmbedFilasPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {
      cor: '#FF9900',
      banner_url: null,
      footer_text: null,
      footer_icon_url: null
    };
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isModalSubmit() || interaction.customId !== 'modal_fila_normal') return;

    const canalId = interaction.fields.getTextInputValue('canal_id');
    const modo = interaction.fields.getTextInputValue('modo_fila');
    const formato = interaction.fields.getTextInputValue('formato_fila');
    
    const config = getConfig();
    const valores = config.valores_normal || ['10,90', '5,90', '1,90'];
    const configEmbed = getConfigEmbedFilas(); // ✅ CORRIGIDO (estava "get")

    await interaction.deferReply({ ephemeral: true });
    
    let canal;
    try {
      canal = await interaction.guild.channels.fetch(canalId);
      
      if (!canal || canal.type !== ChannelType.GuildText) {
        return interaction.editReply({ 
          content: `${emojis.failuser_emoji || '❌'} O ID fornecido não corresponde a um canal de texto válido.` 
        });
      }
      
      const botPermissions = canal.permissionsFor(interaction.client.user);
      if (!botPermissions.has(PermissionsBitField.Flags.SendMessages) || !botPermissions.has(PermissionsBitField.Flags.EmbedLinks)) {
        return interaction.editReply({ 
          content: `${emojis.failuser_emoji || '❌'} O bot não tem permissão para enviar mensagens e/ou embeds no canal.` 
        });
      }
      
      if (valores.length === 0) {
        return interaction.editReply({ 
          content: `${emojis.failuser_emoji || '❌'} Os valores da fila Normal não estão configurados. Use \`/panel\` para configurar.` 
        });
      }

    } catch (error) {
      console.error('[FILA NORMAL] Erro ao acessar canal:', error);
      return interaction.editReply({ 
        content: `${emojis.failuser_emoji || '❌'} Falha ao encontrar ou acessar o canal. Verifique se o ID está correto.` 
      });
    }
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('entrar_fila_normal')
        .setLabel('Entrar na Fila')
        .setStyle(ButtonStyle.Success)
        .setEmoji(emojis.confirmed_emoji || '✅'),
      new ButtonBuilder()
        .setCustomId('sair_fila_normal')
        .setLabel('Sair da Fila')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis._ban_emoji || '🚪')
    );

    let filasDB = getFilasDB();
    const tituloFila = config.titulo_normal || `FILA EMULADOR | 0% DE TAXA`;

    let filasEnviadas = 0;

    for (const valor of valores) {
      if (!filasDB[valor]) filasDB[valor] = [];
      
      let jogadoresStr = filasDB[valor].length > 0
        ? filasDB[valor].map(j => `<@${j.id}>`).join('\n')
        : 'Nenhum jogador na fila.';
        
      const embed = new EmbedBuilder()
        .setTitle(`${emojis._star_emoji || '⭐'} ${tituloFila}`)
        .setThumbnail(interaction.guild.iconURL() || null)
        .setColor(configEmbed.cor || '#FF9900')
        .addFields(
          { name: `${emojis.command_emoji || '📜'} MODO`, value: `\`${modo}\``, inline: false },
          { name: `${emojis._money_emoji || '💰'} VALOR`, value: `R$ ${valor}`, inline: false },
          { name: `${emojis._people_emoji || '👥'} JOGADORES`, value: jogadoresStr, inline: false }
        )
        .setTimestamp();

      if (configEmbed.banner_url) {
        embed.setImage(configEmbed.banner_url);
      }

      if (configEmbed.footer_text || configEmbed.footer_icon_url) {
        embed.setFooter({
          text: configEmbed.footer_text || 'Fila de apostas',
          iconURL: configEmbed.footer_icon_url || interaction.guild.iconURL() || undefined
        });
      }
        
      try {
        const msg = await canal.send({ embeds: [embed], components: [row] });
        
        saveFilaDados(msg.id, {
          valor,
          modo,
          formato,
          jogadores: [],
          status: 'aberta',
          tipoFila: 'normal'
        });

        filasEnviadas++;
        console.log(`[FILA NORMAL] ✅ Fila criada - Valor: R$ ${valor}`);
      } catch (e) {
        console.error(`[FILA NORMAL] ❌ Erro ao enviar fila (R$ ${valor}):`, e);
      }
    }
    
    saveFilasDB(filasDB);
    
    await interaction.editReply({ 
      content: `${emojis.confirmed_emoji || '✅'} **${filasEnviadas} fila(s) normal(is) criada(s) com sucesso!**\n\n` +
               `📍 **Canal:** <#${canalId}>\n` +
               `💰 **Valores:** ${valores.join(', ')}\n` +
               `📊 **Total de filas:** ${filasEnviadas}`
    });
  }
};