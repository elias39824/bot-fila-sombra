const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// Caminhos dos arquivos
const analistaPath = path.join(__dirname, '../DataBaseJson/analista.json');
const analisesAtivasPath = path.join(__dirname, '../DataBaseJson/analises_ativas.json');

// Funções utilitárias
function loadJson(filePath, defaultValue) {
    if (!fs.existsSync(filePath)) {
        saveJson(filePath, defaultValue);
        return defaultValue;
    }
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(data);
        if (json === null || json === undefined) {
            return defaultValue;
        }
        return json;
    } catch (e) {
        console.error(`[ERROR] Erro ao ler JSON em ${filePath}:`, e.message);
        return defaultValue;
    }
}

function saveJson(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error(`[ERROR] Erro ao salvar JSON em ${filePath}:`, e.message);
    }
}

function getCargoAnalistaId() {
    try {
        const ids = loadJson(analistaPath, []);
        return ids.length > 0 ? ids[0] : null;
    } catch (error) {
        console.error('[ERROR] Erro ao ler analista.json:', error);
        return null;
    }
}

async function verificarCargoAnalista(member) {
    const cargoAnalistaId = getCargoAnalistaId();
    if (!cargoAnalistaId) return false;
    
    return member.roles.cache.has(cargoAnalistaId);
}

