const { Client, Collection, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const SimplDB = require('simpl.db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();
client.database = new SimplDB();

// Carregar Comandos (Slash e Prefix)
const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        // Slash Commands
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
        
        // Prefix Commands (para compatibilidade se necessário)
        if ('name' in command && !('data' in command)) {
            client.commands.set(command.name, command);
        }
    }
}

// Carregar Eventos
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
    } else {
        client.on(event.name, (...args) => event.execute(...args, client));
    }
}

// Registrar Slash Commands
client.once('ready', async () => {
    console.log(`Logado como ${client.user.tag}!`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Iniciando atualização dos comandos (/) da aplicação.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Comandos (/) da aplicação registrados com sucesso.');
    } catch (error) {
        console.error(error);
    }
});

client.login(process.env.TOKEN);

module.exports = client;
