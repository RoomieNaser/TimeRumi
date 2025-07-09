document.addEventListener("DOMContentLoaded", () => {
  const chatPanel = document.getElementById("chat-panel");
  const chatToggle = document.getElementById("chat-toggle");
  const chatCloseBtn = document.getElementById("chatClose");
  const header = chatPanel.querySelector(".chat-header");

  const statsToggle = document.getElementById('stats-toggle');
  const statsPanel = document.getElementById('stats-panel');
  const statsCloseBtn = document.getElementById("statsClose");
  const isSolo = window.location.pathname.includes("/room/SOLO");

 
  const closeSVG = `
    <svg width="30" height="30" xmlns="http://www.w3.org/2000/svg" fill="none"
      viewBox="0 0 24 24" stroke-width="1.5" stroke="white" class="size-6">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>`;

  const expandSVG = `
    <svg width="30" height="30" viewBox="0 0 24.00 24.00" fill="none" 
      xmlns="http://www.w3.org/2000/svg">
      <path d="M14 10L21 3M21 3H16.5M21 3V7.5M10 14L3 21M3 21H7.5M3 21L3 16.5" 
      stroke="#ffffff" stroke-width="0.528" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  function setChatIcon(mode) {
    chatCloseBtn.innerHTML = mode === "floating" ? expandSVG : closeSVG;
    chatCloseBtn.title = mode === "floating" ? "Redock chat" : "Close chat";
  }

  setChatIcon("docked");

  function redockChat() {
    chatPanel.classList.remove("floating");
    chatPanel.classList.add("chat-docked", "chat-redocking");

    // Reset position
    chatPanel.style.left = "";
    chatPanel.style.top = "";
    chatPanel.style.right = "";
    chatPanel.style.bottom = "";
    chatPanel.style.position = "";

    setChatIcon("docked");
    updateChatToggleVisibility();

    setTimeout(() => {
      chatPanel.classList.remove("chat-redocking");
    }, 300);
  }

  function updateChatToggleVisibility() {
    const isFloating = chatPanel.classList.contains("floating");
    const isOpen = chatPanel.classList.contains("chat-open");

    if (isFloating && isOpen) {
      chatToggle.classList.add("hidden");
    } else {
      chatToggle.classList.remove("hidden");
    }
  }


  let isDragging = false;
  let offsetX = 0, offsetY = 0;

  header.addEventListener("mousedown", (e) => {
    if (e.target.closest("#chatClose")) return;

    isDragging = true;

    if (!chatPanel.classList.contains("floating")) {
      chatPanel.classList.remove("chat-docked");
      chatPanel.classList.add("floating");
      chatPanel.classList.add("chat-open");
      const rect = chatPanel.getBoundingClientRect();
      chatPanel.style.left = `${rect.left}px`;
      chatPanel.style.top = `${rect.top}px`;
      chatPanel.style.position = "fixed";

      setChatIcon("floating");

      updateChatToggleVisibility();
    }

    offsetX = e.clientX - chatPanel.offsetLeft;
    offsetY = e.clientY - chatPanel.offsetTop;
    document.body.style.userSelect = "none";
  });

  // Touch-based drag (mobile)
  header.addEventListener("touchstart", (e) => {
    if (e.target.closest("#chatClose")) return;

    isDragging = true;

    const touch = e.touches[0];
    const touchX = touch.clientX;
    const touchY = touch.clientY;

    if (!chatPanel.classList.contains("floating")) {
      chatPanel.classList.remove("chat-docked");
      chatPanel.classList.add("floating");
      chatPanel.classList.add("chat-open");

      requestAnimationFrame(() => {
        chatPanel.style.position = "fixed";
        const panelWidth = chatPanel.offsetWidth;
        const panelHeight = chatPanel.offsetHeight;

        // Center horizontally at finger, vertically align finger
        const left = Math.max(0, touchX - panelWidth / 2);
        const top = Math.max(0, touchY - panelHeight / 2);

        chatPanel.style.left = `${left}px`;
        chatPanel.style.top = `${top}px`;

        offsetX = touchX - left;
        offsetY = touchY - top;

        setChatIcon("floating");
        updateChatToggleVisibility();
      });
    } else {
      offsetX = touchX - chatPanel.offsetLeft;
      offsetY = touchY - chatPanel.offsetTop;
    }

    document.body.style.userSelect = "none";
  }, { passive: false });




  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    chatPanel.style.left = `${e.clientX - offsetX}px`;
    chatPanel.style.top = `${e.clientY - offsetY}px`;
    chatPanel.style.right = "auto";
    chatPanel.style.bottom = "auto";
  });

  document.addEventListener("touchmove", (e) => {
    if (!isDragging) return;

    const touch = e.touches[0];
    chatPanel.style.left = `${touch.clientX - offsetX}px`;
    chatPanel.style.top = `${touch.clientY - offsetY}px`;
    chatPanel.style.right = "auto";
    chatPanel.style.bottom = "auto";
  }, { passive: false });


  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = "";
  });

  document.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = "";
  });

  document.addEventListener("touchmove", (e) => {
  if (isDragging) e.preventDefault();
}, { passive: false });



  // Clicking the close button
  chatCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent header dragging logic
    if (chatPanel.classList.contains("floating")) {
      redockChat();
    } else {
      chatPanel.classList.remove("chat-open", "chat-docked");
      updateChatToggleVisibility();
    }
  });


  // Arrow toggle
  chatToggle.addEventListener("click", () => {
    const isOpen = chatPanel.classList.contains("chat-open");
    if (isOpen) {
      chatPanel.classList.remove("chat-open", "chat-docked");
    } else {
      chatPanel.classList.add("chat-open", "chat-docked");
      setChatIcon("docked");
    }
    updateChatToggleVisibility();
  });

  
  // Stats panel logic (solo mode)
  if (isSolo && statsToggle && statsPanel) {
    statsToggle.addEventListener("click", () => {
      statsPanel.classList.add("open");
      statsToggle.classList.add("hidden");
    });

    statsCloseBtn?.addEventListener("click", () => {
      statsPanel.classList.remove("open");
      setTimeout(() => {
        statsToggle.classList.remove("hidden");
      }, 200);
    });
  }

  updateChatToggleVisibility();
});
