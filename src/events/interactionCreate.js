const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { emojis, colors } = require('../utils/config');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(error);
                await interaction.reply({ content: 'Houve um erro ao executar este comando!', ephemeral: true });
            }
        }

        if (interaction.isButton()) {
            const { customId, message, user, guild } = interaction;

            // --- SISTEMA DE FILAS ---
            if (customId.startsWith('fila_')) {
                await interaction.deferReply({ ephemeral: true });
                const matchData = client.database.get(`match_${message.id}`);
                if (!matchData) return interaction.editReply({ content: `${emojis.errado} | Fila não encontrada!` });

                const queueType = customId.replace('fila_', '');
                
                if (queueType === 'sair') {
                    matchData.gelnormal = matchData.gelnormal.filter(id => id !== user.id);
                    matchData.gelinfinito = matchData.gelinfinito.filter(id => id !== user.id);
                    client.database.set(`match_${message.id}`, matchData);
                    updateQueueEmbed(message, matchData, guild);
                    return interaction.editReply({ content: `${emojis.errado} | Você saiu de todas as filas!` });
                }

                // Remover de outras filas antes de entrar na nova
                matchData.gelnormal = matchData.gelnormal.filter(id => id !== user.id);
                matchData.gelinfinito = matchData.gelinfinito.filter(id => id !== user.id);

                if (matchData[queueType].length >= 1) {
                    const opponentId = matchData[queueType][0];
                    if (opponentId === user.id) return interaction.editReply({ content: `${emojis.errado} | Você já está nesta fila!` });

                    // Criar Tópico de Confirmação
                    const thread = await interaction.channel.threads.create({
                        name: `Confirmação: ${user.username} vs ${guild.members.cache.get(opponentId)?.user.username || 'Oponente'}`,
                        type: ChannelType.PrivateThread,
                        autoArchiveDuration: 60
                    });

                    const confirmEmbed = new EmbedBuilder()
                        .setTitle(`🎮 | Confirmação de Partida`)
                        .setDescription(`**Modo:** ${matchData.modo.toUpperCase()}\n**Valor:** R$ ${matchData.valor},00\n\n**Jogadores:**\n<@${user.id}>\n<@${opponentId}>\n\n*Ambos devem clicar no botão abaixo para confirmar!*`)
                        .setColor(colors.warning);

                    const confirmRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('match_confirmar')
                            .setLabel('Confirmar Participação')
                            .setEmoji(emojis.check)
                            .setStyle(ButtonStyle.Success)
                    );

                    await thread.send({ content: `<@${user.id}>, <@${opponentId}>`, embeds: [confirmEmbed], components: [confirmRow] });

                    // Salvar dados da confirmação
                    client.database.set(`match_confirmacao_${thread.id}`, {
                        matchId: message.id,
                        canalId: interaction.channel.id,
                        jogadores: [user.id, opponentId],
                        confirmados: [],
                        tipo: matchData.modo,
                        valor: matchData.valor
                    });

                    // Limpar fila original
                    matchData[queueType] = [];
                    client.database.set(`match_${message.id}`, matchData);
                    updateQueueEmbed(message, matchData, guild);
                    return interaction.editReply({ content: `⚔️ | Match encontrado! Confira o tópico: ${thread}` });
                } else {
                    matchData[queueType].push(user.id);
                    client.database.set(`match_${message.id}`, matchData);
                    updateQueueEmbed(message, matchData, guild);
                    return interaction.editReply({ content: `${emojis.gelo} | Você entrou na fila: **${queueType.replace('_', ' ')}**!` });
                }
            }

            // --- CONFIRMAÇÃO DE MATCH ---
            if (customId === 'match_confirmar') {
                await interaction.deferReply({ ephemeral: true });
                const confirmData = client.database.get(`match_confirmacao_${interaction.channel.id}`);
                if (!confirmData) return interaction.editReply({ content: "❌ | Sessão expirada!" });

                if (!confirmData.jogadores.includes(user.id)) return interaction.editReply({ content: "❌ | Você não faz parte desta partida!" });
                if (confirmData.confirmados.includes(user.id)) return interaction.editReply({ content: "❌ | Você já confirmou!" });

                confirmData.confirmados.push(user.id);
                client.database.set(`match_confirmacao_${interaction.channel.id}`, confirmData);

                if (confirmData.confirmados.length === 2) {
                    // Chamar Mediador
                    let filaMed = client.database.get(`fila_mediadores_${guild.id}`) || [];
                    let mediadorId = filaMed.shift();
                    client.database.set(`fila_mediadores_${guild.id}`, filaMed);

                    const pixKey = mediadorId ? client.database.get(`pix_${mediadorId}`) : null;
                    
                    const finalEmbed = new EmbedBuilder()
                        .setTitle(`🔥 | Partida Iniciada!`)
                        .setDescription(`> **Mediador:** ${mediadorId ? `<@${mediadorId}>` : "Nenhum disponível"}\n> **Valor:** R$ ${confirmData.valor},00\n\n${pixKey ? `**PIX do Mediador:**\n\`${pixKey}\`` : "Aguarde o mediador informar o PIX."}\n\nClique em finalizar quando a partida acabar!`)
                        .setColor(colors.success);

                    const endRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('match_end')
                            .setLabel('Finalizar Partida')
                            .setStyle(ButtonStyle.Danger)
                    );

                    await interaction.channel.send({ content: `${confirmData.jogadores.map(id => `<@${id}>`).join(', ')} ${mediadorId ? `, <@${mediadorId}>` : ""}`, embeds: [finalEmbed], components: [endRow] });
                    await interaction.message.delete().catch(() => {});
                } else {
                    await interaction.editReply({ content: "✅ | Confirmado! Aguardando o outro jogador..." });
                }
            }

            // --- SISTEMA DE MEDIADOR ---
            if (customId === 'entrar_fila_med') {
                let filaMed = client.database.get(`fila_mediadores_${guild.id}`) || [];
                if (filaMed.includes(user.id)) return interaction.reply({ content: "Você já está na fila!", ephemeral: true });
                filaMed.push(user.id);
                client.database.set(`fila_mediadores_${guild.id}`, filaMed);
                updateMedEmbed(interaction);
                return interaction.reply({ content: "Você entrou na fila de mediadores!", ephemeral: true });
            }

            if (customId === 'sair_fila_med') {
                let filaMed = client.database.get(`fila_mediadores_${guild.id}`) || [];
                filaMed = filaMed.filter(id => id !== user.id);
                client.database.set(`fila_mediadores_${guild.id}`, filaMed);
                updateMedEmbed(interaction);
                return interaction.reply({ content: "Você saiu da fila de mediadores!", ephemeral: true });
            }

            if (customId === 'match_end') {
                await interaction.reply({ content: `O canal será deletado em 10 segundos...` });
                setTimeout(() => {
                    interaction.channel.delete().catch(() => {});
                }, 10000);
            }
        }
    },
};

function updateQueueEmbed(message, data, guild) {
    const embed = new EmbedBuilder()
        .setAuthor({ name: data.titulo, iconURL: guild.iconURL() })
        .setTitle(`**${data.titulo}**`)
        .setDescription(`**Filas Mobile**\n\n- **${emojis.coroa} Modo**\n  ${data.modo.toUpperCase()} MOBILE\n- **Valor**\n  R$ ${data.valor},00\n- **Jogadores**\n  ${data.gelnormal.length + data.gelinfinito.length} jogadores na fila`)
        .addFields([
            {
                name: `${emojis.users} | Fila Gelo Normal`,
                value: data.gelnormal.length > 0 ? data.gelnormal.map(id => `<@${id}>`).join(', ') : "Ninguém na fila",
                inline: false
            },
            {
                name: `${emojis.users} | Fila Gelo Infinito`,
                value: data.gelinfinito.length > 0 ? data.gelinfinito.map(id => `<@${id}>`).join(', ') : "Ninguém na fila",
                inline: false
            }
        ])
        .setColor(colors.primary)
        .setFooter({ text: "Venha Apostar", iconURL: guild.iconURL() });

    message.edit({ embeds: [embed] });
}

async function updateMedEmbed(interaction) {
    const fila = interaction.client.database.get(`fila_mediadores_${interaction.guild.id}`) || [];
    const desc = fila.length > 0 ? fila.map(u => `<@${u}> \`${u}\``).join('\n') : 'Nenhum mediador na fila.';
    const embed = new EmbedBuilder()
        .setTitle(`🛡️ Fila de Mediadores`)
        .setDescription('Entre ou saia da fila de mediadores usando os botões abaixo.')
        .addFields({ name: 'Mediadores na Fila:', value: desc })
        .setColor(colors.success);
    await interaction.message.edit({ embeds: [embed] });
}
