const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

function getTaxaServico() {
  try {
    const configPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    return config.taxa_servico !== undefined ? config.taxa_servico : 0.40;
  } catch {
    return 0.40; // Taxa padrão
  }
}

function calcularValorTotal(valor) {
  const v = parseFloat(valor.replace(',', '.'));
  
  // Total da sala = apenas o valor das apostas (sem a taxa)
  // Como são 2 jogadores, multiplica por 2
  const total = v * 2;
  
  return total.toFixed(2).replace('.', ',');
}

function parseIdSenha(texto) {
  // Remove espaços e quebras de linha extras
  const limpo = texto.trim().replace(/\s+/g, '\n');
  const linhas = limpo.split('\n').filter(l => l.trim().length > 0);
  
  // Se tiver 2 linhas, considera primeira como ID e segunda como senha
  if (linhas.length === 2) {
    return {
      id: linhas[0].trim(),
      senha: linhas[1].trim()
    };
  }
  
  // Se tiver apenas 1 linha, retorna null
  return null;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit()) return;
    
    // Verifica se é uma interação relacionada à aposta
    if (
      !/^copiar_id_aposta|copiar_senha_aposta|alterar_valor_aposta|enviar_id_aposta|enviar_senha_aposta$/.test(interaction.customId) &&
      !/^modal_alterar_valor_aposta|modal_enviar_id|modal_enviar_senha$/.test(interaction.customId)
    ) return;

    const panel = global.apostaGoPanel && global.apostaGoPanel[interaction.channel.id];
    if (!panel) {
      if (interaction.isButton()) {
        await interaction.reply({ content: 'Dados da aposta não encontrados!', ephemeral: true });
      }
      return;
    }

    // ==========================================
    // BOTÃO: COPIAR ID
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'copiar_id_aposta') {
      await interaction.reply({ 
        content: `**ID da Sala**\n\`\`\`${panel.id}\`\`\`\n*Copie o código acima*`, 
        ephemeral: true 
      });
      return;
    }

    // ==========================================
    // BOTÃO: COPIAR SENHA
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'copiar_senha_aposta') {
      await interaction.reply({ 
        content: `**Senha da Sala**\n\`\`\`${panel.senha}\`\`\`\n*Copie o código acima*`, 
        ephemeral: true 
      });
      return;
    }

    // ==========================================
    // BOTÃO: ENVIAR ID (ABRE MODAL)
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'enviar_id_aposta') {
      const modal = new ModalBuilder()
        .setCustomId('modal_enviar_id')
        .setTitle('Enviar ID da Sala');

      const input = new TextInputBuilder()
        .setCustomId('novo_id')
        .setLabel('Digite o ID da sala')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Ex: 1234567891');

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);
      
      await interaction.showModal(modal);
      return;
    }

    // ==========================================
    // MODAL: PROCESSAR NOVO ID
    // ==========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_enviar_id') {
      const novoId = interaction.fields.getTextInputValue('novo_id').trim();

      if (!novoId || novoId.length < 3) {
        return interaction.reply({
          content: '❌ ID inválido! Digite um ID válido.',
          ephemeral: true
        });
      }

      // Atualiza o ID no painel
      panel.id = novoId;
      global.apostaGoPanel[interaction.channel.id] = panel;

      // Atualiza o embed
      const embedAtual = interaction.message.embeds[0];
      const novoEmbed = EmbedBuilder.from(embedAtual)
        .setDescription(
          `> **ID da Sala**\n` +
          `> \`${panel.id}\`\n\n` +
          `> **Senha da Sala**\n` +
          `> \`${panel.senha}\`\n\n` +
          `> **Valor Total a Pagar**\n` +
          `> **R$ ${panel.valorComTaxa || panel.valor}**`
        );

      try {
        await interaction.message.edit({ embeds: [novoEmbed] });
        
        await interaction.reply({
          content: `✅ **ID atualizado com sucesso!**\n\n> **Novo ID:** \`${novoId}\``,
          ephemeral: true
        });
      } catch (error) {
        console.error('Erro ao atualizar ID:', error);
        await interaction.reply({
          content: '❌ Erro ao atualizar o ID.',
          ephemeral: true
        }).catch(() => {});
      }
      return;
    }

    // ==========================================
    // BOTÃO: ENVIAR SENHA (ABRE MODAL)
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'enviar_senha_aposta') {
      const modal = new ModalBuilder()
        .setCustomId('modal_enviar_senha')
        .setTitle('Enviar Senha da Sala');

      const input = new TextInputBuilder()
        .setCustomId('nova_senha')
        .setLabel('Digite a senha da sala')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Ex: 22');

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);
      
      await interaction.showModal(modal);
      return;
    }

    // ==========================================
    // MODAL: PROCESSAR NOVA SENHA
    // ==========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_enviar_senha') {
      const novaSenha = interaction.fields.getTextInputValue('nova_senha').trim();

      if (!novaSenha || novaSenha.length < 1) {
        return interaction.reply({
          content: '❌ Senha inválida! Digite uma senha válida.',
          ephemeral: true
        });
      }

      // Atualiza a senha no painel
      panel.senha = novaSenha;
      global.apostaGoPanel[interaction.channel.id] = panel;

      // Atualiza o embed
      const embedAtual = interaction.message.embeds[0];
      const novoEmbed = EmbedBuilder.from(embedAtual)
        .setDescription(
          `> **ID da Sala**\n` +
          `> \`${panel.id}\`\n\n` +
          `> **Senha da Sala**\n` +
          `> \`${panel.senha}\`\n\n` +
          `> **Valor Total a Pagar**\n` +
          `> **R$ ${panel.valorComTaxa || panel.valor}**`
        );

      try {
        await interaction.message.edit({ embeds: [novoEmbed] });
        
        await interaction.reply({
          content: `✅ **Senha atualizada com sucesso!**\n\n> **Nova Senha:** \`${novaSenha}\``,
          ephemeral: true
        });
      } catch (error) {
        console.error('Erro ao atualizar senha:', error);
        await interaction.reply({
          content: '❌ Erro ao atualizar a senha.',
          ephemeral: true
        }).catch(() => {});
      }
      return;
    }

    // ==========================================
    // BOTÃO: ALTERAR VALOR
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'alterar_valor_aposta') {
      const modal = new ModalBuilder()
        .setCustomId('modal_alterar_valor_aposta')
        .setTitle('Alterar Valor da Aposta');

      const input = new TextInputBuilder()
        .setCustomId('novo_valor')
        .setLabel('Novo valor da aposta')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Ex: 20,00 ou 20.00');

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);
      
      await interaction.showModal(modal);
      return;
    }

    // ==========================================
    // MODAL: ALTERAR VALOR
    // ==========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_alterar_valor_aposta') {
      let novoValor = interaction.fields.getTextInputValue('novo_valor');
      
      // Limpa e formata o valor
      novoValor = novoValor.replace(/[^\d,\.]/g, '').replace('.', ',');
      
      const taxa = getTaxaServico();
      const valorComTaxa = (parseFloat(novoValor.replace(',', '.')) + taxa).toFixed(2).replace('.', ',');
      const novoValorTotal = calcularValorTotal(novoValor);

      // Cria embed atualizada
      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('__Informações da Sala__')
        .setDescription(
          `> **ID da Sala**\n` +
          `> \`${panel.id}\`\n\n` +
          `> **Senha da Sala**\n` +
          `> \`${panel.senha}\`\n\n` +
          `> **Valor Total a Pagar**\n` +
          `> **R$ ${valorComTaxa}**`
        )
        .setFooter({ text: 'Boa sorte na partida!' })
        .setTimestamp();

      // Cria botões
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('copiar_id_aposta')
          .setLabel('Copiar ID')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('copiar_senha_aposta')
          .setLabel('Copiar Senha')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('enviar_id_aposta')
          .setLabel('Enviar ID')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('enviar_senha_aposta')
          .setLabel('Enviar Senha')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('alterar_valor_aposta')
          .setLabel('Alterar Valor')
          .setStyle(ButtonStyle.Success)
      );

      try {
        // Atualiza a mensagem
        await interaction.message.edit({ embeds: [embed], components: [row] });

        // Atualiza nome do canal
        await interaction.channel.setName(`pagar-${novoValorTotal}`).catch(() => {});

        // Atualiza dados no painel global
        global.apostaGoPanel[interaction.channel.id] = { 
          ...panel, 
          valor: novoValor,
          taxa: taxa,
          valorComTaxa: valorComTaxa,
          valorTotal: novoValorTotal,
          msgId: interaction.message.id 
        };

        // Atualiza filasDados.json
        try {
          const filePath = path.join(__dirname, '../DataBaseJson/filasDados.json');
          let filasDados = {};
          if (fs.existsSync(filePath)) {
            filasDados = JSON.parse(fs.readFileSync(filePath));
          }
          if (filasDados[interaction.channel.id]) {
            filasDados[interaction.channel.id].valor = novoValor;
            fs.writeFileSync(filePath, JSON.stringify(filasDados, null, 2));
          }
        } catch (error) {
          console.error('Erro ao atualizar filasDados.json:', error);
        }

        await interaction.reply({ 
          content: `**Valor atualizado com sucesso!**\n\n` +
                   `> **Valor da aposta:** R$ ${novoValor}\n` +
                   `> **Taxa de serviço:** R$ ${taxa.toFixed(2).replace('.', ',')}\n` +
                   `> **Você deve pagar:** __R$ ${valorComTaxa}__\n` +
                   `> **Total da sala:** R$ ${novoValorTotal}`, 
          ephemeral: true 
        });
        
      } catch (error) {
        console.error('Erro ao atualizar valor:', error);
        await interaction.reply({ 
          content: 'Erro ao alterar o valor. Tente novamente.', 
          ephemeral: true 
        }).catch(() => {});
      }
    }
  }
};