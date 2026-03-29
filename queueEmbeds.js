// This is a placeholder for the ultra premium embed designs for queue systems
// Each queue type gets its own embed design

const queueEmbeds = {
  mobileQueue: {
    title: 'Mobile Queue',
    description: 'Join the Mobile Queue!',
    color: '#00FF00',  // Green
    fields: [
      { name: 'Users in Queue', value: '0', inline: true },
      { name: 'Estimated Wait Time', value: 'N/A', inline: true }
    ],
    footer: { text: 'Powered by Bot-Fila-Sombra' }
  },
  emulatorQueue: {
    title: 'Emulator Queue',
    description: 'Join the Emulator Queue!',
    color: '#0000FF',  // Blue
    fields: [
      { name: 'Users in Queue', value: '0', inline: true },
      { name: 'Estimated Wait Time', value: 'N/A', inline: true }
    ],
    footer: { text: 'Powered by Bot-Fila-Sombra' }
  },
  mixedQueue: {
    title: 'Mixed Queue',
    description: 'Join the Mixed Queue!',
    color: '#FFAA00',  // Orange
    fields: [
      { name: 'Users in Queue', value: '0', inline: true },
      { name: 'Estimated Wait Time', value: 'N/A', inline: true }
    ],
    footer: { text: 'Powered by Bot-Fila-Sombra' }
  },
  streamerQueue: {
    title: 'Streamer Queue',
    description: 'Join the Streamer Queue!',
    color: '#FF0000',  // Red
    fields: [
      { name: 'Users in Queue', value: '0', inline: true },
      { name: 'Estimated Wait Time', value: 'N/A', inline: true }
    ],
    footer: { text: 'Powered by Bot-Fila-Sombra' }
  }
};

module.exports = queueEmbeds;