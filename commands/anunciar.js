const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    ChannelType 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Caminho para salvar templates
const templatesPath = path.join(__dirname, '../DataBaseJson/templatesAnuncios.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('anunciar')
        .setDescription('Painel avançado de criação de anúncios.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // --- Embed Inicial (Preview) ---
        const previewEmbed = new EmbedBuilder()
            .setTitle('Título do Anúncio')
            .setDescription('Clique nos botões abaixo para editar este conteúdo. Você pode usar Markdown aqui.')
            .setColor(0x2b2d31)
            .setFooter({ text: 'Rodapé do Anúncio' });

        // --- Botões de Edição ---
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('edit_text').setLabel('Texto').setEmoji('📝').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('edit_media').setLabel('Mídia').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('edit_color').setLabel('Cor').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('edit_footer').setLabel('Rodapé').setEmoji('📑').setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('select_channel').setLabel('Escolher Canal').setEmoji('📢').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('save_template').setLabel('Salvar Template').setEmoji('💾').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('post_announcement').setLabel('Postar Anúncio').setEmoji('🚀').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({
            content: '## 🛠️ Construtor de Anúncios Profissional\nPersonalize sua mensagem antes de enviar para o público.',
            embeds: [previewEmbed],
            components: [row1, row2],
            ephemeral: true
        });

        // --- Coletor de Interações (Fica ativo por 15 minutos) ---
        const filter = (i) => i.user.id === interaction.user.id;
        const collector = response.createMessageComponentCollector({ filter, time: 900000 });

        let targetChannel = interaction.channel;

        collector.on('collect', async (i) => {
            // --- MODAL DE TEXTO ---
            if (i.customId === 'edit_text') {
                const modal = new ModalBuilder().setCustomId('modal_text').setTitle('Editar Texto');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('t').setLabel('Título').setStyle(TextInputStyle.Short).setValue(previewEmbed.data.title || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('d').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setValue(previewEmbed.data.description || ''))
                );
                return await i.showModal(modal);
            }

            // --- MODAL DE MÍDIA ---
            if (i.customId === 'edit_media') {
                const modal = new ModalBuilder().setCustomId('modal_media').setTitle('Editar Imagens');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('i').setLabel('URL da Imagem Grande').setStyle(TextInputStyle.Short).setRequired(false).setValue(previewEmbed.data.image?.url || '')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('th').setLabel('URL da Thumbnail (Canto)').setStyle(TextInputStyle.Short).setRequired(false).setValue(previewEmbed.data.thumbnail?.url || ''))
                );
                return await i.showModal(modal);
            }

            // --- MODAL DE COR ---
            if (i.customId === 'edit_color') {
                const modal = new ModalBuilder().setCustomId('modal_color').setTitle('Editar Cor');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c').setLabel('Cor em Hexadecimal (Ex: #FF0000)').setStyle(TextInputStyle.Short).setPlaceholder('#2b2d31'))
                );
                return await i.showModal(modal);
            }

            // --- POSTAR ANÚNCIO ---
            if (i.customId === 'post_announcement') {
                await targetChannel.send({ embeds: [previewEmbed] });
                return await i.reply({ content: `✅ Anúncio enviado com sucesso em ${targetChannel}!`, ephemeral: true });
            }

            // --- SALVAR TEMPLATE ---
            if (i.customId === 'save_template') {
                let templates = {};
                if (fs.existsSync(templatesPath)) templates = JSON.parse(fs.readFileSync(templatesPath, 'utf-8'));
                
                templates[previewEmbed.data.title || "Sem Título"] = previewEmbed.data;
                fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));
                
                return await i.reply({ content: '💾 Template salvo com sucesso no banco de dados!', ephemeral: true });
            }
        });

        // --- Handler para os Modais ---
        interaction.client.on('interactionCreate', async (modalInt) => {
            if (!modalInt.isModalSubmit()) return;

            if (modalInt.customId === 'modal_text') {
                const title = modalInt.fields.getTextInputValue('t');
                const desc = modalInt.fields.getTextInputValue('d');
                previewEmbed.setTitle(title).setDescription(desc);
            }

            if (modalInt.customId === 'modal_media') {
                const img = modalInt.fields.getTextInputValue('i');
                const thumb = modalInt.fields.getTextInputValue('th');
                if (img) previewEmbed.setImage(img);
                if (thumb) previewEmbed.setThumbnail(thumb);
            }

            if (modalInt.customId === 'modal_color') {
                let color = modalInt.fields.getTextInputValue('c');
                if (!color.startsWith('#')) color = `#${color}`;
                try { previewEmbed.setColor(color); } catch { }
            }

            if (modalInt.customId.startsWith('modal_')) {
                await modalInt.update({ embeds: [previewEmbed] });
            }
        });
    }
};
