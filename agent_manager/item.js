import { db } from '../database.mjs';
import { cleanString } from './utils.js';
import { waitForTask } from './task.js';
import { postResponse } from './response.js';

export async function examineRoom(avatar) {
    await updateItemLocations();  
    console.log(`Examining ${avatar.location.name} for ${avatar.name}`);
    let roomDetails = await db.collection('rooms').findOne({ name: avatar.location.name });

    if (!roomDetails) {
        console.log(`Room ${avatar.location.name} not found. Creating new room.`);
        roomDetails = {
            name: avatar.location.name,
            description: `A newly discovered room called ${avatar.location.name}.`
        };
        await db.collection('rooms').insertOne(roomDetails);
    }

    const itemsInRoom = await db.collection('items').find({ location: avatar.location.name }).toArray();

    return {
        description: roomDetails.description,
        items: itemsInRoom
    };
}

export async function takeItem(avatar, itemName) {
    console.log(`Taking item ${itemName} for ${avatar.name}`);
    const result = await db.collection('items').updateOne(
        { name: itemName },
        { $set: { takenBy: avatar.name } }
    );
    return result.modifiedCount > 0 ? `Item ${itemName} taken.` : 'Failed to take item.';
}

export async function getItem(name) {
    await updateItemLocations();
    return await db.collection('items').findOne({ name });
}

export async function getAvatarItems(avatar) {
    await updateItemLocations();  
    return await db.collection('items').find({ takenBy: avatar.name }).toArray();
}

export async function getItemsForLocation(location) {
    await updateItemLocations();  
    return await db.collection('items').find({ location }).toArray();
}

export async function updateItemLocations() {
    const items = await db.collection('items').find({ takenBy: { $ne: null } }).toArray();
    const avatars = await db.collection('avatars').find({ name: { $in: items.map(o => o.takenBy) } }).toArray();

    for (const item of items) {
        const avatar = avatars.find(a => a.name === item.takenBy);
        if (avatar) {
            await db.collection('items').updateOne(
                { name: item.name },
                { $set: { location: avatar.location } }
            );
        }
    }

    return 'Item locations updated.';
}

export async function leaveItem(avatar, itemName) {
    await updateItemLocations();  
    console.log(`Leaving item ${itemName} for ${avatar.name}`);
    const result = await db.collection('items').updateOne(
        { name: itemName },
        { $set: { takenBy: null } }
    );
    return result.modifiedCount > 0 ? `Item ${itemName} left.` : 'Failed to leave item.';
}

export async function createItem(itemData) {
    console.log(`Creating new item with name: ${itemData.name}`);
    try {
        const moonlitLantern = await db.collection('items').findOne({ name: 'Moonlit Lantern' });
        const celestialSphere = await db.collection('items').findOne({ name: 'Celestial Sphere' });

        if (moonlitLantern && celestialSphere) {
            if (moonlitLantern.location !== itemData.location || celestialSphere.location !== itemData.location) {
                return 'Item NOT Created. The Moonlit Lantern and Celestial Sphere must both be present to create.';
            }
        }

        const existingItem = await db.collection('items').findOne({ name: itemData.name });
        if (existingItem) {
            console.error('Item with the same name already exists.');
            return 'Item with the same name already exists.';
        }

        const result = await db.collection('items').insertOne(itemData);
        return result.insertedId ? `🔮 ${itemData.name} successfully created` : 'Failed to create item.';
    } catch (error) {
        console.error('Failed to create item:', error);
        return 'Failed to create item due to an error.';
    }
}

export async function useItem(avatar, data) {
    const [itemName, targetName] = data.split(',').map(cleanString);
    const item = await getItem(itemName);

    if (!item) { 
        return `The ${itemName} does not exist.`;
    }

    if (item.takenBy !== avatar.name) {
        return `You do not have the ${item.name}.`;
    }

    const description = await waitForTask({ name: item.name, personality: `You are the ${item.name}. ${item.description}` }, [
        { role: 'user', content: `Here are your statistics:\n\n${JSON.stringify(item)}\n\ndescribe yourself being used by ${avatar.name} on ${targetName} in a SHORT whimsical sentence or *action*.` }
    ]);

    console.log('🤖 being used\n' + description);
    item.location = avatar.location;
    await postResponse(item, description);

    return `I have used the ${item.name} with the following effect:\n\n${description}.`;
}
