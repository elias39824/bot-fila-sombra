const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

function userIsMediador(member) {
  try {
    const ids = JSON.parse(fs.readFileSync(path.join(__dirname, '../DataBaseJson/mediador.json')));
    return ids.some(id => member.roles.cache.has(id));
  } catch {
    return false;
  }
}

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

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.channel.isTextBased()) return;
    if (!/^aposta-|^pagar-/i.test(message.channel.name)) return;
    if (!userIsMediador(message.member)) return;

    const match = message.content.match(/(\d{4,})\D+(\d{2})/);
    if (!match) return;
    const id = match[1];
    const senha = match[2];

    // Busca valor da aposta no filasDados.json
    let filasDados = {};
    if (fs.existsSync(path.join(__dirname, '../DataBaseJson/filasDados.json'))) {
      filasDados = JSON.parse(fs.readFileSync(path.join(__dirname, '../DataBaseJson/filasDados.json')));
    }
    const partida = filasDados[message.channel.id];
    if (!partida || !partida.valor) return;
    
    const valor = partida.valor;
    const taxa = getTaxaServico();
    const valorComTaxa = (parseFloat(valor.replace(',', '.')) + taxa).toFixed(2).replace('.', ',');
    const valorTotal = calcularValorTotal(valor);

    // Altera nome do canal
    await message.channel.setName(`pagar-${valorTotal}`).catch(() => {});

    // Função para criar embed
    function criarEmbed() {
      return new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('__Informações da Sala__')
        .setDescription(
          `> **ID da Sala**\n` +
          `> \`${id}\`\n\n` +
          `> **Senha da Sala**\n` +
          `> \`${senha}\`\n\n` +
          `> **Valor Total a Pagar**\n` +
          `> **R$ ${valorComTaxa}**`
        )
        .setFooter({ text: 'Boa sorte na partida!' })
        .setTimestamp();
    }

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
        .setCustomId('alterar_valor_aposta')
        .setLabel('Alterar Valor')
        .setStyle(ButtonStyle.Primary)
    );

    // Salva info temporária para os botões
    if (!global.apostaGoPanel) global.apostaGoPanel = {};
    const createdAt = Date.now();
    global.apostaGoPanel[message.channel.id] = { 
      id, 
      senha, 
      valor, 
      taxa,
      valorComTaxa,
      valorTotal, 
      createdAt, 
      msgId: null 
    };

    // Envia mensagem
    const embed = criarEmbed();
    
    try {
      const sentMsg = await message.channel.send({ embeds: [embed], components: [row] });
      global.apostaGoPanel[message.channel.id].msgId = sentMsg.id;
      
    } catch (error) {
      console.error('Erro ao enviar mensagem com botões:', error);
    }
  }
};