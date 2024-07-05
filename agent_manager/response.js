import { ENQUEUE_API } from '../config.js';
import { postJSON, retry } from './utils.js';
import { waitForTask } from './task.js';
import { callTool, getAvailableTools } from './tool.js';
import { getAvatarItems } from './item.js';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const postResponse = retry(async (avatar, response) => {
    console.log(`${avatar.emoji} ${avatar.name} responds.`);
    await postJSON(ENQUEUE_API, {
        action: 'sendAsAvatar',
        data: {
            avatar: {
                ...avatar,
                channelId: avatar.location.type === 'thread' ? avatar.location.parent : avatar.location.id,
                threadId: avatar.location.type === 'thread' ? avatar.location.id : null
            },
            message: response
        }
    });
}, MAX_RETRIES, RETRY_DELAY);

export async function handleResponse(avatar, conversation) {
    console.log(`🤖 Processing messages for ${avatar.name} in ${avatar.location.name}`);
    
    try {
        if (!(await shouldRespond(avatar, conversation))) return;

        console.log(`🤖 Responding as ${avatar.name} in ${avatar.location.name}`);

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

async function shouldRespond(avatar, conversation) {
    const recentConversation = conversation.slice(-10);
    const haiku = await waitForTask(avatar, [
        ...recentConversation,
        { role: 'user', content: 'Write a haiku to decide if you should respond.' }
    ]);

    console.log(`Haiku from ${avatar.name}:\n${haiku}`);

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
    return shouldRespond;
}

async function handleTools(avatar, conversation, items, availableTools) {
    const recentConversation = conversation.slice(-5);
    const toolsPrompt = `
You have the following items: ${JSON.stringify(items)}.
Return a single relevant tool call from this list, be sure to modify the parameters:

${availableTools.map(tool => {
    const [name, params = ''] = tool.split('(');
    return `${name}(${params.split(',').map(p => `"${p.trim().replace(/"/g, '')}"`).join(', ')})`;
}).join('\n')}

If no tool is relevant, return NONE.
`;

    const toolsCheck = await waitForTask(
        { personality: "You are a precise tool selector. Respond only with a tool call or NONE." },
        [
            { role: 'assistant', content: 'recall_conversation("5")' },
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
