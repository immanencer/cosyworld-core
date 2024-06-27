import { MongoClient } from 'mongodb';

const MONGO_URI = 'mongodb://localhost:27017'; // Update with your MongoDB URI
const DB_NAME = 'cosyworld';

let db;

async function connectToDB() {
    try {
        const client = new MongoClient(MONGO_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('🎉 Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

export { db, connectToDB };