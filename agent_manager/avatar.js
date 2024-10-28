import { AVATARS_API, LOCATIONS_API } from '../config.js';
import { fetchJSON } from './utils.js';

let lastCacheTime = null;
let cachedLocations = null;


export const getLocations = async () => {

    if (lastCacheTime && Date.now() - lastCacheTime < 5000) {
        return cachedLocations;
    }
    if (!cachedLocations || cachedLocations.length === 0) {
        cachedLocations = await fetchJSON(LOCATIONS_API);
        lastCacheTime = Date.now();
    }
    return cachedLocations;
};

export const initializeAvatars = async () => {
    const [locations, allAvatars] = await Promise.all([
        getLocations(),
        fetchJSON(AVATARS_API)
    ]);

    return allAvatars
        .map(avatar => initializeAvatar(avatar, locations));
};

const initializeAvatar = (avatar, locations) => ({
    ...avatar,
    location: locations.find(loc => loc.channelName === avatar.location) || locations[0],
    messageCache: [],
    lastProcessedMessageId: null,
    remember: [...new Set([...(avatar.remember || []), avatar.location])]
        .slice(-5)
});

export const updateAvatarLocation = async (avatar) => {
    if (!avatar || !avatar.location) {
        console.error('Invalid avatar or location');
        return;
    }

    console.log(`${avatar.emoji} ${avatar.name} is now in ${avatar.location.channelName}.`);
    
    avatar.remember = updateRememberedLocations(avatar);
    console.log(avatar.remember);

    try {
        await updateAvatarOnServer(avatar);
    } catch (error) {
        console.error(`Failed to update location for ${avatar.name}:`, error);
    }
};

const updateRememberedLocations = ({ remember, location }) => 
    [...new Set([...remember, location.channelName])].slice(-5);

export const updateAvatarOnServer = async (avatar) => {
    if (!avatar || !avatar._id) {
        throw new Error('Invalid avatar object');
    }

    const url = `${AVATARS_API}/${avatar._id}`;
    const body = JSON.stringify({ 
        location: avatar.location?.name, 
        remember: avatar.remember 
    });

    try {
        await fetchJSON(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body
        });
    } catch (error) {
        console.error(`Failed to update avatar ${avatar.name} on server:`, error);
        throw error;
    }
};

export const refreshLocations = async () => {
    cachedLocations = await fetchJSON(LOCATIONS_API);
    return cachedLocations;
};