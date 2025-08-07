const tmi = require('tmi.js');
const axios = require('axios');
const qs = require('querystring');
const readline = require('readline');
const http = require('http');
const { exec } = require('child_process');

const webhookUrl = 'https://script.google.com/macros/s/AKfycbzAszYfxvjeazZ1hE1ax0Ks_VUjONUmBM66RS60PEh64fn9EFjKsqsP9Xo__V4Fozs/exec';

let clientId = 'l0yhmcda38qvxv1ht2tlkt7fdpdrz4';
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

async function startBot(userToken, apiToken) {
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

    rl.question('Entre le token secret de ton application : ', async (getClientSecret) => {
            clientSecret = getClientSecret;
            const apiToken = await getAccessToken();
            
            await getUserToken().then((userToken) => {
                startBot(userToken, apiToken);
                rl.close();
            });
    });
})();
async function getUserToken() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            if (req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`
                    <html>
                    <body>
                        <script>
                            if (window.location.hash) {
                                fetch('/', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ hash: window.location.hash })
                                }).then(() => {
                                    document.body.innerText = 'Token fetched, you can close this page.';
                                });
                            } else {
                                document.body.innerText = 'No token found at this URL. Did you allow on https://dev.twitch.tv/console the redirection OAuth http://localhost:3000 ?';
                            }
                        </script>
                    </body>
                    </html>
                `);
            } else if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk);
                req.on('end', () => {
                    const { hash } = JSON.parse(body);
                    const params = new URLSearchParams(hash.replace('#', ''));
                    const token = params.get('access_token');
                    res.end('OK');
                    server.close();
                    resolve(token);
                });
            }
        }).listen(3000, () => {
            const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=http://localhost:3000&response_type=token&scope=chat:read+chat:edit`;
            exec(`start "" "${authUrl}"`);
            console.log('Le navigateur va s’ouvrir. Waiting for the result...');
        });
    });
}
