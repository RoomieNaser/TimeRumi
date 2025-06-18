// Importing modules
const express = require('express');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Global scramble
let currentScramble = 'No scramble yet';

// Middleware
app.use(cors({ origin: 'https://cstimer.net' }));
app.use(express.json());
app.use('/overlay', express.static('overlay'));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to database
const db = new Database('./solves.db');
console.log('WE IN THE SQLITE DATABASE BABYYYY!!!');

// Create table
db.prepare(`
    CREATE TABLE IF NOT EXISTS solves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        time REAL NOT NULL,
        scramble TEXT NOT NULL,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(name, scramble)
    )
`).run();

// Rate limiter
const limiter = rateLimit({
    windowMs: 10 * 1000,
    max: 3,
    message: { error: "Too many submissions dawg watchu doin huh" }
});
app.use('/submit', limiter);

// Scramble routes
app.get('/scramble', (req, res) => {
    res.json({ scramble: currentScramble });
});

app.post('/scramble', (req, res) => {
    currentScramble = req.body.scramble;
    res.json({ message: 'Scramble updated!' });
});

// Submit solve
app.post('/submit', (req, res) => {
    const { name, time } = req.body;
    if (!name || !time) {
        return res.status(400).json({ error: "NAME AND TIME REQUIRED!!! PLSSS" });
    }

    try {
        const stmt = db.prepare(`INSERT INTO solves (name, time, scramble) VALUES (?, ?, ?)`);
        const info = stmt.run(name, time, currentScramble);

        console.log(`[SUBMIT] ${name} - ${time}s for scramble: ${currentScramble}`);

        // Trim to last 100 solves
        db.prepare(`
            DELETE FROM solves
            WHERE id NOT IN (
                SELECT id FROM solves
                ORDER BY id DESC
                LIMIT 100
            )
        `).run();

        res.json({ message: "Time submitted!", id: info.lastInsertRowid });
    } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: "you've already submitted dumbo :P" });
        }
        return res.status(500).json({ error: err.message });
    }
});

// Leaderboard route
app.get('/leaderboard', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT name, time FROM solves
            WHERE scramble = ?
            ORDER BY time ASC
            LIMIT 5
        `);
        const top5 = stmt.all(currentScramble);
        res.json({ top5 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
