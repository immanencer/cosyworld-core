import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

import ai from './routes/ai.mjs';
app.use('/ai', ai);

// Custom API routes

import avatars from './routes/avatars.mjs';
app.use('/avatars', avatars);

// Third-party API routes

import discordBot from './routes/discord.mjs';
app.use('/discord', discordBot);

import summarizer from './routes/summarizer.mjs';
app.use('/summarizer',summarizer);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});