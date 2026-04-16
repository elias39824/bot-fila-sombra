const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { emojis, colors } = require('../../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analista')
        .setDescription('Veja as estatísticas detalhadas do bot.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {
        const stats = client.database.get(`stats_${interaction.guild.id}`) || {
            partidas: 0,
            coins_movimentados: 0,
            mediadores_ativos: 0
        };

        const embed = new EmbedBuilder()
            .setTitle(`${emojis.analista} | Sistema de Analista`)
            .setDescription(`Estatísticas gerais do servidor **${interaction.guild.name}**`)
            .addFields([
                { name: '🎮 Partidas Realizadas', value: `\`${stats.partidas}\``, inline: true },
                { name: '💰 Coins Movimentados', value: `\`${stats.coins_movimentados}\``, inline: true },
                { name: '🛡️ Mediadores Ativos', value: `\`${client.database.get(`fila_mediadores_${interaction.guild.id}`)?.length || 0}\``, inline: true }
            ])
            .setColor(colors.primary)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
