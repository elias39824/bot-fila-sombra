const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const emojisPath = path.join(__dirname, '../DataBaseJson/emojis.json');
const mediadorPath = path.join(__dirname, '../DataBaseJson/mediador.json');
const qrcodeConfigPath = path.join(__dirname, '../DataBaseJson/qrcode_config.json');

// Configuração padrão do QR Code
const DEFAULT_QRCODE_CONFIG = {
    size: 300,
    color: '000000',
    bgcolor: 'FFFFFF',
    format: 'png'
};

function loadJson(filePath, defaultValue = {}) {
    if (!fs.existsSync(filePath)) {
        return defaultValue;
    }
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return defaultValue;
    }
}

/**
 * Carrega configuração personalizada do QR Code
 */
function getQRCodeConfig() {
    try {
        if (!fs.existsSync(qrcodeConfigPath)) {
            console.log('[QR CONFIG] Usando configuração padrão');
            return DEFAULT_QRCODE_CONFIG;
        }
        const data = fs.readFileSync(qrcodeConfigPath, 'utf-8');
        const config = JSON.parse(data);
        console.log('[QR CONFIG] Configuração personalizada carregada:', config);
        return config;
    } catch (error) {
        console.error('[QR CONFIG] Erro ao ler configuração:', error);
        return DEFAULT_QRCODE_CONFIG;
    }
}

function userIsMediador(member) {
    try {
        const ids = loadJson(mediadorPath, []);
        return ids.some(id => member.roles.cache.has(id));
    } catch {
        return false;
    }
}

/**
 * Extrai chave PIX do texto
 */
