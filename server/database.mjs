import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017';
const DB_NAME = 'cosyworld';

let client;
let db;

async function connectToDB() {
    if (db) {
        console.warn('🚪 Already connected to MongoDB');
        return db;
    }

    try {
        if (!client || !client.isConnected()) {
            client = new MongoClient(MONGO_URI, {
                ssl: true,
                tls: true,
                tlsAllowInvalidCertificates: false,
                serverSelectionTimeoutMS: 5000 // Timeout after 5 seconds if no server is found
            });
            await client.connect();
            console.log('🎉 Connected to MongoDB');
        }
        db = client.db(DB_NAME);
        return db;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        if (client) {
            await client.close(); // Ensure the client is closed if an error occurs
        }
        client = null; // Reset the client instance
        throw error;
    }
}

export { connectToDB };
