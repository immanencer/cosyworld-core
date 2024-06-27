import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017';
const DB_NAME = 'cosyworld';

let db;

async function connectToDB() {
    try {
        const client = new MongoClient(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: false
        });
        await client.connect();
        db = client.db(DB_NAME);
        console.log('🎉 Connected to MongoDB');
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        throw error;
    }
}

export { db, connectToDB };