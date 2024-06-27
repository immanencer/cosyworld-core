import express from 'express';
import { Client, GatewayIntentBits } from 'discord.js';
import { ObjectId } from 'mongodb';
import process from 'process';
import { connectToDB } from '../database.mjs';
const db = connectToDB();
import chunkText from '../util/chunk-text.mjs';

const router = express.Router();
const REQUESTS_COLLECTION = 'requests';
const MESSAGES_COLLECTION = 'messages';

// Discord Client Setup
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

let discordReady = false;

async function initializeDiscordClient() {
    try {
        await discordClient.login(process.env.DISCORD_BOT_TOKEN);
        console.log('🎮 Bot logged in');
        discordReady = true;
    } catch (error) {
        console.error('🎮 ❌ Discord login error:', error);
        discordReady = false;
        throw error;
    }
}

// Initialize database and Discord client
async function initialize() {
    try {
        await connectToDB();
        await initializeDiscordClient();
    } catch (error) {
        console.error('❌ Initialization error:', error);
        process.exit(1);
    }
}

initialize();

// Middleware
router.use(express.json());

// Helper function to handle database errors
function handleDatabaseError(res, error, operation) {
    console.error(`Failed to ${operation}:`, error);
    res.status(500).send({ error: `Failed to ${operation}` });
}

// API Routes
router.get('/messages', async (req, res) => {
    const { since, location } = req.query;
    const query = {};
    if (since) query._id = { $gt: new ObjectId(since) };
    if (location) query.channelId = location;

    try {
        const messages = await db.collection(MESSAGES_COLLECTION)
            .find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .toArray();
        res.status(200).send(messages);
    } catch (error) {
        handleDatabaseError(res, error, 'fetch messages');
    }
});

router.post('/messages', async (req, res) => {
    const { id, author, content, createdAt, channelId, guildId } = req.body;
    const message = {
        message_id: id || 'default_id',
        author: {
            id: author?.id || 'default_author_id',
            username: author?.displayName || 'default_username',
            discriminator: author?.discriminator || '0000',
            avatar: author?.avatar || 'default_avatar_url'
        },
        content: content || 'default_content',
        createdAt: createdAt || new Date().toISOString(),
        channelId: channelId || 'default_channel_id',
        guildId: guildId || 'default_guild_id'
    };

    try {
        await db.collection(MESSAGES_COLLECTION).insertOne(message);
        res.status(201).send({ message: 'Message logged' });
    } catch (error) {
        handleDatabaseError(res, error, 'log message');
    }
});

router.get('/messages/mention', async (req, res) => {
    const { name, since } = req.query;
    const query = {};
    if (since) query._id = { $gt: new ObjectId(since) };
    if (name) query.content = { $regex: new RegExp('\\b' + name + '\\b', 'i') };

    try {
        const messages = await db.collection(MESSAGES_COLLECTION)
            .find(query)
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();
        res.status(200).send(messages);
    } catch (error) {
        handleDatabaseError(res, error, 'fetch messages');
    }
});

router.get('/locations', async (req, res) => {
    if (!discordReady) {
        return res.status(503).send({ error: 'Discord client not ready' });
    }

    try {
        const channels = discordClient.channels.cache;
        const channelTypes = {
            ThreadChannel: "thread",
            TextChannel: "channel",
            CategoryChannel: "category",
            VoiceChannel: "voice"
        };

        const categorizedChannels = channels.reduce((acc, channel) => {
            const channelType = channel.constructor.name;
            if (!acc[channelType]) acc[channelType] = [];
            acc[channelType].push({
                id: channel.id,
                name: channel.name,
                type: channelTypes[channelType] || 'unknown',
                channel_type: channelType,
                parent: channel.parentId || null
            });
            return acc;
        }, {});

        const orderedChannels = [
            ...(categorizedChannels.CategoryChannel || []),
            ...(categorizedChannels.TextChannel || []),
            ...(categorizedChannels.ThreadChannel || [])
        ];

        res.status(200).send(orderedChannels);
    } catch (error) {
        console.error('🎮 ❌ Failed to fetch locations:', error);
        res.status(500).send({ error: 'Failed to fetch locations' });
    }
});

