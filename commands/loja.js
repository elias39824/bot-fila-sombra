const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits 
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// --- Caminhos ---
const lojaPath = path.join(__dirname, '../DataBaseJson/loja.json');
const usersPath = path.join(__dirname, '../DataBaseJson/usersinfo.json');
const inventariosPath = path.join(__dirname, '../DataBaseJson/inventarios.json');

// --- Funções Auxiliares ---
function carregarLoja() {
  try {
    if (!fs.existsSync(lojaPath)) {
      const dadosInicial = { itens: {} };
      fs.writeFileSync(lojaPath, JSON.stringify(dadosInicial, null, 2));
      return dadosInicial;
    }
    const dados = JSON.parse(fs.readFileSync(lojaPath, 'utf-8'));
    if (!dados || typeof dados !== 'object') {
      return { itens: {} };
    }
    if (!dados.itens || typeof dados.itens !== 'object') {
      dados.itens = {};
    }
    return dados;
  } catch (e) {
    console.error('Erro ao carregar loja:', e);
    return { itens: {} };
  }
}

function salvarLoja(dados) {
  try {
    fs.writeFileSync(lojaPath, JSON.stringify(dados, null, 2));
    return true;
  } catch (e) {
    console.error('Erro ao salvar loja:', e);
    return false;
  }
}

function carregarInventarios() {
  try {
    if (!fs.existsSync(inventariosPath)) {
      fs.writeFileSync(inventariosPath, JSON.stringify({}, null, 2));
    }
    return JSON.parse(fs.readFileSync(inventariosPath, 'utf-8'));
  } catch (e) {
    console.error('Erro ao carregar inventários:', e);
    return {};
  }
}

function salvarInventarios(dados) {
  try {
    fs.writeFileSync(inventariosPath, JSON.stringify(dados, null, 2));
    return true;
  } catch (e) {
    console.error('Erro ao salvar inventários:', e);
    return false;
  }
}

function getUserInfo(id) {
  let db = {};
  if (fs.existsSync(usersPath)) {
    try {
      db = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    } catch (e) {
      console.error('Erro ao ler usersinfo.json:', e);
    }
  }
  if (!db[id]) {
    db[id] = { 
      id, 
      vitorias: 0, 
      derrotas: 0, 
      pontos: 0, 
      partidas: 0 
    };
  }
  return db[id];
}

function saveUserInfo(user) {
  let db = {};
  if (fs.existsSync(usersPath)) {
    try {
      db = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    } catch (e) {
      console.error('Erro ao ler usersinfo.json:', e);
    }
  }
  db[user.id] = user;
  try {
    fs.writeFileSync(usersPath, JSON.stringify(db, null, 2));
    return true;
  } catch (e) {
    console.error('Erro ao salvar usersinfo.json:', e);
    return false;
  }
}

function getInventarioUsuario(userId) {
  const inventarios = carregarInventarios();
  if (!inventarios[userId]) {
    inventarios[userId] = { itens: {} };
    salvarInventarios(inventarios);
  }
  return inventarios[userId];
}

function formatarPontos(valor) {
  return `${emojis.coin_emoji || '🪙'} ${valor.toLocaleString('pt-BR')}`;
}

