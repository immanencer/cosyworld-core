// Import required libraries
import { MongoClient } from 'mongodb';
import { waitForTask } from './ai.js';
import dotenv from 'dotenv';
import { getMessages } from "./messages.js";

// Load environment variables
dotenv.config();

// Define MongoDB settings
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'moonstone';
const COLLECTION_NAME = 'characters';
const UPDATE_INTERVAL_HOURS = 6;

// Connect to MongoDB
const client = new MongoClient(MONGODB_URI);

// Function to update a character's dream, memory, and journal using AI
export async function updateCharacterContext(character) {
  try {
    if (!character.location || !character.location.channelId) {
        console.error(`Character ${character.name} is missing location information.`);
        return;
    }
    // Fetch recent messages from the character's location
    const recentMessages = await getMessages(character.location.channelId);
    const recentMessagesContent = recentMessages.map(msg => `${msg.author.displayName || msg.author.username}: ${msg.content}`).join('\n');

    // Generate a new dream, memory, and journal entry using AI
    const dreamPrompt = `As ${character.name}, describe your dream.`;
    const memoryPrompt = `As ${character.name}, recall a memory based on these recent messages: \n${recentMessagesContent}`;
    const journalPrompt = `As ${character.name}, write a journal entry about your recent experiences.`;

    const dream = await waitForTask(character, [{ role: 'user', content: dreamPrompt }]);
    const memory = await waitForTask(character, [{ role: 'user', content: memoryPrompt }]);
    const journal = await waitForTask(character, [{ role: 'user', content: journalPrompt }]);

    // Update the character in MongoDB
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    await collection.updateOne(
      { name: character.name },
      { $set: { dream, memory, journal, lastUpdated: new Date() } },
      { upsert: true }
    );

    console.log(`Updated character ${character.name}`);
  } catch (error) {
    console.error(`Failed to update character ${character.name}:`, error);
  } finally {
    await client.close();
  }
}

// Function to update all characters every six hours
export async function updateAllCharacters() {
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);
    const characters = await collection.find().toArray();

    for (const character of characters) {
      await updateCharacterContext(character);
    }
  } catch (error) {
    console.error('Failed to update all characters:', error);
  } finally {
    await client.close();
  }
}