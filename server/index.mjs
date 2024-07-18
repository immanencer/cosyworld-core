import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// Ai API routes

import ai from './routes/ai.mjs';
app.use('/ai', ai);


// Custom API routes

import avatars from './routes/avatars.mjs';
app.use('/api/avatars', avatars);

import statistics from './routes/statistics.mjs';
app.use('/statistics', statistics);

import news from '../agents/newsbot/router.mjs';
app.use('/news', news);




// Third-party API routes

import discordBot from './routes/discord.mjs';
app.use('/discord', discordBot);


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});