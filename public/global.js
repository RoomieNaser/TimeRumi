//basic ui stuff here
const hamIcon = document.getElementById("ham");
const copyLogo = document.getElementById("copyIcon");
const settings = document.getElementById("settingsID");
const audio = document.getElementById("clickAudio");

const modeToggle = document.getElementById("modeIcon");

const settingsBtn = document.getElementById("settingsIcon");
const settingsOverlay = document.getElementById("settingsOverlay");

//DARK MODE NEW!
const settingsDarkToggle = document.getElementById("settingsDarkToggle");
const isDark = localStorage.getItem("darkMode") === "true";

settingsDarkToggle.addEventListener("change", () => {
  const isDark = settingsDarkToggle.checked;
  document.body.classList.toggle("dark-mode", isDark);
  localStorage.setItem("darkMode", isDark);

  hamIcon.src = isDark ? "/assets/homeDark.svg" : "/assets/homeLight.svg";
  copyLogo.src = isDark ? "/assets/copyDark.svg" : "/assets/copyLight.svg";
  settings.src = isDark ? "/assets/settings-dark.svg" : "/assets/settings.svg";
})

//for leaderboard
function applyLeaderboardPreference() {
  const hide = localStorage.getItem("hideLeaderboard") === "true";
  const lb = document.getElementById("leaderBoardID");
  if (lb) lb.style.display = hide ? "none" : "block";

  const toggle = document.getElementById("toggle-leaderboard");
  if (toggle) toggle.checked = !hide;
}

document.getElementById("toggle-leaderboard")?.addEventListener("change", (e) => {
  console.log("bruh it clicks for leaderboard toggle event listener")
  const shouldShow = e.target.checked;
  localStorage.setItem("hideLeaderboard", (!shouldShow).toString());
  applyLeaderboardPreference();
});


//for ao5 and ao12
function applyAveragePreference() {
  const hide = localStorage.getItem("hideAverage") === "true";
  const avg = document.getElementById("live-averages");
  if (avg) avg.style.display = hide ? "none" : "block";
}

document.getElementById("toggle-averages")?.addEventListener("change", (e) => {
  const shouldShow = e.target.checked;
  localStorage.setItem("hideAverage", (!shouldShow).toString());
  applyAveragePreference();
})



//dropdown logic
const dropdown = document.getElementById('fontDropdown');
const selected = dropdown.querySelector(".dropdown-selected");
const options = dropdown.querySelector(".dropdown-options");

const timerModeDropdown = document.getElementById('timerModeDropdown');
const selectedMode = timerModeDropdown.querySelector('.dropdown-selected');
const optionsMode = timerModeDropdown.querySelector(".dropdown-options");



const savedTimerMode = localStorage.getItem("timerMode");
if (savedTimerMode) {
  selectedMode.querySelector(".dropdown-text").textContent = savedTimerMode;
}

selectedMode.addEventListener("click", () => {
  optionsMode.classList.toggle("show");
});

optionsMode.querySelectorAll("li").forEach(option => {
  option.addEventListener("click", () => {
    const mode = option.textContent.trim();
    selectedMode.querySelector(".dropdown-text").textContent = mode;
    optionsMode.classList.remove("show");

    localStorage.setItem("timerMode", mode);
    applyTimerModeUI();
  });
});

selected.addEventListener("click", () => {
  options.classList.toggle("show");
});

options.querySelectorAll("li").forEach(option => {
  option.addEventListener("click", () => {
    const textSpan = selected.querySelector('.dropdown-text');
    textSpan.textContent = option.textContent;
    options.classList.remove("show"); 
    document.body.style.fontFamily = option.dataset.font;
  });
});



// Universal dropdown close on outside click
document.addEventListener("click", (event) => {
  allDropdowns.forEach(({ container, options }) => {
    if (!container.contains(event.target)) {
      options.classList.remove("show");
    }
  });
});


//Focus mode logic
const focusToggle = document.getElementById("focusToggle");

focusToggle.addEventListener("change", () => {
  const enabled = focusToggle.checked;
  localStorage.setItem("focusMode", enabled);
  document.body.classList.toggle("focus-mode", enabled);
});




