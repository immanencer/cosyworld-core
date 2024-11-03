// processPostsForAvatar.js
import { ObjectId } from 'mongodb';
import { db, client } from '../database.mjs'; // Ensure the path is correct based on your project structure
import { waitForTask } from './ai.js';
import { updateCharacterContext } from './memory.js';
import fs from 'fs';

const DATABASE_NAME = 'moonstone'; // Database name

/**
 * Constants for rate limiting
 */
const FOUR_HOURS = 1 * 60 * 60 * 1000; // in milliseconds

/**
 * Enqueues a post task to the 'tasks' collection for XModule to process.
 * @param {Object} avatar - The avatar object.
 * @param {string} message - The message to be posted.
 */
async function enqueuePostTask(avatar, message) {
    try {
        await client.connect();
        const db = client.db(DATABASE_NAME);
        const tasksCollection = db.collection('x_tasks');
        const avatarCollection = db.collection('avatars');

        const _avatar = await avatarCollection.findOne({ name: avatar.name });
        if (!_avatar) {
            console.error(`Avatar ${avatar.name} not found in the database.`);
            return;
        }

        if (_avatar.last_posted_at && (Date.now() - Date.parse(_avatar.last_posted_at)) < FOUR_HOURS) {
            console.log(`⚠️ Rate limiting post for ${avatar.name}.`);
            return;
        }

        const task = {
            message,
            status: 'pending',
            avatarId: avatar._id, // Reference to the avatar
            createdAt: new Date()
        };

        await tasksCollection.insertOne(task);
        avatar.last_posted_at = new Date();
        await avatarCollection.updateOne({ name: avatar.name }, { $set: { last_posted_at: avatar.last_posted_at } });
        console.log(`✅ Enqueued post task for ${avatar.name}: "${message}"`);
    } catch (error) {
        console.error(`Error enqueuing post task for ${avatar.name}:`, error);
    } finally {
        await client.close();
    }
}

/**
 * Determines if an avatar can post based on the last posted timestamp.
 * @param {Object} avatar - The avatar object containing last_posted_at.
 * @param {number} limit - Time limit in milliseconds.
 * @returns {Object} - Contains a boolean `canPost` and `hoursLeft` if applicable.
 */
function canAvatarPost(avatar, limit) {
    const lastPostedAt = avatar.last_posted_at ? Date.parse(avatar.last_posted_at) : 0;
    const now = Date.now();

    if (lastPostedAt && (now - lastPostedAt) < limit) {
        const hoursLeft = ((limit - (now - lastPostedAt)) / (60 * 60 * 1000)).toFixed(2);
        return { canPost: false, hoursLeft };
    }

    return { canPost: true, hoursLeft: 0 };
}



/**
 * Processes posts for a given avatar.
 * Checks if the avatar can post (not in the last 4 hours), generates a post, and enqueues it.
 * @param {Object} avatar - The avatar object.
 */
export async function processPostsForAvatar(avatar) {
    try {
        const lastPostedAt = Date.parse(avatar.last_posted_at) || new Date(); // Default to current time if not available
        const now = Date.now();

        const { canPost, hoursLeft } = canAvatarPost(avatar, FOUR_HOURS);

        if (!canPost) {
            if (Math.floor(hoursLeft * 100) % 50 === 0) {
                console.log(`⏰ Skipping post for ${avatar.name}; ${hoursLeft} hours left before next post.`);
            }
            return;
        }

        console.log(`🤖 Preparing to post as ${avatar.name} on X.`);

        // Generate the post content using AI
        const postContent = await generatePostContent(avatar);

        if (postContent && postContent.trim() !== "") {
            // Enqueue the post task
            await enqueuePostTask(avatar, postContent);
            console.log(`📤 Post content generated and enqueued for ${avatar.name}: "${postContent}"`);
        } else {
            console.log(`⚠️ No valid post content generated for ${avatar.name}.`);
        }
    } catch (error) {
        console.error(`Error in processPostsForAvatar for ${avatar.name}:`, error);
    }
}

// Function to generate post content for an avatar using AI, including dreams, journals, and memories
async function generatePostContent(avatar) {
    try {
      // Fetch character data from MongoDB
      await client.connect();
      const db = client.db(DATABASE_NAME);
      const collection = db.collection('characters');
      let character = await collection.findOne({ name: avatar.name });
  
      if (!character) {
        console.error(`Character ${avatar.name} not found in the database.`);
        await updateCharacterContext(avatar);
        character = await collection.findOne({ name: avatar.name });
        if (!character) {
          console.error(`Failed to update character ${avatar.name}.`);
          return null;
        }
      }

      let accountBalance = null;
      if (avatar.name === '$RATi Cat') {
        accountBalance = fs.readFileSync('.\\nft_images\\H1eozXWQNG5eJkxP3EzoFoJQW9GQxVKR5dQjQwZTRdaC_report.md', 'utf8');
      }

      // Define the prompt including dreams, memories, and journals
      const prompt = `As ${avatar.name}, create an engaging post for X. It should be SHORT (less than 280 characters). Feel free to choose one NFT or Coin you hold to promote:\n` +
                     `${accountBalance ? `Balance: ${accountBalance}\n`: ''}` +
                     `Dream: ${character.dream}\n` +
                     `Memory: ${character.memory}\n` +
                     `Journal: ${character.journal}`;
  
      // Generate the post content using AI
      const response = await waitForTask(avatar, [
        { role: 'user', content: prompt }
      ]);
  
      if (!response || response.trim() === "") {
        return null;
      }
  
      console.log(`📝 Generated post content for ${avatar.name}:
  ${response}`);
  
      // Optional: Additional processing or validation of the response
      const tag = `(${avatar.location.channelName}) ${avatar.name}`;
  
      return response.startsWith(tag) ? response.slice(tag.length).trim() : response;
    } catch (error) {
      console.error(`Error generating post content for ${avatar.name}:`, error);
      return null;
    } finally {
      await client.close();
    }
  }