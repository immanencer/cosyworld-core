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
        const [locations, mentions] = await Promise.all([
            getLocations(),
            getMentions(avatar.name, lastProcessedMessageIdByAvatar.get(avatar.name))
        ]);

        if (locations.length === 0) throw new Error('No locations found');

        if (mentions.length > 0) {
            if (shouldMoveAvatar(avatar, mentions[mentions.length - 1])) {
                const newLocation = findNewLocation(mentions[mentions.length - 1], locations);
                await updateAvatarLocation(avatar, newLocation);
            }
        }

        const messages = await fetchMessages(avatar, locations);

        if (messages.length === 0) return;

        const conversation = buildConversation(avatar, messages, locations);
        if (shouldRespond(conversation)) await handleResponse(avatar, conversation);

        updateLastProcessedMessageId(avatar, mentions);
    } catch (error) {
        console.error(`Error processing messages for ${avatar.name}:`, error);
    }
}

const shouldMoveAvatar = (avatar, lastMention) =>
    avatar.summon === 'true' &&
    avatar.location.id !== lastMention.channelId &&
    avatar.location.id !== lastMention.threadId &&
    (avatar.owner === 'host' || avatar.owner === lastMention.author);

const findNewLocation = (lastMention, locations) =>
    locations.find(loc => loc.id === lastMention.threadId) ||
    locations.find(loc => loc.id === lastMention.channelId || loc.parent === lastMention.channelId) ||
    locations[0];

async function fetchMessages(avatar, locations) {
    const rememberedLocations = new Set([...(avatar.remember || []), avatar.location.name]);
    const messagePromises = Array.from(rememberedLocations).map(locationName => {
        const locationId = locations.find(loc => loc.name === locationName)?.id;
        return locationId ? getMessages(locationId) : Promise.resolve([]);
    });

    const allMessages = await Promise.all(messagePromises);
    return allMessages.flat().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-10); // Fetch the latest few messages
}

const buildConversation = (avatar, messages, locations) =>
    messages.map(message => {
        const author = message.author.displayName || message.author.username;
        const location = locations.find(loc => loc.id === message.channelId)?.name || 'unknown location';
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

const updateLastProcessedMessageId = (avatar, mentions) => {
    if (mentions.length > 0) {
        lastProcessedMessageIdByAvatar.set(avatar.name, mentions[mentions.length - 1]._id);
    }
}
