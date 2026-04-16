const client = require("../index")
const { EmbedBuilder, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelSelectMenuBuilder } = require("discord.js")

module.exports = {
  name: "interactionCreate",
  run: async (interaction) => {
    
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu()) return;
    
    // ID da categoria fixa
    const CATEGORIA_ID = "1492624280180232342";
    
    const updateEmbed = () => {
      const data = client.database.get(`match_${interaction.message.id}`);
      if (!data) return;
      
      const config = client.database.get(`config_${interaction.guild.id}`) || {};
      
      const gelNormalPlayers = data?.gelnormal || [];
      const gelInfinitoPlayers = data?.gelinfinito || [];
      const todosJogadores = [...gelNormalPlayers, ...gelInfinitoPlayers];
      
      let jogadoresText = "Nenhum jogador na fila";
      if (todosJogadores.length === 1) {
        jogadoresText = `<@${todosJogadores[0]}>`;
      } else if (todosJogadores.length > 1) {
        jogadoresText = todosJogadores.map(id => `<@${id}>`).join(", ");
      }
      
      const embed = new EmbedBuilder()
        .setAuthor({ 
          name: config.autor || "CAVALO APOSTAS", 
          iconURL: config.autorIcone || interaction.guild.iconURL() 
        })
        .setTitle(config.titulo || `${data.type} | CAVALO APOSTAS`)
        .setThumbnail(config.thumbnail || null)
        .setDescription(`**Modo:**\n${data.modo}\n\n**Valor:**\nR$ ${data.valor},00\n\n**Jogadores:**\n${jogadoresText}`)
        .setColor(config.cor ? parseInt(config.cor.replace("#", ""), 16) : 0x2b2d31)
        .setFooter({ text: "Venha Apostar", iconURL: config.banner || null });
      
      interaction.message.edit({ embeds: [embed] }).catch(() => {});
    }
    
    // Função para pegar o primeiro mediador da fila
    const getAndRemoveFirstMediador = (guildId) => {
      let filaMediadores = client.database.get(`fila_mediadores_${guildId}`) || [];
      if (filaMediadores.length === 0) return null;
      
      const primeiroMediador = filaMediadores[0];
      filaMediadores = filaMediadores.filter(id => id !== primeiroMediador);
      client.database.set(`fila_mediadores_${guildId}`, filaMediadores);
      
      return primeiroMediador;
    }
    
    // ============================================================
    // ========== SISTEMA DE CONFIGURAÇÃO DE FILAS (NOVO) ========
    // ============================================================

    // Helpers de draft
    const getDraft = () => client.database.get(`fila_draft_${interaction.guild.id}_${interaction.user.id}`) || {};
    const saveDraft = (d) => client.database.set(`fila_draft_${interaction.guild.id}_${interaction.user.id}`, d);

    // ---- ABRIR PAINEL PRINCIPAL (3 botões) ----
    if (interaction.customId === "config_filas") {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Sem permissão!", ephemeral: true });
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const d = getDraft();
      // Inicializa apenas se não houver draft ainda (não reseta dados já configurados)
      if (!d || Object.keys(d).length === 0) {
        saveDraft({ valores: null, taxa: null, modalidade: null, modalidadeKey: null, canais: {} });
      }
      const embed = new EmbedBuilder()
        .setTitle("🎮 | Configurar Filas")
        .setDescription(
          "Escolha o que deseja configurar:\n\n" +
          `💰 **Valores** — ${d.valores?.length ? d.valores.map(v => `R$ ${v}`).join(", ") : "❌ Não configurado"}\n` +
          `🏦 **Taxa da Sala** — ${(d.taxa !== null && d.taxa !== undefined) ? `${d.taxa}%` : "❌ Não configurado"}\n` +
          `🕹️ **Modalidades** — ${d.modalidade ? `✅ ${d.modalidade}` : "❌ Não configurado"}`
        )
        .setColor(0x5865f2)
        .setFooter({ text: "Painel de Configuração de Filas" });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("fila_cfg_valores").setLabel("💰 Valores").setStyle(d.valores?.length ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("fila_cfg_taxa").setLabel("🏦 Taxa da Sala").setStyle((d.taxa !== null && d.taxa !== undefined) ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("fila_cfg_modalidades").setLabel("🕹️ Modalidades").setStyle(d.modalidade ? ButtonStyle.Success : ButtonStyle.Primary)
      );
      return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    }

    // ---- BOTÃO VALORES → abre modal ----
    if (interaction.customId === "fila_cfg_valores") {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Sem permissão!", ephemeral: true });
      const modal = new ModalBuilder().setCustomId("fila_modal_valores").setTitle("💰 Valores de Entrada");
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("fila_input_valores")
          .setLabel("Valores separados por vírgula")
          .setPlaceholder("Ex: 100,50,40,30,20,10")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ));
      return interaction.showModal(modal).catch(() => {});
    }

    // ---- MODAL VALORES submetido ----
    if (interaction.customId === "fila_modal_valores") {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const raw = interaction.fields.getTextInputValue("fila_input_valores");
      const valores = raw.split(",").map(v => v.trim()).filter(v => v && !isNaN(parseFloat(v)));
      if (!valores.length)
        return interaction.editReply({ content: "❌ | Nenhum valor válido! Use números separados por vírgula." }).catch(() => {});
      const d = getDraft();
      d.valores = valores;
      saveDraft(d);
      const embed = new EmbedBuilder()
        .setTitle("✅ | Valores Salvos")
        .setDescription(`Valores configurados:\n\n${valores.map(v => `**R$ ${v}**`).join("  •  ")}`)
        .setColor(0x2ecc71);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("fila_cfg_valores").setLabel("🔄 Alterar Valores").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("config_filas_voltar").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    }

    // ---- BOTÃO TAXA → abre modal ----
    if (interaction.customId === "fila_cfg_taxa") {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Sem permissão!", ephemeral: true });
      const modal = new ModalBuilder().setCustomId("fila_modal_taxa").setTitle("🏦 Taxa da Sala");
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("fila_input_taxa")
          .setLabel("Taxa da sala (número decimal)")
          .setPlaceholder("Ex: 0.50  ou  10  ou  2.5")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ));
      return interaction.showModal(modal).catch(() => {});
    }

    // ---- MODAL TAXA submetido ----
    if (interaction.customId === "fila_modal_taxa") {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const raw = interaction.fields.getTextInputValue("fila_input_taxa");
      const taxa = parseFloat(raw.replace(",", "."));
      if (isNaN(taxa))
        return interaction.editReply({ content: "❌ | Valor inválido! Use um número, ex: `0.50` ou `10`." }).catch(() => {});
      const d = getDraft();
      d.taxa = taxa;
      saveDraft(d);
      const embed = new EmbedBuilder()
        .setTitle("✅ | Taxa Salva")
        .setDescription(`Taxa da sala configurada: **${taxa}%**`)
        .setColor(0x2ecc71);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("fila_cfg_taxa").setLabel("🔄 Alterar Taxa").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("config_filas_voltar").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    }

    // ---- VOLTAR AO PAINEL PRINCIPAL ----
    if (interaction.customId === "config_filas_voltar") {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Sem permissão!", ephemeral: true });
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const d = getDraft();
      const embed = new EmbedBuilder()
        .setTitle("🎮 | Configurar Filas")
        .setDescription(
          "Escolha o que deseja configurar:\n\n" +
          `💰 **Valores** — ${d.valores?.length ? d.valores.map(v => `R$ ${v}`).join(", ") : "❌ Não configurado"}\n` +
          `🏦 **Taxa da Sala** — ${(d.taxa !== null && d.taxa !== undefined) ? `${d.taxa}%` : "❌ Não configurado"}\n` +
          `🕹️ **Modalidades** — ${d.modalidade ? `✅ ${d.modalidade}` : "❌ Não configurado"}`
        )
        .setColor(0x5865f2)
        .setFooter({ text: "Painel de Configuração de Filas" });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("fila_cfg_valores").setLabel("💰 Valores").setStyle(d.valores?.length ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("fila_cfg_taxa").setLabel("🏦 Taxa da Sala").setStyle((d.taxa !== null && d.taxa !== undefined) ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("fila_cfg_modalidades").setLabel("🕹️ Modalidades").setStyle(d.modalidade ? ButtonStyle.Success : ButtonStyle.Primary)
      );
      return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    }

    // ---- BOTÃO MODALIDADES ----
    if (interaction.customId === "fila_cfg_modalidades") {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Sem permissão!", ephemeral: true });
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const d = getDraft();
      const modList = [
        { nome: "Mobile",   emoji: "📱", key: "fila_mod_mobile",  isMisto: false },
        { nome: "Emulador", emoji: "💻", key: "fila_mod_emulador", isMisto: false },
        { nome: "Misto",    emoji: "🔀", key: "fila_mod_misto",    isMisto: true  },
      ];
      // Cada modalidade vira uma coluna inline
      const fields = modList.map(mod => {
        const tipos = mod.isMisto ? ["2v2", "3v3", "4v4"] : ["1v1", "2v2", "3v3", "4v4"];
        const linhas = tipos.map(t => {
          const canalId = d.canais?.[`${mod.nome}_${t}`];
          return canalId ? `**${t}** — <#${canalId}>` : `**${t}** — ❌`;
        });
        return {
          name: `${mod.emoji} ${mod.nome}`,
          value: linhas.join("\n"),
          inline: true
        };
      });
      const embed = new EmbedBuilder()
        .setTitle("🕹️ | Modalidades")
        .setDescription("Escolha a modalidade para configurar os canais.\n\n⚠️ **Misto** não possui 1v1.")
        .addFields(fields)
        .setColor(0x5865f2);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("fila_mod_mobile").setLabel("📱 Mobile").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("fila_mod_emulador").setLabel("💻 Emulador").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("fila_mod_misto").setLabel("🔀 Misto").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("config_filas_voltar").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
      );
      const rowApagar = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("fila_apagar_todas").setLabel("🗑️ Apagar Todas as Filas").setStyle(ButtonStyle.Danger)
      );
      return interaction.editReply({ embeds: [embed], components: [row, rowApagar] }).catch(() => {});
    }

    // ---- APAGAR TODAS AS FILAS ----
    if (interaction.customId === "fila_apagar_todas") {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Sem permissão!", ephemeral: true });
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      const todasKeys = Object.keys(client.database.data || {}).filter(k => k.startsWith("match_"));
      let apagadas = 0;

      for (const key of todasKeys) {
        const msgId = key.replace("match_", "");
        for (const canal of interaction.guild.channels.cache.filter(c => c.type === 0).values()) {
          try {
            const msg = await canal.messages.fetch(msgId).catch(() => null);
            if (msg) {
              await msg.delete().catch(() => {});
              apagadas++;
              break;
            }
          } catch { /* ignora */ }
        }
        client.database.delete(key);
      }

      return interaction.editReply({ content: `✅ | **${apagadas} fila(s)** apagada(s) com sucesso!` }).catch(() => {});
    }

    // ---- SELECIONOU MODALIDADE → embed de canais ----
    if (["fila_mod_mobile", "fila_mod_emulador", "fila_mod_misto"].includes(interaction.customId)) {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Sem permissão!", ephemeral: true });
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const modMap = {
        fila_mod_mobile:   { nome: "Mobile",   emoji: "📱", isMisto: false },
        fila_mod_emulador: { nome: "Emulador", emoji: "💻", isMisto: false },
        fila_mod_misto:    { nome: "Misto",    emoji: "🔀", isMisto: true  }
      };
      const mod = modMap[interaction.customId];
      const d = getDraft();
      d.modalidade = mod.nome;
      d.modalidadeKey = interaction.customId;
      if (!d.canais) d.canais = {};
      saveDraft(d);
      const tipos = mod.isMisto ? ["2v2", "3v3", "4v4"] : ["1v1", "2v2", "3v3", "4v4"];
      const fields = tipos.map(t => ({
        name: t,
        value: d.canais[`${mod.nome}_${t}`] ? `<#${d.canais[`${mod.nome}_${t}`]}>` : "❌ Não definido",
        inline: true
      }));
      const embed = new EmbedBuilder()
        .setTitle(`${mod.emoji} | ${mod.nome} — Canais por Tipo`)
        .setDescription(
          "Clique no tipo de partida para definir o canal onde a fila será enviada." +
          (mod.isMisto ? "\n⚠️ Misto não possui 1v1." : "") +
          "\n\n**Status atual:**"
        )
        .addFields(fields)
        .setColor(0x5865f2)
        .setFooter({ text: "Selecione um tipo para configurar o canal" });
      const tipoButtons = tipos.map(t =>
        new ButtonBuilder()
          .setCustomId(`fila_set_canal_${interaction.customId}_${t}`)
          .setLabel(t)
          .setStyle(d.canais[`${mod.nome}_${t}`] ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
      const rowTipos = new ActionRowBuilder().addComponents(...tipoButtons);
      const rowAcoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`fila_enviar_modal_${interaction.customId}`).setLabel("🚀 Enviar Filas").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("fila_cfg_modalidades").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({ embeds: [embed], components: [rowTipos, rowAcoes] }).catch(() => {});
    }

    // ---- SELECIONAR CANAL PARA UM TIPO ----
    if (interaction.customId.startsWith("fila_set_canal_")) {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Sem permissão!", ephemeral: true });
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const sem = interaction.customId.replace("fila_set_canal_", "");
      const modKeys = ["fila_mod_mobile", "fila_mod_emulador", "fila_mod_misto"];
      const modKey = modKeys.find(k => sem.startsWith(k));
      const tipo = sem.replace(modKey + "_", "");
      const modMap = {
        fila_mod_mobile:   { nome: "Mobile",   emoji: "📱", isMisto: false },
        fila_mod_emulador: { nome: "Emulador", emoji: "💻", isMisto: false },
        fila_mod_misto:    { nome: "Misto",    emoji: "🔀", isMisto: true  }
      };
      const mod = modMap[modKey];
      const canaisTexto = [...interaction.guild.channels.cache.filter(c => c.type === 0).values()].slice(0, 25);
      const embed = new EmbedBuilder()
        .setTitle(`📢 | Canal — ${mod.nome} ${tipo}`)
        .setDescription(`Selecione o canal para a fila de **${mod.nome} ${tipo}**:`)
        .setColor(0x5865f2);
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`fila_canal_select_${modKey}_${tipo}`)
        .setPlaceholder("📢 Selecione um canal...")
        .addOptions(
          canaisTexto.map(c =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`#${c.name}`.slice(0, 100))
              .setValue(c.id)
              .setDescription(c.parent ? `em ${c.parent.name}`.slice(0, 100) : "Canal de texto")
          )
        );
      const rowSelect = new ActionRowBuilder().addComponents(selectMenu);
      const rowVoltar = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(modKey).setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({ embeds: [embed], components: [rowSelect, rowVoltar] }).catch(() => {});
    }

    // ---- CANAL ESCOLHIDO VIA SELECT MENU ----
    if (interaction.customId.startsWith("fila_canal_select_")) {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Sem permissão!", ephemeral: true });
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const sem = interaction.customId.replace("fila_canal_select_", "");
      const modKeys = ["fila_mod_mobile", "fila_mod_emulador", "fila_mod_misto"];
      const modKey = modKeys.find(k => sem.startsWith(k));
      const tipo = sem.replace(modKey + "_", "");
      const canalId = interaction.values[0];
      const modMap = {
        fila_mod_mobile:   { nome: "Mobile",   emoji: "📱", isMisto: false },
        fila_mod_emulador: { nome: "Emulador", emoji: "💻", isMisto: false },
        fila_mod_misto:    { nome: "Misto",    emoji: "🔀", isMisto: true  }
      };
      const mod = modMap[modKey];
      const d = getDraft();
      if (!d.canais) d.canais = {};
      d.canais[`${mod.nome}_${tipo}`] = canalId;
      saveDraft(d);
      const tiposList = mod.isMisto ? ["2v2", "3v3", "4v4"] : ["1v1", "2v2", "3v3", "4v4"];
      const fields = tiposList.map(t => ({
        name: t,
        value: d.canais[`${mod.nome}_${t}`] ? `<#${d.canais[`${mod.nome}_${t}`]}>` : "❌ Não definido",
        inline: true
      }));
      const embed = new EmbedBuilder()
        .setTitle(`${mod.emoji} | ${mod.nome} — Canais por Tipo`)
        .setDescription(
          "Clique no tipo de partida para definir o canal onde a fila será enviada." +
          (mod.isMisto ? "\n⚠️ Misto não possui 1v1." : "") +
          "\n\n**Status atual:**"
        )
        .addFields(fields)
        .setColor(0x5865f2)
        .setFooter({ text: "Selecione um tipo para configurar o canal" });
      const tipoButtons = tiposList.map(t =>
        new ButtonBuilder()
          .setCustomId(`fila_set_canal_${modKey}_${t}`)
          .setLabel(t)
          .setStyle(d.canais[`${mod.nome}_${t}`] ? ButtonStyle.Success : ButtonStyle.Secondary)
      );
      const rowTipos = new ActionRowBuilder().addComponents(...tipoButtons);
      const rowAcoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`fila_enviar_modal_${modKey}`).setLabel("🚀 Enviar Filas").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("fila_cfg_modalidades").setLabel("⬅️ Voltar").setStyle(ButtonStyle.Secondary)
      );
      return interaction.editReply({ embeds: [embed], components: [rowTipos, rowAcoes] }).catch(() => {});
    }

    // ---- ENVIAR FILAS ----
    if (interaction.customId.startsWith("fila_enviar_modal_")) {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Sem permissão!", ephemeral: true });
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const modKey = interaction.customId.replace("fila_enviar_modal_", "");
      const modMap = {
        fila_mod_mobile:   { nome: "Mobile",   emoji: "📱", isMisto: false },
        fila_mod_emulador: { nome: "Emulador", emoji: "💻", isMisto: false },
        fila_mod_misto:    { nome: "Misto",    emoji: "🔀", isMisto: true  }
      };
      const mod = modMap[modKey];
      const d = getDraft();
      if (!d.valores?.length)
        return interaction.editReply({ content: "❌ | Configure os **Valores** antes de enviar! (use o painel principal)" }).catch(() => {});
      if (d.taxa === null || d.taxa === undefined)
        return interaction.editReply({ content: "❌ | Configure a **Taxa da Sala** antes de enviar! (use o painel principal)" }).catch(() => {});
      const tiposList = mod.isMisto ? ["2v2", "3v3", "4v4"] : ["1v1", "2v2", "3v3", "4v4"];
      const semCanal = tiposList.filter(t => !d.canais?.[`${mod.nome}_${t}`]);
      if (semCanal.length)
        return interaction.editReply({ content: `❌ | Configure o canal para: **${semCanal.join(", ")}**` }).catch(() => {});
      const config = client.database.get(`config_${interaction.guild.id}`) || {};
      let enviadas = 0;
      for (const tipo of tiposList) {
        const canalId = d.canais[`${mod.nome}_${tipo}`];
        const canal = interaction.guild.channels.cache.get(canalId);
        if (!canal) continue;
        const modoCompleto = `${tipo} ${mod.nome}`;
        for (const valor of d.valores) {
          const embedFila = new EmbedBuilder()
            .setAuthor({ name: config.autor || "CAVALO APOSTAS", iconURL: config.autorIcone || interaction.guild.iconURL() })
            .setTitle(config.titulo || `${tipo} | CAVALO APOSTAS`)
            .setThumbnail(config.thumbnail || null)
            .setDescription(
              `**Modo:**\n${modoCompleto}\n\n` +
              `**Valor:**\nR$ ${valor},00\n\n` +
              `**Jogadores:**\nNenhum jogador na fila`
            )
            .setColor(config.cor ? parseInt(config.cor.replace("#", ""), 16) : 0x2b2d31)
            .setFooter({ text: "Venha Apostar", iconURL: config.banner || null });
          const rowFila = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel("Gelo Normal").setCustomId("gelnormal").setStyle(ButtonStyle.Primary).setEmoji("<:gelo:1492630115652468916>"),
            new ButtonBuilder().setLabel("Gelo Infinito").setCustomId("gelinfinito").setStyle(ButtonStyle.Primary).setEmoji("<:gelo:1492630115652468916>"),
            new ButtonBuilder().setLabel("Sair da fila").setCustomId("sair").setStyle(ButtonStyle.Danger).setEmoji("<a:emote2222:1492923538082894097>")
          );
          const msg = await canal.send({ embeds: [embedFila], components: [rowFila] }).catch(() => null);
          if (msg) {
            client.database.set(`match_${msg.id}`, { type: tipo, valor, taxa: d.taxa, modo: modoCompleto, gelnormal: [], gelinfinito: [] });
            enviadas++;
          }
        }
      }
      client.database.delete(`fila_draft_${interaction.guild.id}_${interaction.user.id}`);
      return interaction.editReply({ content: `✅ | **${enviadas} fila(s)** enviada(s) com sucesso!` }).catch(() => {});
    }

    if (interaction.customId === "config_mediadores") {
      if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({ content: "❌ | Apenas administradores podem usar isso!", ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      const embed = new EmbedBuilder()
        .setTitle("🛡️ | Configurar Mediadores")
        .setDescription(
          "Escolha uma opção abaixo:\n\n" +
          "**🔑 Configurar PIX** — Define a chave PIX do mediador (cada mediador configura a própria)\n\n" +
          "**📢 Enviar Painel** — Envia o painel de fila de mediadores para este canal"
        )
        .setColor(0x2ecc71);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("med_cfg_pix")
          .setLabel("🔑 Configurar PIX")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("med_enviar_painel")
          .setLabel("📢 Enviar Painel Mediadores")
          .setStyle(ButtonStyle.Success)
      );

      return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => {});
    }

    // ---- ADMIN: ENVIAR PAINEL MEDIADORES ----
    if (interaction.customId === "med_enviar_painel") {
      if (!interaction.member.permissions.has("Administrator"))
        return interaction.reply({ content: "❌ | Apenas administradores podem usar isso!", ephemeral: true });
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      let fila = client.database.get(`fila_mediadores_${interaction.guild.id}`) || [];
      let desc = fila.length > 0 ? fila.map(u => `<@${u}>`).join("\n") : "Nenhum mediador na fila.";

      const embedMed = new EmbedBuilder()
        .setTitle("🛡️ Fila de Mediadores | CAVALO APOSTAS")
        .setDescription("Entre ou saia da fila de mediadores.")
        .addFields({ name: "Mediadores na Fila:", value: desc })
        .setColor(0x2ecc71)
        .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

      const rowMed = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("entrar_fila_med").setLabel("Entrar na fila").setStyle(ButtonStyle.Success).setEmoji("✅"),
        new ButtonBuilder().setCustomId("sair_fila_med").setLabel("Sair da fila").setStyle(ButtonStyle.Danger).setEmoji("❌")
      );

      await interaction.channel.send({ embeds: [embedMed], components: [rowMed] }).catch(() => {});
      return interaction.editReply({ content: "✅ | Painel de mediadores enviado para o canal!" }).catch(() => {});
    }

    // ---- BOTÃO CONFIGURAR PIX (qualquer usuário pode configurar o próprio) ----
    if (interaction.customId === "med_cfg_pix") {
      const modal = new ModalBuilder().setCustomId("med_modal_pix").setTitle("🔑 Configurar sua Chave PIX");
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("med_input_pix")
          .setLabel("Sua chave PIX")
          .setPlaceholder("Ex: 12345678901 ou email@gmail.com")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      ));
      return interaction.showModal(modal).catch(() => {});
    }

    // ---- MODAL PIX SUBMETIDO ----
    if (interaction.customId === "med_modal_pix") {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const chave = interaction.fields.getTextInputValue("med_input_pix").trim();
      if (!chave)
        return interaction.editReply({ content: "❌ | Chave PIX inválida!" }).catch(() => {});
      client.database.set(`pix_${interaction.user.id}`, chave);
      return interaction.editReply({ content: `✅ | Sua chave PIX foi configurada: \`${chave}\`` }).catch(() => {});
    }

    if (interaction.customId === "config_personalizar") {
      if (!interaction.member.permissions.has("Administrator")) {
        return interaction.reply({ content: "❌ | Apenas administradores podem usar isso!", ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      const config = client.database.get(`config_${interaction.guild.id}`) || {};

      const embed = new EmbedBuilder()
        .setTitle("🎨 | Personalização do Bot")
        .setDescription(
          "Configure as cores, banner e thumbnail das embeds do bot.\n\n**Configurações atuais:**"
        )
        .addFields([
          { name: "🎨 Cor da Embed", value: config.cor ? `\`${config.cor}\`` : "❌ Não definido", inline: true },
          { name: "🖼️ Banner (Footer)", value: config.banner ? `[Ver imagem](${config.banner})` : "❌ Não definido", inline: true },
          { name: "🖼️ Thumbnail", value: config.thumbnail ? `[Ver imagem](${config.thumbnail})` : "❌ Não definido", inline: true },
          { name: "🏷️ Título", value: config.titulo || "❌ Não definido", inline: true },
          { name: "👤 Autor", value: config.autor || "❌ Não definido", inline: true },
          { name: "🖼️ Ícone do Autor", value: config.autorIcone ? `[Ver imagem](${config.autorIcone})` : "❌ Não definido", inline: true },
        ])
        .setColor(config.cor ? parseInt(config.cor.replace("#", ""), 16) : 0x2b2d31)
        .setFooter({ text: "Use .personalizar <opção> <valor> para editar via texto" });

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🎨 Cor")
          .setCustomId("personalizar_cor")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🎨"),
        new ButtonBuilder()
          .setLabel("🖼️ Banner")
          .setCustomId("personalizar_banner")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🖼️"),
        new ButtonBuilder()
          .setLabel("🖼️ Thumbnail")
          .setCustomId("personalizar_thumbnail")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🖼️"),
        new ButtonBuilder()
          .setLabel("🏷️ Título")
          .setCustomId("personalizar_titulo")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🏷️"),
        new ButtonBuilder()
          .setLabel("🔄 Resetar")
          .setCustomId("personalizar_reset")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔄")
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("👤 Autor")
          .setCustomId("personalizar_autor")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("👤"),
        new ButtonBuilder()
          .setLabel("🖼️ Ícone Autor")
          .setCustomId("personalizar_autor_icone")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("🖼️")
      );

      return interaction.editReply({ embeds: [embed], components: [row1, row2] }).catch(() => {});
    }


      // ========== HANDLERS DOS BOTÕES DE PERSONALIZAR ==========

      const abrirModalPersonalizar = async (customId, titulo, label, placeholder) => {
        const modal = new ModalBuilder().setCustomId(customId).setTitle(titulo);
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("valor_input")
            .setLabel(label)
            .setPlaceholder(placeholder)
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        ));
        return interaction.showModal(modal).catch(() => {});
      };

      if (interaction.customId === "personalizar_cor") {
        return abrirModalPersonalizar("personalizar_modal_cor", "🎨 Cor da Embed", "Cor em hexadecimal", "Ex: #5865F2");
      }
      if (interaction.customId === "personalizar_banner") {
        return abrirModalPersonalizar("personalizar_modal_banner", "🖼️ Banner (Footer)", "URL da imagem", "Ex: https://exemplo.com/banner.png");
      }
      if (interaction.customId === "personalizar_thumbnail") {
        return abrirModalPersonalizar("personalizar_modal_thumbnail", "🖼️ Thumbnail", "URL da imagem", "Ex: https://exemplo.com/thumb.png");
      }
      if (interaction.customId === "personalizar_titulo") {
        return abrirModalPersonalizar("personalizar_modal_titulo", "🏷️ Título da Embed", "Novo título", "Ex: CAVALO APOSTAS");
      }
      if (interaction.customId === "personalizar_autor") {
        return abrirModalPersonalizar("personalizar_modal_autor", "👤 Nome do Autor", "Nome do autor", "Ex: CAVALO E-SPORTS");
      }
      if (interaction.customId === "personalizar_autor_icone") {
        return abrirModalPersonalizar("personalizar_modal_autor_icone", "🖼️ Ícone do Autor", "URL da imagem", "Ex: https://exemplo.com/icone.png");
      }

      if (interaction.customId === "personalizar_reset") {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        client.database.delete(`config_${interaction.guild.id}`);
        return interaction.editReply({ content: "🔄 | Todas as configurações foram resetadas para o padrão!" }).catch(() => {});
      }

      // ---- MODAIS DE PERSONALIZAR ----
      const salvarPersonalizar = async (campo, valor, msgSucesso) => {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        const cfg = client.database.get(`config_${interaction.guild.id}`) || {};
        cfg[campo] = valor;
        client.database.set(`config_${interaction.guild.id}`, cfg);
        return interaction.editReply({ content: msgSucesso }).catch(() => {});
      };

      if (interaction.customId === "personalizar_modal_cor") {
        const valor = interaction.fields.getTextInputValue("valor_input");
        const hex = valor.replace("#", "");
        if (!/^[0-9A-Fa-f]{6}$/.test(hex))
          return (await interaction.deferReply({ ephemeral: true })) && interaction.editReply({ content: "❌ | Cor inválida! Use formato hex. Ex: `#5865F2`" }).catch(() => {});
        const corFormatada = `#${hex.toUpperCase()}`;
        return salvarPersonalizar("cor", corFormatada, `✅ | Cor alterada para ${corFormatada}!`);
      }
      if (interaction.customId === "personalizar_modal_banner") {
        const valor = interaction.fields.getTextInputValue("valor_input");
        return salvarPersonalizar("banner", valor, "✅ | Banner atualizado!");
      }
      if (interaction.customId === "personalizar_modal_thumbnail") {
        const valor = interaction.fields.getTextInputValue("valor_input");
        return salvarPersonalizar("thumbnail", valor, "✅ | Thumbnail atualizada!");
      }
      if (interaction.customId === "personalizar_modal_titulo") {
        const valor = interaction.fields.getTextInputValue("valor_input");
        return salvarPersonalizar("titulo", valor, `✅ | Título alterado para **${valor}**!`);
      }
      if (interaction.customId === "personalizar_modal_autor") {
        const valor = interaction.fields.getTextInputValue("valor_input");
        return salvarPersonalizar("autor", valor, `✅ | Autor alterado para **${valor}**!`);
      }
      if (interaction.customId === "personalizar_modal_autor_icone") {
        const valor = interaction.fields.getTextInputValue("valor_input");
        return salvarPersonalizar("autorIcone", valor, "✅ | Ícone do autor atualizado!");
      }

      // ========== BOTÃO CONFIRMAR MATCH ==========
    if (interaction.customId === "confirmar_match") {
      await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => {});
      
      const matchConfirmacao = client.database.get(`match_confirmacao_${interaction.channel.id}`);
      if (!matchConfirmacao) {
        return interaction.editReply({ content: "❌ | Sessão de confirmação expirada!", flags: ["Ephemeral"] }).catch(() => {});
      }
      
      if (!matchConfirmacao.jogadores.includes(interaction.user.id)) {
        return interaction.editReply({ content: "❌ | Você não faz parte desta partida!", flags: ["Ephemeral"] }).catch(() => {});
      }
      
      if (matchConfirmacao.confirmados.includes(interaction.user.id)) {
        return interaction.editReply({ content: "❌ | Você já confirmou!", flags: ["Ephemeral"] }).catch(() => {});
      }
      
      matchConfirmacao.confirmados.push(interaction.user.id);
      client.database.set(`match_confirmacao_${interaction.channel.id}`, matchConfirmacao);
      
      const confirmadosText = matchConfirmacao.confirmados.map(id => `<@${id}> ✅`).join("\n");
      const faltam = 2 - matchConfirmacao.confirmados.length;
      
      let embed, row;
      
      // Se os 2 confirmaram, muda para PAGAMENTO
      if (matchConfirmacao.confirmados.length === 2) {
        const mediadorId = getAndRemoveFirstMediador(interaction.guild.id);
        matchConfirmacao.mediadorId = mediadorId;
        matchConfirmacao.etapa = "pagamento";
        client.database.set(`match_confirmacao_${interaction.channel.id}`, matchConfirmacao);
        
        const pixKey = client.database.get(`pix_${mediadorId}`);
        const valorPartida = matchConfirmacao.valor;
        
        let pixMessage = "";
        if (pixKey) {
          pixMessage = `\`\`\`\n📋 CHAVE PIX PARA PAGAMENTO:\n${pixKey}\n\n💰 VALOR: R$ ${valorPartida},00\n\`\`\`\n**Instruções:**\n1️⃣ Copie a chave PIX acima\n2️⃣ Faça o pagamento de R$ ${valorPartida},00\n3️⃣ Envie o comprovante neste canal\n4️⃣ Clique em "JÁ PAGUEI" após o pagamento`;
        } else {
          pixMessage = `⚠️ | **Mediador sem PIX configurado!**\nUse \`.setpix add @${mediadorId} chave\` para configurar.`;
        }
        
        embed = new EmbedBuilder()
          .setTitle(`💰 | PAGAMENTO DA PARTIDA | CAVALO APOSTAS`)
          .setDescription(`**Modo:** ${matchConfirmacao.modo}\n**Valor:** R$ ${valorPartida},00\n\n${pixMessage}\n\n**Status:** ⏳ Aguardando pagamento dos jogadores...`)
          .setColor("Gold");
        
        const pagoButton = new ButtonBuilder()
          .setLabel("✅ JÁ PAGUEI")
          .setCustomId("pagamento_confirmar")
          .setStyle(ButtonStyle.Success)
          .setEmoji("✅");
        
        row = new ActionRowBuilder().addComponents(pagoButton);
        
      } else {
        // Ainda aguardando confirmação
        embed = new EmbedBuilder()
          .setTitle(`🎮 | Confirmação de Partida | CAVALO APOSTAS`)
          .setDescription(`**Modo:** ${matchConfirmacao.modo}\n**Valor:** R$ ${matchConfirmacao.valor},00\n\n**Confirmados:**\n${confirmadosText}\n\n*Aguardando mais ${faltam} jogador(es) confirmar...*`)
          .setColor("Yellow");
        
        const confirmarButton = new ButtonBuilder()
          .setLabel("✅ CONFIRMAR")
          .setCustomId("confirmar_match")
          .setStyle(ButtonStyle.Success)
          .setEmoji("✅");
        
        row = new ActionRowBuilder().addComponents(confirmarButton);
      }
      
      await interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => {});
      await interaction.editReply({ content: "✅ | Você confirmou!", flags: ["Ephemeral"] }).catch(() => {});
      
      return;
    }
    
    // ========== BOTÃO PAGAMENTO CONFIRMADO ==========
    if (interaction.customId === "pagamento_confirmar") {
      await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => {});
      
      const matchConfirmacao = client.database.get(`match_confirmacao_${interaction.channel.id}`);
      if (!matchConfirmacao || matchConfirmacao.etapa !== "pagamento") {
        return interaction.editReply({ content: "❌ | Etapa de pagamento não encontrada!", flags: ["Ephemeral"] }).catch(() => {});
      }
      
      if (!matchConfirmacao.jogadores.includes(interaction.user.id)) {
        return interaction.editReply({ content: "❌ | Você não faz parte desta partida!", flags: ["Ephemeral"] }).catch(() => {});
      }
      
      // Marca que o jogador pagou
      if (!matchConfirmacao.pagos) matchConfirmacao.pagos = [];
      if (!matchConfirmacao.pagos.includes(interaction.user.id)) {
        matchConfirmacao.pagos.push(interaction.user.id);
        client.database.set(`match_confirmacao_${interaction.channel.id}`, matchConfirmacao);
      }
      
      const pagosText = matchConfirmacao.pagos.map(id => `<@${id}> ✅`).join("\n");
      const faltamPagar = 2 - matchConfirmacao.pagos.length;
      
      let embed, row;
      
      // Se os 2 pagaram, inicia a partida
      if (matchConfirmacao.pagos.length === 2) {
        const mediadorId = matchConfirmacao.mediadorId;
        const valorPartida = matchConfirmacao.valor;
        const thread = interaction.channel;
        
        let embedFinal, rowFinal;
        let contentMsg = `<@${matchConfirmacao.jogadores[0]}>, <@${matchConfirmacao.jogadores[1]}>`;
        
        if (mediadorId) {
          embedFinal = new EmbedBuilder()
            .setTitle(`🔥 | PARTIDA INICIADA | CAVALO APOSTAS`)
            .setDescription(`**Mediador:** <@${mediadorId}>\n\n**Modo:** ${matchConfirmacao.modo}\n**Valor:** R$ ${valorPartida},00\n\n✅ **Pagamento confirmado!**\n\nClique em **FINALIZAR** quando a partida acabar!`)
            .setColor("Green");
          
          const button = new ButtonBuilder()
            .setLabel("🔚 FINALIZAR PARTIDA")
            .setCustomId("endmatch")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🔚");
          
          rowFinal = new ActionRowBuilder().addComponents(button);
          contentMsg = `<@${matchConfirmacao.jogadores[0]}>, <@${matchConfirmacao.jogadores[1]}>, <@${mediadorId}>`;
          
          // Atualiza a fila de mediadores
          const filaAtualizada = client.database.get(`fila_mediadores_${interaction.guild.id}`) || [];
          const embedMed = new EmbedBuilder()
            .setTitle(`🛡️ Fila de Mediadores | CAVALO APOSTAS`)
            .setDescription('Entre ou saia da fila de mediadores.')
            .addFields({ name: 'Mediadores na Fila:', value: filaAtualizada.length > 0 ? filaAtualizada.map(u => `<@${u}>`).join('\n') : 'Nenhum mediador.' })
            .setColor(0x2ecc71);
          
          const medMessage = await interaction.channel.messages.fetch().then(msgs => msgs.find(m => m.embeds[0]?.title === "🛡️ Fila de Mediadores | CAVALO APOSTAS"));
          if (medMessage) await medMessage.edit({ embeds: [embedMed] }).catch(() => {});
          
        } else {
          embedFinal = new EmbedBuilder()
            .setTitle(`🔥 | PARTIDA INICIADA | CAVALO APOSTAS`)
            .setDescription(`**Modo:** ${matchConfirmacao.modo}\n**Valor:** R$ ${valorPartida},00\n\n✅ **Pagamento confirmado!**\n\n⚠️ **Nenhum mediador disponível!**\n\nClique em **FINALIZAR** quando a partida acabar!`)
            .setColor("Green");
          
          const button = new ButtonBuilder()
            .setLabel("🔚 FINALIZAR PARTIDA")
            .setCustomId("endmatch")
            .setStyle(ButtonStyle.Danger)
            .setEmoji("🔚");
          
          rowFinal = new ActionRowBuilder().addComponents(button);
        }
        
        await thread.send({
          content: contentMsg,
          embeds: [embedFinal],
          components: [rowFinal]
        }).catch(() => {});
        
        await interaction.message.delete().catch(() => {});
        
        // Reseta a fila original
        const matchDataOriginal = client.database.get(`match_${matchConfirmacao.matchId}`);
        if (matchDataOriginal) {
          client.database.set(`match_${matchConfirmacao.matchId}`, {
            type: matchDataOriginal.type,
            valor: matchDataOriginal.valor,
            modo: matchDataOriginal.modo,
            gelnormal: [],
            gelinfinito: []
          });
        }
        
        // Atualiza a embed da fila original
        const matchChannel = await client.channels.fetch(matchConfirmacao.canalId).catch(() => null);
        if (matchChannel) {
          const matchMessages = await matchChannel.messages.fetch().catch(() => {});
          const matchMsg = matchMessages?.find(m => m.id === matchConfirmacao.matchId);
          if (matchMsg) {
            const config = client.database.get(`config_${interaction.guild.id}`) || {};
            const embedOriginal = new EmbedBuilder()
              .setAuthor({ name: config.autor || "CAVALO APOSTAS", iconURL: config.autorIcone || interaction.guild.iconURL() })
              .setTitle(config.titulo || `${matchDataOriginal?.type || "1x1"} | CAVALO APOSTAS`)
              .setThumbnail(config.thumbnail || null)
              .setDescription(`**Modo:**\n${matchDataOriginal?.modo || "Mobile"}\n\n**Valor:**\nR$ ${matchDataOriginal?.valor || "0"},00\n\n**Jogadores:**\nNenhum jogador na fila`)
              .setColor(config.cor ? parseInt(config.cor.replace("#", ""), 16) : 0x2b2d31)
              .setFooter({ text: "Venha Apostar", iconURL: config.banner || null });
            await matchMsg.edit({ embeds: [embedOriginal] }).catch(() => {});
          }
        }
        
        client.database.delete(`match_confirmacao_${interaction.channel.id}`);
        
        await interaction.editReply({ content: `✅ | Pagamento confirmado! Partida iniciada!`, flags: ["Ephemeral"] }).catch(() => {});
        
      } else {
        // Ainda aguardando pagamento
        embed = new EmbedBuilder()
          .setTitle(`💰 | PAGAMENTO DA PARTIDA | CAVALO APOSTAS`)
          .setDescription(`**Modo:** ${matchConfirmacao.modo}\n**Valor:** R$ ${matchConfirmacao.valor},00\n\n**Quem já pagou:**\n${pagosText}\n\n*Aguardando mais ${faltamPagar} jogador(es) pagarem...*\n\n⚠️ Após o pagamento, clique em "JÁ PAGUEI"`)
          .setColor("Gold");
        
        const pagoButton = new ButtonBuilder()
          .setLabel("✅ JÁ PAGUEI")
          .setCustomId("pagamento_confirmar")
          .setStyle(ButtonStyle.Success)
          .setEmoji("✅");
        
        row = new ActionRowBuilder().addComponents(pagoButton);
        
        await interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => {});
        await interaction.editReply({ content: "✅ | Pagamento registrado! Aguardando o outro jogador...", flags: ["Ephemeral"] }).catch(() => {});
      }
      
      return;
    }
    
    // ========== BOTÃO SAIR DA FILA ==========
    if (interaction.customId === "sair") {
      await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => {});
      const matchData = client.database.get(`match_${interaction.message.id}`);
      if (!matchData) return interaction.editReply({ content: ":x: | Não foi possível identificar essa fila!", flags: ["Ephemeral"] }).catch(() => {});
      
      let saiu = false;
      if (matchData.gelnormal?.includes(interaction.user.id)) {
        matchData.gelnormal = matchData.gelnormal.filter(id => id !== interaction.user.id);
        saiu = true;
      }
      if (matchData.gelinfinito?.includes(interaction.user.id)) {
        matchData.gelinfinito = matchData.gelinfinito.filter(id => id !== interaction.user.id);
        saiu = true;
      }
      
      if (saiu) {
        client.database.set(`match_${interaction.message.id}`, matchData);
        updateEmbed();
        return interaction.editReply({ content: "✅ | Você saiu da fila!", flags: ["Ephemeral"] }).catch(() => {});
      } else {
        return interaction.editReply({ content: "❌ | Você não está em nenhuma fila!", flags: ["Ephemeral"] }).catch(() => {});
      }
    }
    
    // ========== FILA DE MEDIADORES ==========
    if (interaction.customId === "entrar_fila_med") {
      await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => {});

      // Verifica se o mediador tem PIX configurado
      const pixKey = client.database.get(`pix_${interaction.user.id}`);
      if (!pixKey) {
        return interaction.editReply({
          content: "❌ | Você precisa configurar sua chave PIX antes de entrar na fila!\nPeça a um administrador para usar o painel **Configurar Mediadores → Configurar PIX**."
        }).catch(() => {});
      }

      let fila = client.database.get(`fila_mediadores_${interaction.guild.id}`) || [];
      
      if (fila.includes(interaction.user.id)) {
        return interaction.editReply({ content: "❌ | Você já está na fila!", flags: ["Ephemeral"] }).catch(() => {});
      }
      
      fila.push(interaction.user.id);
      client.database.set(`fila_mediadores_${interaction.guild.id}`, fila);
      
      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Fila de Mediadores | CAVALO APOSTAS`)
        .setDescription('Entre ou saia da fila de mediadores.')
        .addFields({ name: 'Mediadores na Fila:', value: fila.map(u => `<@${u}>`).join('\n') || 'Nenhum mediador.' })
        .setColor(0x2ecc71);
      
      await interaction.message.edit({ embeds: [embed] }).catch(() => {});
      return interaction.editReply({ content: "✅ | Você entrou na fila de mediadores!", flags: ["Ephemeral"] }).catch(() => {});
    }
    
    if (interaction.customId === "sair_fila_med") {
      await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => {});
      
      let fila = client.database.get(`fila_mediadores_${interaction.guild.id}`) || [];
      
      if (!fila.includes(interaction.user.id)) {
        return interaction.editReply({ content: "❌ | Você não está na fila!", flags: ["Ephemeral"] }).catch(() => {});
      }
      
      fila = fila.filter(id => id !== interaction.user.id);
      client.database.set(`fila_mediadores_${interaction.guild.id}`, fila);
      
      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Fila de Mediadores | CAVALO APOSTAS`)
        .setDescription('Entre ou saia da fila de mediadores.')
        .addFields({ name: 'Mediadores na Fila:', value: fila.map(u => `<@${u}>`).join('\n') || 'Nenhum mediador.' })
        .setColor(0x2ecc71);
      
      await interaction.message.edit({ embeds: [embed] }).catch(() => {});
      return interaction.editReply({ content: "✅ | Você saiu da fila de mediadores!", flags: ["Ephemeral"] }).catch(() => {});
    }
    
    // ========== BOTÃO FINALIZAR MATCH ==========
    if (interaction.customId === "endmatch") {
      interaction.deferUpdate().catch(() => {});
      interaction.channel.send("🔚 | Partida finalizada! Canal será encerrado em 10 segundos...").catch(() => {});
      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 10000);
      return;
    }
    
    // ========== BOTÕES DAS FILAS ==========
    if (interaction.customId !== "gelnormal" && interaction.customId !== "gelinfinito") return;
    
    await interaction.deferReply({ flags: ["Ephemeral"] }).catch(() => {});
    const matchData = client.database.get(`match_${interaction.message.id}`);
    if (!matchData) return interaction.editReply({
      content: ":x: | Não foi possível identificar essa fila!", flags: ["Ephemeral"]
    }).catch(() => {});

    // Bloqueia entrada na fila se não houver mediador disponível
    const filaMeds = client.database.get(`fila_mediadores_${interaction.guild.id}`) || [];
    if (filaMeds.length === 0) {
      return interaction.editReply({
        content: "❌ | Não há nenhum mediador disponível no momento! Aguarde um mediador entrar na fila.",
        flags: ["Ephemeral"]
      }).catch(() => {});
    }
    
    const other = interaction.customId === "gelinfinito" ? "gelnormal" : "gelinfinito";
    
    if (matchData[other]?.includes(interaction.user.id)) {
      matchData[other] = matchData[other].filter(id => id !== interaction.user.id);
    }
    
    if (matchData[interaction.customId]?.includes(interaction.user.id)) {
      matchData[interaction.customId] = matchData[interaction.customId].filter(id => id !== interaction.user.id);
      client.database.set(`match_${interaction.message.id}`, matchData);
      updateEmbed();
      return interaction.editReply({
        content: "✅ | Você saiu da fila!", flags: ["Ephemeral"]
      }).catch(() => {});
    }
    
    if (matchData[interaction.customId]?.length === 1 && matchData[interaction.customId][0] !== interaction.user.id) {
      const player1 = matchData[interaction.customId][0];
      const player2 = interaction.user.id;
      
      matchData[interaction.customId] = [];
      client.database.set(`match_${interaction.message.id}`, matchData);
      updateEmbed();
      
      // CRIA O THREAD DENTRO DA CATEGORIA FIXA
      const categoria = interaction.guild.channels.cache.get(CATEGORIA_ID);
      let thread = null;
      
      // Verifica se a categoria existe
      if (categoria && categoria.type === 4) {
        try {
          thread = await categoria.threads.create({
            name: `confirmacao_${interaction.user.username}`,
            type: ChannelType.PrivateThread,
            reason: `Partida entre ${player1} e ${player2}`
          });
        } catch (error) {
          console.error("Erro ao criar thread na categoria:", error);
        }
      } else {
        console.log(`Categoria ${CATEGORIA_ID} não encontrada!`);
      }
      
      // Se não conseguiu criar na categoria, cria no canal atual
      if (!thread) {
        thread = await interaction.channel.threads.create({
          name: `confirmacao_${interaction.user.username}`,
          type: ChannelType.PrivateThread
        }).catch(() => null);
      }
      
      if (!thread) return interaction.editReply({ content: "❌ | Erro ao criar canal!", flags: ["Ephemeral"] });
      
      const embedConfirmacao = new EmbedBuilder()
        .setTitle(`🎮 | CONFIRMAÇÃO DE PARTIDA | CAVALO APOSTAS`)
        .setDescription(`**Modo:** ${matchData.modo}\n**Valor:** R$ ${matchData.valor},00\n\n**Clique em CONFIRMAR para iniciar a partida!**`)
        .setColor("Yellow");
      
      const confirmarButton = new ButtonBuilder()
        .setLabel("✅ CONFIRMAR")
        .setCustomId("confirmar_match")
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅");
      
      const row = new ActionRowBuilder().addComponents(confirmarButton);
      
      await thread.send({
        content: `<@${player1}>, <@${player2}>`,
        embeds: [embedConfirmacao],
        components: [row]
      }).catch(() => {});
      
      client.database.set(`match_confirmacao_${thread.id}`, {
        jogadores: [player1, player2],
        confirmados: [],
        pagos: [],
        modo: matchData.modo,
        valor: matchData.valor,
        matchId: interaction.message.id,
        canalId: interaction.channel.id,
        etapa: "confirmacao"
      });
      
      await interaction.editReply({ 
        content: `✅ | Match encontrado! Canal de confirmação criado: ${thread}`, 
        flags: ["Ephemeral"] 
      }).catch(() => {});
      
    } else {
      matchData[interaction.customId].push(interaction.user.id);
      client.database.set(`match_${interaction.message.id}`, matchData);
      updateEmbed();
      return interaction.editReply({ content: `✅ | Você entrou na fila!`, flags: ["Ephemeral"] }).catch(() => {});
    }
  }
}