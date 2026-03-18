const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// Caminho para a base de dados de pontos
const pontosPath = path.join(__dirname, '../DataBaseJson/pontos.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Envia o painel de Ranking e consulta de estatísticas pessoais.'),
    
    async execute(interaction) {
        // 1. Definição da Embed Principal (Painel)
        const embedPrincipal = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`${emojis._trophy_emoji || '🏆'} Painel de Estatísticas e Ranking`)
            .setDescription(`Seja bem-vindo ao painel de classificações!\n\n` +
                            `${emojis.confirmed_emoji || '✅'} **Ranking Geral:** Veja quem são os 10 maiores apostadores.\n` +
                            `${emojis._star_emoji || '⭐'} **Minhas Estatísticas:** Consulte seu saldo e posição atual.`)
            .setThumbnail(interaction.guild.iconURL())
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ranking_geral')
                    .setLabel('Ranking Geral (Top 10)')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(emojis._trophy_emoji || '🏆'),
                
                new ButtonBuilder()
                    .setCustomId('ranking_pessoal')
                    .setLabel('Meu Perfil')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(emojis._star_emoji || '⭐'),
            );

        const response = await interaction.reply({ 
            embeds: [embedPrincipal], 
            components: [row]
        });

        // 2. Coletor de Interações para os botões
        const collector = response.createMessageComponentCollector({ time: 60000 }); // Ativo por 60 segundos

        collector.on('collect', async (i) => {
            // Ler banco de dados atualizado a cada clique
            let dbPontos = {};
            if (fs.existsSync(pontosPath)) {
                dbPontos = JSON.parse(fs.readFileSync(pontosPath, 'utf-8'));
            }

            // --- LÓGICA: RANKING GERAL (TOP 10) ---
            if (i.customId === 'ranking_geral') {
                // Converte objeto em array e ordena por pontos (maior para menor)
                const rankingArray = Object.entries(dbPontos)
                    .map(([id, data]) => ({ id, ...data }))
                    .sort((a, b) => b.pontos - a.pontos)
                    .slice(0, 10);

                if (rankingArray.length === 0) {
                    return i.reply({ content: 'Ainda não há ninguém no ranking!', ephemeral: true });
                }

                const rankingTexto = rankingArray.map((user, index) => {
                    const medalha = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}º`;
                    return `${medalha} | <@${user.id}> — **${user.pontos}** pontos`;
                }).join('\n');

                const embedRanking = new EmbedBuilder()
                    .setTitle(`${emojis._trophy_emoji || '🏆'} TOP 10 - Classificação Geral`)
                    .setDescription(rankingTexto)
                    .setColor(0xF1C40F)
                    .setTimestamp();

                await i.reply({ embeds: [embedRanking], ephemeral: true });
            }

            // --- LÓGICA: MEU PERFIL (ESTATÍSTICAS PESSOAIS) ---
            if (i.customId === 'ranking_pessoal') {
                const userData = dbPontos[i.user.id];
                
                if (!userData) {
                    return i.reply({ content: 'Você ainda não possui pontos registrados no sistema.', ephemeral: true });
                }

                // Calcular posição no ranking
                const posicao = Object.entries(dbPontos)
                    .sort((a, b) => b[1].pontos - a[1].pontos)
                    .findIndex(([id]) => id === i.user.id) + 1;

                const embedPessoal = new EmbedBuilder()
                    .setTitle(`${emojis._star_emoji || '⭐'} Suas Estatísticas`)
                    .setThumbnail(i.user.displayAvatarURL())
                    .setColor(0x2ECC71)
                    .addFields(
                        { name: '💰 Saldo de Pontos', value: `\`${userData.pontos}\` pontos`, inline: true },
                        { name: '📊 Posição no Ranking', value: `\`${posicao}º\` lugar`, inline: true }
                    )
                    .setFooter({ text: `Consultado por ${i.user.username}` });

                await i.reply({ embeds: [embedPessoal], ephemeral: true });
            }
        });

        // Desativa os botões quando o coletor expirar
        collector.on('end', () => {
            row.components.forEach(c => c.setDisabled(true));
            interaction.editReply({ components: [row] }).catch(() => {});
        });
    },
};