//ON TO TIMER SETTINGSSS
//Font timerrr
const timerDropdown = document.getElementById('timerFontDropdown');
const selectedTimer = timerDropdown.querySelector(".dropdown-selected");
const optionsTimer = timerDropdown.querySelector(".dropdown-options");

// Combine all dropdowns for global click handling
const allDropdowns = [
  { container: dropdown, options: options },
  { container: timerDropdown, options: optionsTimer },
  { container: timerModeDropdown, options: optionsMode }
];


const storedTimerFont = localStorage.getItem("timerFont");
if (storedTimerFont) {
  timerDisplay.style.fontFamily = storedTimerFont;
  selectedTimer.querySelector(".dropdown-text").textContent = storedTimerFont.replace(/['"]/g, '');
}

selectedTimer.addEventListener("click", () => {
  optionsTimer.classList.toggle("show");
});

optionsTimer.querySelectorAll("li").forEach(option => {
  option.addEventListener("click", () => {
    const font = option.dataset.font;
    const name = option.textContent;

    selectedTimer.querySelector(".dropdown-text").textContent = name;

    optionsTimer.classList.remove("show");

    timerDisplay.style.fontFamily = font;
    localStorage.setItem("timerFont", font);
    localStorage.setItem("timerFontName", name);
  });

});


//WCA and Safety
let inspectionInterval;

window.inspectionPenalty = null;

let inspectionBeep8 = false;
let inspectionBeep12 = false;

let inspectionTimerInterval = null;
let inspectionDisplay = document.getElementById("inspection-timer");



const inspectionToggle = document.getElementById("toggle-inspection");
const safetyToggle = document.getElementById("toggle-safety");

const inspectionEnabled = localStorage.getItem("inspectionMode") === "true";
window.inspectionEnabled = inspectionEnabled;
const safetyEnabled = localStorage.getItem("safetyMode") === "true";

inspectionToggle.checked = inspectionEnabled;
safetyToggle.checked = safetyEnabled;

inspectionToggle.addEventListener("change", () => {
  localStorage.setItem("inspectionMode", inspectionToggle.checked);
  window.inspectionEnabled = inspectionToggle.checked;
});

safetyToggle.addEventListener("change", () => {
  localStorage.setItem("safetyMode", safetyToggle.checked);
});


//function for switching timer mode
function applyTimerModeUI() {
  const mode = localStorage.getItem("timerMode");

  if (mode === "Manual") {
    timerDisplay.classList.add("hidden");
    manualTimerDisplay.classList.remove("hidden");
    isManualMode = true;
  } else {
    timerDisplay.classList.remove("hidden");
    manualTimerDisplay.classList.add("hidden");
    isManualMode = false;
  }
}

function startInspection() {
  if (!inspectionToggle.checked || running || inspecting) return;

  inspecting = true;
  window.inspectionStart = Date.now();
  window.inspectionPenalty = null;

  timerDisplay.textContent = "15";
  timerDisplay.classList.add("inspection");
  timerDisplay.classList.remove("dnf", "penalty");

  document.body.classList.add("inspecting");

  let inspectionBeep8 = false;
  let inspectionBeep12 = false;

  inspectionTimerInterval = setInterval(() => {
    const elapsed = (Date.now() - window.inspectionStart) / 1000;
    const remaining = 15 - elapsed;

    if (!inspectionBeep8 && remaining <= 7 && remaining > 3) {
      inspectionBeep8 = true;
      playBeep();
    }

    if (!inspectionBeep12 && remaining <= 3 && remaining > 0) {
      inspectionBeep12 = true;
      playBeep();
    }

    if (remaining <= 0 && remaining > -2) {
      timerDisplay.textContent = "+2";
      timerDisplay.classList.add("penalty");
      window.inspectionPenalty = "+2";
    } else if (remaining <= -2) {
      timerDisplay.textContent = "DNF";
      timerDisplay.classList.remove("penalty");
      timerDisplay.classList.add("dnf");
      window.inspectionPenalty = "DNF";

      clearInterval(inspectionTimerInterval);
      inspectionTimerInterval = null;
    } else {
      timerDisplay.textContent = Math.ceil(remaining);
    }
  }, 200);
}



function playBeep() {
  const beep = document.getElementById("inspectionBeep");
  if (beep) {
    beep.currentTime = 0;
    beep.volume = 0.9;
    beep.play().catch(e => {
      console.warn("[Beep] Could not play sound:", e);
    });
  }
}





function resetTimerDisplay() {
  const timerDisplay = document.getElementById("timerDisplay");
  if (timerDisplay) {
    timerDisplay.classList.remove("inspection");
    timerDisplay.textContent = "0.00";
  }
}


function lockPenaltyOptions() {
  document.getElementById("addPlus2")?.setAttribute("disabled", true);
  document.getElementById("addDNF")?.setAttribute("disabled", true);
}






//settings go brr
settingsBtn.addEventListener("click", () => {
  settingsOverlay.classList.remove("hidden");
});

settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) {
    settingsOverlay.classList.add("hidden");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    settingsOverlay.classList.add("hidden");
  }
});

