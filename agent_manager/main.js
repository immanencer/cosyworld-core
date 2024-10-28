import  { initializeAvatars } from './avatar.js';
import { processMessagesForAvatar } from './messages.js';
import { processPostsForAvatar } from './xPost.js';
import { updateAllCharacters } from './memory.js';
import './memory.js';

import { POLL_INTERVAL } from '../config.js';

const UPDATE_INTERVAL_HOURS = 6;

async function main() {
    let avatars = await initializeAvatars();


    // Run the initial update
    try {
        await updateAllCharacters();
        // Schedule updates every six hours
        setInterval(updateAllCharacters, UPDATE_INTERVAL_HOURS * 60 * 60 * 1000);
        console.log('Initial character update completed.')
    } catch (error) {
        console.error('Error in initial character update:', error);
    }

    let running = true;
    while (running) {
        // refresh avatars
        avatars = await initializeAvatars();
    
        for (const avatar of avatars) {
            await processMessagesForAvatar(avatar);
        }
        const raticat = avatars.find(T => T.name === "$RATi Cat");
        if(raticat) {
            await processPostsForAvatar(raticat);
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
}

main().catch(error => console.error('Error in main loop:', error));