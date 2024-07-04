import { MESSAGES_API } from "../config.js";
import { fetchJSON, createURLWithParams } from "./utils.js";
import { getLocations, updateAvatarLocation } from "./avatar.js";
import { handleResponse } from "./response.js";

const lastProcessedMessageIdByAvatar = new Map();
const lastCheckedMessageIdByAvatar = new Map();

export const getMessages = (location, since) =>
    fetchJSON(createURLWithParams(MESSAGES_API, { location, since }));

export const getMentions = (name, since) =>
    fetchJSON(createURLWithParams(`${MESSAGES_API}/mention`, { name, since }));

export async function processMessagesForAvatar(avatar) {
    try {
        const [locations, mentions] = await Promise.all([
            getLocations(),
            getMentions(avatar.name, lastProcessedMessageIdByAvatar.get(avatar.name))
        ]);

        if (locations.length === 0) {
            console.error('No locations found');
            return;
        }

        await handleAvatarLocation(avatar, mentions, locations);

        const lastCheckedId = lastCheckedMessageIdByAvatar.get(avatar.name);
        const messages = await fetchMessages(avatar, locations, null);

        // If the last message is from me, don't respond
        if (messages.length === 0) {
            return;
        }

        const lastMessage = messages[messages.length - 1];

        if (!lastCheckedId || lastMessage.message_id < lastCheckedId) {
            lastCheckedMessageIdByAvatar.set(avatar.name, lastMessage.message_id);
        } else {
            return;
        }

        const conversation = buildConversation(avatar, messages, locations);

        if (shouldRespond(conversation)) {
            await handleResponse(avatar, conversation);
        }

        updateLastProcessedMessageId(avatar, mentions);
        updateLastCheckedMessageId(avatar, messages);
    } catch (error) {
        console.error(`Error processing messages for ${avatar.name}:`, error);
    }
}

async function handleAvatarLocation(avatar, mentions, locations) {
    if (!avatar) {
        console.error('Invalid avatar object');
        return;
    }

    if (!avatar.location) {
        avatar.location = locations[0];
    }

    if (!avatar.location.id) {
        if (avatar.location.channelId) {
            avatar.location.id = avatar.location.channelId;
        } else if (avatar.location.threadId) {
            avatar.location.id = avatar.location.threadId;
        } else {
            console.error(`Invalid location for ${avatar.name}: ${JSON.stringify(avatar.location)}`);
            return;
        }
    }

    if (mentions.length > 0 && avatar.summon === "true") {
        const lastMention = mentions[mentions.length - 1];
        if (shouldMoveAvatar(avatar, lastMention)) {
            const newLocation = findNewLocation(lastMention, locations);
            if (newLocation && newLocation.id !== avatar.location.id) {
                avatar.location = newLocation;
                try {
                    await updateAvatarLocation(avatar);
                } catch (error) {
                    console.error(`Failed to update avatar location for ${avatar.name}:`, error);
                }
            }
        }
    }
}

const shouldMoveAvatar = (avatar, lastMention) =>
    avatar.location.id !== lastMention.channelId &&
    avatar.location.id !== lastMention.threadId &&
    (avatar.owner === 'host' || avatar.owner === lastMention.author);

const findNewLocation = (lastMention, locations) =>
    locations.find(loc => loc.id === lastMention.threadId) ||
    locations.find(loc => loc.id === lastMention.channelId || loc.parent === lastMention.channelId) ||
    locations[0];

async function fetchMessages(avatar, locations, lastCheckedId) {
    const rememberedLocations = [...new Set([...(avatar.remember || []), [avatar.location.name]])];
    const messagePromises = rememberedLocations.map(locationName => {
        const locationId = locations.find(loc => loc.name === locationName)?.id;
        return locationId ? getMessages(locationId, lastCheckedId) : Promise.resolve([]);
    });

    const allMessages = await Promise.all(messagePromises);
    return allMessages.flat().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
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

const updateLastCheckedMessageId = (avatar, messages) => {
    if (messages.length > 0) {
        lastCheckedMessageIdByAvatar.set(avatar.name, messages[messages.length - 1]._id);
    }
}