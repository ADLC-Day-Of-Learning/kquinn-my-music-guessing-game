const { MongoClient } = require('mongodb');

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017'; // Use environment variable or default to localhost
const dbName = process.env.DB_NAME || 'musicgame'; // Use environment variable or default to 'musicgame'

async function testConnection() {
    let client;

    try {
        client = await MongoClient.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
        const db = client.db(dbName);

        // Perform a simple query to test the connection
        const result = await db.command({ ping: 1 });
        console.log('MongoDB connection successful:', result);

    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1); // Exit with an error code
    } finally {
        if (client) {
            await client.close();
        }
    }
}

testConnection();
