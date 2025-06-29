console.log("[roomLogic.js] Loaded!");
console.log("Location path:", window.location.pathname);

function triggerBlobAnimation() {
  document.body.classList.remove("loaded");
  requestAnimationFrame(() => {
    document.body.classList.add("loaded");
  });
}
window.addEventListener("load", triggerBlobAnimation);

// DOM elements
const scrambleDisplay = document.getElementById("scramble");
const nextScrambleBtn = document.getElementById("nextScrambleBtn");
const copyCodeDisplay = document.getElementById("copyCodeDisplay");
const copyCodeContainer = document.getElementById("copyCode");
const scrambleLabel = document.getElementById("scramble-label");
const timerDisplay = document.getElementById("timerDisplay");
const postSolveOptions = document.getElementById("postSolveOptions");

//Variables for timer
let timer = null;
let startTime = 0;
let running = false;
let readyToStart = false;
let heldSpace = false;
let doneSolving = false;
let currentPenalty = null;
let lastSubmittedScramble = null;

//Solo logic
const soloSolves = [];

function loadSolvesFromStorage() {
  const saved = localStorage.getItem("soloSolves");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        soloSolves.push(...parsed);
      }
    } catch (err) {
      console.error("Failed to load solves from storageee nooo", err);
    }
  }
  updateStatsPanel();
  updateSolveHistory();
}

function saveSolvesToStorage() {
  localStorage.setItem("soloSolves", JSON.stringify(soloSolves));
}


//Solo functions
function onSoloSolveComplete(rawMs) {
  const timeInSec = rawMs / 1000;

  soloSolves.push({
    time: timeInSec,
    dnf: false,
    plusTwo: false,
    timeStamp: Date.now()
  });

  saveSolvesToStorage();

  updateStatsPanel();
  updateSolveHistory();
}

function updateStatsPanel() {
  const lastSolve = soloSolves.at(-1);

  // For display, even if DNF or +2
  document.getElementById('current-time').textContent = lastSolve ? formatSoloTime(lastSolve) : "-";

  // Use only non-DNF solves for calculations
  const validSolves = soloSolves.filter(s => !s.dnf).map(s => s.plusTwo ? s.time + 2 : s.time);

  const mo3 = getMo3(validSolves);
  const ao5 = getAoN(validSolves, 5);
  const ao12 = getAoN(validSolves, 12);
  const mean = getMean(validSolves);
  const bestSingle = Math.min(...validSolves);
  const bestAo5 = getBestAoN(validSolves, 5);
  const bestAo12 = getBestAoN(validSolves, 12);

  document.getElementById('current-mo3').textContent = mo3 !== null ? formatTimeValue(mo3) : "-";
  document.getElementById('current-ao5').textContent = ao5 !== null ? formatTimeValue(ao5) : "-";
  document.getElementById('current-ao12').textContent = ao12 !== null ? formatTimeValue(ao12) : "-";

  document.getElementById('best-single').textContent = isFinite(bestSingle) ? formatTimeValue(bestSingle) : "-";
  document.getElementById('best-ao5').textContent = bestAo5 !== null ? formatTimeValue(bestAo5) : "-";
  document.getElementById('best-ao12').textContent = bestAo12 !== null ? formatTimeValue(bestAo12) : "-";
  document.getElementById('mean').textContent = mean !== null ? formatTimeValue(mean) : "-";

  if (isSolo) {
    document.getElementById("live-ao5").textContent = ao5 !== null ? formatTimeValue(ao5) : "-";
    document.getElementById("live-ao12").textContent = ao12 !== null ? formatTimeValue(ao12) : "-";
  }
  
}

