import { MongoClient } from 'mongodb';

// MongoDB URI and Database Name
const mongoURI = process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017';
const dbName = 'cosyworld';

// Create a new MongoClient
const client = new MongoClient(mongoURI);

// Global variable to store the database connection
let db;

// Connect to MongoDB
async function connectToMongoDB() {
    try {
        await client.connect();
        db = client.db(dbName);

        console.log('MongoDB connected');
    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        throw err;
    }
}

// Call this function at the start of your application
await connectToMongoDB();

export { db };