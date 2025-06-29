//required modules and stuffs
const express = require("express");
const scrambler = require("cube-scrambler")();
const crypto = require("crypto");
const http = require("http");
const app = express();
const {Server} = require("socket.io");
const path = require("path");
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

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


//io.on connection stuff
io.on("connection", (socket) => {
    console.log("[SOCKET] New connection:", socket.id);

    //create room handler
    socket.on("createRoom", ({nickname}) => {
      const roomCode = generateRoomCode();
      const token = crypto.randomUUID().replace(/-/g, "");
      const scramble = scrambler.scramble().join (" ");

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


      const newScramble = scrambler.scramble().join(" ");
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

    socket.on("submitSolve", ({ roomCode, token, time, scramble }) => {
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
      db.prepare(`
        INSERT INTO solves (token, scramble, time, penalty, timestamp)
        VALUES (?, ?, ?, '', ?)
      `).run(token, trimmedScramble, parseFloat(time), Date.now());

      // Get top 10 valid solves for this scramble
      const top10 = db.prepare(`
        SELECT players.name, solves.time
        FROM solves
        JOIN players ON solves.token = players.token
        WHERE solves.scramble = ? AND solves.time IS NOT NULL
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

      if (penalty === "+2") {
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
        SELECT players.name, solves.time
        FROM solves
        JOIN players ON solves.token = players.token
        WHERE solves.scramble = ? AND solves.time IS NOT NULL
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
      const player = db.prepare(`
        SELECT players.name, players.room_code 
        FROM players 
        WHERE token = ?
      `).get(token);

      if (!player) {
        console.log("[SERVER] Chat message ignored - no matching player found in DB.");
        return;
      }

      const { name, room_code: roomCode } = player;

      // Save message to DB
      db.prepare(`
        INSERT INTO chat (room_code, name, message, timestamp)
        VALUES (?, ?, ?, ?)
      `).run(roomCode, name, message, Date.now());

      // Broadcast to room
      console.log(`[SERVER] Broadcasting message from ${name} in room ${roomCode}`);
      io.to(roomCode).emit("chatMessage", { name, message });
    });


  });

server.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
});
