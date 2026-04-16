const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { emojis, colors } = require('../../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coins')
        .setDescription('Veja o seu saldo de coins ou de outro usuário.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('O usuário para ver o saldo.')
                .setRequired(false)),
    async execute(interaction, client) {
        const target = interaction.options.getUser('usuario') || interaction.user;
        const coins = client.database.get(`coins_${target.id}`) || 0;

        const embed = new EmbedBuilder()
            .setTitle(`${emojis.moeda} | Saldo de Coins`)
            .setDescription(`${target === interaction.user ? 'Você' : target} possui **${coins}** coins!`)
            .setColor(colors.primary)
            .setThumbnail(target.displayAvatarURL())
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
