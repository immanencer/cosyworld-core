import { MESSAGES_API } from '../config.js';
import { cleanString, postJSON } from './utils.js';
import { updateAvatarLocation, getLocations } from './avatar.js';
import { examineRoom, takeObject, useObject, leaveObject, createObject, getAvatarObjects } from './item.js';
import { waitForTask } from './task.js';
import { postResponse } from './response.js';

let locations = [];

try {
    locations = await getLocations();
} catch (error) {
    console.error('Failed to get locations:', error);
}

const tools = {
    change_location: async (avatar, data) => {
        console.log(`${avatar.emoji} ${avatar.name} 🏃💨 ${data}`);
        const new_location = locations.find(loc => loc.name === data);
        if (new_location) {
            avatar.location = new_location;
            await updateAvatarLocation(avatar);
            return `I have moved to ${new_location.name}.`;
        }
        return `Location ${data} not found.`;
    },
    examine_room: async (avatar, _, conversation) => {
        const tool_result = await examineRoom(avatar);
        const examinedItems = tool_result.objects.map(async item => {
            if (conversation.some(msg => msg.author.username.includes(item.name))) return null;
            item.location = avatar.location;
            item.name += item.takenBy ? ` (held by ${item.takenBy})` : '';

            const description = await waitForTask(
                { name: item.name, personality: `You are the ${item.name}. ${item.description}` },
                [{ role: 'user', content: `Describe yourself in a short whimsical sentence or *action*.` }]
            );

            await postResponse(item, description);
            return `${item.name} - ${description}`;
        });

        const messages = (await Promise.all(examinedItems)).filter(Boolean);
        const messageCount = messages.length;
        const message = `I have examined the room and revealed its secrets. There are ${messageCount} items here:\n\n${messages.join('\n')}`;

        const lastMessages = conversation.slice(-100).map(m => m.content).join('\n');
        const summaryPrompt = `Summarize the following conversation in a concise paragraph:\n\n${lastMessages}`;
        
        const summary = await waitForTask(
            { name: "Conversation Summarizer", personality: "You are a skilled conversation summarizer." },
            [{ role: 'user', content: summaryPrompt }]
        );

        const finalMessage = `${message}\n\nRecent conversation summary:\n${summary}`;
        console.log(`🔍 Examining room for ${avatar.name} in ${avatar.location.name}: ${finalMessage}`);

        await postJSON(MESSAGES_API, {
            message_id: 'default_id',
            author: avatar,
            content: finalMessage,
            createdAt: new Date().toISOString(),
            channelId: locations.find(loc => loc.name === avatar.location.name)?.id,
            guildId: 'default_guild_id'
        });

        return finalMessage;
    },
    take_object: takeObject,
    use_object: useObject,
    leave_object: leaveObject,
    create_object: async (avatar, data) => {
        const [name, description] = data.split(',').map(cleanString);
        if (!name || !description) {
            throw new Error('Both name and description are required for creating an object.');
        }
        return createObject({
            name,
            description,
            location: avatar.location.name,
            avatar: "https://i.imgur.com/Oly9eGA.png"
        });
    }
};

export async function callTool(tool, avatar, conversation) {
    console.log(`⚒️ Calling tool: ${tool} for avatar: ${avatar.name}`);

    try {
        const [toolName, ...args] = cleanString(tool).replace(')', '').split('(');
        const toolFunction = tools[toolName];

        if (!toolFunction) {
            return `Tool ${toolName} not found. Available tools are: ${Object.keys(tools).join(', ')}`;
        }

        return await toolFunction(avatar, args.join('('), conversation);
    } catch (error) {
        const object = getAvatarObjects(avatar).find(o => o.name === tool);
        if (object) {
            return await useObject(avatar, tool, conversation);
        }
        return `Error calling tool ${tool}: ${error.message}`;
    }
}

export function getAvailableTools() {
    return Object.keys(tools);
}
