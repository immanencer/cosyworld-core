import { db } from '../database.mjs';
import { waitForTask } from './ai.js';
import { postResponse } from './response.js';
import { updateAvatarLocation } from './avatar.js';

async function updateItemLocations() {
    console.log('🔄 Updating item locations...');
    const items = await db.collection('items').find({ takenBy: { $ne: null } }).toArray();
    const avatars = await db.collection('avatars').find({ name: { $in: items.map(o => o.takenBy) } }).toArray();

    for (const item of items) {
        const avatar = avatars.find(a => a.name === item.takenBy);
        if (avatar) {
            await db.collection('items').updateOne({ name: item.name }, { $set: { location: avatar.location } });
            console.log(`🔄 Updated location of item "${item.name}" to "${avatar.location}".`);
        }
    }
    return 'Item locations updated.';
}

async function takeItem(avatar, itemName) {
    console.log(`🛠️ ${avatar.name} attempting to take item "${itemName}"...`);
    const result = await db.collection('items').updateOne(
        { name: itemName },
        { $set: { takenBy: avatar.name } }
    );
    const message = result.modifiedCount > 0 ? `Item "${itemName}" taken by ${avatar.name}.` : `Failed to take item "${itemName}".`;
    console.log(message);
    return message;
}

async function leaveItem(avatar, itemName) {
    console.log(`🛠️ ${avatar.name} attempting to leave item "${itemName}"...`);
    const result = await db.collection('items').updateOne(
        { name: itemName },
        { $set: { takenBy: null } }
    );
    const message = result.modifiedCount > 0 ? `Item "${itemName}" left by ${avatar.name}.` : `Failed to leave item "${itemName}".`;
    console.log(message);
    return message;
}

async function useItem(avatar, data) {
    const [itemName, targetName] = data.split(',').map(str => str.trim());
    console.log(`🛠️ ${avatar.name} attempting to use item "${itemName}" on "${targetName}"...`);
    const item = await db.collection('items').findOne({ name: itemName });

    if (!item) {
        const message = `The item "${itemName}" does not exist.`;
        console.log(message);
        return message;
    }

    if (item.takenBy !== avatar.name) {
        const message = `You do not have the item "${item.name}".`;
        console.log(message);
        return message;
    }

    const description = await waitForTask(
        { name: item.name, personality: `You are the ${item.name}. ${item.description}` },
        [{ role: 'user', content: `Describe being used by ${avatar.name} on ${targetName} in a SHORT whimsical sentence or *action*.` }]
    );

    item.location = avatar.location;
    await postResponse(item, description);

    const message = `I have used the ${item.name} with the following effect:\n\n${description}.`;
    console.log(message);
    return message;
}

async function getItemsForLocation(location) {
    console.log(`🔍 Getting items for location "${location}"...`);
    await updateItemLocations();
    return await db.collection('items').find({ location }).toArray();
}

export async function getAvatarItems(avatar) {
    console.log(`🔍 Getting items for avatar "${avatar.name}"...`);
    await updateItemLocations();
    return await db.collection('items').find({ takenBy: avatar.name }).toArray();
}

async function moveToLocation(avatar, locationName, locations) {
    console.log(`🚶 ${avatar.name} attempting to move to location "${locationName}"...`);
    const newLocation = locations.find(loc => loc.name.toLowerCase() === locationName.toLowerCase());
    if (newLocation) {
        avatar.location = newLocation;
        await updateAvatarLocation(avatar);
        const items = await getItemsForLocation(newLocation.name);
        const message = `Moved to ${newLocation.name}.\n\n${
            items.length > 0 ? `Items in this location: ${items.map(i => i.name).join(', ')}` : 'No items in this location.'
        }`;
        console.log(message);
        return message;
    }
    const message = `Location "${locationName}" not found.`;
    console.log(message);
    return message;
}

async function readChannel(avatar, channelName) {
    console.log(`📖 ${avatar.name} attempting to read channel "${channelName}"...`);
    const location = avatar.location;
    if (location.name.toLowerCase() !== channelName.toLowerCase()) {
        const message = `You are not in the channel "${channelName}".`;
        console.log(message);
        return message;
    }
    const items = await getItemsForLocation(location.name);
    const message = items.length > 0 ? `Items in this location: ${items.map(i => i.name).join(', ')}` : 'No items in this location.';
    console.log(message);
    return message;
}

const tools = {
    MOVE: moveToLocation,
    TAKE: takeItem,
    USE: useItem,
    DROP: leaveItem,
    READ: readChannel
};

export async function callTool(command, avatar, locations) {
    console.log(`⚒️ Calling command: "${command}" for avatar: "${avatar.name}"`);

    try {
        const [tool, ...params] = command.split(' ');
        const toolName = tool.toUpperCase();
        const toolFunction = tools[toolName];

        if (!toolFunction) {
            const message = `Tool "${toolName}" not found. Available tools are: ${Object.keys(tools).join(', ')}`;
            console.log(message);
            return message;
        }

        const param = params.join(' ').replace(/["']/g, '').trim(); // Remove quotes and trim whitespace
        if (!param) {
            const message = `No parameter provided for tool "${toolName}".`;
            console.log(message);
            return message;
        }

        return await toolFunction(avatar, param, locations);
    } catch (error) {
        const errorMessage = `Error calling command "${command}" for avatar "${avatar.name}": ${error.message}`;
        console.error(errorMessage, error);
        return errorMessage;
    }
}

export function getAvailableTools() {
    const toolsList = Object.keys(tools);
    console.log(`🛠️ Available tools: ${toolsList.join(', ')}`);
    return toolsList;
}
