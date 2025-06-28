
const chatForm = document.getElementById('chatForm');
const chatInput = chatForm.querySelector('input');
const chatMessages = document.querySelector('.chat-messages');

document.addEventListener("DOMContentLoaded", () => {
  const chatToggle = document.getElementById("chat-toggle");
  const chatPanel = document.getElementById("chat-panel");
  const chatCloseBtn = document.getElementById("chatClose");

  const statsToggle = document.getElementById('stats-toggle');
  const statsPanel = document.getElementById('stats-panel');
  const statsCloseBtn = document.getElementById("statsClose");

  const isSolo = window.location.pathname.includes("/room/SOLO");


  const roomCode = window.roomCode;
  const token = window.userToken;
  const nickname = window.userName;

  // Toggle chat visibility
  function toggleChat() {
    chatPanel.classList.toggle("chat-open");
  }

  // Click to toggle from arrow
  chatToggle.addEventListener("click", toggleChat);

  // Optional: Close with the X button
  chatCloseBtn.addEventListener("click", () => {
    chatPanel.classList.remove("chat-open");
  });
  if (isSolo && statsToggle && statsPanel) {
    statsToggle.addEventListener("click", () => {
      statsPanel.classList.add("open");
      statsToggle.classList.add("hidden");

    });

    statsCloseBtn?.addEventListener("click", () => {
      statsPanel.classList.remove("open");
      setTimeout(() => {
        statsToggle.classList.remove("hidden");
      }, 200)
    });
  }

});
