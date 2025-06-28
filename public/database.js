const Database = require("better-sqlite3");
const db = new Database("timer.db");

//creating da tables
db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
        code TEXT PRIMARY KEY,
        leader TEXT,
        scramble TEXT,
        created_at INTEGER
    );
        
    CREATE TABLE IF NOT EXISTS players (
        token TEXT PRIMARY KEY,
        room_code TEXT,
        name TEXT,
        FOREIGN KEY (room_code) REFERENCES rooms(code)    
    );    

    CREATE TABLE IF NOT EXISTS solves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT,
        scramble TEXT,
        time REAL,
        penalty TEXT,
        timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS chat (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_code TEXT,
        name TEXT,
        message TEXT,
        timestamp INTEGER
    );
`)

module.exports = db;