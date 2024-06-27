import { Client, GatewayIntentBits } from 'discord.js';
import { db } from '../database.mjs';
import ReplicateService from './ai/replicate-service.mjs';

const ai = new ReplicateService();

const MESSAGES_COLLECTION = 'messages';
const LOCATIONS_COLLECTION = 'locations';

const discordToken = process.env.DISCORD_BOT_TOKEN;

// Discord Client Setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.once('ready', () => {
    console.log(`🎮 Logged in as ${client.user.tag}`);
});

async function createOrUpdateLocation(channelId, channelName, guildId) {
    try {
        const location = await db.collection(LOCATIONS_COLLECTION).findOne({ channelId });
        if (!location) {
            await db.collection(LOCATIONS_COLLECTION).insertOne({
                channelId,
                channelName,
                guildId,
                createdAt: new Date()
            });
            console.log(`🌍 New location created: ${channelName}`);
        } else if (location.channelName !== channelName) {
            await db.collection(LOCATIONS_COLLECTION).updateOne(
                { channelId },
                { $set: { channelName, updatedAt: new Date() } }
            );
            console.log(`🌍 Location updated: ${channelName}`);
        }
    } catch (error) {
        console.error('❌ Failed to create/update location:', error);
    }
}

client.on('messageCreate', async (message) => {
    if (message.channel.name.indexOf('🥩') === 0) return false;
    if (message.channel.name.indexOf('🐺') === 0) return false;

    // Create or update location
    await createOrUpdateLocation(message.channelId, message.channel.name, message.guildId);

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

    // Check for any image urls in the image or attachments
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

    // Loop through each image url
    for (const imageUrl of imageUrls) {
        const image_description = await ai.viewImageByUrl(imageUrl);
        messageData.content += `an image was detected: \n${image_description}`;
    }

    try {
        await db.collection(MESSAGES_COLLECTION).insertOne(messageData);
        console.log('🎮 Message logged to MongoDB');
    } catch (error) {
        console.error('🎮 ❌ Failed to log message:', error);
    }
});

client.login(discordToken).catch(error => {
    console.error('🎮 ❌ Discord login error:', error);
});