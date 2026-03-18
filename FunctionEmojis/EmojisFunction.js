const { Emojis } = require('../DataBaseJson');
const AllEmojis = [
  ...require('./emojis.json'),
  ...require('./apostas.json')
];
const axios = require('axios');

async function fetchEmojis(client) {
    const response = await axios.get(`https://discord.com/api/v9/applications/${client.user.id}/emojis`, {
        headers: {
            Authorization: `Bot ${client.token}`
        }
    });
    return response.data.items;
}

async function createEmoji(client, name, image) {
    let response;

    try {
        response = await axios.post(`https://discord.com/api/v9/applications/${client.user.id}/emojis`, {
            name: name,
            image: image
        }, {
            headers: {
                Authorization: `Bot ${client.token}`
            }
        });

        console.log(`\x1b[32m[Emojis]\x1b[0m Emoji ${name} adicionado!`);
        saveEmojiToDatabase(name, response.data.id)
        return `<:${name}:${response.data.id}>`;
    } catch (error) {
        if (error.response && error.response.data && error.response.data.message === 'You are being rate limited.') {
            const retryAfter = error.response.data.retry_after * 1000; 
            await new Promise(resolve => setTimeout(resolve, retryAfter)); 
            return await createEmoji(client, name, image);
        }
        if (error.response.status === 500) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return await createEmoji(client, name, image); 
        }

        console.log(`\x1b[31m[Emojis]\x1b[0m Erro ao adicionar o emoji ${name}: ${error.message}`);
        return null; 
    }
}

async function GetEmoji(client, emojiName) {
    const emojis = await fetchEmojis(client);

    const existingEmoji = emojis.find(e => e.name === emojiName);
    if (existingEmoji) {
        if (existingEmoji.animated) {
            return `<a:${emojiName}:${existingEmoji.id}>`;
        } else {
            return `<:${emojiName}:${existingEmoji.id}>`;
        }
    }

    const emojiData = AllEmojis.find(e => e.name === emojiName);
    if (emojiData) {
        const image = emojiData.image || emojiData.base64;
        return await createEmoji(client, emojiData.name, image);
    }
    return null;
}

async function saveEmojiToDatabase(emojiName, emojiId, animated) {
    try {
        Emojis.set(emojiName, animated ? `<a:${emojiName}:${emojiId}>` : `<:${emojiName}:${emojiId}>`);
    } catch (error) {
        console.log(`\x1b[31m[Emojis]\x1b[0m Erro ao salvar o emoji ${emojiName} no banco de dados: ${error.message}`);
    }
}

async function UploadEmojis(client) {
    const emojis = await fetchEmojis(client);
    const existingNames = new Set(emojis.map(e => e.name));
    let EmojisSalvos = Emojis.fetchAll();
    EmojisSalvos = new Set(Object.keys(EmojisSalvos));
    
    let uploadDB = emojis.filter(emoji => !EmojisSalvos.has(emoji.name)).map(emoji => saveEmojiToDatabase(emoji.name, emoji.id, emoji.animated));
    await Promise.all(uploadDB);
    const uploads = AllEmojis
        .filter(emoji => !existingNames.has(emoji.name)) 
        .map(emoji => createEmoji(client, emoji.name, emoji.image));

    const results = await Promise.all(uploads);
    return results;
}

module.exports = {
    GetEmoji,
    UploadEmojis
};
