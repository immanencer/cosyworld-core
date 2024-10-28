// Import necessary modules
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } from '@discordjs/voice';
import { MongoClient } from 'mongodb';
import 'dotenv/config';
import process from 'process';
import { writeFile } from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

// Initialize Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent ] });

// MongoDB connection details
const mongoURI = process.env.MONGODB_URI;
const dbName = 'radio-whisper';
const collectionName = 'radio';
let trackCollection;

// Audio player setup
const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Pause,
  },
});

// Function to get next track from the database
async function getNextTrack() {
  const track = await trackCollection.findOneAndUpdate(
    { },
    { $inc: { playcount: 1 } },
    { sort: { playcount: 1, _id: 1 }, returnDocument: 'after' }
  );
  return track ? createAudioResource(track.path, { metadata: { title: track.title } }) : null;
}

// Play next track
async function playNext() {
  const resource = await getNextTrack();
  if (resource) {
    player.play(resource);
  } else {
    console.log('No more tracks in the database.');
  }
}

// Error handling and state management
player.on('error', async (error) => {
  console.error(`Error: ${error.message} with resource ${error.resource?.metadata?.title}`);
  await playNext();
});

player.on(AudioPlayerStatus.Idle, async () => {
  await playNext();
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Connect to MongoDB
  const mongoClient = new MongoClient(mongoURI);
  await mongoClient.connect();
  console.log('Connected to MongoDB');
  trackCollection = mongoClient.db(dbName).collection(collectionName);

  // Connect to a voice channel and start the player
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  const channel = await guild.channels.fetch(process.env.DISCORD_VC_ID);

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
  });

  connection.subscribe(player);

  // Start playing
  await playNext();
});

client.on('messageCreate', async (message) => {
  if (message.attachments.size > 0) {
    for (const attachment of message.attachments.values()) {
      if (attachment.name.endsWith('.mp3')) {
        try {
          const filePath = `./tracks/${uuidv4()}.mp3`;
          const response = await fetch(attachment.url);
          const buffer = await response.arrayBuffer();
          await writeFile(filePath, Buffer.from(buffer));

          await trackCollection.insertOne({ path: filePath, title: `Track from ${message.author.tag}`, playcount: 0 });
          console.log(`Added track from attachment: ${attachment.name}`);
          message.reply('Track added to the queue!');
        } catch (error) {
          console.error('Error saving attachment:', error);
          message.reply('Failed to add the track. Please try again.');
        }
      }
    }
  } else if (message.content.startsWith('http') && message.content.endsWith('.mp3')) {
    const url = message.content.trim();
    await trackCollection.insertOne({ path: url, title: `Track from ${message.author.tag}`, playcount: 0 });
    console.log(`Added track: ${url}`);
    message.reply('Track added to the queue!');
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