function gerarIdUnico() {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('🛒 Sistema de loja do servidor')
    .addSubcommand(subcommand =>
      subcommand
        .setName('enviar')
        .setDescription('📤 Enviar a loja no canal (Admin)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('criar')
        .setDescription('➕ Criar um novo item na loja (Admin)')
        .addStringOption(option =>
          option
            .setName('nome')
            .setDescription('Nome do item')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('preco')
            .setDescription('Preço em pontos')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option
            .setName('descricao')
            .setDescription('Descrição do item')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('emoji')
            .setDescription('Emoji do item (padrão: 🎁)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('tipo')
            .setDescription('Tipo do item')
            .setRequired(false)
            .addChoices(
              { name: 'Cargo Temporário', value: 'role' },
              { name: 'Cargo Permanente', value: 'role_permanent' },
              { name: 'Cor Personalizada', value: 'color' },
              { name: 'Item Decorativo', value: 'decorativo' },
              { name: 'Boost/Benefício', value: 'boost' }
            )
        )
        .addIntegerOption(option =>
          option
            .setName('estoque')
            .setDescription('Quantidade em estoque (-1 para ilimitado)')
            .setRequired(false)
            .setMinValue(-1)
        )
        .addRoleOption(option =>
          option
            .setName('cargo')
            .setDescription('Cargo a ser dado (para tipo "Cargo")')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('duracao')
            .setDescription('Duração em dias (para cargo temporário)')
            .setRequired(false)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remover')
        .setDescription('🗑️ Remover um item da loja (Admin)')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('addpontos')
        .setDescription('💵 Adicionar pontos a um usuário (Admin)')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuário que receberá os pontos')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('quantidade')
            .setDescription('Quantidade de pontos')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('removepontos')
        .setDescription('💸 Remover pontos de um usuário (Admin)')
        .addUserOption(option =>
          option
            .setName('usuario')
            .setDescription('Usuário que perderá os pontos')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('quantidade')
            .setDescription('Quantidade de pontos')
            .setRequired(true)
            .setMinValue(1)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // Comandos que precisam de permissão de admin
    const adminCommands = ['enviar', 'criar', 'remover', 'addpontos', 'removepontos'];
    if (adminCommands.includes(subcommand) && 
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: `${emojis.failuser_emoji || '❌'} Apenas administradores podem usar este comando!`,
        ephemeral: true
      });
    }

    try {
      switch (subcommand) {
        case 'enviar':
          await enviarLoja(interaction);
          break;
        case 'criar':
          await criarItem(interaction);
          break;
        case 'remover':
          await removerItem(interaction);
          break;
        case 'addpontos':
          await adicionarPontos(interaction);
          break;
        case 'removepontos':
          await removerPontos(interaction);
          break;
      }
    } catch (error) {
      console.error('Erro no comando /loja:', error);
      const replyMethod = interaction.deferred || interaction.replied ? 'editReply' : 'reply';
      await interaction[replyMethod]({
        content: `${emojis.failuser_emoji || '❌'} Ocorreu um erro ao processar o comando.`,
        ephemeral: true
      }).catch(() => {});
    }
  }
};

// ==================== FUNÇÕES DOS SUBCOMANDOS ====================

async function enviarLoja(interaction) {
  const loja = carregarLoja();
  
  // Verifica se loja e itens existem
  if (!loja || !loja.itens || typeof loja.itens !== 'object') {
    return interaction.reply({
      content: `${emojis.failuser_emoji || '❌'} Erro ao carregar a loja! Use \`/loja criar\` para adicionar itens.`,
      ephemeral: true
    });
  }
  
  const itens = Object.entries(loja.itens);

  if (itens.length === 0) {
    return interaction.reply({
      content: `${emojis.failuser_emoji || '❌'} A loja está vazia! Use \`/loja criar\` para adicionar itens.`,
      ephemeral: true
    });
  }

  // Agrupa itens por categoria
  const categorias = {};
  itens.forEach(([id, item]) => {
    const cat = item.categoria || 'outros';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push({ id, ...item });
  });

  // Cria embed da loja
  const embed = new EmbedBuilder()
    .setTitle(`${emojis.shop_emoji || '🛒'} Loja do Servidor`)
    .setDescription('Selecione um item abaixo para comprar ou use os botões!')
    .setColor('#FFD700')
    .setThumbnail(interaction.guild.iconURL())
    .setTimestamp();

  // Adiciona campos por categoria
  Object.entries(categorias).forEach(([categoria, items]) => {
    const catName = categoria.charAt(0).toUpperCase() + categoria.slice(1);
    const itemList = items.map(item => {
      const estoque = item.estoque === -1 ? '∞' : item.estoque;
      return `${item.emoji || '🎁'} **${item.nome}** - ${formatarPontos(item.preco)}\n` +
             `*${item.descricao}*\n` +
             `📦 Estoque: ${estoque}`;
    }).join('\n\n');

    embed.addFields({ name: `━━━ ${catName} ━━━`, value: itemList, inline: false });
  });

  // Cria select menu com os itens
  const options = itens
    .filter(([_, item]) => item.estoque !== 0)
    .slice(0, 25)
    .map(([id, item]) => ({
      label: item.nome,
      description: `${item.preco} pontos - ${item.descricao.substring(0, 50)}`,
      value: id,
      emoji: item.emoji || '🎁'
    }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('loja_comprar_item')
    .setPlaceholder('🛒 Selecione um item para comprar')
    .addOptions(options);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);

  // Cria botões
  const pontosBtn = new ButtonBuilder()
    .setCustomId('loja_ver_pontos')
    .setLabel('Ver Meus Pontos')
    .setStyle(ButtonStyle.Primary)
    .setEmoji(emojis.coin_emoji || '🪙');

  const inventarioBtn = new ButtonBuilder()
    .setCustomId('loja_ver_inventario')
    .setLabel('Ver Inventário')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji(emojis.inventory_emoji || '🎒');

  const row2 = new ActionRowBuilder().addComponents(pontosBtn, inventarioBtn);

  await interaction.reply({ 
    embeds: [embed], 
    components: [row1, row2]
  });
}

async function criarItem(interaction) {
  const nome = interaction.options.getString('nome');
  const preco = interaction.options.getInteger('preco');
  const descricao = interaction.options.getString('descricao');
  const emoji = interaction.options.getString('emoji') || '🎁';
  const tipo = interaction.options.getString('tipo') || 'decorativo';
  const estoque = interaction.options.getInteger('estoque') ?? -1;
  const cargo = interaction.options.getRole('cargo');
  const duracao = interaction.options.getInteger('duracao');

  const loja = carregarLoja();
  
  // Garante que loja.itens existe
  if (!loja.itens) {
    loja.itens = {};
  }
  
  const itemId = gerarIdUnico();

  loja.itens[itemId] = {
    nome,
    descricao,
    preco,
    emoji,
    tipo,
    estoque,
    categoria: tipo === 'role' || tipo === 'role_permanent' ? 'cargos' : tipo === 'color' ? 'estetica' : tipo,
    criadoPor: interaction.user.id,
    criadoEm: new Date().toISOString()
  };

  if (cargo) {
    loja.itens[itemId].roleId = cargo.id;
  }

  if (duracao && tipo === 'role') {
    loja.itens[itemId].duracao = duracao * 24 * 60 * 60 * 1000;
  }

  if (salvarLoja(loja)) {
    const embed = new EmbedBuilder()
      .setTitle(`${emojis.confirmed_emoji || '✅'} Item Criado!`)
      .setColor('#00FF00')
      .addFields(
        { name: 'Nome', value: `${emoji} ${nome}`, inline: true },
        { name: 'Preço', value: formatarPontos(preco), inline: true },
        { name: 'Estoque', value: estoque === -1 ? 'Ilimitado' : estoque.toString(), inline: true },
        { name: 'Descrição', value: descricao, inline: false }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    await interaction.reply({
      content: `${emojis.failuser_emoji || '❌'} Erro ao criar o item!`,
      ephemeral: true
    });
  }
}

async function removerItem(interaction) {
  const loja = carregarLoja();
  
  if (!loja.itens || typeof loja.itens !== 'object') {
    return interaction.reply({
      content: `${emojis.failuser_emoji || '❌'} A loja está vazia!`,
      ephemeral: true
    });
  }
  
  const itens = Object.entries(loja.itens);

  if (itens.length === 0) {
    return interaction.reply({
      content: `${emojis.failuser_emoji || '❌'} A loja está vazia!`,
      ephemeral: true
    });
  }

  const options = itens.slice(0, 25).map(([id, item]) => ({
    label: item.nome,
    description: `${item.preco} pontos`,
    value: id,
    emoji: item.emoji || '🎁'
  }));

  const select = new StringSelectMenuBuilder()
    .setCustomId('loja_remover_item')
    .setPlaceholder('🗑️ Selecione o item para remover')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(select);

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Remover Item da Loja')
    .setDescription('Selecione o item que deseja remover')
    .setColor('#FF0000');

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function adicionarPontos(interaction) {
  const usuario = interaction.options.getUser('usuario');
  const quantidade = interaction.options.getInteger('quantidade');

  const userInfo = getUserInfo(usuario.id);
  userInfo.pontos += quantidade;
  
  if (saveUserInfo(userInfo)) {
    const embed = new EmbedBuilder()
      .setTitle(`${emojis.confirmed_emoji || '✅'} Pontos Adicionados!`)
      .setDescription(`${formatarPontos(quantidade)} foram adicionados a ${usuario}`)
      .setColor('#00FF00')
      .addFields({
        name: '💰 Novo Saldo',
        value: formatarPontos(userInfo.pontos),
        inline: true
      })
      .setThumbnail(usuario.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } else {
    await interaction.reply({
      content: `${emojis.failuser_emoji || '❌'} Erro ao adicionar pontos!`,
      ephemeral: true
    });
  }
}

async function removerPontos(interaction) {
  const usuario = interaction.options.getUser('usuario');
  const quantidade = interaction.options.getInteger('quantidade');

  const userInfo = getUserInfo(usuario.id);
  userInfo.pontos = Math.max(0, userInfo.pontos - quantidade);
  
  if (saveUserInfo(userInfo)) {
    const embed = new EmbedBuilder()
      .setTitle(`${emojis.confirmed_emoji || '✅'} Pontos Removidos!`)
      .setDescription(`${formatarPontos(quantidade)} foram removidos de ${usuario}`)
      .setColor('#FF6347')
      .addFields({
        name: '💰 Novo Saldo',
        value: formatarPontos(userInfo.pontos),
        inline: true
      })
      .setThumbnail(usuario.displayAvatarURL())
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } else {
    await interaction.reply({
      content: `${emojis.failuser_emoji || '❌'} Erro ao remover pontos!`,
      ephemeral: true
    });
  }
}