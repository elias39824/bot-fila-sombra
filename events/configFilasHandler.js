const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const configPath = path.join(__dirname, '../config.json');
const configuracoesPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');
const configEmbedFilasPath = path.join(__dirname, '../DataBaseJson/configEmbedFilas.json');
const canaisPath = path.join(__dirname, '../DataBaseJson/config_filas_canais.json');
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');

const BOTOES_VALIDOS = [
  'cfg_canais', 'cfg_valores', 'cfg_embed', 'cfg_enviar',
  'cfg_enviar_mobile', 'cfg_enviar_emu', 'cfg_enviar_misto', 'cfg_enviar_todas'
];

function isOwner(userId) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath));
    return config.ownerId === userId;
  } catch { return false; }
}

function loadJSON(filePath, def = {}) {
  if (!fs.existsSync(filePath)) return def;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); } catch { return def; }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getCanaisSalvos() {
  const db = loadJSON(canaisPath, { canais: [] });
  return db.canais || [];
}

function formatarValor(v) {
  if (typeof v !== 'string') return String(v);
  if (v.includes(',')) return v;
  const n = v.replace(/\D/g, '');
  if (n.length < 3) return '0,' + n.padStart(2, '0');
  return `${n.slice(0, -2)},${n.slice(-2)}`;
}

function saveFilaDados(msgId, dados) {
  let db = loadJSON(filasDadosPath, {});
  db[msgId] = dados;
  saveJSON(filasDadosPath, db);
}

// --- ENVIAR FILA MOBILE ---
async function enviarFilaMobile(canal, modo, guild, configEmbed, config) {
  const titulo = config.titulo_1v1 || 'FILA MOBILE | 0% DE TAXA';
  const valores = config.valores_1v1 || [];

  const filasDBPath = path.join(__dirname, '../DataBaseJson/filas1v1.json');
  let filasDB = loadJSON(filasDBPath, {});

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('gel_normal').setLabel('Gel Normal').setStyle(ButtonStyle.Secondary).setEmoji(emojis.gelzin_liox || '🧪'),
    new ButtonBuilder().setCustomId('gel_infinito').setLabel('Gel Infinito').setStyle(ButtonStyle.Secondary).setEmoji(emojis.gelzin_liox || '🧪'),
    new ButtonBuilder().setCustomId('sair_fila_1v1').setLabel('Sair da Fila').setStyle(ButtonStyle.Danger).setEmoji(emojis._ban_emoji || '🚪')
  );

  for (const valorConfigurado of valores) {
    const valorExibicao = formatarValor(valorConfigurado);
    if (!filasDB[valorConfigurado]) filasDB[valorConfigurado] = [];
    const jogadoresStr = filasDB[valorConfigurado].length > 0
      ? filasDB[valorConfigurado].map(j => `<@${j.id}> | ${j.tipo}`).join('\n')
      : 'Nenhum jogador na fila.';

    const embed = new EmbedBuilder()
      .setTitle(`${emojis._star_emoji || '⭐'} ${titulo}`)
      .setThumbnail(guild.iconURL() || null)
      .setColor(configEmbed.cor || '#FF9900')
      .addFields(
        { name: `${emojis.command_emoji || '🎮'} MODO`, value: `fila ${modo}`, inline: false },
        { name: `${emojis._money_emoji || '💰'} VALOR`, value: `R$ ${valorExibicao}`, inline: false },
        { name: `${emojis._people_emoji || '👥'} JOGADORES`, value: jogadoresStr, inline: false }
      )
      .setTimestamp();

    if (configEmbed.banner_url) embed.setImage(configEmbed.banner_url);
    if (configEmbed.footer_text || configEmbed.footer_icon_url) {
      embed.setFooter({ text: configEmbed.footer_text || 'Fila de apostas', iconURL: configEmbed.footer_icon_url || guild.iconURL() || undefined });
    }

    try {
      const msg = await canal.send({ embeds: [embed], components: [row] });
      saveFilaDados(msg.id, { valor: valorConfigurado, modo, canalId: canal.id, tipo: 'Gel Normal / Gel Infinito', jogadores: [], status: 'aberta' });
    } catch (e) {
      console.error(`[CFG FILAS] Erro ao enviar Mobile:`, e.message);
    }
  }

  saveJSON(filasDBPath, filasDB);
}