router.post('/enqueue', async (req, res) => {
    const { action, data } = req.body;
    const request = { action, data, status: 'queued', createdAt: new Date() };

    try {
        await db.collection(REQUESTS_COLLECTION).insertOne(request);
        res.status(200).send({ message: 'Request enqueued' });
    } catch (error) {
        handleDatabaseError(res, error, 'enqueue request');
    }
});

router.get('/process', async (req, res) => {
    if (!db){
        return res.status(503).send({ error: 'Database service unavailable' });
    }
    if ( !discordReady) {
        return res.status(503).send({ error: 'Discord client not ready' });
    }

    try {
        const request = await db.collection(REQUESTS_COLLECTION).findOneAndUpdate(
            { status: 'queued' },
            { $set: { status: 'processing', startedAt: new Date() } },
            { sort: { createdAt: 1 }, returnDocument: 'after' }
        );

        if (!request?.action) {
            return res.status(200).send({ message: 'No queued requests' });
        }

        await processRequest(request.action, request.data);
        await db.collection(REQUESTS_COLLECTION).updateOne(
            { _id: request._id },
            { $set: { status: 'completed', completedAt: new Date() } }
        );

        res.status(200).send({ message: 'Request processed' });
    } catch (error) {
        handleDatabaseError(res, error, 'process request');
    }
});

async function processRequest(action, data) {
    if (!discordReady || !db) {
        throw new Error('Services not ready');
    }

    const actions = {
        sendMessage: () => sendMessage(data.channelId, data.message, data.threadId),
        sendAsAvatar: () => {
            if (!data.avatar || !data.message) {
                throw new Error('Missing avatar data or message');
            }
            return sendAsAvatar(data.avatar, data.message);
        }
    };

    const selectedAction = actions[action];
    if (!selectedAction) {
        throw new Error(`Unknown action: ${action}`);
    }

    await selectedAction();
}

async function sendMessage(channelId, message, threadId = null) {
    const channel = await discordClient.channels.fetch(channelId);
    if (!channel.isTextBased()) {
        throw new Error('Invalid channel');
    }
    await channel.send({ content: message, threadId });
}

async function sendAsAvatar(avatar, message) {
    console.log('🎮 Sending as avatar:', avatar.name, message);
    let channel = await discordClient.channels.fetch(avatar.channelId);
    
    if (channel.type === 'GUILD_CATEGORY') {
        channel = await discordClient.channels.fetch(avatar.location.id);
        delete avatar.threadId;
    }

    if (!channel) {
        throw new Error(`Invalid channel: ${avatar.channelId}`);
    }

    const webhook = await getOrCreateWebhook(channel);
    const chunks = chunkText(message, 2000);

    for (const chunk of chunks) {
        await webhook.send({
            content: chunk,
            username: avatar.name,
            avatarURL: avatar.avatar,
            threadId: avatar.threadId
        });
    }
}

async function getOrCreateWebhook(channel) {
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.owner.id === discordClient.user.id);
    
    if (!webhook) {
        webhook = await channel.createWebhook({
            name: 'Bot Webhook',
            avatar: 'https://i.imgur.com/jqNRvED.png'
        });
    }
    
    return webhook;
}

// Periodic processing
setInterval(async () => {

    if (!discordReady || !db) {
        console.log('🎮 Services not ready');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/discord-bot/process');
        const data = await response.json();
        if (data.message !== "No queued requests") {
            console.log('🎮 Processing:', data);
        }
    } catch (error) {
        console.error('🎮 ❌ Failed to process:', error);
    }
}, process.env.PROCESS_INTERVAL || 5000);

export default router;