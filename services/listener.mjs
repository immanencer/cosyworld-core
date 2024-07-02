import { Client, GatewayIntentBits, Events } from 'discord.js';
import { db } from '../database.mjs';
import ReplicateService from './ai/replicate-service.mjs';
import winston from 'winston';

// Constants
const MESSAGES_COLLECTION = 'messages';
const LOCATIONS_COLLECTION = 'locations';
const IGNORED_CHANNEL_PREFIXES = ['🥩', '🐺'];
const IMAGE_EXTENSIONS = /\.(jpeg|jpg|gif|png)$/i;

// Environment variables
const discordToken = process.env.DISCORD_BOT_TOKEN;
const logLevel = process.env.LOG_LEVEL || 'info';

// Logger setup
const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp }) => {
            return `${timestamp} ${level}: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'bot.log' })
    ]
});

// AI service setup
const ai = new ReplicateService();

// Discord Client Setup
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Database operations
async function createOrUpdateLocation(channelId, channelName, guildId) {
    try {
        const location = await db.collection(LOCATIONS_COLLECTION).findOneAndUpdate(
            { channelId },
            { 
                $set: { 
                    channelName, 
                    guildId,
                    updatedAt: new Date() 
                },
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true, returnDocument: 'after' }
        );

        logger.info(`Location ${location.value.channelName} ${location.lastErrorObject.updatedExisting ? 'updated' : 'created'}`);
    } catch (error) {
        logger.error('Failed to create/update location:', error);
    }
}

async function logMessageToDatabase(messageData) {
    try {
        await db.collection(MESSAGES_COLLECTION).insertOne(messageData);
        logger.info('Message logged to MongoDB');
    } catch (error) {
        logger.error('Failed to log message:', error);
    }
}

// Image processing
async function processImage(imageUrl) {
    try {
        const imageDescription = await ai.viewImageByUrl({
            imageUrl,
            prompt: "Describe this image in detail, including any text visible in the image.",
            maxTokens: 1024,
            temperature: 0.2
        });
        return imageDescription;
    } catch (error) {
        logger.error(`Failed to analyze image ${imageUrl}:`, error);
        return null;
    }
}

// Message handling
async function handleMessage(message) {
    if (IGNORED_CHANNEL_PREFIXES.some(prefix => message.channel.name.startsWith(prefix))) {
        return;
    }

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

    const imageUrls = message.attachments
        .filter(attachment => IMAGE_EXTENSIONS.test(attachment.url))
        .map(attachment => attachment.url);

    if (imageUrls.length === 0 && message.content.trim() === '') {
        return;
    }

    const imageDescriptions = await Promise.all(imageUrls.map(processImage));
    const validDescriptions = imageDescriptions.filter(Boolean);

    if (validDescriptions.length > 0) {
        messageData.content += '\n\nImage descriptions:\n' + validDescriptions.join('\n\n');
    }

    await logMessageToDatabase(messageData);
}

// Event handlers
client.once(Events.ClientReady, () => {
    logger.info(`Logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    try {
        await handleMessage(message);
    } catch (error) {
        logger.error('Error processing message:', error);
    }
});

// Error handling
client.on(Events.Error, (error) => {
    logger.error('Discord client error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
client.login(discordToken).catch(error => {
    logger.error('Discord login error:', error);
});