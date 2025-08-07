const tmi = require('tmi.js');
const axios = require('axios');
const qs = require('querystring');
const readline = require('readline');

const webhookUrl = 'https://script.google.com/macros/s/AKfycbzAszYfxvjeazZ1hE1ax0Ks_VUjONUmBM66RS60PEh64fn9EFjKsqsP9Xo__V4Fozs/exec';

let clientId = 'None';
let clientSecret = 'None';

async function getAccessToken() {
    const url = 'https://id.twitch.tv/oauth2/token';
    const data = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
    };
    const response = await axios.post(url, qs.stringify(data), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.access_token;
}

async function checkIfTwitchUserExists(username, accessToken) {
    try {
        const response = await axios.get(`https://api.twitch.tv/helix/users?login=${username}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });
        return response.data.data.length > 0;
    } catch (error) {
        console.error('Twitch API error:', error.response?.data || error.message);
        return false;
    }
}

async function startBot(userToken) {
    const apiToken = await getAccessToken();
    const client = new tmi.Client({
        options: { debug: true },
        identity: {
            username: 'MyLovelyBot',
            password: userToken
        },
        channels: [ 'rocknrollamlp', 'MyLovelyPlanet' ]
    });

    client.connect();

    client.on('message', async (channel, tags, message, self) => {
        if (self) return;
        message = message.trim();
        if (message.startsWith('!father')) {
            const parts = message.split(' ');
            if (parts.length < 2 || !parts[1].startsWith('@')) {
                client.say(channel, `❌ La command comporte trop d'espace, ou il manque le @`);
                return;
            }
            const father = parts[1].slice(1);
            const username = tags['display-name'];
            const exists = await checkIfTwitchUserExists(father, apiToken);
            if (!exists) {
                client.say(channel, `❌ Le compte Twitch @${father} n'existe pas.`);
                return;
            }
            axios.post(webhookUrl, {
                new_user: username,
                father: father
            })
                .then((response) => {
                    const gsMessage = response.data;
                    client.say(channel, `${gsMessage}`);
                })
                .catch((err) => {
                    console.error('Erreur en envoyant à Google Sheets:', err);
                    client.say(channel, `Une erreur est survenue.`);
                });
        }
    });
}

(async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Entre le client id de ton application : ', (getClientId) => {
        rl.question('Entre le token secret de ton application : ', async (getClientSecret) => {
            clientId = getClientId;
            clientSecret = getClientSecret;
            const apiToken = await getAccessToken();
            console.log('Ouvre ce lien dans ton navigateur pour générer le token utilisateur (password) :');
            console.log(`https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=http://localhost&response_type=token&scope=chat:read+chat:edit`);
            rl.question('Colle ici le token utilisateur (password) puis appuie sur Entrée : ', (userToken) => {
                rl.close();
                startBot(userToken, apiToken);
            });
        });
    });
})();
