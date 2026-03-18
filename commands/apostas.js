const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const emojisPath = path.join(__dirname, '../DataBaseJson/emojis.json');
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');

function loadJson(filePath, defaultValue = {}) {
    if (!fs.existsSync(filePath)) {
        return defaultValue;
    }
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`[ERROR] Erro ao ler ${filePath}:`, e);
        return defaultValue;
    }
}

/**
 * Formata timestamp para data legível
 */
function formatarData(timestamp) {
    const data = new Date(timestamp);
    const dia = data.getDate().toString().padStart(2, '0');
    const mes = (data.getMonth() + 1).toString().padStart(2, '0');
    const ano = data.getFullYear();
    const hora = data.getHours().toString().padStart(2, '0');
    const minuto = data.getMinutes().toString().padStart(2, '0');
    
    return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}

/**
 * Calcula tempo decorrido desde a criação
 */
function calcularTempoDecorrido(timestamp) {
    const agora = Date.now();
    const diferenca = agora - timestamp;
    
    const minutos = Math.floor(diferenca / 60000);
    const horas = Math.floor(minutos / 60);
    const dias = Math.floor(horas / 24);
    
    if (dias > 0) return `${dias}d ${horas % 24}h`;
    if (horas > 0) return `${horas}h ${minutos % 60}m`;
    return `${minutos}m`;
}

/**
 * Busca apostas em aberto de um usuário
 */
function buscarApostasUsuario(userId, guild) {
    const filasDados = loadJson(filasDadosPath, {});
    const apostasEncontradas = [];
    
    for (const [canalId, dados] of Object.entries(filasDados)) {
        // Verifica se o usuário está na partida
        const estaParticipando = dados.jogadores && dados.jogadores.includes(userId);
        
        if (estaParticipando) {
            // Busca o canal para verificar se ainda existe
            const canal = guild.channels.cache.get(canalId);
            
            apostasEncontradas.push({
                canalId: canalId,
                canalNome: canal ? canal.name : 'Canal deletado',
                canalExiste: !!canal,
                valor: dados.valor || 'N/A',
                modo: dados.modo || 'Desconhecido',
                tipo: dados.tipo || 'N/A',
                time: dados.time || null,
                status: dados.status || 'iniciada',
                jogadores: dados.jogadores || [],
                mediador: dados.id_mediador || null,
                criadoEm: dados.criado_em || dados.criadoEm || Date.now()
            });
        }
    }
    
    // Ordena por mais recente
    apostasEncontradas.sort((a, b) => b.criadoEm - a.criadoEm);
    
    return apostasEncontradas;
}

/**
 * Cria embed de estatísticas
 */
function criarEmbedEstatisticas(apostas, user, emojis) {
    const totalApostas = apostas.length;
    const valorTotal = apostas.reduce((acc, aposta) => {
        const valor = parseFloat(aposta.valor.toString().replace(',', '.'));
        return acc + (isNaN(valor) ? 0 : valor);
    }, 0);
    
    const statusCount = {
        iniciada: 0,
        confirmado: 0,
        finalizada: 0,
        cancelada: 0
    };
    
    apostas.forEach(aposta => {
        if (statusCount.hasOwnProperty(aposta.status)) {
            statusCount[aposta.status]++;
        }
    });
    
    return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`${emojis._star_emoji || '⭐'} Estatísticas de Apostas`)
        .setDescription(`Resumo das apostas de ${user}`)
        .addFields(
            { 
                name: `${emojis._people_emoji || '👥'} Total de Apostas`, 
                value: `\`${totalApostas}\``, 
                inline: true 
            },
            { 
                name: `${emojis._money_emoji || '💰'} Valor Total`, 
                value: `\`R$ ${valorTotal.toFixed(2).replace('.', ',')}\``, 
                inline: true 
            },
            { 
                name: `${emojis.time_emoji || '⏱️'} Status`,
                value: 
                    `${emojis.confirmed_emoji || '✅'} Confirmadas: \`${statusCount.confirmado}\`\n` +
                    `${emojis.time_emoji || '🕐'} Iniciadas: \`${statusCount.iniciada}\`\n` +
                    `${emojis._fixe_emoji || '🛑'} Finalizadas: \`${statusCount.finalizada}\`\n` +
                    `${emojis.failuser_emoji || '❌'} Canceladas: \`${statusCount.cancelada}\``,
                inline: false
            }
        )
        .setTimestamp();
}

/**
 * Cria embed detalhada das apostas
 */
