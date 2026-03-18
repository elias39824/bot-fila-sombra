require('./config');
require('dotenv').config();

const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

// Usa o token da variável de ambiente se disponível
if (process.env.DISCORD_BOT_TOKEN) {
    config.token = process.env.DISCORD_BOT_TOKEN;
}

if (!config.token) {
    console.error('❌ Token do bot não encontrado! Configure DISCORD_BOT_TOKEN nas variáveis de ambiente.');
    process.exit(1);
}

// ✅ CORRIGE O WARNING DE MAXLISTENERS
const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 50;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMembers // ✅ Adicionado para buscar membros
    ]
});

// ✅ Aumenta o limite de listeners no client
client.setMaxListeners(50);

client.commands = new Collection();
client.cooldowns = new Collection();

// ============================================
// CARREGA COMANDOS SLASH
// ============================================

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`[COMMAND] ✅ Carregado: ${command.data.name}`);
        } else {
            console.warn(`[COMMAND] ⚠️ Comando inválido: ${file}`);
        }
    } catch (error) {
        console.error(`[COMMAND] ❌ Erro ao carregar ${file}:`, error.message);
    }
}

// ============================================
// CARREGA EVENTOS
// ============================================

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        
        console.log(`[EVENT] ✅ Carregado: ${event.name} (${event.once ? 'once' : 'on'})`);
    } catch (error) {
        console.error(`[EVENT] ❌ Erro ao carregar ${file}:`, error.message);
    }
}

// ============================================
// CARREGA COMANDOS DE PREFIXO
// ============================================

client.prefixCommands = new Map();
const prefixCommandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of prefixCommandFiles) {
    try {
        const command = require(`./commands/${file}`);
        if (command.name && command.execute) {
            client.prefixCommands.set(command.name, command);
            console.log(`[PREFIX] ✅ Carregado: ${command.name}`);
        }
    } catch (error) {
        console.error(`[PREFIX] ❌ Erro ao carregar ${file}:`, error.message);
    }
}

// ============================================
// HANDLER DE COMANDOS DE PREFIXO
// ============================================

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    const command = client.prefixCommands.get(commandName);
    if (!command) return;
    
    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(`[PREFIX] ❌ Erro ao executar !${commandName}:`, error);
        message.reply('❌ Ocorreu um erro ao executar o comando.').catch(() => {});
    }
});

// ============================================
// REGISTRA COMANDOS SLASH NA API DO DISCORD
// ============================================

const rest = new REST().setToken(config.token);

(async () => {
    try {
        console.log('[SLASH] 📋 Iniciando registro dos comandos slash...');

        const commands = [];
        for (const file of commandFiles) {
            try {
                const command = require(`./commands/${file}`);
                if (command.data && typeof command.data.toJSON === 'function') {
                    commands.push(command.data.toJSON());
                }
            } catch (error) {
                console.error(`[SLASH] ⚠️ Erro ao processar ${file}:`, error.message);
            }
        }

        await rest.put(
            Routes.applicationCommands(config.clientId),
            { body: commands },
        );

        console.log(`[SLASH] ✅ ${commands.length} comandos registrados com sucesso!`);
    } catch (error) {
        console.error('[SLASH] ❌ Erro ao registrar comandos:', error);
    }
})();

// ============================================
// TRATAMENTO DE ERROS GLOBAIS
// ============================================

process.on('unhandledRejection', (reason, promise) => {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ UNHANDLED REJECTION');
    console.error('Promise:', promise);
    console.error('Reason:', reason);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

process.on('uncaughtException', (err) => {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ UNCAUGHT EXCEPTION');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Não encerra o processo automaticamente
    // process.exit(1);
});

// ============================================
// EVENTO DE BOT PRONTO (CORRIGIDO)
// ============================================

client.once('ready', () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ BOT ONLINE!`);
    console.log(`📛 Nome: ${client.user.tag}`);
    console.log(`🆔 ID: ${client.user.id}`);
    console.log(`🏠 Servidores: ${client.guilds.cache.size}`);
    console.log(`👥 Usuários: ${client.users.cache.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

// ============================================
// LOGIN DO BOT
// ============================================

client.login(config.token).catch(error => {
    console.error('❌ Erro ao fazer login:', error);
    process.exit(1);
});