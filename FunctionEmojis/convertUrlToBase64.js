const axios = require('axios');

async function urlToBase64(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  let type = 'png';
  if (url.includes('.webp')) type = 'webp';
  else if (url.includes('.gif')) type = 'gif';
  else if (url.includes('.jpg') || url.includes('.jpeg')) type = 'jpeg';
  const base64 = Buffer.from(response.data, 'binary').toString('base64');
  return `data:image/${type};base64,${base64}`;
}

const url = "https://images-ext-1.discordapp.net/external/ALlcR4zu2XEKk2XHn5G_Zz8YlVAp_adV7tme7HAwaC4/%3Fsize%3D2048/https/cdn.discordapp.com/emojis/1372290804097487040.gif";

urlToBase64(url).then(base64 => {
  console.log(base64);
}).catch(err => {
  console.error('Erro ao converter:', err.message);
}); 