const { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const emojis = require('../DataBaseJson/emojis.json');

// --- Caminhos ---
const mediadoresPath = path.join(__dirname, '../DataBaseJson/mediadores.json');
const filasDadosPath = path.join(__dirname, '../DataBaseJson/filasDados.json');

// --- Função para verificar se é mediador ---
function isMediator(member) {
    let mediatorRoleIds = [];
    try {
        const data = fs.readFileSync(mediadoresPath, 'utf-8');
        mediatorRoleIds = JSON.parse(data);
    } catch (e) {
        // Falha silenciosa na leitura do JSON
    }

    if (mediatorRoleIds.some(roleId => member.roles.cache.has(roleId))) {
        return true;
    }
    return member.permissions.has(PermissionsBitField.Flags.ManageChannels);
}

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Ignora mensagens de bots
        if (message.author.bot) return;

        // Verifica se a mensagem começa com !med
        if (!message.content.toLowerCase().startsWith('!med')) return;

        // Verifica se o usuário é mediador
        if (!isMediator(message.member)) {
            return message.reply({
                content: `${emojis.failuser_emoji || '❌'} Apenas membros com cargo de Mediador podem usar este comando.`
            }).catch(console.error);
        }

        // Verifica se existe uma partida ativa no canal
        let filasDados = {};
        if (fs.existsSync(filasDadosPath)) {
            try {
                filasDados = JSON.parse(fs.readFileSync(filasDadosPath, 'utf-8'));
            } catch (err) {
                console.error("Erro ao ler filasDados.json:", err);
            }
        }

        const partida = filasDados[message.channel.id];
        
        if (!partida || !partida.jogadores || partida.jogadores.length < 2) {
            return message.reply({
                content: `${emojis.failuser_emoji || '❌'} Não há uma partida ativa neste canal.`
            }).catch(console.error);
        }

        // Verifica se é o mediador da partida
        if (message.author.id !== partida.id_mediador) {
            return message.reply({
                content: `${emojis.failuser_emoji || '❌'} Apenas o mediador desta partida (<@${partida.id_mediador}>) pode usar este comando.`
            }).catch(console.error);
        }

        // Cria o menu de seleção com as opções
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('med_panel_action')
            .setPlaceholder('🎯 Escolha uma ação')
            .addOptions([
                {
                    label: 'Definir Vencedor',
                    description: 'Selecione o vencedor da partida',
                    value: 'definir_vencedor',
                    emoji: emojis._star_emoji || '⭐'
                },
                {
                    label: 'Encerrar Aposta',
                    description: 'Encerre a aposta da partida',
                    value: 'encerrar_aposta',
                    emoji: emojis.confirmed_emoji || '✅'
                },
                {
                    label: 'Solicitar Revanche',
                    description: 'Solicite uma revanche aos jogadores',
                    value: 'solicitar_revanche',
                    emoji: '🔄'
                },
                {
                    label: 'Trocar Valor da Aposta',
                    description: 'Altere o valor da aposta atual',
                    value: 'trocar_valor_aposta',
                    emoji: '💰'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Obtém informações dos jogadores
        let jogadoresIDs = partida.jogadores.map(j => (typeof j === 'object' && j.id) ? j.id : j);
        let jogadoresNomes = jogadoresIDs.map(id => {
            const member = message.guild.members.cache.get(id);
            return member ? member.displayName : id;
        });

        // Cria a embed do painel
        const panelEmbed = new EmbedBuilder()
            .setTitle(`${emojis._star_emoji || '🛡️'} Painel de Mediação`)
            .setDescription('**Selecione uma ação para gerenciar a partida:**')
            .addFields(
                { 
                    name: `${emojis._star_emoji || '⭐'} Definir Vencedor`, 
                    value: 'Escolha o vencedor da partida', 
                    inline: true 
                },
                { 
                    name: `${emojis.confirmed_emoji || '✅'} Encerrar Aposta`, 
                    value: 'Finalize as apostas', 
                    inline: true 
                },
                {
                    name: '🔄 Solicitar Revanche',
                    value: 'Peça uma revanche aos jogadores',
                    inline: true
                },
                {
                    name: '💰 Trocar Valor',
                    value: 'Altere o valor da aposta',
                    inline: true
                },
                {
                    name: '👥 Jogadores',
                    value: jogadoresNomes.join(' vs '),
                    inline: false
                },
                {
                    name: '💵 Valor da Aposta',
                    value: partida.valorAposta ? `${partida.valorAposta}` : 'Não definido',
                    inline: true
                }
            )
            .setColor('#5865F2')
            .setThumbnail(message.author.displayAvatarURL())
            .setFooter({ text: `Mediador: ${message.author.tag}` })
            .setTimestamp();

        // Envia o painel
        await message.reply({
            embeds: [panelEmbed],
            components: [row]
        }).catch(console.error);

        // Deleta a mensagem do comando (opcional)
        try {
            await message.delete();
        } catch (e) {
            console.log('Não foi possível deletar a mensagem do comando');
        }
    }
};