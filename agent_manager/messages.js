import { MESSAGES_API } from "../config.js";
import { fetchJSON, createURLWithParams } from "./utils.js";
import { getLocations } from "./avatar.js";
import { handleResponse } from "./response.js";

export const getMessages = (location) =>
    fetchJSON(createURLWithParams(MESSAGES_API, { location }));

export const getMentions = (name, since) =>
    fetchJSON(createURLWithParams(`${MESSAGES_API}/mention`, { name, since }));

export async function processMessagesForAvatar(avatar) {
    try {
        const locations = await getLocations();

        if (locations.length === 0) throw new Error('No locations found');

        const messages = await fetchMessages(avatar, locations);

        if (messages.length === 0) return;

        const conversation = buildConversation(avatar, messages, locations);
        if (shouldRespond(conversation)) await handleResponse(avatar, conversation, locations);

    } catch (error) {
        console.error(`Error processing messages for ${avatar.name}:`, error);
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
const buildConversation = (avatar, messages, locations) => 
    messages.map(message => {
        const author = message.author.displayName || message.author.username;
        const location = locations.find(loc => loc.channelId === message.channelId)?.channelName || 'unknown location';
        const isBot = message.author.discriminator === "0000";

        return author.includes(avatar.name)
            ? { author, location, bot: isBot, role: 'assistant', content: `${message.content}` }
            : { author, location, bot: isBot, role: 'user', content: `${message.content}` };
    });

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

