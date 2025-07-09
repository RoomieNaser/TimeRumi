const path = require('path');

//required modules and stuffs
const express = require("express");
const scrambler = require("cube-scrambler")();
//switching to a state scrambler
const Cube = require("cubejs");
Cube.initSolver();
const crypto = require("crypto");
const http = require("http");
const sanitizeHtml = require('sanitize-html');
const app = express();
const {Server} = require("socket.io");
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'public', 'sitemap.xml'));
});


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

function generateRandomStateScramble() {
  const scrambleMoves = scrambler.scramble(); //needed to use scrambler anyway lmao
  const cube = Cube.fromString("UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB");

  scrambleMoves.forEach(move => cube.move(move));

  const solution = cube.solve(); 

  const reversed = solution
    .split(" ")
    .reverse()
    .map(move => {
      if (move.endsWith("'")) return move.slice(0, -1);
      if (move.endsWith("2")) return move;
      return move + "'";
    });

  return reversed.join(" ");
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

    //create room handler
    socket.on("createRoom", ({nickname}) => {
      const roomCode = generateRoomCode();
      const token = crypto.randomUUID().replace(/-/g, "");
      const scramble = generateRandomStateScramble();

      db.prepare(`INSERT INTO rooms (code, leader, scramble, created_at) VALUES (?, ?, ?, ?)`)
        .run(roomCode, token, scramble, Date.now());

      db.prepare(`INSERT INTO players (token, room_code, name) VALUES (?, ?, ?)`)
        .run(token, roomCode, nickname);

      console.log(`[ROOM CREATED] ${roomCode} by ${nickname} (${token})`);
      socket.emit("roomCreated", {roomCode, token});
    });

     //leader requests new scramble - boom epic new scramble
    socket.on("requestNextScramble", ({roomCode, token}) => {
      const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(roomCode);
      if (!room) return;
      if (room.leader !== token) return;


      const newScramble = generateRandomStateScramble();
      db.prepare("UPDATE rooms SET scramble = ? WHERE code = ?").run(newScramble, roomCode);
      io.to(roomCode).emit("scrambleUpdated", newScramble);
    });

    //joinRoom handler
    socket.on("joinRoom", ({roomCode, nickname, token}) => {
      console.log("[SERVER] joinRoom received:", {roomCode, nickname, token});
      
      const room = db.prepare(`SELECT * FROM rooms WHERE code = ?`).get(roomCode);
      if (!room) {
        socket.emit("errorJoin", "Room not found");
        return;
      }

      const player = db.prepare(`SELECT * FROM players WHERE token = ?`).get(token);
      if (!player) {
        db.prepare(`INSERT INTO players (token, room_code, name) VALUES (?, ?, ?)`)
          .run(token, roomCode, nickname);
      }

      const players = db.prepare(`SELECT token, name FROM players WHERE room_code = ?`).all(roomCode);
      const playerMap = Object.fromEntries(players.map(p => [p.token, p.name]));

      socket.join(roomCode);
      console.log(`Socket ${socket.id} (${nickname}) joined room ${roomCode} as token: ${token}`);
      console.log("[SERVER] Emitting roomJoined with scramble:", room.scramble);

      socket.data.roomCode = roomCode;
      socket.data.token = token;
      socket.data.nickname = nickname;

      socket.emit("roomJoined", {
        scramble: room.scramble,
        token,
        leader: room.leader,
        players: playerMap
      });

      // Fetch last 50 chat messages (or however many you want)
      const chatHistory = db.prepare(`
        SELECT name, message, timestamp, 'user' as type FROM chat
        WHERE room_code = ?
        ORDER BY timestamp ASC
        LIMIT 100
      `).all(roomCode);

      // Send to the newly joined user only
      socket.emit("chatHistory", chatHistory);


      io.to(roomCode).emit("chatMessage", {
        name: "Carl",
        message: `${nickname} joined the room! Say hi!`,
        type: "system"
      });
    });

    socket.on("submitSolve", ({ roomCode, token, time, scramble, penalty }) => {
      const player = db.prepare("SELECT * FROM players WHERE token = ? AND room_code = ?").get(token, roomCode);
      if (!player) return;

      if (!scramble || typeof scramble !== 'string') {
        console.log("Solve ignored: invalid scramble.");
        return;
      }

      const trimmedScramble = scramble.trim();

      // Prevent duplicate submissions for the same scramble
      const existing = db.prepare("SELECT 1 FROM solves WHERE token = ? AND scramble = ?").get(token, trimmedScramble);
      if (existing) return;

      // Insert the new solve
      const isDNF = time === "DNF" || penalty === "DNF";
      const submittedTime = isDNF ? null : parseFloat(time);
      const submittedPenalty = isDNF ? "DNF" : penalty;

      db.prepare(`
        INSERT INTO solves (token, scramble, time, penalty, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(token, trimmedScramble, submittedTime, submittedPenalty, Date.now());

      // Get top 10 valid solves for this scramble
      const top10 = db.prepare(`
        SELECT players.name, solves.time
        FROM solves
        JOIN players ON solves.token = players.token
        WHERE solves.scramble = ? AND (solves.penalty IS NULL OR solves.penalty != 'DNF')
        ORDER BY solves.time ASC
        LIMIT 10
      `).all(trimmedScramble);

      io.to(roomCode).emit("leaderboardUpdate", top10);
    });

    socket.on("applyPenalty", ({ roomCode, token, scramble, penalty }) => {
      const player = db.prepare("SELECT * FROM players WHERE token = ? AND room_code = ?").get(token, roomCode);
      if (!player) {
        console.log("Penalty ignored: player not found.");
        return;
      }

      if (!scramble || typeof scramble !== 'string') {
        console.log("Penalty ignored: invalid scramble.");
        return;
      }
      const trimmedScramble = scramble.trim();


      // Check if solve exists
      const solve = db.prepare(`
        SELECT * FROM solves
        WHERE token = ? AND scramble = ?
      `).get(token, trimmedScramble);

      if (!solve) {
        console.log("Penalty ignored: solve not found.");
        return;
      }

      let updatedTime = solve.time;
      let updatedPenalty = penalty;

      // Prevent +2 being applied to a DNF solve
      if (penalty === "+2") {
        if (solve.penalty === "DNF" || solve.time === null) {
          console.log("Cannot apply +2 to a DNF solve. Ignored.");
          return;
        }
        updatedTime += 2.00;
      } else if (penalty === "DNF") {
        updatedTime = null;
}


      // Update the solve with penalty and adjusted time
      db.prepare(`
        UPDATE solves
        SET time = ?, penalty = ?
        WHERE id = ?
      `).run(updatedTime, updatedPenalty, solve.id);

      // Fetch updated top 10 leaderboard
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

      if (!roomCode || !token) {
        console.log("[SOCKET] Disconnected (no room data):", socket.id);
        return;
      }

      // Remove the player from DB
      db.prepare("DELETE FROM players WHERE token = ? AND room_code = ?").run(token, roomCode);

      io.to(roomCode).emit("chatMessage", {
        name: "Carl",
        message: `${nickname} left the room :(`,
        type: "system"
      });

      // leader change stuffs (pain in the ass)
      const room = db.prepare("SELECT * FROM rooms WHERE code = ?").get(roomCode);
      if (room && room.leader === token) {
        const remainingPlayers = db.prepare("SELECT token, name FROM players WHERE room_code = ?").all(roomCode);

        if (remainingPlayers.length > 0) {
          const newLeader = remainingPlayers[0];
          db.prepare("UPDATE rooms SET leader = ? WHERE code = ?").run(newLeader.token, roomCode);

          io.to(roomCode).emit("chatMessage", {
            name: "Carl",
            message: `${newLeader.name} is the new leader!`,
            type: "system"
          });

          io.to(roomCode).emit("leaderChanged", {
            newLeaderToken: newLeader.token,
            newLeaderName: newLeader.name
          });
        } else {
          // No players left, set leader to null for now (we'll delete room below)
          db.prepare("UPDATE rooms SET leader = NULL WHERE code = ?").run(roomCode);
        }
      }

      // Room auto deletion
      const remaining = db.prepare("SELECT COUNT(*) AS count FROM players WHERE room_code = ?").get(roomCode);
      if (remaining.count === 0) {
        db.prepare("DELETE FROM rooms WHERE code = ?").run(roomCode);
        console.log(`[CARL] Deleted empty room: ${roomCode}`);
      }
    });




    socket.on("chatMessage", ({ token, message }) => {
      console.log("[SERVER] Received chatMessage:", { token, message });

      // Lookup player info
      const player = db.prepare("SELECT name FROM players WHERE token = ?").get(token);
      if (!player) return;

      // Sanitize the message to prevent XSS
      const sanitizedMessage = sanitizeHtml(message, {
        allowedTags: [], // No HTML tags allowed
        allowedAttributes: {},
        allowedSchemes: ['http', 'https'],
        transformTags: {
          '*': sanitizeHtml.simpleText
        }
      });

      // Store sanitized message in database
      db.prepare(`INSERT INTO chat (room_code, name, message, timestamp) VALUES (?, ?, ?, ?)`)
        .run(socket.data.roomCode, player.name, sanitizedMessage, Date.now());

      // Broadcast sanitized message to all clients in the room
      io.to(socket.data.roomCode).emit("chatMessage", {
        name: player.name,
        message: sanitizedMessage
      });
    });
  });

server.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});
