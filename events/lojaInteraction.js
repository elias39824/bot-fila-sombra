const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    return {};
  }
}

function salvarInventarios(dados) {
  try {
    fs.writeFileSync(inventariosPath, JSON.stringify(dados, null, 2));
    return true;
  } catch (e) {
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

function formatarPontos(valor) {
  return `${emojis.coin_emoji || '🪙'} ${valor.toLocaleString('pt-BR')}`;
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // Verifica se é interação da loja (early return para performance)
      const isLojaButton = interaction.isButton() && interaction.customId.startsWith('loja_');
      const isLojaMenu = interaction.isStringSelectMenu() && interaction.customId.startsWith('loja_');
      
      if (!isLojaButton && !isLojaMenu) return;

      // Handler para botão "Ver Meus Pontos"
      if (interaction.customId === 'loja_ver_pontos') {
        return await handleVerPontos(interaction);
      }

      // Handler para botão "Ver Inventário"
      if (interaction.customId === 'loja_ver_inventario') {
        return await handleVerInventario(interaction);
      }

      // Handler para Select Menu de compra
      if (interaction.customId === 'loja_comprar_item') {
        return await handleSelecionarItem(interaction);
      }

      // Handler para botões de confirmação de compra
      if (interaction.customId.startsWith('loja_confirmar_sim_')) {
        return await handleConfirmarCompra(interaction);
      }

      if (interaction.customId === 'loja_confirmar_nao') {
        return await handleCancelarCompra(interaction);
      }

      // Handler para Select Menu de remoção (Admin)
      if (interaction.customId === 'loja_remover_item') {
        return await handleRemoverItem(interaction);
      }

      // Handler para confirmação de remoção
      if (interaction.customId.startsWith('loja_confirmar_remocao_')) {
        return await handleConfirmarRemocao(interaction);
      }

      if (interaction.customId === 'loja_cancelar_remocao') {
        return await interaction.update({
          content: `${emojis.failuser_emoji || '❌'} Remoção cancelada!`,
          embeds: [],
          components: []
        });
      }

    } catch (error) {
      console.error('Erro ao processar interação da loja:', error);
    }
  }
};

// ==================== HANDLERS ====================

