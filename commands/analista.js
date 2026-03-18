const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Carrega os emojis e configurações
const emojis = require('../DataBaseJson/emojis.json');
const analistaPath = path.join(__dirname, '../DataBaseJson/analista.json');
const canalAnalisePath = path.join(__dirname, '../DataBaseJson/canal_analise.json');
const analisesAtivasPath = path.join(__dirname, '../DataBaseJson/analises_ativas.json');

// Funções utilitárias
function loadJson(filePath, defaultValue) {
    if (!fs.existsSync(filePath)) {
        saveJson(filePath, defaultValue);
        return defaultValue;
    }
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(data);
        if (json === null || json === undefined) {
            return defaultValue;
        }
        return json;
    } catch (e) {
        console.error(`[ERROR] Erro ao ler JSON em ${filePath}:`, e.message);
        return defaultValue;
    }
}

function saveJson(filePath, data) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
        console.error(`[ERROR] Erro ao salvar JSON em ${filePath}:`, e.message);
    }
}

function getCanalAnaliseId() {
    try {
        const config = loadJson(canalAnalisePath, { canal: null });
        return config.canal;
    } catch (error) {
        console.error('[ERROR] Erro ao ler canal_analise.json:', error);
        return null;
    }
}

function getCargoAnalistaId() {
    try {
        const ids = loadJson(analistaPath, []);
        return ids.length > 0 ? ids[0] : null;
    } catch (error) {
        console.error('[ERROR] Erro ao ler analista.json:', error);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('analista')
        .setDescription('Solicita análise de um usuário')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Usuário a ser analisado')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da análise')
                .setRequired(true)),

    async execute(interaction) {
        const analistaCargo = getCargoAnalistaId();

        // Verifica se o canal de análise está configurado
        const canalAnaliseId = getCanalAnaliseId();
        if (!canalAnaliseId) {
            return interaction.reply({
                content: `${emojis.negative_emoji || '❌'} Canal de avisos de análise não configurado! Configure no painel de Analista.`,
                ephemeral: true
            });
        }

        // Verifica se o cargo de analista está configurado
        if (!analistaCargo) {
            return interaction.reply({
                content: `${emojis.negative_emoji || '❌'} Cargo de analista não configurado! Configure no painel de Analista.`,
                ephemeral: true
            });
        }

        const user = interaction.options.getUser('user');
        const motivo = interaction.options.getString('motivo');
        const canalFila = interaction.channel;

        // Busca o canal de avisos
        const canalAvisos = await interaction.client.channels.fetch(canalAnaliseId).catch(() => null);
        if (!canalAvisos || !canalAvisos.isTextBased()) {
            return interaction.reply({
                content: `${emojis.negative_emoji || '❌'} Canal de avisos não encontrado ou inválido!`,
                ephemeral: true
            });
        }

        // Embed principal para o canal de avisos
        const embedAnalise = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`${emojis._staff_emoji || '👮'} Solicitação de Análise`)
            .setDescription(
                `${emojis._people_emoji || '👥'} **Usuário:** ${user} (\`${user.tag}\`)\n` +
                `${emojis._text_emoji || '📝'} **Motivo:** ${motivo}\n` +
                `${emojis._star_emoji || '⭐'} **Solicitante:** ${interaction.user}\n` +
                `📍 **Canal/Fila:** ${canalFila}`
            )
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: `ID do Usuário: ${user.id}` })
            .setTimestamp();

        // Botão de assumir análise
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('assumir_analise_cmd')
                    .setLabel('Assumir Análise')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(emojis._confirm_emoji || '✅')
            );

        // Envia a mensagem no canal de avisos
        const msgAvisos = await canalAvisos.send({
            content: `<@&${analistaCargo}>`,
            embeds: [embedAnalise],
            components: [row]
        });

        // Salva a análise ativa
        const analisesAtivas = loadJson(analisesAtivasPath, {});
        analisesAtivas[msgAvisos.id] = {
            canalFila: canalFila.id,
            guildId: interaction.guild.id,
            analista: null,
            tipo: 'CMD_ANALISTA',
            solicitante: interaction.user.id,
            usuarioSuspeito: user.id,
            motivo: motivo,
            timestamp: Date.now(),
            aceito: false
        };
        saveJson(analisesAtivasPath, analisesAtivas);

        // Responde ao usuário confirmando
        await interaction.reply({
            content: `${emojis.confirmed_emoji || '✅'} Análise solicitada com sucesso! Os analistas foram notificados em ${canalAvisos}.`,
            ephemeral: true
        });

        console.log(`[ANALISTA CMD] ${interaction.user.tag} solicitou análise de ${user.tag} no canal ${canalFila.name}`);
    },
};