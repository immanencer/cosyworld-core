// x.mjs

import dotenv from 'dotenv';
import { db } from '../database.mjs';

import { ObjectId } from 'mongodb';

import { postX } from './postX.js';

// Load environment variables from .env file
dotenv.config();

// Access MongoDB collections
const tasksCollection = db.collection('x_tasks');
const avatarsCollection = db.collection('avatars');

// XModule Class Definition
class XModule {
    constructor() {
        // Rate limiting configurations
        this.dailyPostLimit = parseInt(process.env.X_DAILY_POST_LIMIT, 10) || 10; // Default to 10 posts/day
        this.postsToday = 0;
        this.lastPostDate = this.getCurrentDate();
        this.rateLimitReached = false;

        // Control the monitoring loop
        this.isRunning = false;
    }

    /**
     * Utility to get current date in YYYY-MM-DD format
     * @returns {string} - Current date as a string
     */
    getCurrentDate() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Starts the monitoring loop to process pending tasks
     */
    startMonitoring() {
        if (this.isRunning) {
            console.log('XModule is already running.');
            return;
        }
        this.isRunning = true;
        console.log('XModule started monitoring tasks.');
        this.monitorInterval = setInterval(() => this.processPendingTask(), 5000); // Check every 5 seconds
    }

    /**
     * Stops the monitoring loop
     */
    stopMonitoring() {
        if (!this.isRunning) return;
        clearInterval(this.monitorInterval);
        this.isRunning = false;
        console.log('XModule stopped monitoring tasks.');
    }

    /**
     * Processes a single pending task from the tasks collection
     */
    async processPendingTask() {
        try {
            this.resetDailyCountIfNeeded();

            if (this.rateLimitReached) {
                return; // Do not process if rate limit reached
            }

            // Fetch the next pending task
            const task = await tasksCollection.findOneAndUpdate(
                { status: 'pending' },
                { $set: { status: 'processing', startedAt: new Date() } },
                { sort: { createdAt: 1 }, returnDocument: 'after' }
            );

            if (!task) {
                console.log(`[${new Date().toISOString()}] No pending tasks. Waiting...`);
                return;
            }

            const { avatarId, message } = task;

            // Fetch the avatar details
            const avatar = await avatarsCollection.findOne({ _id: new ObjectId(avatarId) });
            if (!avatar) {
                console.error(`Avatar with ID ${avatarId} not found. Marking task as failed.`);
                await tasksCollection.updateOne(
                    { _id: task._id },
                    { $set: { status: 'failed', error: 'Avatar not found', failedAt: new Date() } }
                );
                return;
            }

            const tweetContent = message;
            // Validate tweet content
            if (!tweetContent || tweetContent.trim() === '') {
                console.log(`⚠️ Empty tweet content for ${avatar.name}. Marking task as failed.`);
                await tasksCollection.updateOne(
                    { _id: task.value._id },
                    { $set: { status: 'failed', error: 'Empty tweet content', failedAt: new Date() } }
                );
                return;
            }

            // trim leading and trailing quotes
            const postText = tweetContent.trim().replace(/^"|"$/g, '');

            // Check if the avatar has reached the daily post limit
            if (this.postsToday >= this.dailyPostLimit) {
                console.log(`⚠️ Daily post limit reached for ${avatar.name}. Skipping post.`);
                this.rateLimitReached = true;
                return;
            }

            
            const response = await postX({ text: postText }, '', null);
            console.log(`📤 Posted as ${avatar.name}: "${postText}"`);


            // Update task as completed
            await tasksCollection.updateOne(
                { _id: task._id },
                { 
                    $set: { 
                        status: 'completed', 
                        response: postText, // Store the tweet chunks as the response
                        completedAt: new Date() 
                    } 
                }
            );

        } catch (error) {
            console.error('Error processing task:', error);
            // Attempt to mark the task as failed
            if (error.taskId) {
                await tasksCollection.updateOne(
                    { _id: error.taskId },
                    { 
                        $set: { 
                            status: 'failed', 
                            error: error.message, 
                            failedAt: new Date() 
                        } 
                    }
                );
            }
        }
    }

    /**
     * Resets the daily post count if a new day has started.
     */
    resetDailyCountIfNeeded() {
        const currentDate = this.getCurrentDate();
        if (this.lastPostDate !== currentDate) {
            this.postsToday = 0;
            this.lastPostDate = currentDate;
            this.rateLimitReached = false;
            console.log('Daily post count reset.');
        }
    }
}

// Instantiate and start the XModule
const xModule = new XModule();
xModule.startMonitoring();

// Graceful shutdown handling
process.on('SIGINT', () => {
    console.log('Received SIGINT. Shutting down gracefully...');
    xModule.stopMonitoring();
    process.exit();
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Shutting down gracefully...');
    xModule.stopMonitoring();
    process.exit();
});

export default XModule;
