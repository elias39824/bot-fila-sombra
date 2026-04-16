const { REST, Routes } = require('discord.js')
require('dotenv').config()

const rest = new REST().setToken(process.env.TOKEN)

// Pega o ID do bot a partir do token
const clientId = Buffer.from(process.env.TOKEN.split('.')[0], 'base64').toString()

async function clearCommands() {
  try {
    console.log('🗑️  Apagando todos os slash commands globais...')
    await rest.put(Routes.applicationCommands(clientId), { body: [] })
    console.log('✅ Slash commands globais apagados!')

    // Se quiser apagar de um servidor específico também, descomente abaixo:
    // const GUILD_ID = 'ID_DO_SERVIDOR'
    // await rest.put(Routes.applicationGuildCommands(clientId, GUILD_ID), { body: [] })
    // console.log('✅ Slash commands do servidor apagados!')

  } catch (error) {
    console.error('❌ Erro:', error)
  }
}

clearCommands()
