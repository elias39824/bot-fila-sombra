const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const emojis = require('../DataBaseJson/emojis.json');
const cargosPath = path.join(__dirname, '../DataBaseJson/mediador.json');
const configPath = path.join(__dirname, '../config.json');

function loadJson(filePath, defaultValue) {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
        return defaultValue;
    }
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return defaultValue;
    }
}

function saveJson(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error(`[ERROR] Erro ao salvar JSON em ${filePath}:`, e.message);
    }
}

function isOwner(userId) {
    try {
        const config = JSON.parse(fs.readFileSync(configPath));
        return config.ownerId === userId;
    } catch {
        return false;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config_cargo_mediador')
        .setDescription('Configura o cargo de mediador do servidor')
        .addSubcommand(sub =>
            sub.setName('adicionar')
                .setDescription('Adiciona um cargo como cargo de mediador')
                .addRoleOption(opt =>
                    opt.setName('cargo')
                        .setDescription('O cargo que será definido como mediador')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remover')
                .setDescription('Remove um cargo da lista de cargos de mediador')
                .addRoleOption(opt =>
                    opt.setName('cargo')
                        .setDescription('O cargo que será removido')
                        .setRequired(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('ver')
                .setDescription('Veja os cargos de mediador configurados')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !isOwner(interaction.user.id)) {
            return interaction.reply({
                content: `${emojis.failuser_emoji || '❌'} Você não tem permissão para usar este comando!`,
                ephemeral: true
            });
        }

        const sub = interaction.options.getSubcommand();
        let cargos = loadJson(cargosPath, []);

        if (sub === 'ver') {
            const desc = cargos.length > 0
                ? cargos.map(id => `<@&${id}>`).join('\n')
                : '> Nenhum cargo de mediador configurado.';

            const embed = new EmbedBuilder()
                .setTitle(`${emojis.information_emoji || 'ℹ️'} Cargos de Mediador`)
                .setDescription(desc)
                .setColor(0x5865F2)
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'adicionar') {
            const role = interaction.options.getRole('cargo');

            if (cargos.includes(role.id)) {
                return interaction.reply({
                    content: `${emojis.failuser_emoji || '❌'} O cargo <@&${role.id}> já está na lista de mediadores!`,
                    ephemeral: true
                });
            }

            cargos.push(role.id);
            saveJson(cargosPath, cargos);

            const embed = new EmbedBuilder()
                .setTitle(`${emojis._confirm_emoji || '✅'} Cargo Adicionado`)
                .setDescription(`O cargo <@&${role.id}> foi adicionado como cargo de mediador!`)
                .setColor(0x2ecc71)
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (sub === 'remover') {
            const role = interaction.options.getRole('cargo');

            if (!cargos.includes(role.id)) {
                return interaction.reply({
                    content: `${emojis.failuser_emoji || '❌'} O cargo <@&${role.id}> não está na lista de mediadores!`,
                    ephemeral: true
                });
            }

            cargos = cargos.filter(id => id !== role.id);
            saveJson(cargosPath, cargos);

            const embed = new EmbedBuilder()
                .setTitle(`${emojis._remove_emoji || '🗑️'} Cargo Removido`)
                .setDescription(`O cargo <@&${role.id}> foi removido da lista de mediadores!`)
                .setColor(0xe74c3c)
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }
};
