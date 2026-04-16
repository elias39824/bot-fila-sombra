const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { emojis, colors } = require('../../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mediadores')
        .setDescription('Configura um painel de fila de mediadores.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {
        const fila = client.database.get(`fila_mediadores_${interaction.guild.id}`) || [];
        const desc = fila.length > 0 ? fila.map(u => `<@${u}> \`${u}\``).join('\n') : 'Nenhum mediador na fila.';

        const embed = new EmbedBuilder()
            .setTitle(`🛡️ Fila de Mediadores`)
            .setDescription('Entre ou saia da fila de mediadores usando os botões abaixo.')
            .addFields({ name: 'Mediadores na Fila:', value: desc })
            .setColor(colors.success)
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('entrar_fila_med')
                .setLabel('Entrar na fila')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅'),
            new ButtonBuilder()
                .setCustomId('sair_fila_med')
                .setLabel('Sair da fila')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('❌')
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
