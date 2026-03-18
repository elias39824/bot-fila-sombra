const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const filasPath = path.join(__dirname, '../DataBaseJson/filasMisto.json');
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');
const configPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');
const configEmbedFilasPath = path.join(__dirname, '../DataBaseJson/configEmbedFilas.json');

// --- FUNÇÕES AUXILIARES ---

function getFilasDB() {
  try {
    if (!fs.existsSync(filasPath)) {
      fs.writeFileSync(filasPath, JSON.stringify({}), 'utf-8');
      return {};
    }
    const data = fs.readFileSync(filasPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[FILA MISTO] Erro ao ler filas:', error);
    return {};
  }
}

function saveFilasDB(db) {
  try {
    fs.writeFileSync(filasPath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('[FILA MISTO] Erro ao salvar filas:', error);
  }
}

function saveFilaDados(msgId, dados) {
  try {
    let db = {};
    if (fs.existsSync(filasDadosPath)) {
      const data = fs.readFileSync(filasDadosPath, 'utf-8');
      db = JSON.parse(data);
    }
    db[msgId] = dados;
    fs.writeFileSync(filasDadosPath, JSON.stringify(db, null, 2), 'utf-8');
    console.log(`[FILA MISTO] 💾 Dados salvos - MsgID: ${msgId}`);
  } catch (error) {
    console.error('[FILA MISTO] Erro ao salvar dados da fila:', error);
  }
}

function getConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        valores_misto: ['100,90', '50,90', '20,90', '10,90', '5,90', '2,90', '1,90'],
        titulo_misto: 'FILA MISTO | 0% DE TAXA'
      };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      return defaultConfig;
    }
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    return config && typeof config === 'object' ? config : {};
  } catch (error) {
    console.error('[FILA MISTO] Erro ao ler config:', error);
    return {
      valores_misto: ['100,90', '50,90', '20,90', '10,90', '5,90', '2,90', '1,90'],
      titulo_misto: 'FILA MISTO | 0% DE TAXA'
    };
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
    console.error('[FILA MISTO] Erro ao ler config embed:', error);
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
    if (!interaction.isModalSubmit() || interaction.customId !== 'modal_fila_misto') return;

    console.log('[FILA MISTO] 🎯 Modal recebido!');

    await interaction.deferReply({ ephemeral: true });

    try {
      // ===== ETAPA 1: COLETAR DADOS =====
      console.log('[FILA MISTO] 📝 Coletando dados do modal...');
      
      const canalId = interaction.fields.getTextInputValue('canal_id').trim();
      const modo = interaction.fields.getTextInputValue('modo_fila').trim();
      const formato = interaction.fields.getTextInputValue('formato_fila').trim();

      console.log(`[FILA MISTO] Canal ID: ${canalId}`);
      console.log(`[FILA MISTO] Modo: ${modo}`);
      console.log(`[FILA MISTO] Formato: ${formato}`);

      if (!canalId || !modo || !formato) {
        console.log('[FILA MISTO] ❌ Campos vazios detectados');
        return interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} **Erro:** Todos os campos são obrigatórios!`
        });
      }

      // ===== ETAPA 2: VALIDAR FORMATO =====
      const formatosValidos = ['2x2', '3x3', '4x4'];
      if (!formatosValidos.includes(formato)) {
        console.log(`[FILA MISTO] ❌ Formato inválido: ${formato}`);
        return interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} **Erro:** Formato inválido!\n\n` +
                   `Formatos permitidos: **2x2**, **3x3** ou **4x4**\n` +
                   `Você digitou: \`${formato}\``
        });
      }

      // ===== ETAPA 3: CARREGAR CONFIGURAÇÕES =====
      console.log('[FILA MISTO] ⚙️ Carregando configurações...');
      
      const config = getConfig();
      const valores = config.valores_misto || ['100,90', '50,90', '20,90', '10,90', '5,90', '2,90', '1,90'];
      const tituloFila = config.titulo_misto || 'FILA MISTO | 0% DE TAXA';
      const configEmbed = getConfigEmbedFilas();

      console.log(`[FILA MISTO] Título: ${tituloFila}`);
      console.log(`[FILA MISTO] Valores: ${valores.join(', ')}`);
      console.log(`[FILA MISTO] Cor: ${configEmbed.cor}`);

      // ===== ETAPA 4: VALIDAR CANAL =====
      console.log('[FILA MISTO] 🔍 Buscando canal...');
      
      let canal;
      try {
        canal = await interaction.guild.channels.fetch(canalId);
        console.log(`[FILA MISTO] ✅ Canal encontrado: ${canal.name}`);
      } catch (error) {
        console.log(`[FILA MISTO] ❌ Canal não encontrado: ${error.message}`);
        return interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} **Erro:** Canal não encontrado!\n\n` +
                   `ID fornecido: \`${canalId}\``
        });
      }

      if (canal.type !== ChannelType.GuildText) {
        return interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} **Erro:** O canal precisa ser de texto!`
        });
      }

      // ===== ETAPA 5: VERIFICAR PERMISSÕES =====
      const botPermissions = canal.permissionsFor(interaction.client.user);
      if (!botPermissions || !botPermissions.has(PermissionsBitField.Flags.SendMessages) || !botPermissions.has(PermissionsBitField.Flags.EmbedLinks)) {
        return interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} **Erro:** O bot não tem permissão para enviar mensagens/embeds em ${canal}!`
        });
      }

      // ===== ETAPA 6: CRIAR BOTÕES DE ACORDO COM O FORMATO =====
      console.log(`[FILA MISTO] 🎨 Criando botões para formato ${formato}...`);
      
      let buttons = [];
      if (formato === '2x2') {
        buttons = [
          new ButtonBuilder()
            .setCustomId('emu_1')
            .setLabel('1 emu')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emojis.emu_liox || '🦙'),
          new ButtonBuilder()
            .setCustomId('sair_fila_misto')
            .setLabel('Sair da Fila')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojis._ban_emoji || '❌')
        ];
      } else if (formato === '3x3') {
        buttons = [
          new ButtonBuilder()
            .setCustomId('emu_1')
            .setLabel('1 emu')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emojis.emu_liox || '🦙'),
          new ButtonBuilder()
            .setCustomId('emu_2')
            .setLabel('2 emu')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emojis.emu_liox || '🦙'),
          new ButtonBuilder()
            .setCustomId('sair_fila_misto')
            .setLabel('Sair da Fila')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojis._ban_emoji || '❌')
        ];
      } else if (formato === '4x4') {
        buttons = [
          new ButtonBuilder()
            .setCustomId('emu_1')
            .setLabel('1 emu')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emojis.emu_liox || '🦙'),
          new ButtonBuilder()
            .setCustomId('emu_2')
            .setLabel('2 emu')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emojis.emu_liox || '🦙'),
          new ButtonBuilder()
            .setCustomId('emu_3')
            .setLabel('3 emu')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(emojis.emu_liox || '🦙'),
          new ButtonBuilder()
            .setCustomId('sair_fila_misto')
            .setLabel('Sair da Fila')
            .setStyle(ButtonStyle.Danger)
            .setEmoji(emojis._ban_emoji || '❌')
        ];
      }

      const row = new ActionRowBuilder().addComponents(buttons);
      console.log(`[FILA MISTO] ✅ ${buttons.length} botões criados`);

      // ===== ETAPA 7: ENVIAR FILAS =====
      console.log('[FILA MISTO] 📤 Iniciando envio das filas...');
      
      let filasDB = getFilasDB();
      let filasEnviadas = 0;
      let erros = [];

      for (let i = 0; i < valores.length; i++) {
        const valor = valores[i];
        console.log(`[FILA MISTO] 📋 Processando fila ${i + 1}/${valores.length} - R$ ${valor}`);

        try {
          // Inicializa a fila
          if (!filasDB[valor]) {
            filasDB[valor] = [];
          }

          const jogadoresStr = filasDB[valor].length > 0
            ? filasDB[valor].map(j => `<@${j.id}> | ${j.time.replace('emu_', '').toUpperCase()} EMU`).join('\n')
            : 'Nenhum jogador na fila.';

          // Cria o embed
          const embed = new EmbedBuilder()
            .setTitle(`${emojis._star_emoji || '⭐'} ${tituloFila}`)
            .setColor(configEmbed.cor || '#FF9900')
            .addFields(
              { name: `${emojis.command_emoji || '🎮'} MODO`, value: `\`${modo}\``, inline: false },
              { name: `${emojis._money_emoji || '💰'} VALOR`, value: `R$ ${valor}`, inline: false },
              { name: 'Formato', value: `\`${formato}\``, inline: false },
              { name: `${emojis._people_emoji || '👥'} JOGADORES`, value: jogadoresStr, inline: false }
            )
            .setTimestamp();

          if (interaction.guild.iconURL()) {
            embed.setThumbnail(interaction.guild.iconURL());
          }

          if (configEmbed.banner_url) {
            embed.setImage(configEmbed.banner_url);
          }

          if (configEmbed.footer_text || configEmbed.footer_icon_url) {
            embed.setFooter({
              text: configEmbed.footer_text || `@${interaction.user.username}`,
              iconURL: configEmbed.footer_icon_url || interaction.user.displayAvatarURL()
            });
          } else {
            embed.setFooter({ 
              text: `@${interaction.user.username}`, 
              iconURL: interaction.user.displayAvatarURL() 
            });
          }

          console.log(`[FILA MISTO] 📤 Enviando mensagem para R$ ${valor}...`);

          // Envia a mensagem
          const msg = await canal.send({ 
            embeds: [embed], 
            components: [row] 
          });

          console.log(`[FILA MISTO] ✅ Mensagem enviada! ID: ${msg.id}`);

          // Salva os dados
          saveFilaDados(msg.id, {
            valor: valor,
            modo: modo,
            formato: formato,
            jogadores: filasDB[valor],
            status: 'aberta',
            tipoFila: 'misto',
            canalId: canal.id,
            messageId: msg.id,
            criadaEm: Date.now()
          });

          filasEnviadas++;
          console.log(`[FILA MISTO] ✅ Fila ${i + 1}/${valores.length} criada com sucesso`);

          // Delay para evitar rate limit
          if (i < valores.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

        } catch (error) {
          console.error(`[FILA MISTO] ❌ Erro ao enviar fila R$ ${valor}:`, error);
          erros.push(`R$ ${valor}: ${error.message}`);
        }
      }

      // Salva o banco
      saveFilasDB(filasDB);
      console.log(`[FILA MISTO] 💾 Banco de dados salvo`);

      // ===== ETAPA 8: RESPONDER =====
      console.log(`[FILA MISTO] 📊 Resultado: ${filasEnviadas}/${valores.length} filas enviadas`);

      if (filasEnviadas > 0) {
        let mensagem = `${emojis.confirmed_emoji || '✅'} **${filasEnviadas} fila(s) mista(s) criada(s) com sucesso!**\n\n`;
        mensagem += `📍 **Canal:** ${canal}\n`;
        mensagem += `📜 **Modo:** \`${modo}\`\n`;
        mensagem += `📐 **Formato:** \`${formato}\`\n`;
        mensagem += `💰 **Valores:** ${valores.join(', ')}\n`;
        mensagem += `📊 **Enviadas:** ${filasEnviadas}/${valores.length}`;

        if (erros.length > 0) {
          mensagem += `\n\n⚠️ **Erros:**\n\`\`\`\n${erros.join('\n')}\n\`\`\``;
        }

        await interaction.editReply({ content: mensagem });
        console.log('[FILA MISTO] ✅ Processo concluído com sucesso!');
      } else {
        await interaction.editReply({
          content: `${emojis.failuser_emoji || '❌'} **Nenhuma fila foi criada!**\n\n**Erros:**\n\`\`\`\n${erros.join('\n')}\n\`\`\``
        });
        console.log('[FILA MISTO] ❌ Processo concluído com erros');
      }

    } catch (error) {
      console.error('[FILA MISTO] ❌❌❌ ERRO FATAL:', error);
      console.error('[FILA MISTO] Stack:', error.stack);
      
      await interaction.editReply({
        content: `${emojis.failuser_emoji || '❌'} **Erro crítico:**\n\`\`\`\n${error.message}\n\`\`\`\n\nVerifique os logs do console!`
      }).catch(err => {
        console.error('[FILA MISTO] ❌ Não foi possível enviar resposta de erro:', err);
      });
    }
  }
};