async function handleVerPontos(interaction) {
  const userInfo = getUserInfo(interaction.user.id);

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.coin_emoji || '🪙'} Seus Pontos`)
    .setDescription(`Você possui **${formatarPontos(userInfo.pontos)}**`)
    .setColor('#FFD700')
    .addFields(
      { name: '🏆 Vitórias', value: `${userInfo.vitorias || 0}`, inline: true },
      { name: '❌ Derrotas', value: `${userInfo.derrotas || 0}`, inline: true },
      { name: '🎮 Partidas', value: `${userInfo.partidas || 0}`, inline: true }
    )
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleVerInventario(interaction) {
  const userInfo = getUserInfo(interaction.user.id);
  const inventarios = carregarInventarios();
  const inventario = inventarios[interaction.user.id] || { itens: {} };

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.inventory_emoji || '🎒'} Seu Inventário`)
    .setColor('#4169E1')
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      {
        name: '💰 Pontos',
        value: formatarPontos(userInfo.pontos),
        inline: true
      },
      {
        name: '🏆 Vitórias',
        value: `${userInfo.vitorias || 0}`,
        inline: true
      },
      {
        name: '❌ Derrotas',
        value: `${userInfo.derrotas || 0}`,
        inline: true
      }
    )
    .setTimestamp();

  const itensInventario = Object.entries(inventario.itens || {});
  
  if (itensInventario.length === 0) {
    embed.addFields({
      name: '📦 Itens',
      value: '*Você ainda não possui itens*',
      inline: false
    });
  } else {
    const loja = carregarLoja();
    const itensList = itensInventario.map(([itemId, dados]) => {
      const itemData = loja.itens[itemId];
      if (!itemData) return null;
      
      const status = dados.ativo ? '✅ Ativo' : '❌ Inativo';
      const data = new Date(dados.dataCompra).toLocaleDateString('pt-BR');
      
      return `${itemData.emoji || '🎁'} **${itemData.nome}**\n` +
             `└ ${status} | Qtd: ${dados.quantidade} | Comprado: ${data}`;
    }).filter(Boolean).join('\n\n');

    embed.addFields({
      name: '📦 Seus Itens',
      value: itensList || '*Nenhum item válido*',
      inline: false
    });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleSelecionarItem(interaction) {
  const itemId = interaction.values[0];
  const loja = carregarLoja();
  const item = loja.itens[itemId];

  if (!item) {
    return interaction.reply({
      content: `${emojis.failuser_emoji || '❌'} Item não encontrado!`,
      ephemeral: true
    });
  }

  if (item.estoque === 0) {
    return interaction.reply({
      content: `${emojis.failuser_emoji || '❌'} Este item está sem estoque!`,
      ephemeral: true
    });
  }

  const userInfo = getUserInfo(interaction.user.id);

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.shop_emoji || '🛒'} Confirmar Compra`)
    .setColor('#FFD700')
    .setThumbnail(interaction.guild.iconURL())
    .addFields(
      { name: 'Item', value: `${item.emoji || '🎁'} **${item.nome}**`, inline: true },
      { name: 'Preço', value: formatarPontos(item.preco), inline: true },
      { name: 'Seu Saldo', value: formatarPontos(userInfo.pontos), inline: true },
      { name: 'Descrição', value: item.descricao, inline: false }
    );

  const temSaldo = userInfo.pontos >= item.preco;
  
  if (temSaldo) {
    const saldoApos = userInfo.pontos - item.preco;
    embed.addFields({
      name: '💰 Saldo Após Compra',
      value: formatarPontos(saldoApos),
      inline: false
    });
    embed.setDescription('**Tem certeza que deseja comprar este item?**');
    embed.setFooter({ text: '✅ Você tem saldo suficiente!' });
  } else {
    const faltam = item.preco - userInfo.pontos;
    embed.addFields({
      name: '⚠️ Saldo Insuficiente',
      value: `Faltam ${formatarPontos(faltam)}`,
      inline: false
    });
    embed.setDescription('**Você não possui pontos suficientes para esta compra!**');
    embed.setColor('#FF0000');
  }

  const simBtn = new ButtonBuilder()
    .setCustomId(`loja_confirmar_sim_${itemId}`)
    .setLabel('Sim')
    .setStyle(ButtonStyle.Success)
    .setEmoji('✅')
    .setDisabled(!temSaldo);

  const naoBtn = new ButtonBuilder()
    .setCustomId('loja_confirmar_nao')
    .setLabel('Não')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('❌');

  const row = new ActionRowBuilder().addComponents(simBtn, naoBtn);

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleConfirmarCompra(interaction) {
  const itemId = interaction.customId.replace('loja_confirmar_sim_', '');
  const loja = carregarLoja();
  const item = loja.itens[itemId];

  if (!item) {
    return interaction.update({
      content: `${emojis.failuser_emoji || '❌'} Item não encontrado!`,
      embeds: [],
      components: []
    });
  }

  if (item.estoque === 0) {
    return interaction.update({
      content: `${emojis.failuser_emoji || '❌'} Este item acabou de esgotar!`,
      embeds: [],
      components: []
    });
  }

  const userInfo = getUserInfo(interaction.user.id);

  if (userInfo.pontos < item.preco) {
    return interaction.update({
      content: `${emojis.failuser_emoji || '❌'} Você não tem pontos suficientes!`,
      embeds: [],
      components: []
    });
  }

  // Realiza a compra
  userInfo.pontos -= item.preco;
  saveUserInfo(userInfo);

  // Adiciona ao inventário
  const inventarios = carregarInventarios();
  if (!inventarios[interaction.user.id]) {
    inventarios[interaction.user.id] = { itens: {} };
  }

  if (!inventarios[interaction.user.id].itens[itemId]) {
    inventarios[interaction.user.id].itens[itemId] = {
      quantidade: 0,
      dataCompra: new Date().toISOString(),
      ativo: true
    };
  }
  inventarios[interaction.user.id].itens[itemId].quantidade += 1;

  // Atualiza estoque
  if (item.estoque > 0) {
    loja.itens[itemId].estoque -= 1;
  }

  salvarInventarios(inventarios);
  salvarLoja(loja);

  // Envia item na DM
  try {
    const dmEmbed = new EmbedBuilder()
      .setTitle(`${emojis.confirmed_emoji || '✅'} Compra Realizada com Sucesso!`)
      .setDescription(`Você comprou **${item.nome}**!`)
      .setColor('#00FF00')
      .setThumbnail(interaction.guild.iconURL())
      .addFields(
        { name: 'Item', value: `${item.emoji || '🎁'} ${item.nome}`, inline: true },
        { name: 'Preço Pago', value: formatarPontos(item.preco), inline: true },
        { name: '💰 Saldo Restante', value: formatarPontos(userInfo.pontos), inline: true },
        { name: 'Descrição', value: item.descricao, inline: false },
        { name: 'Data da Compra', value: new Date().toLocaleString('pt-BR'), inline: false }
      )
      .setFooter({ text: `Servidor: ${interaction.guild.name}` })
      .setTimestamp();

    await interaction.user.send({ embeds: [dmEmbed] });

    await interaction.update({
      content: `${emojis.confirmed_emoji || '✅'} **Compra realizada!** O item foi enviado para sua DM!`,
      embeds: [],
      components: []
    });

  } catch (error) {
    console.error('Erro ao enviar DM:', error);
    
    const embed = new EmbedBuilder()
      .setTitle(`${emojis.confirmed_emoji || '✅'} Compra Realizada!`)
      .setDescription(`Você comprou **${item.nome}** com sucesso!\n\n⚠️ *Não foi possível enviar DM. Suas DMs podem estar desativadas.*`)
      .setColor('#00FF00')
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        { name: 'Item', value: `${item.emoji || '🎁'} ${item.nome}`, inline: true },
        { name: 'Preço', value: formatarPontos(item.preco), inline: true },
        { name: '💰 Novo Saldo', value: formatarPontos(userInfo.pontos), inline: true }
      )
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
  }

  await aplicarEfeitoItem(interaction, item);
}

async function handleCancelarCompra(interaction) {
  await interaction.update({
    content: `${emojis.failuser_emoji || '❌'} Compra cancelada!`,
    embeds: [],
    components: []
  });
}

  async function handleRemoverItem(interaction) {
  const itemId = interaction.values[0];
  const loja = carregarLoja();
  const item = loja.itens[itemId];

  if (!item) {
    return interaction.update({
      content: `${emojis.failuser_emoji || '❌'} Item não encontrado!`,
      embeds: [],
      components: []
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Confirmar Remoção')
    .setDescription(`Tem certeza que deseja remover o item **${item.nome}**?`)
    .setColor('#FF0000')
    .addFields(
      { name: 'Item', value: `${item.emoji || '🎁'} ${item.nome}`, inline: true },
      { name: 'Preço', value: formatarPontos(item.preco), inline: true },
      { name: 'Estoque', value: item.estoque === -1 ? 'Ilimitado' : item.estoque.toString(), inline: true }
    );

  const confirmarBtn = new ButtonBuilder()
    .setCustomId(`loja_confirmar_remocao_${itemId}`)
    .setLabel('Remover')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('🗑️');

  const cancelarBtn = new ButtonBuilder()
    .setCustomId('loja_cancelar_remocao')
    .setLabel('Cancelar')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('❌');

  const row = new ActionRowBuilder().addComponents(confirmarBtn, cancelarBtn);

  await interaction.update({ embeds: [embed], components: [row] });
}

async function handleConfirmarRemocao(interaction) {
  const itemId = interaction.customId.replace('loja_confirmar_remocao_', '');
  const loja = carregarLoja();
  const item = loja.itens[itemId];

  if (!item) {
    return interaction.update({
      content: `${emojis.failuser_emoji || '❌'} Item não encontrado!`,
      embeds: [],
      components: []
    });
  }

  delete loja.itens[itemId];
  
  if (salvarLoja(loja)) {
    const embed = new EmbedBuilder()
      .setTitle(`${emojis.confirmed_emoji || '✅'} Item Removido!`)
      .setDescription(`O item **${item.nome}** foi removido da loja.`)
      .setColor('#00FF00')
      .setTimestamp();

    await interaction.update({ embeds: [embed], components: [] });
  } else {
    await interaction.update({
      content: `${emojis.failuser_emoji || '❌'} Erro ao remover o item!`,
      embeds: [],
      components: []
    });
  }
}

// ==================== APLICAR EFEITOS DOS ITENS ====================

async function aplicarEfeitoItem(interaction, item) {
  try {
    switch (item.tipo) {
      case 'role':
        await aplicarCargo(interaction, item);
        break;
      case 'role_permanent':
        await aplicarCargoPermanente(interaction, item);
        break;
      case 'color':
        await aplicarCorPersonalizada(interaction);
        break;
      case 'boost':
        // Implementar lógica de boost futura
        break;
      case 'decorativo':
        // Item decorativo não tem efeito especial
        break;
    }
  } catch (error) {
    console.error('Erro ao aplicar efeito do item:', error);
  }
}

async function aplicarCargo(interaction, item) {
  if (!item.roleId) {
    return;
  }

  try {
    const role = await interaction.guild.roles.fetch(item.roleId);
    if (role) {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(role);
      
      // Envia confirmação na DM
      try {
        await interaction.user.send({
          content: `${emojis.confirmed_emoji || '✅'} Cargo ${role} foi adicionado a você com sucesso!`
        });
      } catch (e) {
        console.log('Não foi possível enviar confirmação de cargo na DM');
      }
      
      // Se tem duração, remove após o tempo
      if (item.duracao) {
        setTimeout(async () => {
          try {
            const memberAtual = await interaction.guild.members.fetch(interaction.user.id);
            await memberAtual.roles.remove(role);
            
            // Tenta enviar DM de expiração
            try {
              await interaction.user.send({
                content: `${emojis.failuser_emoji || '❌'} Seu cargo **${item.nome}** expirou e foi removido!`
              });
            } catch (e) {
              console.log('Não foi possível enviar DM de expiração');
            }
          } catch (e) {
            console.error('Erro ao remover cargo temporário:', e);
          }
        }, item.duracao);

        // Informa sobre a duração
        try {
          const dias = item.duracao / (24 * 60 * 60 * 1000);
          await interaction.user.send({
            content: `⏰ Este cargo expirará em **${dias} dias**.`
          });
        } catch (e) {
          console.log('Não foi possível enviar info de duração na DM');
        }
      }
    }
  } catch (error) {
    console.error('Erro ao adicionar cargo:', error);
  }
}

async function aplicarCargoPermanente(interaction, item) {
  if (!item.roleId) {
    return;
  }

  try {
    const role = await interaction.guild.roles.fetch(item.roleId);
    if (role) {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      await member.roles.add(role);
      
      try {
        await interaction.user.send({
          content: `${emojis.confirmed_emoji || '✅'} Cargo ${role} foi adicionado permanentemente a você!`
        });
      } catch (e) {
        console.log('Não foi possível enviar confirmação na DM');
      }
    }
  } catch (error) {
    console.error('Erro ao adicionar cargo permanente:', error);
  }
}

async function aplicarCorPersonalizada(interaction) {
  try {
    await interaction.user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('🎨 Escolha sua Cor Personalizada')
          .setDescription('Digite o código hexadecimal da cor que deseja (ex: #FF5733)\nResponda aqui nesta DM em até 60 segundos.')
          .setColor('#FFD700')
          .addFields({
            name: '💡 Exemplos de Cores',
            value: '`#FF0000` - Vermelho\n`#00FF00` - Verde\n`#0000FF` - Azul\n`#FF1493` - Rosa\n`#FFD700` - Dourado\n`#9400D3` - Roxo'
          })
      ]
    });

    // Cria collector na DM
    const dmChannel = await interaction.user.createDM();
    const filter = m => m.author.id === interaction.user.id;
    const collector = dmChannel.createMessageCollector({ filter, time: 60000, max: 1 });

    collector.on('collect', async (message) => {
      const cor = message.content.trim();
      
      // Valida cor hexadecimal
      if (!/^#[0-9A-F]{6}$/i.test(cor)) {
        return message.reply({
          content: `${emojis.failuser_emoji || '❌'} Cor inválida! Use o formato #RRGGBB (ex: #FF5733)`
        });
      }

      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        
        // Procura cargo existente do usuário
        let role = member.roles.cache.find(r => r.name.startsWith('🎨'));
        
        if (role) {
          await role.setColor(cor);
          await role.setName(`🎨 ${interaction.user.username}`);
        } else {
          role = await interaction.guild.roles.create({
            name: `🎨 ${interaction.user.username}`,
            color: cor,
            reason: 'Cor personalizada da loja'
          });
          await member.roles.add(role);
        }

        await message.reply({
          content: `${emojis.confirmed_emoji || '✅'} Cor aplicada com sucesso! Seu nickname agora está com a cor escolhida.`
        });
      } catch (error) {
        console.error('Erro ao aplicar cor:', error);
        await message.reply({
          content: `${emojis.failuser_emoji || '❌'} Erro ao aplicar a cor! Verifique se o bot tem permissão para gerenciar cargos.`
        });
      }
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        interaction.user.send({
          content: `${emojis.failuser_emoji || '❌'} Tempo esgotado! Compre o item novamente para escolher a cor.`
        }).catch(() => {});
      }
    });
  } catch (error) {
    console.error('Erro ao iniciar processo de cor personalizada:', error);
  }
}