async function darAcessoAoCanal(guild, canalId, analistaId) {
    try {
        const canal = await guild.channels.fetch(canalId).catch(() => null);
        if (!canal) {
            console.error('[ERROR] Canal não encontrado para dar acesso');
            return false;
        }

        await canal.permissionOverwrites.create(analistaId, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true
        });

        console.log(`[ACESSO] Analista ${analistaId} recebeu acesso ao canal ${canal.name}`);
        return true;
    } catch (error) {
        console.error('[ERROR] Erro ao dar acesso ao canal:', error);
        return false;
    }
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // ========================================
        // BOTÃO: Aceitar Análise (!ssmob, !ssemu, /analista)
        // ========================================
        if (interaction.isButton() && (interaction.customId === 'aceitar_analise' || interaction.customId === 'assumir_analise_cmd')) {
            try {
                await interaction.deferUpdate();

                // Verifica se o usuário tem cargo de analista
                const temCargoAnalista = await verificarCargoAnalista(interaction.member);
                if (!temCargoAnalista) {
                    return interaction.followUp({
                        content: `${emojis.failuser_emoji || '❌'} Apenas analistas podem aceitar análises!`,
                        ephemeral: true
                    });
                }

                // Carrega as análises ativas
                const analisesAtivas = loadJson(analisesAtivasPath, {});
                const analise = analisesAtivas[interaction.message.id];

                // Verifica se a análise existe
                if (!analise) {
                    return interaction.followUp({
                        content: `${emojis.failuser_emoji || '❌'} Esta análise não está mais disponível.`,
                        ephemeral: true
                    });
                }

                // CRÍTICO: Verifica se já foi aceita por outro analista
                if (analise.aceito && analise.analista !== interaction.user.id) {
                    return interaction.followUp({
                        content: `${emojis.failuser_emoji || '❌'} Esta análise já foi aceita por <@${analise.analista}>!`,
                        ephemeral: true
                    });
                }

                // Marca como aceita e registra o analista
                analise.aceito = true;
                analise.analista = interaction.user.id;
                analise.timestampAceite = Date.now();
                saveJson(analisesAtivasPath, analisesAtivas);

                // Busca informações
                const usuarioSuspeito = await interaction.client.users.fetch(analise.usuarioSuspeito).catch(() => null);
                const solicitante = await interaction.client.users.fetch(analise.solicitante).catch(() => null);
                const canalFila = await interaction.client.channels.fetch(analise.canalFila).catch(() => null);

                // Atualiza a embed
                const embedAtualizada = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor(0x2ecc71)
                    .setTitle(interaction.message.embeds[0].title.replace('🚨', '✅'))
                    .addFields({
                        name: '✅ Análise Aceita por',
                        value: `${interaction.user} (\`${interaction.user.tag}\`)`,
                        inline: false
                    })
                    .setFooter({ text: `Aceito em ${new Date().toLocaleString('pt-BR')}` });

                // Botão de administrar (somente para quem aceitou)
                const rowAdministrar = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('administrar_analise')
                            .setLabel('Administrar')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji(emojis._settings_emoji || '⚙️')
                    );

                await interaction.message.edit({
                    embeds: [embedAtualizada],
                    components: [rowAdministrar]
                });

                // Dá acesso ao analista
                const guild = await interaction.client.guilds.fetch(analise.guildId).catch(() => null);
                if (guild) {
                    const acessoConcedido = await darAcessoAoCanal(guild, analise.canalFila, interaction.user.id);

                    if (acessoConcedido) {
                        await interaction.followUp({
                            content: 
                                `${emojis.confirmed_emoji || '✅'} **Análise aceita com sucesso!**\n\n` +
                                `📋 **Tipo:** ${analise.tipo}\n` +
                                `👤 **Usuário Suspeito:** ${usuarioSuspeito ? usuarioSuspeito.tag : 'Desconhecido'}\n` +
                                `📍 **Canal da Fila:** ${canalFila}\n\n` +
                                `🔓 Você recebeu acesso ao canal. Use o botão "Administrar" para finalizar a análise.`,
                            ephemeral: true
                        });

                        // Notifica na fila
                        if (canalFila) {
                            const embedNotificacao = new EmbedBuilder()
                                .setTitle('👮 Analista Entrando na Fila')
                                .setDescription(
                                    `${interaction.user} aceitou a análise deste canal.\n\n` +
                                    `**Tipo de Análise:** ${analise.tipo}\n` +
                                    `**Usuário Suspeito:** ${usuarioSuspeito || 'Desconhecido'}\n` +
                                    `**Solicitado por:** ${solicitante || 'Desconhecido'}`
                                )
                                .setColor(0x3498db)
                                .setTimestamp();

                            await canalFila.send({ embeds: [embedNotificacao] }).catch(() => {});
                        }
                    } else {
                        await interaction.followUp({
                            content: `${emojis.failuser_emoji || '⚠️'} Análise aceita, mas erro ao dar acesso. Peça a um ADM.`,
                            ephemeral: true
                        });
                    }
                }

                console.log(`[ANÁLISE] ${interaction.user.tag} aceitou análise ${analise.tipo} de ${usuarioSuspeito?.tag || 'desconhecido'}`);

            } catch (error) {
                console.error('[ERROR] Erro ao aceitar análise:', error);
                await interaction.followUp({
                    content: `${emojis.failuser_emoji || '❌'} Erro ao aceitar análise.`,
                    ephemeral: true
                }).catch(() => {});
            }
        }

        // ========================================
        // BOTÃO: Administrar Análise
        // ========================================
        if (interaction.isButton() && interaction.customId === 'administrar_analise') {
            try {
                const temCargoAnalista = await verificarCargoAnalista(interaction.member);
                if (!temCargoAnalista) {
                    return interaction.reply({
                        content: `${emojis.failuser_emoji || '❌'} Apenas analistas podem usar este botão!`,
                        ephemeral: true
                    });
                }

                const analisesAtivas = loadJson(analisesAtivasPath, {});
                const analise = analisesAtivas[interaction.message.id];

                if (!analise) {
                    return interaction.reply({
                        content: `${emojis.failuser_emoji || '❌'} Análise não encontrada.`,
                        ephemeral: true
                    });
                }

                // Apenas quem aceitou pode administrar
                if (analise.analista !== interaction.user.id) {
                    return interaction.reply({
                        content: `${emojis.failuser_emoji || '❌'} Apenas <@${analise.analista}> pode administrar esta análise!`,
                        ephemeral: true
                    });
                }

                const usuarioSuspeito = await interaction.client.users.fetch(analise.usuarioSuspeito).catch(() => null);

                const embedAdmin = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle(`${emojis._settings_emoji || '⚙️'} Administração`)
                    .setDescription(
                        `${emojis._people_emoji || '👥'} **Usuário:** ${usuarioSuspeito}\n` +
                        `${emojis._text_emoji || '📝'} **Motivo:** ${analise.motivo || 'Não especificado'}\n\n` +
                        `Escolha o resultado da análise:`
                    )
                    .setTimestamp();

                const rowAdmin = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('usuario_limpo')
                            .setLabel('Usuário Limpo')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji(emojis.confirmed_emoji || '✅'),
                        new ButtonBuilder()
                            .setCustomId('usuario_xitado')
                            .setLabel('Usuário Xitado')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji(emojis._ban_emoji || '🔨')
                    );

                await interaction.reply({
                    embeds: [embedAdmin],
                    components: [rowAdmin],
                    ephemeral: true
                });

            } catch (error) {
                console.error('[ERROR] Erro ao abrir administração:', error);
            }
        }

        // ========================================
        // BOTÃO: Usuário Limpo
        // ========================================
        if (interaction.isButton() && interaction.customId === 'usuario_limpo') {
            try {
                await interaction.deferUpdate();

                const analisesAtivas = loadJson(analisesAtivasPath, {});
                let analiseEncontrada = null;
                let messageId = null;

                // Procura a análise pelo analista
                for (const [msgId, dados] of Object.entries(analisesAtivas)) {
                    if (dados.analista === interaction.user.id && dados.aceito && !dados.finalizada) {
                        analiseEncontrada = dados;
                        messageId = msgId;
                        break;
                    }
                }

                if (!analiseEncontrada) {
                    return interaction.followUp({
                        content: `${emojis.failuser_emoji || '❌'} Análise não encontrada.`,
                        ephemeral: true
                    });
                }

                const usuarioSuspeito = await interaction.client.users.fetch(analiseEncontrada.usuarioSuspeito).catch(() => null);
                const canalFila = await interaction.client.channels.fetch(analiseEncontrada.canalFila).catch(() => null);

                // Marca como finalizada
                analiseEncontrada.finalizada = true;
                analiseEncontrada.resultado = 'LIMPO';
                analiseEncontrada.timestampFinalizacao = Date.now();
                saveJson(analisesAtivasPath, analisesAtivas);

                // Envia resultado NA FILA
                if (canalFila) {
                    const embedResultadoFila = new EmbedBuilder()
                        .setTitle('✅ Análise Finalizada - Usuário Limpo')
                        .setDescription(
                            `${interaction.user} finalizou a análise.\n\n` +
                            `**Usuário Analisado:** ${usuarioSuspeito}\n` +
                            `**Resultado:** ✅ **LIMPO**\n` +
                            `**Analista:** ${interaction.user}`
                        )
                        .setColor(0x2ecc71)
                        .setTimestamp();

                    await canalFila.send({ embeds: [embedResultadoFila] }).catch(() => {});
                }

                // Atualiza mensagem do canal de avisos
                const mensagemOriginal = await interaction.message.channel.messages.fetch(messageId).catch(() => null);
                if (mensagemOriginal) {
                    const embedAtualizada = EmbedBuilder.from(mensagemOriginal.embeds[0]);
                    embedAtualizada.addFields({
                        name: `${emojis.confirmed_emoji || '✅'} Resultado`,
                        value: '**Usuário Limpo**',
                        inline: false
                    });
                    embedAtualizada.setColor('#2ecc71');

                    await mensagemOriginal.edit({
                        embeds: [embedAtualizada],
                        components: []
                    });
                }

                await interaction.followUp({
                    content: `${emojis.confirmed_emoji || '✅'} Análise finalizada! Usuário marcado como **limpo**. O resultado foi enviado na fila.`,
                    ephemeral: true
                });

                console.log(`[ANÁLISE] ${interaction.user.tag} marcou ${usuarioSuspeito?.tag} como LIMPO`);

            } catch (error) {
                console.error('[ERROR] Erro ao marcar como limpo:', error);
            }
        }

        // ========================================
        // BOTÃO: Usuário Xitado
        // ========================================
        if (interaction.isButton() && interaction.customId === 'usuario_xitado') {
            try {
                const modal = new ModalBuilder()
                    .setCustomId('modal_blacklist')
                    .setTitle('Adicionar à Blacklist');

                const motivoInput = new TextInputBuilder()
                    .setCustomId('motivo_blacklist')
                    .setLabel('Motivo da Blacklist')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Digite o motivo detalhado...')
                    .setRequired(true)
                    .setMinLength(10)
                    .setMaxLength(1000);

                const rowModal = new ActionRowBuilder().addComponents(motivoInput);
                modal.addComponents(rowModal);

                await interaction.showModal(modal);

            } catch (error) {
                console.error('[ERROR] Erro ao abrir modal:', error);
            }
        }

        // ========================================
        // MODAL: Blacklist
        // ========================================
        if (interaction.isModalSubmit() && interaction.customId === 'modal_blacklist') {
            try {
                await interaction.deferReply({ ephemeral: true });

                const motivoBlacklist = interaction.fields.getTextInputValue('motivo_blacklist');

                const analisesAtivas = loadJson(analisesAtivasPath, {});
                let analiseEncontrada = null;
                let messageId = null;

                for (const [msgId, dados] of Object.entries(analisesAtivas)) {
                    if (dados.analista === interaction.user.id && dados.aceito && !dados.finalizada) {
                        analiseEncontrada = dados;
                        messageId = msgId;
                        break;
                    }
                }

                if (!analiseEncontrada) {
                    return interaction.editReply({
                        content: `${emojis.failuser_emoji || '❌'} Análise não encontrada.`
                    });
                }

                const usuarioSuspeito = await interaction.client.users.fetch(analiseEncontrada.usuarioSuspeito).catch(() => null);
                const canalFila = await interaction.client.channels.fetch(analiseEncontrada.canalFila).catch(() => null);

                // Marca como finalizada
                analiseEncontrada.finalizada = true;
                analiseEncontrada.resultado = 'XITADO';
                analiseEncontrada.motivoBlacklist = motivoBlacklist;
                analiseEncontrada.timestampFinalizacao = Date.now();
                saveJson(analisesAtivasPath, analisesAtivas);

                // Envia resultado NA FILA
                if (canalFila) {
                    const embedResultadoFila = new EmbedBuilder()
                        .setTitle('🔨 Análise Finalizada - Usuário Xitado')
                        .setDescription(
                            `${interaction.user} finalizou a análise.\n\n` +
                            `**Usuário Analisado:** ${usuarioSuspeito}\n` +
                            `**Resultado:** 🔨 **XITADO**\n` +
                            `**Motivo:** ${motivoBlacklist}\n` +
                            `**Analista:** ${interaction.user}`
                        )
                        .setColor(0xe74c3c)
                        .setTimestamp();

                    await canalFila.send({ embeds: [embedResultadoFila] }).catch(() => {});
                }

                // Atualiza mensagem do canal de avisos
                const canalAvisos = await interaction.client.channels.fetch(interaction.channelId).catch(() => null);
                if (canalAvisos) {
                    const mensagemOriginal = await canalAvisos.messages.fetch(messageId).catch(() => null);

                    if (mensagemOriginal) {
                        const embedAtualizada = EmbedBuilder.from(mensagemOriginal.embeds[0]);
                        embedAtualizada.addFields({
                            name: `${emojis._ban_emoji || '🔨'} Resultado`,
                            value: `**Usuário Xitado**\n**Motivo:** ${motivoBlacklist}`,
                            inline: false
                        });
                        embedAtualizada.setColor('#e74c3c');

                        await mensagemOriginal.edit({
                            embeds: [embedAtualizada],
                            components: []
                        });
                    }
                }

                await interaction.editReply({
                    content: `${emojis.confirmed_emoji || '✅'} Análise finalizada! Usuário marcado como **xitado**. O resultado foi enviado na fila.`
                });

                console.log(`[ANÁLISE] ${interaction.user.tag} marcou ${usuarioSuspeito?.tag} como XITADO`);

            } catch (error) {
                console.error('[ERROR] Erro ao processar blacklist:', error);
                await interaction.editReply({
                    content: `${emojis.failuser_emoji || '❌'} Erro ao processar blacklist.`
                }).catch(() => {});
            }
        }
    }
};