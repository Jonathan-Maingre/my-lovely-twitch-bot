const tmi = require('tmi.js');
const axios = require('axios');
const qs = require('querystring');
const readline = require('readline');
const http = require('http');
const {exec} = require('child_process');

const webhookUrl = 'https://script.google.com/macros/s/AKfycbwGrdHCIR-gQ81kKKgBse4Mi0NPkeMZvQSnsn1XDjalGUZbv4x0figmGGQo6IRGgTgMZw/exec';

let clientId = 'l0yhmcda38qvxv1ht2tlkt7fdpdrz4';
let clientSecret = 'None';

const channel = 'johnwdev';

async function getAccessToken() {
    const url = 'https://id.twitch.tv/oauth2/token';
    const data = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
    };
    const response = await axios.post(url, qs.stringify(data), {
        headers: {'Content-Type': 'application/x-www-form-urlencoded'}
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

async function startBot(userToken, apiToken, mode) {
    const client = new tmi.Client({
        options: {debug: true},
        identity: {
            username: 'MyLovelyBot',
            password: userToken
        },
        channels: [channel]
    });


    client.connect();

    client.on('message', async (channel, tags, message, self) => {
        if (self) return;
        message = message.trim();
        const username = tags['display-name'];

        if (message.startsWith('!father')) {
            const parts = message.split(' ');
            if (parts.length < 2 || !parts[1].startsWith('@')) {
                client.say(channel, `❌ The command have to many space, or not enough, or is missing the @, correct exemple <!father @father_chain>`);
                return;
            }
            const father = parts[1].slice(1);

            const exists = await checkIfTwitchUserExists(father, apiToken);

            if (!exists) {
                client.say(channel, `❌ The twitch account @${father} deosn't exists.`);
                return;
            }
            axios.post(webhookUrl, {
                type: "writeFather",
                new_user: username,
                father: father
            })
                .then((response) => {
                    client.say(channel, `${response.data}`);
                })
                .catch(() => {
                    client.say(channel, `An error occured.`);
                });
            return;
        } else if (message.startsWith('!answer')) {
            // Extraction des arguments entre guillemets
            const parts = message.split(' ');
            if (parts.length !== 3) {
                client.say(channel, `❌ Exemple : !answer <code> <réponse>`);
                return;
            }
            const code = parts[1];
            const answer = parts[2];

            let expectedCode = '----';
            console.log(`Mode: ${mode}`);
            switch (mode) {
                case 0: expectedCode = username.substring(0, 3); break;
                case 1: expectedCode = username.slice(-3); break;
                case 2: expectedCode = channel.substring(0, 3); break;
                case 3: expectedCode = channel.slice(-3); break;
                // Ajoute les autres cas si besoin
            }

            console.log(`Expected code: ${expectedCode}`);
            console.log(`Received code: ${code}`);
            
            if (code.toLowerCase() !== expectedCode.toLowerCase()) {
                client.say(channel, `❌ Wrong code.`);
                return;
            }
            
            axios.post(webhookUrl, {
                type: "answer",
                new_user: username,
                answer: answer
            })
                .then((response) => {
                    client.say(channel, `${response.data}`);
                })
                .catch(() => {
                    client.say(channel, `An error occured.`);
                });
            return;
        }
    });
}

(async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Choisis le mode de validation (0: 3 premiers du pseudo, 1: 3 derniers du pseudo, 2: 3 premiers de la chaine, 3: 3 derniers de la chaine): ', async (modeInput) => {
        let mode = parseInt(modeInput);
        
        if (isNaN(mode) || mode < 0 || mode > 3) {
            mode = 0; // Valeur par défaut si l'entrée n'est pas valide
        }
        rl.question('Entre le token secret de ton application : ', async (getClientSecret) => {
            clientSecret = getClientSecret;
            const apiToken = await getAccessToken();

            await getUserToken().then((userToken) => {
                startBot(userToken, apiToken, mode);
                rl.close();
            });
        });
    });
})();

async function getUserToken() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            if (req.method === 'GET') {
                res.writeHead(200, {'Content-Type': 'text/html'});
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
                    const {hash} = JSON.parse(body);
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
