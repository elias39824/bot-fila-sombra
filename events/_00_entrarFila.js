const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

const emojisPath = path.join(__dirname, '../DataBaseJson/emojis.json');
const filaPath = path.join(__dirname, '../DataBaseJson/mediadores.json');
const cargosPath = path.join(__dirname, '../DataBaseJson/mediador.json');

function loadEmojis() {
    try { return JSON.parse(fs.readFileSync(emojisPath, 'utf-8')); } catch { return {}; }
}
function loadFila() {
    try { return JSON.parse(fs.readFileSync(filaPath, 'utf-8')); } catch { return []; }
}
function loadCargos() {
    try { return JSON.parse(fs.readFileSync(cargosPath, 'utf-8')); } catch { return []; }
}
function saveFila(fila) {
    fs.writeFileSync(filaPath, JSON.stringify(fila, null, 2));
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.isButton()) return;
        const { customId } = interaction;
        if (customId !== 'entrar_fila' && customId !== 'sair_fila') return;

        try {
            const emojis = loadEmojis();
            let fila = loadFila();
            const cargosPermitidos = loadCargos();
            const userId = interaction.user.id;

            if (customId === 'entrar_fila') {
                const temCargo = interaction.member.roles.cache.some(r => cargosPermitidos.includes(r.id));
                if (!temCargo) {
                    await interaction.reply({
                        content: `${emojis.failuser_emoji || '❌'} Você precisa do cargo de mediador para entrar na fila!`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                if (fila.includes(userId)) {
                    await interaction.reply({
                        content: `${emojis.failuser_emoji || '❌'} Você já está na fila de mediadores!`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                fila.push(userId);
                saveFila(fila);
            } else {
                if (!fila.includes(userId)) {
                    await interaction.reply({
                        content: `${emojis.failuser_emoji || '❌'} Você não está na fila de mediadores!`,
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }
                fila = fila.filter(id => id !== userId);
                saveFila(fila);
            }

            const desc = fila.length > 0
                ? fila.map((u, i) => `**${i + 1}.** <@${u}>`).join('\n')
                : 'Nenhum mediador na fila.';

            const embed = new EmbedBuilder()
                .setTitle(`${emojis.information_emoji || 'ℹ️'} Fila de Mediadores`)
                .setDescription('Entre ou saia da fila de mediadores usando os botões abaixo.')
                .addFields({ name: `${emojis._people_emoji || '👥'} Mediadores na Fila (${fila.length}):`, value: desc })
                .setColor(0x2ecc71);

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
        } catch (err) {
            console.error('[entrar/sair_fila] Erro:', err.code || err.message);
            if (!interaction.replied && !interaction.deferred) {
                try {
                    await interaction.reply({ content: '❌ Erro ao processar. Tente novamente.', flags: MessageFlags.Ephemeral });
                } catch {}
            }
        }
    }
};
