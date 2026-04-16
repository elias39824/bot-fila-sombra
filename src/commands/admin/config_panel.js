const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, StringSelectMenuBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config_panel')
        .setDescription('Abre o painel de configurações avançado do bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setTitle(`${emojis.config} | Painel de Configurações Avançado`)
            .setDescription(`Selecione uma das opções abaixo para configurar o bot!`)
            .addFields([
                {
                    name: `${emojis.mediador} | Sistema de Mediador`,
                    value: "Configure os cargos e canais de mediação.",
                    inline: true
                },
                {
                    name: `${emojis.moeda} | Sistema de Coins`,
                    value: "Configure a economia do bot.",
                    inline: true
                },
                {
                    name: `${emojis.personalizar} | Personalização`,
                    value: "Personalize as mensagens e embeds.",
                    inline: true
                },
                {
                    name: `${emojis.analista} | Sistema de Analista`,
                    value: "Veja as estatísticas das filas.",
                    inline: true
                }
            ])
            .setFooter({ text: `${interaction.guild.name} - Configurações`, iconURL: interaction.guild.iconURL() })
            .setColor(colors.primary);

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('config_select')
                .setPlaceholder('Selecione uma categoria...')
                .addOptions([
                    { label: 'Mediador', value: 'config_mediador', emoji: emojis.mediador },
                    { label: 'Coins', value: 'config_coins', emoji: emojis.moeda },
                    { label: 'Personalização', value: 'config_personalizar', emoji: emojis.personalizar },
                    { label: 'Analista', value: 'config_analista', emoji: emojis.analista }
                ])
        );

        await interaction.reply({
            embeds: [embed],
            components: [selectMenu],
            ephemeral: true
        });
    },
};