//hamburgerrrrrrrrrrrrrrr
hamIcon.addEventListener("click", () => {
  audio.currentTime = 0;
  audio.volume = 0.7;
  audio.play();
});



//DOM CONTENT LOADED!!
window.addEventListener("DOMContentLoaded", () => {
  console.log("inspectionDisplay", inspectionDisplay)
  const isFirefox = typeof InstallTrigger !== 'undefined';
    if (isFirefox) {
      document.body.classList.add('firefox');
    }

  if (isDark) {
    document.body.classList.add("dark-mode");
  }
  settingsDarkToggle.checked = isDark;

  document.querySelector('.scramble-string')?.addEventListener('click', () => {
    const scrambleText = document.querySelector('.scramble-string').textContent.trim();

    if (scrambleText) {
      navigator.clipboard.writeText(scrambleText)
        .then(() => {
          console.log("Scramble copied to clipboard!");
          // Optional: show a UI confirmation
          const copiedMsg = document.createElement("div");
          copiedMsg.textContent = "Scramble Copied!";
          copiedMsg.className = "copied-message";
          document.body.appendChild(copiedMsg);
          setTimeout(() => copiedMsg.remove(), 1000);
        })
        .catch(err => {
          console.error("Copy failed:", err);
        });
    }
  });


  //focus mode storage
  const savedFocus = localStorage.getItem("focusMode") === "true";
  focusToggle.checked = savedFocus;
  document.body.classList.toggle("focus-mode", savedFocus);

  //timerMode storage
  applyTimerModeUI();

  //leaderboard storage
  applyLeaderboardPreference();

  //average storage
  applyAveragePreference();

 //switch settings content
 document.querySelectorAll('.settings-sidebar li').forEach(tab => {
  tab.addEventListener('click', () => {
    //saying fuck you to all active tabs
    document.querySelectorAll('.settings-sidebar li').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    //Hide all tab contents and shitz
    document.querySelectorAll('.settings-tab-content').forEach(content => content.classList.add('hidden'));

    //Show the mfers what they want
    const targetId = tab.getAttribute('data-target');
    document.getElementById(targetId).classList.remove('hidden');
  });
 });

  //exportCSV
  document.getElementById('exportCSV').addEventListener('click', () => {
    const rows = document.querySelectorAll('#history-table tr');
    let csvContent = '';

    rows.forEach(row => {
      const cols = Array.from(row.querySelectorAll('th, td')).map(cell =>
        `"${cell.textContent.trim()}"`
      );
      csvContent += cols.join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'solve_history.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });


  //ICON RESTORATION SPELL
  hamIcon.src = isDark ? "/assets/homeDark.svg" : "/assets/homeLight.svg";
  copyLogo.src = isDark ? "/assets/copyDark.svg" : "/assets/copyLight.svg";
  settings.src = isDark ? "/assets/settings-dark.svg" : "/assets/settings.svg";
});
