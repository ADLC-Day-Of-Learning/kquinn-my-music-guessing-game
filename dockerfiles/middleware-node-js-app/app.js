const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { MongoClient } = require('mongodb');

// Create an Express application
const app = express();
const port = process.env.PORT || 3000; // Use PORT environment variable or default to 3000

// Middleware to parse incoming JSON requests
app.use(bodyParser.json());

// Allow all origins (CORS policy for open access)
app.use(cors({
    origin: '*',  // This allows all origins
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

// MongoDB connection URL and database name
const mongoUrl = process.env.MONGO_URL || 'mongodb://mongodb-service:27017';
const dbName = process.env.DB_NAME || 'musicgame';

let dbClient;
let db;

// Function to connect to MongoDB
async function connectToDatabase(retries = 5, delay = 2000) {
    while (retries > 0) {
        try {
            // Check if the client is already connected
            if (!dbClient || !dbClient.topology?.isConnected()) {
                console.log('Connecting to MongoDB...');
                dbClient = new MongoClient(mongoUrl, {
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    maxPoolSize: 10, // Maximum number of connections in the pool
                    minPoolSize: 2,  // Minimum number of connections in the pool
                    connectTimeoutMS: 30000, // Connection timeout in milliseconds
                    socketTimeoutMS: 45000  // Socket timeout in milliseconds
                });
                await dbClient.connect();
                db = dbClient.db(dbName);
                console.log("MongoDB connected successfully.");
            }
            return; // Connection successful, return from the function
        } catch (error) {
            console.error('MongoDB connection error:', error);
            retries--;
            console.log(`Retries left: ${retries}. Retrying in ${delay}ms...`);
            await new Promise(res => setTimeout(res, delay)); // Wait before retrying
        }
    }
    throw new Error('Database connection failed after multiple attempts');
}

// Add a /config route to serve backend configuration for the frontend
app.get('/config', (req, res) => {
    console.log('Config endpoint hit.');
    res.json({
        backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
        allowedOrigins: process.env.ALLOWED_ORIGINS || ''
    });
});

// POST route to handle guesses from the frontend
app.post('/submit-guesses', async (req, res) => {
    const { playerName, guesses } = req.body; // Now we accept playerName and an array of guesses
    console.log('Received guesses request:', { playerName, guesses });

    // Validate input
    if (!playerName || !guesses || !Array.isArray(guesses) || guesses.length === 0) {
        console.log('Invalid input:', { playerName, guesses });
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        // Attempt to connect to the database
        await connectToDatabase();
        console.log('Connected to the database successfully.');

        const songsCollection = db.collection('songs');
        const playersCollection = db.collection('players');

        let results = []; // To store results of each guess
        let correctCount = 0; // Counter for correct guesses

        // Loop through each guess and check if it's correct
        for (let guessData of guesses) {
            const { songFile, guess } = guessData; // Extract songFile and guess from the request
            const mp3_filename = `${songFile}.mp3`; // Construct the expected mp3 filename

            console.log(`Checking guess for song: ${mp3_filename}`);

            const song = await songsCollection.findOne({ mp3_filename: mp3_filename });

            if (!song) {
                console.log('Song not found:', mp3_filename);
                results.push({
                    songFile: songFile,
                    guess: guess,
                    correct: false,
                    correctAnswer: 'Song not found'
                });
            } else {
                const isCorrect = song.song_name.toLowerCase() === guess.toLowerCase();
                if (isCorrect) correctCount++; // Increment correct count for tracking
                results.push({
                    songFile: songFile,
                    guess: guess,
                    correct: isCorrect,
                    correctAnswer: song.song_name
                });
                console.log(`Guess for ${songFile} is ${isCorrect ? 'correct' : 'incorrect'}.`);
            }
        }

        // Log results before sending the response
        console.log('Results of guesses:', results);
        console.log(`Total correct guesses: ${correctCount}`);

        // Update or insert player statistics in the players collection
        await playersCollection.updateOne(
            { playerName: playerName },
            { 
                $inc: { 
                    guesses: guesses.length, 
                    correctGuesses: correctCount 
                }, 
                $set: { 
                    results: results, 
                    timestamp: new Date() 
                } 
            },
            { upsert: true } // Create new entry if player doesn't exist
        );

        // Send back results to the frontend
        res.json({
            message: `Results for player ${playerName}`,
            correctGuesses: correctCount,
            correctAnswers: results.filter(result => result.correct).map(result => result.correctAnswer),
            details: results // Optionally include detailed results for each guess
        });

    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        if (dbClient) {
            // Close the database connection if it was created in this request
            await dbClient.close();
        }
    }
});

// Test route to check MongoDB connectivity
app.get('/test-db', async (req, res) => {
    console.log('Test DB endpoint hit.');
    try {
        await connectToDatabase();
        const collection = db.collection('songs');
        const document = await collection.findOne({});
        res.status(200).json({ success: true, document });
    } catch (error) {
        console.error('MongoDB connection error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Middleware to log frontend URL from Referer header
app.use((req, res, next) => {
    const referer = req.get('Referer');
    if (referer) {
        const frontendUrl = new URL(referer).origin;
        console.log(`Frontend URL determined from referer: ${frontendUrl}`);
    }
    next();
});

// Start the backend server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
