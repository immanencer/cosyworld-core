// discordService.mjs
import { Client, GatewayIntentBits, Events } from 'discord.js';
import { db } from '../database.mjs';
import chunkText from '../util/chunkText.mjs';

const REQUESTS_COLLECTION = 'requests';
const MESSAGES_COLLECTION = 'messages';
const LOCATIONS_COLLECTION = 'locations';

class DiscordService {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ]
        });
        this.isReady = false;
        this.lastMessageTime = Date.now();
        this.pollingInterval = 5000; // Start with 5 seconds
    }

    async initialize() {
        try {
            await this.client.login(process.env.DISCORD_BOT_TOKEN);
            console.log('🎮 Bot logged in');
            this.isReady = true;
            this.setupEventListeners();
            this.startPolling();
        } catch (error) {
            console.error('🎮 ❌ Discord login error:', error);
            this.isReady = false;
            throw error;
        }
    }

    setupEventListeners() {
        this.client.on(Events.MessageCreate, this.handleMessage.bind(this));
        this.client.on(Events.Error, (error) => {
            console.error('Discord client error:', error);
        });
    }

    async handleMessage(message) {
        if (message.author.bot) return;

        await this.updateLocation(message.channelId, message.channel.name, message.guildId);
        
        const messageData = {
            message_id: message.id,
            author: {
                id: message.author.id,
                username: message.author.username,
                discriminator: message.author.discriminator,
                avatar: message.author.displayAvatarURL()
            },
            content: message.content,
            createdAt: message.createdAt,
            channelId: message.channelId,
            guildId: message.guildId
        };

        await db.collection(MESSAGES_COLLECTION).insertOne(messageData);
        this.lastMessageTime = Date.now();
        this.adjustPollingInterval();
    }

    async updateLocation(channelId, channelName, guildId) {
        await db.collection(LOCATIONS_COLLECTION).updateOne(
            { channelId },
            { 
                $set: {
                    channelName, 
                    guildId,
                    updatedAt: new Date() 
                },
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
        );
    }

    adjustPollingInterval() {
        const timeSinceLastMessage = Date.now() - this.lastMessageTime;
        if (timeSinceLastMessage < 60000) { // Less than 1 minute
            this.pollingInterval = 5000; // 5 seconds
        } else if (timeSinceLastMessage < 300000) { // Less than 5 minutes
            this.pollingInterval = 30000; // 30 seconds
        } else {
            this.pollingInterval = 60000; // 1 minute
        }
    }

    async startPolling() {
        while (true) {
            if (this.isReady) {
                await this.processTasks();
            }
            await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
            this.adjustPollingInterval();
        }
    }

    async processTasks() {
        const task = await db.collection(REQUESTS_COLLECTION).findOneAndUpdate(
            { status: 'pending' },
            { $set: { status: 'processing', startedAt: new Date() } },
            { sort: { createdAt: 1 }, returnDocument: 'after' }
        );

        if (!task) return;

        try {
            await this.executeTask(task);
            await db.collection(REQUESTS_COLLECTION).updateOne(
                { _id: task._id },
                { $set: { status: 'completed', completedAt: new Date() } }
            );
        } catch (error) {
            console.error('Failed to process task:', error);
            await db.collection(REQUESTS_COLLECTION).updateOne(
                { _id: task._id },
                { $set: { status: 'failed', error: error.message, completedAt: new Date() } }
            );
        }
    }

    async executeTask(task) {
        switch (task.action) {
            case 'sendMessage':
                await this.sendMessage(task.data.channelId, task.data.message, task.data.threadId);
                break;
            case 'sendAsAvatar':
                await this.sendAsAvatar(task.data.avatar, task.data.message);
                break;
            default:
                throw new Error(`Unknown task action: ${task.action}`);
        }
    }

    async sendMessage(channelId, message, threadId = null) {
        const channel = await this.client.channels.fetch(channelId);
        if (!channel.isTextBased()) {
            throw new Error('Invalid channel');
        }
        await channel.send({ content: message, threadId });
    }

    async sendAsAvatar(avatar, message) {
        console.log('🎮 🗣️:', `(${avatar.location.channelName}) ${avatar.name}: ${message}`);
        let channel = await this.client.channels.fetch(avatar.channelId);
        
        if (channel.type === 4) {
            channel = await this.client.channels.fetch(avatar.location.channelId);
            delete avatar.threadId;
        }

        if (!channel) {
            throw new Error(`Invalid channel: ${avatar.channelId}`);
        }

        const webhook = await this.getOrCreateWebhook(channel);
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

    async getOrCreateWebhook(channel) {
        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.owner.id === this.client.user.id);
        
        if (!webhook) {
            webhook = await channel.createWebhook({
                name: 'Bot Webhook',
                avatar: 'https://i.imgur.com/jqNRvED.png'
            });
        }
        
        return webhook;
    }

    async getLocations() {
        const channels = this.client.channels.cache;
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
}

export const discordService = new DiscordService();