const {Client, DiscordEvents, DiscordIntents} = require('./core.cjs');
const client = new Client({
    intents: [DiscordIntents.Guilds, DiscordIntents.GuildMessages, DiscordIntents.MessageContent],
    token: 'Your token'
});

client.on(DiscordEvents.MessageCreate, (message) => {
    console.log(message.content);
    if (message.content === 'This bot is made with Robo.JS!') {
        client.createMessage('your channel id', 'Yeah, that is pretty much true. How awesome is that!')
    }
})

client.login();

// If you are stuck on connecting to gateway or cannot connect to gateway, make sure you enabled all intents!