function updateSolveHistory() {
  const tbody = document.getElementById("history-body");
  tbody.innerHTML = "";

  let bestFinalTime = Infinity;
  soloSolves.forEach((solve) => {
    if (!solve.dnf) {
      const final = solve.plusTwo ? solve.time + 2 : solve.time;
      if (final < bestFinalTime) bestFinalTime = final;
    }
  });

  soloSolves.slice().reverse().forEach((solve, reversedIndex) => {
    const tr = document.createElement("tr");

    const actualIndex = soloSolves.length - reversedIndex - 1;
    const finalTime = solve.dnf ? "DNF" : formatTimeValue(solve.plusTwo ? solve.time + 2 : solve.time);
    const ao5 = getAoNAt(soloSolves, 5, actualIndex);
    const ao12 = getAoNAt(soloSolves, 12, actualIndex);

    const currentFinalValue = solve.dnf ? Infinity : (solve.plusTwo ? solve.time + 2 : solve.time);
    if (currentFinalValue === bestFinalTime) {
      tr.classList.add("pb-highlight");
    }

    // Set data-index for future menu operations
    tr.dataset.index = actualIndex;

    tr.innerHTML = `
      <td>${actualIndex + 1}</td>
      <td>${finalTime}</td>
      <td>${ao5 !== null ? formatTimeValue(ao5) : "-"}</td>
      <td>${ao12 !== null ? formatTimeValue(ao12) : "-"}</td>
      <td class="solve-menu-cell">
        <div class="dot-menu">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
        <div class="menu-options hidden">
          <div class="menu-item" data-action="+2">+2</div>
          <div class="menu-item" data-action="dnf">DNF</div>
          <div class="menu-item" data-action="delete">Delete</div>
        </div>
      </td>
    `;

    // Toggle menu visibility
    const dotMenu = tr.querySelector(".dot-menu");
    const menuOptions = tr.querySelector(".menu-options");

    dotMenu.addEventListener("click", () => {
      menuOptions.classList.toggle("hidden");
    });

    // Handle menu item clicks
    tr.querySelectorAll(".menu-item").forEach(item => {
      item.addEventListener("click", () => {
        const action = item.dataset.action;
        handleSolveAction(action, actualIndex);
        menuOptions.classList.add("hidden");
      });
    });

    tbody.appendChild(tr);
  });
}

function generateFallbackScramble() {
  const moves = ["R", "L", "U", "D", "F", "B"];
  const modifiers = ["", "'", "2"];
  let scramble = [];
  let lastMove = "";

  for (let i = 0; i < 20; i++) {
    let move;
    do {
      move = moves[Math.floor(Math.random() * moves.length)];
    } while (move === lastMove);
    lastMove = move;
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    scramble.push(move + modifier);
  }

  return scramble.join(" ");
}


function handleSolveAction(action, index) {
  const solve = soloSolves[index];
  if (!solve) return;

  switch (action) {
    case "+2":
      if (!solve.dnf && !solve.plusTwo) {
        solve.plusTwo = true;
      }
      break;
    case "dnf":
      if (!solve.dnf) {
        solve.dnf = true;
        solve.plusTwo = false; // Remove +2 if DNF is applied
      }
      break;
    case "delete":
      // Animate row removal
      const rows = document.querySelectorAll("#history-body tr");
      const targetRow = Array.from(rows).find(row => Number(row.dataset.index) === index);
      if (targetRow) {
        targetRow.classList.add("revealed"); // triggers CSS animation
        setTimeout(() => {
          soloSolves.splice(index, 1);
          updateSolveHistory();
        }, 300); // match CSS transition duration
      } else {
        // fallback if row not found
        soloSolves.splice(index, 1);
        updateSolveHistory();
      }
      return;
  }

  updateSolveHistory();
}




function clearSoloSolves() {
  const confirmed = confirm("Are you sure you want to delete all solo solves? Your solves will be sad :(");
  if (!confirmed) return;

  soloSolves.length = 0;
  localStorage.removeItem("soloSolves");
  updateStatsPanel();
  updateSolveHistory();
}

document.getElementById("reset-solo-btn")?.addEventListener("click", clearSoloSolves);


function getAoNAt(arr, n, endIndex) {
  // Build up to n valid solves ending at endIndex
  let valid = [];
  for (let i = endIndex; i >= 0 && valid.length < n; i--) {
    const solve = arr[i];
    if (!solve.dnf) {
      valid.unshift(solve.plusTwo ? solve.time + 2 : solve.time);
    }
  }

  if (valid.length < n) return null;

  const sorted = [...valid].sort((a, b) => a - b);
  return getMean(sorted.slice(1, -1));
}




function getMean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function getMo3(arr) {
  if (arr.length < 3) return null;
  const last3 = arr.slice(-3);
  return getMean(last3);
}

function getAoN(arr, n) {
  if (arr.length < n) return null;
  const lastN = arr.slice(-n).sort((a, b) => a - b);
  return getMean(lastN.slice(1, -1));
}

