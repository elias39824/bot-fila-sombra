const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { emojis, colors } = require('../../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup_fila')
        .setDescription('Configura um painel de filas completo.')
        .addStringOption(option => 
            option.setName('modo')
                .setDescription('O modo de jogo (ex: 1v1, 2v2, 4v4).')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('valor')
                .setDescription('O valor da partida em reais.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('titulo')
                .setDescription('O título do painel (opcional).')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction, client) {
        const modo = interaction.options.getString('modo');
        const valor = interaction.options.getInteger('valor');
        const titulo = interaction.options.getString('titulo') || "PATINHAS APOSTAS";

        const embed = new EmbedBuilder()
            .setAuthor({ name: titulo, iconURL: interaction.guild.iconURL() })
            .setTitle(`**${titulo}**`)
            .setDescription(`**Filas Mobile**\n\n- **${emojis.coroa} Modo**\n  ${modo.toUpperCase()} MOBILE\n- **Valor**\n  R$ ${valor},00\n- **Jogadores**\n  Nenhum jogador na fila`)
            .addFields([
                {
                    name: `${emojis.users} | Fila Gelo Normal`,
                    value: "Ninguém na fila",
                    inline: false
                },
                {
                    name: `${emojis.users} | Fila Gelo Infinito`,
                    value: "Ninguém na fila",
                    inline: false
                }
            ])
            .setColor(colors.primary)
            .setFooter({ text: "Venha Apostar", iconURL: interaction.guild.iconURL() });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('fila_gelnormal')
                .setLabel('Gel Normal')
                .setEmoji(emojis.gelo)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('fila_gelinfinito')
                .setLabel('Gel Infinito')
                .setEmoji(emojis.gelo)
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('fila_sair')
                .setLabel('Sair da Fila')
                .setEmoji(emojis.errado)
                .setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        client.database.set(`match_${msg.id}`, {
            titulo: titulo,
            modo: modo,
            valor: valor,
            gelnormal: [],
            gelinfinito: []
        });
    },
};
