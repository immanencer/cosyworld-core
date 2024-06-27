import { Client, GatewayIntentBits } from 'discord.js';
import { db } from '../database.mjs';
import ReplicateService from './ai/replicate-service.mjs';

const ai = new ReplicateService();
const collectionName = 'messages';
const discordToken = process.env.DISCORD_BOT_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

let discordReady = false;

client.once('ready', () => {
    console.log(`🎮 Logged in as ${client.user.tag}`);
    discordReady = true;
});

client.on('messageCreate', async (message) => {
    if (message.channel.name.indexOf('🥩') === 0) return false;
    if (message.channel.name.indexOf('🐺') === 0) return false;

    const messageData = {
        message_id: message.id,
        author: {
            id: message.author.id,
            username: message.author.displayName,
            discriminator: message.author.discriminator,
            avatar: message.author.displayAvatarURL()
        },
        content: message.content,
        createdAt: message.createdAt,
        channelId: message.channelId,
        guildId: message.guildId
    };

    const imageUrls = [];
    if (message.attachments.size > 0) {
        message.attachments.forEach(attachment => {
            if (!attachment) return;
            if (attachment.url.split('?')[0].match(/\.(jpeg|jpg|gif|png)$/) != null) {
                imageUrls.push(attachment.url);
            }
        });
    }

    if (imageUrls.length === 0 && message.content.trim() === '') {
        return;
    }

    for (const imageUrl of imageUrls) {
        const image_description = await ai.viewImageByUrl(imageUrl);
        messageData.content += `an image was detected: \n${image_description}`;
    }

    try {
        await db.collection(collectionName).insertOne(messageData);
        console.log('🎮 Message logged to MongoDB');
    } catch (error) {
        console.error('🎮 ❌ Failed to log message:', error);
    }
});

export async function initializeDiscordClient() {
    try {
        await client.login(discordToken);
    } catch (error) {
        console.error('🎮 ❌ Discord login error:', error);
        discordReady = false;
        throw error;
    }
}

export function isDiscordReady() {
    return discordReady;
}

export async function sendMessage(channelId, message, threadId = null) {
    const channel = await client.channels.fetch(channelId);
    if (!channel.isTextBased()) {
        throw new Error('Invalid channel');
    }
    await channel.send({ content: message, threadId });
}

export async function getLocations() {
    const channels = client.channels.cache;
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

    return [
        ...(categorizedChannels.CategoryChannel || []),
        ...(categorizedChannels.TextChannel || []),
        ...(categorizedChannels.ThreadChannel || [])
    ];
}