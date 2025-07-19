window.addEventListener("DOMContentLoaded", () => {
  const nicknameInput = document.getElementById("nickname");
  const roomCodeInput = document.getElementById("roomCodeInput");
  const joinBtn = document.getElementById("joinBtn");
  const createBtn = document.getElementById("createBtn");


  function updateButtonState() {
    const name = nicknameInput.value.trim();
    const valid = name.length > 0 && name.length <= 18;
    joinBtn.disabled = !valid;
    createBtn.disabled = !valid;
  }

  nicknameInput.addEventListener("input", updateButtonState);
  updateButtonState(); // Run on load

  joinBtn.addEventListener("click", () => {
    const name = nicknameInput.value.trim();
    const code = roomCodeInput.value.trim().toUpperCase();

    if (!name) return alert("Please enter your name.");
    if (!/^[A-Z]{5}$/.test(code)) return alert("Invalid room code.");

    sessionStorage.setItem("nickname", name);
    window.location.href = `/room/${code}`;
  });

  createBtn.addEventListener("click", () => {
    const name = nicknameInput.value.trim();
    if (!name) return alert("Please enter your name.");

    sessionStorage.setItem("nickname", name);
    window.location.href = "/room/NEW";
  });

  //move to solo on clicking
  const soloBtn = document.getElementById("soloBtn");

  soloBtn.addEventListener("click", () => {
    console.log("solo button clicked!");
    const name = nicknameInput.value.trim();

    sessionStorage.setItem("nickname", name);
    window.location.href = "/room/SOLO";
  });
});
/*
const header = document.querySelector("header");
const glassBox = document.querySelector("div.glass-box");
const introText = document.querySelector("div.intro-text");
window.addEventListener("scroll", () => {
  if (window.scrollY > 1) {
    header.classList.add("scrolled-header");
    glassBox.classList.add("scrolled-glass-box");
    introText.classList.remove("hidden");
    scrollReminder.classList.add("hidden");
    scrollReminder.style.display = "none";
    document.body.classList.add("scrolled-background");
  } else {
    header.classList.remove("scrolled-header");
    glassBox.classList.remove("scrolled-glass-box");
    introText.classList.add("hidden");
    scrollReminder.classList.remove("hidden");
    scrollReminder.style.display = "block";
    document.body.classListremove("scrolled-background");
  }
});
*/