function criarEmbedApostas(apostas, user, emojis, pagina = 0, itensPorPagina = 5) {
    const inicio = pagina * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const apostasExibidas = apostas.slice(inicio, fim);
    const totalPaginas = Math.ceil(apostas.length / itensPorPagina);
    
    const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`${emojis._diamond_emoji || '💎'} Apostas em Aberto`)
        .setDescription(
            `**Usuário:** ${user}\n` +
            `**Total de apostas:** \`${apostas.length}\`\n` +
            `**Página:** ${pagina + 1}/${totalPaginas || 1}\n\n` +
            (apostas.length === 0 ? '❌ **Nenhuma aposta em aberto encontrada.**' : '📋 **Lista de apostas:**')
        )
        .setFooter({ 
            text: `Página ${pagina + 1} de ${totalPaginas || 1} | Total: ${apostas.length} apostas`,
            iconURL: user.displayAvatarURL ? user.displayAvatarURL() : undefined
        })
        .setTimestamp();
    
    if (apostasExibidas.length > 0) {
        apostasExibidas.forEach((aposta, index) => {
            const numeroAposta = inicio + index + 1;
            const statusEmoji = {
                'iniciada': emojis.time_emoji || '🕐',
                'confirmado': emojis.confirmed_emoji || '✅',
                'finalizada': emojis._fixe_emoji || '🛑',
                'cancelada': emojis.failuser_emoji || '❌'
            };
            
            const statusIcon = statusEmoji[aposta.status] || '❔';
            const tempoDecorrido = calcularTempoDecorrido(aposta.criadoEm);
            const estiloJogo = aposta.time ? `${aposta.modo} | ${aposta.tipo} | ${aposta.time}` : `${aposta.modo} | ${aposta.tipo}`;
            
            let valorField = 
                `${statusIcon} **Status:** \`${aposta.status.charAt(0).toUpperCase() + aposta.status.slice(1)}\`\n` +
                `${emojis._money_emoji || '💰'} **Valor:** \`R$ ${aposta.valor}\`\n` +
                `${emojis._people_emoji || '🎮'} **Modo:** \`${estiloJogo}\`\n` +
                `${emojis.time_emoji || '⏱️'} **Tempo:** \`${tempoDecorrido}\`\n`;
            
            if (aposta.canalExiste) {
                valorField += `${emojis._folder_emoji || '📁'} **Canal:** <#${aposta.canalId}>`;
            } else {
                valorField += `${emojis.failuser_emoji || '❌'} **Canal:** \`${aposta.canalNome}\` *(deletado)*`;
            }
            
            if (aposta.mediador) {
                valorField += `\n${emojis._staff_emoji || '👮'} **Mediador:** <@${aposta.mediador}>`;
            }
            
            embed.addFields({
                name: `${numeroAposta}. ${aposta.canalNome}`,
                value: valorField,
                inline: false
            });
        });
    }
    
    return embed;
}

/**
 * Cria botões de navegação
 */