function getBestAoN(arr, n) {
  if (arr.length < n) return null;
  let best = Infinity;
  for (let i = 0; i <= arr.length - n; i++) {
    const chunk = arr.slice(i, i + n).sort((a, b) => a - b);
    const trimmed = chunk.slice(1, -1);
    const avg = getMean(trimmed);
    if (avg < best) best = avg;
  }
  return isFinite(best) ? best : null;
}

function formatTimeValue(t) {
  if (t == null) return "-";
  return t >= 60 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}` : t.toFixed(2);
}

function markLastSoloAsPenalty(type) {
  const lastSolve = soloSolves[soloSolves.length - 1];
  if (!lastSolve) return;

  if (type === "DNF") {
    lastSolve.dnf = true;
    lastSolve.plusTwo = false;
  } else if (type === "+2") {
    lastSolve.plusTwo = true;
    lastSolve.dnf = false;
  }
}

function formatSoloTime(solve) {
  if (solve.dnf) return "DNF";
  let time = solve.time;
  if (solve.plusTwo) time += 2;
  return formatTimeValue(time); // 2 decimal places
}




// Room logic
const match = window.location.pathname.match(/\/room\/(SOLO|[A-Z]{5}|NEW)/i);

let roomCode = match?.[1]?.toUpperCase() || null;
const isSolo = roomCode === "SOLO";
let token = null;
let isLeader = false;

function generateSafeToken() {
  return (
    crypto.randomUUID?.() ||
    [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')
  ).replace(/-/g, '');
}

function appendChatMessage(name, message, type = "user") {
  const msgElem = document.createElement('div');

  if (type === "system") {
    msgElem.classList.add("chat-entry", "system-message");
    msgElem.textContent = message;
    document.querySelector('.chat-messages').append(msgElem);
    return;
  }

  const isOwn = name === window.userName;
  const isSenderLeader = name === window.roomLeaderName;
  const iconSVG = isSenderLeader ? crownSVG : personSVG;

  const EMOTE_MAP = {
    ":pray:": "🛐",
    ":smile:": "😄",
    ":sob:": "😭",
    ":fire:": "🔥",
    ":heart:": "🫶",
    ":sunglasses:": "😎",
    ":cube:": "🧊",
    ":ok:": "👌",
    ":gg:": "🤌",
    ":crylaugh:": "😂",
    ":skull:": "💀",
    ":angry:": "😠",
    ":tutel:": "🐢"
  };

  function parseEmotes(text) {
    return text.replace(/:\w+:/g, match => EMOTE_MAP[match] || match);
  }

  const parsedMsg = parseEmotes(message).replace(
    /(https?:\/\/[^\s]+)/g,
    (url) => `<span class="copy-link" data-link="${url}">${url}</span>`
  );

  msgElem.innerHTML = `
    <span class="chat-name">
      ${iconSVG}
      ${name}
    </span>: ${parsedMsg}`;


  msgElem.classList.add('chat-entry', isOwn ? 'own-message' : 'other-message');
  document.querySelector('.chat-messages').prepend(msgElem);
}

//listener for copying overlay link
document.addEventListener("click", (e) => {
  const linkElem = e.target.closest(".copy-link");
  if (linkElem) {
    const url = linkElem.dataset.link;
    navigator.clipboard.writeText(url).then(() => {
      linkElem.textContent = "Copied overlay link!";
      setTimeout(() => {
        linkElem.textContent = url;
      }, 1500);
    });
  }
});



const nickname = sessionStorage.getItem("nickname") || "Unnamed";
const socket = isSolo ? null : io();

      // Icons
const crownSVG = `
<svg class="chat-icon" width="24" height="24" xmlns="http://www.w3.org/2000/svg" fill="none"
  viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round"
    d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
  </svg>`;

const personSVG = `
<svg class="chat-icon" xmlns="http://www.w3.org/2000/svg" fill="none"
  viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round"
    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
