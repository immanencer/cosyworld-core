import { MongoClient } from 'mongodb';

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'moonstone';

const options = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    retryWrites: true,
    retryReads: true
};

let client = null;
let db = null;
let isConnecting = false;
let connectionPromise = null;

async function connect() {
    if (isConnecting) return connectionPromise;
    if (client?.topology?.isConnected()) return client;

    isConnecting = true;
    connectionPromise = new Promise(async (resolve, reject) => {
        try {
            client = new MongoClient(mongoURI, options);
            await client.connect();
            db = client.db(dbName);
            
            client.on('error', (error) => {
                console.error('MongoDB connection error:', error);
                reconnect();
            });

            client.on('timeout', () => {
                console.error('MongoDB connection timeout');
                reconnect();
            });

            console.log('MongoDB connected successfully');
            resolve(client);
        } catch (err) {
            console.error('Error connecting to MongoDB:', err);
            reject(err);
        } finally {
            isConnecting = false;
        }
    });

    return connectionPromise;
}

async function reconnect() {
    try {
        if (client) {
            await client.close();
            client = null;
            db = null;
        }
        await connect();
    } catch (error) {
        console.error('Error reconnecting to MongoDB:', error);
    }
}

async function getDb() {
    if (!client || !client.topology?.isConnected()) {
        await connect();
    }
    return db;
}

const connectPromise = connect();

process.on('SIGINT', async () => {
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
        process.exit(0);
    }
});

export { getDb, client, connectPromise, db };