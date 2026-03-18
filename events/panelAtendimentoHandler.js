const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');
const ticketConfigPath = path.join(__dirname, '../DataBaseJson/ticketconfig.json');
const configIds = require('../DataBaseJson/configuracoes.json');
const atendimentosPath = path.join(__dirname, '../DataBaseJson/atendimentos.json');

function getTicketConfig() {
  return JSON.parse(fs.readFileSync(ticketConfigPath));
}
function saveTicketConfig(config) {
  fs.writeFileSync(ticketConfigPath, JSON.stringify(config, null, 2));
}

function getAtendimentos() {
  if (!fs.existsSync(atendimentosPath)) return {};
  return JSON.parse(fs.readFileSync(atendimentosPath));
}
function saveAtendimentos(db) {
  fs.writeFileSync(atendimentosPath, JSON.stringify(db, null, 2));
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    console.log('interactionCreate:', interaction.type, interaction.customId || interaction.commandName || '');
    // Filtro para só processar selects do painel de tickets
    if (interaction.isStringSelectMenu() && !['ticket_select_remover_funcao', 'ticket_select', 'ticket_control_select'].includes(interaction.customId)) return;

    // Botão Atendimento do painel
    if (interaction.isButton() && interaction.customId === 'panel_atendimento') {
      const config = getTicketConfig();
      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle(`${emojis._support_emoji} Configuração de Ticket`)
        .setDescription('Personalize o painel de tickets usando os botões abaixo.');
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_definir_design').setLabel('Definir Design').setStyle(ButtonStyle.Primary).setEmoji(emojis._star_emoji),
        new ButtonBuilder().setCustomId('ticket_personalizar').setLabel('Personalizar').setStyle(ButtonStyle.Secondary).setEmoji(emojis._pincel_emoji),
        new ButtonBuilder().setCustomId('ticket_add_funcao').setLabel('Adicionar Função').setStyle(ButtonStyle.Success).setEmoji(emojis._add_emoji),
        new ButtonBuilder().setCustomId('ticket_remover_funcao').setLabel('Remover Função').setStyle(ButtonStyle.Danger).setEmoji(emojis._trash_emoji)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_toggle_modo')
          .setLabel(config.modo === 'buttons' ? 'Mudar para Select Menu' : 'Mudar para Buttons')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._settings_emoji),
        new ButtonBuilder().setCustomId('ticket_enviar')
          .setLabel('Enviar')
          .setStyle(ButtonStyle.Primary)
          .setEmoji(emojis._send_emoji),
        new ButtonBuilder().setCustomId('ticket_voltar')
          .setLabel('Voltar')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emojis._back_emoji)
      );
      await interaction.update({ embeds: [embed], components: [row1, row2] });
      return;
    }

    // Modal Definir Design
    if (interaction.isButton() && interaction.customId === 'ticket_definir_design') {
      const config = getTicketConfig();
      const modal = new ModalBuilder().setCustomId('modal_ticket_design').setTitle('Definir Design do Ticket');
      const tituloInput = new TextInputBuilder().setCustomId('titulo').setLabel('Título do Ticket').setStyle(TextInputStyle.Short).setRequired(true).setValue(config.titulo || '');
      const descInput = new TextInputBuilder().setCustomId('descricao').setLabel('Descrição do Ticket').setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(config.descricao || '');
      modal.addComponents(
        new ActionRowBuilder().addComponents(tituloInput),
        new ActionRowBuilder().addComponents(descInput)
      );
      await interaction.showModal(modal);
      return;
    }
    if (interaction.isModalSubmit() && interaction.customId === 'modal_ticket_design') {
      const config = getTicketConfig();
      config.titulo = interaction.fields.getTextInputValue('titulo');
      config.descricao = interaction.fields.getTextInputValue('descricao');
      saveTicketConfig(config);
      await interaction.reply({ content: `${emojis.confirmed_emoji} Design atualizado!`, ephemeral: true });
      return;
    }

    // Modal Personalizar
    if (interaction.isButton() && interaction.customId === 'ticket_personalizar') {
      const config = getTicketConfig();
      const modal = new ModalBuilder().setCustomId('modal_ticket_personalizar').setTitle('Personalizar Ticket');
      const bannerInput = new TextInputBuilder().setCustomId('url_banner').setLabel('URL do Banner').setStyle(TextInputStyle.Short).setRequired(true).setValue(config.url_banner || '');
      const thumbInput = new TextInputBuilder().setCustomId('url_thumbnail').setLabel('URL da Thumbnail').setStyle(TextInputStyle.Short).setRequired(true).setValue(config.url_thumbnail || '');
      modal.addComponents(
        new ActionRowBuilder().addComponents(bannerInput),
        new ActionRowBuilder().addComponents(thumbInput)
      );
      await interaction.showModal(modal);
      return;
    }
    if (interaction.isModalSubmit() && interaction.customId === 'modal_ticket_personalizar') {
      const config = getTicketConfig();
      config.url_banner = interaction.fields.getTextInputValue('url_banner');
      config.url_thumbnail = interaction.fields.getTextInputValue('url_thumbnail');
      saveTicketConfig(config);
      await interaction.reply({ content: `${emojis.confirmed_emoji} Personalização atualizada!`, ephemeral: true });
      return;
    }

    // Modal Adicionar Função
    if (interaction.isButton() && interaction.customId === 'ticket_add_funcao') {
      const modal = new ModalBuilder().setCustomId('modal_ticket_add_funcao').setTitle('Adicionar Função ao Ticket');
      const labelInput = new TextInputBuilder().setCustomId('label').setLabel('Nome da Função').setStyle(TextInputStyle.Short).setRequired(true);
      const colorInput = new TextInputBuilder().setCustomId('color').setLabel('Cor do Botão (verde, vermelho, cinza, azul)').setStyle(TextInputStyle.Short).setRequired(true);
      const descInput = new TextInputBuilder().setCustomId('description').setLabel('Descrição').setStyle(TextInputStyle.Short).setRequired(true);
      const emojiInput = new TextInputBuilder().setCustomId('emoji').setLabel('Emoji').setStyle(TextInputStyle.Short).setRequired(false);
      modal.addComponents(
        new ActionRowBuilder().addComponents(labelInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(emojiInput)
      );
      await interaction.showModal(modal);
      return;
    }
    if (interaction.isModalSubmit() && interaction.customId === 'modal_ticket_add_funcao') {
      const config = getTicketConfig();
      config.funcoes = config.funcoes || [];
      const label = interaction.fields.getTextInputValue('label');
      // Automatiza o valor interno
      const value = label
        .normalize('NFD').replace(/[^\w\s]/g, '').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/ /g, '_');
      // Cor do botão
      const colorInput = interaction.fields.getTextInputValue('color').toLowerCase();
      let style = 'Secondary';
      if (colorInput === 'verde') style = 'Success';
      else if (colorInput === 'vermelho') style = 'Danger';
      else if (colorInput === 'azul') style = 'Primary';
      else if (colorInput === 'cinza') style = 'Secondary';
      config.funcoes.push({
        label,
        id: value,
        style,
        description: interaction.fields.getTextInputValue('description'),
        emoji: interaction.fields.getTextInputValue('emoji')
      });
      saveTicketConfig(config);
      await interaction.reply({ content: `${emojis.confirmed_emoji} Função adicionada!`, ephemeral: true });
      return;
    }

    // Remover Função
    if (interaction.isButton() && interaction.customId === 'ticket_remover_funcao') {
      const config = getTicketConfig();
      if (!config.funcoes || config.funcoes.length === 0) {
        await interaction.reply({ content: `${emojis.negative_emoji} Nenhuma função para remover.`, ephemeral: true });
        return;
      }
      const select = new StringSelectMenuBuilder()
        .setCustomId('ticket_select_remover_funcao')
        .setPlaceholder('Selecione a função para remover')
        .addOptions(config.funcoes.map(f => ({
          label: f.label,
          value: f.id,
          description: f.description,
          emoji: f.emoji || undefined
        })));
      const row = new ActionRowBuilder().addComponents(select);
      await interaction.reply({ content: 'Selecione a função para remover:', components: [row], ephemeral: true });
      return;
    }
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_remover_funcao') {
      try {
        console.log('Início remoção função');
        const config = getTicketConfig();
        console.log('Config carregado:', config);
        const idRemover = interaction.values[0];
        const antes = config.funcoes.length;
        config.funcoes = (config.funcoes || []).filter(f => f.id !== idRemover);
        const depois = config.funcoes.length;
        console.log(`Funções antes: ${antes}, depois: ${depois}`);
        saveTicketConfig(config);
        console.log('Config salvo');
        await interaction.update({ content: `${emojis.confirmed_emoji} Função removida!`, components: [] });
        console.log('Mensagem de confirmação enviada');
      } catch (err) {
        console.error('Erro ao remover função:', err);
        // Não tente responder novamente à interação!
      }
      return;
    }

    // Alternar modo
    if (interaction.isButton() && interaction.customId === 'ticket_toggle_modo') {
      const config = getTicketConfig();
      config.modo = config.modo === 'buttons' ? 'select_menu' : 'buttons';
      saveTicketConfig(config);
      await interaction.reply({ content: `${emojis.confirmed_emoji} Modo alterado para: ${config.modo}`, ephemeral: true });
      return;
    }

    // Enviar painel
    if (interaction.isButton() && interaction.customId === 'ticket_enviar') {
      const modal = new ModalBuilder().setCustomId('modal_ticket_enviar').setTitle('Enviar Painel de Ticket');
      const canalInput = new TextInputBuilder().setCustomId('canal_id').setLabel('ID do Canal').setStyle(TextInputStyle.Short).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(canalInput));
      await interaction.showModal(modal);
      return;
    }
    if (interaction.isModalSubmit() && interaction.customId === 'modal_ticket_enviar') {
      const config = getTicketConfig();
      const canalId = interaction.fields.getTextInputValue('canal_id');
      const canal = interaction.guild.channels.cache.get(canalId);
      if (!canal) {
        await interaction.reply({ content: `${emojis.negative_emoji} Canal não encontrado!`, ephemeral: true });
        return;
      }
      // Monta painel conforme config
      let content = '';
      let embed = null;
      if (config.embed) {
        embed = new EmbedBuilder()
          .setTitle(config.titulo)
          .setDescription(config.descricao)
          .setColor('#2b2d31');
        if (config.url_banner) embed.setImage(config.url_banner);
        if (config.url_thumbnail) embed.setThumbnail(config.url_thumbnail);
      } else {
        content = `**${config.titulo}**\n${config.descricao}`;
      }
      let components = [];
      if (config.modo === 'buttons') {
        const allButtons = config.funcoes || [];
        // Dividir em linhas de até 5 botões por ActionRow
        for (let i = 0; i < allButtons.length; i += 5) {
          components.push(
            new ActionRowBuilder().addComponents(
              ...allButtons.slice(i, i + 5).map(btn => {
                const b = new ButtonBuilder()
                  .setCustomId(btn.id)
                  .setLabel(btn.label)
                  .setStyle(ButtonStyle[btn.style] || ButtonStyle.Secondary);
                if (btn.emoji) b.setEmoji(btn.emoji);
                return b;
              })
            )
          );
        }
      } else if (config.modo === 'select_menu') {
        components = [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('ticket_select')
              .setPlaceholder('Selecione uma opção')
              .addOptions((config.funcoes || []).map(opt => ({
                label: opt.label,
                value: opt.id,
                description: opt.description,
                emoji: opt.emoji || undefined
              })))
          )
        ];
      }
      await canal.send({ content, embeds: embed ? [embed] : [], components });
      await interaction.reply({ content: `${emojis.confirmed_emoji} Painel enviado no canal <#${canalId}>!`, ephemeral: true });
      return;
    }

    // Handler para botões de função (abrir ticket)
    if (interaction.isButton() && interaction.customId) {
      const config = getTicketConfig();
      const funcao = (config.funcoes || []).find(f => f.id === interaction.customId);
      if (funcao) {
        // Verifica se o usuário já é membro de alguma thread de ticket aberta na guild
        const allThreads = await interaction.guild.channels.fetchActiveThreads();
        let userHasThread = false;
        for (const thread of allThreads.threads.values()) {
            if (thread.name.startsWith('ticket-')) {
                try {
                    const members = await thread.members.fetch();
                    if (members.has(interaction.user.id)) {
                        userHasThread = true;
                        break;
                    }
                } catch (err) {
                    console.error('Erro ao verificar membros da thread:', err);
                }
            }
        }

        if (userHasThread) {
          await interaction.reply({ content: 'Você já possui um ticket aberto! Feche o ticket atual antes de abrir outro.', ephemeral: true });
          return;
        }
        const canal = interaction.channel;
        const nomeThread = `ticket-${funcao.id}-${interaction.user.username}`.slice(0, 90);
        const thread = await canal.threads.create({
          name: nomeThread,
          autoArchiveDuration: 1440,
          type: 12 // GUILD_PRIVATE_THREAD
        });
        await thread.members.add(interaction.user.id);
        // Permitir cargos admin e suporte verem a thread
        try {
          await thread.members.add(configIds.administrador);
        } catch {}
        try {
          await thread.members.add(configIds.suporte);
        } catch {}
        
        // Menu de Controle Atualizado com as novas funções
        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('Ticket — Painel de Controle')
          .setDescription('Seja bem-vindo(a) ao painel de controle deste ticket. Dependendo do horário em que este ticket foi aberto, os atendimentos podem demorar um pouquinho.\n\n> Em breve os atendentes irão lhe atender, peço que tenha paciência.');
          
        const select = new StringSelectMenuBuilder()
          .setCustomId('ticket_control_select')
          .setPlaceholder('Selecione a ação que deseja executar.')
          .addOptions([
            {
              label: 'Atender',
              value: 'atender',
              description: 'Clique aqui para atender este ticket.',
              emoji: emojis.status_on
            },
            {
              label: 'Adicionar Membro',
              value: 'adicionar_membro',
              description: 'Adicione outro usuário ao ticket.',
              emoji: '👤'
            },
            {
              label: 'Criar Call',
              value: 'criar_call',
              description: 'Crie uma chamada de voz neste ticket.',
              emoji: '📞'
            },
            {
              label: 'Chamar Membro',
              value: 'chamar_membro',
              description: 'Envie um aviso para um usuário ir ao ticket.',
              emoji: '🔔'
            },
            {
              label: 'Fechar',
              value: 'fechar',
              description: 'Clique aqui para fechar este ticket.',
              emoji: emojis.status_off
            }
          ]);
          
        const row = new ActionRowBuilder().addComponents(select);
        await thread.send({
          content: `<@${interaction.user.id}> <@&${configIds.administrador}> <@&${configIds.suporte}>`,
          embeds: [embed],
          components: [row]
        });
        await interaction.reply({ content: `${emojis.confirmed_emoji} Ticket aberto em <#${thread.id}>!`, ephemeral: true });
        return;
      }
    }

    // Handler para abrir ticket via select menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
      const config = getTicketConfig();
      const funcao = (config.funcoes || []).find(f => f.id === interaction.values[0]);
      if (funcao) {
        // Verifica se o usuário já é membro de alguma thread de ticket aberta na guild
        const allThreads = await interaction.guild.channels.fetchActiveThreads();
        let userHasThread = false;
        for (const thread of allThreads.threads.values()) {
            if (thread.name.startsWith('ticket-')) {
                try {
                    const members = await thread.members.fetch();
                    if (members.has(interaction.user.id)) {
                        userHasThread = true;
                        break;
                    }
                } catch (err) {
                    console.error('Erro ao verificar membros da thread:', err);
                }
            }
        }

        if (userHasThread) {
          await interaction.reply({ content: 'Você já possui um ticket aberto! Feche o ticket atual antes de abrir outro.', ephemeral: true });
          return;
        }

        const canal = interaction.channel;
        const nomeThread = `ticket-${funcao.id}-${interaction.user.username}`.slice(0, 90);
        const thread = await canal.threads.create({
          name: nomeThread,
          autoArchiveDuration: 1440,
          type: 12 // GUILD_PRIVATE_THREAD
        });
        await thread.members.add(interaction.user.id);
        // Permitir cargos admin e suporte verem a thread
        try {
          await thread.members.add(configIds.administrador);
        } catch {}
        try {
          await thread.members.add(configIds.suporte);
        } catch {}
        
        // Menu de Controle Atualizado com as novas funções
        const embed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setTitle('Ticket — Painel de Controle')
          .setDescription('Seja bem-vindo(a) ao painel de controle deste ticket. Dependendo do horário em que este ticket foi aberto, os atendimentos podem demorar um pouquinho.\n\n> Em breve os atendentes irão lhe atender, peço que tenha paciência.');
          
        const select = new StringSelectMenuBuilder()
          .setCustomId('ticket_control_select')
          .setPlaceholder('Selecione a ação que deseja executar.')
          .addOptions([
            {
              label: 'Atender',
              value: 'atender',
              description: 'Clique aqui para atender este ticket.',
              emoji: emojis.status_on
            },
            {
              label: 'Adicionar Membro',
              value: 'adicionar_membro',
              description: 'Adicione outro usuário ao ticket.',
              emoji: '👤'
            },
            {
              label: 'Criar Call',
              value: 'criar_call',
              description: 'Crie uma chamada de voz neste ticket.',
              emoji: '📞'
            },
            {
              label: 'Chamar Membro',
              value: 'chamar_membro',
              description: 'Envie um aviso para um usuário ir ao ticket.',
              emoji: '🔔'
            },
            {
              label: 'Fechar',
              value: 'fechar',
              description: 'Clique aqui para fechar este ticket.',
              emoji: emojis.status_off
            }
          ]);
          
        const row = new ActionRowBuilder().addComponents(select);
        await thread.send({
          content: `<@${interaction.user.id}> <@&${configIds.administrador}> <@&${configIds.suporte}>`,
          embeds: [embed],
          components: [row]
        });
        await interaction.reply({ content: `${emojis.confirmed_emoji} Ticket aberto em <#${thread.id}>!`, ephemeral: true });
        return;
      }
    }

    // Handler do botão Voltar
    if (interaction.isButton() && interaction.customId === 'ticket_voltar') {
      // Chama a função do comando /panel para voltar ao painel inicial
      const panelCommand = interaction.client.commands.get('panel');
      if (panelCommand) {
        await panelCommand.execute(interaction);
      } else {
        await interaction.reply({ content: 'Não foi possível voltar ao painel inicial.', ephemeral: true });
      }
      return;
    }

    // Handler do select menu de controle do ticket (NOVAS FUNÇÕES AQUI)
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_control_select') {
      console.log('Select menu acionado por:', interaction.user.id);
      const allowedRoles = [configIds.administrador, configIds.suporte];
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const hasRole = member.roles.cache.has(allowedRoles[0]) || member.roles.cache.has(allowedRoles[1]);
      if (!hasRole) {
        try {
          await interaction.reply({ content: 'Você não tem permissão para usar este menu.', ephemeral: true });
        } catch (e) {
          try { await interaction.deferUpdate(); } catch {}
        }
        return;
      }

      const selected = interaction.values[0];

      // FUNÇÃO: ADICIONAR MEMBRO
      if (selected === 'adicionar_membro') {
        try {
          const modal = new ModalBuilder()
            .setCustomId('modal_ticket_adicionar')
            .setTitle('Adicionar Membro');
          
          const idInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('ID ou Menção do Usuário')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: 123456789012345678');
            
          modal.addComponents(new ActionRowBuilder().addComponents(idInput));
          await interaction.showModal(modal);
        } catch (err) {
          console.error('Erro ao abrir modal adicionar:', err);
        }
        return;
      }

      // FUNÇÃO: CRIAR CALL
      if (selected === 'criar_call') {
        try {
          await interaction.deferUpdate();
          const channel = interaction.channel;
          
          // Verificar se já existe uma call (RTC controller)
          if (channel.rtcController) {
             await interaction.followUp({ content: '📞 Já existe uma chamada de voz ativa neste canal!', ephemeral: true });
             return;
          }

          // Criar a call
          await channel.createRTCController();
          await interaction.followUp({ content: '📞 Chamada de voz criada com sucesso!' });
        } catch (err) {
          console.error('Erro ao criar call:', err);
          await interaction.followUp({ content: 'Erro ao criar chamada de voz. Verifique minhas permissões.', ephemeral: true });
        }
        return;
      }

      // FUNÇÃO: CHAMAR MEMBRO
      if (selected === 'chamar_membro') {
        try {
          const modal = new ModalBuilder()
            .setCustomId('modal_ticket_chamar')
            .setTitle('Chamar Membro');
          
          const idInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('ID do Usuário')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: 123456789012345678');
            
          modal.addComponents(new ActionRowBuilder().addComponents(idInput));
          await interaction.showModal(modal);
        } catch (err) {
          console.error('Erro ao abrir modal chamar:', err);
        }
        return;
      }

      // FUNÇÃO EXISTENTE: ATENDER
      if (selected === 'atender') {
        try {
          const oldMenu = interaction.component;
          const newMenu = StringSelectMenuBuilder.from(oldMenu).setOptions([
            {
              label: 'Atendido',
              value: 'atender',
              description: 'Este ticket já está em atendimento.',
              emoji: emojis.status_on,
              default: true,
              disabled: true
            },
            {
              label: 'Adicionar Membro',
              value: 'adicionar_membro',
              description: 'Adicione outro usuário ao ticket.',
              emoji: '👤'
            },
            {
              label: 'Criar Call',
              value: 'criar_call',
              description: 'Crie uma chamada de voz neste ticket.',
              emoji: '📞'
            },
            {
              label: 'Chamar Membro',
              value: 'chamar_membro',
              description: 'Envie um aviso para um usuário ir ao ticket.',
              emoji: '🔔'
            },
            {
              label: 'Fechar',
              value: 'fechar',
              description: 'Clique aqui para fechar este ticket.',
              emoji: emojis.status_off
            }
          ]);
          const row = new ActionRowBuilder().addComponents(newMenu);
          await interaction.update({ components: [row] });
          // Atualiza database de atendimentos
          const atendDb = getAtendimentos();
          if (!atendDb[interaction.user.id]) atendDb[interaction.user.id] = { tickets_atendidos: 0, tickets_fechados: 0 };
          atendDb[interaction.user.id].tickets_atendidos += 1;
          saveAtendimentos(atendDb);
          const atendenteEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setDescription(`${emojis._people_emoji} Atendimento iniciado por <@${interaction.user.id}>`);
          await interaction.channel.send({ embeds: [atendenteEmbed] });
        } catch (err) {
          console.error('Erro ao processar select menu:', err);
          if (!interaction.replied && !interaction.deferred) {
            try { await interaction.reply({ content: 'Erro ao processar a ação do ticket.', ephemeral: true }); } catch {}
          }
        }
        return;
      }

      // FUNÇÃO EXISTENTE: FECHAR
      if (selected === 'fechar') {
        try {
          await interaction.deferUpdate();
          const channel = interaction.channel;
          console.log('Tentando deletar:', channel.id, channel.type, channel.isThread && channel.isThread());
          // Atualiza database de atendimentos
          const atendDb = getAtendimentos();
          if (!atendDb[interaction.user.id]) atendDb[interaction.user.id] = { tickets_atendidos: 0, tickets_fechados: 0 };
          atendDb[interaction.user.id].tickets_fechados += 1;
          saveAtendimentos(atendDb);
          // Se for thread, deleta
          if (channel.isThread && channel.isThread()) {
            await channel.delete('Ticket fechado pelo usuário.');
          } else {
            // Tenta buscar como thread pelo ID (fallback)
            const thread = await interaction.guild.channels.fetch(channel.id).catch(() => null);
            if (thread && thread.isThread && thread.isThread()) {
              await thread.delete('Ticket fechado pelo usuário.');
            } else {
              await channel.send('Não foi possível fechar o ticket: permissão insuficiente ou canal inválido.');
            }
          }
        } catch (err) {
          console.error('Erro ao fechar ticket:', err);
          if (!interaction.replied && !interaction.deferred) {
            try { await interaction.reply({ content: 'Erro ao fechar o ticket.', ephemeral: true }); } catch {}
          }
        }
        return;
      }
    }

    // Handler para Modal: ADICIONAR MEMBRO
    if (interaction.isModalSubmit() && interaction.customId === 'modal_ticket_adicionar') {
      try {
        const userIdInput = interaction.fields.getTextInputValue('user_id');
        const userId = userIdInput.replace(/[<@!>]/g, ''); // Remove <@!> se o usuário fizer menção
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        
        if (!member) {
          await interaction.reply({ content: `${emojis.negative_emoji} Usuário não encontrado.`, ephemeral: true });
          return;
        }

        const channel = interaction.channel;
        
        // Verifica se já está no ticket
        const members = await channel.members.fetch();
        if (members.has(member.id)) {
          await interaction.reply({ content: `${emojis.negative_emoji} Este usuário já está no ticket.`, ephemeral: true });
          return;
        }

        await channel.members.add(member.id);
        await interaction.reply({ content: `${emojis.confirmed_emoji} ${member.user.tag} adicionado ao ticket!` });
        await channel.send({ content: `👤 **${member.user.tag}** foi adicionado ao ticket por <@${interaction.user.id}>.` });
      } catch (error) {
        console.error('Erro ao adicionar membro:', error);
        await interaction.reply({ content: 'Erro ao adicionar membro.', ephemeral: true });
      }
      return;
    }

    // Handler para Modal: CHAMAR MEMBRO
    if (interaction.isModalSubmit() && interaction.customId === 'modal_ticket_chamar') {
      try {
        const userIdInput = interaction.fields.getTextInputValue('user_id');
        const userId = userIdInput.replace(/[<@!>]/g, '');
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        
        if (!member) {
          await interaction.reply({ content: `${emojis.negative_emoji} Usuário não encontrado.`, ephemeral: true });
          return;
        }

        const channel = interaction.channel;

        // Envia DM com botão de link
        const linkButton = new ButtonBuilder()
          .setLabel('Ir para o Ticket')
          .setStyle(ButtonStyle.Link)
          .setURL(channel.url);

        const row = new ActionRowBuilder().addComponents(linkButton);

        const dmEmbed = new EmbedBuilder()
          .setColor('#2b2d31')
          .setDescription(`🔔 Você foi chamado para o ticket **${channel.name}** por <@${interaction.user.id}>.`);

        try {
          await member.send({ embeds: [dmEmbed], components: [row] });
          await interaction.reply({ content: `${emojis.confirmed_emoji} Mensagem enviada para ${member.user.tag}!` });
        } catch (dmError) {
          await interaction.reply({ content: `${emojis.negative_emoji} Não foi possível enviar mensagem privada (DMs desativadas).`, ephemeral: true });
        }
      } catch (error) {
        console.error('Erro ao chamar membro:', error);
        await interaction.reply({ content: 'Erro ao chamar membro.', ephemeral: true });
      }
      return;
    }
  }
};