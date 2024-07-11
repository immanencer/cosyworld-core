// router.mjs
import express from 'express';
import { ObjectId } from 'mongodb';
import { db } from '../../database.mjs';

const router = express.Router();
const REQUESTS_COLLECTION = 'requests';
const MESSAGES_COLLECTION = 'messages';
const LOCATIONS_COLLECTION = 'locations';

router.use(express.json());

const handleDatabaseError = (res, error, operation) => {
    console.error(`Failed to ${operation}:`, error);
    res.status(500).send({ error: `Failed to ${operation}` });
};

router.get('/messages', async (req, res) => {
    const { since, location } = req.query;
    const query = {};

    if (since) {
        const sinceDate = new Date(since);
        if (!isNaN(sinceDate.getTime())) {
            query.createdAt = { $gt: sinceDate };
        } else {
            return res.status(400).send({ error: 'Invalid date format for "since" parameter' });
        }
    }

    if (location) {
        query.channelId = location;
    }

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
            username: author?.displayName || author?.username || 'default_username',
            discriminator: author?.discriminator || '0000',
            avatar: author?.avatar || author?.avatarURL || 'default_avatar_url'
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
    if (name) query.content = { $regex: new RegExp(`\\b${name}\\b`, 'i') };

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
    try {
        const locations = await db.collection(LOCATIONS_COLLECTION).find().toArray();
        res.status(200).send(locations);
    } catch (error) {
        handleDatabaseError(res, error, 'fetch locations');
    }
});

router.post('/enqueue', async (req, res) => {
    const { action, data } = req.body;
    const task = { action, data, status: 'pending', createdAt: new Date() };

    try {
        await db.collection(REQUESTS_COLLECTION).insertOne(task);
        res.status(200).send({ message: 'Task enqueued' });
    } catch (error) {
        handleDatabaseError(res, error, 'enqueue task');
    }
});

export default router;