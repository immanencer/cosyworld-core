import crypto from 'crypto';

import { ENQUEUE_API } from '../config.js';
import { postJSON, retry } from './utils.js';
import { waitForTask } from './ai.js';
import { getAvatarItems, callTool, getAvailableTools } from './item.js';
import { updateAvatarOnServer } from './avatar.js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const postResponse = retry(async (avatar, response) => {
    console.log(`${avatar.emoji} ${avatar.name} responds.`);
    await postJSON(ENQUEUE_API, {
        action: 'sendAsAvatar',
        data: {
            avatar: {
                ...avatar,
                channelId: avatar.location.type === 'thread' ? avatar.location.parent : avatar.location.channelId,
                threadId: avatar.location.type === 'thread' ? avatar.location.channelId : null
            },
            message: response
        }
    });
}, MAX_RETRIES, RETRY_DELAY);

export async function handleResponse(avatar, conversation) {
    try {

        if (conversation[conversation.length - 1].content.toLowerCase().trim().startsWith(`(${avatar.location.channelName}) ${avatar.name}:`.toLowerCase())) {
            console.log(`🤖 Skipping response for ${avatar.name} in ${avatar.location.channelName} because the last message was from the avatar.`)
            return;
        }

        if (!(await shouldRespond(avatar, conversation))) { 
            console.log(`🤖 Skipping response for ${avatar.name} in ${avatar.location.channelName}`);
            avatar.next_check = Date.now() + 5 * 60 * 1000; // 5 minutes in milliseconds
            await updateAvatarOnServer(avatar);
            return;
        }

        console.log(`🤖 Responding as ${avatar.name} in ${avatar.location.channelName}`);

        const [items, availableTools] = await Promise.all([
            getAvatarItems(avatar),
            getAvailableTools()
        ]);

        const toolResults = await handleTools(avatar, conversation, items, availableTools);
        const response = await generateResponse(avatar, conversation, items, toolResults);

        if (response && response.trim() !== "") {
            await postResponse(avatar, response);
        }
    } catch (error) {
        console.error(`Error in handleResponse for ${avatar.name}:`, error);
    }
}

const checkedConversations = new Map();

const hashConversation = (conversation) => {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(conversation));
    return hash.digest('hex');
};

const isRecentCheck = (hash) => {
    const entry = checkedConversations.get(hash);
    if (!entry) return false;
    const elapsedTime = Date.now() - entry.timestamp;
    return elapsedTime < 5 * 60 * 1000; // 5 minutes in milliseconds
};

const updateCheckTimestamp = (hash) => {
    checkedConversations.set(hash, { timestamp: Date.now() });
};

async function shouldRespond(avatar, conversation) {
    const recentConversation = conversation.slice(-10);
    const conversationHash = hashConversation(recentConversation);

    if (isRecentCheck(conversationHash)) {
        return false;
    }

    if (avatar.force) {
        // in force state only respond to human messages
        return !conversation[conversation.length - 1].isBot;
    }

    const haiku = await waitForTask(avatar, [
        ...recentConversation,
        { role: 'user', content: 'Write a haiku to decide if you should respond.' }
    ]);

    console.log(`📜 Haiku from ${avatar.name}:\n${haiku.split('\n').map(line => `    ${line}`).join('\n')}`);

    const haikuCheck = await waitForTask({ personality: 'You are an excellent judge of intention' }, [
        { role: 'user', content: `
            As ${avatar.name},
            I reflect on my purpose and write this haiku to decide whether to respond.

            ${haiku}

            Answer with YES or NO depending on the message of the haiku.
        ` }
    ]);

    console.log(`Haiku check for ${avatar.name}: ${haikuCheck}`);

    const shouldRespond = haikuCheck && haikuCheck.toLowerCase().includes('yes');
    console.log(`Haiku check for ${avatar.name}: ${shouldRespond ? 'Passed' : 'Failed'}`);

    updateCheckTimestamp(conversationHash);

    return shouldRespond;
}

async function handleTools(avatar, conversation, items, availableTools) {
    const recentConversation = conversation.slice(-5);
    const toolsPrompt = `
You have these items:

${items.map(T => T.name).join('\n')}.

You can perform these functions:

${availableTools.join('\n')}.

Respond with the action you want to use, one per line, with relevant parameters.
If no action is relevant, return NONE.
`;

    console.log(`🛠️ Tool prompt for ${avatar.name}:\n${toolsPrompt}`);

    const toolsCheck = await waitForTask(
        { personality: "You are a precise executive function. Respond only with a action or NONE." },
        [
            ...recentConversation,
            { role: 'user', content: toolsPrompt }
        ]
    );

    if (!toolsCheck || toolsCheck.trim().toLowerCase() === 'none') {
        return [];
    }

    const toolsToCall = toolsCheck.split('\n').filter(tool => tool.trim());
    return Promise.all(toolsToCall.map(tool => 
        callTool(tool, avatar, recentConversation).catch(error => {
            console.error(`Error calling tool ${tool}:`, error);
            return `Error: ${error.message}`;
        })
    ));
}

async function generateResponse(avatar, conversation, items, toolResults) {
    const recentConversation = conversation.slice(-25);
    const responsePrompt = `
You have the following items: ${JSON.stringify(items)}.
You have used the following tools: ${JSON.stringify(toolResults)}.
`;

    const response = await waitForTask(avatar, [
        ...recentConversation,
        { role: 'user', content: avatar.response_style || 'Generate a response.' }
    ]);

    console.log(`🤖 Response from ${avatar.name}:\n${response}`);
    const tag = `(${avatar.location}) ${avatar.name}`;
    return response.startsWith(tag) ? response.slice(tag.length).trim() : response;
}
