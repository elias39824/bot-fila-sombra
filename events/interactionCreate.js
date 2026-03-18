const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const emojis = require('../DataBaseJson/emojis.json');
const filaPath = path.join(__dirname, '../DataBaseJson/mediadores.json');
const cargosPath = path.join(__dirname, '../DataBaseJson/mediador.json');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        // Handler dos botões da fila de mediadores
        if (interaction.isButton()) {
            if (interaction.customId === 'entrar_fila' || interaction.customId === 'sair_fila') {
                // Carrega a fila
                let fila = [];
                if (fs.existsSync(filaPath)) {
                    fila = JSON.parse(fs.readFileSync(filaPath));
                }
                // Carrega os cargos permitidos
                let cargosPermitidos = [];
                if (fs.existsSync(cargosPath)) {
                    cargosPermitidos = JSON.parse(fs.readFileSync(cargosPath));
                }
                const userId = interaction.user.id;
                let mudou = false;
                // Mensagens de erro e verificação de cargo
                if (interaction.customId === 'entrar_fila') {
                    // Verifica se o usuário tem o cargo permitido
                    const member = await interaction.guild.members.fetch(userId);
                    const temCargo = member.roles.cache.some(role => cargosPermitidos.includes(role.id));
                    if (!temCargo) {
                        await interaction.reply({
                            content: `${emojis.failuser_emoji || '❌'} Você precisa do cargo de mediador para entrar na fila!`,
                            ephemeral: true
                        });
                        return;
                    }
                    if (fila.includes(userId)) {
                        await interaction.reply({
                            content: `${emojis.failuser_emoji || '❌'} Você já está na fila de mediadores!`,
                            ephemeral: true
                        });
                        return;
                    } else {
                        fila.push(userId);
                        mudou = true;
                    }
                } else if (interaction.customId === 'sair_fila') {
                    if (!fila.includes(userId)) {
                        await interaction.reply({
                            content: `${emojis.failuser_emoji || '❌'} Você não está na fila de mediadores!`,
                            ephemeral: true
                        });
                        return;
                    } else {
                        fila = fila.filter(id => id !== userId);
                        mudou = true;
                    }
                }
                if (mudou) {
                    fs.writeFileSync(filaPath, JSON.stringify(fila, null, 2));
                }
                // Monta a lista de usuários com numeração
                let desc = fila.length > 0 
                    ? fila.map((u, index) => `**${index + 1}.** <@${u}>`).join('\n') 
                    : 'Nenhum mediador na fila.';
                
                // Cria a embed
                const embed = new EmbedBuilder()
                    .setTitle(`${emojis.information_emoji || 'ℹ️'} Fila de Mediadores`)
                    .setDescription('Entre ou saia da fila de mediadores usando os botões abaixo.')
                    .addFields({ name: `${emojis._people_emoji || '👥'} Mediadores na Fila (${fila.length}):`, value: desc })
                    .setColor(0x2ecc71);
                
                // Botões
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('entrar_fila')
                        .setLabel('Entrar na fila')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(emojis.member_add_emoji || '➕'),
                    new ButtonBuilder()
                        .setCustomId('sair_fila')
                        .setLabel('Sair da fila')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji(emojis.member_remove_emoji || '➖')
                );
                
                await interaction.update({ embeds: [embed], components: [row] });
                return;
            }
        }

        if (!interaction.isChatInputCommand()) return;
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
            console.error(`Nenhum comando correspondente a ${interaction.commandName} foi encontrado.`);
            return;
        }
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Houve um erro ao executar este comando!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Houve um erro ao executar este comando!', ephemeral: true });
            }
        }
    },
};