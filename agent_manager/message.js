import { MESSAGES_API } from "../config.js";
import { fetchJSON, createURLWithParams } from "./utils.js";
import { getLocations, updateAvatarLocation } from "./avatar.js";
import { handleResponse } from "./response.js";

const lastProcessedMessageIdByAvatar = new Map();

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

        updateLastProcessedMessageId(avatar, messages);
    } catch (error) {
        console.error(`Error processing messages for ${avatar.name}:`, error);
    }
}

async function fetchMessages(avatar, locations) {
    try {
        const rememberedLocations = new Set([...(avatar.remember || []), avatar.location.channelName]);
        const lastProcessedId = lastProcessedMessageIdByAvatar.get(avatar.name);

        const messagePromises = Array.from(rememberedLocations).map(locationName => {
            const locationId = locations.find(loc => loc.channelName === locationName)?.channelId;
            return locationId ? getMessages(locationId) : Promise.resolve([]);
        });

        const allMessages = await Promise.all(messagePromises);
        const sortedMessages = allMessages.flat().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        if (lastProcessedId) {
            const lastProcessedIndex = sortedMessages.findIndex(message => message._id === lastProcessedId);
            return sortedMessages.slice(lastProcessedIndex + 1).slice(-10); // Fetch the latest few messages after the last processed message
        } else {
            return sortedMessages.slice(-10); // Fetch the latest few messages if no last processed message is found
        }
    } catch (error) {
        console.error(`Error fetching messages for ${avatar.name}:`, error);
        throw error;
    }
}

const buildConversation = (avatar, messages, locations) =>
    messages.map(message => {
        const author = message.author.displayName || message.author.username;
        const location = locations.find(loc => loc.channelId === message.channelId)?.name || 'unknown location';
        const isBot = message.author.discriminator === "0000";

        return author.includes(avatar.name)
            ? { bot: isBot, role: 'assistant', content: message.content }
            : { bot: isBot, role: 'user', content: `(${location}) ${author}: ${message.content}` };
    });

const shouldRespond = (conversation) => {
    const recentMessages = conversation.slice(-5);
    return recentMessages.some(message => !message.bot) &&
        conversation[conversation.length - 1]?.role === 'user';
};

const updateLastProcessedMessageId = (avatar, messages) => {
    if (messages.length > 0) {
        lastProcessedMessageIdByAvatar.set(avatar.name, messages[messages.length - 1]._id);
    }
}

