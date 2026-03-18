const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const configPath = path.join(__dirname, '../DataBaseJson/configuracoes.json');

function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        taxa_servico: 1.80,
        pontos_vitoria: 3
      };
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      return defaultConfig;
    }
    
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {
      taxa_servico: 1.80,
      pontos_vitoria: 3
    };
  }
}

function saveConfig(config) {
  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    
    // ===============================
    // BOTÃO: Abrir Modal de Pontos
    // ===============================
    if (interaction.isButton() && interaction.customId === 'config_pontos') {
      const configAtual = loadConfig();
      const pontosAtuais = configAtual.pontos_vitoria || 3;

      const modal = new ModalBuilder()
        .setCustomId('modal_config_pontos')
        .setTitle('⭐ Configurar Pontos por Vitória');

      const pontosInput = new TextInputBuilder()
        .setCustomId('pontos_input')
        .setLabel('Quantidade de Pontos (1-100)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(`Valor atual: ${pontosAtuais}`)
        .setValue(pontosAtuais.toString())
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(3);

      const row = new ActionRowBuilder().addComponents(pontosInput);
      modal.addComponents(row);

      await interaction.showModal(modal);
      return;
    }

    // ===============================
    // MODAL: Processar Pontos
    // ===============================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_config_pontos') {
      try {
        const pontos = interaction.fields.getTextInputValue('pontos_input');
        const pontosNum = parseInt(pontos);

        // Validações
        if (isNaN(pontosNum)) {
          const embed = new EmbedBuilder()
            .setTitle(`${emojis.failuser_emoji || '❌'} Valor Inválido`)
            .setDescription('Por favor, insira apenas números.')
            .setColor('#FF0000')
            .setTimestamp();

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (pontosNum < 1 || pontosNum > 100) {
          const embed = new EmbedBuilder()
            .setTitle(`${emojis.failuser_emoji || '❌'} Valor Fora do Limite`)
            .setDescription(
              'O valor deve estar entre **1 e 100 pontos**.\n\n' +
              `Você digitou: **${pontosNum}**`
            )
            .setColor('#FF0000')
            .setTimestamp();

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Carrega config atual
        const config = loadConfig();
        const valorAnterior = config.pontos_vitoria || 3;

        // Atualiza pontos
        config.pontos_vitoria = pontosNum;

        // Salva
        const sucesso = saveConfig(config);

        if (!sucesso) {
          const embed = new EmbedBuilder()
            .setTitle(`${emojis.failuser_emoji || '❌'} Erro ao Salvar`)
            .setDescription('Não foi possível salvar a configuração. Tente novamente.')
            .setColor('#FF0000')
            .setTimestamp();

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Sucesso!
        const embed = new EmbedBuilder()
          .setTitle(`${emojis.confirmed_emoji || '✅'} Pontos Atualizados!`)
          .setDescription(
            `**⭐ Pontos por Vitória**\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `**Valor anterior:** ${valorAnterior} ponto${valorAnterior !== 1 ? 's' : ''}\n` +
            `**Novo valor:** ${pontosNum} ponto${pontosNum !== 1 ? 's' : ''}\n\n` +
            `A partir de agora, cada vitória dará **${pontosNum} ponto${pontosNum !== 1 ? 's' : ''}**!`
          )
          .setColor('#00FF00')
          .setFooter({ text: `Configurado por ${interaction.user.username}` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });

      } catch (error) {
        const embed = new EmbedBuilder()
          .setTitle(`${emojis.failuser_emoji || '❌'} Erro`)
          .setDescription('Ocorreu um erro ao processar a configuração.')
          .setColor('#FF0000')
          .setTimestamp();

        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [embed], ephemeral: true });
        } else {
          await interaction.editReply({ embeds: [embed] });
        }
      }
    }
  }
};