// --- ENVIAR FILA EMULADOR ---
async function enviarFilaEmulador(canal, modo, guild, configEmbed, config) {
  const titulo = config.titulo_normal || 'FILA EMULADOR | 0% DE TAXA';
  const valores = config.valores_normal || [];

  const filasDBPath = path.join(__dirname, '../DataBaseJson/filasNormal.json');
  let filasDB = loadJSON(filasDBPath, {});

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('entrar_fila_normal').setLabel('Entrar na Fila').setStyle(ButtonStyle.Success).setEmoji(emojis.confirmed_emoji || '✅'),
    new ButtonBuilder().setCustomId('sair_fila_normal').setLabel('Sair da Fila').setStyle(ButtonStyle.Danger).setEmoji(emojis._ban_emoji || '🚪')
  );

  for (const valorConfigurado of valores) {
    const valorExibicao = formatarValor(valorConfigurado);
    if (!filasDB[valorConfigurado]) filasDB[valorConfigurado] = [];
    const jogadoresStr = filasDB[valorConfigurado].length > 0
      ? filasDB[valorConfigurado].map(j => `<@${j.id}>`).join('\n')
      : 'Nenhum jogador na fila.';

    const embed = new EmbedBuilder()
      .setTitle(`${emojis._star_emoji || '⭐'} ${titulo}`)
      .setThumbnail(guild.iconURL() || null)
      .setColor(configEmbed.cor || '#FF9900')
      .addFields(
        { name: `${emojis.command_emoji || '🎮'} MODO`, value: `fila ${modo}`, inline: false },
        { name: `${emojis._money_emoji || '💰'} VALOR`, value: `R$ ${valorExibicao}`, inline: false },
        { name: `${emojis._people_emoji || '👥'} JOGADORES`, value: jogadoresStr, inline: false }
      )
      .setTimestamp();

    if (configEmbed.banner_url) embed.setImage(configEmbed.banner_url);
    if (configEmbed.footer_text || configEmbed.footer_icon_url) {
      embed.setFooter({ text: configEmbed.footer_text || 'Fila de apostas', iconURL: configEmbed.footer_icon_url || guild.iconURL() || undefined });
    }

    try {
      const msg = await canal.send({ embeds: [embed], components: [row] });
      saveFilaDados(msg.id, { valor: valorConfigurado, modo, canalId: canal.id, tipo: 'Normal', jogadores: [], status: 'aberta' });
    } catch (e) {
      console.error(`[CFG FILAS] Erro ao enviar Emulador:`, e.message);
    }
  }

  saveJSON(filasDBPath, filasDB);
}

// --- ENVIAR FILA MISTO ---
async function enviarFilaMisto(canal, modo, guild, configEmbed, config) {
  const titulo = config.titulo_misto || 'FILA MISTO | 0% DE TAXA';
  const valores = config.valores_misto || [];

  const filasDBPath = path.join(__dirname, '../DataBaseJson/filasMisto.json');
  let filasDB = loadJSON(filasDBPath, {});

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('emu_1').setLabel('1 emu').setStyle(ButtonStyle.Secondary).setEmoji(emojis.gelzin_liox || '🧪'),
    new ButtonBuilder().setCustomId('emu_2').setLabel('2 emu').setStyle(ButtonStyle.Secondary).setEmoji(emojis.gelzin_liox || '🧪'),
    new ButtonBuilder().setCustomId('sair_fila_misto').setLabel('Sair da Fila').setStyle(ButtonStyle.Danger).setEmoji(emojis._ban_emoji || '🚪')
  );

  for (const valorConfigurado of valores) {
    const valorExibicao = formatarValor(valorConfigurado);
    if (!filasDB[valorConfigurado]) filasDB[valorConfigurado] = [];
    const jogadoresStr = filasDB[valorConfigurado].length > 0
      ? filasDB[valorConfigurado].map(j => `<@${j.id}> | ${j.tipo}`).join('\n')
      : 'Nenhum jogador na fila.';

    const embed = new EmbedBuilder()
      .setTitle(`${emojis._star_emoji || '⭐'} ${titulo}`)
      .setThumbnail(guild.iconURL() || null)
      .setColor(configEmbed.cor || '#FF9900')
      .addFields(
        { name: `${emojis.command_emoji || '🎮'} MODO`, value: `fila ${modo}`, inline: false },
        { name: `${emojis._money_emoji || '💰'} VALOR`, value: `R$ ${valorExibicao}`, inline: false },
        { name: `${emojis._people_emoji || '👥'} JOGADORES`, value: jogadoresStr, inline: false }
      )
      .setTimestamp();

    if (configEmbed.banner_url) embed.setImage(configEmbed.banner_url);
    if (configEmbed.footer_text || configEmbed.footer_icon_url) {
      embed.setFooter({ text: configEmbed.footer_text || 'Fila de apostas', iconURL: configEmbed.footer_icon_url || guild.iconURL() || undefined });
    }

    try {
      const msg = await canal.send({ embeds: [embed], components: [row] });
      saveFilaDados(msg.id, { valor: valorConfigurado, modo, canalId: canal.id, tipo: 'Misto', jogadores: [], status: 'aberta' });
    } catch (e) {
      console.error(`[CFG FILAS] Erro ao enviar Misto:`, e.message);
    }
  }

  saveJSON(filasDBPath, filasDB);
}

