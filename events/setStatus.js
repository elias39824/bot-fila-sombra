const { Events } = require('discord.js');

module.exports = {
  name: 'ready',
  once: false,
  async execute(client) {
    client.user.setPresence({
      activities: [{ name: 'made by flow solutions', type: 0 }],
      status: 'online'
    });
    console.log('Status setado pelo evento setStatus!');
  },
}; 