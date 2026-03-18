const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton()) return;
        
        if (!['confirmar_encerrar_aposta', 'cancelar_encerrar_aposta'].includes(interaction.customId)) return;

        try {
            await interaction.deferUpdate();

            // Carrega os dados da partida
            let filasDados = {};
            if (fs.existsSync(filasDadosPath)) {
                filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
            }

            const partida = filasDados[interaction.channel.id];

            if (!partida) {
                return await interaction.followUp({
                    content: `${emojis.failuser_emoji || '❌'} Partida não encontrada.`,
                    ephemeral: true
                });
            }

            // Verifica se é o mediador
            if (interaction.user.id !== partida.id_mediador) {
                return await interaction.followUp({
                    content: `${emojis.failuser_emoji || '❌'} Apenas o mediador pode usar este botão.`,
                    ephemeral: true
                });
            }

            if (interaction.customId === 'confirmar_encerrar_aposta') {
                // AQUI VOCÊ ADICIONA A LÓGICA PARA ENCERRAR APOSTAS
                // Exemplo: atualizar banco de dados de apostas, distribuir ganhos, etc.
                
                const successEmbed = new EmbedBuilder()
                    .setTitle(`${emojis.confirmed_emoji || '✅'} Apostas Encerradas`)
                    .setDescription(
                        `${emojis.confirmed_emoji || '✅'} As apostas desta partida foram encerradas com sucesso!\n\n` +
                        `**Mediador:** <@${interaction.user.id}>\n` +
                        `**Canal:** ${interaction.channel.name}`
                    )
                    .setColor('#2ECC71')
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [successEmbed],
                    components: []
                });

                // Envia mensagem no canal
                await interaction.channel.send({
                    content: `${emojis.confirmed_emoji || '✅'} <@${interaction.user.id}> encerrou as apostas desta partida!`
                });

            } else if (interaction.customId === 'cancelar_encerrar_aposta') {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle(`${emojis.failuser_emoji || '❌'} Ação Cancelada`)
                    .setDescription(`O encerramento das apostas foi cancelado.`)
                    .setColor('#95A5A6')
                    .setThumbnail(interaction.user.displayAvatarURL());

                await interaction.editReply({
                    embeds: [cancelEmbed],
                    components: []
                });
            }

        } catch (error) {
            console.error('Erro ao processar botão de encerrar aposta:', error);
            try {
                await interaction.followUp({
                    content: `${emojis.failuser_emoji || '❌'} Ocorreu um erro ao processar sua ação.`,
                    ephemeral: true
                });
            } catch (e) {
                console.error('Erro ao enviar mensagem de erro:', e);
            }
        }
    }
};