// --- HANDLER PRINCIPAL ---
module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {

    // =========================================================
    // BOTÕES DO PAINEL PRINCIPAL
    // =========================================================
    if (interaction.isButton() && BOTOES_VALIDOS.includes(interaction.customId)) {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      }

      // --- CANAIS ---
      if (interaction.customId === 'cfg_canais') {
        const canaisSalvos = getCanaisSalvos();
        const embed = new EmbedBuilder()
          .setTitle('📺 Configurar Canais')
          .setDescription(
            canaisSalvos.length > 0
              ? `**Canais salvos:**\n${canaisSalvos.map(id => `<#${id}>`).join('\n')}\n\nSelecione novos canais para substituir:`
              : 'Nenhum canal configurado ainda.\nSelecione os canais onde as filas serão enviadas:'
          )
          .setColor(0x5865F2);

        const select = new ChannelSelectMenuBuilder()
          .setCustomId('cfg_canais_select')
          .setPlaceholder('Selecione os canais...')
          .setMinValues(1)
          .setMaxValues(10);

        const row = new ActionRowBuilder().addComponents(select);
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // --- VALORES ---
      if (interaction.customId === 'cfg_valores') {
        const config = loadJSON(configuracoesPath);
        const v1v1 = (config.valores_1v1 || []).join(', ');
        const vNormal = (config.valores_normal || []).join(', ');
        const vMisto = (config.valores_misto || []).join(', ');

        const modal = new ModalBuilder()
          .setCustomId('cfg_valores_modal')
          .setTitle('💰 Configurar Valores');

        const input1 = new TextInputBuilder()
          .setCustomId('valores_mobile')
          .setLabel('Valores Mobile (separados por vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(v1v1)
          .setRequired(true);

        const input2 = new TextInputBuilder()
          .setCustomId('valores_emulador')
          .setLabel('Valores Emulador (separados por vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(vNormal)
          .setRequired(true);

        const input3 = new TextInputBuilder()
          .setCustomId('valores_misto')
          .setLabel('Valores Misto (separados por vírgula)')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(vMisto)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input1),
          new ActionRowBuilder().addComponents(input2),
          new ActionRowBuilder().addComponents(input3)
        );

        return interaction.showModal(modal);
      }

      // --- EMBED ---
      if (interaction.customId === 'cfg_embed') {
        const config = loadJSON(configuracoesPath);
        const configEmbed = loadJSON(configEmbedFilasPath, { cor: '#FF9900', banner_url: '', footer_text: '' });

        const modal = new ModalBuilder()
          .setCustomId('cfg_embed_modal')
          .setTitle('🎨 Configurar Embed das Filas');

        const input1 = new TextInputBuilder()
          .setCustomId('embed_org')
          .setLabel('Nome da Org (ex: ORG SOMBRA)')
          .setStyle(TextInputStyle.Short)
          .setValue(config.titulo_1v1 || 'ORG SOMBRA')
          .setRequired(true);

        const input2 = new TextInputBuilder()
          .setCustomId('embed_cor')
          .setLabel('Cor do Embed (hex, ex: #FF9900)')
          .setStyle(TextInputStyle.Short)
          .setValue(configEmbed.cor || '#FF9900')
          .setRequired(true);

        const input3 = new TextInputBuilder()
          .setCustomId('embed_banner')
          .setLabel('URL do Banner (deixe em branco para sem banner)')
          .setStyle(TextInputStyle.Short)
          .setValue(configEmbed.banner_url || '')
          .setRequired(false);

        const input4 = new TextInputBuilder()
          .setCustomId('embed_footer')
          .setLabel('Texto do Footer (deixe em branco para padrão)')
          .setStyle(TextInputStyle.Short)
          .setValue(configEmbed.footer_text || '')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(input1),
          new ActionRowBuilder().addComponents(input2),
          new ActionRowBuilder().addComponents(input3),
          new ActionRowBuilder().addComponents(input4)
        );

        return interaction.showModal(modal);
      }

      // --- ENVIAR FILAS (sub-painel) ---
      if (interaction.customId === 'cfg_enviar') {
        const canais = getCanaisSalvos();
        const embed = new EmbedBuilder()
          .setTitle('📤 Enviar Filas')
          .setDescription(
            canais.length > 0
              ? `**Canais configurados:**\n${canais.map(id => `<#${id}>`).join('\n')}\n\nEscolha quais filas enviar:`
              : '⚠️ Nenhum canal configurado! Use o botão **Canais** primeiro.'
          )
          .setColor(0x57F287);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_enviar_mobile').setLabel('Mobile').setStyle(ButtonStyle.Primary).setEmoji('📱'),
          new ButtonBuilder().setCustomId('cfg_enviar_emu').setLabel('Emulador').setStyle(ButtonStyle.Primary).setEmoji('💻'),
          new ButtonBuilder().setCustomId('cfg_enviar_misto').setLabel('Misto').setStyle(ButtonStyle.Primary).setEmoji('🔀'),
          new ButtonBuilder().setCustomId('cfg_enviar_todas').setLabel('Enviar Todas').setStyle(ButtonStyle.Success).setEmoji('✅')
        );

        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      // --- BOTÕES DE ENVIO (abrem modal de modo) ---
      const tipoMap = {
        'cfg_enviar_mobile': ['mobile', '📱 Enviar Fila Mobile'],
        'cfg_enviar_emu':    ['emulador', '💻 Enviar Fila Emulador'],
        'cfg_enviar_misto':  ['misto', '🔀 Enviar Fila Misto'],
        'cfg_enviar_todas':  ['todas', '✅ Enviar Todas as Filas']
      };

      if (tipoMap[interaction.customId]) {
        const [tipo, titulo] = tipoMap[interaction.customId];
        const modal = new ModalBuilder()
          .setCustomId(`cfg_modo_modal_${tipo}`)
          .setTitle(titulo);

        const input = new TextInputBuilder()
          .setCustomId('modo_jogo')
          .setLabel('Modo de Jogo (ex: Mobile, PC, Free Fire)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Mobile')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
    }

    // =========================================================
    // SELECT MENU — SALVAR CANAIS
    // =========================================================
    if (interaction.isChannelSelectMenu() && interaction.customId === 'cfg_canais_select') {
      if (!isOwner(interaction.user.id)) {
        return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      }

      const canais = interaction.values;
      saveJSON(canaisPath, { canais });

      const embed = new EmbedBuilder()
        .setTitle('✅ Canais Salvos!')
        .setDescription(`Os seguintes canais foram configurados:\n${canais.map(id => `<#${id}>`).join('\n')}`)
        .setColor(0x57F287);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // =========================================================
    // MODAIS
    // =========================================================
    if (!interaction.isModalSubmit()) return;

    // --- MODAL VALORES ---
    if (interaction.customId === 'cfg_valores_modal') {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

      const parseValores = (str) =>
        str.split(',').map(v => v.trim()).filter(v => v.length > 0);

      const config = loadJSON(configuracoesPath);
      config.valores_1v1 = parseValores(interaction.fields.getTextInputValue('valores_mobile'));
      config.valores_normal = parseValores(interaction.fields.getTextInputValue('valores_emulador'));
      config.valores_misto = parseValores(interaction.fields.getTextInputValue('valores_misto'));
      saveJSON(configuracoesPath, config);

      return interaction.reply({
        content: `✅ **Valores atualizados!**\n📱 Mobile: ${config.valores_1v1.join(', ')}\n💻 Emulador: ${config.valores_normal.join(', ')}\n🔀 Misto: ${config.valores_misto.join(', ')}`,
        ephemeral: true
      });
    }

    // --- MODAL EMBED ---
    if (interaction.customId === 'cfg_embed_modal') {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

      const org = interaction.fields.getTextInputValue('embed_org');
      const cor = interaction.fields.getTextInputValue('embed_cor');
      const banner = interaction.fields.getTextInputValue('embed_banner');
      const footer = interaction.fields.getTextInputValue('embed_footer');

      const config = loadJSON(configuracoesPath);
      config.titulo_1v1 = org;
      config.titulo_normal = org;
      config.titulo_misto = org;
      saveJSON(configuracoesPath, config);

      const configEmbed = loadJSON(configEmbedFilasPath, {});
      configEmbed.cor = cor || '#FF9900';
      configEmbed.banner_url = banner || null;
      configEmbed.footer_text = footer || null;
      saveJSON(configEmbedFilasPath, configEmbed);

      return interaction.reply({
        content: `✅ **Embed atualizado!**\n🏷️ Org: \`${org}\`\n🎨 Cor: \`${cor}\`\n🖼️ Banner: ${banner || 'sem banner'}\n📝 Footer: ${footer || 'padrão'}`,
        ephemeral: true
      });
    }

    // --- MODAIS DE ENVIO ---
    const modoModalPrefixo = 'cfg_modo_modal_';
    if (interaction.customId.startsWith(modoModalPrefixo)) {
      if (!isOwner(interaction.user.id)) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });

      const tipo = interaction.customId.replace(modoModalPrefixo, '');
      const modo = interaction.fields.getTextInputValue('modo_jogo');
      const canais = getCanaisSalvos();

      if (canais.length === 0) {
        return interaction.reply({ content: '❌ Nenhum canal configurado! Use o botão **Canais** primeiro.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const config = loadJSON(configuracoesPath);
      const configEmbed = loadJSON(configEmbedFilasPath, { cor: '#FF9900' });
      const guild = interaction.guild;

      let totalEnviados = 0;
      let erros = 0;

      for (const canalId of canais) {
        let canal;
        try {
          canal = await guild.channels.fetch(canalId);
        } catch {
          erros++;
          continue;
        }

        try {
          if (tipo === 'mobile' || tipo === 'todas') {
            await enviarFilaMobile(canal, modo, guild, configEmbed, config);
            totalEnviados++;
          }
          if (tipo === 'emulador' || tipo === 'todas') {
            await enviarFilaEmulador(canal, modo, guild, configEmbed, config);
            totalEnviados++;
          }
          if (tipo === 'misto' || tipo === 'todas') {
            await enviarFilaMisto(canal, modo, guild, configEmbed, config);
            totalEnviados++;
          }
        } catch (e) {
          console.error(`[CFG FILAS] Erro ao enviar para canal ${canalId}:`, e.message);
          erros++;
        }
      }

      const tipoNome = { mobile: '📱 Mobile', emulador: '💻 Emulador', misto: '🔀 Misto', todas: '✅ Todas' }[tipo] || tipo;

      await interaction.editReply({
        content:
          `✅ **Filas enviadas!**\n` +
          `📋 Tipo: ${tipoNome}\n` +
          `🎮 Modo: \`${modo}\`\n` +
          `📺 Canais enviados: ${canais.length - erros}/${canais.length}` +
          (erros > 0 ? `\n⚠️ Erros em ${erros} canal(is) — verifique permissões.` : '')
      });
    }
  }
};
