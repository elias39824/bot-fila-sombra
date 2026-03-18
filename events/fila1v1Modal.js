const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const filasPath = path.join(__dirname, '../DataBaseJson/filas1v1.json');
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const configPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');
const configEmbedFilasPath = path.join(__dirname, '../DataBaseJson/configEmbedFilas.json');

// --- FUNÇÕES UTILITÁRIAS ---

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

function loadValoresConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            return { valores: [], titulo: 'FILA MOBILE | ERRO DE ARQUIVO' };
        }
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        const valores = Array.isArray(config.valores_1v1) ? config.valores_1v1 : ['100,90', '50,90', '10,90'];
        const titulo = config.titulo_1v1 || 'FILA MOBILE | 0% DE TAXA';
        
        return { valores, titulo };
    } catch (e) {
        return { valores: [], titulo: 'FILA MOBILE | ERRO DE CONFIGURACAO' };
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

function formatarValorParaExibicao(valor) {
    if (typeof valor !== 'string') return valor;
    
    if (valor.includes(',')) {
        return valor;
    }

    const numeroLimpo = valor.replace(/\D/g, '');
    
    if (numeroLimpo.length < 3) {
        return '0,' + numeroLimpo.padStart(2, '0');
    }
    
    const reais = numeroLimpo.substring(0, numeroLimpo.length - 2);
    const centavos = numeroLimpo.substring(numeroLimpo.length - 2);
    
    return `${reais},${centavos}`;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isModalSubmit() || interaction.customId !== 'modal_fila_1v1') return;

    const { valores, titulo } = loadValoresConfig(); 
    const configEmbed = getConfigEmbedFilas();
    
    if (valores.length === 0) {
        await interaction.reply({ content: `${emojis.failuser_emoji} Nao foi possivel carregar os valores da fila (1v1)`, ephemeral: true });
        return;
    }
    
    const canalId = interaction.fields.getTextInputValue('canal_id');
    const modo = interaction.fields.getTextInputValue('modo_fila');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('gel_normal')
        .setLabel('Gel Normal')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.gelzin_liox),
      new ButtonBuilder()
        .setCustomId('gel_infinito')
        .setLabel('Gel Infinito')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(emojis.gelzin_liox),
      new ButtonBuilder()
        .setCustomId('sair_fila_1v1')
        .setLabel('Sair da Fila')
        .setStyle(ButtonStyle.Danger)
        .setEmoji(emojis._ban_emoji)
    );

    await interaction.deferReply({ ephemeral: true });
    
    let canal;
    try {
        canal = await interaction.guild.channels.fetch(canalId).catch(() => null);

        if (!canal || canal.type !== ChannelType.GuildText) {
            return interaction.editReply({ content: `${emojis.failuser_emoji} O ID fornecido nao corresponde a um canal de texto valido` });
        }
        
        const botPermissions = canal.permissionsFor(interaction.client.user);
        if (!botPermissions.has(PermissionsBitField.Flags.SendMessages) || !botPermissions.has(PermissionsBitField.Flags.ViewChannel)) {
             return interaction.editReply({ content: `${emojis.failuser_emoji} O bot nao tem permissao para enviar mensagens no canal` });
        }
        
    } catch (error) {
        return interaction.editReply({ content: `${emojis.failuser_emoji} Falha ao encontrar ou acessar o canal` });
    }
    
    let filasDB = getFilasDB();

    for (const valorConfigurado of valores) {
        
      const valorExibicao = formatarValorParaExibicao(valorConfigurado);
        
      if (!filasDB[valorConfigurado]) {
        filasDB[valorConfigurado] = []; 
      }
      let jogadores = filasDB[valorConfigurado];
      
      let jogadoresStr = jogadores.length > 0
        ? jogadores.map(j => `<@${j.id}> | ${j.tipo}`).join('\n')
        : 'Nenhum jogador na fila.';
        
      const embed = new EmbedBuilder()
        .setTitle(`${emojis._star_emoji || ''} ${titulo}`)
        .setThumbnail(interaction.guild.iconURL() || null)
        .setColor(configEmbed.cor || '#FF9900')
        .addFields(
          { name: `${emojis.command_emoji || ''} MODO`, value: `fila ${modo}`, inline: false },
          { name: `${emojis._money_emoji || ''} VALOR`, value: `R$ ${valorExibicao}`, inline: false }, 
          { name: `${emojis._people_emoji || ''} JOGADORES`, value: jogadoresStr, inline: false }
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
          valor: valorConfigurado,
          modo,
          canalId, 
          tipo: 'Gel Normal / Gel Infinito', 
          jogadores: [],
          status: 'aberta'
        });
      } catch (e) {
         console.error(`Erro ao enviar fila 1v1:`, e);
      }
    }
    
    saveFilasDB(filasDB);
    await interaction.editReply({ content: `${emojis.confirmed_emoji} Filas criadas com sucesso no canal <#${canalId}>` });
  }
};