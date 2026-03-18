const { UploadEmojis } = require('../FunctionEmojis/EmojisFunction');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        console.log(`Bot está online! Logado como ${client.user.tag}`);
        client.user.setPresence({
          activities: [{ name: 'Aposte aqui!', type: 0 }],
          status: 'online'
        });
        
        console.log('Carregando emojis...');
        try {
            await UploadEmojis(client);
            console.log('Emojis carregados com sucesso!');
        } catch (e) {
            console.warn('Aviso ao carregar emojis:', e.message);
        }
    },
};
