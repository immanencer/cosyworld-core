import { MESSAGES_API } from "../config.js";
import { fetchJSON, createURLWithParams, retry } from "./utils.js";
import { getLocations } from "./avatar.js";
import { handleResponse } from "./response.js";
import { getDb, connectPromise } from "../database.mjs";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function getCollection(name) {
    const db = await getDb();
    return db.collection(name);
}

export const getMessages = retry(
    (location) => fetchJSON(createURLWithParams(MESSAGES_API, { location })),
    MAX_RETRIES,
    RETRY_DELAY
);

export const getMentions = retry(
    (name, since) => fetchJSON(createURLWithParams(`${MESSAGES_API}/mention`, { name, since })),
    MAX_RETRIES,
    RETRY_DELAY
);

export async function processMessagesForAvatar(avatar) {
    if (!avatar?.name) {
        console.error('Invalid avatar object received');
        return;
    }

    try {
        await connectPromise;
        const locations = await getLocations();

        if (!Array.isArray(locations) || locations.length === 0) {
            throw new Error('No valid locations found');
        }

        const messages = await fetchMessages(avatar, locations);
        if (!messages?.length) return;

        const conversation = await buildConversation(avatar, messages, locations);
        if (conversation && shouldRespond(conversation)) {
            await handleResponse(avatar, conversation, locations);
        }
    } catch (error) {
        console.error(`Error processing messages for ${avatar.name}:`, error);
        // Implement monitoring/alerting here if needed
    }
}

/**
 * Fetch the most recent messages from the avatar's current location.
 * @param {Object} avatar - The avatar object.
 * @param {Array} locations - The list of all available locations.
 * @returns {Promise<Array>} The recent messages from the avatar's current location.
 */
async function fetchMessages(avatar, locations) {
    try {
        const currentLocation = avatar.location.channelName;

        // Find the channelId for the avatar's current location
        const location = locations.find(loc => loc.channelName === currentLocation);
        if (!location) {
            throw new Error(`Location ${currentLocation} not found for avatar ${avatar.name}`);
        }
        const locationId = location.channelId;

        // Fetch messages from the current location
        const messages = await getMessages(locationId);
        // Sort messages by creation date and return the most recent ones
        return messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } catch (error) {
        console.error(`Error fetching messages for ${avatar.name}:`, error);
        throw error;
    }
}

/**
 * Build the conversation context for the avatar.
 * @param {Object} avatar - The avatar object.
 * @param {Array} messages - The list of messages to build the conversation from.
 * @param {Array} locations - The list of all available locations.
 * @returns {Array} The formatted conversation context.
 */
const buildConversation = async (avatar, messages, locations) => {
    try {
        const characters = await getCollection('characters');
        const character = await characters.findOne({ name: avatar.name });
        
        if (!character) {
            throw new Error(`Character not found: ${avatar.name}`);
        }

        let assets = '';
        if (character.wallet) {
            try {
                assets = fs.readFileSync(`../nft_images/${character.wallet}_report.md`, 'utf8');
            } catch (error) {
                console.warn(`Failed to read assets for ${avatar.name}:`, error);
            }
        }

        return [
            { role: 'assistant', content: `
                Recent Dream
                ${character.dream}
                ${assets ? `\nRecent Asset Report\n${assets}` : ''}

                Recent Journal
                ${character.journal}
                
                Recent Memory
                ${character.memory}
            ` },
            ...messages.map(message => {
                const author = message.author.displayName || message.author.username;
                const location = locations.find(loc => loc.channelId === message.channelId)?.channelName || 'unknown location';
                const isBot = message.author.discriminator === "0000";

                return author.includes(avatar.name)
                    ? { author, location, bot: isBot, role: 'assistant', content: `${message.content}` }
                    : { author, location, bot: isBot, role: 'user', content: `${message.content}` };
            }),
            { role: 'user', content: 'You are in a discord channel, respond to the recent messages shown above.' }
        ];
    } catch (error) {
        console.error(`Error building conversation for ${avatar.name}:`, error);
        throw error;
    }
};

/**
 * Determine if the avatar should respond based on the conversation context.
 * @param {Array} conversation - The conversation context.
 * @returns {boolean} Whether the avatar should respond.
 */
const shouldRespond = (conversation, avatar = { name: 'Ai' }) => {
    const recentMessages = conversation.slice(-5);

    if (recentMessages.length === 0) return false;  // No recent messages
    if (recentMessages[recentMessages.length - 1].author === avatar.name) return false;  // Last message was from the assistant
    return recentMessages.some(message => !message.bot) &&
        conversation[conversation.length - 1]?.role === 'user';
};

