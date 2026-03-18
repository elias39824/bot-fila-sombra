const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'emojis.json');

function readDB() {
    try {
        if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, '{}');
            return {};
        }
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (error) {
        console.error('Erro ao ler o banco de dados:', error);
        return {};
    }
}

function saveDB(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Erro ao salvar no banco de dados:', error);
    }
}

class EmojiDB {
    constructor() {
        this.data = readDB();
    }

    set(key, value) {
        this.data[key] = value;
        saveDB(this.data);
    }

    get(key) {
        return this.data[key];
    }

    delete(key) {
        delete this.data[key];
        saveDB(this.data);
    }

    fetchAll() {
        return this.data;
    }
}

const Emojis = new EmojiDB();

module.exports = {
    Emojis
}; 