const path = require('path');

//required modules and stuffs
const express = require("express");
const crypto = require("crypto");
const http = require("http");
const sanitizeHtml = require('sanitize-html');
const app = express();
const {Server} = require("socket.io");
const server = http.createServer(app);
const io = new Server(server);
const disconnectTimers = new Map(); //For handling network dropoff disconnects

const PORT = process.env.PORT || 3000;

app.get('/sitemap.xml', (req, res) => {
  console.log('[SITEMAP] Custom /sitemap.xml route hit');
  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});



app.use(express.static("public"));
app.use(express.json());



//database require
const db = require("./database");

//function to generate the room code
function generateRoomCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code;
  const stmt = db.prepare("SELECT 1 FROM rooms WHERE code = ?");

  do {
    code = Array.from({ length: 5 }, () =>
      letters[Math.floor(Math.random() * letters.length)]
    ).join("");
  } while (stmt.get(code));

  return code;
}



app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/room/:roomCode", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "room.html"));
});

app.get("/solo-scramble", (req, res) => {
  const scramble = generateRandomStateScramble();
  console.log(`[SOLO SCRAMBLE] Sent: ${scramble}`);
  res.json({ scramble });
});



//io.on connection stuff
io.on("connection", (socket) => {
    console.log("[SOCKET] New connection:", socket.id);

    //createRoom handler
    socket.on("createRoom", ({nickname, scramble}) => {
      //sanitize tf outta nicknames
      const cleanName = sanitizeHtml(nickname || "", { allowedTags: [], allowedAttributes: {} }).trim();
      if (!cleanName || cleanName.toLowerCase() === "unnamed") {
        socket.emit("errorJoin", "Invalid nickname.");
        return;
      }

      const roomCode = generateRoomCode();
      const token = crypto.randomUUID().replace(/-/g, "");
      const finalScramble = scramble || "Couldn't fetch scramble";

      db.prepare(`INSERT INTO rooms (code, leader, scramble, created_at) VALUES (?, ?, ?, ?)`)
        .run(roomCode, token, finalScramble, Date.now());

      db.prepare(`INSERT INTO players (token, room_code, name) VALUES (?, ?, ?)`)
        .run(token, roomCode, cleanName);

      console.log(`[ROOM CREATED] ${roomCode} by ${cleanName} (${token})`);
      socket.emit("roomCreated", {roomCode, token});
    });

    //leader requests next scramble
    socket.on("requestNextScramble", ({roomCode, token, scramble}) => {
      //rate limiting this too
      const now = Date.now();
      if (socket.data.lastScramble && now - socket.data.lastScramble < 1000) return;
      socket.data.lastScramble = now;

      const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(roomCode);
      if (!room || room.leader !== token || !scramble) return;

      db.prepare("UPDATE rooms SET scramble = ? WHERE code = ?").run(scramble, roomCode);
      io.to(roomCode).emit("scrambleUpdated", scramble);
    });

    //joinRoom handler
    socket.on("joinRoom", ({roomCode, nickname, token}) => {

      //Sanitizing nicknames too now
      const cleanName = sanitizeHtml(nickname || "", { allowedTags: [], allowedAttributes: {} }).trim();
      
      if (!cleanName || cleanName === "" || cleanName.toLowerCase() === "unnamed") {
        socket.emit("errorJoin", "Invalid nickname. Please choose a name.");
        console.warn(`[SECURITY] Blocked attempt to join with invalid nickname: "${nickname}"`);
        return;
      }
      
      const room = db.prepare(`SELECT * FROM rooms WHERE code = ?`).get(roomCode);
      if (!room) {
        socket.emit("errorJoin", "Room not found");
        return;
      }

      const player = db.prepare(`SELECT * FROM players WHERE token = ?`).get(token);
      if (!player) {
        db.prepare(`INSERT INTO players (token, room_code, name) VALUES (?, ?, ?)`)
          .run(token, roomCode, cleanName);
      } else {
        db.prepare(`UPDATE players SET room_code = ?, name = ? WHERE token = ?`)
          .run(roomCode, cleanName, token);
      }

      //cancel pending discons
      if (disconnectTimers.has(token)) {
        clearTimeout(disconnectTimers.get(token));
        disconnectTimers.delete(token);
        console.log(`[SERVER] Cancelled disconnect timer for ${cleanName} (${token})`);
      }

      const players = db.prepare(`SELECT token, name FROM players WHERE room_code = ?`).all(roomCode);
      const playerMap = Object.fromEntries(players.map(p => [p.token, p.name]));

      socket.join(roomCode);
      console.log(`Socket ${socket.id} (${cleanName}) joined room ${roomCode}`);

      socket.data.roomCode = roomCode;
      socket.data.token = token;
      socket.data.nickname = cleanName;

      socket.emit("roomJoined", {
        scramble: room.scramble,
        token,
        leader: room.leader,
        players: playerMap
      });

      const chatHistory = db.prepare(`
        SELECT name, message, timestamp, 'user' as type FROM chat
        WHERE room_code = ? ORDER BY timestamp ASC LIMIT 100
      `).all(roomCode);

      socket.emit("chatHistory", chatHistory);

      io.to(roomCode).emit("chatMessage", {
        name: "Carl",
        message: `${cleanName} joined the room! Say hi!`,
        type: "system"
      });
    });

    //submission handler
    socket.on("submitSolve", ({ roomCode, token, time, scramble, penalty }) => {
      // SECURITY: Rate Limiting (Max 1 solve per 0.5 seconds)
      const now = Date.now();
      if (socket.data.lastSolve && now - socket.data.lastSolve < 500) return;
      socket.data.lastSolve = now;

      const player = db.prepare("SELECT * FROM players WHERE token = ? AND room_code = ?").get(token, roomCode);
      if (!player || !scramble || typeof scramble !== 'string') return;

      //validate penalties
      const validPenalties = [null, "+2", "DNF"];
      if (!validPenalties.includes(penalty)) {
        console.warn(`[SECURITY] Invalid penalty payload from ${token}`);
        return;
      }

      //check bounds to protect from spoofing
      const isDNF = time === "DNF" || penalty === "DNF";
      const submittedTime = isDNF ? null : parseFloat(time);

      if (!isDNF) {
        if (isNaN(submittedTime) || submittedTime < 0.1 || submittedTime > 86400) {
          console.warn(`[SECURITY] Spoofed/Invalid time rejected: ${time}s`);
          return; 
        }
      }

      const trimmedScramble = scramble.trim();
      const existing = db.prepare("SELECT 1 FROM solves WHERE token = ? AND scramble = ?").get(token, trimmedScramble);
      if (existing) return;

      db.prepare(`
        INSERT INTO solves (token, scramble, time, penalty, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(token, trimmedScramble, submittedTime, penalty, Date.now());

      const top10 = db.prepare(`
        SELECT players.name, solves.time, solves.penalty
        FROM solves
        JOIN players ON solves.token = players.token
        WHERE solves.scramble = ? AND (solves.penalty IS NULL OR solves.penalty != 'DNF')
        ORDER BY solves.time ASC
        LIMIT 10
      `).all(trimmedScramble);

      io.to(roomCode).emit("leaderboardUpdate", top10);
    });


    //penalty handler
    socket.on("applyPenalty", ({ roomCode, token, scramble, penalty }) => {
      const player = db.prepare("SELECT * FROM players WHERE token = ? AND room_code = ?").get(token, roomCode);
      if (!player || !scramble || typeof scramble !== 'string') return;

      //validating penalties just in case
      const validPenalties = [null, "+2", "DNF"];
      if (!validPenalties.includes(penalty)) return;

      const trimmedScramble = scramble.trim();
      const solve = db.prepare(`SELECT * FROM solves WHERE token = ? AND scramble = ?`).get(token, trimmedScramble);
      if (!solve) return;

      let updatedTime = solve.time;
      let updatedPenalty = penalty;

      if (penalty === "+2") {
        if (solve.penalty === "DNF" || solve.time === null) return;
        updatedTime += 2.00;
      } else if (penalty === "DNF") {
        updatedTime = null;
      }

      db.prepare(`UPDATE solves SET time = ?, penalty = ? WHERE id = ?`).run(updatedTime, updatedPenalty, solve.id);

      const top10 = db.prepare(`
        SELECT players.name, solves.time, solves.penalty
        FROM solves
        JOIN players ON solves.token = players.token
        WHERE solves.scramble = ? AND (solves.penalty IS NULL OR solves.penalty != 'DNF')
        ORDER BY solves.time ASC
        LIMIT 10
      `).all(trimmedScramble);

      io.to(roomCode).emit("leaderboardUpdate", top10);
    });


    //disconnect handler
    socket.on("disconnect", () => {
      const roomCode = socket.data.roomCode;
      const token = socket.data.token;
      const nickname = socket.data.nickname;

      if (!roomCode || !token) return;

      const timer = setTimeout(() => {
        db.prepare("DELETE FROM players WHERE token = ? AND room_code = ?").run(token, roomCode);
        io.to(roomCode).emit("chatMessage", { name: "Carl", message: `${nickname} left the room :(`, type: "system" });

        const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(roomCode);
        if (room && room.leader === token) {
          const remainingPlayers = db.prepare("SELECT token, name FROM players WHERE room_code = ?").all(roomCode);
          if (remainingPlayers.length > 0) {
            const newLeader = remainingPlayers[0];
            db.prepare("UPDATE rooms SET leader = ? WHERE code = ?").run(newLeader.token, roomCode);
            io.to(roomCode).emit("chatMessage", { name: "Carl", message: `${newLeader.name} is the new leader!`, type: "system" });
            io.to(roomCode).emit("leaderChanged", { newLeaderToken: newLeader.token, newLeaderName: newLeader.name });
          } else {
            db.prepare("UPDATE rooms SET leader = NULL WHERE code = ?").run(roomCode);
          }
        }

        const remaining = db.prepare("SELECT COUNT(*) AS count FROM players WHERE room_code = ?").get(roomCode);
        if (remaining.count === 0) {
          db.prepare("DELETE FROM rooms WHERE code = ?").run(roomCode);
        }
        disconnectTimers.delete(token);
      }, 10000); 

      disconnectTimers.set(token, timer);
    });

    //chat handler
    socket.on("chatMessage", ({ token, message }) => {
      //rate limiting the messages to avoid spam
      const now = Date.now();
      if (socket.data.lastChat && now - socket.data.lastChat < 500) return;
      socket.data.lastChat = now;

      const player = db.prepare("SELECT name FROM players WHERE token = ?").get(token);
      if (!player) return;

      const sanitizedMessage = sanitizeHtml(message, {
        allowedTags: [],
        allowedAttributes: {},
        allowedSchemes: ['http', 'https'],
        transformTags: { '*': sanitizeHtml.simpleText }
      });

      db.prepare(`INSERT INTO chat (room_code, name, message, timestamp) VALUES (?, ?, ?, ?)`)
        .run(socket.data.roomCode, player.name, sanitizedMessage, Date.now());

      io.to(socket.data.roomCode).emit("chatMessage", {
        name: player.name,
        message: sanitizedMessage
      });
    });
});

server.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});