function extrairChavePix(texto) {
    const emailRegex = /([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/;
    const cpfRegex = /\b(\d{11})\b/;
    const cnpjRegex = /\b(\d{14})\b/;
    const telefoneRegex = /(\+?55\d{10,11}|\d{10,11})/;
    const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

    let match = texto.match(emailRegex);
    if (match) return { chave: match[0].toLowerCase(), tipo: 'Email' };
    
    match = texto.match(uuidRegex);
    if (match) return { chave: match[0].toLowerCase(), tipo: 'Chave Aleatória' };
    
    match = texto.match(cnpjRegex);
    if (match) return { chave: match[0], tipo: 'CNPJ' };
    
    match = texto.match(cpfRegex);
    if (match) return { chave: match[0], tipo: 'CPF' };
    
    match = texto.match(telefoneRegex);
    if (match) {
        let tel = match[0].replace(/\D/g, '');
        if (!tel.startsWith('55')) {
            tel = '55' + tel;
        }
        return { chave: '+' + tel, tipo: 'Telefone' };
    }

    return null;
}

/**
 * Formata a chave PIX para exibição
 */
function formatarChavePix(chave, tipo) {
    if (tipo === 'CPF') {
        return chave.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    if (tipo === 'CNPJ') {
        return chave.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    
    if (tipo === 'Telefone') {
        const cleaned = chave.replace(/\D/g, '');
        if (cleaned.length === 13) {
            return cleaned.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
        } else if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        }
    }
    
    return chave;
}

/**
 * Calcula o CRC16-CCITT para o payload PIX
 */
function calcularCRC16(payload) {
    const polynomial = 0x1021;
    let crc = 0xFFFF;
    
    const bytes = Buffer.from(payload, 'utf-8');
    
    for (let i = 0; i < bytes.length; i++) {
        crc ^= (bytes[i] << 8);
        
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ polynomial) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Adiciona um campo ao payload PIX no formato ID + TAMANHO + VALOR
 */
function adicionarCampo(id, valor) {
    const tamanho = valor.length.toString().padStart(2, '0');
    return `${id}${tamanho}${valor}`;
}

/**
 * Gera o payload PIX com ou sem valor fixo
 */
function gerarPayloadPix(chave, valor = null, descricao = null) {
    let payload = '';
    
    // [00] Payload Format Indicator
    payload += adicionarCampo('00', '01');
    
    // [01] Point of Initiation Method
    if (valor && valor > 0) {
        payload += adicionarCampo('01', '11'); // 11 = DINÂMICO (valor fixo)
    } else {
        payload += adicionarCampo('01', '12'); // 12 = ESTÁTICO (valor editável)
    }
    
    // [26] Merchant Account Information
    let merchantInfo = '';
    merchantInfo += adicionarCampo('00', 'BR.GOV.BCB.PIX');
    merchantInfo += adicionarCampo('01', chave);
    
    if (descricao) {
        merchantInfo += adicionarCampo('02', descricao.substring(0, 72));
    }
    
    payload += adicionarCampo('26', merchantInfo);
    
    // [52] Merchant Category Code
    payload += adicionarCampo('52', '0000');
    
    // [53] Transaction Currency (BRL)
    payload += adicionarCampo('53', '986');
    
    // [54] Transaction Amount (CONDICIONAL - quando há valor)
    if (valor && valor > 0) {
        const valorFormatado = valor.toFixed(2); // Ex: "50.00", "100.50"
        payload += adicionarCampo('54', valorFormatado);
    }
    
    // [58] Country Code
    payload += adicionarCampo('58', 'BR');
    
    // [59] Merchant Name
    payload += adicionarCampo('59', 'PAGAMENTO PIX');
    
    // [60] Merchant City
    payload += adicionarCampo('60', 'SAO PAULO');
    
    // [62] Additional Data (opcional)
    if (descricao) {
        let additionalData = adicionarCampo('05', descricao.substring(0, 72));
        payload += adicionarCampo('62', additionalData);
    }
    
    // [63] CRC16
    payload += '6304';
    payload += calcularCRC16(payload);
    
    return payload;
}

/**
 * Gera o QR Code usando a API correta com configurações personalizadas
 */
async function gerarQRCodePersonalizado(payload) {
    try {
        const config = getQRCodeConfig();
        
        console.log(`[QR CODE] Gerando QR Code PIX personalizado`);
        console.log(`[QR CODE] Config: ${config.size}px, Cor: #${config.color}, Fundo: #${config.bgcolor}`);

        const apiPayload = {
            text: payload,
            backgroundColor: `#${config.bgcolor.replace('#', '')}`,
            qrcodeColor: `#${config.color.replace('#', '')}`,
            size: config.size
        };

        const response = await axios.post('https://easyqrcode.app.br/api/generate-qrcode', apiPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });

        if (!response.data.success || !response.data.qrcode) {
            console.error(`[QR CODE] API retornou erro:`, response.data);
            return null;
        }

        const base64Image = response.data.qrcode.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        
        if (!base64Image) {
            console.error('[QR CODE] Base64 vazio');
            return null;
        }

        const qrBuffer = Buffer.from(base64Image, 'base64');
        console.log(`[QR CODE] ✅ Sucesso! Tamanho: ${qrBuffer.length} bytes`);

        return qrBuffer;

    } catch (error) {
        console.error('[QR CODE] ❌ Erro:', error.message);
        if (error.response) {
            console.error('[QR CODE] Response status:', error.response.status);
            console.error('[QR CODE] Response data:', error.response.data);
        }
        return null;
    }
}

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        if (message.author.bot) return;
        if (!message.guild) return;
        if (!message.content.toLowerCase().startsWith('!gp')) return;
        
        if (!userIsMediador(message.member)) {
            return message.reply({
                content: '❌ Apenas mediadores podem usar este comando!'
            }).catch(() => {});
        }

        const emojis = loadJson(emojisPath, {});

        console.log('[GP] Comando detectado:', message.content);

        // Parse: !gp [chave] [valor] [descrição]
        const args = message.content.slice(3).trim().split(' ');
        
        if (args.length === 0 || !args[0]) {
            return message.reply({
                content: 
                    `**📋 Uso incorreto!**\n\n` +
                    `**Como usar:**\n` +
                    `\`!gp [chave-pix]\` → QR Code sem valor (editável no app)\n` +
                    `\`!gp [chave-pix] [valor]\` → QR Code com valor fixo\n` +
                    `\`!gp [chave-pix] [valor] [descrição]\` → Com valor e descrição\n\n` +
                    `**Exemplos:**\n` +
                    `\`!gp 12345678901\` *(sem valor)*\n` +
                    `\`!gp email@example.com 50.00\` *(valor fixo R$ 50,00)*\n` +
                    `\`!gp +5511999999999 100.50 Pagamento\` *(com descrição)*\n\n` +
                    `**💡 Dica:** Use ponto ou vírgula para decimais (50.00 ou 50,00)`
            }).catch(() => {});
        }

        const chaveTexto = args[0];
        const valorStr = args[1];
        const descricao = args.slice(2).join(' ');

        // Extrai a chave PIX
        const resultado = extrairChavePix(chaveTexto);
        
        if (!resultado) {
            return message.reply({
                content: 
                    `**❌ Chave PIX não encontrada ou inválida!**\n\n` +
                    `**Tipos aceitos:**\n` +
                    `• CPF (11 dígitos) → \`12345678901\`\n` +
                    `• CNPJ (14 dígitos) → \`12345678000190\`\n` +
                    `• Email → \`usuario@email.com\`\n` +
                    `• Telefone → \`11999999999\` ou \`+5511999999999\`\n` +
                    `• Chave Aleatória → \`123e4567-e89b-12d3-a456-426614174000\``
            }).catch(() => {});
        }

        const { chave, tipo } = resultado;
        const chaveFormatada = formatarChavePix(chave, tipo);

        // Parse do valor (opcional)
        let valor = null;
        if (valorStr) {
            valor = parseFloat(valorStr.replace(',', '.'));
            if (isNaN(valor) || valor <= 0) {
                return message.reply({
                    content: `**❌ Valor inválido!**\n\nUse: \`50.00\` ou \`50,00\``
                }).catch(() => {});
            }
        }

        console.log(`[GP] Chave: ${chave} (${tipo})`);
        console.log(`[GP] Valor: ${valor ? 'R$ ' + valor.toFixed(2) : 'Editável no app do banco'}`);
        if (descricao) console.log(`[GP] Descrição: ${descricao}`);

        try {
            const loadingMsg = await message.reply({
                content: `⏳ Gerando QR Code PIX personalizado...`
            });

            // Gera o payload PIX (com ou sem valor)
            const payload = gerarPayloadPix(chave, valor, descricao || null);
            console.log('[GP] ✅ Payload gerado:', payload);

            // Gera o QR Code com configurações personalizadas
            const qrBuffer = await gerarQRCodePersonalizado(payload);

            if (!qrBuffer) {
                return loadingMsg.edit({
                    content: `❌ Erro ao gerar QR Code. Tente novamente.`
                });
            }

            // Carrega config para exibir informações
            const config = getQRCodeConfig();

            const attachment = new AttachmentBuilder(qrBuffer, { name: 'qrcode-pix.png' });

            // Define a cor do embed (verde se tiver valor, senão usa a cor da config)
            let corEmbed;
            if (valor && valor > 0) {
                corEmbed = 0x2ecc71; // Verde para QR Code com valor fixo
            } else {
                // Converte cor hex da config para decimal
                corEmbed = parseInt(config.color.replace('#', ''), 16);
            }

            const embed = new EmbedBuilder()
                .setTitle('💳 QR Code PIX Gerado')
                .setDescription(
                    `**🔑 CHAVE PIX:** \`${chaveFormatada}\`\n` +
                    `**📊 TIPO:** \`${tipo}\`\n\n` +
                    `**💰 VALOR:** ${valor ? `**R$ ${valor.toFixed(2).replace('.', ',')}** *(fixo)*` : '**Editável no app**'}`
                )
                .setImage('attachment://qrcode-pix.png')
                .setColor(corEmbed)
                .setFooter({ text: valor ? 'Valor já está definido no QR Code' : 'Valor pode ser editado ao pagar' })
                .setTimestamp();

            // Cria botão para copiar a chave PIX
            const botaoCopiar = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`copiar_pix_${message.id}`)
                    .setLabel('Copiar Chave PIX')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📋')
            );

            // Salva a chave para o handler do botão
            if (!global.pixKeys) global.pixKeys = {};
            global.pixKeys[message.id] = chave;

            await loadingMsg.edit({
                content: valor 
                    ? `✅ **QR Code gerado! Valor de R$ ${valor.toFixed(2).replace('.', ',')} já está definido!**`
                    : `✅ **QR Code gerado! Valor pode ser editado ao pagar.**`,
                embeds: [embed],
                files: [attachment],
                components: [botaoCopiar]
            });

            console.log(`[GP] ✅ QR Code personalizado enviado para ${message.author.tag}`);
            console.log(`[GP] Tipo: ${tipo} | Valor: ${valor ? 'R$ ' + valor.toFixed(2) : 'Editável'}`);

        } catch (error) {
            console.error('[GP] ❌ Erro:', error);
            message.reply({
                content: `❌ Erro ao gerar QR Code: ${error.message}`
            }).catch(() => {});
        }
    }
};