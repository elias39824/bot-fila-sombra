// automatic queue handler

const { Message } = require('discord.js');

class QueueHandler {
    constructor() {
        this.queues = [];
        this.initializeQueues();
    }

    // Initialize queues with random values
    initializeQueues() {
        for (let i = 0; i < 9; i++) {
            const value = (Math.random() * (100 - 0.20) + 0.20).toFixed(2);
            this.queues.push(value);
        }
    }

    // Method to detect channel and send queue values
    handleMessage(message) {
        if (message.channel.name === 'your-channel-name') { // Replace with the actual channel name
            const queueMessage = `Queues: ${this.queues.join(', ')} R$`;
            message.channel.send(queueMessage);
        }
    }
}

module.exports = new QueueHandler();
