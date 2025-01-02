print("Running initialization script...");

// Initialize the 'musicgame' database
db = db.getSiblingDB('musicgame');

// Drop and recreate the 'songs' collection
db.songs.drop();
db.createCollection('songs');

// Insert song data into the 'songs' collection
// Insert song and artist data into the 'songs' collection
db.songs.insertMany([
    { songNumber: 1, mp3_filename: 'song1.mp3', song_name: 'Beautiful Day', artist_name: 'U2' },
    { songNumber: 2, mp3_filename: 'song2.mp3', song_name: 'Shivers', artist_name: 'Ed Sheeran' },
    { songNumber: 3, mp3_filename: 'song3.mp3', song_name: 'Take Your Mama', artist_name: 'Scissor Sisters' },
    { songNumber: 4, mp3_filename: 'song4.mp3', song_name: 'Vampire', artist_name: 'Olivia Rodrigo' },
    { songNumber: 5, mp3_filename: 'song5.mp3', song_name: 'Try', artist_name: 'Pink' },
    { songNumber: 6, mp3_filename: 'song6.mp3', song_name: 'Enjoy the Silence', artist_name: 'Depeche Mode' },
    { songNumber: 7, mp3_filename: 'song7.mp3', song_name: 'About Damn Time', artist_name: 'Lizzo' },
    { songNumber: 8, mp3_filename: 'song8.mp3', song_name: 'Sabotage', artist_name: 'Beastie Boys' },
    { songNumber: 9, mp3_filename: 'song9.mp3', song_name: 'Believe', artist_name: 'Cher' },
    { songNumber: 10, mp3_filename: 'song10.mp3', song_name: 'Blinding Lights', artist_name: 'The Weekend' }
]);

// Drop and recreate the 'players' collection, starting with empty data
db.players.drop();
db.createCollection('players');

// Example of a test player with initial stats (optional)
db.players.insertOne({
    playerName: 'Test Player',
    guesses: 0,
    correctGuesses: 0,
    results: [],
    timestamp: new Date()
});

// The 'players' collection will remain empty and will expand as players participate

print("Database initialization complete.");
