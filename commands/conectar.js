const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const emojis = require('../DataBaseJson/emojis.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('conectar')
        .setDescription('Comando de voz não disponível nesta versão.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        await interaction.reply({
            content: `${emojis.failuser_emoji || '❌'} Comando de voz não disponível nesta versão do bot.`,
            ephemeral: true
        });
    }
};