</svg>`;

if (!isSolo) {
  // Handle create or join

  document.getElementById('stats-toggle')?.classList.add('hidden');
  document.getElementById('stats-panel')?.classList.add('hidden');
  if (roomCode === "NEW") {
    socket.emit("createRoom", { nickname });
    console.log("[CLIENT] Requested to create a new room!");
  } else if (roomCode) {
    token = localStorage.getItem(`token-${roomCode}`) || generateSafeToken();
    console.log(`[CLIENT] Attempting to join room ${roomCode} as ${nickname} with token ${token}`);
    sessionStorage.setItem("targetRoom", roomCode);
    socket.emit("joinRoom", { roomCode, nickname, token });
  }

  // Room created
  socket.on("roomCreated", ({ roomCode: createdCode, token: newToken }) => {
    console.log(`[CLIENT] Room created: ${createdCode}`);
    sessionStorage.setItem("targetRoom", createdCode);
    localStorage.setItem(`token-${createdCode}`, newToken);
    window.location.href = `/room/${createdCode}`;
  });

  //pulse animation function
  function triggerPulseAnimation() {
    const toggle = document.getElementById("chat-toggle");

    toggle.classList.remove("pulse-once");

    // Trigger reflow to restart animation
    void toggle.offsetWidth;

    toggle.classList.add("pulse-once");
  }


  // Room joined
  socket.on("roomJoined", ({ scramble, token: receivedToken, leader, players }) => {

    console.log("[CLIENT] Successfully joined room!");
    console.log("[CLIENT] Scramble received:", scramble);
    roomCode = sessionStorage.getItem("targetRoom") || roomCode;
    window.roomCode = roomCode;
    window.userToken = token;
    window.userName = nickname;
    window.roomLeaderToken = leader;
    window.allPlayers = players;
    window.roomLeaderName = players?.[leader] || "whotfisdis";

    token = receivedToken;
    isLeader = token === leader;

    //send link to chat
    if (isLeader) {
      const overlayLink = `${window.location.origin}/overlay/index.html?room=${roomCode}`;
      socket.emit("chatMessage", {
        token,
        message: `Overlay link: ${overlayLink}`,
        type: "system"
      });
    }


    if (isSolo) {
      const leaderboard = document.getElementById("leaderBoardID");
      if (leaderboard) leaderboard.style.display = "none";
      copyCodeContainer.style.display = "none";
    }

    if (isLeader) {
      nextScrambleBtn.style.display = "inline-block";
    } else {
      nextScrambleBtn.style.display = "none";
    }

    if (copyCodeDisplay) {
      copyCodeDisplay.textContent = `${roomCode}`;
    }
    if (copyCodeContainer) {
      copyCodeContainer.style.display = "inline-block";
    }

    typeWithCursor(scrambleLabel, "Current Scramble:", 35, true);
    setTimeout(() => {
      typeWithCursor(scrambleDisplay, scramble || "No scramble found.", 18, false);
    }, 400);

    doneSolving = false;

    //chat logic
    document.getElementById("chatForm").addEventListener('submit', (e) => {
      e.preventDefault();
      const message = document.querySelector('#chatForm input').value.trim();
      if (message) {
        socket.emit('chatMessage', { token: receivedToken, message });
        document.querySelector('#chatForm input').value = '';
      }
    });

    socket.on("chatMessage", ({ name, message, type }) => {
      appendChatMessage(name, message, type);

      const chatPanel = document.getElementById("chat-panel");
      const isChatOpen = chatPanel.classList.contains("open");
      if (!isChatOpen) {
        triggerPulseAnimation();
      }
    });


  });

  socket.on("chatHistory", (messages) => {
    console.log("[CLIENT] Received chat history:", messages);
    for (const { name, message, type } of messages) {
      appendChatMessage(name, message, type);
    }
  });


  // Copy to clipboard
  const copyIcon = document.getElementById("copyIcon");
  copyIcon?.addEventListener("click", () => {
    navigator.clipboard.writeText(roomCode).then(() => {
      console.log("Room code copied!");
    });
  });

  // Scramble update
  socket.on("scrambleUpdated", (newScramble) => {
    console.log("[CLIENT] New scramble received:", newScramble);
    document.getElementById("top5").innerHTML = "";
    typeWithCursor(scrambleDisplay, newScramble, 18, false);

    doneSolving = false;
    timerDisplay.textContent = "0.00";
  });

  nextScrambleBtn.addEventListener("click", () => {
    console.log("[CLIENT] Next Scramble button clicked!");
    if (token && roomCode) {
      socket.emit("requestNextScramble", { roomCode, token });
    }
    nextScrambleBtn.blur();
  });

  socket.on("leaderboardUpdate", (top5) => {
    const topList = document.getElementById("top5");
    topList.innerHTML = "";

    top5.forEach((entry, i) => {
      const li = document.createElement("li");
      const rank = (i+1).toString();
      const displayTime = isNaN(entry.time) ? "DNF" : entry.time.toFixed(2);

      li.innerHTML = `
        <span class="rank">${rank}</span>
        <span class="name">${entry.name}</span>
        <span class="time">${entry.time.toFixed(2)}</span>
      `;
      li.classList.add("entry-pop");
      topList.appendChild(li);
    });
  });

  socket.on("leaderChanged", ({ newLeaderToken, newLeaderName }) => {
  console.log(`[CLIENT] New leader: ${newLeaderName} (${newLeaderToken})`);
  window.roomLeaderToken = newLeaderToken;
  window.roomLeaderName = newLeaderName;

  isLeader = token === newLeaderToken;

  // Toggle next scramble button based on leadership
  if (isLeader) {
    nextScrambleBtn.style.display = "inline-block";
  } else {
    nextScrambleBtn.style.display = "none";
  }

  // Optional: Refresh chat crown icons
  const chatEntries = document.querySelectorAll(".chat-entry");
  chatEntries.forEach(entry => {
    const nameSpan = entry.querySelector(".chat-name");
    if (!nameSpan) return;

    const nameText = nameSpan.textContent.trim();
    const name = nameText.replace(/^\s*\S+\s*/, "").trim(); // Remove old icon

    nameSpan.innerHTML = `
      ${name === newLeaderName ? crownSVG : personSVG}
      ${name}
    `;
    });
  });

}

// Typing animation
function typeWithCursor(element, text, speed = 65, showCursor = true) {
  element.textContent = "";

  if (showCursor) {
    element.classList.add("typing-cursor");
  } else {
    element.classList.remove("typing-cursor");
  }

  let i = 0;
  function typeChar() {
    if (i < text.length) {
      element.textContent += text[i++];
      setTimeout(typeChar, speed);
    } else {
      element.classList.remove("typing-cursor");
    }
  }
  typeChar();
  
}

// Timer functions
function formatTime(ms, { precision = 2, compact = false } = {}) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(precision);

  let result = minutes > 0
    ? `${minutes}:${seconds.padStart(5, '0')}`
    : seconds.padStart(precision + 3, '0');

  if (compact && minutes === 0 && result.startsWith("0")) {
    result = result.slice(1);
  }

  return result;
}


function startTimer() {
  running = true;
  startTime = performance.now();
  timerDisplay.textContent = "0.00";
  document.body.classList.add("timing");
  requestAnimationFrame(() => {
    timer = requestAnimationFrame(updateTimer);
  });
}

function stopTimer() {
  running = false;
  cancelAnimationFrame(timer);
  document.body.classList.remove("timing");
  doneSolving = true;
  postSolveOptions.classList.add("visible");

  const elapsed = performance.now() - startTime;

  // Format final time with 2 decimals, optionally remove leading 0
  const finalFormatted = formatTime(elapsed, {
    precision: 2,
    compact: true // set to false if you want to keep the "0."
  });

  timerDisplay.textContent = finalFormatted;

  const scramble = scrambleDisplay.textContent.trim();
  lastSubmittedScramble = scramble;

  // SOLO MODE: Track local solves for statistics
  if (isSolo && elapsed > 0) {
    onSoloSolveComplete(elapsed); // Pass raw ms
  }

  // MULTIPLAYER: Submit solve to server
  if (!isSolo && finalFormatted !== "0.00") {
    socket.emit("submitSolve", {
      roomCode,
      token,
      time: finalFormatted,
      scramble: scramble,
      penalty: currentPenalty
    });
    console.log("Solve submitted: ", finalFormatted, "Penalty:", currentPenalty);
  }

  currentPenalty = null;
}


function updateTimer() {
  if (!running) return;
  const elapsed = performance.now() - startTime;

  timerDisplay.textContent = formatTime(elapsed, {
    precision: 1,
    compact: true // removes leading 0
  });

  timer = requestAnimationFrame(updateTimer);
}

//for buttons
document.getElementById("plusTwoBtn").addEventListener("click", () => {
  if (timerDisplay.textContent === "0.00") return;
  currentPenalty = '+2';
  console.log("+2 penalty applied");

  if (!isSolo) {
    socket.emit("applyPenalty", {
      roomCode,
      token,
      scramble: lastSubmittedScramble,
      penalty: "+2"
    });
  } else {
    markLastSoloAsPenalty("+2");
    updateStatsPanel();
    updateSolveHistory();
  }

  lastSubmittedScramble = null;
});

document.getElementById("dnfBtn").addEventListener("click", () => {
  if (timerDisplay.textContent === "0.00") return;
  currentPenalty = 'DNF';
  console.log("DNF applied");

  if (!isSolo) {
    socket.emit("applyPenalty", {
      roomCode,
      token,
      scramble: lastSubmittedScramble,
      penalty: "DNF"
    });
  } else {
    markLastSoloAsPenalty("DNF");
    updateStatsPanel();
    updateSolveHistory();
  }

  lastSubmittedScramble = null;
});


document.addEventListener("keydown", (e) => {
  if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;
  if (e.code === "Space") {
    if (!heldSpace) {
      heldSpace = true;

      if (running) {
        stopTimer();
      } else if (!doneSolving) {
        readyToStart = true;
        timerDisplay.textContent = "0.00";
        timerDisplay.classList.add("ready");
      }
    }

    e.preventDefault();
  }
});


document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;
    if (readyToStart && !running) {
      startTimer();
    }

    if (isSolo && !running && doneSolving) {
      setTimeout(async () => {
        const newScramble = await generateScramble();
        typeWithCursor(scrambleDisplay, newScramble, 18, false);
        doneSolving = false;
      }, 400);

    }

    heldSpace = false;
    readyToStart = false;
    timerDisplay.classList.remove("ready");

    e.preventDefault();
  }
});

// Touch support for mobile devices
const touchArea = document.getElementById("touchArea");
const isMobile = /Mobi|Android/i.test(navigator.userAgent);

if (isMobile) {
  console.log("Mobile detected — enabling touch timer");
  document.body.classList.add('ready');

  let touchHeld = false;

  touchArea.addEventListener("touchstart", (e) => {
    if (touchHeld) return;
    touchHeld = true;

    if (running) {
      stopTimer();
    } else if (!doneSolving) {
      readyToStart = true;
      timerDisplay.textContent = "0.00";
      timerDisplay.classList.add("ready");
    }

    e.preventDefault();
  }, { passive: false });

  touchArea.addEventListener("touchend", (e) => {
    if (readyToStart && !running) {
      startTimer();
    }

    if (isSolo && !running && doneSolving) {
      setTimeout(async () => {
        const newScramble = await generateScramble();
        typeWithCursor(scrambleDisplay, newScramble, 18, false);
        doneSolving = false;
      }, 400);
    }

    touchHeld = false;
    readyToStart = false;
    timerDisplay.classList.remove("ready");

    e.preventDefault();
  }, { passive: false });
}



//singleplayer functions
async function generateScramble() {
  if (window.getRandomScramble) {
    try {
      return await window.getRandomScramble();
    } catch (e) {
      console.error("Failed to get scramble from cubing/scramble:", e);
    }
  }
  return generateFallbackScramble(); // optional fallback
}




function handleRoomJoined({ scramble, token: receivedToken, leader }) {
  console.log("[CLIENT] Joined room (solo or multi)!");
  console.log("[CLIENT] Scramble received:", scramble);

  token = receivedToken;
  isLeader = token === leader;

  if (isSolo) {
    document.querySelector(".leaderboard")?.remove();
    const toggle = document.getElementById("chat-toggle");
    if (toggle) toggle.style.display = "none";

    copyCodeContainer?.remove();
    nextScrambleBtn?.remove();
    
  } else {
    if (isLeader) {
      nextScrambleBtn.style.display = "inline-block";
    } else {
      nextScrambleBtn.style.display = "none";
    }

    if (copyCodeDisplay) copyCodeDisplay.textContent = `${roomCode}`;
    if (copyCodeContainer) copyCodeContainer.style.display = "inline-block";
  }

  typeWithCursor(scrambleLabel, "Current Scramble:", 35, true);
  setTimeout(() => {
    typeWithCursor(scrambleDisplay, scramble || "No scramble found.", 18, true);
  }, 400);

  doneSolving = false;
}

//if SOLO MODE::::
if (isSolo) {
  console.log("SOLO MODE LOADED");

  generateScramble().then(scramble => {
    document.getElementById("live-averages")?.classList.remove("hidden");

    handleRoomJoined({
      scramble,
      token: generateSafeToken(),
      leader: null
    });

    document.getElementById("leaderBoardID")?.remove();
    copyCodeContainer?.remove();
    loadSolvesFromStorage();
  });
}
