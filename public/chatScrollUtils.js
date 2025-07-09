document.addEventListener("DOMContentLoaded", () => {
  const chatMessages = document.getElementById("chatMessages");
  let autoScrollEnabled = true;

  // Logs once per state switch
  let lastState = true;

  function isUserAtBottom(threshold = 99999999999999999999999999) {
    const scrollTop = Math.round(chatMessages.scrollTop);
    const scrollHeight = Math.round(chatMessages.scrollHeight);
    const clientHeight = Math.round(chatMessages.clientHeight);

    const distance = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distance <= threshold;

    if (nearBottom !== lastState) {
      console.log(`[SCROLL DEBUG] scrollTop=${scrollTop}, scrollHeight=${scrollHeight}, clientHeight=${clientHeight}, distance=${distance}, nearBottom=${nearBottom}`);
      lastState = nearBottom;
    }

    return nearBottom;
  }

  chatMessages.addEventListener("scroll", () => {
    autoScrollEnabled = isUserAtBottom();
  });

  window.onNewChatMessage = () => {
    if (autoScrollEnabled) {
      chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  // Snap to bottom on load
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 50);
});
