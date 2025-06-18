let previousTop5 = [];

function animateEntryChange(li) {
  li.classList.add('new-entry');
  setTimeout(() => {
    li.classList.remove('new-entry');
  }, 1500);
}

async function fetchLeaderboard() {
  try {
    const response = await fetch('/leaderboard');
    const result = await response.json();
    const top5 = result.top5;

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

    previousTop5 = [...top5]; // Update memory

  } catch (err) {
    console.error('Failed to load leaderboard:', err);
  }
}

fetchLeaderboard();
setInterval(fetchLeaderboard, 5000);

