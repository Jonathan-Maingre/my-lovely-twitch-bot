const tmi = require('tmi.js');
const axios = require('axios');

const webhookUrl = 'https://script.google.com/macros/s/AKfycbzAszYfxvjeazZ1hE1ax0Ks_VUjONUmBM66RS60PEh64fn9EFjKsqsP9Xo__V4Fozs/exec';

const clientId = 'l0yhmcda38qvxv1ht2tlkt7fdpdrz4';
const accessToken = 'mt2ttz80uo1jldpthwna43h6vrecpi';



const client = new tmi.Client({
    options: { debug: true },
    identity: {
        username: 'MyLovelyBot',
        password: 'k7z0ao0br66ltgwr1l4cnotuzuqotz' // à générer ici : https://twitchapps.com/tmi/
    },
    channels: [ 'rocknrollamlp', 'MyLovelyPlanet' ]
});

client.connect();

client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    message = message.trimEnd();
    message = message.trimStart();

    if (message.startsWith('!father')) {
        const parts = message.split(' ');
        if (parts.length < 2 || !parts[1].startsWith('@')) {
            client.say(channel, `❌ La command comporte trop d'espace, ou il manque le @`);
            return;
        }

        const father = parts[1].slice(1);
        const username = tags['display-name'];

        const exists = await checkIfTwitchUserExists(father);

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

async function checkIfTwitchUserExists(username) {
    try {
        const response = await axios.get(`https://api.twitch.tv/helix/users?login=${username}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`
            }
        });

        return response.data.data.length > 0; // true = user exists
    } catch (error) {
        console.error('Twitch API error:', error.response?.data || error.message);
        return false;
    }
}