let previousTop5 = [];

function animateEntryChange(li) {
  li.classList.add('new-entry');
  setTimeout(() => {
    li.classList.remove('new-entry');
  }, 1500);
}

function getRoomCodeFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room')?.toUpperCase() || null;
}

function displayLeaderboard(top5) {
  const top5El = document.getElementById('top5');
  top5El.innerHTML = '';

  top5.forEach((entry, index) => {
    const prev = previousTop5[index];
    const isNew = !prev || prev.name !== entry.name || prev.time !== entry.time;

    const li = document.createElement('li');
    const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
    li.innerHTML = `
      <span class="rank ${rankClass}">${index + 1}. </span>
      <span class="name">${entry.name}</span>
      <span class="time">${entry.time}</span>
    `;

    if (isNew) animateEntryChange(li);
    top5El.appendChild(li);
  });

  previousTop5 = [...top5];
}

// Main
const roomCode = getRoomCodeFromURL();
if (!roomCode) {
  console.error("Missing ?room=XXXX in URL.");
} else {
  const socket = io(); // Connect to server

  // Fake token and nickname (OBS overlay doesn't participate, just listens)
  const fakeToken = "overlay_" + Math.random().toString(36).substring(2, 10);
  const nickname = "Overlay";

  socket.emit("joinRoom", { roomCode, nickname, token: fakeToken });

  socket.on("leaderboardUpdate", (top5) => {
    displayLeaderboard(top5.slice(0, 5));
    socket.on("scrambleUpdated", () => {
      const top5El = document.getElementById('top5');
      top5El.innerHTML = '';
      previousTop5 = [];
    });

  });
}

