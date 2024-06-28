import express from 'express';
import { ObjectId } from 'mongodb';
import { db } from '../../database.mjs';
import { initializeDiscordClient, isDiscordReady, sendMessage } from '../../services/discord.mjs';

const router = express.Router();
const MESSAGES_COLLECTION = 'messages';
const LOCATIONS_COLLECTION = 'locations';

// Middleware
router.use(express.json());

// Initialize Discord client
initializeDiscordClient().catch(console.error);

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
    try {
        const locations = await db.collection(LOCATIONS_COLLECTION)
            .find({})
            .toArray();
        res.status(200).send(locations);
    } catch (error) {
        handleDatabaseError(res, error, 'fetch locations');
    }
});

router.post('/send-message', async (req, res) => {
    if (!isDiscordReady()) {
        return res.status(503).send({ error: 'Discord client not ready' });
    }
    const { channelId, message, threadId } = req.body;
    try {
        await sendMessage(channelId, message, threadId);
        res.status(200).send({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('🎮 ❌ Failed to send message:', error);
        res.status(500).send({ error: 'Failed to send message' });
    }
});

export default router;