function criarBotoesNavegacao(pagina, totalPaginas, emojis) {
    const row = new ActionRowBuilder();
    
    // Botão Primeira Página
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`apostas_page_0`)
            .setLabel('Primeira')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏮️')
            .setDisabled(pagina === 0)
    );
    
    // Botão Anterior
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`apostas_page_${pagina - 1}`)
            .setLabel('Anterior')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('◀️')
            .setDisabled(pagina === 0)
    );
    
    // Botão Próxima
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`apostas_page_${pagina + 1}`)
            .setLabel('Próxima')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('▶️')
            .setDisabled(pagina >= totalPaginas - 1)
    );
    
    // Botão Última Página
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`apostas_page_${totalPaginas - 1}`)
            .setLabel('Última')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⏭️')
            .setDisabled(pagina >= totalPaginas - 1)
    );
    
    // Botão Atualizar
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`apostas_refresh`)
            .setLabel('Atualizar')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔄')
    );
    
    return row;
}

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;
        if (!message.guild) return;
        if (!message.content.toLowerCase().startsWith('!apostas')) return;

        const emojis = loadJson(emojisPath, {});

        console.log('[APOSTAS] Comando detectado:', message.content);

        // Parse do comando: !apostas [@user] ou !apostas
        const args = message.content.slice(9).trim().split(' ');
        
        let targetUser = message.author;
        let targetUserId = message.author.id;
        
        // Verifica se mencionou alguém
        if (message.mentions.users.size > 0) {
            targetUser = message.mentions.users.first();
            targetUserId = targetUser.id;
        } else if (args.length > 0 && args[0]) {
            // Tenta buscar por ID
            const userId = args[0].replace(/[<@!>]/g, '');
            try {
                const user = await message.guild.members.fetch(userId);
                if (user) {
                    targetUser = user.user;
                    targetUserId = user.id;
                }
            } catch (error) {
                console.log('[APOSTAS] Usuário não encontrado, usando author');
            }
        }

        console.log(`[APOSTAS] Buscando apostas de: ${targetUser.tag} (${targetUserId})`);

        try {
            // Busca apostas do usuário
            const apostas = buscarApostasUsuario(targetUserId, message.guild);
            
            console.log(`[APOSTAS] Encontradas ${apostas.length} apostas`);

            // Cria embed principal
            const embed = criarEmbedApostas(apostas, targetUser, emojis, 0);
            
            // Cria botões de navegação se tiver mais de 5 apostas
            const components = [];
            const totalPaginas = Math.ceil(apostas.length / 5);
            
            if (totalPaginas > 1) {
                components.push(criarBotoesNavegacao(0, totalPaginas, emojis));
            }
            
            // Cria botão de estatísticas
            const rowEstatisticas = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('apostas_estatisticas')
                    .setLabel('Ver Estatísticas')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis._star_emoji || '📊')
            );
            
            if (apostas.length > 0) {
                components.push(rowEstatisticas);
            }

            // Envia mensagem
            const messageData = { embeds: [embed] };
            if (components.length > 0) messageData.components = components;
            
            const sentMessage = await message.reply(messageData);

            // Salva dados temporários para os botões
            if (!message.client.apostasCache) {
                message.client.apostasCache = new Map();
            }
            
            message.client.apostasCache.set(sentMessage.id, {
                userId: targetUserId,
                user: targetUser,
                apostas: apostas,
                pagina: 0
            });

            // Remove do cache após 10 minutos
            setTimeout(() => {
                message.client.apostasCache.delete(sentMessage.id);
            }, 600000);

            console.log(`[APOSTAS] ✅ Embed enviado com ${apostas.length} apostas`);

        } catch (error) {
            console.error('[APOSTAS] ❌ Erro:', error);
            message.reply({
                content: `${emojis.failuser_emoji || '❌'} Erro ao buscar apostas: ${error.message}`
            }).catch(() => {});
        }
    },

    // Handler para os botões de navegação
    async handleButton(interaction) {
        const emojis = loadJson(emojisPath, {});
        
        // Verifica se é um botão de apostas
        if (!interaction.customId.startsWith('apostas_')) return;

        const messageId = interaction.message.id;
        const cache = interaction.client.apostasCache?.get(messageId);

        if (!cache) {
            return interaction.reply({
                content: `${emojis.failuser_emoji || '❌'} Esta mensagem expirou. Use \`!apostas\` novamente.`,
                ephemeral: true
            });
        }

        try {
            if (interaction.customId === 'apostas_refresh') {
                // Atualiza apostas
                const apostasAtualizadas = buscarApostasUsuario(cache.userId, interaction.guild);
                cache.apostas = apostasAtualizadas;
                cache.pagina = 0;
                
                const embed = criarEmbedApostas(apostasAtualizadas, cache.user, emojis, 0);
                const totalPaginas = Math.ceil(apostasAtualizadas.length / 5);
                
                const components = [];
                if (totalPaginas > 1) {
                    components.push(criarBotoesNavegacao(0, totalPaginas, emojis));
                }
                
                const rowEstatisticas = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('apostas_estatisticas')
                        .setLabel('Ver Estatísticas')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis._star_emoji || '📊')
                );
                
                if (apostasAtualizadas.length > 0) {
                    components.push(rowEstatisticas);
                }
                
                await interaction.update({ embeds: [embed], components });
                
            } else if (interaction.customId === 'apostas_estatisticas') {
                // Mostra estatísticas
                const embedEstatisticas = criarEmbedEstatisticas(cache.apostas, cache.user, emojis);
                
                const rowVoltar = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('apostas_voltar_lista')
                        .setLabel('Voltar para Lista')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis._back_emoji || '◀️')
                );
                
                await interaction.update({ embeds: [embedEstatisticas], components: [rowVoltar] });
                
            } else if (interaction.customId === 'apostas_voltar_lista') {
                // Volta para a lista
                const embed = criarEmbedApostas(cache.apostas, cache.user, emojis, cache.pagina);
                const totalPaginas = Math.ceil(cache.apostas.length / 5);
                
                const components = [];
                if (totalPaginas > 1) {
                    components.push(criarBotoesNavegacao(cache.pagina, totalPaginas, emojis));
                }
                
                const rowEstatisticas = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('apostas_estatisticas')
                        .setLabel('Ver Estatísticas')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis._star_emoji || '📊')
                );
                
                components.push(rowEstatisticas);
                
                await interaction.update({ embeds: [embed], components });
                
            } else if (interaction.customId.startsWith('apostas_page_')) {
                // Navegação de páginas
                const novaPagina = parseInt(interaction.customId.split('_')[2]);
                cache.pagina = novaPagina;
                
                const embed = criarEmbedApostas(cache.apostas, cache.user, emojis, novaPagina);
                const totalPaginas = Math.ceil(cache.apostas.length / 5);
                
                const components = [];
                if (totalPaginas > 1) {
                    components.push(criarBotoesNavegacao(novaPagina, totalPaginas, emojis));
                }
                
                const rowEstatisticas = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('apostas_estatisticas')
                        .setLabel('Ver Estatísticas')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji(emojis._star_emoji || '📊')
                );
                
                components.push(rowEstatisticas);
                
                await interaction.update({ embeds: [embed], components });
            }

        } catch (error) {
            console.error('[APOSTAS BUTTON] Erro:', error);
            await interaction.reply({
                content: `${emojis.failuser_emoji || '❌'} Erro ao processar ação.`,
                ephemeral: true
            }).catch(() => {});
        }
    }
};